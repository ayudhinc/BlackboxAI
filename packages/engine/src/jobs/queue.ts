import { newId } from "@blackbox/contracts";
import { type Db, schema } from "@blackbox/db";

export type JobKind = "process_run" | "compile_policy";

/**
 * Queue a job. Verification runs are not retried automatically: a failed run
 * reports why, and an operator reruns it, so a bad input never spends twice.
 */
export async function enqueueJob(db: Db, kind: JobKind, subjectId: string): Promise<string> {
  const id = newId("job");
  await db
    .insert(schema.jobs)
    .values({ id, kind, subjectId, status: "queued", maxAttempts: kind === "process_run" ? 1 : 2 });
  return id;
}
