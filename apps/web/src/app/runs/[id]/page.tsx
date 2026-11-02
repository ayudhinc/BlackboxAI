import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RunStatusChip, VerdictChip } from "@/components/chips";
import { clock, RUN_STAGE_LABEL, STATUS_LABEL, usd } from "@/lib/format";
import { loadRunDetail } from "@/lib/run-detail";
import { LiveRefresh, RerunButton } from "./live";
import { ReviewForm } from "./review-form";
import { SessionViewer } from "./viewer";

export const metadata: Metadata = { title: "Run review" };

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await loadRunDetail(id);
  if (!d) notFound();
  const { run, steps, violations, verdicts, rules, lineage, regression } = d;
  const verdict = verdicts[0] ?? null;
  const processing = !["done", "failed"].includes(run.status);
  const cost = lineage.reduce((s, l) => s + l.costUsd, 0);
  const fired = new Set(violations.map((v) => v.ruleId));
  const reviewed = verdict?.decidedBy === "reviewer";

  return (
    <main className="page">
      <LiveRefresh active={processing} />
      <div className="crumbs">
        <Link href="/runs">Runs</Link> <span aria-hidden="true">/</span>{" "}
        <span className="mono">{run.id}</span>
      </div>
      <div className="page-head" style={{ alignItems: "flex-start" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            flex: "1 1 520px",
            minWidth: 0,
          }}
        >
          <h1>{run.task}</h1>
          <div className="meta-row">
            <span>
              Agent{" "}
              <strong className="mono">
                {run.agent.vendor}/{run.agent.model}
              </strong>
            </span>
            <span>
              Surface <strong>{run.surface}</strong>
            </span>
            <span>
              Mode <strong>{run.mode === "native" ? "Native (runtime events)" : "Video"}</strong>
            </span>
            <span>
              Policy <strong>{d.policyTitle ?? "None"}</strong>
            </span>
            <span>
              Duration <strong>{run.durationMs ? clock(run.durationMs) : "—"}</strong>
            </span>
            <span>
              Verification cost <strong>{usd(cost)}</strong>
            </span>
          </div>
        </div>
        <div className="row">
          <RunStatusChip
            status={run.status}
            verdict={verdict?.status ?? null}
            decidedBy={verdict?.decidedBy ?? null}
          />
          {run.status === "done" ? (
            <>
              <a
                className="btn"
                href={`/api/runs/${run.id}/evidence?format=html`}
                target="_blank"
                rel="noreferrer"
              >
                Evidence pack
              </a>
              <a className="btn" href={`/api/runs/${run.id}/evidence`}>
                JSON
              </a>
            </>
          ) : null}
          {run.status === "failed" ? <RerunButton runId={run.id} /> : null}
        </div>
      </div>

      {processing ? (
        <div className="notice notice-info" role="status" style={{ marginBottom: 20 }}>
          Verifying: {RUN_STAGE_LABEL[run.status] ?? run.status}. This page updates on its own.
        </div>
      ) : null}
      {run.status === "failed" ? (
        <div className="notice notice-err" role="alert" style={{ marginBottom: 20 }}>
          {run.failure ?? "Verification failed."}
        </div>
      ) : null}

      <div className="grid-review">
        <div className="col-main">
          <SessionViewer
            runId={run.id}
            steps={steps}
            violations={violations}
            keyframes={d.keyframes}
          />
        </div>

        <div className="col-side">
          <section className="card" aria-label="Verdict">
            <div className="row">
              <h2>Verdict</h2>
              <span className="spacer" />
              {verdict ? (
                <VerdictChip status={verdict.status} decidedBy={verdict.decidedBy} />
              ) : null}
            </div>
            {verdict ? (
              <>
                <dl className="kv">
                  <dt>Proposed</dt>
                  <dd>{STATUS_LABEL[verdict.proposedStatus]}</dd>
                  <dt>Confidence</dt>
                  <dd>{verdict.confidence.toFixed(2)}</dd>
                  <dt>Decided by</dt>
                  <dd>
                    {verdict.decidedBy === "reviewer"
                      ? `Reviewer (${verdict.reviewer})`
                      : "Automatic, model judgement"}
                  </dd>
                </dl>
                <p style={{ margin: 0 }}>{verdict.rationale}</p>
                {verdict.reviewReason ? (
                  <p className="muted" style={{ margin: 0 }}>
                    Reviewer: {verdict.reviewReason}
                  </p>
                ) : null}
                {verdict.status === "needs_review" && !reviewed ? (
                  <div className="notice notice-rev">
                    Routed to review:{" "}
                    {verdict.confidence < 0.8
                      ? `confidence ${verdict.confidence.toFixed(2)} is below 0.80`
                      : "a finding needs a person to check it"}
                    .
                  </div>
                ) : null}
                <ReviewForm runId={run.id} proposed={verdict.proposedStatus} />
              </>
            ) : (
              <p className="muted">
                {processing
                  ? "The verdict appears when verification finishes."
                  : "No verdict was produced."}
              </p>
            )}
          </section>

          <section className="card" aria-label="Findings">
            <h2>Findings ({violations.length})</h2>
            {violations.length === 0 ? (
              <p className="muted">{run.status === "done" ? "No rule was broken." : "—"}</p>
            ) : (
              violations.map((v) => (
                <div
                  key={v.ruleId + v.stepN + v.title}
                  className={`finding ${v.kind === "review" ? "rev" : "vio"}`}
                >
                  <div className="row">
                    <span className={`chip ${v.kind === "review" ? "chip-rev" : "chip-vio"}`}>
                      {v.ruleId}
                    </span>
                    <strong>{v.title}</strong>
                    <span className="spacer" />
                    <span className="mono muted">step {v.stepN}</span>
                  </div>
                  <span>{v.detail}</span>
                  <div className="finding-frames">
                    {v.evidenceFrames.slice(-2).map((f) => (
                      // biome-ignore lint/performance/noImgElement: storage-served evidence frames
                      <img
                        key={f}
                        src={`/api/frames/${run.id}/${f}`}
                        alt={`Evidence at ${clock(f * 500)}`}
                      />
                    ))}
                  </div>
                  <span className="mono muted">{v.checker}</span>
                </div>
              ))
            )}
          </section>

          <section className="card" aria-label="Policy checks">
            <h2>Policy checks</h2>
            {rules.length === 0 ? (
              <p className="muted">No policy was attached to this run.</p>
            ) : (
              rules.map((r) => (
                <div
                  key={r.id}
                  className="row"
                  style={{ alignItems: "flex-start", flexWrap: "nowrap" }}
                >
                  <span
                    className={`chip ${fired.has(r.id) ? "chip-vio" : run.status === "done" ? "chip-ok" : "chip-neutral"}`}
                    style={{ marginTop: 1 }}
                  >
                    {r.id}
                  </span>
                  <span>{r.text}</span>
                </div>
              ))
            )}
          </section>

          <section className="card" aria-label="Regression">
            <h2>Regression</h2>
            {regression ? (
              <>
                <p style={{ margin: 0 }}>
                  Against{" "}
                  <Link href={`/runs/${regression.baselineRunId}`} className="mono">
                    {regression.baselineRunId.slice(0, 14)}…
                  </Link>
                  , the previous run of <span className="mono">{regression.taskId}</span>.
                </p>
                <dl className="kv">
                  <dt>Verdict</dt>
                  <dd>
                    {STATUS_LABEL[regression.verdict.baseline ?? ""] ?? "—"} →{" "}
                    {STATUS_LABEL[regression.verdict.candidate ?? ""] ?? "—"}
                  </dd>
                  <dt>New findings</dt>
                  <dd>
                    {regression.findings.added.length
                      ? regression.findings.added
                          .map((f) => `${f.ruleId} at ${f.tMs !== null ? clock(f.tMs) : "?"}`)
                          .join(", ")
                      : "None"}
                  </dd>
                  <dt>Resolved</dt>
                  <dd>
                    {regression.findings.resolved.length
                      ? regression.findings.resolved.map((f) => f.ruleId).join(", ")
                      : "None"}
                  </dd>
                  <dt>Path</dt>
                  <dd>
                    {regression.steps.common} shared steps, {regression.steps.added.length} new,{" "}
                    {regression.steps.removed.length} dropped
                  </dd>
                  <dt>Duration</dt>
                  <dd>
                    {clock(regression.durationMs.baseline)} →{" "}
                    {clock(regression.durationMs.candidate)}
                  </dd>
                </dl>
              </>
            ) : (
              <p className="muted">No earlier finished run of this task to compare against.</p>
            )}
          </section>

          <section className="card" aria-label="Lineage">
            <div className="row">
              <h2>Lineage</h2>
              <span className="spacer" />
              <span className="muted">{usd(cost)} total</span>
            </div>
            {lineage.length === 0 ? (
              <p className="muted">No stages have run yet.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="data" style={{ minWidth: 0 }}>
                  <thead>
                    <tr>
                      <th>Stage</th>
                      <th>Engine</th>
                      <th>Tokens / frames</th>
                      <th>Cost</th>
                      <th>Latency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineage.map((l) => (
                      <tr key={l.id}>
                        <td>
                          {l.stage}
                          {l.attempt > 1 ? <span className="muted"> ×{l.attempt}</span> : null}
                          {l.error ? (
                            <div className="flag" style={{ color: "var(--vio)", fontSize: 12 }}>
                              {l.error.slice(0, 80)}
                            </div>
                          ) : null}
                        </td>
                        <td className="mono">{l.engine}</td>
                        <td className="mono">
                          {l.tokensIn !== null
                            ? `${l.tokensIn}/${l.tokensOut}`
                            : l.frames !== null
                              ? `${l.frames} fr`
                              : "—"}
                        </td>
                        <td className="mono">{usd(l.costUsd)}</td>
                        <td className="mono">{(l.latencyMs / 1000).toFixed(1)} s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
