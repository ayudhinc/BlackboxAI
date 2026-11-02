import type { Metadata } from "next";
import Link from "next/link";
import { PolicyUploadForm } from "./form";

export const metadata: Metadata = { title: "Upload a policy" };

export default function NewPolicyPage() {
  return (
    <main className="page">
      <div className="crumbs">
        <Link href="/policies">Policies</Link> <span aria-hidden="true">/</span> New
      </div>
      <div className="page-head">
        <div>
          <h1>Upload a policy</h1>
          <p className="sub">
            Muse Spark compiles the document into typed rules with source quotes. Anything ambiguous
            comes back as a question, never a guess.
          </p>
        </div>
      </div>
      <div className="card">
        <PolicyUploadForm />
      </div>
    </main>
  );
}
