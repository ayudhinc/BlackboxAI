import type { Metadata } from "next";
import Link from "next/link";
import { LiveRefresh } from "@/components/live";
import { RunsTable } from "@/components/runs-table";
import { listRuns } from "@/lib/queries";

export const metadata: Metadata = { title: "Runs" };

export default async function RunsPage() {
  const runs = await listRuns();
  return (
    <main className="page">
      <LiveRefresh active={runs.some((r) => !["done", "failed"].includes(r.status))} />
      <div className="page-head">
        <div>
          <h1>Runs</h1>
          <p className="sub">Every agent run BlackboxAI has verified, newest first.</p>
        </div>
        <Link href="/runs/new" className="btn btn-primary">
          Verify a recording
        </Link>
      </div>
      {runs.length === 0 ? (
        <div className="card empty">
          <strong>No runs yet</strong>
          <span>Upload an agent's screen recording to get a step-level verdict with evidence.</span>
          <Link href="/runs/new" className="btn btn-primary">
            Verify a recording
          </Link>
        </div>
      ) : (
        <RunsTable runs={runs} />
      )}
    </main>
  );
}
