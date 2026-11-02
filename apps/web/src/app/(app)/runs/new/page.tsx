import type { Metadata } from "next";
import Link from "next/link";
import { signedOffPolicies } from "@/lib/queries";
import { UploadForm } from "./upload-form";

export const metadata: Metadata = { title: "Verify a recording" };

export default async function NewRunPage() {
  const policies = await signedOffPolicies();
  return (
    <main className="page">
      <div className="crumbs">
        <Link href="/runs">Runs</Link> <span aria-hidden="true">/</span> New
      </div>
      <div className="page-head">
        <div>
          <h1>Verify a recording</h1>
          <p className="sub">
            Any agent, any vendor, no SDK. Upload what the agent did on screen and the task it was
            given; BlackboxAI returns the steps, the rules it broke and whether the task was really
            done.
          </p>
        </div>
      </div>
      <div className="card">
        <UploadForm policies={policies} />
      </div>
    </main>
  );
}
