"use server";
import { newId, VerdictStatus } from "@blackbox/contracts";
import { schema } from "@blackbox/db";
import { enqueueJob, keys, loadRules, resolveRule } from "@blackbox/engine";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, OPERATOR, store } from "./server";

export type ActionState = { error: string | null };

const Review = z.object({
  runId: z.string().min(1),
  decision: z.enum(["approve", "override"]),
  status: VerdictStatus.optional(),
  reason: z.string().trim().max(2000),
});

/** A reviewer approves the proposed verdict or overrules it. Either way the decision is a new verdict row. */
export async function reviewVerdict(_prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = Review.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "The review form was incomplete." };
  const { runId, decision, status, reason } = parsed.data;
  const latest = await db().query.verdicts.findFirst({
    where: eq(schema.verdicts.runId, runId),
    orderBy: desc(schema.verdicts.createdAt),
  });
  if (!latest) return { error: "This run has no verdict to review yet." };
  if (decision === "override") {
    if (!status || status === "needs_review")
      return { error: "Choose the status this run should have." };
    if (reason.length < 5) return { error: "Say why you are overruling the verdict." };
  }
  const finalStatus = decision === "approve" ? latest.proposedStatus : (status as string);
  await db()
    .insert(schema.verdicts)
    .values({
      id: newId("verdict"),
      runId,
      status:
        finalStatus === "needs_review" ? "needs_review" : (finalStatus as typeof latest.status),
      proposedStatus: latest.proposedStatus,
      confidence: latest.confidence,
      rationale: latest.rationale,
      evidenceFrames: latest.evidenceFrames,
      decidedBy: "reviewer",
      reviewer: OPERATOR,
      reviewReason: reason || (decision === "approve" ? "Approved the proposed verdict." : null),
    });
  revalidatePath(`/runs/${runId}`);
  revalidatePath("/queue");
  return { error: null };
}

const MAX_POLICY_BYTES = 10 * 1024 * 1024;

export async function uploadPolicy(_prev: ActionState, form: FormData): Promise<ActionState> {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { error: "Choose a policy document to upload." };
  if (file.size > MAX_POLICY_BYTES) return { error: "Policy documents are limited to 10 MB." };
  const name = file.name.toLowerCase();
  if (!/\.(pdf|md|txt)$/.test(name))
    return { error: "Upload the policy as a PDF, Markdown or text file." };
  const policyId = newId("policy");
  const filename = file.name.replace(/[^\w.-]+/g, "_");
  await store().put(
    keys.policy(policyId, filename),
    new Uint8Array(await file.arrayBuffer()),
    file.type || "application/octet-stream",
  );
  await db()
    .insert(schema.policies)
    .values({
      id: policyId,
      title: file.name,
      sourceKey: keys.policy(policyId, filename),
      status: "compiling",
    });
  await enqueueJob(db(), "compile_policy", policyId);
  redirect(`/policies/${policyId}`);
}

const Resolve = z.object({
  policyId: z.string(),
  ruleId: z.string(),
  params: z.string(),
  readBack: z.string().trim(),
});

export async function resolvePolicyRule(_prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = Resolve.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "The form was incomplete." };
  const { policyId, ruleId, readBack } = parsed.data;
  let params: Record<string, unknown>;
  try {
    params = JSON.parse(parsed.data.params);
  } catch {
    return { error: 'Parameters must be valid JSON, for example {"maxRepeats": 2}.' };
  }
  const rule = (await loadRules(db(), policyId)).find((r) => r.id === ruleId);
  if (!rule) return { error: "That rule no longer exists." };
  try {
    const resolved = resolveRule(rule, params, readBack || undefined);
    await db()
      .update(schema.rules)
      .set({
        params: resolved.params,
        status: "ready",
        clarification: null,
        text: resolved.text,
        signedOffBy: null,
        signedOffAt: null,
      })
      .where(and(eq(schema.rules.policyId, policyId), eq(schema.rules.id, ruleId)));
  } catch (error) {
    return { error: (error as Error).message };
  }
  revalidatePath(`/policies/${policyId}`);
  return { error: null };
}

export async function signOffPolicy(_prev: ActionState, form: FormData): Promise<ActionState> {
  const policyId = String(form.get("policyId") ?? "");
  const rules = await loadRules(db(), policyId);
  if (rules.length === 0) return { error: "This policy has no rules to sign off." };
  const open = rules.filter((r) => r.status !== "ready");
  if (open.length > 0)
    return { error: `Resolve ${open.map((r) => r.id).join(", ")} before signing off.` };
  const now = new Date();
  await db()
    .update(schema.rules)
    .set({ signedOffBy: OPERATOR, signedOffAt: now })
    .where(eq(schema.rules.policyId, policyId));
  await db()
    .update(schema.policies)
    .set({ status: "signed_off" })
    .where(eq(schema.policies.id, policyId));
  revalidatePath(`/policies/${policyId}`);
  revalidatePath("/policies");
  return { error: null };
}
