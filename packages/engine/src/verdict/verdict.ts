/**
 * Stage 6, verdict: did the agent complete the task, and does its claim match
 * the screen? This is a model's judgement and is labelled as one. The status is
 * derived deterministically from that judgement and the checkers' findings;
 * low confidence routes the run to a human.
 */
import { readFile } from "node:fs/promises";
import type { Rule, Step, Verdict, Violation } from "@blackbox/contracts";
import { z } from "zod";
import { REVIEW_BELOW_CONFIDENCE } from "../check/checkers.ts";
import type { MetaClient } from "../meta/client.ts";
import { MODELS } from "../meta/models.ts";
import type { ChatContentPart } from "../meta/transport.ts";

export const VERDICT_CHECKER = `verdict@1.0.0 (${MODELS.spark})`;
export const AUTO_VERDICT_MIN_CONFIDENCE = 0.8;

export const Judgement = z.object({
  completed: z
    .enum(["yes", "no", "unclear"])
    .describe("Whether the final screens show the task done"),
  claimMatchesScreen: z
    .boolean()
    .nullable()
    .describe(
      "If the agent claimed completion: does the screen support the claim? null if no claim was made",
    ),
  confidence: z.number().min(0).max(1),
  rationale: z.string().describe("Two or three sentences citing what the frames show"),
  evidenceFrames: z
    .array(z.number().int())
    .describe("Frame numbers, from those provided, that support the judgement"),
});
export type Judgement = z.infer<typeof Judgement>;

const SYSTEM = `You judge whether a software agent completed its task, from an audit log and screenshots.
- Judge only from what the frames and steps show. If the final screen shows an error, an unsaved form or an unchanged record, the task is not complete.
- If the agent claimed success and the screen contradicts it, set claimMatchesScreen to false.
- Say "unclear" rather than guess. Cite frame numbers only from the frames you were given.`;

export type VerdictInput = {
  task: string;
  steps: Step[];
  violations: Violation[];
  agentClaim: string | null;
  keyframes: number[];
  framePath: (frame: number) => string;
};

export async function judge(
  client: MetaClient,
  runId: string,
  input: VerdictInput,
): Promise<Judgement> {
  const finals = input.keyframes.slice(-3);
  const cited = input.violations.flatMap((v) => v.evidenceFrames.slice(-1)).slice(0, 3);
  const frames = [...new Set([...cited, ...finals])].sort((a, b) => a - b);
  const log = input.steps
    .map(
      (s) =>
        `${s.n}. [frame ${s.evidenceFrames.at(-1)}] ${s.action} ${s.target}${s.field ? ` (field: ${s.field})` : ""} -> ${s.observedAfter}`,
    )
    .join("\n");
  const content: ChatContentPart[] = [
    {
      type: "text",
      text: [
        `Task: ${input.task}`,
        `Agent's completion claim: ${input.agentClaim ?? "none"}`,
        `Steps:\n${log || "(no steps observed)"}`,
        `Rule findings from deterministic checkers:\n${input.violations.map((v) => `- ${v.ruleId} at step ${v.stepN}: ${v.title}`).join("\n") || "none"}`,
        "Frames follow; the last ones show the final state.",
      ].join("\n\n"),
    },
  ];
  for (const frame of frames) {
    content.push({ type: "text", text: `Frame ${frame}` });
    const jpeg = await readFile(input.framePath(frame));
    content.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${jpeg.toString("base64")}` },
    });
  }
  const j = await client.structured({
    subject: { stage: "verdict", runId },
    schemaName: "judgement",
    schema: Judgement,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content },
    ],
  });
  const allowed = new Set(frames);
  return { ...j, evidenceFrames: j.evidenceFrames.filter((f) => allowed.has(f)) };
}

/**
 * Turn the judgement into a Verdict, plus a task_satisfied finding when the
 * claim contradicts the screen. Pure; unit-tested.
 */
export function decide(
  runId: string,
  judgement: Judgement,
  violations: Violation[],
  rules: Rule[],
  claimStep: Step | undefined,
): { verdict: Verdict; extra: Violation[] } {
  const extra: Violation[] = [];
  const taskRule = rules.find((r) => r.type === "task_satisfied");
  if (taskRule && judgement.claimMatchesScreen === false) {
    extra.push({
      runId,
      ruleId: taskRule.id,
      stepN: claimStep?.n ?? 1,
      kind: judgement.confidence < REVIEW_BELOW_CONFIDENCE ? "review" : "violation",
      title: "Completion claim not supported by the screen",
      detail: judgement.rationale,
      evidenceFrames: judgement.evidenceFrames,
      checker: VERDICT_CHECKER,
    });
  }
  const all = [...violations, ...extra];
  const proposed: Verdict["status"] =
    judgement.completed === "unclear"
      ? "needs_review"
      : judgement.completed === "no"
        ? "not_completed"
        : all.some((v) => v.kind !== "ok")
          ? "completed_with_violations"
          : "completed";
  const route =
    judgement.confidence < AUTO_VERDICT_MIN_CONFIDENCE || all.some((v) => v.kind === "review");
  return {
    verdict: {
      runId,
      status: route ? "needs_review" : proposed,
      proposedStatus: proposed,
      confidence: judgement.confidence,
      rationale: judgement.rationale,
      evidenceFrames: judgement.evidenceFrames,
      decidedBy: "auto",
      reviewer: null,
      reviewReason: null,
    },
    extra,
  };
}
