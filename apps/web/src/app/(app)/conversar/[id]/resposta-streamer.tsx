"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RespostaMarkdown, limparRespostaKolo } from "@/components/resposta-markdown";
import { adicionarMensagemUsuario } from "../actions";
import { ConversaAcoes } from "./conversa-acoes";

/**
 * Resposta da Kolo em streaming + caixa de "continuar". Auto-responde a
 * última mensagem do usuário quando ela ainda não tem resposta (conversa
 * recém-criada). Mostra as ações (mais ajuda / Atualizar) quando não está
 * transmitindo.
 */
export function RespostaStreamer({
  conversaId,
  precisaResposta,
  temResposta,
  msgCount,
  intencao,
  outputTypes,
}: {
  conversaId: string;
  precisaResposta: boolean;
  temResposta: boolean;
  /** Nº de mensagens persistidas (vindo do servidor). Cresce quando o refresh
   *  traz a resposta salva — usamos isso pra fazer o handoff sem piscar. */
  msgCount: number;
  /** Intenção do último turno — numa crise o CTA de plano não aparece. */
  intencao: "crise" | "desafio" | "duvida" | "desabafo";
  outputTypes: { key: string; label: string }[];
}) {
  const router = useRouter();
  const [streaming, setStreaming] = useState(false);
  const [parcial, setParcial] = useState("");
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const jaIniciou = useRef(false);
  // Quantas mensagens existiam quando o stream atual começou. A resposta salva
  // "chegou" quando msgCount passa desse valor — só então limpamos o transmitido.
  const baselineRef = useRef(msgCount);
  // A resposta salva "chegou" quando msgCount passa do baseline. Os gates de
  // exibição usam isso pra esconder o transmitido sem buraco; o parcial em si
  // é sobrescrito no início do próximo stream (setParcial("")).
  const respostaChegou = msgCount > baselineRef.current;

  async function stream() {
    setErro(null);
    setParcial("");
    setStreaming(true);
    baselineRef.current = msgCount; // baseline = mensagens antes desta resposta
    try {
      const res = await fetch("/api/conversar/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversaId }),
      });
      if (!res.ok || !res.body) {
        setErro("Não consegui responder agora. Tente de novo.");
        setStreaming(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setParcial(acc);
      }
      // Mantém o texto transmitido na tela e pede o refresh. O parcial só some
      // quando a versão salva entra na lista (via msgCount), sem flash.
      setStreaming(false);
      router.refresh();
    } catch {
      setErro("A resposta foi interrompida. Tente de novo.");
      setStreaming(false);
    }
  }

  // Auto-responde a conversa recém-criada (última msg é do usuário, sem resposta).
  useEffect(() => {
    if (precisaResposta && !jaIniciou.current) {
      jaIniciou.current = true;
      void stream();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [precisaResposta]);

  async function enviar() {
    const t = texto.trim();
    if (!t || streaming) return;
    setErro(null);
    setTexto("");
    setPendingUser(t);
    const r = await adicionarMensagemUsuario({ conversaId, texto: t });
    if (!r.ok) {
      setErro(r.error);
      setPendingUser(null);
      return;
    }
    void stream();
  }


  return (
    <div className="flex flex-col gap-8">
      {/* Mensagem do usuário otimista (enquanto persiste/transmite no continuar) */}
      {pendingUser && !respostaChegou && (
        <div>
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Você
          </span>
          <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed text-foreground/75">
            {pendingUser}
          </p>
        </div>
      )}

      {/* Resposta da Kolo: transmitindo OU já transmitida e ainda não salva na lista */}
      {(streaming || (parcial && !respostaChegou)) && (
        <div>
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-purple">
            Kolo
          </span>
          {parcial ? (
            <RespostaMarkdown
              texto={limparRespostaKolo(parcial)}
              className="mt-2 flex flex-col gap-3 text-base text-foreground"
            />
          ) : (
            <p className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="size-4 animate-spin" aria-hidden />
              Pensando...
            </p>
          )}
        </div>
      )}

      {erro && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <span>{erro}</span>
          <button
            type="button"
            onClick={() => void stream()}
            className="font-semibold underline underline-offset-2"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {/* Ações (mais ajuda / Atualizar) — só quando há resposta e não está transmitindo */}
      {temResposta && !streaming && (
        <ConversaAcoes
          conversaId={conversaId}
          intencao={intencao}
          outputTypes={outputTypes}
        />
      )}

      {/* Continuar conversa */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
        className="flex flex-col gap-3"
      >
        <textarea
          rows={3}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Continuar conversando..."
          disabled={streaming}
          className="w-full resize-none rounded-2xl border border-foreground/[0.08] bg-white/70 px-4 py-3 text-base leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-foreground/10 disabled:opacity-60"
        />
        <div className="flex items-center justify-end gap-3">
          <Button type="submit" size="lg" disabled={streaming || !texto.trim()}>
            {streaming ? "Pensando..." : "Continuar"}
            {!streaming && <ArrowRight className="size-4" aria-hidden />}
          </Button>
        </div>
      </form>
    </div>
  );
}
