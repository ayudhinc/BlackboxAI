export function clock(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function usd(n: number): string {
  return n < 0.01 && n > 0 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
}

export function ago(d: Date): string {
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return d.toISOString().slice(0, 10);
}

export const STATUS_LABEL: Record<string, string> = {
  completed: "Completed",
  completed_with_violations: "Completed with violations",
  not_completed: "Not completed",
  needs_review: "Needs review",
};

export const RUN_STAGE_LABEL: Record<string, string> = {
  uploaded: "Queued",
  ingesting: "Ingesting",
  tracking: "Tracking UI",
  narrating: "Narrating steps",
  checking: "Checking rules",
  verdict: "Judging",
  done: "Done",
  failed: "Failed",
};
