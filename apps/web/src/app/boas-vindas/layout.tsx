import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";

export default function BoasVindasLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-kolo-linha">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center px-6">
          <Logo tone="light" size={24} />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-12 md:py-16">
        {children}
      </main>
    </div>
  );
}
