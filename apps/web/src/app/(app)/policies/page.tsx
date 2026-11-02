import type { Metadata } from "next";
import Link from "next/link";
import { ago } from "@/lib/format";
import { listPolicies } from "@/lib/queries";

export const metadata: Metadata = { title: "Policies" };

const STATUS: Record<string, [string, string]> = {
  compiling: ["chip-info", "Compiling…"],
  awaiting_signoff: ["chip-rev", "Awaiting sign-off"],
  signed_off: ["chip-ok", "Signed off"],
  failed: ["chip-vio", "Failed to compile"],
};

export default async function PoliciesPage() {
  const policies = await listPolicies();
  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Policies</h1>
          <p className="sub">
            Operating policies compiled into rules the checkers enforce. Every rule is read back for
            sign-off.
          </p>
        </div>
        <Link href="/policies/new" className="btn btn-primary">
          Upload a policy
        </Link>
      </div>
      {policies.length === 0 ? (
        <div className="card empty">
          <strong>No policies yet</strong>
          <span>
            Upload a policy document. BlackboxAI compiles it into rules and reads each one back for
            you to sign off.
          </span>
          <Link href="/policies/new" className="btn btn-primary">
            Upload a policy
          </Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Policy</th>
                <th>Status</th>
                <th>Rules</th>
                <th>Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((p) => {
                const [cls, label] = STATUS[p.status] ?? ["chip-neutral", p.status];
                return (
                  <tr key={p.id}>
                    <td>
                      <Link
                        href={`/policies/${p.id}`}
                        style={{ fontWeight: 600, color: "var(--ink)" }}
                      >
                        {p.title}
                      </Link>
                    </td>
                    <td>
                      <span className={`chip ${cls}`}>{label}</span>
                    </td>
                    <td>
                      {p.rules}
                      {p.open > 0 ? (
                        <span className="muted"> · {p.open} need clarification</span>
                      ) : null}
                    </td>
                    <td className="muted">{ago(p.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
