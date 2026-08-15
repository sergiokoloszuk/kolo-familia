"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", label: "Início", exact: true },
  { href: "/admin/familias", label: "Famílias" },
  { href: "/admin/aulas", label: "Aulas" },
  { href: "/admin/mensagens", label: "Mensagens" },
  { href: "/admin/boas-praticas", label: "Boas Práticas" },
  { href: "/admin/skills", label: "Skills" },
  { href: "/admin/prompts", label: "Prompts" },
  { href: "/admin/inteligencia", label: "Inteligência da Ayla" },
  { href: "/admin/vetos", label: "Vetos" },
  { href: "/admin/campanhas", label: "Campanhas" },
  { href: "/admin/regras", label: "Regras" },
  { href: "/admin/ayla", label: "Ayla" },
  { href: "/admin/padroes", label: "Padrões" },
  { href: "/admin/backfill-areas", label: "Etiquetar histórico" },
  { href: "/admin/snapshots", label: "Fotos mensais" },
  { href: "/admin/planos-incompletos", label: "Planos sem práticas" },
  { href: "/admin/convites", label: "Convites" },
  { href: "/admin/afiliados", label: "Afiliados" },
  { href: "/admin/cortesias", label: "Cortesias" },
  { href: "/admin/co-acessos", label: "Co-acesso" },
  { href: "/admin/beta", label: "Beta" },
  { href: "/admin/observabilidade", label: "Observabilidade" },
  { href: "/admin/uso-api", label: "Uso de API" },
  { href: "/admin/comportamento", label: "Comportamento" },
  { href: "/admin/jornada", label: "Jornada" },
  { href: "/dashboards", label: "Dashboards" },
  { href: "/admin/admins", label: "Admins" },
  { href: "/admin/teste", label: "Testes" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegação admin"
      className="flex flex-wrap items-center gap-1"
    >
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
              active
                ? "bg-brand-yellow text-brand-purple-dark"
                : "text-white/75 hover:bg-white/15 hover:text-white",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
