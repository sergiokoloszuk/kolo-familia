"use client";

import { useState, useTransition } from "react";
import { MessageCircle, Check, ArrowRight } from "lucide-react";
import { ativarAyla } from "./ativar-actions";

// "+5511999998888" → "(11) 99999-8888" (só pra exibir o número já salvo).
function paraExibir(e164: string | null): string {
  if (!e164) return "";
  const d = e164.replace(/\D/g, "").replace(/^55/, "");
  if (d.length < 10) return "";
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  const meio = resto.length === 9 ? resto.slice(0, 5) : resto.slice(0, 4);
  const fim = resto.length === 9 ? resto.slice(5) : resto.slice(4);
  return `(${ddd}) ${meio}-${fim}`;
}

// Qualquer coisa que a mãe digite → "+55DDDNUMERO".
function normalizar(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (!d) return "";
  const semDdi = d.startsWith("55") && d.length > 11 ? d.slice(2) : d;
  return `+55${semDdi}`;
}

export function AtivarAylaCard({
  numeroAtual,
  variante = "card",
}: {
  numeroAtual: string | null;
  /** "card" = bloco cheio (estado engajado). "passo" = enxuto (dentro do primeiro passo). */
  variante?: "card" | "passo";
}) {
  const [valor, setValor] = useState(paraExibir(numeroAtual));
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();

  function ativar() {
    setErro(null);
    const e164 = normalizar(valor);
    if (!/^\+55\d{10,11}$/.test(e164)) {
      setErro("Informe o DDD + número, ex: (11) 99999-9999");
      return;
    }
    startTransition(async () => {
      const res = await ativarAyla({ whatsapp_e164: e164 });
      if (res.ok) setOk(true);
      else setErro(res.erro);
    });
  }

  if (ok) {
    return (
      <div
        id="ativar-ayla"
        className="flex items-center gap-3 rounded-3xl border border-brand-yellow/40 bg-brand-yellow/10 px-6 py-5"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-yellow text-brand-purple-dark">
          <Check className="size-5" strokeWidth={2.5} aria-hidden />
        </span>
        <div>
          <p className="font-heading text-lg text-foreground">Prontinho! 🌿</p>
          <p className="text-sm text-muted-foreground">
            A Ayla já pode te escrever no WhatsApp. Fica de olho — ela logo dá um oi.
          </p>
        </div>
      </div>
    );
  }

  const enxuto = variante === "passo";

  return (
    <div
      id="ativar-ayla"
      className="relative overflow-hidden rounded-3xl px-6 py-6 text-white"
      style={{
        background:
          "linear-gradient(135deg, var(--brand-purple-deep) 0%, var(--brand-purple-dark) 100%)",
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(255,186,0,0.3) 0%, transparent 70%)" }}
      />
      <div className="relative">
        <div className="inline-flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-xl bg-brand-yellow text-brand-purple-dark">
            <MessageCircle className="size-4" aria-hidden />
          </span>
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-yellow">
            Ayla no WhatsApp
          </span>
        </div>
        <h3 className="mt-3 font-heading text-xl text-white md:text-2xl">
          {enxuto ? "E se você fizesse isso pelo WhatsApp?" : "Ative a Ayla e leve a Kolo pro seu dia"}
        </h3>
        <p className="mt-2 max-w-lg text-[14px] leading-relaxed text-white/75">
          A Ayla vira sua parceira no dia a dia: uma estratégia na hora do desafio,
          montar a rotina (com cartões pra imprimir), tirar dúvidas — na hora em que
          acontece. É onde a experiência fica completa.
        </p>

        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:items-start">
          <div className="flex-1">
            <input
              inputMode="tel"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="(11) 99999-9999"
              aria-label="Seu WhatsApp"
              className="w-full rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/50 focus:border-brand-yellow focus:outline-none"
            />
            {erro && <p className="mt-1.5 pl-1 text-xs text-brand-yellow-light">{erro}</p>}
          </div>
          <button
            type="button"
            onClick={ativar}
            disabled={pending}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-yellow px-5 py-3 text-sm font-bold text-brand-purple-dark transition-transform hover:scale-[1.02] disabled:opacity-60"
          >
            {pending ? "Ativando…" : "Ativar a Ayla"}
            {!pending && <ArrowRight className="size-4" strokeWidth={2.5} aria-hidden />}
          </button>
        </div>
        <p className="mt-2.5 pl-1 text-[11px] text-white/50">
          Você pode ajustar horários ou pausar quando quiser, nas Configurações.
        </p>
      </div>
    </div>
  );
}
