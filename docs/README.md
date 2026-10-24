# BlackboxAI — documentation

BlackboxAI is a flight recorder and verifier for AI agents that operate software through screens. Give it what an agent did, and it returns a step-level verdict with evidence: whether the task was actually completed, where the agent clicked wrong, looped, took a destructive action without confirmation, or touched data it should not have, plus a diff against earlier runs of the same task.

Status as of 2026-10-23: pre-build. Entering the Meta Global AI Developer Hackathon, Startup track. Application due **2026-10-25, 11:59 PM ET**. Build window 2026-10-26 to 2026-11-04.

## Documents

| Doc | What it covers |
|---|---|
| [product.md](product.md) | What it is, who buys it, why now, positioning, moat, risks, non-goals |
| [architecture.md](architecture.md) | Pipeline, typed contracts, the two evidence modes, native runtime, checkers, lineage, stack |
| [meta-stack.md](meta-stack.md) | Meta models used, their real limits, prices and cost per run |
| [research.md](research.md) | Three research rounds, the kill table, finalists, evidence for the pick, outside critique |
| [hackathon.md](hackathon.md) | Event facts, rubric, demo sandbox, demo script, submission checklist |
| [build-plan.md](build-plan.md) | Day-by-day plan to the Nov 4 deadline, scope contract, cut lines, budget, risks |
| [application.md](application.md) | Application answers, ready to paste |
| [validation.md](validation.md) | The gate between a hackathon demo and a company |
| [decisions.md](decisions.md) | Decision log with reasons |
| [../demo/](../demo/README.md) | Demo content: the twelve task specs, the CRM and ERP surfaces, both policies and their expected compilations |

## One-paragraph pitch

Computer-use agents went generally available in 2026, and their reliability compounds badly: 98% per step is roughly 36% over fifty steps. Every agent observability tool today reads text traces through an SDK, and none can see what an agent did on screen or work where there is no DOM, which is where enterprise automation lives. BlackboxAI verifies agent runs from screen video with no SDK, across any vendor, and from ground-truth OS events when the agent runs inside the BlackboxAI runtime. Every verdict ships as an evidence pack an auditor can read.
