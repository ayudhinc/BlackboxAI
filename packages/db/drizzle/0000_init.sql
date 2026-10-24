CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"subject_id" text NOT NULL,
	"status" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 2 NOT NULL,
	"last_error" text,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lineage" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text,
	"policy_id" text,
	"stage" text NOT NULL,
	"engine" text NOT NULL,
	"prompt_hash" text,
	"tokens_in" integer,
	"tokens_cached" integer,
	"tokens_out" integer,
	"frames" integer,
	"cost_usd" real NOT NULL,
	"latency_ms" integer NOT NULL,
	"attempt" integer NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policies" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"source_key" text,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rules" (
	"policy_id" text NOT NULL,
	"id" text NOT NULL,
	"text" text NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"clarification" text,
	"params" jsonb NOT NULL,
	"source_page" integer NOT NULL,
	"source_quote" text NOT NULL,
	"signed_off_by" text,
	"signed_off_at" timestamp with time zone,
	CONSTRAINT "rules_policy_id_id_pk" PRIMARY KEY("policy_id","id")
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"task" text NOT NULL,
	"agent_vendor" text NOT NULL,
	"agent_model" text NOT NULL,
	"surface" text NOT NULL,
	"mode" text NOT NULL,
	"policy_id" text,
	"status" text NOT NULL,
	"recording_key" text,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"agent_claim" text,
	"failure" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runtime_events" (
	"run_id" text NOT NULL,
	"seq" integer NOT NULL,
	"t_ms" integer NOT NULL,
	"pid" integer NOT NULL,
	"window" text NOT NULL,
	"event" text NOT NULL,
	"role" text,
	"name" text,
	"value" text,
	"text" text,
	CONSTRAINT "runtime_events_run_id_seq_pk" PRIMARY KEY("run_id","seq")
);
--> statement-breakpoint
CREATE TABLE "steps" (
	"run_id" text NOT NULL,
	"n" integer NOT NULL,
	"t_ms" integer NOT NULL,
	"app" text NOT NULL,
	"action" text NOT NULL,
	"target" text NOT NULL,
	"field" text,
	"observed_after" text NOT NULL,
	"dialog_opened" boolean NOT NULL,
	"screen_signature" text,
	"source" text NOT NULL,
	"confidence" real NOT NULL,
	"evidence_frames" jsonb NOT NULL,
	"redacted" boolean NOT NULL,
	CONSTRAINT "steps_run_id_n_pk" PRIMARY KEY("run_id","n")
);
--> statement-breakpoint
CREATE TABLE "ui_tracks" (
	"run_id" text NOT NULL,
	"phrase" text NOT NULL,
	"object_id" text NOT NULL,
	"frames" jsonb NOT NULL,
	CONSTRAINT "ui_tracks_run_id_phrase_object_id_pk" PRIMARY KEY("run_id","phrase","object_id")
);
--> statement-breakpoint
CREATE TABLE "verdicts" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"status" text NOT NULL,
	"confidence" real NOT NULL,
	"rationale" text NOT NULL,
	"evidence_frames" jsonb NOT NULL,
	"decided_by" text NOT NULL,
	"reviewer" text,
	"review_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "violations" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"rule_id" text NOT NULL,
	"step_n" integer NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"detail" text NOT NULL,
	"evidence_frames" jsonb NOT NULL,
	"checker" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lineage" ADD CONSTRAINT "lineage_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineage" ADD CONSTRAINT "lineage_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rules" ADD CONSTRAINT "rules_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runtime_events" ADD CONSTRAINT "runtime_events_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "steps" ADD CONSTRAINT "steps_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ui_tracks" ADD CONSTRAINT "ui_tracks_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verdicts" ADD CONSTRAINT "verdicts_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "violations" ADD CONSTRAINT "violations_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jobs_claim_idx" ON "jobs" USING btree ("status","run_after");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_live_subject_idx" ON "jobs" USING btree ("kind","subject_id") WHERE status in ('queued', 'running');--> statement-breakpoint
CREATE INDEX "lineage_run_idx" ON "lineage" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "lineage_created_idx" ON "lineage" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "runs_task_idx" ON "runs" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE INDEX "verdicts_run_idx" ON "verdicts" USING btree ("run_id","created_at");--> statement-breakpoint
CREATE INDEX "violations_run_idx" ON "violations" USING btree ("run_id");