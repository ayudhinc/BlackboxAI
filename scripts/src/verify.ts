/**
 * Verify one recording end to end from the command line.
 *   pnpm verify <recording.mp4> --task "..." [--task-id id] [--policy polId]
 *     [--agent vendor/model] [--surface "..."] [--native runtime.jsonl]
 * Billed: SAM and Spark calls, each with a lineage row.
 */
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { newId } from "@blackbox/contracts";
import { schema } from "@blackbox/db";
import { keys, loadSteps, processRun } from "@blackbox/engine";
import { desc, eq, sql } from "drizzle-orm";
import { cliDeps } from "./cli-deps.ts";
import { userPath } from "./env.ts";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    task: { type: "string" },
    "task-id": { type: "string" },
    policy: { type: "string" },
    agent: { type: "string", default: "unknown/unknown" },
    surface: { type: "string", default: "Chromium · Acme CRM" },
    native: { type: "string" },
  },
});
const recording = positionals[0];
if (!recording || !values.task)
  throw new Error('usage: verify <recording.mp4> --task "..." [--policy polId]');
const [vendor, model] = (values.agent ?? "unknown/unknown").split("/");

const deps = cliDeps();
const { db } = deps;
const runId = newId("run");
try {
  await deps.store.put(keys.recording(runId), await readFile(userPath(recording)), "video/mp4");
  if (values.native)
    await deps.store.put(
      keys.runtimeEvents(runId),
      await readFile(userPath(values.native)),
      "application/x-ndjson",
    );
  await db.insert(schema.runs).values({
    id: runId,
    taskId: values["task-id"] ?? newId("task"),
    task: values.task,
    agentVendor: vendor ?? "unknown",
    agentModel: model ?? "unknown",
    surface: values.surface ?? "",
    mode: values.native ? "native" : "video",
    policyId: values.policy ?? null,
    status: "uploaded",
    recordingKey: keys.recording(runId),
  });
  console.log(`run ${runId}`);
  const started = performance.now();
  await processRun(deps, runId);

  for (const s of await loadSteps(db, runId)) {
    console.log(
      `  ${String(s.n).padStart(2)} ${clock(s.tMs)} ${s.action.padEnd(8)} ${s.target}${s.field ? ` [${s.field}]` : ""}${s.dialogOpened ? " -> dialog" : ""}  (${s.confidence.toFixed(2)})`,
    );
  }
  const violations = await db
    .select()
    .from(schema.violations)
    .where(eq(schema.violations.runId, runId));
  console.log(`findings: ${violations.length}`);
  for (const v of violations.sort((a, b) => a.stepN - b.stepN)) {
    console.log(
      `  ${v.ruleId} step ${v.stepN} [${v.kind}] ${v.title}: ${v.detail} (${v.checker}, frames ${v.evidenceFrames.join(",")})`,
    );
  }
  const verdict = await db.query.verdicts.findFirst({
    where: eq(schema.verdicts.runId, runId),
    orderBy: desc(schema.verdicts.createdAt),
  });
  console.log(
    `verdict: ${verdict?.status} (proposed ${verdict?.proposedStatus}, confidence ${verdict?.confidence.toFixed(2)})`,
  );
  console.log(`  ${verdict?.rationale}`);
  const [cost] = await db
    .select({ usd: sql<number>`coalesce(sum(cost_usd), 0)`, calls: sql<number>`count(*)` })
    .from(schema.lineage)
    .where(eq(schema.lineage.runId, runId));
  console.log(
    `cost: $${Number(cost?.usd ?? 0).toFixed(4)} over ${cost?.calls} lineage rows, ${Math.round((performance.now() - started) / 1000)} s`,
  );
} finally {
  await deps.handle.close();
}

function clock(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
