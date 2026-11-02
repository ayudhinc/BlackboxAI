import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";
import { Nav } from "@/components/nav";
import { queueCount } from "@/lib/queries";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "BlackboxAI", template: "%s · BlackboxAI" },
  description: "Flight recorder and verifier for AI agents that operate software through screens.",
};

export const dynamic = "force-dynamic";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export default async function RootLayout({ children }: { children: ReactNode }) {
  const queue = await queueCount().catch(() => 0);
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body>
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
            <span className="workspace">Sandbox workspace</span>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
