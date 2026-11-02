import { RUN_STAGE_LABEL, STATUS_LABEL } from "@/lib/format";

const VERDICT_CLASS: Record<string, string> = {
  completed: "chip-ok",
  completed_with_violations: "chip-vio",
  not_completed: "chip-vio",
  needs_review: "chip-rev",
};

export function VerdictChip({
  status,
  decidedBy,
}: {
  status: string | null;
  decidedBy?: string | null;
}) {
  if (!status) return <span className="chip chip-neutral">No verdict</span>;
  return (
    <span className={`chip ${VERDICT_CLASS[status] ?? "chip-neutral"}`}>
      {STATUS_LABEL[status] ?? status}
      {decidedBy === "reviewer" ? " · reviewed" : ""}
    </span>
  );
}

export function RunStatusChip({
  status,
  verdict,
  decidedBy,
}: {
  status: string;
  verdict: string | null;
  decidedBy: string | null;
}) {
  if (status === "done") return <VerdictChip status={verdict} decidedBy={decidedBy} />;
  if (status === "failed") return <span className="chip chip-vio">Failed</span>;
  return <span className="chip chip-info">{RUN_STAGE_LABEL[status] ?? status}…</span>;
}
