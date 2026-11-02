/**
 * Narration accuracy against ground truth. Scripted runs log every action they
 * take; a narrated step matches a truth step when the actions agree, the
 * targets share a word, and the narrated time is within the tolerance. Each
 * truth step is matched at most once (greedy, in time order).
 */
import type { Step } from "@blackbox/contracts";

export type TruthStep = { tMs: number; action: string; target: string; field: string | null };

export type NarrationScore = {
  truth: number;
  narrated: number;
  matched: number;
  recall: number;
  precision: number;
  missed: TruthStep[];
  extra: Pick<Step, "n" | "tMs" | "action" | "target">[];
};

/** Narration sees keyframes at 2 fps or slower, so its times are coarse. */
export const TIME_TOLERANCE_MS = 3000;

const ACTION_EQUIV: Record<string, string[]> = {
  key: ["key", "click"], // Enter on a search box is often narrated as clicking Search
  click: ["click", "key"],
  type: ["type"],
  navigate: ["navigate", "click"],
  scroll: ["scroll"],
  claim: ["claim"],
};

const tokens = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter(
        (w) =>
          w.length > 2 &&
          !["button", "field", "link", "the", "checkbox", "combobox", "option"].includes(w),
      ),
  );

function targetsAgree(a: string, b: string): boolean {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return true;
  for (const w of ta) if (tb.has(w)) return true;
  return false;
}

export function scoreNarration(truth: TruthStep[], narrated: Step[]): NarrationScore {
  const used = new Set<number>();
  let matched = 0;
  const missed: TruthStep[] = [];
  for (const t of truth) {
    // Enter and Return name no control; the narration names what they triggered.
    const anyTarget = t.action === "key" && /^(enter|return)$/i.test(t.target);
    const hit = narrated
      .filter(
        (s) =>
          !used.has(s.n) &&
          (ACTION_EQUIV[t.action] ?? [t.action]).includes(s.action) &&
          Math.abs(s.tMs - t.tMs) <= TIME_TOLERANCE_MS &&
          (anyTarget || targetsAgree(s.target, t.target)),
      )
      .sort((a, b) => Math.abs(a.tMs - t.tMs) - Math.abs(b.tMs - t.tMs))[0];
    if (hit) {
      used.add(hit.n);
      matched++;
    } else missed.push(t);
  }
  // The scripted runner logs "type into field" as one step; narration correctly
  // reports the click into that field as its own step. A click on the same field
  // just before a matched typing step is part of it, not an extra step.
  const typed = narrated.filter((s) => used.has(s.n) && s.action === "type");
  const absorbed = (s: Step) =>
    s.action === "click" &&
    typed.some(
      (t) =>
        t.tMs >= s.tMs && t.tMs - s.tMs <= TIME_TOLERANCE_MS && targetsAgree(t.target, s.target),
    );
  const extra = narrated
    .filter((s) => !used.has(s.n) && !absorbed(s))
    .map(({ n, tMs, action, target }) => ({ n, tMs, action, target }));
  const counted = narrated.length - narrated.filter((s) => !used.has(s.n) && absorbed(s)).length;
  return {
    truth: truth.length,
    narrated: counted,
    matched,
    recall: truth.length ? matched / truth.length : 1,
    precision: counted ? matched / counted : 1,
    missed,
    extra,
  };
}
