# Application answers

Due **2026-10-25, 11:59 PM ET**. The form scores two things equally, from the answers alone: the project idea (clarity, feasibility, theme fit) and a recent AI project you built.

## Project idea

Form question: "What do you want to build for this hackathon?" Length limit not published.

> I'm building BlackboxAI, a flight recorder and verifier for AI agents that operate software through screens.
>
> Computer-use agents went GA this year, but their reliability compounds badly: 98% per step is about 36% over fifty steps. Nobody will let them touch systems of record without evidence of what they did, and today's agent observability tools can't provide it. They read text traces through an SDK, and none works where there is no DOM: Citrix, remote desktops, SAP GUI and native apps, which is where enterprise automation actually runs.
>
> BlackboxAI takes any agent's screen recording, from any vendor, with no SDK, plus the task and a policy document, and returns a step-level verdict with an evidence pack. SAM 3.1 tracks UI elements across the video: the cursor, dialogs, error banners and the controls the policy names. Muse Spark 1.3 turns each chunk into typed step records and compiles the policy PDF into rules it reads back for sign-off. Deterministic checkers catch loops, deletes without confirmation, out-of-scope windows and sensitive-field entry. Spark then judges whether the task was actually completed, with a confidence score and linked frames, and low-confidence runs go to a human review queue. Two runs of the same task produce a regression diff. Agents that run inside the BlackboxAI runtime, an instrumented Ubuntu image, emit typed OS events, so their steps are ground truth instead of inferred.
>
> In ten days I'll ship ingestion, tracking, step narration, the policy compiler, checkers, verdicts, regression, evidence packs and the native runtime. The demo grades Muse Wonder and Spark computer-use runs live, including seeded failures on a DOM-less remote desktop.

Short version, if the field truncates:

> BlackboxAI is a flight recorder and verifier for AI agents that operate software through screens. Give it any agent's screen recording, from any vendor, with no SDK, plus the task and a policy, and it returns a step-level verdict with evidence: whether the task was really completed, and where the agent looped, deleted without confirmation or touched sensitive fields. SAM 3.1 tracks UI elements across the video, Muse Spark 1.3 turns steps and the policy into typed records, deterministic checkers decide rule outcomes, and low-confidence runs go to human review. Inside the BlackboxAI runtime, an instrumented Ubuntu image, steps come from OS events as ground truth. The demo grades Meta's own computer-use agents live.

## A recent AI project you built

Form question: "Tell us about an AI project you recently built that showcases your technical skills." Source of every fact: the Holdout repo (`~/dev/OpenAIBuildWeekJuly2026/holdout`): README, docs/methodology.md, docs/beta-readiness.md and docs/releases/2026-07-16-openai-production-verification-v2.md. 61 commits from 2026-07-13 to 2026-10-19.

> Holdout (holdouthq.com) is my current venture, started at OpenAI Build Week in July and built solo since. It answers the question AI-visibility dashboards skip: did a brand's standing in ChatGPT, Claude, Gemini or Perplexity actually move, or did the model?
>
> Each study freezes a frame: provider, model, retrieval tool, prompts, control brands and scorer version. A run sends six unbranded shopper prompts, twice each, through each provider's own web-search API: OpenAI Responses web search, Anthropic web search, Gemini Search grounding and Perplexity Sonar. Brand names never enter a prompt, because naming them would prime the visibility being measured. Versioned TypeScript rules grade mentions, rank and recommendation cues locally afterwards. Deterministic code, not a model, computes raw movement minus control-panel movement, a seeded bootstrap interval over prompt clusters, and the verdict, which is allowed to be Inconclusive or Not comparable. A model change starts a new epoch instead of extending a trend line. Every result exports as a hashed passport holding every raw answer, citation, token count and attempt, and a recompute endpoint rebuilds the number from stored evidence.
>
> Under it: Next.js on Vercel with durable workflows, Drizzle on Neon with forced row-level security and separate owner and runtime roles, Better Auth, per-run token reservations against a daily ceiling that settle fail-closed, sealed release configuration, and a verification driver that stands up a throwaway Vercel and Neon environment for every release candidate.
>
> Live runs taught me the most. Two runs on gpt-5.6-sol passed 24 of 24 cells with provider-native web evidence (824,626 tokens, 82 searches), a passport recompute, and 21 of 21 cross-tenant isolation checks. They also exposed real defects: answers stochastically truncated at an 1,800-token output ceiling, a 45-second timeout that failed whole runs on Production's slow tail, and transient errors hidden behind an opaque failure code, which I replaced with a tested failure classifier. A production baseline and candidate pair has not completed yet, and the product says so rather than show a number it cannot back.
>
> I also recently built Arc Engine (arc-engine11.vercel.app), an agentic supervisor that critiques Veo-generated video with Gemini before approving it, and Osmundus (osmundus.com), a deterministic OpenAPI-to-SDK generator. BlackboxAI applies Holdout's discipline to agents: evidence first, and a verdict only as strong as that evidence.

Why Holdout leads (founder's call, 2026-10-23): it is the ongoing venture, not a hackathon-only build. Accuracy notes: the 24/24 pass and token figures are from disposable Preview verification, not Production; the Production pair is deferred, as the answer states. The earlier Arc Engine answer was replaced; its facts are in `~/dev/arc-engine/docs/BUILD_PLAN.md`.

## Survey: "How likely are you to build with Meta Model API?"

Answer **Very likely**. The survey is not used for selection, and the whole build runs on it: SAM 3.1, Muse Spark 1.3, and Muse Wonder if enabled. See [build-plan.md](build-plan.md).

## Notes

- The survey questions at the end are not used for selection.
- The final data-policy question also opts you into Meta marketing email. Your call.
- Apply early: review is rolling and the cap is 20,000.
