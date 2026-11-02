/**
 * Stage 2', map events (native mode): runtime events from the instrumented
 * sandbox become steps with confidence 1. These are observed, not inferred.
 */
import { RuntimeEvent, type Step } from "@blackbox/contracts";

export function parseRuntimeJsonl(runId: string, jsonl: string): RuntimeEvent[] {
  return jsonl
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line, i) => {
      try {
        return RuntimeEvent.parse({ runId, ...JSON.parse(line) });
      } catch (error) {
        throw new Error(`runtime.jsonl line ${i + 1} is invalid: ${(error as Error).message}`);
      }
    })
    .sort((a, b) => a.tMs - b.tMs);
}

/** Browser UI that raises window events but is not an application (the address bar's suggestion list). */
const BROWSER_UI_WINDOWS = new Set(["Omnibox Popup"]);

/** Window titles carry the browser's name after the page title; the page title is the app. */
export function windowTitle(window: string): string {
  return window.replace(/\s+-\s+(Google Chrome for Testing|Google Chrome|Chromium)$/, "");
}

const label = (e: RuntimeEvent) => (e.name ? `'${e.name}'` : "(unnamed)");

export function mapRuntimeEvents(
  runId: string,
  events: RuntimeEvent[],
  signatures: string[],
  frameMs: number,
): { steps: Step[]; agentClaim: string | null } {
  const steps: Step[] = [];
  let app = "";
  let agentClaim: string | null = null;
  const frameAt = (tMs: number) =>
    Math.min(Math.max(0, Math.round(tMs / frameMs)), Math.max(0, signatures.length - 1));

  const push = (
    e: RuntimeEvent,
    action: Step["action"],
    target: string,
    field: string | null = null,
  ) => {
    // Every event names its own window, so a step's app never depends on an earlier focus event.
    if (e.window && e.event !== "agent.claim") app = windowTitle(e.window);
    const frame = frameAt(e.tMs);
    const before = Math.max(0, frame - 1);
    steps.push({
      runId,
      n: steps.length + 1,
      tMs: e.tMs,
      app,
      action,
      target,
      field,
      observedAfter: "",
      dialogOpened: false,
      // Native screens are windows: the page title the action happened in, and the one it led to.
      screenSignature: `window:${app}`,
      screenAfter: null, // filled in below, once later events are known
      madeProgress: null,
      source: "native",
      confidence: 1,
      evidenceFrames:
        before === frame ? [frame] : [before, Math.min(frame + 1, signatures.length - 1)],
      redacted: e.value === "[redacted]",
    });
  };

  const relevant = events.filter((e) => !BROWSER_UI_WINDOWS.has(windowTitle(e.window)));
  for (const e of relevant) {
    switch (e.event) {
      case "window.focus":
        if (windowTitle(e.window) !== app) push(e, "navigate", `window ${windowTitle(e.window)}`);
        break;
      case "button.press":
      case "link.activate":
      case "tab.select":
        push(e, "click", `${e.role ?? e.event.split(".")[0]} ${label(e)}`);
        break;
      case "text.insert":
        push(e, "type", `field ${label(e)}`, e.name ?? null);
        break;
      case "key.press":
        push(e, "key", e.name ?? "key");
        break;
      case "dialog.open": {
        const last = steps.at(-1);
        if (last) {
          last.dialogOpened = true;
          last.observedAfter = `Dialog ${label(e)} opened.`;
        }
        break;
      }
      case "agent.claim":
        agentClaim = e.text ?? null;
        if (agentClaim) push(e, "claim", agentClaim);
        break;
      default:
        break; // dialog.close, file.write, net.request: recorded, not steps
    }
  }
  // The screen after an action: the window a focus event within 2 s moved to, else the same window.
  for (const step of steps) {
    const next = relevant.find(
      (e) => e.event === "window.focus" && e.tMs > step.tMs && e.tMs - step.tMs <= 2000,
    );
    step.screenAfter = `window:${next ? windowTitle(next.window) : step.app}${step.dialogOpened ? "+dialog" : ""}`;
    step.madeProgress = step.screenAfter !== step.screenSignature;
  }
  return { steps, agentClaim };
}
