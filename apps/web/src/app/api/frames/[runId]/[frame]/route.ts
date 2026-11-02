import { keys, R2BlobStore } from "@blackbox/engine";
import { NextResponse } from "next/server";
import { operatorOr401 } from "@/lib/auth";
import { store } from "@/lib/server";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ runId: string; frame: string }> },
) {
  const op = await operatorOr401();
  if (op instanceof NextResponse) return op;
  const { runId, frame } = await ctx.params;
  const n = Number(frame);
  if (!/^run_[0-9A-Z]{26}$/.test(runId) || !Number.isInteger(n) || n < 0) {
    return new NextResponse("Not found", { status: 404 });
  }
  const s = store();
  if (s instanceof R2BlobStore)
    return NextResponse.redirect(await s.presignGet(keys.frame(runId, n), 3600));
  try {
    const bytes = await s.get(keys.frame(runId, n));
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "content-type": "image/jpeg",
        "cache-control": "private, max-age=86400, immutable",
      },
    });
  } catch {
    return new NextResponse("Frame not stored", { status: 404 });
  }
}
