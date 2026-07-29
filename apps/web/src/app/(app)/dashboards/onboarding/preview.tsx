"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip, ChipGroup } from "@/components/ui/chip";
import { mascararDataBr, dataBrParaIso, idadeAnos } from "@/lib/idade";
import { exemplosInteressePorIdade, type OnboardingCopy, type OnbPasso, type OnbChip } from "@/lib/onboarding/copy-default";

/**
 * Preview INTERATIVO do onboarding conversacional — renderiza a copy (dado) como
 * a mãe veria: falas da Ayla + inputs, quase tudo em toque. É só demonstração
 * (não salva nada). Nas próximas fatias, essa mesma copy virá do banco (editável).
 */

function fill(text: string, nome: string, voce: string): string {
  const n = nome.trim() || "quem você cuida";
  const v = voce.trim() || "você";
  return text.replaceAll("[NOME]", n).replaceAll("[VOCE]", v);
}

// Interesses: chips por idade de [NOME]; o resto usa as opções da copy.
function opcoesDoPasso(passo: OnbPasso, nascimentoBr: string): OnbChip[] {
  if (passo.id !== "membro_interesses") return passo.opcoes ?? [];
  const iso = dataBrParaIso(nascimentoBr);
  const idade = iso ? idadeAnos(iso) : null;
  const ex = exemplosInteressePorIdade(idade).map((e) => ({ value: e, label: e }));
  return [...ex, { value: "Outro", label: "Outro", livre: true }];
}

type Answers = Record<string, string | string[] | boolean>;

