import "server-only";
import { schema } from "@blackbox/db";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "./server";

export type RunRow = {
  id: string;
  taskId: string;
  task: string;
  agent: string;
  surface: string;
  mode: "video" | "native";
  status: string;
  failure: string | null;
  durationMs: number;
  createdAt: Date;
  verdict: string | null;
  decidedBy: string | null;
  findings: number;
  costUsd: number;
};

/** Runs with their latest verdict, finding count and verification cost. */
export async function listRuns(limit = 100): Promise<RunRow[]> {
  const rows = await db().execute<RunRow & { createdAt: string | Date }>(sql`
    select r.id, r.task_id as "taskId", r.task, r.agent_vendor || '/' || r.agent_model as agent, r.surface, r.mode,
      r.status, r.failure, r.duration_ms as "durationMs", r.created_at as "createdAt",
      v.status as verdict, v.decided_by as "decidedBy",
      (select count(*)::int from violations x where x.run_id = r.id) as findings,
      (select coalesce(sum(cost_usd), 0)::float from lineage l where l.run_id = r.id) as "costUsd"
    from runs r
    left join lateral (select status, decided_by from verdicts where run_id = r.id order by created_at desc limit 1) v on true
    order by r.created_at desc limit ${limit}`);
  return rows.rows.map((r) => ({ ...r, createdAt: new Date(r.createdAt) }));
}

/** Runs whose latest verdict is needs_review and no reviewer has decided. */
export async function reviewQueue(): Promise<RunRow[]> {
  return (await listRuns(500)).filter(
    (r) => r.verdict === "needs_review" && r.decidedBy !== "reviewer",
  );
}

export async function queueCount(): Promise<number> {
  return (await reviewQueue()).length;
}

export async function listPolicies() {
  const policies = await db()
    .select()
    .from(schema.policies)
    .orderBy(desc(schema.policies.createdAt));
  const counts = await db()
    .select({
      policyId: schema.rules.policyId,
      n: sql<number>`count(*)::int`,
      open: sql<number>`count(*) filter (where status <> 'ready')::int`,
    })
    .from(schema.rules)
    .groupBy(schema.rules.policyId);
  return policies.map((p) => ({
    ...p,
    rules: counts.find((c) => c.policyId === p.id)?.n ?? 0,
    open: counts.find((c) => c.policyId === p.id)?.open ?? 0,
  }));
}

export async function signedOffPolicies() {
  return db()
    .select({ id: schema.policies.id, title: schema.policies.title })
    .from(schema.policies)
    .where(eq(schema.policies.status, "signed_off"))
    .orderBy(desc(schema.policies.createdAt));
}
