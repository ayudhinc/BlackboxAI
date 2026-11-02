/**
 * Stage 7, regress: a diff of two runs of the same task. Pure. Steps are
 * aligned by their action and target (longest common subsequence), findings by
 * rule. No baseline means no diff, never an invented one.
 */
import type { Run, Step, Verdict, Violation } from "@blackbox/contracts";

export type RunSnapshot = {
  run: Pick<Run, "id" | "taskId" | "durationMs" | "agent" | "mode">;
  steps: Step[];
  violations: Violation[];
  verdict: Pick<Verdict, "status" | "confidence"> | null;
  costUsd: number;
};

export type RegressionDiff = {
  baselineRunId: string;
  candidateRunId: string;
  taskId: string;
  verdict: { baseline: string | null; candidate: string | null; changed: boolean };
  findings: { added: FindingRef[]; resolved: FindingRef[]; unchanged: FindingRef[] };
  steps: { added: StepRef[]; removed: StepRef[]; common: number };
  durationMs: { baseline: number; candidate: number; delta: number };
  costUsd: { baseline: number; candidate: number; delta: number };
};

type FindingRef = { ruleId: string; title: string; stepN: number; tMs: number | null };
type StepRef = { n: number; tMs: number; action: string; target: string };

const sig = (s: Step) => `${s.action}|${s.target.toLowerCase()}`;

export function regress(baseline: RunSnapshot, candidate: RunSnapshot): RegressionDiff {
  if (baseline.run.taskId !== candidate.run.taskId) {
    throw new Error("A regression diff compares runs of the same task.");
  }
  const a = baseline.steps.filter((s) => s.action !== "claim");
  const b = candidate.steps.filter((s) => s.action !== "claim");
  const inLcs = lcs(a.map(sig), b.map(sig));
  const ref = (s: Step): StepRef => ({ n: s.n, tMs: s.tMs, action: s.action, target: s.target });

  const finding =
    (snap: RunSnapshot) =>
    (v: Violation): FindingRef => ({
      ruleId: v.ruleId,
      title: v.title,
      stepN: v.stepN,
      tMs: snap.steps.find((s) => s.n === v.stepN)?.tMs ?? null,
    });
  const key = (v: Violation) => `${v.ruleId}|${v.title}`;
  const baseKeys = new Set(baseline.violations.map(key));
  const candKeys = new Set(candidate.violations.map(key));

  return {
    baselineRunId: baseline.run.id,
    candidateRunId: candidate.run.id,
    taskId: candidate.run.taskId,
    verdict: {
      baseline: baseline.verdict?.status ?? null,
      candidate: candidate.verdict?.status ?? null,
      changed: baseline.verdict?.status !== candidate.verdict?.status,
    },
    findings: {
      added: candidate.violations.filter((v) => !baseKeys.has(key(v))).map(finding(candidate)),
      resolved: baseline.violations.filter((v) => !candKeys.has(key(v))).map(finding(baseline)),
      unchanged: candidate.violations.filter((v) => baseKeys.has(key(v))).map(finding(candidate)),
    },
    steps: {
      added: b.filter((_, j) => !inLcs.b.has(j)).map(ref),
      removed: a.filter((_, i) => !inLcs.a.has(i)).map(ref),
      common: inLcs.a.size,
    },
    durationMs: {
      baseline: baseline.run.durationMs,
      candidate: candidate.run.durationMs,
      delta: candidate.run.durationMs - baseline.run.durationMs,
    },
    costUsd: {
      baseline: baseline.costUsd,
      candidate: candidate.costUsd,
      delta: round(candidate.costUsd - baseline.costUsd),
    },
  };
}

function lcs(a: string[], b: string[]): { a: Set<number>; b: Set<number> } {
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      const row = dp[i] as number[];
      row[j] =
        a[i] === b[j]
          ? ((dp[i + 1] as number[])[j + 1] as number) + 1
          : Math.max((dp[i + 1] as number[])[j] as number, row[j + 1] as number);
    }
  }
  const out = { a: new Set<number>(), b: new Set<number>() };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.a.add(i++);
      out.b.add(j++);
    } else if (((dp[i + 1] as number[])[j] as number) >= ((dp[i] as number[])[j + 1] as number))
      i++;
    else j++;
  }
  return out;
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;
