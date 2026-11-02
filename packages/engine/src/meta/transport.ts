import type { ResponsesEvent } from "@meta-sam/parser";
import OpenAI, { APIConnectionError, APIError, toFile } from "openai";
import { failureForStatus, MetaCallError } from "./errors.ts";
import type { TokenUsage } from "./models.ts";

export type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string | ChatContentPart[] }
  | { role: "assistant"; content: string };

export type ChatRequest = {
  model: string;
  messages: ChatMessage[];
  response_format?: {
    type: "json_schema";
    json_schema: { name: string; schema: Record<string, unknown>; strict?: boolean };
  };
  reasoning_effort?: "low" | "medium" | "high" | "max";
  max_completion_tokens?: number;
};

export type ChatResult = {
  content: string | null;
  refusal: string | null;
  finishReason: string | null;
  usage: TokenUsage;
};

export type ResponsesRequest = {
  model: string;
  stream: true;
  input: unknown[];
  metadata?: Record<string, string>;
};

/** The three Model API operations BlackboxAI uses. Tests inject a fake. */
export interface MetaTransport {
  chat(request: ChatRequest): Promise<ChatResult>;
  uploadFile(file: { bytes: Uint8Array; filename: string; mimeType: string }): Promise<string>;
  responsesStream(request: ResponsesRequest): Promise<AsyncIterable<ResponsesEvent>>;
}

export const DEFAULT_BASE_URL = "https://api.meta.ai/v1";

/**
 * The real transport, over the OpenAI-compatible SDK. It refuses to exist
 * under the test runner, so no test can make a billed call by accident.
 */
export function createMetaTransport(env: NodeJS.ProcessEnv = process.env): MetaTransport {
  if (env.BLACKBOX_TEST === "1") {
    throw new Error("Tests may not build a real Meta transport. Inject a fake MetaTransport.");
  }
  const apiKey = env.MODEL_API_KEY?.trim();
  if (!apiKey) throw new MetaCallError("auth", "MODEL_API_KEY is not set.");
  const client = new OpenAI({
    apiKey,
    baseURL: env.META_API_BASE_URL?.trim() || DEFAULT_BASE_URL,
    timeout: 10 * 60 * 1000,
    maxRetries: 0, // retries are ours, so each attempt gets a lineage row
  });

  return {
    async chat(request) {
      const res = await call(() =>
        client.chat.completions.create(
          request as unknown as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
        ),
      );
      const choice = res.choices[0];
      const usage = res.usage;
      return {
        content: choice?.message.content ?? null,
        refusal: choice?.message.refusal ?? null,
        finishReason: choice?.finish_reason ?? null,
        usage: {
          tokensIn: usage?.prompt_tokens ?? 0,
          tokensCached: usage?.prompt_tokens_details?.cached_tokens ?? 0,
          tokensOut: usage?.completion_tokens ?? 0,
        },
      };
    },

    async uploadFile({ bytes, filename, mimeType }) {
      const file = await toFile(bytes, filename, { type: mimeType });
      const res = await call(() => client.files.create({ file, purpose: "user_data" }));
      return res.id;
    },

    async responsesStream(request) {
      // The SDK's input types do not list `input_video`; the API accepts it.
      const stream = await call(() =>
        client.responses.create(
          request as unknown as OpenAI.Responses.ResponseCreateParamsStreaming,
        ),
      );
      return stream as unknown as AsyncIterable<ResponsesEvent>;
    },
  };
}

async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof APIConnectionError) {
      throw new MetaCallError("unavailable", "The Meta Model API could not be reached.", null, {
        cause: error,
      });
    }
    if (error instanceof APIError && typeof error.status === "number") {
      throw new MetaCallError(
        failureForStatus(error.status),
        `The Meta Model API returned ${error.status}: ${error.message}`,
        error.status,
        { cause: error },
      );
    }
    throw error;
  }
}
