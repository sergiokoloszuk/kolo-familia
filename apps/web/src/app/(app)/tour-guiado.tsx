"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Tour de boas-vindas (coach marks): destaca cada item do menu, um a um, com um
 * balão explicando o que a página faz. Uma vez só (localStorage), pulável. No
 * mobile, abre o menu antes. Forçável com ?tour=1 (preview do admin).
 */
type Passo = { target: string; titulo: string; texto: string };

const PASSOS: Passo[] = [
  { target: "/painel", titulo: "Home", texto: "Onde o dia começa: o resumo do que está acontecendo e dois ou três caminhos pra seguir agora." },
  { target: "/registrar/diario", titulo: "Registro Diário", texto: "Conte em 30 segundos como foi o dia — humor, sono, o que pegou. Cada registro vira um ponto na Evolução." },
  { target: "/kolo-vivo", titulo: "Perfil", texto: "Conte a socialização, a comunicação, o foco — as orientações saem daqui." },
  { target: "/estrategias", titulo: "Estratégias", texto: "Conte um desafio e receba um plano prático." },
  { target: "/evolucao", titulo: "Evolução", texto: "Conforme você registra os dias, o que mudou vai aparecendo aqui." },
  { target: "/ludico", titulo: "Lúdico", texto: "Histórias, rotina visual, leitura dos desenhos e avatar." },
];

const STORAGE_KEY = "kolo-tour-v1";
type Caixa = { top: number; left: number; width: number; height: number };

export function TourGuiado({ abrirMenu }: { abrirMenu: () => void }) {
  const [ativo, setAtivo] = useState(false);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Caixa | null>(null);

  // Dispara: ?tour=1 (preview) OU primeira visita à Home ainda não vista.
  useEffect(() => {
    let forcar = false;
    let visto = true;
    let naHome = false;
    try {
      forcar = new URLSearchParams(window.location.search).get("tour") === "1";
      visto = localStorage.getItem(STORAGE_KEY) === "1";
      naHome = window.location.pathname === "/painel";
    } catch {}
    if (forcar || (naHome && !visto)) {
      const t = setTimeout(() => {
        abrirMenu();
        setAtivo(true);
      }, 700);
      return () => clearTimeout(t);
    }
  }, [abrirMenu]);

  const medir = useCallback(() => {
    const el = document.querySelector(`[data-tour="${PASSOS[i].target}"]`);
    if (!el) return setRect(null);
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [i]);

  useEffect(() => {
    if (!ativo) return;
    medir();
    const t = setTimeout(medir, 260); // depois da animação do drawer (mobile)
    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", medir);
      window.removeEventListener("scroll", medir, true);
    };
  }, [ativo, medir]);

  function fechar() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
    setAtivo(false);
  }
  function proximo() {
    if (i < PASSOS.length - 1) setI(i + 1);
    else fechar();
  }

  if (!ativo || !rect) return null;

  const p = PASSOS[i];
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  const LARG = 260;
  let left = rect.left + rect.width + 14;
  let top = rect.top;
  if (left + LARG > vw - 8) {
    left = rect.left;
    top = rect.top + rect.height + 12;
  }
  top = Math.max(8, Math.min(top, vh - 220));
  left = Math.max(8, Math.min(left, vw - LARG - 8));

  return (
    <div className="fixed inset-0 z-[70] print:hidden" role="dialog" aria-label="Tour de boas-vindas">
      {/* bloqueia cliques na página durante o tour */}
      <div className="absolute inset-0" onClick={() => {}} />
      {/* spotlight (só visual) */}
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-xl transition-all duration-200"
        style={{
          top: rect.top - 5,
          left: rect.left - 5,
          width: rect.width + 10,
          height: rect.height + 10,
          boxShadow: "0 0 0 9999px rgba(31,10,64,0.62)",
          border: "2px solid #FFBA00",
        }}
      />
      {/* balão */}
      <div className="absolute rounded-2xl bg-white p-4 shadow-2xl" style={{ top, left, width: LARG }}>
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-brand-purple">
          {i + 1} de {PASSOS.length}
        </p>
        <p className="mt-1 font-heading text-base text-foreground">{p.titulo}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{p.texto}</p>
        <div className="mt-3.5 flex items-center justify-between">
          <button onClick={fechar} className="text-xs text-muted-foreground hover:underline">
            Pular
          </button>
          <div className="flex gap-2">
            {i > 0 && (
              <button
                onClick={() => setI(i - 1)}
                className="rounded-full border border-kolo-linha px-3 py-1.5 text-xs font-semibold text-foreground"
              >
                Voltar
              </button>
            )}
            <button
              onClick={proximo}
              className="rounded-full bg-brand-purple px-3.5 py-1.5 text-xs font-semibold text-white"
            >
              {i < PASSOS.length - 1 ? "Próximo" : "Entendi! 🌿"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
