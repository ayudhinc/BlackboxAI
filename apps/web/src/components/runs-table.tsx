import Link from "next/link";
import { RunStatusChip } from "@/components/chips";
import { ago, clock, usd } from "@/lib/format";
import type { RunRow } from "@/lib/queries";

export function RunsTable({ runs }: { runs: RunRow[] }) {
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>Task</th>
            <th>Agent</th>
            <th>Surface</th>
            <th>Status</th>
            <th>Findings</th>
            <th>Duration</th>
            <th>Cost</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id}>
              <td style={{ maxWidth: 420 }}>
                <Link href={`/runs/${r.id}`} style={{ fontWeight: 600, color: "var(--ink)" }}>
                  {r.task.length > 110 ? `${r.task.slice(0, 110)}…` : r.task}
                </Link>
                <div className="muted mono" style={{ marginTop: 2 }}>
                  {r.taskId}
                </div>
              </td>
              <td className="mono">{r.agent}</td>
              <td>
                {r.surface}
                <div className="muted" style={{ fontSize: 12 }}>
                  {r.mode === "native" ? "Native mode" : "Video mode"}
                </div>
              </td>
              <td>
                <RunStatusChip status={r.status} verdict={r.verdict} decidedBy={r.decidedBy} />
              </td>
              <td>{r.status === "done" ? r.findings : "—"}</td>
              <td>{r.durationMs ? clock(r.durationMs) : "—"}</td>
              <td>{usd(r.costUsd)}</td>
              <td className="muted">{ago(r.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
