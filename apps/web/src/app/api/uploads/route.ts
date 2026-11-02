import { newId } from "@blackbox/contracts";
import { schema } from "@blackbox/db";
import { keys, R2BlobStore } from "@blackbox/engine";
import { NextResponse } from "next/server";
import { z } from "zod";
import { operatorOr401 } from "@/lib/auth";
import { db, store } from "@/lib/server";

const MAX_BYTES = 500 * 1024 * 1024;

const Body = z.object({
  task: z
    .string()
    .trim()
    .min(10, "Describe the task the agent was given (at least 10 characters).")
    .max(4000),
  taskId: z
    .string()
    .trim()
    .max(80)
    .regex(/^[a-z0-9-]*$/, "Task ID may use lower-case letters, digits and hyphens.")
    .optional(),
  policyId: z.string().trim().optional(),
  agent: z.string().trim().max(120).default("unknown/unknown"),
  surface: z.string().trim().max(120).default("Unknown surface"),
  filename: z.string().min(1),
  size: z.number().int().positive().max(MAX_BYTES, "Recordings are limited to 500 MB."),
  contentType: z.enum(["video/mp4", "video/quicktime"], {
    message: "Upload an MP4 or MOV recording.",
  }),
});

/** Create a run and hand back where the browser should upload the recording. */
export async function POST(req: Request) {
  const op = await operatorOr401();
  if (op instanceof NextResponse) return op;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid upload." },
      { status: 400 },
    );
  }
  const b = parsed.data;
  if (b.policyId) {
    const policy = await db().query.policies.findFirst({
      where: (p, { eq }) => eq(p.id, b.policyId as string),
    });
    if (policy?.status !== "signed_off") {
      return NextResponse.json(
        { error: "Choose a policy that has been signed off." },
        { status: 400 },
      );
    }
  }
  const [vendor, ...model] = b.agent.split("/");
  const runId = newId("run");
  await db()
    .insert(schema.runs)
    .values({
      id: runId,
      taskId: b.taskId || newId("task").toLowerCase(),
      task: b.task,
      agentVendor: vendor || "unknown",
      agentModel: model.join("/") || "unknown",
      surface: b.surface,
      mode: "video",
      policyId: b.policyId || null,
      status: "uploaded",
      recordingKey: keys.recording(runId),
    });
  const s = store();
  const url =
    s instanceof R2BlobStore
      ? await s.presignPut(keys.recording(runId), b.contentType)
      : `/api/uploads/${runId}`;
  return NextResponse.json({ runId, upload: { url, method: "PUT", contentType: b.contentType } });
}
