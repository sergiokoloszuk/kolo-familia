import Link from "next/link";
import type { ReactNode } from "react";
import { Mail } from "lucide-react";

// Glyph Instagram inline — Lucide deprecou o ícone, mantemos o mesmo desenho.
function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-kolo-linha bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-6 md:px-8">
          <Link
            href="/"
            className="flex items-center"
            aria-label="Página inicial Kolo Família"
          >
            <Logo size={28} tone="light" />
          </Link>
          <nav className="hidden items-center gap-1 text-sm sm:flex">
            <Link
              href="/precos"
              className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-kolo-lilas-bg-2 hover:text-brand-purple-dark"
            >
              Preços
            </Link>
            <Link
              href="/sobre"
              className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-kolo-lilas-bg-2 hover:text-brand-purple-dark"
            >
              Sobre
            </Link>
            <Link
              href="/contato"
              className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-kolo-lilas-bg-2 hover:text-brand-purple-dark"
            >
              Contato
            </Link>
            <Link
              href="/login"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "ml-2",
              )}
            >
              Entrar
            </Link>
            <Link
              href="/signup"
              className={cn(buttonVariants({ size: "sm" }))}
            >
              Começar grátis
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      {/* Footer obrigatório — Manual §17: fundo roxo-deep + contatos oficiais. */}
      <footer className="bg-brand-purple-deep text-white/70">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-6 py-16 md:grid-cols-[1.4fr_1fr_1fr] md:gap-12 md:px-8">
          <div className="flex flex-col gap-4">
            <Link href="/" aria-label="Página inicial Kolo Família">
              <Logo size={32} tone="dark" />
            </Link>
            <p className="max-w-xs text-sm text-white/55 leading-relaxed">
              Apoio prático para famílias atípicas. Não é diagnóstico — quem
              diagnostica é profissional de saúde.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-yellow">
              Conheça
            </p>
            <Link href="/precos" className="text-sm text-white/75 transition-colors hover:text-white">
              Preços
            </Link>
            <Link href="/sobre" className="text-sm text-white/75 transition-colors hover:text-white">
              Sobre
            </Link>
            <Link href="/contato" className="text-sm text-white/75 transition-colors hover:text-white">
              Contato
            </Link>
            <Link href="/privacidade" className="text-sm text-white/75 transition-colors hover:text-white">
              Privacidade
            </Link>
            <Link href="/termos" className="text-sm text-white/75 transition-colors hover:text-white">
              Termos de uso
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-yellow">
              Contato
            </p>
            <a
              href="mailto:kolosuporte@gmail.com"
              className="inline-flex items-center gap-2 text-sm text-white/75 transition-colors hover:text-white"
            >
              <Mail className="size-4 shrink-0" aria-hidden />
              kolosuporte@gmail.com
            </a>
            <a
              href="https://instagram.com/kolo.inclusao"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-white/75 transition-colors hover:text-white"
            >
              <InstagramIcon className="size-4 shrink-0" />
              @kolo.inclusao
            </a>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-6 py-6 text-xs text-white/50 sm:flex-row sm:justify-between md:px-8">
            <p>© {new Date().getFullYear()} Kolo Família. Todos os direitos reservados.</p>
            <p>Feito com cuidado pra famílias atípicas no Brasil.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
