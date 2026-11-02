import { describe, expect, it } from "vitest";
import { type Narration, newButtonFrames, redact, toSteps } from "./narrate.ts";

describe("redact", () => {
  it("removes card numbers, IDs and long digit runs, keeps short numbers", () => {
    expect(redact("typed 4242 4242 4242 4242 into Card number").text).toBe(
      "typed [redacted] into Card number",
    );
    expect(redact("000-12-3456").text).toBe("[redacted]");
    expect(redact("Archive 5 leads").changed).toBe(false);
  });
});

describe("toSteps", () => {
  const narration: Narration = {
    steps: [
      {
        frame: 4,
        action: "click",
        target: "button 'Save'",
        field: null,
        app: "Acme CRM",
        observedAfter: "Error banner shown",
        dialogOpened: false,
        confidence: 0.9,
      },
      {
        frame: 9,
        action: "type",
        target: "field 'Card number'",
        field: "Card number",
        app: "Acme CRM",
        observedAfter: "Typed 4242424242424242",
        dialogOpened: false,
        confidence: 0.85,
      },
    ],
    agentClaim: "Contact updated.",
  };

  it("numbers steps, cites before/after keyframes, signs the before screen and redacts", () => {
    const steps = toSteps(
      "run_1",
      narration,
      [0, 4, 9, 12],
      ["s0", "s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10", "s11", "s12"],
      500,
    );
    expect(steps.map((s) => [s.n, s.action, s.tMs, s.evidenceFrames, s.screenSignature])).toEqual([
      [1, "click", 2000, [0, 4], "s0"],
      [2, "type", 4500, [4, 9], "s4"],
      [3, "claim", 6000, [12], "s12"],
    ]);
    expect(steps[1]).toMatchObject({ observedAfter: "Typed [redacted]", redacted: true });
    expect(steps[2]).toMatchObject({ target: "Contact updated.", confidence: 1 });
  });
});

describe("newButtonFrames", () => {
  it("returns frames where a button track starts after frame 0", () => {
    const track = (frames: number[]) => ({
      runId: "r",
      phrase: "button",
      objectId: String(frames[0]),
      frames: frames.map((frame) => ({
        frame,
        tMs: 0,
        box: [0, 0, 1, 1] as [number, number, number, number],
        confidence: null,
      })),
    });
    expect([...newButtonFrames([track([0, 1, 2]), track([28, 29])])]).toEqual([28]);
  });
});
