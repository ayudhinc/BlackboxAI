/**
 * The Postgres job table as a queue: claim with FOR UPDATE SKIP LOCKED, so any
 * number of workers can poll without a queue service.
 */
import { type Db, schema } from "@blackbox/db";
import { eq, sql } from "drizzle-orm";

export type Job = typeof schema.jobs.$inferSelect;

/** A job whose worker died is requeued after this long. */
export const STALE_LOCK_MS = 15 * 60 * 1000;

export async function claimJob(db: Db, workerId: string): Promise<Job | null> {
  const result = await db.execute<Job>(sql`
    update jobs set status = 'running', locked_at = now(), locked_by = ${workerId},
      attempts = attempts + 1
    where id = (
      select id from jobs
      where status = 'queued' and run_after <= now()
      order by created_at
      for update skip locked
      limit 1
    )
    returning id, kind, subject_id as "subjectId", status, attempts,
      max_attempts as "maxAttempts", last_error as "lastError", run_after as "runAfter",
      locked_at as "lockedAt", locked_by as "lockedBy", created_at as "createdAt"`);
  return result.rows[0] ?? null;
}

export async function completeJob(db: Db, id: string): Promise<void> {
  await db
    .update(schema.jobs)
    .set({ status: "done", lockedAt: null, lockedBy: null, lastError: null })
    .where(eq(schema.jobs.id, id));
}

/** Requeue with backoff while attempts remain; otherwise mark failed. */
export async function failJob(db: Db, job: Job, error: string): Promise<"requeued" | "failed"> {
  const exhausted = job.attempts >= job.maxAttempts;
  await db
    .update(schema.jobs)
    .set({
      status: exhausted ? "failed" : "queued",
      lastError: error,
      lockedAt: null,
      lockedBy: null,
      runAfter: exhausted ? job.runAfter : new Date(Date.now() + 30_000 * job.attempts),
    })
    .where(eq(schema.jobs.id, job.id));
  return exhausted ? "failed" : "requeued";
}

export async function requeueStale(db: Db): Promise<number> {
  const result = await db.execute(sql`
    update jobs set status = 'queued', locked_at = null, locked_by = null,
      last_error = 'worker lock expired'
    where status = 'running' and locked_at < now() - (${STALE_LOCK_MS} * interval '1 millisecond')`);
  return result.rowCount ?? 0;
}
