import { schema } from "@blackbox/db";
import { enqueueJob, keys } from "@blackbox/engine";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, store } from "@/lib/server";

/** Queue verification once the recording is in storage. Also used to rerun a failed run. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
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
