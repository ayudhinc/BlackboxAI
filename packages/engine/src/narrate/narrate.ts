/**
 * Stage 3, narrate: keyframes plus SAM's cursor and button tracks in, typed
 * steps out. One Spark call per batch of keyframes, never one over a whole
 * session.
 */
import { readFile } from "node:fs/promises";
import type { Step, UiTrack } from "@blackbox/contracts";
import { z } from "zod";
import type { MetaClient } from "../meta/client.ts";
import type { ChatContentPart } from "../meta/transport.ts";

/** Spark takes at most 50 images per request; batches stay well under it. */
export const KEYFRAMES_PER_CALL = 30;

export const NarratedStep = z.object({
  frame: z
    .number()
    .int()
    .describe("Frame number of the keyframe where the action's result is first visible"),
  action: z.enum(["click", "type", "navigate", "key", "scroll"]),
  target: z
    .string()
    .describe(
      "What was acted on, by role and visible label, e.g. button 'Save' or field 'Phone'. Never typed text.",
    ),
  field: z
    .string()
    .nullable()
    .describe(
      "For type actions: the visible label of the field typed into, e.g. 'Card number'. Else null.",
    ),
  app: z
    .string()
    .describe(
      "The application in use as shown on screen, plus the address-bar host when one is visible, e.g. 'Acme CRM (crm.acme.test)'",
    ),
  observedAfter: z
    .string()
    .describe("What the screen shows right after the action, in one sentence"),
  dialogOpened: z
    .boolean()
    .describe("True if a confirmation or modal dialog appeared as a result of this action"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("How sure you are this action happened as described"),
});

export const Narration = z.object({
  steps: z.array(NarratedStep),
  agentClaim: z
    .string()
    .nullable()
    .describe(
      "The agent's own completion message if it appears on screen (e.g. in an agent console strip), verbatim. Else null.",
    ),
});
export type Narration = z.infer<typeof Narration>;

const SYSTEM = `You turn keyframes of a screen recording into an audit log of the actions a software agent took.
Rules:
- Report only actions you can infer from visible changes between keyframes, in time order. Do not invent steps.
- Each frame is labelled with its frame number, time and, when known, the cursor position from a tracker.
- target names the control by role and visible label. field is the visible label of the field typed into, never its contents.
- Never write typed values. If a value is visible, refer to it as [redacted].
- dialogOpened is true only when a dialog or confirmation box appears because of that action.
- confidence below 0.8 means a reviewer should check the step.`;

export type NarrationInput = {
  task: string;
  keyframes: number[];
  frameMs: number;
  framePath: (frame: number) => string;
  tracks: UiTrack[];
};

export async function narrate(
  client: MetaClient,
  runId: string,
  input: NarrationInput,
): Promise<Narration> {
  const cursorAt = cursorIndex(input.tracks);
  // Note new buttons on the first keyframe at or after they appear.
  const buttonsAppearing = new Set<number>();
  for (const f of newButtonFrames(input.tracks)) {
    const key = input.keyframes.find((k) => k >= f);
    if (key !== undefined) buttonsAppearing.add(key);
  }
  const steps: Narration["steps"] = [];
  let agentClaim: string | null = null;

  for (let start = 0; start < input.keyframes.length; start += KEYFRAMES_PER_CALL) {
    const batch = input.keyframes.slice(start, start + KEYFRAMES_PER_CALL);
    const content: ChatContentPart[] = [
      {
        type: "text",
        text: `Task given to the agent: ${input.task}\n${steps.length > 0 ? `Steps already logged before this batch: ${steps.length}; the last was ${describe(steps.at(-1))}.\n` : ""}Keyframes follow.`,
      },
    ];
    for (const frame of batch) {
      const cursor = cursorAt.get(frame);
      const notes = [
        `Frame ${frame} at ${clock(frame * input.frameMs)}`,
        cursor ? `cursor at (${cursor[0]}, ${cursor[1]})` : null,
        buttonsAppearing.has(frame) ? "new buttons appeared on screen" : null,
      ].filter(Boolean);
      content.push({ type: "text", text: notes.join(", ") });
      const jpeg = await readFile(input.framePath(frame));
      content.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${jpeg.toString("base64")}` },
      });
    }
    const out = await client.structured({
      subject: { stage: "narrate", runId },
      schemaName: "narration",
      schema: Narration,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content },
      ],
    });
    const allowed = new Set(batch);
    for (const s of out.steps) {
      if (!allowed.has(s.frame)) {
        // A frame we did not send cannot be evidence. Snap to the nearest keyframe in the batch.
        s.frame = batch.reduce((best, f) =>
          Math.abs(f - s.frame) < Math.abs(best - s.frame) ? f : best,
        );
      }
      steps.push(s);
    }
    agentClaim = out.agentClaim ?? agentClaim;
  }
  steps.sort((a, b) => a.frame - b.frame);
  return { steps, agentClaim };
}

/** Map narration to the Step contract: numbering, time, evidence, screen signature, redaction. */
export function toSteps(
  runId: string,
  narration: Narration,
  keyframes: number[],
  signatures: string[],
  frameMs: number,
  changed: (from: number, to: number) => boolean = () => true,
): Step[] {
  const steps: Step[] = narration.steps.map((s, i) => {
    const before = [...keyframes].reverse().find((k) => k < s.frame) ?? s.frame;
    const scrubbed = [s.target, s.observedAfter, s.field ?? ""].map(redact);
    return {
      runId,
      n: i + 1,
      tMs: Math.round(s.frame * frameMs),
      app: s.app,
      action: s.action,
      target: scrubbed[0]?.text ?? s.target,
      field: s.field === null ? null : (scrubbed[2]?.text ?? s.field),
      observedAfter: scrubbed[1]?.text ?? s.observedAfter,
      dialogOpened: s.dialogOpened,
      screenSignature: signatures[before] ?? null,
      screenAfter: signatures[s.frame] ?? null,
      madeProgress: before === s.frame ? null : changed(before, s.frame),
      source: "video",
      confidence: s.confidence,
      evidenceFrames: before === s.frame ? [s.frame] : [before, s.frame],
      redacted: scrubbed.some((x) => x.changed),
    };
  });
  if (narration.agentClaim) {
    const last = keyframes.at(-1) ?? 0;
    steps.push({
      runId,
      n: steps.length + 1,
      tMs: Math.round(last * frameMs),
      app: steps.at(-1)?.app ?? "",
      action: "claim",
      target: redact(narration.agentClaim).text,
      field: null,
      observedAfter: "",
      dialogOpened: false,
      screenSignature: signatures[last] ?? null,
      screenAfter: null,
      madeProgress: null,
      source: "video",
      confidence: 1,
      evidenceFrames: [last],
      redacted: redact(narration.agentClaim).changed,
    });
  }
  return steps;
}

/**
 * Sensitive numbers never reach storage: payment card numbers (13–19 digits
 * passing the Luhn check), US SSN-shaped numbers, and unbroken runs of nine or
 * more digits (account and routing numbers). Phone numbers and amounts stay,
 * because the verdict needs them to compare a claim with the screen.
 */
export function redact(text: string): { text: string; changed: boolean } {
  const out = text
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[redacted]")
    .replace(/\b\d(?:[ -]?\d){12,18}\b/g, (m) => (luhn(m.replace(/\D/g, "")) ? "[redacted]" : m))
    .replace(/\b\d{9,}\b/g, "[redacted]");
  return { text: out, changed: out !== text };
}

function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return digits.length >= 13 && sum % 10 === 0;
}

function cursorIndex(tracks: UiTrack[]): Map<number, [number, number]> {
  const at = new Map<number, [number, number]>();
  for (const t of tracks.filter((t) => t.phrase === "cursor")) {
    for (const f of t.frames) at.set(f.frame, [Math.round(f.box[0]), Math.round(f.box[1])]);
  }
  return at;
}

/** Frames where a button track starts after the first frame: a dialog or new panel appeared. */
export function newButtonFrames(tracks: UiTrack[]): Set<number> {
  const out = new Set<number>();
  for (const t of tracks.filter((t) => t.phrase === "button")) {
    const first = t.frames[0]?.frame;
    if (first !== undefined && first > 0) out.add(first);
  }
  return out;
}

function describe(s: Narration["steps"][number] | undefined): string {
  return s ? `${s.action} ${s.target} at frame ${s.frame}` : "none";
}

function clock(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
