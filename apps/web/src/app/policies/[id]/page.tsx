import { schema } from "@blackbox/db";
import { loadRules } from "@blackbox/engine";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/server";
import { LiveRefresh } from "../../runs/[id]/live";
import { ResolveForm, SignOffForm } from "./forms";

export const metadata: Metadata = { title: "Policy" };

export default async function PolicyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const policy = await db().query.policies.findFirst({ where: eq(schema.policies.id, id) });
  if (!policy) notFound();
  const rules = await loadRules(db(), id);
  const open = rules.filter((r) => r.status !== "ready");
  return (
    <main className="page">
      <LiveRefresh active={policy.status === "compiling"} />
      <div className="crumbs">
        <Link href="/policies">Policies</Link> <span aria-hidden="true">/</span>{" "}
        <span className="mono">{policy.id}</span>
      </div>
      <div className="page-head">
        <div>
          <h1>{policy.title}</h1>
          <p className="sub">
            {policy.status === "compiling" &&
              "Compiling with Muse Spark. This page updates on its own."}
            {policy.status === "awaiting_signoff" &&
              `Read each rule back. ${open.length > 0 ? `${open.length} need${open.length === 1 ? "s" : ""} an answer before sign-off.` : "Sign off when they match the policy."}`}
            {policy.status === "signed_off" &&
              "Signed off. Runs checked against this policy use exactly these rules."}
            {policy.status === "failed" &&
              "Compilation failed. This is our problem, not your document's; upload it again."}
          </p>
        </div>
        {policy.status === "awaiting_signoff" ? (
          <SignOffForm policyId={policy.id} disabled={open.length > 0} />
        ) : null}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 960 }}>
        {rules.map((r) => (
          <section key={r.id} className="card" aria-label={`Rule ${r.id}`}>
            <div className="row">
              <span
                className={`chip ${r.status === "ready" ? (r.signedOffBy ? "chip-ok" : "chip-info") : "chip-rev"}`}
              >
                {r.id}
              </span>
              <span className="mono muted">{r.type}</span>
              <span className="spacer" />
              {r.signedOffBy ? <span className="muted">Signed off by {r.signedOffBy}</span> : null}
            </div>
            <p style={{ margin: 0, fontSize: 15 }}>{r.text}</p>
            <p className="muted" style={{ margin: 0 }}>
              Source, page {r.sourceSpan.page}: “{r.sourceSpan.quote}”
            </p>
            <p className="mono muted" style={{ margin: 0 }}>
              {JSON.stringify(r.params)}
            </p>
            {r.status === "needs_clarification" ? (
              <div
                className="notice notice-rev"
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                <strong>{r.clarification}</strong>
                <ResolveForm policyId={policy.id} ruleId={r.id} type={r.type} />
              </div>
            ) : null}
          </section>
        ))}
        {rules.length === 0 && policy.status !== "compiling" ? (
          <div className="card empty">
            <strong>No rules</strong>
          </div>
        ) : null}
      </div>
    </main>
  );
}
