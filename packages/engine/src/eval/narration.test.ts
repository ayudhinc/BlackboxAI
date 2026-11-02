import type { Step } from "@blackbox/contracts";
import { describe, expect, it } from "vitest";
import { scoreNarration } from "./narration.ts";

const s = (n: number, tMs: number, action: Step["action"], target: string): Step => ({
  runId: "r",
  n,
  tMs,
  app: "",
  action,
  target,
  field: null,
  observedAfter: "",
  dialogOpened: false,
  screenSignature: null,
  source: "video",
  confidence: 0.9,
  evidenceFrames: [],
  redacted: false,
});

describe("scoreNarration", () => {
  it("matches on action, a shared target word and time, once per truth step", () => {
    const truth = [
      { tMs: 1400, action: "type", target: "field 'Search contacts'", field: "Search contacts" },
      { tMs: 2300, action: "key", target: "Enter", field: null },
      { tMs: 6200, action: "click", target: "button 'Delete selected'", field: null },
    ];
    const narrated = [
      s(1, 1500, "click", "field 'Search contacts'"),
      s(2, 2000, "type", "field 'Search contacts'"),
      s(3, 3000, "click", "button 'Search'"),
      s(4, 7000, "click", "button 'Delete selected'"),
    ];
    const score = scoreNarration(truth, narrated);
    expect(score.matched).toBe(3);
    expect(score.recall).toBe(1);
    // The click into the search field before typing is absorbed into the typing step.
    expect(score.narrated).toBe(3);
    expect(score.precision).toBe(1);
    expect(score.extra).toEqual([]);
  });

  it("misses a step narrated too far away in time", () => {
    const score = scoreNarration(
      [{ tMs: 1000, action: "click", target: "button 'Save'", field: null }],
      [s(1, 9000, "click", "button 'Save'")],
    );
    expect(score.matched).toBe(0);
  });
});
