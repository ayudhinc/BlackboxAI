/** Row <-> contract mapping. Every read parses against the contract, so bad rows fail loudly. */
import {
  newId,
  Rule,
  Run,
  Step,
  type UiTrack,
  type Verdict,
  type Violation,
} from "@blackbox/contracts";
import { type Db, schema } from "@blackbox/db";
import { asc, eq } from "drizzle-orm";

export async function loadRun(db: Db, runId: string): Promise<Run> {
  const row = await db.query.runs.findFirst({ where: eq(schema.runs.id, runId) });
  if (!row) throw new Error(`Run ${runId} not found`);
  return Run.parse({
    ...row,
    agent: { vendor: row.agentVendor, model: row.agentModel },
    createdAt: row.createdAt.toISOString(),
  });
}

export async function loadRules(db: Db, policyId: string): Promise<Rule[]> {
  const rows = await db
    .select()
    .from(schema.rules)
    .where(eq(schema.rules.policyId, policyId))
    .orderBy(asc(schema.rules.id));
  return rows.map((r) =>
    Rule.parse({
      ...r,
      sourceSpan: { page: r.sourcePage, quote: r.sourceQuote },
      signedOffAt: r.signedOffAt?.toISOString() ?? null,
    }),
  );
}

export async function saveRules(db: Db, rules: Rule[]): Promise<void> {
  if (rules.length === 0) return;
  await db.insert(schema.rules).values(
    rules.map((r) => ({
      policyId: r.policyId,
      id: r.id,
      text: r.text,
      type: r.type,
      status: r.status,
      clarification: r.clarification,
      params: r.params,
      sourcePage: r.sourceSpan.page,
      sourceQuote: r.sourceSpan.quote,
      signedOffBy: r.signedOffBy,
      signedOffAt: r.signedOffAt ? new Date(r.signedOffAt) : null,
    })),
  );
}

export async function loadSteps(db: Db, runId: string): Promise<Step[]> {
  const rows = await db
    .select()
    .from(schema.steps)
    .where(eq(schema.steps.runId, runId))
    .orderBy(asc(schema.steps.n));
  return rows.map((r) => Step.parse(r));
}

export async function replaceSteps(db: Db, runId: string, steps: Step[]): Promise<void> {
  await db.delete(schema.steps).where(eq(schema.steps.runId, runId));
  if (steps.length > 0) await db.insert(schema.steps).values(steps.map((s) => Step.parse(s)));
}

export async function replaceTracks(db: Db, runId: string, tracks: UiTrack[]): Promise<void> {
  await db.delete(schema.uiTracks).where(eq(schema.uiTracks.runId, runId));
  if (tracks.length > 0) await db.insert(schema.uiTracks).values(tracks);
}

export async function replaceViolations(
  db: Db,
  runId: string,
  violations: Violation[],
): Promise<void> {
  await db.delete(schema.violations).where(eq(schema.violations.runId, runId));
  if (violations.length > 0) {
    await db
      .insert(schema.violations)
      .values(violations.map((v) => ({ id: newId("violation"), ...v })));
  }
}

export async function insertVerdict(db: Db, verdict: Verdict): Promise<void> {
  await db.insert(schema.verdicts).values({ id: newId("verdict"), ...verdict });
}

export async function setRunStatus(
  db: Db,
  runId: string,
  status: Run["status"],
  extra: Partial<typeof schema.runs.$inferInsert> = {},
): Promise<void> {
  await db
    .update(schema.runs)
    .set({ status, ...extra })
    .where(eq(schema.runs.id, runId));
}
