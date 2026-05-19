"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  CreditCard,
  Home,
  Leaf,
  LogOut,
  Menu,
  Settings,
  Shield,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
};

/**
 * Menu principal — exatamente o protótipo (19/05/2026):
 *   Home · Kolo Vivo · Estratégias · Evolução · Histórias
 *
 * Rotas `/estrategias`, `/evolucao` e `/historias` ainda não existem
 * como rotas próprias — apontam temporariamente para o conteúdo legacy
 * mais próximo. Substituídos nas fases NAV-3, NAV-4 e NAV-5.
 *
 * Configurações e Assinatura saem do menu principal — viram links
 * discretos no rodapé, ao lado do user.
 *
 * Itens órfãos (`/aprender`, `/registrar`, `/relatorios`, `/conversar`,
 * `/apoio`, `/galeria`) saem do menu mas as rotas continuam respondendo
 * via URL direta.
 */
const NAV_ITEMS: NavItem[] = [
  { href: "/painel", label: "Home", icon: Home },
  { href: "/kolo-vivo", label: "Kolo Vivo", icon: Leaf },
  { href: "/estrategias", label: "Estratégias", icon: Sparkles },
  { href: "/relatorios", label: "Evolução", icon: TrendingUp }, // → /evolucao em NAV-4
  { href: "/historias", label: "Histórias", icon: BookOpen }, // placeholder em NAV-5
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

interface SidebarProps {
  isAdmin: boolean;
  nomeUsuario: string;
  userEmail: string;
  userInitial: string;
  diasNaKolo: number | null;
  criancaAtiva: {
    id: string;
    nome: string;
    idade: number | null;
  } | null;
}

export function Sidebar({
  isAdmin,
  nomeUsuario,
  userEmail,
  userInitial,
  diasNaKolo,
  criancaAtiva,
}: SidebarProps) {
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

      {/* Seletor de criança ativa (se houver). */}
      {criancaAtiva && (
        <div className="flex items-center gap-3 rounded-2xl bg-kolo-lilas-bg-2 p-3 transition-colors hover:bg-kolo-lilas-bg">
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-yellow to-brand-yellow-dark font-heading text-base font-semibold text-brand-purple-dark shadow-sm"
          >
            {criancaAtiva.nome[0]?.toUpperCase() ?? "?"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-foreground">
              {criancaAtiva.nome}
            </p>
            {criancaAtiva.idade != null && (
              <p className="text-xs text-muted-foreground">
                {criancaAtiva.idade} anos
              </p>
            )}
          </div>
          <ChevronDown
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-hidden
          />
        </div>
      )}

      {/* Navegação plana — 5 itens (sem grupos). */}
      <nav className="flex flex-1 flex-col gap-1" aria-label="Navegação principal">
        {NAV_ITEMS.map((item) => {
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

        {isAdmin && (
          <Link
            href="/admin"
            className={cn(
              "mt-4 flex items-center gap-3 rounded-xl border border-kolo-linha px-3 py-2.5 text-sm transition-colors",
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
        )}
      </nav>

      {/* Rodapé — Configurações/Assinatura como ícones discretos + user info. */}
      <div className="flex flex-col gap-3 border-t border-kolo-linha pt-4">
        <div className="flex items-center gap-1 px-1">
          <Link
            href="/configuracoes"
            aria-label="Configurações"
            className={cn(
              "inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-kolo-lilas-bg-2 hover:text-foreground",
              isActive(pathname, "/configuracoes") &&
                "bg-kolo-lilas-bg-2 text-foreground",
            )}
          >
            <Settings className="size-4 stroke-[1.8]" aria-hidden />
          </Link>
          <Link
            href="/assinatura"
            aria-label="Assinatura"
            className={cn(
              "inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-kolo-lilas-bg-2 hover:text-foreground",
              isActive(pathname, "/assinatura") &&
                "bg-kolo-lilas-bg-2 text-foreground",
            )}
          >
            <CreditCard className="size-4 stroke-[1.8]" aria-hidden />
          </Link>
          <form action="/auth/logout" method="post" className="ml-auto">
            <button
              type="submit"
              aria-label="Sair"
              className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-kolo-lilas-bg-2 hover:text-foreground"
            >
              <LogOut className="size-4 stroke-[1.8]" aria-hidden />
            </button>
          </form>
        </div>

        <div
          className="flex items-center gap-3 rounded-xl bg-kolo-lilas-bg-2 px-3 py-2.5"
          title={userEmail}
        >
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-purple font-heading text-sm font-semibold text-white"
          >
            {userInitial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-foreground">
              {nomeUsuario}
            </p>
            {diasNaKolo !== null && (
              <p className="text-xs text-muted-foreground">
                {diasNaKolo === 0
                  ? "Entrou hoje"
                  : `${diasNaKolo} ${diasNaKolo === 1 ? "dia" : "dias"} na Kolo`}
              </p>
            )}
          </div>
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
          "fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col gap-6 overflow-y-auto border-r border-kolo-linha bg-white px-5 py-7 shadow-xl transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:z-10 lg:h-screen lg:w-[260px] lg:translate-x-0 lg:shadow-none print:hidden",
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
