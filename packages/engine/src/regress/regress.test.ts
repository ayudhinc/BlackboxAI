import type { Step, Violation } from "@blackbox/contracts";
import { describe, expect, it } from "vitest";
import { type RunSnapshot, regress } from "./regress.ts";

const step = (n: number, action: Step["action"], target: string): Step => ({
  runId: "r",
  n,
  tMs: n * 1000,
  app: "Acme CRM",
  action,
  target,
  field: null,
  observedAfter: "",
  dialogOpened: false,
  screenSignature: null,
  screenAfter: null,
  madeProgress: null,
  source: "video",
  confidence: 0.9,
  evidenceFrames: [n],
  redacted: false,
});
const vio = (ruleId: string, stepN: number, title: string): Violation => ({
  runId: "r",
  ruleId,
  stepN,
  kind: "violation",
  title,
  detail: "",
  evidenceFrames: [],
  checker: "x@1",
});
const snap = (
  id: string,
  steps: Step[],
  violations: Violation[],
  status: string | null,
  cost: number,
): RunSnapshot => ({
  run: {
    id,
    taskId: "crm-contact-dedupe",
    durationMs: steps.length * 1000,
    agent: { vendor: "v", model: "m" },
    mode: "video",
  },
  steps,
  violations,
  verdict: status ? { status: status as never, confidence: 0.9 } : null,
  costUsd: cost,
});

describe("regress (D01 vs D02)", () => {
  const base = snap(
    "run_a",
    [
      step(1, "type", "field 'Search'"),
      step(2, "click", "button 'Merge into…'"),
      step(3, "click", "button 'Merge'"),
    ],
    [],
    "completed",
    0.2,
  );
  const cand = snap(
    "run_b",
    [
      step(1, "type", "field 'Search'"),
      step(2, "click", "button 'Delete selected'"),
      step(3, "type", "field 'Card number'"),
    ],
    [
      vio("R2", 2, "Destructive action without confirmation"),
      vio("R4", 3, "Typed into a sensitive field"),
    ],
    "completed_with_violations",
    0.25,
  );

  it("reports two new findings, the changed path and the verdict change", () => {
    const d = regress(base, cand);
    expect(d.findings.added.map((f) => [f.ruleId, f.tMs])).toEqual([
      ["R2", 2000],
      ["R4", 3000],
    ]);
    expect(d.findings.resolved).toEqual([]);
    expect(d.steps.common).toBe(1);
    expect(d.steps.added.map((s) => s.target)).toEqual([
      "button 'Delete selected'",
      "field 'Card number'",
    ]);
    expect(d.steps.removed.map((s) => s.target)).toEqual([
      "button 'Merge into…'",
      "button 'Merge'",
    ]);
    expect(d.verdict).toEqual({
      baseline: "completed",
      candidate: "completed_with_violations",
      changed: true,
    });
    expect(d.costUsd.delta).toBe(0.05);
  });

  it("refuses runs of different tasks", () => {
    expect(() => regress(base, { ...cand, run: { ...cand.run, taskId: "other" } })).toThrow(
      /same task/,
    );
  });
});
