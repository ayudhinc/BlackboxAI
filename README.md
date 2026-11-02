# BlackboxAI

A flight recorder and verifier for AI agents that operate software through screens. Give it what an agent did (a screen recording from any vendor, no SDK, or typed runtime events from our sandbox) plus the task and a policy, and it returns a step-level verdict with evidence: whether the task was really completed, where the agent looped, deleted without confirmation or typed into a field it should not have, a diff against earlier runs of the same task, and an evidence pack an auditor can read.

Built for the Meta Global AI Developer Hackathon (Indie Developer track, Push the Frontier). Design and decisions: [docs/](docs/README.md). Demo content: [demo/](demo/README.md).

## Meta models, and why each is used

| Model | Where | Why |
|---|---|---|
| `sam-3.1` | Tracking (video mode) | Open-vocabulary tracking in screen video with no SDK on the agent's side. Measured on GUI video: it tracks `cursor` (47 of 63 frames; all misses were the text I-beam) and `button` (pixel-exact boxes; a dialog's buttons appear on exactly the frames the dialog is open). It does not find "modal dialog" or "error banner" as concepts, so those come from narration. See [decisions](docs/decisions.md). |
| `muse-spark-1.3` | Narration, policy compiler, verdict, our computer-use agent | Structured output over keyframes turns pixels into typed steps; it reads a policy PDF into typed rules with verbatim source quotes and asks a question instead of inventing a number; it judges completion from the final frames; and it drives our computer-use loop. Measured quirk: Spark points on a 0–1000 grid, not in pixels. |
| `muse-wonder-1.0` | Optional agent model | Enabled for the key and selectable in `pnpm agent-run --model`. |

`-contributor` variants are refused in code (`assertAllowedModel`); they train on what they are sent.

## What happens to a recording

1. **Ingest** (ffmpeg): 2 fps frames, keyframes by changed pixels, screen identities, ten-minute chunks.
2. **Track** (`sam-3.1`): cursor and button tracks per chunk.
3. **Narrate** (`muse-spark-1.3`): keyframes plus tracks become typed `Step`s, sensitive numbers redacted before storage. Native runs skip 2–3: steps come from AT-SPI and input events at confidence 1.
4. **Check** (pure functions, unit-tested): loop, confirm-before-destroy, app allowlist, sensitive-field ban, max duration. They refuse to run against a policy that is not signed off.
5. **Verdict** (`muse-spark-1.3`): completed or not, with confidence and cited frames. Below 0.80, or with any finding a person must check, the run goes to the review queue.
6. **Regress** and **deliver**: a diff against the previous run of the task, and an evidence pack (canonical JSON sealed with sha256, plus printable HTML).

Every model call writes a lineage row: model, prompt hash, tokens or frames, cost, latency, attempt, error.

## Measured so far

Fifteen demo runs verified end to end: 12 scripted runs match their specs exactly, including a two-violation regression, a loop and false claim on a remote desktop with no DOM, and native-mode runs. The two real Spark agent runs get correct verdicts. Narration against the scripted runs' own step logs: recall 0.79, precision 0.74 over 120 steps (CRM 0.91–1.00 recall; keyboard-only steps on the canvas ERP 0.33–0.56, which is the case for native mode). Video mode cannot count clicks that change nothing on screen; native mode can. Every result and miss: [docs/decisions.md](docs/decisions.md). API spend for the whole build so far: $9.57.

## Run it locally

Requirements: Node 24, pnpm 11, Docker (OrbStack works), ffmpeg, a Meta Model API key.

```sh
pnpm install
cp .env.example .env            # then put your MODEL_API_KEY in .env yourself
pnpm db:up && pnpm db:migrate   # Postgres on 127.0.0.1:5476
pnpm check                      # lint, typecheck, unit tests (no billed calls)

pnpm dev:web                    # http://127.0.0.1:3500
pnpm dev:worker                 # health on 127.0.0.1:3502
```

Compile and sign off a policy, then verify a recording from the command line:

```sh
pnpm policy compile demo/policies/crm-policy.md
pnpm policy sign-off <policyId> "Your Name"
pnpm verify path/to/recording.mp4 --task "What the agent was asked to do" --policy <policyId>
```

Recreate the demo runs:

```sh
docker build -t blackbox-sandbox:dev sandbox
sandbox/record-demo.sh D01 D02 D03 D04 D05 D06 D07 D08 D09 D10 D11 D12   # scripted runs
pnpm agent-run A01 --task "..."                                          # a real Spark computer-use agent
pnpm seed-demo <crmPolicyId> D01 D02 ...                                 # queue them for the worker
pnpm eval-narration                                                      # score narration against ground truth
```

Ports are registered in `~/dev/ports.md`: web 3500, Playwright 3501, worker health 3502, noVNC 3505, remote VNC 3506, Postgres 5476.

## Honest limits

- Scripted runs are labelled `blackbox/scripted@…` everywhere; they are never presented as an agent's behaviour. Agent runs are labelled with the Meta model that drove them.
- Video-mode steps are a model's inference and carry confidence; the completion verdict is a model's judgement and is labelled so. Rule findings come from deterministic checkers.
- The sensitive-field rule matches field labels, not contents.
- Native mode captures clicks (resolved to widgets by AT-SPI hit test), typing into page fields, navigation and dialogs. It does not capture key presses, native `<select>` picks or the agent's claim; native verdicts read the claim from the video.
- Cut for time, in the plan's order: Slack and webhook delivery, the evidence pack PDF (printable HTML ships), the regression panel's chart (the JSON diff and summary ship).

## Repository rules

- Commit messages carry no AI or tool attribution; `.githooks/commit-msg` rejects it. `pnpm install` wires the hook.
- Author commits as `dushyantk@gmail.com`.
