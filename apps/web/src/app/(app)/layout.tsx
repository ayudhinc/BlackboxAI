import Link from "next/link";
import type { ReactNode } from "react";
import { Nav } from "@/components/nav";
import { requireOperator } from "@/lib/auth";
import { queueCount } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** The single gatekeeper for every page in the workspace. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const operator = await requireOperator();
  const queue = await queueCount();
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/runs" className="brand">
            <svg aria-hidden="true" width="26" height="26" viewBox="0 0 26 26" fill="none">
              <circle cx="13" cy="13" r="11" stroke="#111827" strokeWidth="2" />
              <circle cx="13" cy="13" r="4.5" fill="#C2570C" />
            </svg>
            BlackboxAI
          </Link>
          <Nav queue={queue} />
          <span className="workspace">{operator.name}</span>
          <form action="/api/sign-out" method="post">
            <button type="submit" className="btn" style={{ minHeight: 34 }}>
              Sign out
            </button>
          </form>
        </div>
      </header>
      {children}
    </>
  );
}
