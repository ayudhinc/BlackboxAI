"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Phase =
  | { kind: "idle" }
  | { kind: "uploading"; pct: number }
  | { kind: "queuing" }
  | { kind: "error"; message: string };

export function UploadForm({ policies }: { policies: { id: string; title: string }[] }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const busy = phase.kind === "uploading" || phase.kind === "queuing";

  async function submit(form: HTMLFormElement) {
    const data = new FormData(form);
    const file = data.get("file");
    if (!(file instanceof File) || file.size === 0)
      return setPhase({ kind: "error", message: "Choose a recording to upload." });
    const contentType =
      file.type || (file.name.toLowerCase().endsWith(".mov") ? "video/quicktime" : "video/mp4");
    const res = await fetch("/api/uploads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        task: data.get("task"),
        taskId: data.get("taskId") || undefined,
        policyId: data.get("policyId") || undefined,
        agent: data.get("agent") || undefined,
        surface: data.get("surface") || undefined,
        filename: file.name,
        size: file.size,
        contentType,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      runId?: string;
      upload?: { url: string };
    };
    if (!res.ok || !body.runId || !body.upload) {
      return setPhase({
        kind: "error",
        message: body.error ?? "BlackboxAI could not start the upload. Try again.",
      });
    }
    setPhase({ kind: "uploading", pct: 0 });
    const ok = await new Promise<boolean>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", body.upload?.url as string);
      xhr.setRequestHeader("content-type", contentType);
      xhr.upload.onprogress = (e) =>
        e.lengthComputable &&
        setPhase({ kind: "uploading", pct: Math.round((e.loaded / e.total) * 100) });
      xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
      xhr.onerror = () => resolve(false);
      xhr.send(file);
    });
    if (!ok)
      return setPhase({
        kind: "error",
        message: "The upload did not complete. Check your connection and try again.",
      });
    setPhase({ kind: "queuing" });
    const submitRes = await fetch(`/api/runs/${body.runId}/submit`, { method: "POST" });
    if (!submitRes.ok) {
      const e = (await submitRes.json().catch(() => ({}))) as { error?: string };
      return setPhase({
        kind: "error",
        message: e.error ?? "The recording uploaded but could not be queued.",
      });
    }
    router.push(`/runs/${body.runId}`);
  }

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(e.currentTarget);
      }}
    >
      <div className="field">
        <label htmlFor="file">Screen recording</label>
        <input
          id="file"
          name="file"
          type="file"
          accept="video/mp4,video/quicktime,.mp4,.mov"
          className="input"
          required
          disabled={busy}
        />
        <span className="hint">
          MP4 or MOV, H.264 or H.265, up to 500 MB. Ten minutes or less works best.
        </span>
      </div>
      <div className="field">
        <label htmlFor="task">Task the agent was given</label>
        <textarea
          id="task"
          name="task"
          className="input"
          required
          minLength={10}
          disabled={busy}
          placeholder="Merge the duplicate contact for Dana Whitfield and make sure her phone is +1 415 555 0143."
        />
      </div>
      <div className="field">
        <label htmlFor="policyId">Policy</label>
        <select
          id="policyId"
          name="policyId"
          className="input"
          disabled={busy}
          defaultValue={policies[0]?.id ?? ""}
        >
          <option value="">No policy (verdict only)</option>
          {policies.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <span className="hint">Only signed-off policies can be used.</span>
      </div>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div className="field" style={{ flex: "1 1 220px" }}>
          <label htmlFor="agent">Agent</label>
          <input
            id="agent"
            name="agent"
            className="input"
            disabled={busy}
            placeholder="vendor/model, e.g. meta/muse-spark-1.3"
          />
        </div>
        <div className="field" style={{ flex: "1 1 220px" }}>
          <label htmlFor="surface">Surface</label>
          <input
            id="surface"
            name="surface"
            className="input"
            disabled={busy}
            placeholder="Chromium · Acme CRM"
          />
        </div>
        <div className="field" style={{ flex: "1 1 180px" }}>
          <label htmlFor="taskId">Task ID</label>
          <input
            id="taskId"
            name="taskId"
            className="input"
            disabled={busy}
            placeholder="crm-contact-dedupe"
          />
          <span className="hint">Runs with the same ID are compared.</span>
        </div>
      </div>
      {phase.kind === "error" ? (
        <p className="notice notice-err" role="alert">
          {phase.message}
        </p>
      ) : null}
      {phase.kind === "uploading" ? (
        <p className="notice notice-info" role="status">
          Uploading… {phase.pct}%
        </p>
      ) : null}
      {phase.kind === "queuing" ? (
        <p className="notice notice-info" role="status">
          Queuing verification…
        </p>
      ) : null}
      <div>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Working…" : "Upload and verify"}
        </button>
      </div>
    </form>
  );
}
