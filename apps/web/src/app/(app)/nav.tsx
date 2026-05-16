"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/painel", label: "Painel" },
  { href: "/registrar", label: "Registrar" },
  { href: "/conversar", label: "Conversar" },
  { href: "/apoio", label: "Apoio" },
  { href: "/aprender", label: "Aprender" },
  { href: "/galeria", label: "Galeria" },
  { href: "/kolo-vivo", label: "Kolo Vivo" },
  { href: "/relatorios", label: "Relatórios" },
  { href: "/configuracoes", label: "Config." },
  { href: "/assinatura", label: "Assinatura" },
];

export function AppNav({ isAdmin }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const all = isAdmin ? [...items, { href: "/admin", label: "Admin" }] : items;
  return (
    <nav className="hidden items-center gap-1 sm:flex">
      {all.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-white/25 text-white shadow-inner"
                : "text-white/85 hover:bg-white/15 hover:text-white",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
