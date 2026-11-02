# Decision log

Newest last. Each entry states the decision, the reason, and what would reverse it.

## 2026-10-23 — Domain-agnostic product search, no VFX default

- **Decision.** Choose the product market-first. The founder's VFX background is credibility, not the lane.
- **Reason.** A first pass anchored on VFX dailies and was rejected as the wrong ambition.
- **Reverses if.** The founder asks for a VFX product explicitly.

## 2026-10-23 — Sensor fidelity before market

- **Decision.** Any camera-based idea must first pass a test: can the capture actually see the thing that matters?
- **Reason.** Rental move-out evidence passed the market test and failed the sensor test. Nail holes and paint defects do not show on phone video.
- **Reverses if.** Never. It is a standing filter.

## 2026-10-23 — Build the agent flight recorder and verifier

- **Decision.** Build BlackboxAI over the schematic-review and legal-record finalists.
- **Reason.** Largest current wave, incumbents blind to the screen, strongest Meta-stack fit, a demo that needs no customer. See [research.md](research.md).
- **Reverses if.** The validation gate fails, or SAM and Spark both prove too noisy for step verdicts on real recordings.

## 2026-10-23 — Reject the procurement-network and product-passport alternatives

- **Decision.** Do not pursue an agentic B2B procurement network or an EU product-passport tool.
- **Reason.** Procurement is funded (Didero $30M A) and bound by SMB supplier distribution. Passports have incumbents. Both make weak hackathon entries on Meta-specific tooling.
- **Reverses if.** Interviews show a buyer pulling hard for either.

## 2026-10-23 — Runtime, not an OS fork

- **Decision.** Do not fork Ubuntu. Ship an instrumented Ubuntu runtime that emits typed events, as BlackboxAI's native mode.
- **Reason.** The value is at the app and runtime layer; enterprise buyers are on Windows, Citrix and web; the Docker precedent is runtime plus format. Native mode also removes the SAM risk from the critical path.
- **Reverses if.** A sponsor or a design partner needs an agent-grade distribution, and the runtime has real adoption.

## 2026-10-23 — Startup track, Push the Frontier theme

- **Decision.** Enter the Startup track under Push the Frontier, software.
- **Reason.** The judging lens is production robustness, which the architecture targets, and the top prize is larger.
- **Reverses if.** The Official Rules require incorporation documents or team terms that do not fit.
- **Superseded 2026-10-23.** The application was submitted on the Indie Developer track. See the entry below.

## 2026-10-23 — Name: BlackboxAI

- **Decision.** The working name is BlackboxAI.
- **Reason.** Founder's choice. It names the flight-recorder function directly.
- **Open risk.** An existing AI coding-assistant company already trades as BLACKBOX.AI at blackbox.ai, with a large user base. Expect confusion in search and app stores, a likely trademark conflict, and no access to the obvious domain. Trademark and domain status are unchecked.
- **Reverses if.** A trademark search or legal advice shows a conflict, or the name confuses buyers in interviews.

## 2026-10-23 — Sandbox base image: Playwright's Ubuntu 24.04 image, not stock Ubuntu Chromium

- **Decision.** Build the sandbox and native runtime on `mcr.microsoft.com/playwright:v1.64.1-noble`, adding Xvfb, xdotool, ffmpeg, x11vnc, noVNC and AT-SPI packages from Ubuntu's apt.
- **Reason.** On Ubuntu 24.04, `chromium-browser` only installs the snap, and snaps don't run in Docker. Google Chrome has no Linux arm64 build. The Playwright image is still Ubuntu 24.04 and ships an arm64 Chromium. A pre-kickoff probe showed it recording under Xvfb and showing web content over AT-SPI (build plan, "Before kickoff"). The runtime stays an instrumented Ubuntu image, as the runtime decision above says.
- **Reverses if.** AT-SPI events from Chrome for Testing prove unusable on day 6. Then try Debian's `chromium` package (`debian:bookworm-slim` is pulled for this) before taking cut 6.

## 2026-10-23 — Track: Indie Developer, as applied

