# Product

## One line

A flight recorder for AI agents that operate software: feed it what an agent did, get a step-by-step verdict with proof.

## The problem

- Computer-use agents from Microsoft (Copilot Studio, GA), Anthropic (paid beta), Google (preview) and Meta (Muse Spark and Muse Wonder computer use) now click and type inside real applications.
- Reliability compounds: 98% per step is about 36% success over fifty steps. Benchmark success on OSWorld-Verified went from under 15% to 72.5% in about fifteen months, so run volume is about to rise sharply.
- Nobody lets an agent touch a system of record without an evidence trail, and the current tools cannot produce one for screen-driven work:
  - Agent observability (Braintrust, Arize, LangSmith, Langfuse) is text traces through an SDK.
  - The one screen-native tool (Laminar) is browser-only and needs an SDK.
  - None works on Citrix, RDP, SAP GUI or native desktop apps, where there is no DOM.
- Only 38% of organisations monitor AI traffic end to end. EU AI Act high-risk logging obligations land 2 December 2027.

## What it does

**Inputs**

- What the agent did: a screen recording (MP4), or the native runtime's event stream plus video.
- The task spec in plain text.
- An optional policy document (PDF): allowed apps, forbidden actions, confirmation rules, sensitive data classes.
- An optional agent action log (JSON) when the vendor exposes one.
- A second run of the same task, for regression.

**Outputs**

- A typed step timeline: time, app, action, target, observed state after.
- Policy rules compiled from the PDF, read back in plain English for sign-off.
- Deterministic check results: loops, destructive action without confirmation, out-of-scope window, sensitive-field entry, duration and step anomalies.
- A completion verdict with confidence, rationale and linked frames. Below threshold, it goes to a human review queue.
- A regression diff against earlier runs of the same task.
- An evidence pack (JSON and PDF) with full lineage: model, prompt hash, tokens, cost, latency, reviewer.

## Two evidence modes

| Mode | Source | Where it works | Trust level |
|---|---|---|---|
| **Video** | Screen recording, tracked with SAM 3.1, narrated by Muse Spark | Anywhere: any vendor, any surface, no SDK | Inferred, with confidence |
| **Native** | Typed OS events from the instrumented BlackboxAI runtime (Ubuntu) | Agents that run inside the runtime | Ground truth |

The pitch: verifiable everywhere, perfect inside our runtime.

## Who buys

First ten targets, in order of reachability:

1. Teams adopting Copilot Studio computer-use agents.
2. UiPath and SAP shops running agents over Citrix or remote desktops.
3. Legacy-automation vendors building on computer use.
4. QA vendors that need to review agent test runs.
5. AI labs and eval teams grading agent trajectories.
6. Fintech and insurance operations teams that already record screens for compliance.

The economic buyer is the head of automation or the risk and compliance lead. The user is the automation engineer who reviews failed runs.

## Why now

- Computer-use agents crossed from demo to GA this year.
- Agent-observability money is real: Coralogix raised $200M at $1.6B (June 2026) on monitoring agents; Braintrust raised $80M at $800M (February 2026).
- Incumbents are consolidating into log pipelines: Langfuse was acquired by ClickHouse (January 2026), Galileo by Cisco (April 2026). Nobody is moving toward the screen.
- SAM 3.1 made open-vocabulary video tracking an API call at $0.20 per 1,000 frames, which makes vendor-neutral, SDK-less verification economically viable for the first time.

## Positioning

- **Not monitoring.** It does not watch agents live. It produces evidence after each run.
- **Not trace observability.** It does not need the agent's SDK, and it covers surfaces with no DOM.
- **Not RPA or an agent.** It never acts. It verifies.
- **Vendor-neutral.** It grades any agent, including Meta's own.

## Competition

| Player | What it does | Why it is not this |
|---|---|---|
| Braintrust, Arize, LangSmith, Langfuse (ClickHouse), Galileo (Cisco) | Text traces, evals | SDK-required, no screen evidence |
| Laminar ($3M seed, March 2026) | Browser session recording synced to traces | Browser-only, SDK-required |
| Browserbase ($300M valuation), Browser Use | Agent browser infrastructure, replay | Infrastructure feature, not a verifier |
| Halluminate ($30M A, October 2026) | Benchmarks and RL environments for labs | Sells to labs, explicitly not enterprise |
| Cruxial | Open-source receipts for agent tool calls | API layer, cannot see the screen |
| Tilo (YC 2026), Scrapybara, E2B Desktop, Kernel, Orgo | Linux desktops or VMs for agents | Environment, no verification or evidence story |

## Moat and the path to a large company

- **Year one:** vendor neutrality, SDK-less ingestion, DOM-less surfaces, and an evidence format compliance teams adopt by name.
- **Year two:** the native runtime: per-agent identity, OS-level permission enforcement, a typed event stream, deterministic replay, signed run records. This follows the Docker pattern: a runtime plus a format, not a forked distribution.
- **End state:** the audit and assurance layer for agentic automation.

## Risks

- **SAM 3.1 on GUI video is unproven.** No published evaluation exists. A day-one test with twenty recordings decides tracking versus the fallback of Spark keyframe reasoning.
- **A model judging a model.** Deterministic checkers carry the trust. The Spark verdict is labelled as such, carries confidence, and routes to review below threshold.
- **Platform risk.** UiPath, Microsoft, Anthropic or the trace vendors could add screen verification. Neutrality and DOM-less coverage are the defence.
- **Early buyers are few.** Those running computer-use agents in production exist and are reachable, but the market is young.
- **A standard needs a sponsor.** An evidence format only wins with a large backer or open-source adoption.

## Non-goals for v0

- Live, in-flight intervention.
- Acting on behalf of the agent.
- Mobile apps.
- A forked operating system.
- Claims of accuracy that have not been measured on real recordings.
