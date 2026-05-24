"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BookOpen,
  ChevronRight,
  CreditCard,
  HelpCircle,
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
  { href: "/evolucao", label: "Evolução", icon: TrendingUp },
  { href: "/historias", label: "Histórias", icon: BookOpen }, // placeholder em NAV-5
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

interface SidebarProps {
  isAdmin: boolean;
  nomeUsuario: string;
  userInitial: string;
  diasNaKolo: number | null;
  criancaAtiva: {
    id: string;
    nome: string;
    idade: number | null;
  } | null;
  sugestoesPendentes: number;
}

export function Sidebar({
  isAdmin,
  nomeUsuario,
  userInitial,
  diasNaKolo,
  criancaAtiva,
  sugestoesPendentes,
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

      {/* Seletor de criança ativa (se houver). Peso visual reduzido pra
          conteúdo virar protagonista: fundo mais lavado, avatar menor,
          tipografia semibold em vez de bold. */}
      {criancaAtiva && (
        <Link
          href="/kolo-vivo"
          aria-label={`Abrir o Kolo Vivo de ${criancaAtiva.nome}`}
          className="flex items-center gap-3 rounded-2xl bg-kolo-lilas-bg-2/60 px-3 py-2.5 transition-colors hover:bg-kolo-lilas-bg-2"
        >
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-yellow to-brand-yellow-dark font-heading text-[15px] font-semibold text-brand-purple-dark"
          >
            {criancaAtiva.nome[0]?.toUpperCase() ?? "?"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {criancaAtiva.nome}
            </p>
            {criancaAtiva.idade != null && (
              <p className="text-xs text-muted-foreground">
                {criancaAtiva.idade} anos
              </p>
            )}
          </div>
          <ChevronRight
            className="size-3.5 shrink-0 text-muted-foreground/70"
            aria-hidden
          />
        </Link>
      )}

      {/* Navegação plana — 5 itens. Item ativo segue o protótipo §nav-item.active:
          bg lilás claro + texto roxo escuro + traço amarelo lateral 3px (não bg
          sólido roxo). Ícones com stroke 1.5 pra menos peso visual. */}
      <nav className="flex flex-1 flex-col gap-1" aria-label="Navegação principal">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-kolo-lilas-bg font-semibold text-brand-purple-dark"
                  : "font-medium text-muted-foreground hover:bg-kolo-lilas-bg-2/70 hover:text-foreground",
              )}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-sm bg-brand-yellow"
                />
              )}
              <Icon
                className={cn(
                  "size-[17px] shrink-0 stroke-[1.5]",
                  active ? "text-brand-purple-dark" : "text-muted-foreground/80",
                )}
                aria-hidden
              />
              <span className="flex-1">{item.label}</span>
              {item.href === "/kolo-vivo" && sugestoesPendentes > 0 && (
                <span
                  aria-label={`${sugestoesPendentes} para revisar`}
                  className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand-yellow px-1.5 text-xs font-bold text-brand-purple-dark"
                >
                  {sugestoesPendentes}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Rodapé — Configurações/Assinatura como ícones discretos + user info. */}
      <div className="flex flex-col gap-3 border-t border-kolo-linha pt-4">
        {/* Acesso à área da equipe — só admin vê. Rotulado (não só ícone)
            pra não passar despercebido, mas fora da navegação da família. */}
        {isAdmin && (
          <Link
            href="/admin"
            aria-label="Área administrativa"
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
              isActive(pathname, "/admin")
                ? "bg-kolo-lilas-bg font-semibold text-brand-purple-dark"
                : "font-medium text-muted-foreground hover:bg-kolo-lilas-bg-2/70 hover:text-foreground",
            )}
          >
            <Shield
              className="size-[17px] shrink-0 stroke-[1.5] text-brand-purple"
              aria-hidden
            />
            <span className="flex-1">Admin</span>
            <ChevronRight
              className="size-3.5 shrink-0 text-muted-foreground/70"
              aria-hidden
            />
          </Link>
        )}
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
            <Settings className="size-4 stroke-[1.5]" aria-hidden />
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
            <CreditCard className="size-4 stroke-[1.5]" aria-hidden />
          </Link>
          <Link
            href="/ajuda"
            aria-label="Ajuda"
            title="Ajuda"
            className={cn(
              "inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-kolo-lilas-bg-2 hover:text-foreground",
              isActive(pathname, "/ajuda") && "bg-kolo-lilas-bg-2 text-foreground",
            )}
          >
            <HelpCircle className="size-4 stroke-[1.5]" aria-hidden />
          </Link>
          <form action="/auth/logout" method="post" className="ml-auto">
            <button
              type="submit"
              aria-label="Sair"
              className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-kolo-lilas-bg-2 hover:text-foreground"
            >
              <LogOut className="size-4 stroke-[1.5]" aria-hidden />
            </button>
          </form>
        </div>

        <Link
          href="/configuracoes/conta"
          title="Editar meu nome e como quero ser chamado(a)"
          aria-label="Minha conta — editar meu nome e apelido"
          className="flex items-center gap-3 rounded-xl bg-kolo-lilas-bg-2 px-3 py-2.5 transition-colors hover:bg-kolo-lilas-bg"
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
        </Link>
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
