"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const SUB = [
  { href: "/dashboards/crm", label: "Abordar", exact: true },
  { href: "/dashboards/crm/ayla", label: "Ayla" },
  { href: "/dashboards/crm/config", label: "Configuração" },
];

/** Sub-abas dentro do CRM. */
export function CrmNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-2" aria-label="CRM">
      {SUB.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "rounded-full px-3 py-1 text-sm font-medium transition-colors",
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
