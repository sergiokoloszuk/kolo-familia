"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { MessageCircle, Check, Pencil } from "lucide-react";
import { pedirCodigoWhatsapp, confirmarCodigoWhatsapp } from "@/lib/whatsapp/acoes";

/**
 * CONFIRMAR O WHATSAPP — a mesma tela nas três portas.
 *
 * Onboarding tradicional, onboarding conversacional e o card do painel montam
 * ESTE componente. Não existe segunda UI de código: os estados difíceis
 * (expirou, errou cinco vezes, esgotou reenvios, a Z-API recusou) foram
 * escritos uma vez e valem nos três lugares.
 *
 * `variante` muda só a moldura — nunca a lógica.
 */

/** "+5511999998888" → "(11) 99999-8888". Só para exibir. */
function paraExibir(e164: string | null): string {
  if (!e164) return "";
  const d = e164.replace(/\D/g, "").replace(/^55/, "");
  if (d.length < 10) return "";
  const resto = d.slice(2);
  const corte = resto.length === 9 ? 5 : 4;
  return `(${d.slice(0, 2)}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

/** Máscara enquanto digita. */
function mascarar(raw: string): string {
  const d = raw.replace(/\D/g, "").replace(/^55/, "").slice(0, 11);
  if (d.length <= 2) return d;
  const resto = d.slice(2);
  const corte = resto.length > 8 ? 5 : 4;
  return resto.length <= corte
    ? `(${d.slice(0, 2)}) ${resto}`
    : `(${d.slice(0, 2)}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

/** Qualquer coisa digitada → "+55DDDNUMERO". */
export function normalizarE164(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (!d) return "";
  const semDdi = d.startsWith("55") && d.length > 11 ? d.slice(2) : d;
  return `+55${semDdi}`;
}

export const TEXTO_CONTEXTO =
  "Seu WhatsApp será nosso principal canal com você. É por lá que a Ayla vai " +
  "conversar e acompanhar sua experiência — por isso precisamos confirmar que " +
  "o número está certo.";

export function ConfirmarWhatsapp({
  numeroInicial,
  onConfirmado,
  variante = "onboarding",
  autoFocus = false,
}: {
  numeroInicial: string | null;
  /** Chamado só depois de confirmação REAL. É o que destrava o onboarding. */
  onConfirmado?: () => void;
  variante?: "onboarding" | "painel";
  autoFocus?: boolean;
}) {
  const [etapa, setEtapa] = useState<"numero" | "codigo" | "ok">("numero");
  const [valor, setValor] = useState(paraExibir(numeroInicial));
  const [enviadoPara, setEnviadoPara] = useState("");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [espera, setEspera] = useState(0);
  /** Trava dura: sem código novo, insistir não adianta. */
  const [precisaNovoCodigo, setPrecisaNovoCodigo] = useState(false);
  const [semReenvio, setSemReenvio] = useState(false);
  const [pending, startTransition] = useTransition();

  // Contagem do cooldown. Não é enfeite: sem ela a pessoa fica clicando num
  // botão que só devolve erro, sem entender que é só esperar.
  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  const pedir = useCallback(() => {
    setErro(null);
    const e164 = normalizarE164(valor);
    if (!/^\+55\d{10,11}$/.test(e164)) {
      setErro("Informe o DDD + número, ex: (11) 99999-9999");
      return;
    }
    startTransition(async () => {
      const r = await pedirCodigoWhatsapp({ telefone: e164 });
      if (r.ok) {
        setEnviadoPara(e164);
        setEtapa("codigo");
        setCodigo("");
        setPrecisaNovoCodigo(false);
        setEspera(60);
        return;
      }
      setErro(r.erro);
      if (r.motivo === "cooldown") setEspera(r.segundosRestantes);
      if (r.motivo === "max_reenvios") setSemReenvio(true);
    });
  }, [valor]);

  const confirmar = useCallback(() => {
    setErro(null);
    if (codigo.replace(/\D/g, "").length !== 6) {
      setErro("Digite os 6 números do código.");
      return;
    }
    startTransition(async () => {
      const r = await confirmarCodigoWhatsapp({ telefone: enviadoPara, codigo });
      if (r.ok) {
        setEtapa("ok");
        onConfirmado?.();
        return;
      }
      setErro(r.erro);
      // Expirado e tentativas esgotadas têm a MESMA saída: código novo. Deixar
      // o botão "Confirmar" ativo aqui só produziria erro repetido.
      if (r.motivo === "expirado" || r.motivo === "max_tentativas") {
        setPrecisaNovoCodigo(true);
      }
      if (r.motivo === "duplicado") {
        setEtapa("numero");
      }
    });
  }, [codigo, enviadoPara, onConfirmado]);

  function corrigirNumero() {
    // Trocar o número invalida a confirmação anterior: o mecanismo amarra
    // código E telefone, então voltar aqui já derruba o desafio de antes.
    setEtapa("numero");
    setCodigo("");
    setErro(null);
    setPrecisaNovoCodigo(false);
    setSemReenvio(false);
    setEspera(0);
  }

  const noPainel = variante === "painel";
  const caixa = noPainel
    ? "rounded-2xl border border-kolo-linha bg-background p-4"
    : "rounded-2xl border border-kolo-linha bg-secondary/40 p-4";

  if (etapa === "ok") {
    return (
      <div
        data-testid="whatsapp-confirmado"
        className="flex items-center gap-3 rounded-2xl border border-brand-yellow/40 bg-brand-yellow/10 px-5 py-4"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-yellow text-brand-purple-dark">
          <Check className="size-5" strokeWidth={2.5} aria-hidden />
        </span>
        <div>
          <p className="font-heading text-base text-foreground">WhatsApp confirmado 🌿</p>
          <p className="text-sm text-muted-foreground">
            {paraExibir(enviadoPara)} — a Ayla já pode te escrever por lá.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={caixa} data-testid="confirmar-whatsapp">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground">
          <MessageCircle className="size-4" aria-hidden />
        </span>
        <p className="text-sm text-muted-foreground">{TEXTO_CONTEXTO}</p>
      </div>

      {erro && (
        <p
          role="alert"
          data-testid="whatsapp-erro"
          className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {erro}
        </p>
      )}

      {etapa === "numero" ? (
        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-foreground" htmlFor="whats-numero">
            Seu WhatsApp
          </label>
          <input
            id="whats-numero"
            name="whatsapp"
            inputMode="numeric"
            autoComplete="tel-national"
            autoFocus={autoFocus}
            placeholder="(11) 99999-9999"
            value={valor}
            onChange={(e) => setValor(mascarar(e.target.value))}
            className="w-full rounded-xl border border-kolo-linha bg-background px-3 py-2 text-base"
          />
          <button
            type="button"
            onClick={pedir}
            disabled={pending || espera > 0}
            data-testid="whatsapp-pedir"
            className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {pending
              ? "Enviando…"
              : espera > 0
                ? `Aguarde ${espera}s`
                : "Enviar código pelo WhatsApp"}
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-foreground">
            Mandei um código de 6 números para{" "}
            <strong className="whitespace-nowrap">{paraExibir(enviadoPara)}</strong>.
          </p>
          <input
            id="whats-codigo"
            name="codigo"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            placeholder="000000"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="w-full rounded-xl border border-kolo-linha bg-background px-3 py-2 text-center text-2xl tracking-[0.4em]"
          />
          <button
            type="button"
            onClick={confirmar}
            disabled={pending || precisaNovoCodigo}
            data-testid="whatsapp-confirmar"
            className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {pending ? "Confirmando…" : "Confirmar"}
          </button>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={pedir}
              disabled={pending || espera > 0 || semReenvio}
              data-testid="whatsapp-reenviar"
              className="text-sm text-muted-foreground underline underline-offset-4 disabled:no-underline disabled:opacity-60"
            >
              {semReenvio
                ? "Limite de reenvios atingido"
                : espera > 0
                  ? `Reenviar em ${espera}s`
                  : "Não chegou? Reenviar"}
            </button>
            <button
              type="button"
              onClick={corrigirNumero}
              data-testid="whatsapp-corrigir"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground underline underline-offset-4"
            >
              <Pencil className="size-3" aria-hidden /> Corrigir número
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
