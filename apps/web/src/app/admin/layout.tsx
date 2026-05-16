import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-kolo-page">
      <header className="sticky top-0 z-10 bg-kolo-header text-white shadow-md print:hidden">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-6">
          <Link
            href="/admin"
            className="flex items-center gap-2.5 text-white"
            aria-label="Kolo Família · Admin"
          >
            <Logo size={36} />
            <span className="font-heading text-base font-bold tracking-tight">
              Kolo Família · Admin
            </span>
          </Link>
          <Link
            href="/painel"
            className="rounded-md px-3 py-1.5 text-sm font-medium text-white/85 transition-colors hover:bg-white/15 hover:text-white"
          >
            Voltar pro app
          </Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8">{children}</main>
    </div>
  );
}