- **Decision.** Enter the Indie Developer track under Push the Frontier, software. This replaces the Startup-track entry above.
- **Reason.** The founder submitted the application on the Indie Developer track. The Official Rules allow one track per participant and enter a project in one track only, so the docs follow the application. The Startup-track entry was written without checking the submitted form.
- **Effect on the build.** None on scope: both tracks are scored on the same rubric (Impact 30, Meta AI tooling 25, Demo 25, Technical depth and execution 20). The pitch leads with technical ambition: SAM 3.1 on GUI video, verifying a remote desktop with no DOM, and native-runtime ground truth. Production qualities serve as proof that it works.
- **Reverses if.** The organisers move the entry to the Startup track at the founder's request.

## 2026-10-23 — Start the build before kickoff

- **Decision.** Build starts on 2026-10-23, three days before the 2026-10-26 kickoff, on the founder's instruction.
- **Reason.** The Official Rules, as read on 2026-10-23, don't restrict code written before the event. They require "original work product", solely owned, and they allow open source used under its licence. This is the founder's call; the build plan had defaulted to waiting.
- **Open risk.** The event page still says the rules "will be published before the Hackathon begins". If a fuller version bans pre-existing code, we may need to start a fresh repo at kickoff or disclose the early start. The git history records the start dates exactly.
- **Reverses if.** Rules published before kickoff forbid work done before it.

## 2026-11-01 — SAM 3.1 go/no-go: go, narrowed to cursor and buttons

- **Decision.** SAM tracks `cursor` and `button` in video mode. Dialogs and error banners come from Spark's per-keyframe labels, plus one deterministic signal: a new button track appearing over existing ones. This is cut 5 taken in part: SAM stays, and it no longer tracks dialogs or banners.
- **Measured.** One sandbox clip, 31.5 s re-encoded to 2 fps (63 frames, 1280×800), compared against frame-level ground truth taken from the clip's pixels and the script's timing:
  - `cursor`: found on 47 of 63 frames. The 16 misses are frames 3–18, exactly the stretch where the pointer is a text I-beam over input fields. Boxes land on each click target; 5 of 5 checked.
  - `button`: 5 objects with pixel-exact boxes. Save is reported as [340, 418, 460, 462] against CSS left 340, top 418, 120×44. The dialog's two buttons appear on exactly the 14 frames the dialog is open (14/14, no false positives). The toast is also found, as a "button".
  - `modal dialog`, `dialog box`, `popup window`: 0 boxes over the 14 dialog frames. `error banner`, `red text`: 0 boxes over the 28 banner frames. `text field`: 0 boxes, though two inputs are visible on every frame.
  - `pink rectangle`: matches the banner on 28 of 28 frames with no false positives. It is a colour phrase fitted to this page, so it is not used.
  - Billing: `video_frames_processed` equalled the clip's 63 frames. Nine SAM calls cost $0.113 in total.
- **Not done.** The plan's 20-run go/no-go. This rests on one clip, and the numbers should be re-measured on the demo CRM runs.
- **Reverses if.** Cursor or button recall falls well below these numbers on the CRM runs. Then take cut 5 in full.

## 2026-11-01 — Schedule: build days 2–6 slipped; take cuts 1, 2, 3 and 6

- **Situation.** Day 1 was built on 2026-10-23. The day-1 check then waited on Meta API billing until the credits arrived on 2026-11-01, which is plan day 7. That leaves today, Nov 2 (feature freeze), Nov 3 and the morning of Nov 4. Checkpoint A (day 4) and Checkpoint B (day 6) are both missed.
- **Cuts taken now, per the checkpoint table.**
  1. Slack and webhook delivery.
  2. Evidence pack PDF. The printable HTML stays.
  3. Regression panel. The JSON diff stays.
  6. Native runtime: input and window events only, labelled "partial runtime events". AT-SPI gets a one-hour timebox, and is in only if it works within it.
  - The noVNC session falls back to the canvas ERP opened directly in Chromium if noVNC isn't working by Nov 2.
  - The UI shrinks to upload, the runs list, the run review page with approve and reject, and the review queue.
- **Never cut.** Deterministic checkers, verdicts with linked frames, the review queue, hosted upload of any recording, lineage on every model call.
- **Watch.** Cut 4 (Wonder runs) is next if the agent runner isn't working by the end of Nov 2.
