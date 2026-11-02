import {
  parseVideoStream,
  type ResponsesEvent,
  type VideoSegmentationResult,
} from "@meta-sam/parser";
import { z } from "zod";
import { MetaCallError } from "./errors.ts";
import { type CallSubject, type LineageSink, lineageEntry, promptHash } from "./lineage.ts";
import {
  assertAllowedModel,
  MODELS,
  type ModelId,
  samVideoCostUsd,
  tokenCostUsd,
} from "./models.ts";
import type { ChatMessage, ChatRequest, MetaTransport } from "./transport.ts";

export type StructuredRequest<S extends z.ZodType> = {
  subject: CallSubject;
  model?: ModelId;
  schemaName: string;
  schema: S;
  messages: ChatMessage[];
  reasoningEffort?: ChatRequest["reasoning_effort"];
  maxCompletionTokens?: number;
  /** Total attempts, including the first. Only retryable failures are retried. */
  maxAttempts?: number;
  /**
   * "tool" asks for one function call whose arguments are the output. Use it
   * where the model narrates before answering (computer-use turns): the prose
   * stays out of the parsed value.
   */
  via?: "response_format" | "tool";
  /** Applied to the decoded JSON before validation, for known, narrow wire quirks. */
  normalize?: (raw: unknown) => unknown;
};

export type SamVideoRequest = {
  subject: CallSubject;
  fileId: string;
  /** A short noun phrase, e.g. "modal dialog". One concept per request. */
  phrase: string;
  includeConfidence?: boolean;
  maxAttempts?: number;
};

export type SamVideoResult = { result: VideoSegmentationResult; framesProcessed: number };

/**
 * Every Meta model call goes through here. Each attempt writes one lineage
 * row, success or failure: model, prompt hash, tokens or frames, cost, latency.
 */
export class MetaClient {
  constructor(
    private readonly transport: MetaTransport,
    private readonly lineage: LineageSink,
  ) {}

  /** Chat completion constrained to a Zod schema, parsed and validated. */
  async structured<S extends z.ZodType>(req: StructuredRequest<S>): Promise<z.infer<S>> {
    const model = req.model ?? MODELS.spark;
    assertAllowedModel(model);
    const { $schema: _, ...jsonSchema } = strictSchema(z.toJSONSchema(req.schema)) as Record<
      string,
      unknown
    >;
    const request: ChatRequest = {
      model,
      messages: req.messages,
      ...(req.via === "tool"
        ? {
            tools: [
              {
                type: "function" as const,
                function: {
                  name: req.schemaName,
                  description: "Return your answer",
                  parameters: jsonSchema,
                  strict: true,
                },
              },
            ],
            // The Model API supports only tool_choice "auto"; a missing call fails validation and is retried.
          }
        : {
            response_format: {
              type: "json_schema" as const,
              json_schema: { name: req.schemaName, schema: jsonSchema, strict: true },
            },
          }),
      ...(req.reasoningEffort ? { reasoning_effort: req.reasoningEffort } : {}),
      ...(req.maxCompletionTokens ? { max_completion_tokens: req.maxCompletionTokens } : {}),
    };
    const hash = promptHash(request);

    return this.withAttempts(req.maxAttempts ?? 2, async (attempt) => {
      const started = performance.now();
      let usage = { tokensIn: 0, tokensCached: 0, tokensOut: 0 };
      try {
        const res = await this.transport.chat(request);
        usage = res.usage;
        if (res.refusal) throw new MetaCallError("refused", `The model refused: ${res.refusal}`);
        if (res.finishReason === "length") {
          throw new MetaCallError("incomplete", "The model ran out of output tokens.");
        }
        const value = parseStructured(
          req.schema,
          req.via === "tool" ? res.toolArguments : res.content,
          req.normalize,
        );
        await this.record(req.subject, model, hash, attempt, started, usage, null);
        return value;
      } catch (error) {
        await this.record(req.subject, model, hash, attempt, started, usage, error);
        throw error;
      }
    });
  }

  /** Upload media once; later calls reference it by file id. Not billed, so no lineage row. */
  uploadFile(file: { bytes: Uint8Array; filename: string; mimeType: string }): Promise<string> {
    return this.transport.uploadFile(file);
  }

