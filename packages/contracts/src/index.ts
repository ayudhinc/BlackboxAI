/**
 * Typed contracts for every handoff between pipeline stages, and the shape of
 * what is stored. See docs/architecture.md. Every handoff parses against one of
 * these schemas and fails loudly on mismatch.
 */
import { z } from "zod";

export * from "./ids.ts";

const id = z.string().min(1);
const unit = z.number().min(0).max(1);
const ms = z.number().int().min(0);
const iso = z.iso.datetime();

export const Mode = z.enum(["video", "native"]);
export type Mode = z.infer<typeof Mode>;

export const Kind = z.enum(["ok", "violation", "review"]);
export type Kind = z.infer<typeof Kind>;

export const RunStatus = z.enum([
  "uploaded",
  "ingesting",
  "tracking",
  "narrating",
  "checking",
  "verdict",
  "done",
  "failed",
]);
export type RunStatus = z.infer<typeof RunStatus>;

export const Box = z.tuple([z.number(), z.number(), z.number(), z.number()]); // left, top, right, bottom (half-open)
export type Box = z.infer<typeof Box>;

export const Run = z.object({
  id,
  taskId: id, // groups runs of the same task for regression
  task: z.string().min(1), // the task spec in plain text
  agent: z.object({ vendor: z.string().min(1), model: z.string().min(1) }),
  surface: z.string().min(1), // "Chromium · Acme CRM", "noVNC · Meridian ERP"
  mode: Mode,
  policyId: id.nullable(),
  status: RunStatus,
  recordingKey: z.string().nullable(), // object-storage key of the MP4
  durationMs: ms,
  agentClaim: z.string().nullable(), // what the agent said it did, when known
  /** Screen regions that belong to the agent's own UI (a console strip, a side panel): excluded from screen identity. */
  overlays: z.array(z.object({ label: z.string(), box: Box })),
  failure: z.string().nullable(), // why the run failed, in user-facing words
  createdAt: iso,
});
export type Run = z.infer<typeof Run>;

export const UiTrack = z.object({
  runId: id,
  phrase: z.string().min(1), // the SAM concept
  objectId: z.string().min(1), // SAM's id, stable within one response
  frames: z.array(
    z.object({
      frame: z.number().int().min(0),
      tMs: ms,
      box: Box,
      confidence: unit.nullable(), // null when SAM sent no confidence; not zero
    }),
  ),
});
export type UiTrack = z.infer<typeof UiTrack>;

export const RuntimeEventType = z.enum([
  "button.press",
  "link.activate",
  "tab.select",
  "text.insert",
  "key.press",
  "window.focus",
  "dialog.open",
  "dialog.close",
  "file.write",
  "net.request",
  "agent.claim",
]);
export type RuntimeEventType = z.infer<typeof RuntimeEventType>;

export const RuntimeEvent = z.object({
  runId: id,
  tMs: ms,
  pid: z.number().int(),
  window: z.string(),
  event: RuntimeEventType,
  role: z.string().optional(), // AT-SPI role
  name: z.string().optional(), // AT-SPI accessible name
  value: z.literal("[redacted]").optional(),
  text: z.string().optional(), // agent.claim only: the agent's own words
});
export type RuntimeEvent = z.infer<typeof RuntimeEvent>;

export const StepAction = z.enum(["click", "type", "navigate", "key", "scroll", "claim"]);
export type StepAction = z.infer<typeof StepAction>;

export const Step = z.object({
  runId: id,
  n: z.number().int().min(1),
  tMs: ms,
  app: z.string(),
  action: StepAction,
  target: z.string(), // what was acted on, e.g. "button 'Delete selected'"
  field: z.string().nullable(), // label or accessible name of the field typed into
  observedAfter: z.string(),
  dialogOpened: z.boolean(), // a confirmation or modal dialog appeared after this step
  screenSignature: z.string().nullable(), // keyframe hash of the screen the action was taken on
  screenAfter: z.string().nullable(), // screen identity right after the action
  madeProgress: z.boolean().nullable(), // the screen visibly changed after the action; null when unknown
  source: Mode,
  confidence: unit, // 1 for native
  evidenceFrames: z.array(z.number().int().min(0)),
  redacted: z.boolean(),
});
export type Step = z.infer<typeof Step>;

export const RuleType = z.enum([
  "app_allowlist",
  "confirm_before_destroy",
  "loop_limit",
  "data_class_ban",
  "max_duration",
  "task_satisfied",
]);
export type RuleType = z.infer<typeof RuleType>;

export const RuleStatus = z.enum(["ready", "needs_clarification"]);

export const Rule = z.object({
  id, // "R2"
  policyId: id,
  text: z.string().min(1), // the read-back, in plain English
  type: RuleType,
  status: RuleStatus,
  clarification: z.string().nullable(), // the question an operator must answer
  params: z.record(z.string(), z.unknown()),
  sourceSpan: z.object({ page: z.number().int().min(1), quote: z.string().min(1) }),
  signedOffBy: z.string().nullable(),
  signedOffAt: iso.nullable(),
});
export type Rule = z.infer<typeof Rule>;

export const Policy = z.object({
  id,
  title: z.string().min(1),
  sourceKey: z.string().nullable(), // object-storage key of the PDF
  status: z.enum(["compiling", "awaiting_signoff", "signed_off", "failed"]),
  createdAt: iso,
});
export type Policy = z.infer<typeof Policy>;

export const Violation = z.object({
  runId: id,
  ruleId: z.string().min(1),
  stepN: z.number().int().min(1),
  kind: Kind,
  title: z.string().min(1),
  detail: z.string(),
  evidenceFrames: z.array(z.number().int().min(0)),
  checker: z.string().min(1), // name@version of the pure function that fired
});
export type Violation = z.infer<typeof Violation>;

export const VerdictStatus = z.enum([
  "completed",
  "completed_with_violations",
  "not_completed",
  "needs_review",
]);
export type VerdictStatus = z.infer<typeof VerdictStatus>;

export const Verdict = z.object({
  runId: id,
  status: VerdictStatus,
  proposedStatus: VerdictStatus, // what the judgement says before routing; status is needs_review when routed
  confidence: unit,
  rationale: z.string().min(1),
  evidenceFrames: z.array(z.number().int().min(0)),
  decidedBy: z.enum(["auto", "reviewer"]),
  reviewer: z.string().nullable(),
  reviewReason: z.string().nullable(),
});
export type Verdict = z.infer<typeof Verdict>;

export const Stage = z.enum([
  "ingest",
  "track",
  "map_events",
  "narrate",
  "compile_policy",
  "check",
  "verdict",
  "regress",
  "deliver",
  "agent", // our computer-use loop generating demo runs
  "probe", // development probes; never part of a customer run
]);
export type Stage = z.infer<typeof Stage>;

export const LineageEntry = z.object({
  id,
  runId: id.nullable(),
  policyId: id.nullable(),
  stage: Stage,
  engine: z.string().min(1), // "sam-3.1", "muse-spark-1.3", "checker:loop@1.0.0"
  promptHash: z.string().nullable(), // sha256 of the canonical request
  tokensIn: z.number().int().min(0).nullable(),
  tokensCached: z.number().int().min(0).nullable(),
  tokensOut: z.number().int().min(0).nullable(),
  frames: z.number().int().min(0).nullable(),
  costUsd: z.number().min(0),
  latencyMs: ms,
  attempt: z.number().int().min(1),
  error: z.string().nullable(),
  createdAt: iso,
});
export type LineageEntry = z.infer<typeof LineageEntry>;
