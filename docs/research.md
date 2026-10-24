# Research

How BlackboxAI was chosen. Conducted 2026-10-23 across three rounds. Figures come from the cited sources and from aggregator profiles where noted; treat third-party funding numbers as approximate.

## Method

1. **Round one.** Read the event, its rubric and Meta's actual stack.
2. **Round two.** Four deep passes on video-first ideas (physical-AI data, robot-fleet observability, amateur sports, phone-video inspection) plus five kill-checks.
3. **Round three.** Applied a **sensor-fidelity filter first**: only controlled capture (screens, fixed or instrument cameras, game renders) or non-visual input (audio, documents). Five deep passes.

The filter came from a firsthand failure: rental move-out evidence looked like a strong gap until it was clear that nail holes and paint defects do not show on phone video.

## Kill table

| Space | Verdict | Decisive evidence |
|---|---|---|
| Video rule layer and safety analytics | Crowded | Intenseye $90M+, Voxel $44M B, Protex $36M B, Coram $35M B with plain-English alerts, Groundlight, Roboflow Workflows |
| Field-service in-field capture | Crowded | XOi, Kebra (YC S26), ServiceTitan Field Pro |
| Robot-fleet observability | Funded twice this quarter, small market | Alloy Robotics $8M seed (Aug 2026), Foxglove $40M B; fleet ops ≈0.5% of physical-AI funding |
| Physical-AI data annotation | A feature | Hugging Face `lerobot-annotate` is free; Encord $60M C; collectors build QC in-house |
| Amateur sports video | Consumer ceiling, identity wall | SwingVision ~20k payers after 8 years; Hudl buys phone winners; player identity 0.46–0.59 in a Sept 2026 study |
| Used-car, construction, insurance inspection | Owned | UVeye $380M; CompanyCam ~$2B; Verisk XactGen |
| Rental move-out evidence | Sensor fails | Wall holes and paint defects are invisible on phone video |
| Legal bodycam review | Niche, taken | JusticeText |
| Indian-language call QA | Owned | Uniphore $2.5B, Observe.ai $213M, Credgenics in 160 lenders |
| Video-to-SOP | Feature market | Dozuki, SOPX, Guidde $50M B |
| Drone inspection | Hardware-coupled | Raptor Maps, Sitemark, Percepto |
| Lab-bench video docs | Thin spend | Benchling would absorb it |
| Gameplay coaching, game QA, clipping, esports data | No category exit above $100M | Mobalytics sub-scale exit; Athenascope and Powder dead; GRID holds rights |
| Task mining | Quote-only $100k deals; Skan already does vision | Celonis, Mimica $26M B, Skan |
| Recording-based software QA | Knife fight | Meticulous $15M A, Momentic $15M A; AskUI and Tricentis own DOM-less |
| Screen training content | Closed | Scribe $1.3B, Guidde $50M B |
| Classroom audio | Acquired, budgets shrink | TeachFX acquired by McGraw Hill (Sept 2026) |
| Public proceedings | Price floor ~$360/yr | Granicus, eScribe AI Minutes |
| Public-safety audio | Owned | Axon bought Prepared and Carbyne |
| Research interviews | Closed | Listen Labs $500M, Dovetail |
| Surgical video | Three fresh entrants | Theator with Oracle, Uncovr $7M, XRlabs $8.4M, Medtronic |
| Microscopy | Free tools win | Cellpose-SAM, Agentic-J |
| SEM and wafer review | NDA-gated | KLA, Applied, Hitachi |
| Livestock and aquaculture cameras | No public data, slow buyers | Halter $2B, Aquabyte sold to PE |
| Solar and grid paperwork | Declining market, the portal is the bottleneck | Nira, Pearl Street acquired |
| Code compliance for drawings | $616M of AEC-AI money in H1 2026 | PermitFlow $54M B, LightTable $22M A, Structured AI, Procore agents |
| Manufacturing quoting and DFM | Shipped in 2026 | CADDi $1.2B, Paperless Parts, Xometry |
| VFX tools | Not the lane | Founder decision |

## Finalists

Scores out of 10: market / incumbent weakness / Meta-stack fit / 10-day demo.

| Product | Scores | Why it lost or won |
|---|---|---|
| **Agent flight recorder and verifier** | 8 / 7 / 9 / 7 | **Picked.** Largest wave, incumbents blind to the screen, best Meta fit, demo needs no customer |
| Datasheet-grounded schematic review and BOM risk | 8 / 7 / 9 / 8 | Runner-up. Cleanest demo; weaker Meta-specific fit; Flux or Diode could add import-and-review |
| Digital-reporting cockpit for the legal record | 8 / 8 / 7 / 8 | Services market; pending California Supreme Court case on electronic recording; 60-min realtime socket vs 4–7 h depositions |
| Home-cage vivarium monitoring | 5 / 8 / 8 / 8 | Weakest incumbents, small market |

