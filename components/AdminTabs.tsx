"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/roadmaps", label: "Roadmaps" },
  { href: "/admin/content", label: "Content" },
  { href: "/admin/knowledge", label: "Knowledge" },
];

export function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav className="mt-6 flex flex-wrap gap-2 border-b border-polaris-500/15 pb-3">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm transition-colors duration-150",
              active
                ? "bg-polaris-500 text-white"
                : "text-ink-dim hover:bg-polaris-50 hover:text-ink border border-polaris-200 bg-white",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

