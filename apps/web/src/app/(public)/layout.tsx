import Link from "next/link";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-6">
          <Link href="/" className="font-heading text-lg font-semibold">
            Kolo Família
          </Link>
          <nav className="hidden items-center gap-1 text-sm sm:flex">
            <Link
              href="/precos"
              className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Preços
            </Link>
            <Link
              href="/sobre"
              className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Sobre
            </Link>
            <Link
              href="/contato"
              className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
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

      <footer className="border-t bg-muted/30">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <div className="flex flex-col gap-1">
            <p className="font-heading text-base font-semibold text-foreground">
              Kolo Família
            </p>
            <p className="max-w-xs">
              Estratégia personalizada pro dia a dia da família atípica. Não é
              diagnóstico — quem diagnostica é profissional de saúde.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            <div className="flex flex-col gap-1">
              <p className="text-xs uppercase text-muted-foreground/70">
                Produto
              </p>
              <Link href="/precos" className="hover:text-foreground">
                Preços
              </Link>
              <Link href="/sobre" className="hover:text-foreground">
                Sobre
              </Link>
              <Link href="/contato" className="hover:text-foreground">
                Contato
              </Link>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-xs uppercase text-muted-foreground/70">
                Legal
              </p>
              <Link href="/privacidade" className="hover:text-foreground">
                Privacidade
              </Link>
              <Link href="/termos" className="hover:text-foreground">
                Termos de uso
              </Link>
              <Link href="/cookies" className="hover:text-foreground">
                Cookies
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
