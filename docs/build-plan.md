# Build plan

Ten days, one builder, a fixed deadline. This plan is scoped so the submission is safe by **day 9**, with day 10 kept for the video and a buffer.

| Fixed point | Time (ET, the event's clock) |
|---|---|
| Kickoff, build starts | Sun 2026-10-26, 12:00 PM |
| Feature freeze | Sun 2026-11-02, end of day |
| Submit (our target) | Tue 2026-11-04, 3:00 PM |
| Hard deadline | Tue 2026-11-04, 9:00 PM |

## The scope contract

The application promises specific things. Each is a **Must**, and nothing else is.

| Promised in the application | Must ship as |
|---|---|
| Ingestion of any screen recording, no SDK | Upload an MP4 in the hosted app, or the CLI; chunk, sample, keyframe |
| SAM 3.1 tracking of UI elements | Tracks for `cursor`, `modal dialog`, `error banner` and policy phrases, behind a go/no-go on day 2 |
| Step narration | Typed `Step[]` per chunk from Muse Spark 1.3 structured output |
| Policy compiler | Policy PDF to typed `Rule[]`, plain-English read-back, sign-off |
| Deterministic checkers | Loop, confirm-before-destroy, app allowlist, sensitive-field ban, max duration, all unit-tested |
| Verdicts and review queue | Completion verdict with confidence and frames; under 0.80 goes to the queue; approve or reject with a reason |
| Regression | Diff of two runs of one task (JSON plus a panel) |
| Evidence packs | JSON with a content hash, plus a printable HTML view |
| Native runtime | Chromium inside the sandbox emits typed AT-SPI and input events; steps become ground truth |
| Live demo grading Meta computer-use agents, incl. a DOM-less remote desktop | Our own computer-use loop on Spark 1.3 (Wonder if the API allows), plus a noVNC session into a canvas-only app |

**Should:** Slack or webhook delivery, the lineage panel polished, a second policy.
**Could:** Muse Glimmer on-prem path (pitch only), PDF export of the evidence pack.
**Won't:** live intervention, mobile, multi-tenant billing, a forked OS, Citrix itself.

## What gets built

```
 laptop (Docker)                                   hosted
 ───────────────                                   ──────
 sandbox container                                 web: Next.js on Vercel
   Xvfb + Chromium (+ --force-renderer-accessibility)    upload, runs, review page, queue, policies
   xdotool for actions, ffmpeg x11grab for video        Better Auth, single operator
   AT-SPI listener -> runtime.jsonl  (native mode)   worker: Node on Fly
   demo CRM app (local)                                  ingest (ffmpeg), SAM, Spark, checkers, verdicts
 remote container: canvas-only "legacy ERP"          Neon Postgres (Drizzle): runs, steps, rules, verdicts,
   viewed from the sandbox through noVNC (DOM-less)      lineage, job table (no Redis)
 agent runner (Node)                                 Cloudflare R2: recordings, frames, evidence packs
   screenshot -> Spark 1.3 / Wonder -> action JSON
   -> xdotool; scripted fallback runs
   uploads MP4 (+ runtime.jsonl) to the hosted app
```

Key choices, each made to protect the deadline:

- **Our own computer-use loop.** Screenshot in, structured action out, executed with xdotool. It works with any multimodal model, so it does not depend on a provider's computer-use tool shape.
- **Scripted runs alongside agent runs.** Scripted xdotool runs know their own steps, so they are free ground-truth labels for the eval set and a guaranteed source of demo recordings if agent runs misbehave.
- **The sandbox stays on the laptop.** The hosted app verifies any uploaded MP4, so judges can test it live without our sandbox. Running Docker desktops in the cloud is not needed for the demo.
- **One job table in Postgres.** No queue service to stand up or debug.
- **All TypeScript except the AT-SPI listener**, which is a small Python script inside the sandbox image. SAM output is decoded with `@meta-sam/parser` behind one module.

Ports (claim on day 1 after checking with `lsof`, register in `~/dev/ports.md` in the same commit): web **3500**, Playwright **3501**, worker health **3502**, noVNC **3505**, remote session VNC **3506**, local Postgres **5476**.

## Before kickoff (now to Oct 26): no product code

The Official Rules may require code to start at kickoff, so prepare everything except code.

- [ ] Create the Meta Model API key at dev.meta.ai and confirm access **from your country**: `GET /v1/models` must list `muse-spark-1.3` and `sam-3.1`. Model availability varies by country; this is the one risk that can sink the build before it starts.
- [ ] Check whether `muse-wonder-1.0` is enabled for the key.
- [x] Read the Official Rules the moment they publish: pre-existing code, open source, team size, video length. Read on 2026-10-23 from the waiver page. They don't mention pre-existing code or video length. See [hackathon.md](hackathon.md).
- [ ] Reserve names: Neon project, R2 bucket, Fly app, Vercel project. Empty, no code.
- [x] Write the content the demo needs: the CRM policy (one page, six rules), the ERP policy, and the twelve demo task specs with their seeded failures. See [../demo/](../demo/README.md).
- [x] Pull base images (Ubuntu, Chromium, noVNC) so day 1 is not spent downloading. Pulled `ubuntu:24.04`, `mcr.microsoft.com/playwright:v1.64.1-noble` and `debian:bookworm-slim`; `node:24-slim` and `postgres:17` were already present. noVNC comes from apt (`novnc` 1.3.0, `websockify` 0.10.0), not from an image.
  - Probe, 2026-10-23, arm64 (OrbStack): Ubuntu 24.04's `chromium-browser` is only a stub that installs the snap, which can't run in a container. The Playwright noble image (Ubuntu 24.04.5) ships Chrome for Testing 156.0.8078.4 for arm64. Under Xvfb, that Chromium plus `ffmpeg -f x11grab` produced an H.264 MP4 (1280×800, 30 frames in 3 s). With `--force-renderer-accessibility` inside a D-Bus session, pyatspi read the page's own tree: `entry 'Card number'`, `push button 'Delete'`. Not yet tested: AT-SPI event delivery, as opposed to reading the tree. See the sandbox base decision in [decisions.md](decisions.md).

## Day by day

Each day ends with a check that is either true or not.

| Day | Date | Build | Done when |
|---|---|---|---|
| 1 | Sun 10-26 (from 12 PM) | Repo, commit-msg hook, ports claimed. Next.js and worker skeletons. Drizzle schema for the contracts. Meta client module with lineage logging. Probe script: Spark structured output on a screenshot, SAM on one 30 s clip. Sandbox image boots Chromium in Xvfb and records with ffmpeg. | One sandbox MP4 exists, and SAM returns parsed boxes on it |
| 2 | Mon 10-27 | Demo CRM app in the sandbox. 20 scripted runs. Ingest: chunk, 2 fps frames, keyframes by frame diff, Files API upload. **SAM go/no-go** on those 20 runs. | Decision recorded in `docs/decisions.md` with numbers |
| 3 | Tue 10-28 | Step narration per chunk with structured output. Eval set from the scripted runs' own step logs. Score narration against it. | Narration accuracy measured and recorded |
| 4 | Wed 10-29 | Policy compiler with read-back and sign-off. All deterministic checkers with unit tests. CLI runs the full video pipeline on one recording. | **Checkpoint A:** CLI prints correct violations for a seeded-failure run |
| 5 | Thu 10-30 | Verdict stage, confidence routing, review-queue records. Agent runner on Spark 1.3 (and Wonder if enabled) doing the twelve tasks. | Real agent runs verified end to end by the CLI |
| 6 | Fri 10-31 | Native mode: AT-SPI listener, `runtime.jsonl`, mapper to steps. Remote container with the canvas ERP, reached through noVNC. | **Checkpoint B:** both modes run end to end, and a noVNC run is verified from video only |
| 7 | Sat 11-01 | UI from the mock: runs list, run review, review queue, upload, policies. Regression diff. Evidence pack JSON and printable HTML. | A run can be uploaded, reviewed, approved and exported in the browser locally |
| 8 | Sun 11-02 | Deploy: Vercel, Fly worker, Neon, R2. Hosted upload of any MP4 works. Lineage panel. Empty, loading and error states. | **Feature freeze.** Hosted app verifies a fresh upload |
| 9 | Mon 11-03 | Generate the twelve final demo runs. Bug fixes only. README with setup commands. Rehearse the demo three times. | Demo runs start to finish with no manual steps |
| 10 | Tue 11-04 | Record the demo video by noon. Submit by 3 PM. | Submitted, with six hours of buffer |

## Cut lines

If a checkpoint slips, cut in this order and say so in the README. Never cut past the line.

1. Slack and webhook delivery.
2. Evidence pack PDF (keep the printable HTML).
3. Regression panel (keep the JSON diff).
4. Muse Wonder runs (Spark 1.3 only).
5. SAM tracking, if day 2 says no-go: Spark keyframe labelling instead.
6. Native AT-SPI events, if they fight back: input and window events only, labelled "partial runtime events".

**Never cut:** deterministic checkers, verdicts with linked frames, the review queue, hosted upload of any recording, lineage on every model call.

| Checkpoint | If missed | Action |
|---|---|---|
| Day 2 SAM go/no-go | SAM boxes unusable on GUI video | Take cut 5 now, not later |
| Day 4 Checkpoint A | Pipeline not end to end | Take cuts 1 to 3; day 7 UI shrinks to the review page only |
| Day 6 Checkpoint B | Native or noVNC not working | Take cut 6; noVNC falls back to a canvas app opened directly |
| Day 8 freeze | Hosted path broken | Demo from local, hosted upload shown as recorded; fix only that on day 9 |

## Budget

Rough, to stay well inside the $150 credit. Real costs land in the lineage table from day 1.

| Item | Estimate |
|---|---|
| SAM go/no-go and dev testing (about 40 short runs) | under $10 |
| Narration, policy compiles, verdicts during development | under $10 |
| Agent runs on Spark 1.3 (about 50 runs) | under $10 |
| Agent runs on Wonder, if enabled (about 15 runs) | under $20 |
| Final demo runs and rehearsals | under $10 |

## Risks

| Risk | Found by | Fallback |
|---|---|---|
| No API access from your country, or a model not enabled | Before kickoff | Raise in the event Discord on day 0; there is no engineering fallback, so this check comes first |
| SAM cannot track GUI elements | Day 2 | Spark keyframe labelling (cut 5) |
| Spark computer-use agent cannot finish tasks | Day 5 | Failures are demo material; scripted runs supply the clean runs |
| Rate limits or slow video processing | Day 2 | Keep demo clips two to five minutes; process at 2 fps |
| AT-SPI events missing for Chromium content | Day 6 | Cut 6 |
| Deployment eats day 8 | Day 8 | Local demo, hosted upload recorded (see cut lines) |

## Definition of done

- [ ] Hosted app verifies a fresh upload end to end.
- [ ] Twelve demo runs, including a clean run, a two-violation regression, a noVNC loop with a false completion claim, and a native-mode run.
- [ ] Every Meta model used is named in the README with the reason.
- [ ] Unit tests green for every checker; `pnpm check` green.
- [ ] Demo video recorded; submission sent by 3 PM ET on Nov 4.
