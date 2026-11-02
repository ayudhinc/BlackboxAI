import { expect, describe as group, it } from "vitest";
import { MetaClient } from "../meta/client.ts";
import { MemoryLineageSink } from "../meta/lineage.ts";
import { chatReply, FakeTransport } from "../meta/testing.ts";
import { type Desktop, runAgent, scrollTicks } from "./loop.ts";

class FakeDesktop implements Desktop {
  readonly width = 1280;
  readonly height = 800;
  readonly calls: string[] = [];
  async screenshot() {
    return Buffer.from("png");
  }
  async click(x: number, y: number, double: boolean) {
    this.calls.push(`${double ? "dbl" : "click"} ${x},${y}`);
  }
  async type(text: string) {
    this.calls.push(`type ${text}`);
  }
  async key(keys: string) {
    this.calls.push(`key ${keys}`);
  }
  async scroll(dy: number) {
    this.calls.push(`scroll ${dy}`);
  }
  async status(step: string, claim?: string) {
    if (claim) this.calls.push(`claim ${claim}`);
  }
}

const act = (o: Record<string, unknown>) =>
  chatReply(
    JSON.stringify({
      thought: "t",
      x: null,
      y: null,
      text: null,
      keys: null,
      scrollDy: null,
      claim: null,
      ...o,
    }),
  );

group("runAgent", () => {
  it("executes actions until done, logs lineage per step, and reports the claim", async () => {
    const lineage = new MemoryLineageSink();
    const transport = new FakeTransport([
      act({ action: "click", x: 156, y: 163 }), // 0-1000 grid: pixel 200,130 of 1280x800
      act({ action: "type", text: "Whitf" }),
      act({ action: "key", keys: "Return" }),
      act({ action: "done", claim: "Searched." }),
    ]);
    const desktop = new FakeDesktop();
    const result = await runAgent(new MetaClient(transport, lineage), desktop, "Find Dana", {
      model: "muse-spark-1.3",
    });
    expect(desktop.calls).toEqual(["click 200,130", "type Whitf", "key Return", "claim Searched."]);
    expect(result).toMatchObject({ claim: "Searched.", stoppedBy: "done" });
    expect(lineage.entries.map((e) => e.stage)).toEqual(["agent", "agent", "agent", "agent"]);
  });

  it("accepts integer coordinates sent as strings", async () => {
    const transport = new FakeTransport([
      act({ action: "click", x: "500", y: "500", scrollDy: "null" }),
      act({ action: "done", claim: "ok" }),
    ]);
    const desktop = new FakeDesktop();
    await runAgent(new MetaClient(transport, new MemoryLineageSink()), desktop, "t", {
      model: "muse-spark-1.3",
    });
    expect(desktop.calls[0]).toBe("click 640,400");
  });

  it("treats omitted nullable keys as null", async () => {
    const transport = new FakeTransport([
      chatReply(JSON.stringify({ thought: "t", action: "done", claim: "ok" })),
    ]);
    const result = await runAgent(
      new MetaClient(transport, new MemoryLineageSink()),
      new FakeDesktop(),
      "t",
      { model: "muse-spark-1.3" },
    );
    expect(result.claim).toBe("ok");
  });

  it("ignores clicks outside the screen and stops at the step budget", async () => {
    const transport = new FakeTransport([
      act({ action: "click", x: 1200, y: 10 }),
      act({ action: "click", x: 1200, y: 10 }),
    ]);
    const desktop = new FakeDesktop();
    const result = await runAgent(
      new MetaClient(transport, new MemoryLineageSink()),
      desktop,
      "t",
      { model: "muse-spark-1.3", maxSteps: 2 },
    );
    expect(desktop.calls).toEqual([]);
    expect(result.stoppedBy).toBe("budget");
  });
});

group("scrollTicks", () => {
  it("reads large values as pixels and clamps", () => {
    expect(scrollTicks(500)).toBe(5);
    expect(scrollTicks(-300)).toBe(-3);
    expect(scrollTicks(5000)).toBe(15);
    expect(scrollTicks(4)).toBe(4);
    expect(scrollTicks(null)).toBe(3);
  });
});
