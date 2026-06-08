"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Leaf, Plus, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  pedirApoioNaConversa,
  proporAtualizacao,
  confirmarAtualizacao,
  criarPlanoDaConversa,
  type PropostaResult,
} from "../actions";

type PropostaOk = Extract<PropostaResult, { ok: true }>;

const CAMPO_LABEL: Record<string, string> = {
  essencial: "O essencial",
  como_e: "Como é / interesses",
  corpo_rotina: "Corpo e rotina",
  desafios_regulacao: "Desafios e regulação",
  sensorial: "Sensorial",
  composicao: "Composição da família",
  rotina: "Rotina da família",
  recursos: "Recursos",
  dinamica: "Dinâmica",
};

export function ConversaAcoes({
  conversaId,
  outputTypes,
}: {
  conversaId: string;
  outputTypes: { key: string; label: string }[];
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);

  // Plano completo
  const [pendingPlano, startPlano] = useTransition();

  // Mais ajuda
  const [pendingApoio, startApoio] = useTransition();
  const [apoioAtivo, setApoioAtivo] = useState<string | null>(null);

  function handlePlano() {
    if (pendingPlano) return;
    setErro(null);
    setResumoOk(null);
    startPlano(async () => {
      const r = await criarPlanoDaConversa({ conversaId });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      router.push(`/planos/${r.planoId}`);
    });
  }

  // Atualizar
  const [propondo, startPropor] = useTransition();
  const [confirmando, startConfirmar] = useTransition();
  const [proposta, setProposta] = useState<PropostaOk | null>(null);
  const [selKolo, setSelKolo] = useState<boolean[]>([]);
  const [selConquista, setSelConquista] = useState(false);
  const [selDesafio, setSelDesafio] = useState(false);
  const [resumoOk, setResumoOk] = useState<string | null>(null);

  function handleApoio(key: string) {
    if (pendingApoio) return;
    setErro(null);
    setResumoOk(null);
    setApoioAtivo(key);
    startApoio(async () => {
      const r = await pedirApoioNaConversa({ conversaId, outputTypeKey: key });
      setApoioAtivo(null);
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      router.refresh();
    });
  }

  function handlePropor() {
    setErro(null);
    setResumoOk(null);
    startPropor(async () => {
      const r = await proporAtualizacao({ conversaId });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setProposta(r);
      setSelKolo(r.proposta.koloVivo.map(() => true));
      setSelConquista(Boolean(r.proposta.conquista));
      setSelDesafio(Boolean(r.proposta.desafio));
    });
  }

  function handleConfirmar() {
    if (!proposta) return;
    setErro(null);
    const koloVivo = proposta.proposta.koloVivo.filter((_, i) => selKolo[i]);
    const conquista = selConquista ? proposta.proposta.conquista : null;
    const desafio = selDesafio ? proposta.proposta.desafio : null;
    if (koloVivo.length === 0 && !conquista && !desafio) {
      setErro("Marque ao menos um item pra registrar.");
      return;
    }
    startConfirmar(async () => {
      const r = await confirmarAtualizacao({ conversaId, koloVivo, conquista, desafio });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setProposta(null);
      setResumoOk(r.resumo);
      router.refresh();
    });
  }

  const propostaVazia =
    proposta != null &&
    proposta.proposta.koloVivo.length === 0 &&
    !proposta.proposta.conquista &&
    !proposta.proposta.desafio;

  return (
    <div className="mt-5 flex flex-col gap-4 border-t border-foreground/[0.06] pt-5">
      {erro && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}
      {resumoOk && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
          <span>Pronto — {resumoOk}.</span>
          <Link href="/kolo-vivo" className="font-semibold underline underline-offset-2">
            Ver no Kolo Vivo
          </Link>
        </div>
      )}

      {/* Plano completo — a ação principal: junta tudo num plano só. */}
      <div className="rounded-2xl border border-brand-purple/20 bg-kolo-lilas-bg-2/40 p-4">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-yellow/25 text-brand-purple"
          >
            <Sparkles className="size-5" />
          </span>
          <div className="flex-1">
            <p className="font-heading text-base font-medium text-foreground">
              Quer um plano completo sobre isso?
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Junto tudo num plano organizado — ideias práticas, frases pra usar e o
              que observar — com a cara da sua família. Dá pra imprimir.
            </p>
            <Button type="button" onClick={handlePlano} disabled={pendingPlano} className="mt-3">
              {pendingPlano ? (
                <>
                  <RefreshCw className="size-4 animate-spin" aria-hidden />
                  Montando o plano...
                </>
              ) : (
                <>
                  <Sparkles className="size-4" aria-hidden />
                  Montar plano completo
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mais ajuda — gera o tipo escolhido sobre o mesmo tema. */}
      <div>
        <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          Quer ir mais fundo nesse tema?
        </p>
        <div className="flex flex-wrap gap-2">
          {outputTypes.map((t) => {
            const carregando = pendingApoio && apoioAtivo === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => handleApoio(t.key)}
                disabled={pendingApoio}
                className="inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-white px-3.5 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-brand-purple/30 hover:bg-kolo-lilas-bg-2 hover:text-brand-purple disabled:opacity-50"
              >
                {carregando ? (
                  <RefreshCw className="size-3.5 shrink-0 animate-spin text-brand-purple/70" aria-hidden />
                ) : (
                  <Plus className="size-3.5 shrink-0 text-brand-purple/70" aria-hidden />
                )}
                {carregando ? "Pensando..." : t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Atualizar — IA propõe o que registrar; usuário confirma. */}
      {!proposta && (
        <div className="rounded-2xl border border-brand-purple/15 bg-kolo-lilas-bg-2/40 p-4">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-purple/10 text-brand-purple"
            >
              <Leaf className="size-5" />
            </span>
            <div className="flex-1">
              <p className="font-heading text-base font-medium text-foreground">
                Guardar o que apareceu nesse papo
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Quanto mais a Kolo conhece sua família, mais certeiras ficam as
                respostas. Ela lê a conversa e sugere o que vale registrar no Kolo
                Vivo e no diário — você confere e confirma antes de salvar.
              </p>
              <Button
                type="button"
                onClick={handlePropor}
                disabled={propondo}
                className="mt-3"
              >
                {propondo ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" aria-hidden />
                    Lendo a conversa...
                  </>
                ) : (
                  <>
                    <Leaf className="size-4" aria-hidden />
                    Atualizar com base nesse papo
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {proposta && (
        <div className="rounded-2xl border border-foreground/[0.08] bg-white p-4 shadow-sm">
          {propostaVazia ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Não encontrei nada novo pra registrar dessa conversa.
              </p>
              <div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setProposta(null)}
                >
                  Fechar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-sm font-medium text-foreground">
                O que eu guardaria desse papo — confira e ajuste:
              </p>

              {proposta.proposta.koloVivo.length > 0 && (
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    Vai pro Kolo Vivo
                  </legend>
                  {proposta.proposta.koloVivo.map((it, i) => (
                    <label
                      key={`${it.campo}-${i}`}
                      className="flex cursor-pointer items-start gap-3 rounded-xl bg-kolo-lilas-bg-2/50 px-3 py-2.5"
                    >
                      <input
                        type="checkbox"
                        checked={selKolo[i] ?? false}
                        onChange={(e) =>
                          setSelKolo((prev) => {
                            const next = [...prev];
                            next[i] = e.target.checked;
                            return next;
                          })
                        }
                        className="mt-1 size-4 shrink-0 accent-brand-purple"
                      />
                      <span className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1.5">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-purple/80">
                            {CAMPO_LABEL[it.campo] ?? it.campo}
                          </span>
                          <span
                            className={
                              it.operacao === "reescrever"
                                ? "rounded-full bg-brand-yellow/20 px-1.5 text-[10px] font-bold uppercase text-brand-purple-dark"
                                : "rounded-full bg-cat-social/15 px-1.5 text-[10px] font-bold uppercase text-cat-social"
                            }
                          >
                            {it.operacao === "reescrever" ? "atualiza" : "novo"}
                          </span>
                        </span>
                        <span className="text-sm leading-relaxed text-foreground">
                          {it.texto}
                        </span>
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}

              {(proposta.proposta.conquista || proposta.proposta.desafio) && (
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    No diário
                  </legend>
                  {proposta.proposta.conquista && (
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-kolo-lilas-bg-2/50 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selConquista}
                        onChange={(e) => setSelConquista(e.target.checked)}
                        className="mt-1 size-4 shrink-0 accent-brand-purple"
                      />
                      <span className="flex flex-col gap-0.5">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-cat-social">
                          Conquista
                        </span>
                        <span className="text-sm leading-relaxed text-foreground">
                          {proposta.proposta.conquista}
                        </span>
                      </span>
                    </label>
                  )}
                  {proposta.proposta.desafio && (
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-kolo-lilas-bg-2/50 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selDesafio}
                        onChange={(e) => setSelDesafio(e.target.checked)}
                        className="mt-1 size-4 shrink-0 accent-brand-purple"
                      />
                      <span className="flex flex-col gap-0.5">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-cat-sensorial">
                          Desafio
                        </span>
                        <span className="text-sm leading-relaxed text-foreground">
                          {proposta.proposta.desafio}
                        </span>
                      </span>
                    </label>
                  )}
                </fieldset>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button type="button" onClick={handleConfirmar} disabled={confirmando}>
                  {confirmando ? (
                    <>
                      <RefreshCw className="size-4 animate-spin" aria-hidden />
                      Registrando...
                    </>
                  ) : (
                    <>
                      <Check className="size-4" aria-hidden />
                      Confirmar
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setProposta(null)}
                  disabled={confirmando}
                >
                  Descartar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
