"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Leaf, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  proporAtualizacao,
  confirmarAtualizacao,
  criarPlanoDaConversa,
  type PropostaResult,
} from "../actions";

type PropostaOk = Extract<PropostaResult, { ok: true }>;

const CAMPO_LABEL: Record<string, string> = {
  // toplevel (legados)
  essencial: "O essencial",
  como_e: "Como é / interesses",
  corpo_rotina: "Corpo e rotina",
  desafios_regulacao: "Desafios e regulação",
  sensorial: "Sensorial",
  // domínios novos (categorias_extras)
  nutricional: "Alimentação",
  sono: "Sono",
  comunicacao: "Comunicação",
  socializacao: "Socialização",
  emocional: "Regulação emocional",
  foco: "Foco e atenção",
  motor: "Motor",
  autonomia: "Autonomia",
  aprendizado: "Aprendizado",
  imitacao: "Imitação",
  tela_midia: "Tela e mídia",
  escola: "Escola",
  saude_geral: "Saúde geral",
  // família (camada2)
  composicao: "Composição da família",
  rotina: "Rotina da família",
  recursos: "Recursos",
  dinamica: "Dinâmica",
};

export function ConversaAcoes({
  conversaId,
  planoOferecido,
}: {
  conversaId: string;
  /** A Kolo ofereceu o plano na última resposta? Só então mostra o botão. */
  planoOferecido: boolean;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);

  // Plano completo
  const [pendingPlano, startPlano] = useTransition();

  function handlePlano() {
    if (pendingPlano) return;
    setErro(null);
    setResumoOk(null);
    startPlano(async () => {
      try {
        const r = await criarPlanoDaConversa({ conversaId });
        if (!r.ok) {
          setErro(r.error);
          return;
        }
        router.push(`/planos/${r.planoId}`);
      } catch {
        // Rede/timeout: não derruba a página inteira — mostra aviso aqui.
        setErro(
          "A geração demorou mais que o esperado. Tente de novo em instantes — costuma funcionar.",
        );
      }
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

      {/* 1º: guardar no Kolo Vivo (antes do plano, pra não esquecer).
          IA propõe o que registrar; usuário confirma. */}
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
                            {it.camada === "camada1" && it.campo === "rotina"
                              ? "Rotina"
                              : CAMPO_LABEL[it.campo] ?? it.campo}
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

      {/* 2º: o plano (aprofundamento). Vem depois do "guardar", pra a mãe não
          ler o plano e esquecer de atualizar o Kolo Vivo. */}
      {planoOferecido && (
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
                Montar o plano completo
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Junto tudo num plano organizado — mais ideias, frases pra usar e o que
                observar, personalizado pra sua família. Dá pra imprimir.
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
      )}
    </div>
  );
}
