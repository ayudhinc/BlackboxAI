# Submission draft

Answers for the form at https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit, ready to paste. The rating and preference questions near the end are Dushyant's own and are left blank.

## Fixed fields

| Field | Answer |
|---|---|
| Team name | BlackboxAI |
| Track | Indie Developer Track |
| Problem statement | Push the Frontier |
| Most Viral Track (X post) | — |
| Public GitHub repository | https://github.com/ayudhinc/BlackboxAI (must be public before submitting) |
| 3-minute demo video | https://youtu.be/50b9BtOO03s (unlisted, 2:58, English captions uploaded from `blackboxai-demo.srt`). The first upload, which showed the card number in the D02 task heading, is set to private. |

## Project description

BlackboxAI is a flight recorder and verifier for AI agents that operate software through the screen. Agents now click through CRMs, ERPs and remote desktops on our behalf, and when one reports "done" nobody can tell whether the work was really done or whether it broke a rule on the way.

Give BlackboxAI a screen recording of an agent's session (any vendor, no SDK), the task the agent was given and an operating policy. It returns a step-by-step account of what the agent did, a verdict on whether the task was actually completed, the rules it broke with the frames that prove each one, a diff against earlier runs of the same task, and a sealed evidence pack an auditor can read.

The policy is a plain document. Muse Spark compiles it into typed rules, each with the exact line it came from, and nothing is checked until a person reads the rules back and signs them off. The rule checks themselves are deterministic and unit-tested; only perception and the completion judgement come from models, and they are labelled as such. Runs the system is unsure about go to a review queue instead of being passed.

It works where there is no DOM at all: on a legacy finance app reached over a remote desktop, it caught an agent pressing Post four times after a rejection and then claiming the invoice was posted. In our own sandbox it also records the app's accessibility events, so every step becomes a fact rather than a guess, at about a tenth of the cost.

Measured on 15 demo runs: the 12 scripted runs match their specs exactly, and two real Muse Spark computer-use runs get correct verdicts. Narration recall is 0.79 and precision 0.74 over 120 ground-truth steps. Verification costs about $0.10 per short video run and about $0.01 in native mode. Live at https://blackboxai-ayudh-incs-projects.vercel.app (sign-in required).

## Describe your use of Meta products to build the submitted project

- **SAM 3.1** (Meta Model API, Responses API with `input_video`): tracks the cursor and buttons through each recording chunk. Measured on GUI video before committing to it: it found the cursor on 47 of 63 frames and returned pixel-exact button boxes. Dialog buttons appear on exactly the frames the dialog is open, which lets the confirm-before-destroy rule see dialogs without a DOM.
- **Muse Spark 1.3**, in four roles:
  - Narration: keyframes and SAM tracks become typed steps (action, target, what changed, confidence) through strict structured output.
  - Policy compiler: reads a policy document into typed rules with verbatim source quotes, and asks a question instead of inventing a value.
  - Verdict: judges from the final frames whether the task was completed and whether the agent's claim matches the screen, citing frames.
  - Our own computer-use agent loop, which produced the real agent runs in the demo.
- **Muse Wonder 1.0**: wired in as a selectable model for the agent loop.

Every model call writes a lineage row (model, prompt hash, tokens or frames, cost, latency, attempt, error), shown per run in the app. `-contributor` model variants are refused in code.

## Why are Meta's models important to your solution?

The product's core promise is "any agent, any vendor, no SDK", so everything has to come from pixels. SAM 3.1 is what makes that tractable: open-vocabulary tracking in screen video gives us grounded positions for the cursor and buttons, so a rule like "a destructive click must be followed by a confirmation dialog" can be checked on a canvas app with no DOM. Muse Spark's strict structured output turns those frames into typed steps and typed rules that deterministic code can check, which is what keeps the verdicts auditable rather than one model's opinion. The same model family also drives the agents we test, so the demo verifies Meta-model agents with Meta models end to end.

## What was the biggest obstacle your team hit while building this project?

Getting reliable structure out of the models on GUI video. SAM does not recognise "modal dialog" or "error banner" as concepts, so we narrowed it to cursor and buttons and moved dialog and banner detection into narration. Spark returns coordinates on a 0–1000 grid rather than in pixels, the agent route only supports `tool_choice: "auto"`, and numbers sometimes come back as strings, so the agent loop needed a normalisation layer. Video also cannot count clicks that change nothing on screen, which is why native mode exists.

## Left for Dushyant

- Provide feedback from your experience using partner technologies. (No partner platforms were used.)
- How likely are you to build with Meta Model API?
- How likely are you to recommend the Meta Model API to another developer or engineering team?
- How likely are you to recommend Muse Code to another developer or engineering team?
- Compared with other AI models your team has used for the same kind of work, how did Meta's models perform?
- When your team chooses an AI model or coding tool, what matters most?
- What makes it hardest for your team to switch to a different AI model or coding tool?
- If your team took this project to production, what would most likely stop you from using Meta's models?
