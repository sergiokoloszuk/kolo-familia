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
  { href: "/kolo-vivo", label: "Kolo Vivo" },
  { href: "/configuracoes", label: "Configurações" },
  { href: "/assinatura", label: "Assinatura" },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 sm:flex">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
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
