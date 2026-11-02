import { describe, expect, it } from "vitest";
import { z } from "zod";
import { MetaClient } from "./client.ts";
import { MetaCallError } from "./errors.ts";
import { MemoryLineageSink } from "./lineage.ts";
import { chatReply, FakeTransport, samEvents } from "./testing.ts";
import { createMetaTransport } from "./transport.ts";

const Answer = z.object({ label: z.string(), count: z.number().int() });
const subject = { stage: "probe" as const };
const ask = {
  subject,
  schemaName: "answer",
  schema: Answer,
  messages: [{ role: "user" as const, content: "hi" }],
};

describe("MetaClient.structured", () => {
  it("returns parsed output and writes one lineage row with cost", async () => {
    const lineage = new MemoryLineageSink();
    const client = new MetaClient(
      new FakeTransport([chatReply('{"label":"ok","count":2}')]),
      lineage,
    );

    await expect(client.structured(ask)).resolves.toEqual({ label: "ok", count: 2 });

    expect(lineage.entries).toHaveLength(1);
    const [row] = lineage.entries;
    expect(row).toMatchObject({
      engine: "muse-spark-1.3",
      stage: "probe",
      attempt: 1,
      error: null,
    });
    expect(row?.tokensIn).toBe(1000);
    // 800 uncached × $1.25/M + 200 cached × $0.15/M + 50 out × $4.25/M
    expect(row?.costUsd).toBeCloseTo((800 * 1.25 + 200 * 0.15 + 50 * 4.25) / 1e6, 12);
    expect(row?.promptHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("sends the schema as json_schema response_format", async () => {
    const transport = new FakeTransport([chatReply('{"label":"a","count":1}')]);
    await new MetaClient(transport, new MemoryLineageSink()).structured(ask);
    const format = transport.chatRequests[0]?.response_format;
    expect(format?.type).toBe("json_schema");
    expect(format?.json_schema.name).toBe("answer");
    expect(format?.json_schema.schema).toMatchObject({
      type: "object",
      required: ["label", "count"],
    });
    expect(format?.json_schema.schema).not.toHaveProperty("$schema");
    expect(format?.json_schema.strict).toBe(true);
    expect(format?.json_schema.schema).toMatchObject({ additionalProperties: false });
  });

  it("retries schema-invalid output once, logging both attempts", async () => {
    const lineage = new MemoryLineageSink();
    const transport = new FakeTransport([
      chatReply('{"label":3}'),
      chatReply('{"label":"b","count":4}'),
    ]);
    await expect(new MetaClient(transport, lineage).structured(ask)).resolves.toEqual({
      label: "b",
      count: 4,
    });
    expect(lineage.entries.map((e) => [e.attempt, e.error?.startsWith("schema_invalid")])).toEqual([
      [1, true],
      [2, undefined],
    ]);
    expect(lineage.entries[1]?.error).toBeNull();
  });

  it("fails loudly after the last attempt", async () => {
    const lineage = new MemoryLineageSink();
    const transport = new FakeTransport([chatReply("not json"), chatReply("still not")]);
    const err = await new MetaClient(transport, lineage).structured(ask).catch((e) => e);
    expect(err).toBeInstanceOf(MetaCallError);
    expect(err.failure).toBe("schema_invalid");
    expect(err.party).toBe("provider");
    expect(lineage.entries).toHaveLength(2);
  });

  it("does not retry our own failures", async () => {
    const lineage = new MemoryLineageSink();
    const transport = new FakeTransport([new MetaCallError("auth", "bad key", 401)]);
    await expect(new MetaClient(transport, lineage).structured(ask)).rejects.toMatchObject({
      party: "ours",
    });
    expect(lineage.entries).toHaveLength(1);
  });

  it("refuses contributor models before any call", async () => {
    const transport = new FakeTransport();
    const client = new MetaClient(transport, new MemoryLineageSink());
    await expect(
      client.structured({ ...ask, model: "muse-spark-1.3-contributor" as never }),
    ).rejects.toThrow(/contributor/);
    expect(transport.chatRequests).toHaveLength(0);
  });
});

describe("MetaClient.samVideo", () => {
  const line =
    "<0f>0<|box;x1=10;y1=20;x2=29;y2=39;w=320;h=240;c=0.91|><|mask;x=0;y=0;data=5,5,!!!!!(QO(0lu8?|>\n";

  it("parses boxes and bills frames processed, with the 50-frame minimum", async () => {
    const lineage = new MemoryLineageSink();
    const transport = new FakeTransport([], [samEvents(line, 30)]);
    const { result, framesProcessed } = await new MetaClient(transport, lineage).samVideo({
      subject,
      fileId: "file-abc",
      phrase: "cursor",
    });
    expect(framesProcessed).toBe(30);
    expect(result.records.filter((r) => r.kind === "box")).toHaveLength(1);
    expect(lineage.entries[0]).toMatchObject({ engine: "sam-3.1", frames: 30, error: null });
    expect(lineage.entries[0]?.costUsd).toBeCloseTo(50 * 0.0002, 12);
    const request = transport.responsesRequests[0];
    expect(request?.metadata).toMatchObject({ include_confidence: "true" });
    expect(JSON.stringify(request?.input)).toContain('"input_video"');
  });

  it("records a failure when the stream never completes", async () => {
    const lineage = new MemoryLineageSink();
    const events = samEvents(line, 30).slice(0, 3); // no response.completed
    const transport = new FakeTransport([], [events, events]);
    await expect(
      new MetaClient(transport, lineage).samVideo({
        subject,
        fileId: "file-abc",
        phrase: "cursor",
      }),
    ).rejects.toMatchObject({ failure: "incomplete" });
    expect(lineage.entries.every((e) => e.error?.startsWith("incomplete"))).toBe(true);
  });
});

describe("createMetaTransport", () => {
  it("refuses to build a real transport under the test runner", () => {
    expect(() => createMetaTransport({ BLACKBOX_TEST: "1", MODEL_API_KEY: "x" })).toThrow(
      /Tests may not/,
    );
  });

  it("is set for this suite", () => {
    expect(process.env.BLACKBOX_TEST).toBe("1");
  });
});
