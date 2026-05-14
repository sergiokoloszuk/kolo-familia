"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", label: "Início", exact: true },
  { href: "/admin/aulas", label: "Aulas" },
  { href: "/admin/mensagens", label: "Mensagens" },
  { href: "/admin/boas-praticas", label: "Boas Práticas" },
  { href: "/admin/skills", label: "Skills" },
  { href: "/admin/campanhas", label: "Campanhas" },
  { href: "/admin/regras", label: "Regras" },
  { href: "/admin/ayla", label: "Ayla" },
  { href: "/admin/convites", label: "Convites" },
  { href: "/admin/beta", label: "Beta" },
  { href: "/admin/observabilidade", label: "Observabilidade" },
  { href: "/admin/admins", label: "Admins" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap items-center gap-1 border-b pb-3">
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