  /** SAM 3.1 video segmentation for one noun phrase over an uploaded clip. */
  async samVideo(req: SamVideoRequest): Promise<SamVideoResult> {
    const model = MODELS.sam;
    assertAllowedModel(model);
    const phrase = req.phrase.trim();
    if (!phrase) throw new MetaCallError("rejected_request", "A SAM phrase must not be empty.");
    const request = {
      model,
      stream: true as const,
      input: [
        {
          type: "message",
          role: "user",
          content: [
            { type: "input_text", text: phrase },
            { type: "input_video", file_id: req.fileId },
          ],
        },
      ],
      metadata: {
        include_confidence: String(req.includeConfidence ?? true),
        mask_encoding: "one_bit",
      },
    };
    const hash = promptHash(request);

    return this.withAttempts(req.maxAttempts ?? 2, async (attempt) => {
      const started = performance.now();
      const usage = { frames: null as number | null };
      try {
        const events = await this.transport.responsesStream(request);
        const result = await parseVideoStream(tapUsage(events, usage)).finalResult;
        if (result.outcome.status !== "completed") {
          throw new MetaCallError(
            "incomplete",
            `SAM ended early: ${result.outcome.reason}${"detail" in result.outcome && result.outcome.detail ? ` (${result.outcome.detail})` : ""}`,
          );
        }
        if (usage.frames === null) {
          throw new MetaCallError("incomplete", "SAM did not report video_frames_processed.");
        }
        await this.recordFrames(req.subject, model, hash, attempt, started, usage.frames, null);
        return { result, framesProcessed: usage.frames };
      } catch (error) {
        await this.recordFrames(req.subject, model, hash, attempt, started, usage.frames, error);
        throw error;
      }
    });
  }

  private async withAttempts<T>(max: number, fn: (attempt: number) => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await fn(attempt);
      } catch (error) {
        const retryable = error instanceof MetaCallError && error.retryable;
        if (!retryable || attempt >= max) throw error;
      }
    }
  }

  private record(
    subject: CallSubject,
    model: ModelId,
    hash: string,
    attempt: number,
    started: number,
    usage: { tokensIn: number; tokensCached: number; tokensOut: number },
    error: unknown,
  ): Promise<void> {
    return this.lineage.write(
      lineageEntry(subject, {
        engine: model,
        promptHash: hash,
        ...usage,
        costUsd: tokenCostUsd(model, usage),
        latencyMs: Math.round(performance.now() - started),
        attempt,
        error: error === null ? null : describe(error),
      }),
    );
  }

  private recordFrames(
    subject: CallSubject,
    model: ModelId,
    hash: string,
    attempt: number,
    started: number,
    frames: number | null,
    error: unknown,
  ): Promise<void> {
    return this.lineage.write(
      lineageEntry(subject, {
        engine: model,
        promptHash: hash,
        frames,
        // A failed call that reported no frames is recorded at zero; the bill is the source of truth.
        costUsd: frames === null ? 0 : samVideoCostUsd(frames),
        latencyMs: Math.round(performance.now() - started),
        attempt,
        error: error === null ? null : describe(error),
      }),
    );
  }
}

/**
 * The Model API's strict subset: every object closes with additionalProperties
 * false and lists every property as required (our schemas use nullable, never
 * optional, so nothing is lost).
 */
export function strictSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strictSchema);
  if (node === null || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) out[k] = strictSchema(v);
  if (out.type === "object" && out.properties && typeof out.properties === "object") {
    out.additionalProperties = false;
    out.required = Object.keys(out.properties as Record<string, unknown>);
  }
  return out;
}

export function parseStructured<S extends z.ZodType>(
  schema: S,
  content: string | null,
  normalize: (raw: unknown) => unknown = (raw) => raw,
): z.infer<S> {
  if (!content) throw new MetaCallError("schema_invalid", "The model returned no content.");
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    throw new MetaCallError(
      "schema_invalid",
      `The model returned content that is not JSON: ${JSON.stringify(content.slice(0, 200))}`,
    );
  }
  const parsed = schema.safeParse(normalize(json));
  if (!parsed.success) {
    throw new MetaCallError(
      "schema_invalid",
      `The model's output did not match the schema: ${z.prettifyError(parsed.error)}`,
    );
  }
  return parsed.data;
}

/** Pass events through unchanged, noting the frame count from `response.completed`. */
async function* tapUsage(
  events: AsyncIterable<ResponsesEvent>,
  usage: { frames: number | null },
): AsyncIterable<ResponsesEvent> {
  for await (const event of events) {
    if (event.type === "response.completed") {
      const frames = (event as { response?: { usage?: { video_frames_processed?: unknown } } })
        .response?.usage?.video_frames_processed;
      if (typeof frames === "number") usage.frames = frames;
    }
    yield event;
  }
}

function describe(error: unknown): string {
  if (error instanceof MetaCallError) return `${error.failure}: ${error.message}`;
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}
