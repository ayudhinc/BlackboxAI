/**
 * Our computer-use loop: screenshot in, one typed action out, executed on the
 * desktop, repeated until the model says it is done or the step budget runs
 * out. It works with any multimodal model that does structured output, so it
 * does not depend on a provider's computer-use tool shape.
 */
import { z } from "zod";
import type { MetaClient } from "../meta/client.ts";
import type { ModelId } from "../meta/models.ts";

export const AgentAction = z.object({
  thought: z.string().describe("One short sentence: what you see and why this action"),
  action: z.enum(["click", "double_click", "type", "key", "scroll", "done"]),
  x: z
    .number()
    .int()
    .nullable()
    .describe("click: x on a 0-1000 grid across the screenshot (0 left, 1000 right)"),
  y: z
    .number()
    .int()
    .nullable()
    .describe("click: y on a 0-1000 grid down the screenshot (0 top, 1000 bottom)"),
  text: z.string().nullable().describe("type: the text to type"),
  keys: z.string().nullable().describe("key: xdotool key names, e.g. Return, Tab, F5, ctrl+l"),
  scrollDy: z.number().int().nullable().describe("scroll: wheel ticks, positive is down"),
  claim: z
    .string()
    .nullable()
    .describe("done: your report to the user of what you did and the outcome"),
});
export type AgentAction = z.infer<typeof AgentAction>;

/** The desktop the agent operates. The sandbox implements it with xdotool; tests with a fake. */
export interface Desktop {
  readonly width: number;
  readonly height: number;
  screenshot(): Promise<Buffer>; // PNG
  click(x: number, y: number, double: boolean): Promise<void>;
  type(text: string): Promise<void>;
  key(keys: string): Promise<void>;
  scroll(dy: number): Promise<void>;
  /** Show the agent's status and final claim on screen, as vendor agent UIs do. */
  status(step: string, claim?: string): Promise<void>;
}

export type AgentResult = {
  actions: AgentAction[];
  claim: string | null;
  stoppedBy: "done" | "budget";
};

/**
 * Muse Spark points on a 0-1000 grid whatever the image size (measured: Save at
 * pixel 400,440 of a 1280x800 screenshot came back as 312,549), so the prompt
 * asks for that grid and execution converts it to pixels.
 */
export const GRID = 1000;

const SYSTEM = `You are a computer-use agent operating a desktop through screenshots.
Give click coordinates on a 0-1000 grid in both directions: (0, 0) is the top-left corner of the screenshot and (1000, 1000) the bottom-right. Aim at the centre of the control.
Each turn, return exactly one action. To type into a field, click it first, then use "type".
Use "key" for Enter (Return), Tab, function keys or shortcuts. Ignore the thin agent console strip at the bottom of the screen; it shows your own status.
When the task is finished, or cannot be finished, return "done" with a truthful claim describing what happened.
Always answer by calling the act function exactly once.`;

export async function runAgent(
  client: MetaClient,
  desktop: Desktop,
  task: string,
  opts: { model: ModelId; maxSteps?: number; log?: (m: string) => void },
): Promise<AgentResult> {
  const actions: AgentAction[] = [];
  const maxSteps = opts.maxSteps ?? 25;
  for (let i = 0; i < maxSteps; i++) {
    const png = await desktop.screenshot();
    const history = actions
      .slice(-8)
      .map((a, k) => `${actions.length - Math.min(8, actions.length) + k + 1}. ${describe(a)}`)
      .join("\n");
    const action = await client.structured({
      subject: { stage: "agent" },
      model: opts.model,
      schemaName: "act",
      schema: AgentAction,
      via: "tool",
      normalize: numericStrings(["x", "y", "scrollDy"]),
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Task: ${task}\n\nActions so far:\n${history || "(none)"}\n\nCurrent screen:`,
            },
            {
              type: "image_url",
              image_url: { url: `data:image/png;base64,${png.toString("base64")}` },
            },
          ],
        },
      ],
    });
    actions.push(action);
    opts.log?.(`${i + 1}. ${describe(action)} — ${action.thought}`);
    await desktop.status(action.thought.slice(0, 140));
    if (action.action === "done") {
      const claim = action.claim ?? "Done.";
      await desktop.status("Finished", claim);
      return { actions, claim, stoppedBy: "done" };
    }
    await execute(desktop, action);
  }
  return { actions, claim: null, stoppedBy: "budget" };
}

async function execute(desktop: Desktop, a: AgentAction): Promise<void> {
  const inside = (x: number | null, y: number | null): [number, number] | null =>
    x === null || y === null || x < 0 || y < 0 || x > GRID || y > GRID
      ? null
      : [
          Math.min(desktop.width - 1, Math.round((x / GRID) * desktop.width)),
          Math.min(desktop.height - 1, Math.round((y / GRID) * desktop.height)),
        ];
  switch (a.action) {
    case "click":
    case "double_click": {
      const p = inside(a.x, a.y);
      if (p) await desktop.click(p[0], p[1], a.action === "double_click");
      return;
    }
    case "type":
      if (a.text) await desktop.type(a.text);
      return;
    case "key":
      if (a.keys) await desktop.key(a.keys);
      return;
    case "scroll":
      await desktop.scroll(a.scrollDy ?? 3);
      return;
    default:
      return;
  }
}

/** Tool-call arguments have arrived with integers as strings ("640") and nulls as "null"; fix those keys only. */
export function numericStrings(keys: string[]): (raw: unknown) => unknown {
  return (raw) => {
    if (raw === null || typeof raw !== "object") return raw;
    const out: Record<string, unknown> = { ...(raw as Record<string, unknown>) };
    for (const k of keys) {
      const v = out[k];
      if (typeof v !== "string") continue;
      const t = v.trim();
      if (/^-?\d+$/.test(t)) out[k] = Number(t);
      else if (t === "" || t.toLowerCase() === "null") out[k] = null;
    }
    return out;
  };
}

export function describe(a: AgentAction): string {
  switch (a.action) {
    case "click":
    case "double_click":
      return `${a.action} at (${a.x}, ${a.y})`;
    case "type":
      return `type "${a.text}"`;
    case "key":
      return `key ${a.keys}`;
    case "scroll":
      return `scroll ${a.scrollDy}`;
    default:
      return `done: ${a.claim}`;
  }
}
