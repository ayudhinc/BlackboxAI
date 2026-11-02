/**
 * Storage for the contracts in @blackbox/contracts. Column names follow the
 * contract fields; jsonb holds arrays that are always read whole.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const policies = pgTable("policies", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  sourceKey: text("source_key"),
  status: text("status", {
    enum: ["compiling", "awaiting_signoff", "signed_off", "failed"],
  }).notNull(),
  createdAt: createdAt(),
});

export const rules = pgTable(
  "rules",
  {
    policyId: text("policy_id")
      .notNull()
      .references(() => policies.id, { onDelete: "cascade" }),
    id: text("id").notNull(), // "R2", unique within a policy
    text: text("text").notNull(),
    type: text("type", {
      enum: [
        "app_allowlist",
        "confirm_before_destroy",
        "loop_limit",
        "data_class_ban",
        "max_duration",
        "task_satisfied",
      ],
    }).notNull(),
    status: text("status", { enum: ["ready", "needs_clarification"] }).notNull(),
    clarification: text("clarification"),
    params: jsonb("params").$type<Record<string, unknown>>().notNull(),
    sourcePage: integer("source_page").notNull(),
    sourceQuote: text("source_quote").notNull(),
    signedOffBy: text("signed_off_by"),
    signedOffAt: timestamp("signed_off_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.policyId, t.id] })],
);

export const runs = pgTable(
  "runs",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id").notNull(),
    task: text("task").notNull(),
    agentVendor: text("agent_vendor").notNull(),
    agentModel: text("agent_model").notNull(),
    surface: text("surface").notNull(),
    mode: text("mode", { enum: ["video", "native"] }).notNull(),
    policyId: text("policy_id").references(() => policies.id),
    status: text("status", {
      enum: [
        "uploaded",
        "ingesting",
        "tracking",
        "narrating",
        "checking",
        "verdict",
        "done",
        "failed",
      ],
    }).notNull(),
    recordingKey: text("recording_key"),
    durationMs: integer("duration_ms").notNull().default(0),
    agentClaim: text("agent_claim"),
    overlays: jsonb("overlays")
      .$type<Array<{ label: string; box: [number, number, number, number] }>>()
      .notNull()
      .default([]),
    failure: text("failure"),
    createdAt: createdAt(),
  },
  (t) => [index("runs_task_idx").on(t.taskId, t.createdAt)],
);

export const steps = pgTable(
  "steps",
  {
    runId: text("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    n: integer("n").notNull(),
    tMs: integer("t_ms").notNull(),
    app: text("app").notNull(),
    action: text("action", {
      enum: ["click", "type", "navigate", "key", "scroll", "claim"],
    }).notNull(),
    target: text("target").notNull(),
    field: text("field"),
    observedAfter: text("observed_after").notNull(),
    dialogOpened: boolean("dialog_opened").notNull(),
    screenSignature: text("screen_signature"),
    screenAfter: text("screen_after"),
    madeProgress: boolean("made_progress"),
    source: text("source", { enum: ["video", "native"] }).notNull(),
    confidence: real("confidence").notNull(),
    evidenceFrames: jsonb("evidence_frames").$type<number[]>().notNull(),
    redacted: boolean("redacted").notNull(),
  },
  (t) => [primaryKey({ columns: [t.runId, t.n] })],
);

export type TrackFrame = {
  frame: number;
  tMs: number;
  box: [number, number, number, number];
  confidence: number | null;
};

export const uiTracks = pgTable(
  "ui_tracks",
  {
    runId: text("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    phrase: text("phrase").notNull(),
    objectId: text("object_id").notNull(),
    frames: jsonb("frames").$type<TrackFrame[]>().notNull(),
  },
  (t) => [primaryKey({ columns: [t.runId, t.phrase, t.objectId] })],
);

export const runtimeEvents = pgTable(
  "runtime_events",
  {
    runId: text("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    tMs: integer("t_ms").notNull(),
    pid: integer("pid").notNull(),
    window: text("window").notNull(),
    event: text("event").notNull(),
    role: text("role"),
    name: text("name"),
    value: text("value"),
    text: text("text"),
  },
  (t) => [primaryKey({ columns: [t.runId, t.seq] })],
);

export const violations = pgTable(
  "violations",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    ruleId: text("rule_id").notNull(),
    stepN: integer("step_n").notNull(),
    kind: text("kind", { enum: ["ok", "violation", "review"] }).notNull(),
    title: text("title").notNull(),
    detail: text("detail").notNull(),
    evidenceFrames: jsonb("evidence_frames").$type<number[]>().notNull(),
    checker: text("checker").notNull(),
  },
  (t) => [index("violations_run_idx").on(t.runId)],
);

export const verdicts = pgTable(
  "verdicts",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    status: text("status", {
      enum: ["completed", "completed_with_violations", "not_completed", "needs_review"],
    }).notNull(),
    proposedStatus: text("proposed_status", {
      enum: ["completed", "completed_with_violations", "not_completed", "needs_review"],
    }).notNull(),
    confidence: real("confidence").notNull(),
    rationale: text("rationale").notNull(),
    evidenceFrames: jsonb("evidence_frames").$type<number[]>().notNull(),
    decidedBy: text("decided_by", { enum: ["auto", "reviewer"] }).notNull(),
    reviewer: text("reviewer"),
    reviewReason: text("review_reason"),
    createdAt: createdAt(),
  },
  (t) => [index("verdicts_run_idx").on(t.runId, t.createdAt)],
);

export const lineage = pgTable(
  "lineage",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").references(() => runs.id, { onDelete: "set null" }),
    policyId: text("policy_id").references(() => policies.id, { onDelete: "set null" }),
    stage: text("stage").notNull(),
    engine: text("engine").notNull(),
    promptHash: text("prompt_hash"),
    tokensIn: integer("tokens_in"),
    tokensCached: integer("tokens_cached"),
    tokensOut: integer("tokens_out"),
    frames: integer("frames"),
    costUsd: real("cost_usd").notNull(),
    latencyMs: integer("latency_ms").notNull(),
    attempt: integer("attempt").notNull(),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [index("lineage_run_idx").on(t.runId), index("lineage_created_idx").on(t.createdAt)],
);

/** The job table. Workers claim with FOR UPDATE SKIP LOCKED; no queue service. */
export const jobs = pgTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(), // "process_run", "compile_policy"
    subjectId: text("subject_id").notNull(),
    status: text("status", { enum: ["queued", "running", "done", "failed"] }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(2),
    lastError: text("last_error"),
    runAfter: timestamp("run_after", { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: text("locked_by"),
    createdAt: createdAt(),
  },
  (t) => [
    index("jobs_claim_idx").on(t.status, t.runAfter),
    // At most one live job per subject; finished jobs can repeat.
    uniqueIndex("jobs_live_subject_idx")
      .on(t.kind, t.subjectId)
      .where(sql`status in ('queued', 'running')`),
  ],
);

/* Better Auth tables (core schema). A single operator signs in; sign-up is disabled. */
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
