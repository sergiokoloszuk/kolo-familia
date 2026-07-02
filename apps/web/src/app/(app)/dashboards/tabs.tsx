"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboards", label: "Aquisição & Conversão", exact: true },
  { href: "/dashboards/comportamento", label: "Comportamento & Uso" },
  { href: "/dashboards/jornada", label: "Jornada do Trial" },
];

/** Alterna entre os dois dashboards (mesma fonte de dados, recortes diferentes). */
export function DashboardTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Dashboards">
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
              active
                ? "bg-brand-purple text-white"
                : "bg-foreground/[0.05] text-muted-foreground hover:bg-foreground/[0.1]",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
