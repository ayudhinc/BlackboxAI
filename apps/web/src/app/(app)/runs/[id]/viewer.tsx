"use client";
import type { Step, Violation } from "@blackbox/contracts";
import { useState } from "react";

function clock(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Session viewer: keyframe strip, the selected frame, and the step timeline that drives it. */
export function SessionViewer({
  runId,
  steps,
  violations,
  keyframes,
}: {
  runId: string;
  steps: Step[];
  violations: Violation[];
  keyframes: number[];
}) {
  const flagged = new Map<number, Violation[]>();
  for (const v of violations) flagged.set(v.stepN, [...(flagged.get(v.stepN) ?? []), v]);
  const firstFlag = violations[0] ? steps.find((s) => s.n === violations[0]?.stepN) : undefined;
  const [selected, setSelected] = useState<number | null>(firstFlag?.n ?? steps[0]?.n ?? null);
  const step = steps.find((s) => s.n === selected);
  const [frame, setFrame] = useState<number | null>(
    step?.evidenceFrames.at(-1) ?? keyframes[0] ?? null,
  );
  const flaggedFrames = new Set(violations.flatMap((v) => v.evidenceFrames));

  const pick = (s: Step) => {
    setSelected(s.n);
    setFrame(s.evidenceFrames.at(-1) ?? null);
  };

  return (
    <>
      <section className="card" aria-label="Session">
        <div className="row">
          <h2>Session</h2>
          <span className="spacer" />
          {frame !== null ? (
            <span className="mono muted">
              frame {frame} · {clock(frame * 500)}
            </span>
          ) : null}
        </div>
        <div className="viewer-frame">
          {frame !== null ? (
            // biome-ignore lint/performance/noImgElement: frames are served from storage, not optimised assets
            <img src={`/api/frames/${runId}/${frame}`} alt={`Recording at ${clock(frame * 500)}`} />
          ) : (
            <span className="muted">No frames</span>
          )}
        </div>
        {keyframes.length > 0 ? (
          <fieldset className="strip bare" aria-label="Keyframes">
            {keyframes.map((k) => (
              <button
                key={k}
                type="button"
                className="thumb"
                aria-pressed={k === frame}
                onClick={() => setFrame(k)}
                aria-label={`Frame at ${clock(k * 500)}`}
              >
                {/* biome-ignore lint/performance/noImgElement: storage-served frame thumbnails */}
                <img src={`/api/frames/${runId}/${k}`} alt="" loading="lazy" />
                {flaggedFrames.has(k) ? <span className="mark" aria-hidden="true" /> : null}
                <span className="t">{clock(k * 500)}</span>
              </button>
            ))}
          </fieldset>
        ) : null}
      </section>

      <section className="card" aria-label="Steps">
        <div className="row">
          <h2>Steps</h2>
          <span className="spacer" />
          <span className="muted">{steps.length} observed</span>
        </div>
        {steps.length === 0 ? (
          <p className="muted">No steps were observed in this run.</p>
        ) : (
          <div className="steps">
            {steps.map((s) => (
              <button
                key={s.n}
                type="button"
                className="step"
                aria-pressed={s.n === selected}
                onClick={() => pick(s)}
              >
                <span className="n">{s.n}</span>
                <span className="time mono muted">{clock(s.tMs)}</span>
                <span>
                  <strong style={{ fontWeight: 600 }}>
                    {s.action === "claim" ? "Agent claimed" : s.action}
                  </strong>{" "}
                  {s.target}
                  {s.field ? <span className="muted"> · field “{s.field}”</span> : null}
                  {s.dialogOpened ? (
                    <span className="chip chip-info" style={{ marginLeft: 6 }}>
                      dialog opened
                    </span>
                  ) : null}
                  {s.observedAfter ? (
                    <div className="muted" style={{ fontSize: 13 }}>
                      {s.observedAfter}
                    </div>
                  ) : null}
                  {flagged.get(s.n)?.map((v) => (
                    <div key={v.ruleId + v.title} className="flag">
                      {v.ruleId} · {v.title}
                    </div>
                  ))}
                </span>
                <span
                  className="conf mono muted"
                  title={
                    s.source === "native" ? "Observed from runtime events" : "Model confidence"
                  }
                >
                  {s.source === "native" ? "runtime" : s.confidence.toFixed(2)}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
