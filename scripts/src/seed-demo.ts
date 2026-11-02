/**
 * Register the scripted demo recordings as runs and queue them for the worker.
 *   pnpm seed-demo <policyId> [D01 D02 ...]
 * Reads recordings/demo/<id>.mp4, .meta.json and, for native runs, .runtime.jsonl.
 * Runs are created in the order given, so each task's baseline comes first.
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { newId } from "@blackbox/contracts";
import { connect, schema } from "@blackbox/db";
import { enqueueJob, keys, storeFromEnv } from "@blackbox/engine";
import { z } from "zod";
import { loadEnv, ROOT } from "./env.ts";

const Meta = z.object({
  id: z.string(),
  taskId: z.string(),
  instruction: z.string(),
  mode: z.enum(["video", "native"]),
  agent: z.object({ vendor: z.string(), model: z.string() }),
  failure: z.string().nullable(),
  surface: z.string().optional(),
  agentRun: z.unknown().optional(),
});

/** Remote-desktop runs (D10–D12) are on the canvas ERP through noVNC; the rest on the CRM. */
const surfaceFor = (id: string, meta: z.infer<typeof Meta>) =>
  meta.surface ??
  (/^D1[0-2]$/.test(id) ? "noVNC · Meridian ERP (remote desktop)" : "Chromium · Acme CRM");

loadEnv();
const [policyId, ...ids] = process.argv.slice(2);
if (!policyId) throw new Error("usage: seed-demo <policyId> [D01 ...]");
const order = ids.length ? ids : ["D01", "D02", "D03", "D04", "D05", "D06", "D07", "D08", "D09"];
const { db, close } = connect();
const store = storeFromEnv();
try {
  for (const id of order) {
    const base = `${ROOT}recordings/demo/${id}`;
    const meta = Meta.parse(JSON.parse(await readFile(`${base}.meta.json`, "utf8")));
    if (meta.failure) throw new Error(`${id} recorded with a failure: ${meta.failure}`);
    const native = meta.mode === "native" && existsSync(`${base}.runtime.jsonl`);
    const runId = newId("run");
    await store.put(keys.recording(runId), await readFile(`${base}.mp4`), "video/mp4");
    if (native)
      await store.put(
        keys.runtimeEvents(runId),
        await readFile(`${base}.runtime.jsonl`),
        "application/x-ndjson",
      );
    await db.insert(schema.runs).values({
      id: runId,
      taskId: meta.taskId,
      task: meta.instruction,
      agentVendor: meta.agent.vendor,
      agentModel: meta.agent.model,
      surface: surfaceFor(id, meta),
      mode: native ? "native" : "video",
      policyId,
      status: "uploaded",
      recordingKey: keys.recording(runId),
      // The sandbox's agent console strip (bottom 40 px) is the agent's own UI, not the application.
      overlays: [{ label: "agent console", box: [0, 760, 1280, 800] }],
    });
    await enqueueJob(db, "process_run", runId);
    console.log(`${id} -> ${runId} (${native ? "native" : "video"})`);
    await new Promise((r) => setTimeout(r, 50)); // distinct created_at ordering
  }
} finally {
  await close();
}
