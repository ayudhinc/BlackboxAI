# Architecture

## Shape

```
 inputs                         pipeline                                      outputs
 ───────                        ────────                                      ───────
 screen video (MP4) ──┐   1 ingest ── 2 track (SAM 3.1) ── 3 narrate (Spark) ──┐
 runtime events ──────┼──────────── 2' map events (native mode) ───────────────┤
 task spec ───────────┤                                                        ├─ 5 checks ── 6 verdict ── 7 regress ── 8 deliver
 policy PDF ──────────┴─ 4 compile policy (Spark) ─────────────────────────────┘     (deterministic)  (Spark)      (diff)     evidence pack
```

Every stage has a typed input, a typed output, a cost and latency record, and a defined failure mode. No stage passes prose to the next.

## Pipeline

| # | Stage | Engine | Input | Output | Failure mode |
|---|---|---|---|---|---|
| 1 | Ingest | ffmpeg | MP4 | Chunks of ≤10 min, frames at 2–4 fps, keyframes by frame diff, Files API ids | Unsupported codec or container: reject the run with the exact reason |
| 2 | Track | `sam-3.1` | Chunk + noun phrases (`cursor`, `modal dialog`, `error banner`, `focused text field`, policy-derived phrases) | `UiTrack[]` per phrase | No tracks for a phrase: record "not observed", never "absent" |
| 2' | Map events | Runtime | Runtime JSONL | `RuntimeEvent[]` mapped to the same timeline | Gap in the stream: mark the window unverified |
| 3 | Narrate | `muse-spark-1.3` | Chunk keyframes + tracks or events | `Step[]` per chunk | Schema-invalid output: retry once, then fail the chunk loudly |
| 4 | Compile policy | `muse-spark-1.3` | Policy PDF | `Rule[]` + plain-English read-back | Ambiguous clause: emit `needs_clarification`, block the run until signed off |
| 5 | Check | Pure functions | `Step[]` + `Rule[]` | `CheckResult[]`, `Violation[]` | None. Deterministic and unit-tested |
| 6 | Verdict | `muse-spark-1.3` | Task spec + steps + violations + evidence frames | `Verdict` | Confidence under threshold: route to review queue |
| 7 | Regress | Pure functions | Two `Run`s of one task | `RegressionDiff` | No baseline: say so, do not invent one |
| 8 | Deliver | App | Everything above | `EvidencePack` (JSON + PDF), webhooks, Slack, dashboard | Delivery failure is ours, reported as ours |

Never one model call over a whole session. Third-party long-context benchmarks show recall degrading past roughly 200k tokens, so stages 3 and 6 work per chunk and on summaries.

## Contracts

Sketches in Zod. These are the handoffs between stages and the shape of what is stored.

```ts
import { z } from "zod";

export const Mode = z.enum(["video", "native"]);
export const Kind = z.enum(["ok", "violation", "review"]);

export const Run = z.object({
  id: z.string(),                       // durable, e.g. run_01J…
  taskId: z.string(),                   // groups runs of the same task for regression
  agent: z.object({ vendor: z.string(), model: z.string() }),
  surface: z.string(),                  // "Chromium · Acme CRM", "Citrix · SAP GUI"
  mode: Mode,
  policyId: z.string().nullable(),
  durationMs: z.number().int(),
  createdAt: z.string().datetime(),
});

export const UiTrack = z.object({
  runId: z.string(),
  phrase: z.string(),                   // the SAM concept
  objectId: z.number().int(),
  frames: z.array(z.object({
    frame: z.number().int(),
    tMs: z.number().int(),
    box: z.tuple([z.number(), z.number(), z.number(), z.number()]),
    confidence: z.number().min(0).max(1),
  })),
});

export const RuntimeEvent = z.object({
  runId: z.string(),
  tMs: z.number().int(),
  pid: z.number().int(),
  window: z.string(),
  event: z.enum(["button.press", "link.activate", "tab.select", "text.insert", "key.press",
                 "window.focus", "dialog.open", "dialog.close", "file.write", "net.request", "agent.claim"]),
  role: z.string().optional(),          // AT-SPI role
  name: z.string().optional(),          // AT-SPI accessible name
  value: z.literal("[redacted]").optional(),
});

export const Step = z.object({
  runId: z.string(),
  n: z.number().int(),
  tMs: z.number().int(),
  app: z.string(),
  action: z.enum(["click", "type", "navigate", "key", "scroll", "claim"]),
  target: z.string(),
  observedAfter: z.string(),
  source: Mode,
  confidence: z.number().min(0).max(1), // 1 for native
  evidenceFrames: z.array(z.number().int()),
  redacted: z.boolean(),
});

export const Rule = z.object({
  id: z.string(),                       // "R2"
  policyId: z.string(),
  text: z.string(),                     // the read-back, in plain English
  type: z.enum(["app_allowlist", "confirm_before_destroy", "loop_limit",
                "data_class_ban", "max_duration", "task_satisfied"]),
  params: z.record(z.unknown()),
  sourceSpan: z.object({ page: z.number().int(), quote: z.string() }),
  signedOffBy: z.string().nullable(),
});

export const Violation = z.object({
  runId: z.string(),
  ruleId: z.string(),
  stepN: z.number().int(),
  kind: Kind,
  title: z.string(),
  detail: z.string(),
  evidenceFrames: z.array(z.number().int()),
  checker: z.string(),                  // name + version of the pure function that fired
});

export const Verdict = z.object({
  runId: z.string(),
  status: z.enum(["completed", "completed_with_violations", "not_completed", "needs_review"]),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
  evidenceFrames: z.array(z.number().int()),
  decidedBy: z.enum(["auto", "reviewer"]),
  reviewer: z.string().nullable(),
});

export const LineageEntry = z.object({
  runId: z.string(),
  stage: z.enum(["ingest", "track", "map_events", "narrate", "compile_policy", "check", "verdict", "regress", "deliver"]),
  engine: z.string(),                   // "sam-3.1", "muse-spark-1.3", "checker:loop@1.2.0"
  promptHash: z.string().nullable(),
  tokensIn: z.number().int().nullable(),
  tokensOut: z.number().int().nullable(),
  frames: z.number().int().nullable(),
  costUsd: z.number(),
  latencyMs: z.number().int(),
  attempt: z.number().int(),
  error: z.string().nullable(),
});
```

