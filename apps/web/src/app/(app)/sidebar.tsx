"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  BookOpen,
  CreditCard,
  FileText,
  Heart,
  Home,
  Image as ImageIcon,
  LogOut,
  Menu,
  MessageCircle,
  Settings,
  Shield,
  Users,
  X,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Dia a dia",
    items: [
      { href: "/painel", label: "Painel", icon: Home },
      { href: "/registrar", label: "Registrar dia", icon: FileText },
      { href: "/conversar", label: "Conversar", icon: MessageCircle },
    ],
  },
  {
    label: "Família",
    items: [
      { href: "/kolo-vivo", label: "Perfil família", icon: Users },
      { href: "/aprender", label: "Aprender", icon: BookOpen },
      { href: "/galeria", label: "Galeria", icon: ImageIcon },
      { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
    ],
  },
  {
    label: "Pra mim",
    items: [
      { href: "/apoio", label: "Cuidar de mim", icon: Heart },
      { href: "/configuracoes", label: "Configurações", icon: Settings },
      { href: "/assinatura", label: "Assinatura", icon: CreditCard },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar({
  isAdmin,
  userEmail,
  userInitial,
}: {
  isAdmin: boolean;
  userEmail: string;
  userInitial: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Fecha o drawer ao mudar de rota (mobile).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Trava scroll do body quando drawer aberto (mobile).
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const sidebarContent = (
    <>
      {/* Logo no topo. */}
      <Link
        href="/painel"
        className="inline-flex items-start"
        aria-label="Página inicial Kolo Família"
      >
        <Logo size={28} tone="light" />
      </Link>

      {/* Grupos de navegação. */}
      <nav className="flex flex-1 flex-col gap-8 overflow-y-auto" aria-label="Navegação principal">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-1">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">
              {group.label}
            </p>
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                    active
                      ? "bg-brand-purple font-semibold text-white"
                      : "font-medium text-muted-foreground hover:bg-kolo-lilas-bg-2 hover:text-foreground",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-[18px] shrink-0 stroke-[1.8]",
                      active && "text-brand-yellow",
                    )}
                    aria-hidden
                  />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}

        {isAdmin && (
          <div className="flex flex-col gap-1">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">
              Equipe
            </p>
            <Link
              href="/admin"
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                isActive(pathname, "/admin")
                  ? "bg-brand-purple font-semibold text-white"
                  : "font-medium text-muted-foreground hover:bg-kolo-lilas-bg-2 hover:text-foreground",
              )}
            >
              <Shield
                className={cn(
                  "size-[18px] shrink-0 stroke-[1.8]",
                  isActive(pathname, "/admin") && "text-brand-yellow",
                )}
                aria-hidden
              />
              Admin
            </Link>
          </div>
        )}
      </nav>

      {/* Footer da sidebar — user + sair. */}
      <div className="border-t border-kolo-linha pt-4">
        <div className="flex items-center gap-3 px-2 py-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-purple text-sm font-semibold text-white">
            {userInitial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-foreground">
              {userEmail}
            </p>
          </div>
          <form action="/auth/logout" method="post">
            <button
              type="submit"
              aria-label="Sair"
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-kolo-lilas-bg-2 hover:text-foreground"
            >
              <LogOut className="size-4 stroke-[1.8]" aria-hidden />
            </button>
          </form>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Top bar mobile — Logo + hamburger. */}
      <div
        data-app-chrome
        className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-kolo-linha bg-white px-4 lg:hidden print:hidden"
      >
        <Link href="/painel" aria-label="Página inicial Kolo Família">
          <Logo size={22} tone="light" />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          aria-expanded={open}
          className="inline-flex size-10 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-kolo-lilas-bg-2"
        >
          <Menu className="size-5 stroke-[1.8]" aria-hidden />
        </button>
      </div>

      {/* Overlay mobile quando drawer aberto. */}
      {open && (
        <div
          aria-hidden
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-brand-purple-deep/60 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar — sticky desktop / drawer mobile. */}
      <aside
        aria-label="Navegação principal"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col gap-8 overflow-y-auto border-r border-kolo-linha bg-white px-5 py-7 shadow-xl transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:z-10 lg:h-screen lg:w-[260px] lg:translate-x-0 lg:shadow-none print:hidden",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Botão fechar (só mobile). */}
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Fechar menu"
          className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-kolo-lilas-bg-2 hover:text-foreground lg:hidden"
        >
          <X className="size-5 stroke-[1.8]" aria-hidden />
        </button>

        {sidebarContent}
      </aside>
    </>
  );
}
