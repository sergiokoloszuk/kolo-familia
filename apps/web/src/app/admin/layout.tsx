import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { AdminNav } from "./nav";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-kolo-creme">
      {/* Header institucional — roxo deep (Kolo Inclusão, Manual §02). */}
      <header
        data-app-chrome
        className="sticky top-0 z-10 bg-gradient-to-br from-brand-purple-deep via-brand-purple-dark to-brand-purple text-white print:hidden"
      >
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-6">
          <Link
            href="/admin"
            className="flex items-center gap-3 text-white"
            aria-label="Kolo Família · Admin"
          >
            <Logo size={28} tone="dark" />
            <span className="hidden text-xs font-bold uppercase tracking-[0.18em] text-brand-yellow sm:inline">
              Admin
            </span>
          </Link>
          <Link
            href="/painel"
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-sm font-medium text-white/85 backdrop-blur transition-colors hover:bg-white/15 hover:text-white"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Voltar pro app
          </Link>
        </div>
        <div className="mx-auto w-full max-w-6xl px-6 pb-3">
          <AdminNav />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8">
        {children}
      </main>
    </div>
  );
}