## Evidence for the pick

**Spend and momentum**

- Coralogix raised $200M at $1.6B on monitoring AI agents (June 2026): https://techcrunch.com/2026/06/03/coralogix-raises-200m-in-race-to-build-the-monitoring-layer-for-ai-agents/
- Braintrust raised $80M at $800M (Feb 2026): https://www.axios.com/pro/enterprise-software-deals/2026/02/17/ai-observability-braintrust-80-million-800-million
- Only 38% of organisations monitor AI traffic end to end: https://www.kiteworks.com/cybersecurity-risk-management/ai-agent-identity-audit-gaps/

**Incumbents consolidating into log pipelines**

- Langfuse acquired by ClickHouse (Jan 2026): https://clickhouse.com/ar/blog/clickhouse-acquires-langfuse-open-source-llm-observability
- Galileo acquired by Cisco (Apr 2026): https://blogs.cisco.com/news/Cisco-announces-the-intent-to-acquire-galileo
- Arize $70M C: https://arize.com/blog/arize-ai-raises-70m-series-c-to-build-the-gold-standard-for-ai-evaluation-observability/

**Closest screen-native players**

- Laminar, $3M seed, browser-only, SDK-required: https://tech.eu/2026/03/17/agent-debugging-startup-laminar-raises-3m-seed-to-tackle-the-observability-gap-in-ai-agents/
- Browserbase $40M B at $300M: https://www.sourcery.vc/p/breaking-browserbase-raises-40m-series
- Halluminate $30M A, sells to labs, not enterprise: https://fortune.com/2026/10/01/halluminate-raises-30-million-series-a-oakhc-ft/

**The agent wave**

- Copilot Studio computer-use agents GA: https://www.digitalapplied.com/blog/copilot-studio-computer-use-agents-ga-deep-dive
- OSWorld-Verified under 15% to 72.5% in about fifteen months: https://deck.co/blog/state-of-computer-use-agents-2026
- Reliability compounding (illustrative): https://contracollective.com/blog/computer-use-agents-production-reliability-cost-2026

**Why DOM-less matters**

- Accessibility trees omit privately drawn controls: https://arxiv.org/pdf/2509.15221
- DOM misses canvas and custom widgets: https://arxiv.org/pdf/2603.24440
- Pure-vision grounding is weak for live control (6.9% vs 31.9% on ScreenSpot-macOS), which is why BlackboxAI verifies after the fact rather than grounding live: https://arxiv.org/html/2507.16704v1

**Regulation**

- EU AI Act high-risk logging moved to 2 Dec 2027: https://labs.cloudsecurityalliance.org/research/csa-research-note-eu-ai-act-high-risk-deadline-omnibus-20260/

## Outside critique, resolved

A GPT analysis proposed four ideas. Resolution:

- **Agentic B2B procurement network (TradeMesh).** Funded and distribution-bound. Didero raised a $30M Series A in Feb 2026 with M12 (https://techcrunch.com/2026/02/12/didero-lands-30m-to-put-manufacturing-procurement-on-agentic-autopilot/); Conexiom and Buyer24 exist. Its hard part is onboarding thousands of SMB suppliers, the weakest lever a solo founder has.
- **EU product-passport evidence (ProductProof).** A real forcing function (battery passport mandatory 18 Feb 2027) with incumbents: osapiens, Minespider, Circuland, Spherity, Circularise.
- **Agent outcome verification (OutcomeOS).** This is BlackboxAI. GPT demoted it citing Cruxial (open-source tool-call receipts, https://cruxial.ai/) and Arcade (tool auth). Both work at the API layer and cannot see the screen or DOM-less surfaces.
- **Industrial part search (PartExchange).** Partium already does it; partly fails the sensor filter.

Kept from the critique: the validation gate in [validation.md](validation.md), and the urgency to apply by the deadline.

## Agent-OS thesis, resolved

Idea: fork Ubuntu into an agent-friendly OS so agents see structured state instead of screenshots.

- **The insight is right.** Every platform owner agrees: Apple App Intents (WWDC 2026), Android AppFunctions and Computer Control API, structured actions in Windows.
- **The fork is the wrong first move.** The value sits at the app and runtime layer, not the distribution. Enterprise buyers are on Windows, Citrix and the web. The seam is being claimed by Tilo (YC 2026), Scrapybara, E2B Desktop, Kernel and Orgo.
- **Adopted form.** The Docker pattern: an instrumented Ubuntu runtime plus an evidence format. It becomes BlackboxAI's native mode, and it removes the SAM risk from the critical path.
