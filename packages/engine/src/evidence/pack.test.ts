import type { Run } from "@blackbox/contracts";
import { describe, expect, it } from "vitest";
import { renderEvidenceHtml, sealEvidence, verifyEvidence } from "./pack.ts";

const run: Run = {
  id: "run_1",
  taskId: "t",
  task: "Merge the duplicate <contact>",
  agent: { vendor: "blackbox", model: "scripted@1.0.0" },
  surface: "Chromium · Acme CRM",
  mode: "video",
  policyId: null,
  status: "done",
  recordingKey: null,
  durationMs: 18000,
  agentClaim: null,
  overlays: [],
  failure: null,
  createdAt: "2026-11-01T00:00:00.000Z",
};
const body = {
  generatedAt: "2026-11-01T00:00:00.000Z",
  run,
  verdict: null,
  verdictHistory: [],
  violations: [],
  steps: [],
  rules: [],
  regression: null,
  lineage: [
    {
      id: "lin_1",
      runId: "run_1",
      policyId: null,
      stage: "narrate" as const,
      engine: "muse-spark-1.3",
      promptHash: "ab",
      tokensIn: 10,
      tokensCached: 0,
      tokensOut: 5,
      frames: null,
      costUsd: 0.01,
      latencyMs: 900,
      attempt: 1,
      error: null,
      createdAt: "2026-11-01T00:00:00.000Z",
    },
    {
      id: "lin_2",
      runId: "run_1",
      policyId: null,
      stage: "check" as const,
      engine: "checkers",
      promptHash: null,
      tokensIn: null,
      tokensCached: null,
      tokensOut: null,
      frames: null,
      costUsd: 0,
      latencyMs: 2,
      attempt: 1,
      error: null,
      createdAt: "2026-11-01T00:00:00.000Z",
    },
  ],
};

describe("evidence pack", () => {
  it("seals with a hash that verifies and breaks on tampering", () => {
    const pack = sealEvidence(body);
    expect(pack.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(pack.totals).toEqual({ costUsd: 0.01, modelCalls: 1, latencyMs: 902 });
    expect(verifyEvidence(pack)).toBe(true);
    expect(verifyEvidence({ ...pack, run: { ...pack.run, task: "tampered" } })).toBe(false);
  });

  it("is deterministic for the same body", () => {
    expect(sealEvidence(body).contentHash).toBe(sealEvidence(structuredClone(body)).contentHash);
  });

  it("escapes run text in the HTML view", () => {
    const html = renderEvidenceHtml(sealEvidence(body), (f) => `/frames/${f}`);
    expect(html).toContain("Merge the duplicate &lt;contact&gt;");
    expect(html).not.toContain("<contact>");
  });
});
