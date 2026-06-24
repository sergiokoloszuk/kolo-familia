"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Página-relâmpago pós-cadastro. Existe pra contas criadas via OAuth (Google),
 * que pulam o formulário de cadastro e não disparariam o `form_submit`. Como
 * está no grupo (auth), o GTM carrega aqui → dispara a conversão e encaminha
 * pro onboarding. (O cadastro por e-mail dispara no próprio /signup, então não
 * passa por aqui — sem contagem dupla.) GTM NÃO vai pro /onboarding (privacidade).
 */
export default function CadastroOkPage() {
  const router = useRouter();

  useEffect(() => {
    try {
      const w = window as unknown as { dataLayer?: Record<string, unknown>[] };
      w.dataLayer = w.dataLayer || [];
      w.dataLayer.push({ event: "form_submit" });
    } catch {
      // tracking nunca pode segurar o fluxo
    }
    // Pequena espera pra a tag de conversão disparar antes de navegar.
    const t = setTimeout(() => router.replace("/onboarding"), 700);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <p className="font-heading text-xl text-foreground">Tudo certo!</p>
      <p className="text-sm text-muted-foreground">Preparando sua conta…</p>
    </div>
  );
}
