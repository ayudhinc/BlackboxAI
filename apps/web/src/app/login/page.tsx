import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentOperator } from "@/lib/auth";
import { LoginForm } from "./form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  // Validated against the session table, never cookie presence alone.
  if (await currentOperator()) redirect("/runs");
  return (
    <main className="page" style={{ maxWidth: 440, paddingTop: 96 }}>
      <div className="card" style={{ gap: 18 }}>
        <div className="brand">
          <svg aria-hidden="true" width="26" height="26" viewBox="0 0 26 26" fill="none">
            <circle cx="13" cy="13" r="11" stroke="#111827" strokeWidth="2" />
            <circle cx="13" cy="13" r="4.5" fill="#C2570C" />
          </svg>
          BlackboxAI
        </div>
        <div>
          <h1 style={{ fontSize: 20 }}>Sign in</h1>
          <p className="sub">Operator access to the verification workspace.</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
