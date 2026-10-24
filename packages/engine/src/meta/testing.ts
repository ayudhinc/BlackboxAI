import type { ResponsesEvent } from "@meta-sam/parser";
import type { ChatRequest, ChatResult, MetaTransport, ResponsesRequest } from "./transport.ts";

/** A scripted MetaTransport for tests. It never touches the network. */
export class FakeTransport implements MetaTransport {
  readonly chatRequests: ChatRequest[] = [];
  readonly responsesRequests: ResponsesRequest[] = [];

  constructor(
    private readonly chatReplies: Array<ChatResult | Error> = [],
    private readonly streams: Array<ResponsesEvent[] | Error> = [],
  ) {}

  async chat(request: ChatRequest): Promise<ChatResult> {
    this.chatRequests.push(request);
    const reply = this.chatReplies.shift();
    if (!reply) throw new Error("FakeTransport: no chat reply scripted");
    if (reply instanceof Error) throw reply;
    return reply;
  }

  async uploadFile(): Promise<string> {
    return "file-fake123";
  }

  async responsesStream(request: ResponsesRequest): Promise<AsyncIterable<ResponsesEvent>> {
    this.responsesRequests.push(request);
    const events = this.streams.shift();
    if (!events) throw new Error("FakeTransport: no stream scripted");
    if (events instanceof Error) throw events;
    return (async function* () {
      yield* events;
    })();
  }
}

export function chatReply(content: string, tokensOut = 50): ChatResult {
  return {
    content,
    refusal: null,
    finishReason: "stop",
    usage: { tokensIn: 1000, tokensCached: 200, tokensOut },
  };
}

/** A SAM video response as the live API streams it: deltas, content_part.done, completed. */
export function samEvents(text: string, framesProcessed: number): ResponsesEvent[] {
  const lane = { item_id: "msg-1", output_index: 0, content_index: 0 };
  return [
    { type: "response.created" },
    { type: "response.output_text.delta", ...lane, delta: text },
    { type: "response.content_part.done", ...lane, part: { type: "output_text", text } },
    {
      type: "response.completed",
      response: { status: "completed", usage: { video_frames_processed: framesProcessed } },
    },
  ] as unknown as ResponsesEvent[];
}
