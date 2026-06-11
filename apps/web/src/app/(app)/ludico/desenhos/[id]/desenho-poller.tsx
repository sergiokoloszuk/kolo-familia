"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

/** Enquanto a análise roda em segundo plano, atualiza a tela sozinha. */
export function DesenhoPoller() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [router]);

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-brand-purple/20 bg-kolo-lilas-bg-2/50 px-4 py-3 text-sm text-brand-purple-dark">
      <Sparkles className="size-4 animate-pulse" aria-hidden />
      Observando o desenho com calma… leva alguns segundos, a tela atualiza sozinha.
    </div>
  );
}
