# Hackathon plan

## Event

| Item | Fact |
|---|---|
| Event | Meta Global AI Developer Hackathon, with Cerebral Valley. Virtual. |
| Apply by | **2026-10-25, 11:59 PM ET** (earlier if the 20,000 cap fills; rolling review) |
| Build | 2026-10-26 12:00 PM ET to 2026-11-04 9:00 PM ET |
| Judging | 2026-11-04 to 2026-11-08; live finals and winners 2026-11-09 |
| Track | **Startup** ("technical execution and whether it holds up in production") |
| Theme | **Push the Frontier**, software |
| Pool | $1M cash. Unofficial split: Startup $250k / $150k / $75k / $50k / $25k |
| Rubric (unofficial) | Impact 30 · Use of Meta tooling 25 · Demo 25 · Technical depth 20 |
| Credits | $150 Meta Model API per participant (unofficial); partner credits for select participants |
| Unknowns | Official Rules publish before Oct 26: pre-existing code, open-source requirement, Startup team size. Assume a fresh repo, started after kickoff. |

Event page: https://cerebralvalley.ai/e/meta-ai-developer-hackathon

## Ten-day plan

The day-by-day plan, cut lines, checkpoints and budget live in [build-plan.md](build-plan.md).

## Demo sandbox

- A Docker sandbox on the laptop: Chromium in Xvfb, actions through xdotool, video through ffmpeg, and an AT-SPI listener for native mode.
- A small demo CRM web app inside it.
- A second container running a canvas-only "legacy ERP" screen, reached from the sandbox through noVNC. To the agent and the verifier it is a remote desktop with no DOM.
- Our own computer-use loop drives Spark 1.3 (and Wonder if the API allows). Scripted runs provide clean runs and ground-truth labels.
- Seeded failures: a loop, a record deleted without confirmation, a card number typed, an out-of-scope window, a false completion claim.

## Demo script (3 minutes)

1. A Wonder agent completes a CRM task on screen. Upload the recording and the one-page policy.
2. The policy compiles to rules, read back in plain English. Sign off.
3. The timeline fills with steps and tracked dialogs. Verdict: completed, no violations. Evidence pack.
4. The second run of the same task: completed with two violations. A record deleted without confirmation at 02:14, and text typed into a card field at 03:40, frames side by side. Regression diff against run one.
5. A third run on the noVNC remote desktop, which has no DOM: a loop detected and a completion claim not supported by the screen. Routed to review.
6. The same CRM run in native mode: every step is ground truth from the runtime. Cost drops from about $0.52 to about $0.03.
7. The lineage panel: model, tokens, cost and latency per stage.

A clickable mock of the run-review screen exists as a private artifact: https://claude.ai/artifact/BKgShvKwXYGjGC5x3zb8bv

## Budget

- Verification: under $1 per run in video mode, a few cents in native mode.
- Demo run generation with Wonder: budget about $40.
- Total well inside the $150 credit.

## Submission checklist

- [ ] Working demo, live
- [ ] Demo video (length per Official Rules)
- [ ] Repo with README, setup commands and architecture summary
- [ ] Track selected: Startup
- [ ] Every Meta model used is named, with the reason it is used
