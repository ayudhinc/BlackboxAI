"use client";
import { useActionState, useState } from "react";
import { type ActionState, reviewVerdict } from "@/lib/actions";

export function ReviewForm({ runId, proposed }: { runId: string; proposed: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(reviewVerdict, {
    error: null,
  });
  const [mode, setMode] = useState<"approve" | "override">("approve");
  return (
    <form action={action} className="form" style={{ gap: 12 }}>
      <input type="hidden" name="runId" value={runId} />
      <input type="hidden" name="decision" value={mode} />
      <fieldset className="row bare" aria-label="Decision">
        <button
          type="button"
          className={`btn ${mode === "approve" ? "btn-primary" : ""}`}
          onClick={() => setMode("approve")}
          aria-pressed={mode === "approve"}
        >
          Approve proposed
        </button>
        <button
          type="button"
          className={`btn ${mode === "override" ? "btn-primary" : ""}`}
          onClick={() => setMode("override")}
          aria-pressed={mode === "override"}
        >
          Overrule
        </button>
      </fieldset>
      {mode === "override" ? (
        <div className="field">
          <label htmlFor="status">Status this run should have</label>
          <select id="status" name="status" className="input" defaultValue="">
            <option value="" disabled>
              Choose a status
            </option>
            <option value="completed">Completed</option>
            <option value="completed_with_violations">Completed with violations</option>
            <option value="not_completed">Not completed</option>
          </select>
        </div>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          Proposed: <strong>{proposed.replaceAll("_", " ")}</strong>
        </p>
      )}
      <div className="field">
        <label htmlFor="reason">Reason {mode === "override" ? "(required)" : "(optional)"}</label>
        <textarea
          id="reason"
          name="reason"
          className="input"
          placeholder="What the frames show that supports your decision"
        />
      </div>
      {state.error ? (
        <p className="notice notice-err" role="alert">
          {state.error}
        </p>
      ) : null}
      <div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Record decision"}
        </button>
      </div>
    </form>
  );
}
