import { renderEvidenceHtml } from "@blackbox/engine";
import { NextResponse } from "next/server";
import { operatorOr401 } from "@/lib/auth";
import { evidencePack, loadRunDetail } from "@/lib/run-detail";

/** The evidence pack: ?format=json (default, hashed) or ?format=html (printable). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const op = await operatorOr401();
  if (op instanceof NextResponse) return op;
  const { id } = await ctx.params;
  const detail = await loadRunDetail(id);
  if (!detail) return NextResponse.json({ error: "Unknown run." }, { status: 404 });
  if (detail.run.status !== "done")
    return NextResponse.json({ error: "This run has not finished verifying." }, { status: 409 });
  const pack = evidencePack(detail);
  const format = new URL(req.url).searchParams.get("format");
  if (format === "html") {
    return new NextResponse(
      renderEvidenceHtml(pack, (f) => `/api/frames/${id}/${f}`),
      {
        headers: { "content-type": "text/html; charset=utf-8" },
      },
    );
  }
  return new NextResponse(JSON.stringify(pack, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="evidence-${id}.json"`,
    },
  });
}
