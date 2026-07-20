"use client";

import { useState } from "react";
import Link from "next/link";
import { Send, Sparkles, Check } from "lucide-react";
import type { RotinaProposta } from "@/lib/ludico/rotina-ia";
import { montarRotinaIA, aplicarRotinaIA } from "./actions";

const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

type Turno = { de: "mae" | "kolo"; texto: string };

export function AssistenteChat({ membroId, nome }: { membroId: string; nome: string }) {
  const [mensagens, setMensagens] = useState<Turno[]>([
    {
      de: "kolo",
      texto: `Oi! Me conta como são os dias do(a) ${nome} — pode mandar tudo de uma vez, do jeito que você souber. Se tiver horário ótimo; se não, tudo bem. 🌿`,
    },
  ]);
  const [texto, setTexto] = useState("");
  const [proposta, setProposta] = useState<RotinaProposta[]>([]);
  const [pensando, setPensando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    const t = texto.trim();
    if (!t || pensando) return;
    setErro(null);
    setPronto(false);
    const novo: Turno[] = [...mensagens, { de: "mae", texto: t }];
    setMensagens(novo);
    setTexto("");
    setPensando(true);
    try {
      const r = await montarRotinaIA({
        membroAtipicoId: membroId,
        historico: novo,
        propostaAtual: proposta.length ? proposta : undefined,
      });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      const falas: string[] = [r.proposta.resposta];
      if (r.proposta.pergunta) falas.push(r.proposta.pergunta);
      setMensagens((m) => [...m, { de: "kolo", texto: falas.join("\n\n") }]);
      if (r.proposta.rotinas.length) setProposta(r.proposta.rotinas);
    } catch {
      setErro("Não consegui montar agora. Tenta de novo?");
    } finally {
      setPensando(false);
    }
  }

  async function aplicar() {
    if (!proposta.length || aplicando) return;
    setErro(null);
    setAplicando(true);
    try {
      const r = await aplicarRotinaIA({ membroAtipicoId: membroId, rotinas: proposta });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setPronto(true);
    } catch {
      setErro("Não consegui salvar agora. Tenta de novo?");
    } finally {
      setAplicando(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
      {/* Conversa */}
      <div className="flex flex-col gap-3">
        <div className="flex max-h-[340px] min-h-[96px] flex-col gap-2.5 overflow-y-auto rounded-2xl border border-kolo-linha bg-white p-4">
          {mensagens.map((m, i) => (
            <div
              key={i}
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${
                m.de === "mae"
                  ? "self-end bg-brand-purple text-white"
                  : "self-start bg-kolo-lilas-bg-2/50 text-foreground"
              }`}
            >
              {m.texto}
            </div>
          ))}
          {pensando && (
            <div className="self-start rounded-2xl bg-kolo-lilas-bg-2/50 px-3.5 py-2 text-sm text-muted-foreground">
              montando…
            </div>
          )}
        </div>

        {/* Campo em destaque — onde a mãe escreve */}
        <div className="rounded-2xl border-2 border-brand-purple/35 bg-brand-purple/[0.05] p-3">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-brand-purple-dark">
            <Sparkles className="size-4" aria-hidden /> Escreva aqui como são os dias
          </p>
          <div className="flex items-end gap-2">
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enviar();
                }
              }}
              rows={3}
              autoFocus
              placeholder="Ex.: acorda 6h, escola até 12:30, segunda tem vôlei 16h, quinta é igual à segunda, skincare de manhã e de noite…"
              className="flex-1 resize-none rounded-xl border border-brand-purple/25 bg-white px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-brand-purple/30"
              disabled={pensando}
            />
            <button
              type="button"
              onClick={enviar}
              disabled={pensando || !texto.trim()}
              className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-brand-purple px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-purple-dark disabled:opacity-40"
              aria-label="Enviar"
            >
              <Send className="size-4" /> Enviar
            </button>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Pode mandar tudo de uma vez. Enter envia; Shift+Enter pula linha.
          </p>
        </div>
        {erro && <p className="text-sm text-destructive">{erro}</p>}
      </div>

      {/* Proposta */}
      <div className="flex flex-col gap-3">
        {proposta.length === 0 ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-kolo-linha p-6 text-center">
            <Sparkles className="size-6 text-brand-purple/60" aria-hidden />
            <p className="text-sm text-muted-foreground">
              Conforme você for contando, a semana montada aparece aqui pra você aprovar.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2.5">
              {proposta.map((r, i) => {
                const dia = r.dia_semana != null ? DIAS[r.dia_semana] : null;
                return (
                  <div key={i} className="rounded-2xl border border-kolo-linha bg-white p-4">
                    <div className="flex items-baseline gap-2">
                      <span className="font-heading text-base text-foreground">{r.nome}</span>
                      {dia && r.nome !== dia && (
                        <span className="text-xs text-muted-foreground">· {dia}</span>
                      )}
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      {r.tarefas.map((t, j) => (
                        <span key={j} className="inline-flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1.5 rounded-xl border border-kolo-linha bg-kolo-lilas-bg-2/40 px-2.5 py-1 text-[13px] text-foreground">
                            {t.hora && (
                              <span className="rounded bg-white px-1 text-[10px] font-bold tabular-nums text-brand-purple">
                                {t.hora}
                              </span>
                            )}
                            {t.texto}
                          </span>
                          {j < r.tarefas.length - 1 && (
                            <span className="text-xs text-muted-foreground">→</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {pronto ? (
              <div className="flex flex-col gap-2 rounded-2xl border border-brand-purple/25 bg-kolo-lilas-bg-2/40 p-4 text-sm">
                <p className="flex items-center gap-2 font-medium text-foreground">
                  <Check className="size-4 text-brand-purple" /> Prontinho, montei a rotina do(a) {nome}.
                </p>
                <Link
                  href="/ludico/rotinas/semana"
                  className="w-fit rounded-full bg-brand-purple px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-purple-dark"
                >
                  Ver a semana →
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={aplicar}
                  disabled={aplicando}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-purple px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-purple-dark disabled:opacity-50"
                >
                  {aplicando ? "Salvando…" : "Montar essa rotina"}
                </button>
                <span className="text-xs text-muted-foreground">
                  Pode ajustar no chat antes — é só me dizer o que mudar.
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
