import { schema } from "@blackbox/db";
import { enqueueJob, keys } from "@blackbox/engine";
import { eq, gt, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { operatorOr401 } from "@/lib/auth";
import { db, store } from "@/lib/server";

/** Hosted verification spend per rolling 24 hours, a limit we set to protect the API credit. */
const DAILY_BUDGET_USD = Number(process.env.DAILY_BUDGET_USD ?? 10);

/** Queue verification once the recording is in storage. Also used to rerun a failed run. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const op = await operatorOr401();
  if (op instanceof NextResponse) return op;
  const { id } = await ctx.params;
  const [spent] = await db()
    .select({ usd: sql<number>`coalesce(sum(cost_usd), 0)::float` })
    .from(schema.lineage)
    .where(gt(schema.lineage.createdAt, sql`now() - interval '24 hours'`));
  if ((spent?.usd ?? 0) >= DAILY_BUDGET_USD) {
    return NextResponse.json(
      {
        error:
          "Verification is paused until tomorrow: this workspace has used its daily analysis budget. This is a limit we set, not a problem with your recording.",
      },
      { status: 429 },
    );
  }
  const run = await db().query.runs.findFirst({ where: eq(schema.runs.id, id) });
  if (!run) return NextResponse.json({ error: "Unknown run." }, { status: 404 });
  if (!["uploaded", "failed", "done"].includes(run.status)) {
    return NextResponse.json({ error: "This run is already being verified." }, { status: 409 });
  }
  try {
    await store().get(keys.recording(id));
  } catch {
    return NextResponse.json(
      { error: "The recording has not finished uploading." },
      { status: 409 },
    );
  }
  await db()
    .update(schema.runs)
    .set({ status: "uploaded", failure: null })
    .where(eq(schema.runs.id, id));
  await enqueueJob(db(), "process_run", id);
  return NextResponse.json({ ok: true });
}
