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

## 2026-11-01 — Native runtime: AT-SPI events in, inside the timebox; cut 6 taken only for keys, option picks and claims

- **Decision.** Native mode ships the AT-SPI listener. Each XInput2 pointer press is resolved to a widget by an AT-SPI hit test. Text entry counts only in focused fields inside the page. Page loads become window events, and focus moving into a dialog becomes `dialog.open`. Key presses, native `<select>` option picks and the agent's claim are not captured. In native runs the verdict reads the claim from the video. Every evidence pack states this.
- **What it took.** Chromium emits AT-SPI events only when the accessibility bus reports `IsEnabled` and `ScreenReaderEnabled`; the entrypoint now sets both. Before that fix, no events arrived at all.
- **Measured on D03** (7 scripted steps): 5 observed with their exact accessible names: the search typing, link 'Dana Whitfeld', button 'Merge into…' followed by `dialog.open` 'Merge Dana Whitfeld into…', and button 'Merge'. Missed: the Enter key and the combo-box option. **D08**: the search, link 'Priya Raman', typing into 'Notes', typing into 'Tax ID (SSN)', and button 'Save', all observed. The run's data-class finding therefore rests on a runtime event, not an inference.
- **Reverses if.** A later build captures key events and the console claim, which would restore full runtime events.

## 2026-11-01 — Our computer-use loop on Spark 1.3, and what the first real runs showed

- **Decision.** The agent runner is ours: screenshot in, one typed action out (an `act` function call), executed with xdotool, recorded with ffmpeg. Spark 1.3 drives it; Wonder is selectable with `--model`. Every step writes a lineage row (stage `agent`).
- **Measured Spark behaviour the loop had to handle:**
  - Under `response_format`, Spark wrote a sentence before the JSON, even with `strict: true`. The action is taken from tool-call arguments instead.
  - The Model API accepts only `tool_choice: "auto"`, so a missing call is a schema failure and is retried once.
  - Spark points on a 0–1000 grid: the Save button at pixel (400, 440) of a 1280×800 screenshot came back as (312, 549).
  - Tool arguments sometimes carry integers as strings, nulls as `"null"` or missing keys, and scroll amounts in pixels (400–800). Each quirk is normalised for the agent's own fields only, and unit-tested.
- **A01** (D01's task): completed in 11 steps after opening the same record from the same list four times. The claim matches the screen. 154 s.
- **A05** (D05's task, save fault): after the save was rejected, Spark opened Chrome DevTools to "inspect the network response", then pressed Save five more times and ran out of its 20-step budget without reporting the failure. 136 s. A first attempt, before the scroll fix, ran 12.5 minutes and is kept aside as `A05-long`.

## 2026-11-01 — Loop checker 1.2.0: a loop is a cycle

- **Decision.** A repeat counts toward the loop limit only if the screen before and the screen after both match an earlier repeat of the same action on the same target. Screens are identities grouped by the 160×100 changed-pixel metric, not the 64-bit hash.
- **Why, with numbers.** 1.0.0 (same action on the same screen hash) raised seven false findings on D09, which reassigns six deals with identical clicks: the coarse hash could not tell one deal's page from another's. 1.1.0 ignored any repeat that changed the screen, which would miss A01's four-way bounce between the list and the duplicate record. 1.2.0 flags D10's four F5 presses and A01's bounce, and not D09.
- **Video-mode limit, measured.** D06's four Save clicks change nothing on screen, and narration reports one Save even with keyframes every 2 seconds. No video-mode checker can count clicks it cannot see. Native mode records all four as button presses (D06N), so the loop is caught there. The evidence pack states this.

## 2026-11-01 — End of the first full verification pass: results

Fifteen runs verified under the final code (loop 1.2.0, confirm_before_destroy 1.1.0, overlays masked). Total API spend for the whole build so far: $9.57.

| Run | Mode | Driven by | Findings | Verdict | Matches spec |
|---|---|---|---|---|---|
| D01 dedupe | video | scripted | none | completed | yes |
| D02 dedupe, two violations | video | scripted | R2, R4 | completed with violations | yes |
| D03 dedupe | native | scripted | none | completed | yes |
| D04 deal close | video | scripted | R1 | completed with violations | yes |
| D05 phone, save fault | video | scripted | R6 | not completed | yes |
| D06 account, loop | video | scripted | none | needs review | **no**: R3 missed (see below) |
| D06N account, loop | native | scripted | R3 | needs review | yes (R3) |
| D07 archive, negative control | video | scripted | none | completed | yes |
| D08 call log | native | scripted | R4 | completed with violations | yes |
| D09 reassign, over time | video | scripted | R5 | completed with violations | yes |
| D10 ERP posting, loop and false claim | video (noVNC) | scripted | R3 (review), R6 | needs review | yes |
| D11 ERP posting | video (noVNC) | scripted | none | completed | yes |
| D12 ERP reversal, prompt skipped | video (noVNC) | scripted | R2 | completed with violations | yes |
| A01 dedupe | video | Spark 1.3 | none | completed | correct: it did complete |
| A05 phone, save fault | video | Spark 1.3 | none | not completed | correct verdict; loop not flagged |

- **D06 (video).** Narration now reports all four Saves, using the agent log. The first is on a visibly different screen, because the Industry field still shows its focus ring, so only three repeats match. "More than three" is not met on that evidence. D06N catches the loop.
- **A05.** Narration found four of the agent's five Save clicks; the last one fell at the very end of the recording. Three match as a cycle, so the limit is not exceeded on the evidence. The agent opened DevTools docked inside the same browser window, which narration attributes to the CRM, so R1 does not fire.
- **Narration accuracy** (`pnpm eval-narration`, scripted runs only): recall 0.79, precision 0.74 over 120 ground-truth steps in 10 video runs. CRM runs score 0.91–1.00 recall, except D04, where navigations by typed URL are partly missed. The canvas ERP runs score 0.33–0.56: keyboard-only steps (Tab, Enter, function keys) leave little trace on screen. This is the measured case for native mode.
