import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { AppNav } from "./nav";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { user, supabase, family } = await loadFamilyContext();
  if (!family) redirect("/onboarding");
  if (!family.onboarding_completed) redirect("/onboarding");

  const { data: acesso } = await supabase
    .from("controle_acessos")
    .select("ativo")
    .eq("user_id", user.id)
    .maybeSingle();
  const isAdmin = Boolean(acesso?.ativo);

  return (
    <div className="flex min-h-screen flex-col bg-kolo-page">
      <header
        data-app-chrome
        className="sticky top-0 z-10 bg-kolo-header text-white shadow-md print:hidden"
      >
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-6">
          <Link
            href="/painel"
            className="flex items-center"
            aria-label="Kolo Família — painel"
          >
            <Logo size={28} tone="dark" />
          </Link>
          <AppNav isAdmin={isAdmin} />
          <form action="/auth/logout" method="post">
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/15 hover:text-white"
            >
              Sair
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8">
        {children}
      </main>
    </div>
  );
}
