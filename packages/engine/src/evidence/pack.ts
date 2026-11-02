/**
 * Stage 8, deliver: the evidence pack. Everything about one run, serialised
 * canonically and sealed with a sha256 content hash, plus a printable HTML
 * view. Anyone can recompute the hash from the JSON.
 */
import { createHash } from "node:crypto";
import type { LineageEntry, Rule, Run, Step, Verdict, Violation } from "@blackbox/contracts";
import type { RegressionDiff } from "../regress/regress.ts";

export const EVIDENCE_FORMAT = "blackbox.evidence/1";

export type EvidenceBody = {
  format: typeof EVIDENCE_FORMAT;
  generatedAt: string;
  run: Run;
  verdict: Verdict | null;
  verdictHistory: Verdict[];
  violations: Violation[];
  steps: Step[];
  rules: Rule[];
  regression: RegressionDiff | null;
  lineage: LineageEntry[];
  totals: { costUsd: number; modelCalls: number; latencyMs: number };
  coverage: string[];
};

export type EvidencePack = EvidenceBody & { contentHash: string };

/** Honest limits printed in every pack, so no reader assumes more coverage than exists. */
export const COVERAGE_NOTES = [
  "Video-mode steps are inferred from keyframes by a model and carry a confidence; native-mode steps come from runtime events.",
  "The data-class rule matches field labels, not field contents: a card number typed into a free-text field is not detected.",
  "The completion verdict is a model's judgement, labelled as such; rule findings come from deterministic checkers.",
  "Typed values and long digit runs are redacted before storage.",
];

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`)
    .join(",")}}`;
}

export function sealEvidence(
  body: Omit<EvidenceBody, "format" | "totals" | "coverage">,
): EvidencePack {
  const full: EvidenceBody = {
    format: EVIDENCE_FORMAT,
    ...body,
    totals: {
      costUsd: Math.round(body.lineage.reduce((s, l) => s + l.costUsd, 0) * 1e6) / 1e6,
      modelCalls: body.lineage.filter(
        (l) => l.engine.startsWith("muse") || l.engine.startsWith("sam"),
      ).length,
      latencyMs: body.lineage.reduce((s, l) => s + l.latencyMs, 0),
    },
    coverage: COVERAGE_NOTES,
  };
  const contentHash = `sha256:${createHash("sha256").update(canonicalJson(full)).digest("hex")}`;
  return { ...full, contentHash };
}