export function OnboardingPreview({ copy }: { copy: OnboardingCopy }) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  // rascunho do input atual
  const [texto, setTexto] = useState("");
  const [multi, setMulti] = useState<string[]>([]);
  const [uni, setUni] = useState<string | null>(null);
  const [aceites, setAceites] = useState({ termos: false, ayla: false });
  // Quando a pessoa clica numa resposta pra CORRIGIR, guarda de onde voltar.
  const [retomarEm, setRetomarEm] = useState<number | null>(null);
  // Único caminho do fecho que abre um fluxo aqui dentro; os outros navegam.
  const [caminho, setCaminho] = useState<"desafio" | null>(null);

  const nome = (answers["membro_nome"] as string) ?? "";
  const voce = (answers["voce_nome"] as string) ?? "";
  const passos = copy.passos;
  const passo: OnbPasso | undefined = passos[idx];
  const terminou = idx >= passos.length;

  const opcoesLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of passos) for (const o of p.opcoes ?? []) m.set(`${p.id}:${o.value}`, o.label);
    return m;
  }, [passos]);

  // Temas de desafio marcados (rótulos) — pra o caminho "começar por um desafio".
  const temasEscolhidos = Array.isArray(answers["desafios"])
    ? (answers["desafios"] as string[]).map((v) => opcoesLabel.get(`desafios:${v}`) ?? v)
    : [];

  function avancar(valor: string | string[] | boolean) {
    if (!passo) return;
    setAnswers((a) => ({ ...a, [passo.id]: valor }));
    setTexto("");
    setMulti([]);
    setUni(null);
    // Se estava CORRIGINDO uma resposta antiga, volta pra onde parou.
    if (retomarEm !== null) {
      const back = retomarEm;
      setRetomarEm(null);
      setIdx(back);
    } else {
      setIdx((i) => i + 1);
    }
  }

  // Clicou numa resposta anterior pra corrigir: volta pra aquele passo (com o
  // texto pré-preenchido, quando é campo de texto) e lembra de onde retomar.
  function editar(k: number) {
    const ans = answers[passos[k].id];
    setRetomarEm((r) => (r === null ? idx : r));
    setTexto(typeof ans === "string" ? ans : "");
    setMulti([]);
    setUni(null);
    setAceites({ termos: false, ayla: false });
    setIdx(k);
  }

  function reiniciar() {
    setIdx(0);
    setAnswers({});
    setTexto("");
    setMulti([]);
    setUni(null);
    setAceites({ termos: false, ayla: false });
    setRetomarEm(null);
    setCaminho(null);
  }

  function respostaLegivel(p: OnbPasso, v: string | string[] | boolean): string {
    if (p.tipo === "aceites") return "Combinado ✓";
    if (Array.isArray(v)) return v.map((x) => opcoesLabel.get(`${p.id}:${x}`) ?? x).join(", ");
    if (typeof v === "string") return v;
    return "";
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-kolo-linha bg-secondary/40 p-4 sm:p-6">
      {/* "App ao fundo" — hint decorativo de que o app já está ali atrás. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.06]">
        <div className="m-6 h-24 rounded-2xl bg-brand-purple" />
        <div className="mx-6 h-16 rounded-2xl bg-brand-purple" />
      </div>

      <div className="relative mx-auto flex max-w-sm flex-col gap-3">
        {/* Intro */}
        <div className="rounded-2xl bg-white/70 p-4 text-center">
          <p className="font-heading text-lg text-foreground">{copy.intro.titulo}</p>
          <p className="mt-1 text-sm text-muted-foreground">{copy.intro.subtitulo}</p>
        </div>

        {/* Histórico da conversa — toque na sua resposta pra corrigir. */}
        {passos.slice(0, idx).map((p, k) => (
          <div key={p.id} className="flex flex-col gap-1.5">
            <Bolha lado="ayla">{fill(p.ayla, nome, voce)}</Bolha>
            {answers[p.id] !== undefined && (
              <div className="flex justify-end">
                <button
                  onClick={() => editar(k)}
                  title="Tocar pra corrigir"
                  className="max-w-[85%] rounded-2xl rounded-tr-sm bg-brand-purple px-3.5 py-2.5 text-left text-sm text-white transition-opacity hover:opacity-80"
                >
                  {respostaLegivel(p, answers[p.id])}
                  <span className="ml-1.5 opacity-70">✎</span>
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Passo atual */}
        {passo && (
          <div className="flex flex-col gap-2">
            {retomarEm !== null && (
              <p className="text-center text-xs font-medium text-brand-purple">
                ✎ corrigindo — responda de novo e você volta de onde parou
              </p>
            )}
            <Bolha lado="ayla">{fill(passo.ayla, nome, voce)}</Bolha>

            {(passo.tipo === "texto" || passo.tipo === "data" || passo.tipo === "whatsapp") && (
              <div className="flex flex-col gap-1.5">
                <Input
                  value={texto}
                  placeholder={passo.placeholder}
                  inputMode={passo.tipo === "data" || passo.tipo === "whatsapp" ? "numeric" : undefined}
                  onChange={(e) =>
                    setTexto(passo.tipo === "data" ? mascararDataBr(e.target.value) : e.target.value)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && texto.trim()) avancar(texto.trim());
                  }}
                />
                {passo.nota && (
                  <span className="text-xs text-muted-foreground">{fill(passo.nota, nome, voce)}</span>
                )}
                <div className="flex justify-end">
                  <Button size="sm" disabled={!texto.trim()} onClick={() => avancar(texto.trim())}>
                    Continuar
                  </Button>
                </div>
              </div>
            )}

            {passo.tipo === "chips_multi" &&
              (() => {
                const opcoes = opcoesDoPasso(passo, (answers["membro_nascimento"] as string) ?? "");
                const temLivre = multi.some((v) => opcoes.find((o) => o.value === v)?.livre);
                const podeAvancar =
                  (passo.opcional || multi.length > 0) && (!temLivre || texto.trim().length > 0);
                const finalizar = () =>
                  avancar(
                    multi.map((v) => (opcoes.find((o) => o.value === v)?.livre ? texto.trim() : v)),
                  );
                return (
                  <div className="flex flex-col gap-2">
                    <ChipGroup label={passo.id}>
                      {opcoes.map((o) => (
                        <Chip
                          key={o.value}
                          selected={multi.includes(o.value)}
                          onClick={() =>
                            setMulti((m) =>
                              m.includes(o.value) ? m.filter((x) => x !== o.value) : [...m, o.value],
                            )
                          }
                        >
                          {o.label}
                        </Chip>
                      ))}
                    </ChipGroup>
                    {temLivre && (
                      <Input
                        value={texto}
                        placeholder="Escreva aqui — qual?"
                        onChange={(e) => setTexto(e.target.value)}
                      />
                    )}
                    <div className="flex justify-end">
                      <Button size="sm" disabled={!podeAvancar} onClick={finalizar}>
                        {passo.opcional && multi.length === 0 ? "Pular" : "Continuar"}
                      </Button>
                    </div>
                  </div>
                );
              })()}

            {passo.tipo === "chips_uni" && (
              <div className="flex flex-col gap-2">
                <ChipGroup label={passo.id}>
                  {(passo.opcoes ?? []).map((o) => (
                    <Chip
                      key={o.value}
                      selected={uni === o.value}
                      onClick={() => (o.livre ? setUni(o.value) : avancar(o.label))}
                    >
                      {o.label}
                    </Chip>
                  ))}
                </ChipGroup>
                {uni && (passo.opcoes ?? []).find((o) => o.value === uni)?.livre && (
                  <div className="flex flex-col gap-1.5">
                    <Input
                      value={texto}
                      placeholder="Escreva aqui — ex.: tia, madrinha, tutor(a)"
                      onChange={(e) => setTexto(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && texto.trim()) avancar(texto.trim());
                      }}
                    />
                    <div className="flex justify-end">
                      <Button size="sm" disabled={!texto.trim()} onClick={() => avancar(texto.trim())}>
                        Continuar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {passo.tipo === "aceites" && (
              <div className="flex flex-col gap-2 rounded-2xl bg-white/70 p-3">
                <label className="flex items-start gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={aceites.termos}
                    onChange={(e) => setAceites((a) => ({ ...a, termos: e.target.checked }))}
                    className="mt-0.5"
                  />
                  <span>
                    Aceito os{" "}
                    <a
                      href="/termos"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-purple underline"
                    >
                      termos de uso
                    </a>{" "}
                    e a{" "}
                    <a
                      href="/privacidade"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-purple underline"
                    >
                      política de privacidade
                    </a>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={aceites.ayla}
                    onChange={(e) => setAceites((a) => ({ ...a, ayla: e.target.checked }))}
                    className="mt-0.5"
                  />
                  A Ayla pode me escrever no WhatsApp
                </label>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    disabled={!aceites.termos || !aceites.ayla}
                    onClick={() => avancar(true)}
                  >
                    Começar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Fecho — os 4 caminhos. No preview nenhum navega de verdade (só o de
            desafio abre o fluxo), pra Karina ler a copy sem sair da simulação. */}
        {terminou && caminho === null && (
          <div className="flex flex-col gap-2">
            <Bolha lado="ayla">{fill(copy.garfo.titulo, nome, voce)}</Bolha>
            {(copy.garfo.caminhos ?? []).map((c) => (
              <button
                key={c.destino}
                onClick={() => c.destino === "estrategia" && setCaminho("desafio")}
                className={
                  c.destino === "whatsapp"
                    ? "flex items-center gap-3 rounded-2xl border-2 border-brand-purple bg-brand-purple/10 px-4 py-4 text-left transition-colors hover:bg-brand-purple/20"
                    : "flex items-center gap-3 rounded-2xl border border-kolo-linha bg-white px-4 py-3.5 text-left transition-colors hover:border-brand-purple/40"
                }
              >
                <span className="text-2xl leading-none">{c.emoji}</span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-foreground">{fill(c.titulo, nome, voce)}</span>
                  <span className="text-xs leading-relaxed text-muted-foreground">{fill(c.texto, nome, voce)}</span>
                </span>
              </button>
            ))}
            <div className="pt-1 text-center">
              <button onClick={reiniciar} className="text-xs font-medium text-brand-purple hover:underline">
                ↺ ver de novo desde o começo
              </button>
            </div>
          </div>
        )}

        {terminou && caminho === "desafio" && (
          <DesafioFluxo
            copy={copy}
            nome={nome}
            temas={temasEscolhidos}
            onVoltar={() => setCaminho(null)}
            onReiniciar={reiniciar}
          />
        )}
      </div>
    </div>
  );
}

/** Caminho "começar por um desafio": escolhe um tema (dos que marcou) e a Ayla abre. */
export function DesafioFluxo({
  copy,
  nome,
  temas,
  onVoltar,
  onReiniciar,
  onEntrar,
}: {
  copy: OnboardingCopy;
  nome: string;
  temas: string[];
  onVoltar: () => void;
  onReiniciar: () => void;
  /** No fluxo real, leva pra montar a estratégia; no preview fica decorativo. */
  onEntrar?: () => void;
}) {
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const opcoes = temas.length > 0 ? temas : ["Comunicação", "Sono", "Alimentação"];

  return (
    <div className="flex flex-col gap-2">
      <Bolha lado="ayla">{fill(copy.desafio.pergunta, nome, "")}</Bolha>

      {!escolhido ? (
        <>
          <ChipGroup label="temas">
            {opcoes.map((t) => (
              <Chip key={t} selected={false} onClick={() => setEscolhido(t)}>
                {t}
              </Chip>
            ))}
          </ChipGroup>
          <div className="pt-1 text-center">
            <button onClick={onVoltar} className="text-xs font-medium text-muted-foreground hover:text-foreground">
              ← voltar
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-brand-purple px-3.5 py-2.5 text-sm text-white">
              {escolhido}
            </div>
          </div>
          <Bolha lado="ayla">{fill(copy.desafio.abertura.replaceAll("[TEMA]", escolhido), nome, "")}</Bolha>
          {onEntrar && (
            <button
              onClick={onEntrar}
              className="rounded-2xl bg-brand-purple px-4 py-3 text-center text-sm font-semibold text-white"
            >
              Montar minha estratégia
            </button>
          )}
          <div className="pt-1 text-center">
            <button onClick={onReiniciar} className="text-xs font-medium text-brand-purple hover:underline">
              ↺ ver a experiência de novo desde o começo
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Envolve o preview com um botão "tela cheia" — a passagem pelo onboarding como
 * uma NOVA USUÁRIA veria, sem tocar em nenhum dado da sua conta. Seguro: o
 * preview não persiste nada (diferente do "resetar conta" em Testes).
 */
export function OnboardingExperiencia({ copy }: { copy: OnboardingCopy }) {
  const [cheia, setCheia] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button variant="outline" size="sm" onClick={() => setCheia(true)}>
          ▶ Experimentar em tela cheia (como nova usuária)
        </Button>
        <p className="mt-1 text-xs text-muted-foreground">
          Não altera seus dados — é só uma simulação.
        </p>
      </div>

      <OnboardingPreview copy={copy} />

      {cheia && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-kolo-creme">
          <div className="sticky top-0 z-10 flex justify-end bg-kolo-creme/80 p-3 backdrop-blur">
            <button
              onClick={() => setCheia(false)}
              className="rounded-full bg-white px-4 py-1.5 text-sm font-medium text-foreground shadow"
            >
              ✕ Fechar
            </button>
          </div>
          <div className="mx-auto max-w-md px-4 pb-16">
            <OnboardingPreview copy={copy} />
          </div>
        </div>
      )}
    </div>
  );
}

function Bolha({ lado, children }: { lado: "ayla" | "user"; children: React.ReactNode }) {
  const ayla = lado === "ayla";
  return (
    <div className={ayla ? "flex justify-start" : "flex justify-end"}>
      <div
        className={
          ayla
            ? "max-w-[85%] rounded-2xl rounded-tl-sm bg-white px-3.5 py-2.5 text-sm text-foreground shadow-sm"
            : "max-w-[85%] rounded-2xl rounded-tr-sm bg-brand-purple px-3.5 py-2.5 text-sm text-white"
        }
      >
        {children}
      </div>
    </div>
  );
}