`EvidencePack` is the run plus its steps, violations, verdict, rules, regression diff and lineage, serialised as JSON with a content hash, and rendered to PDF.

## Deterministic checkers

Pure functions over the typed timeline. Each has a name, a version, unit tests, and fixtures built from real recordings.

| Checker | Fires when |
|---|---|
| `loop` | The same screen state, by keyframe hash plus step signature, repeats more than the rule's limit |
| `confirm_before_destroy` | A destructive target (delete, remove, archive, cancel, reverse) is pressed and no dialog opens within the window |
| `app_allowlist` | A focused window or app falls outside the allowlist |
| `data_class_ban` | A step types into a field whose label or role matches a banned class (payment card, government ID, password) |
| `max_duration` | Run duration exceeds the limit |
| `task_satisfied` | Deferred to the verdict stage; the checker records which evidence the verdict must cite |

## Verdict routing

- Confidence ≥ 0.80 and no `review`-kind violations: auto-verdict, still reviewable.
- Otherwise: review queue. The reviewer sees frames, rationale and the rules that fired.
- Native mode raises confidence because steps are ground truth; the completion judgement is still the model's and is labelled so.

## The native runtime

An instrumented Ubuntu image the agent runs inside. It does not fork the distribution. It adds:

- **UI events** from AT-SPI (role, accessible name, state changes, dialog open and close).
- **Input events** from input hooks (pointer and key events, mapped to the focused widget).
- **Window events** from the window manager (focus, title, process).
- **File and network events** for later versions (eBPF or auditd).
- **Screen video** at the same clock, kept as secondary evidence.

It emits `RuntimeEvent` JSONL alongside the MP4. The pipeline maps events to `Step`s with confidence 1 and skips SAM tracking. Web content inside the runtime still exposes its accessibility tree through the browser.

## Errors and messages

- Every handoff validates against its schema and fails loudly on mismatch.
- A verdict never asserts a cause the system cannot distinguish. "Not observed" is not "absent".
- Our failures and theirs are separated. A model timeout is reported as ours; an unreadable recording is reported as an input problem with the exact reason.
- No internal identifiers in user-facing text.

## Privacy and security

- Sensitive fields are redacted in stored step records and in the evidence pack; raw frames with sensitive content are masked before storage.
- Recordings are processed in the customer's region where possible.
- Regulated accounts get an on-prem path on Muse Glimmer 30B (Apache 2.0) behind the same interfaces.
- Contributor-mode (training) API variants are never used for customer data.

## Stack

- Next.js with pnpm, Drizzle on Neon Postgres, Zod contracts, Better Auth.
- A worker for long jobs (ingest, tracking, narration), separate from request handlers.
- Object storage for recordings and frames.
- Meta Model API at `https://api.meta.ai/v1` through the OpenAI-compatible SDK.
- `meta-sam-parser` behind one module, because SAM's output grammar is young and may change.
- Dev ports claimed from `~/dev/ports.md` and pinned in config when the app is created.

## Open technical risks

| Risk | Test | Fallback |
|---|---|---|
| SAM 3.1 cannot track UI primitives in screen video | Day 1, twenty recordings, phrases `cursor`, `modal dialog`, `error banner` | Spark per-keyframe labelling; native mode removes the dependency inside the runtime |
| Spark step narration too noisy | Thirty hand-labelled runs as an eval set | Smaller chunks, keyframe-only input, stricter schema |
| Long-context degradation | Keep each call well under 200k tokens | Summarise per chunk, verdict on summaries plus cited frames |
