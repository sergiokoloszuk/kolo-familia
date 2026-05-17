import Link from "next/link";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-purple-100/60 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-6 md:px-8">
          <Link
            href="/"
            className="flex items-center"
            aria-label="Kolo Família — início"
          >
            <Logo size={28} tone="light" />
          </Link>
          <nav className="hidden items-center gap-1 text-sm sm:flex">
            <Link
              href="/precos"
              className="rounded-md px-3 py-1.5 text-gray-600 hover:bg-purple-50 hover:text-brand-purple-dark"
            >
              Preços
            </Link>
            <Link
              href="/sobre"
              className="rounded-md px-3 py-1.5 text-gray-600 hover:bg-purple-50 hover:text-brand-purple-dark"
            >
              Sobre
            </Link>
            <Link
              href="/contato"
              className="rounded-md px-3 py-1.5 text-gray-600 hover:bg-purple-50 hover:text-brand-purple-dark"
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

      <footer className="bg-gray-900 text-gray-400">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-12 md:flex-row md:justify-between md:px-8">
          <div className="flex flex-col gap-3">
            <Link
              href="/"
              className="flex items-center"
              aria-label="Kolo Família"
            >
              <Logo size={32} tone="dark" />
            </Link>
            <p className="max-w-xs text-sm">
              Apoio prático para famílias no desenvolvimento infantil. Não é
              diagnóstico — quem diagnostica é profissional de saúde.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-12 gap-y-6 text-sm">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Produto
              </p>
              <Link href="/precos" className="hover:text-white">
                Preços
              </Link>
              <Link href="/sobre" className="hover:text-white">
                Sobre
              </Link>
              <Link href="/contato" className="hover:text-white">
                Contato
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Legal
              </p>
              <Link href="/privacidade" className="hover:text-white">
                Privacidade
              </Link>
              <Link href="/termos" className="hover:text-white">
                Termos de uso
              </Link>
              <Link href="/cookies" className="hover:text-white">
                Cookies
              </Link>
            </div>
          </div>
        </div>
        <div className="border-t border-white/5">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-6 py-6 text-xs sm:flex-row sm:justify-between md:px-8">
            <p>© {new Date().getFullYear()} Kolo Família. Todos os direitos reservados.</p>
            <p>Feito com cuidado pra famílias atípicas no Brasil.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
