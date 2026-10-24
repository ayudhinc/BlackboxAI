/**
 * The BlackboxAI worker: long jobs (ingest, tracking, narration, verdicts) run
 * here, never in request handlers. Health on WORKER_HEALTH_PORT (3502,
 * registered in ~/dev/ports.md).
 */
import { createServer } from "node:http";
import { hostname } from "node:os";
import { connect } from "@blackbox/db";
import { sql } from "drizzle-orm";
import { claimJob, completeJob, failJob, type Job, requeueStale } from "./jobs.ts";

type Handler = (job: Job) => Promise<void>;

/** Job kinds the worker can run. A job of any other kind fails loudly. */
const handlers: Record<string, Handler> = {};

const port = Number(process.env.WORKER_HEALTH_PORT ?? 3502);
const workerId = `${hostname()}:${process.pid}`;
const { db, close } = connect();
let lastPoll: string | null = null;
let stopping = false;

const health = createServer(async (req, res) => {
  if (req.url !== "/health") {
    res.writeHead(404).end();
    return;
  }
  try {
    await db.execute(sql`select 1`);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, workerId, lastPoll }));
  } catch (error) {
    res.writeHead(503, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "database unreachable" }));
    console.error("health: database check failed", error);
  }
});

health.listen(port, "127.0.0.1", () => console.log(`worker ${workerId} health on :${port}`));

async function loop(): Promise<void> {
  let sinceStaleCheck = Number.POSITIVE_INFINITY;
  while (!stopping) {
    lastPoll = new Date().toISOString();
    if (sinceStaleCheck > 60_000) {
      const n = await requeueStale(db);
      if (n > 0) console.warn(`requeued ${n} stale job(s)`);
      sinceStaleCheck = 0;
    }
    const job = await claimJob(db, workerId);
    if (!job) {
      await new Promise((r) => setTimeout(r, 1000));
      sinceStaleCheck += 1000;
      continue;
    }
    const handler = handlers[job.kind];
    try {
      if (!handler) throw new Error(`No handler for job kind "${job.kind}"`);
      await handler(job);
      await completeJob(db, job.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const outcome = await failJob(db, job, message);
      console.error(`job ${job.id} (${job.kind}) ${outcome}: ${message}`);
    }
  }
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    stopping = true;
    health.close();
  });
}

await loop();
await close();
