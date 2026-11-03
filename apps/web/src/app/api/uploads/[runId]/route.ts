import { isLocal, keys } from "@blackbox/engine";
import { NextResponse } from "next/server";
import { operatorOr401 } from "@/lib/auth";
import { store } from "@/lib/server";

/** Local development only: production uploads go straight to R2 with a presigned URL. */
export async function PUT(req: Request, ctx: { params: Promise<{ runId: string }> }) {
  const op = await operatorOr401();
  if (op instanceof NextResponse) return op;
  const s = store();
  if (!isLocal(s))
    return NextResponse.json({ error: "Upload to storage directly." }, { status: 404 });
  const { runId } = await ctx.params;
  if (!/^run_[0-9A-Z]{26}$/.test(runId))
    return NextResponse.json({ error: "Unknown run." }, { status: 404 });
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length === 0)
    return NextResponse.json({ error: "The upload was empty." }, { status: 400 });
  await s.put(keys.recording(runId), bytes, req.headers.get("content-type") ?? "video/mp4");
  return NextResponse.json({ ok: true });
}
