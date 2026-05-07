import Link from "next/link";
import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
          <Link href="/admin" className="font-heading text-lg font-semibold">
            Kolo Família · Admin
          </Link>
          <Link href="/painel" className="text-sm text-muted-foreground hover:text-foreground">
            Voltar pro app
          </Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8">{children}</main>
    </div>
  );
}
