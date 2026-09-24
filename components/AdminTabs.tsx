"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/roadmaps", label: "Roadmaps" },
  { href: "/admin/content", label: "Content" },
  { href: "/admin/notices", label: "Notices" },
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
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors duration-150",
              active
                ? "border-polaris-500 bg-polaris-500 text-white"
                : "border-polaris-500/25 bg-bg-card text-ink hover:bg-bg-soft",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

