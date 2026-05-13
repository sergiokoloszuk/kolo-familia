import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { AppNav } from "./nav";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { family } = await loadFamilyContext();
  if (!family) redirect("/onboarding");
  if (!family.onboarding_completed) redirect("/onboarding");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header
        data-app-chrome
        className="sticky top-0 z-10 border-b border-purple-100/60 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 print:hidden"
      >
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-6">
          <Link
            href="/painel"
            className="flex items-center gap-2.5 text-gray-900"
            aria-label="Kolo Família — painel"
          >
            <Logo size={32} />
            <span className="font-heading text-base font-bold tracking-tight">
              Kolo Família
            </span>
          </Link>
          <AppNav />
          <form action="/auth/logout" method="post">
            <Button type="submit" variant="ghost" size="sm">
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
