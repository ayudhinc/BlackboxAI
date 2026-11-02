"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/runs", label: "Runs" },
  { href: "/queue", label: "Review queue" },
  { href: "/policies", label: "Policies" },
];

export function Nav({ queue }: { queue: number }) {
  const path = usePathname();
  return (
    <nav aria-label="Primary" className="nav">
      {ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={path.startsWith(item.href) ? "page" : undefined}
        >
          {item.label}
          {item.href === "/queue" && queue > 0 ? <span className="count">{queue}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
