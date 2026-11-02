import type { Metadata } from "next";
import { RunsTable } from "@/components/runs-table";
import { reviewQueue } from "@/lib/queries";

export const metadata: Metadata = { title: "Review queue" };

export default async function QueuePage() {
  const runs = await reviewQueue();
  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Review queue</h1>
          <p className="sub">
            Runs whose verdict confidence fell below 0.80, or that raised a finding a person must
            check. Open one to approve or overrule it.
          </p>
        </div>
      </div>
      {runs.length === 0 ? (
        <div className="card empty">
          <strong>Nothing to review</strong>
          <span>
            Every verified run was decided automatically with high confidence, or has already been
            reviewed.
          </span>
        </div>
      ) : (
        <RunsTable runs={runs} />
      )}
    </main>
  );
}
