import "server-only";
import {
  LineageEntry,
  type Rule,
  type Run,
  type Step,
  Verdict,
  type Violation,
} from "@blackbox/contracts";
import { schema } from "@blackbox/db";
import {
  type EvidencePack,
  loadRules,
  loadRun,
  loadSteps,
  type RegressionDiff,
  type RunSnapshot,
  regress,
  sealEvidence,
} from "@blackbox/engine";
import { and, asc, desc, eq, lt, ne } from "drizzle-orm";
import { db } from "./server";

export type RunDetail = {
  run: Run;
  steps: Step[];
  violations: Violation[];
  verdicts: Verdict[];
  rules: Rule[];
  lineage: LineageEntry[];
  keyframes: number[];
  regression: RegressionDiff | null;
  baselineTask: string | null;
  policyTitle: string | null;
};

async function snapshot(runId: string): Promise<{
  run: Run;
  snap: RunSnapshot;
  verdicts: Verdict[];
  lineage: LineageEntry[];
  violations: Violation[];
}> {
  const d = db();
  const run = await loadRun(d, runId);
  const steps = await loadSteps(d, runId);
  const violations = (
    await d.select().from(schema.violations).where(eq(schema.violations.runId, runId))
  ).map(({ id: _id, ...v }) => v as Violation);
  const verdicts = (
    await d
      .select()
      .from(schema.verdicts)
      .where(eq(schema.verdicts.runId, runId))
      .orderBy(desc(schema.verdicts.createdAt))
  ).map(({ id: _id, createdAt: _c, ...v }) => Verdict.parse(v));
  const lineage = (
    await d
      .select()
      .from(schema.lineage)
      .where(eq(schema.lineage.runId, runId))
      .orderBy(asc(schema.lineage.createdAt))
  ).map((l) => LineageEntry.parse({ ...l, createdAt: l.createdAt.toISOString() }));
  return {
    run,
    snap: {
      run,
      steps,
      violations,
      verdict: verdicts[0] ?? null,
      costUsd: lineage.reduce((s, l) => s + l.costUsd, 0),
    },
    verdicts,
    lineage,
    violations,
  };
}

export async function loadRunDetail(runId: string): Promise<RunDetail | null> {
  const d = db();
  const exists = await d.query.runs.findFirst({ where: eq(schema.runs.id, runId) });
  if (!exists) return null;
  const { run, snap, verdicts, lineage, violations } = await snapshot(runId);
  const rules = run.policyId ? await loadRules(d, run.policyId) : [];
  const policy = run.policyId
    ? await d.query.policies.findFirst({ where: eq(schema.policies.id, run.policyId) })
    : null;

  // Baseline: the latest finished run of the same task before this one.
  const baselineRow = await d.query.runs.findFirst({
    where: and(
      eq(schema.runs.taskId, run.taskId),
      ne(schema.runs.id, run.id),
      eq(schema.runs.status, "done"),
      lt(schema.runs.createdAt, new Date(run.createdAt)),
    ),
    orderBy: desc(schema.runs.createdAt),
  });
  let regression: RegressionDiff | null = null;
  if (baselineRow && run.status === "done")
    regression = regress((await snapshot(baselineRow.id)).snap, snap);

  const keyframes = [...new Set(snap.steps.flatMap((s) => s.evidenceFrames))].sort((a, b) => a - b);
  return {
    run,
    steps: snap.steps,
    violations: violations.sort((a, b) => a.stepN - b.stepN),
    verdicts,
    rules,
    lineage,
    keyframes,
    regression,
    baselineTask: baselineRow?.id ?? null,
    policyTitle: policy?.title ?? null,
  };
}

export function evidencePack(detail: RunDetail): EvidencePack {
  return sealEvidence({
    // Pinned to the last recorded event, so the same run always yields the same hash.
    generatedAt: detail.lineage.at(-1)?.createdAt ?? detail.run.createdAt,
    run: detail.run,
    verdict: detail.verdicts[0] ?? null,
    verdictHistory: detail.verdicts,
    violations: detail.violations,
    steps: detail.steps,
    rules: detail.rules,
    regression: detail.regression,
    lineage: detail.lineage,
  });
}
