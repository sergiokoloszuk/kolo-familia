"use client";

import { useSyncExternalStore } from "react";
import { COOKIE, EVENTO_ESCOLHA, lerEscolha, observarEscolha } from "./cookie-choice";

/**
 * Revogar ou mudar a escolha tem que ser tão fácil quanto escolher (LGPD, art.
 * 8º, § 5º). Antes, a única saída era apagar o cookie nas configurações do
 * navegador (auditoria de 12/11/2026). Apagar a escolha faz o aviso voltar na
 * hora, com as mesmas duas opções. O GTM já carregado na página atual só some
 * na próxima navegação — o aviso não promete o contrário.
 *
 * Fica fora de `cookie-choice.tsx` de propósito: aquele arquivo é o aviso, e
 * `cookie-choice.test.ts` prende que ele tem exatamente dois botões de mesmo
 * peso (aceitar e recusar).
 */
export function MudarEscolhaDeCookies() {
  const escolha = useSyncExternalStore(observarEscolha, lerEscolha, () => null);

  function reabrir() {
    document.cookie = `${COOKIE}=; Max-Age=0; Path=/; SameSite=Lax; Secure`;
    window.dispatchEvent(new Event(EVENTO_ESCOLHA));
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <span className="text-sm text-muted-foreground">
        {escolha === "aceitos"
          ? "Sua escolha atual: cookies opcionais aceitos."
          : escolha === "recusados"
            ? "Sua escolha atual: cookies opcionais recusados."
            : "Você ainda não fez uma escolha."}
      </span>
      {escolha !== null ? (
        <button
          type="button"
          onClick={reabrir}
          className="rounded-full border border-brand-purple px-4 py-2 text-sm font-semibold text-brand-purple"
        >
          Mudar minha escolha
        </button>
      ) : null}
    </div>
  );
}
