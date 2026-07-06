"use client";

import { useState } from "react";

/**
 * Botão de teste do cadastro NOVO. Abre /testar-onboarding, que seta o cookie
 * kolo_onb=novo no servidor e manda pro /signup — quem abrir vê o fluxo novo (no
 * modo "Teste"); os leads reais seguem no antigo. Como quem testa costuma estar
 * logado, o jeito certo é abrir numa ABA ANÔNIMA (o link fica pra copiar).
 */
export function TestarCadastroNovo() {
  const [copiado, setCopiado] = useState(false);

  function copiarLink() {
    try {
      const url = `${window.location.origin}/testar-onboarding`;
      navigator.clipboard?.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        onClick={() => window.open("/testar-onboarding", "_blank")}
        className="rounded-full bg-brand-purple px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-purple/90"
      >
        ▶ Abrir um cadastro de teste
      </button>
      <button onClick={copiarLink} className="text-xs font-medium text-brand-purple underline">
        {copiado ? "link copiado ✓" : "copiar o link pra abrir numa aba anônima"}
      </button>
      <p className="text-xs text-muted-foreground">
        Dica: como você está logada, abra numa <strong>aba anônima</strong> (Ctrl+Shift+N) e cole o
        link — aí você vive o cadastro como um lead novo, do zero.
      </p>
    </div>
  );
}