export function verifyEvidence(pack: EvidencePack): boolean {
  const { contentHash, ...body } = pack;
  return contentHash === `sha256:${createHash("sha256").update(canonicalJson(body)).digest("hex")}`;
}

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/** A printable, self-contained HTML view of the pack. Frame images resolve through frameUrl. */
export function renderEvidenceHtml(
  pack: EvidencePack,
  frameUrl: (frame: number) => string,
): string {
  const v = pack.verdict;
  const frames = (fs: number[]) =>
    fs
      .map(
        (f) =>
          `<figure><img src="${esc(frameUrl(f))}" alt="Frame ${f}"><figcaption>frame ${f} · ${clock(f * 500)}</figcaption></figure>`,
      )
      .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Evidence pack · ${esc(pack.run.task.slice(0, 60))}</title>
<style>body{font:13px/1.5 Inter,system-ui,sans-serif;color:#111827;max-width:900px;margin:32px auto;padding:0 24px}h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:28px 0 8px;border-bottom:1px solid #DDE1E7;padding-bottom:4px}
table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:5px 8px;border-bottom:1px solid #EEF0F3;vertical-align:top}th{font-size:11px;color:#4B5563;text-transform:uppercase}
.mono{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:11px;word-break:break-all}.muted{color:#4B5563}figure{display:inline-block;margin:6px 8px 6px 0}figure img{width:260px;border:1px solid #DDE1E7;border-radius:4px}figcaption{font-size:11px;color:#4B5563}
.chip{display:inline-block;padding:1px 8px;border-radius:999px;font-weight:600;font-size:12px}.v{background:#FBE9E3;color:#9A3412}.r{background:#F2EDFC;color:#6941C6}@media print{body{margin:0}figure{break-inside:avoid}}</style></head><body>
<p class="muted">BlackboxAI evidence pack · ${esc(pack.format)} · generated ${esc(pack.generatedAt)}</p>
<h1>${esc(pack.run.task)}</h1>
<p class="muted">Agent ${esc(pack.run.agent.vendor)}/${esc(pack.run.agent.model)} · ${esc(pack.run.surface)} · ${pack.run.mode} mode · ${clock(pack.run.durationMs)}</p>
<p class="mono">${esc(pack.contentHash)}</p>
<h2>Verdict</h2>${v ? `<p><strong>${esc(v.status.replaceAll("_", " "))}</strong> · confidence ${v.confidence.toFixed(2)} · decided by ${v.decidedBy}${v.reviewer ? ` (${esc(v.reviewer)})` : ""}</p><p>${esc(v.rationale)}</p>${v.reviewReason ? `<p class="muted">Reviewer's reason: ${esc(v.reviewReason)}</p>` : ""}${frames(v.evidenceFrames)}` : "<p>No verdict.</p>"}
<h2>Findings (${pack.violations.length})</h2>${pack.violations.map((x) => `<p><span class="chip ${x.kind === "review" ? "r" : "v"}">${esc(x.ruleId)}</span> <strong>${esc(x.title)}</strong> at step ${x.stepN}. ${esc(x.detail)} <span class="muted mono">${esc(x.checker)}</span></p>${frames(x.evidenceFrames.slice(-2))}`).join("") || "<p>None.</p>"}
<h2>Steps (${pack.steps.length})</h2><table><tr><th>#</th><th>Time</th><th>Action</th><th>Target</th><th>Source</th><th>Conf.</th></tr>${pack.steps.map((s) => `<tr><td>${s.n}</td><td>${clock(s.tMs)}</td><td>${s.action}</td><td>${esc(s.target)}${s.field ? ` <span class="muted">[${esc(s.field)}]</span>` : ""}${s.dialogOpened ? " → dialog" : ""}</td><td>${s.source}</td><td>${s.confidence.toFixed(2)}</td></tr>`).join("")}</table>
<h2>Policy rules</h2><table><tr><th>Rule</th><th>Read-back</th><th>Source</th><th>Signed off</th></tr>${pack.rules.map((r) => `<tr><td>${esc(r.id)} <span class="muted">${r.type}</span></td><td>${esc(r.text)}</td><td class="muted">p${r.sourceSpan.page} “${esc(r.sourceSpan.quote)}”</td><td>${esc(r.signedOffBy ?? "—")}</td></tr>`).join("")}</table>
${pack.regression ? `<h2>Regression against the previous run</h2><p>Verdict ${esc(pack.regression.verdict.baseline ?? "—")} → ${esc(pack.regression.verdict.candidate ?? "—")}. ${pack.regression.findings.added.length} new finding(s), ${pack.regression.findings.resolved.length} resolved. ${pack.regression.steps.added.length} step(s) added, ${pack.regression.steps.removed.length} removed.</p>` : ""}
<h2>Lineage</h2><table><tr><th>Stage</th><th>Engine</th><th>Tokens in/out</th><th>Frames</th><th>Cost</th><th>Latency</th><th>Prompt hash</th></tr>${pack.lineage.map((l) => `<tr><td>${l.stage}${l.attempt > 1 ? ` (attempt ${l.attempt})` : ""}</td><td>${esc(l.engine)}</td><td>${l.tokensIn ?? "—"} / ${l.tokensOut ?? "—"}</td><td>${l.frames ?? "—"}</td><td>$${l.costUsd.toFixed(4)}</td><td>${l.latencyMs} ms</td><td class="mono">${esc(l.promptHash?.slice(0, 16) ?? "—")}</td></tr>`).join("")}</table>
<p>Total $${pack.totals.costUsd.toFixed(4)} over ${pack.totals.modelCalls} model call(s).</p>
<h2>Coverage</h2><ul>${pack.coverage.map((c) => `<li>${esc(c)}</li>`).join("")}</ul></body></html>`;
}
