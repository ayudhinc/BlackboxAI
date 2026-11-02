"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** While a run is verifying, refresh the page every few seconds. */
export function LiveRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(t);
  }, [active, router]);
  return null;
}

export function RerunButton({ runId }: { runId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <span className="row">
      <button
        type="button"
        className="btn"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          const res = await fetch(`/api/runs/${runId}/submit`, { method: "POST" });
          setPending(false);
          if (!res.ok)
            setError(
              ((await res.json().catch(() => ({}))) as { error?: string }).error ??
                "Could not rerun.",
            );
          else router.refresh();
        }}
      >
        {pending ? "Queuing…" : "Rerun verification"}
      </button>
      {error ? <span className="notice notice-err">{error}</span> : null}
    </span>
  );
}
