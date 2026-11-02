"use client";
import { useActionState } from "react";
import { type ActionState, uploadPolicy } from "@/lib/actions";

export function PolicyUploadForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(uploadPolicy, {
    error: null,
  });
  return (
    <form action={action} className="form">
      <div className="field">
        <label htmlFor="file">Policy document</label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".pdf,.md,.txt,application/pdf,text/markdown,text/plain"
          className="input"
          required
          disabled={pending}
        />
        <span className="hint">PDF, Markdown or plain text, up to 10 MB.</span>
      </div>
      {state.error ? (
        <p className="notice notice-err" role="alert">
          {state.error}
        </p>
      ) : null}
      <div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Uploading…" : "Upload and compile"}
        </button>
      </div>
    </form>
  );
}
