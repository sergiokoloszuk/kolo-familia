"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip, ChipGroup } from "@/components/ui/chip";
import { mascararDataBr, dataBrParaIso, idadeAnos } from "@/lib/idade";
import { exemplosInteressePorIdade, type OnboardingCopy, type OnbPasso, type OnbChip } from "@/lib/onboarding/copy-default";
import type { MembroInput, ResponsavelInput } from "@/lib/onboarding/salvar-conversacional";
import { salvarMembroAction, salvarWhatsappAction, salvarAceitesAction, concluirAction } from "./actions-conversacional";

/**
 * Onboarding CONVERSACIONAL real (Fatia 3) — mesma cara do preview, mas guarda
 * VALORES, salva de verdade (concluirConversacional) e entra no app. Só aparece
 * quando a chave (onboarding_copy.modo) manda o fluxo novo pra esta família.
 */

function fill(text: string, nome: string, voce: string): string {
  const n = nome.trim() || "quem você cuida";
  const v = voce.trim() || "você";
  return text.replaceAll("[NOME]", n).replaceAll("[VOCE]", v);
}

// WhatsApp: mostra (nn) nnnnn-nnnn, guarda +55...
function maskTel(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
function telParaE164(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d ? `+55${d}` : "";
}

// Opções do passo — pro passo de interesses, os chips saem da IDADE de [NOME].
function opcoesDoPasso(passo: OnbPasso, nascimentoBr: string): OnbChip[] {
  if (passo.id !== "membro_interesses") return passo.opcoes ?? [];
  const iso = dataBrParaIso(nascimentoBr);
  const idade = iso ? idadeAnos(iso) : null;
  const ex = exemplosInteressePorIdade(idade).map((e) => ({ value: e, label: e }));
  return [...ex, { value: "Outro", label: "Outro", livre: true }];
}

type Fase = "form" | "salvando" | "pronto" | "duplicado" | "erro";

export function OnboardingConversacional({ copy }: { copy: OnboardingCopy }) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [outros, setOutros] = useState<Record<string, string>>({});
  const [aceites, setAceites] = useState({ termos: false, ayla: false });
  const [texto, setTexto] = useState("");
  const [multi, setMulti] = useState<string[]>([]);
  const [uni, setUni] = useState<string | null>(null);
  const [retomarEm, setRetomarEm] = useState<number | null>(null);
  const [fase, setFase] = useState<Fase>("form");
  const [erroMsg, setErroMsg] = useState("");

  // Captura a ORIGEM (anúncio/campanha/criativo via UTM; afiliado via ref) — igual
  // ao wizard antigo. Lê os cookies kolo_utm/kolo_ref e grava na família, 1x.
  // Best-effort: nunca trava o cadastro.
  useEffect(() => {
    void (async () => {
      try {
        const { atribuirAfiliado, atribuirUtm } = await import("./actions");
        await atribuirAfiliado();
        await atribuirUtm();
      } catch {
        /* tracking nunca segura o fluxo */
      }
    })();
  }, []);

  const passos = copy.passos;
  const passo: OnbPasso | undefined = passos[idx];
  const nome = (answers["membro_nome"] as string) ?? "";
  const voce = (answers["voce_nome"] as string) ?? "";

  const opcoesLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of passos) for (const o of p.opcoes ?? []) m.set(`${p.id}:${o.value}`, o.label);
    return m;
  }, [passos]);

  // Constrói os dados de cada etapa a partir das respostas (valores) + "outros".
  const strDe = (a: Record<string, string | string[]>, id: string) => (a[id] as string) ?? "";
  const arrDe = (a: Record<string, string | string[]>, id: string) => (Array.isArray(a[id]) ? (a[id] as string[]) : []);

  function buildMembro(a: Record<string, string | string[]>, o: Record<string, string>): MembroInput {
    const interesses = arrDe(a, "membro_interesses")
      .map((v) => (v === "Outro" ? (o["membro_interesses"] || "").trim() : v))
      .filter(Boolean);
    return {
      nome: strDe(a, "membro_nome"),
      genero: (strDe(a, "membro_genero") as "feminino" | "masculino") || "feminino",
      nascimento: strDe(a, "membro_nascimento"),
      laudo: arrDe(a, "membro_laudo"),
      laudoOutro: o["membro_laudo"] ?? null,
      investigacao: arrDe(a, "membro_investigacao"),
      interesses,
    };
  }
  function buildResp(a: Record<string, string | string[]>, o: Record<string, string>): ResponsavelInput {
    return {
      nome: strDe(a, "voce_nome"),
      relacao: strDe(a, "voce_relacao"),
      relacaoOutro: o["voce_relacao"] ?? null,
      genero: null,
      faixa: strDe(a, "voce_faixa") || null,
    };
  }

  async function proximo(next: Record<string, string | string[]>, novoOutro?: { id: string; texto: string }) {
    const merged = { ...answers, ...next };
    const outrosMerged = novoOutro ? { ...outros, [novoOutro.id]: novoOutro.texto } : outros;
    setAnswers(merged);
    if (novoOutro) setOutros(outrosMerged);
    setTexto("");
    setMulti([]);
    setUni(null);

    if (retomarEm !== null) {
      const back = retomarEm;
      setRetomarEm(null);
      setIdx(back);
      return;
    }

    const id = passo?.id;
    const ultimo = idx + 1 >= passos.length;

    // Checkpoints — salvam cedo (pro "Parou em" + resgate) e são idempotentes.
    if (id === "membro_interesses") {
      void salvarMembroAction(buildMembro(merged, outrosMerged), arrDe(merged, "desafios"));
    } else if (id === "whatsapp") {
      setFase("salvando");
      const res = await salvarWhatsappAction(telParaE164(strDe(merged, "whatsapp")));
      if (!res.ok && res.motivo === "whatsapp_duplicado") {
        setFase("duplicado");
        return;
      }
      setFase("form");
    } else if (id === "aceites") {
      void salvarAceitesAction(aceites);
    }

    if (ultimo) void finalizar(merged, outrosMerged);
    else setIdx(idx + 1);
  }

  function editar(k: number) {
    const ans = answers[passos[k].id];
    setRetomarEm((r) => (r === null ? idx : r));
    setTexto(typeof ans === "string" ? ans : "");
    setMulti([]);
    setUni(null);
    setIdx(k);
  }

  // Fim: salva tudo de novo (captura edições) e conclui.
  async function finalizar(a: Record<string, string | string[]>, o: Record<string, string>) {
    setFase("salvando");
    await salvarMembroAction(buildMembro(a, o), arrDe(a, "desafios"));
    const w = await salvarWhatsappAction(telParaE164(strDe(a, "whatsapp")));
    if (!w.ok && w.motivo === "whatsapp_duplicado") {
      setFase("duplicado");
      return;
    }
    await salvarAceitesAction(aceites);
    const res = await concluirAction(buildResp(a, o), strDe(a, "voce_horario") || null);
    if (res.ok) setFase("pronto");
    else if (res.motivo === "whatsapp_duplicado") setFase("duplicado");
    else {
      setErroMsg(res.mensagem);
      setFase("erro");
    }
  }

  function legivel(p: OnbPasso, v: string | string[]): string {
    if (p.tipo === "aceites") return "Combinado ✓";
    if (Array.isArray(v)) return v.map((x) => (x === "Outro" ? outros[p.id] || "Outro" : opcoesLabel.get(`${p.id}:${x}`) ?? x)).join(", ");
    if (p.tipo === "chips_uni") return outros[p.id] || opcoesLabel.get(`${p.id}:${v}`) || v;
    return v;
  }

  // ---- Telas de resultado ----
  if (fase === "salvando") {
    return <Centro>Preparando tudo pra vocês… 🌱</Centro>;
  }
  if (fase === "pronto") {
    return (
      <Centro>
        <p className="font-heading text-xl text-foreground">Tudo pronto, {voce || "você"}! 💛</p>
        <p className="text-sm text-muted-foreground">A Ayla já vai te escrever no WhatsApp.</p>
        <Button onClick={() => router.push("/painel")}>Entrar no Kolo</Button>
      </Centro>
    );
  }
  if (fase === "duplicado") {
    return (
      <Centro>
        <p className="font-heading text-lg text-foreground">Já existe uma conta com esse WhatsApp</p>
        <p className="text-sm text-muted-foreground">Provavelmente é sua — é só entrar.</p>
        <div className="flex gap-2">
          <Button onClick={() => router.push("/login")}>Entrar</Button>
          <Button variant="outline" onClick={() => { setFase("form"); setIdx(passos.findIndex((p) => p.tipo === "whatsapp")); }}>
            Usar outro número
          </Button>
        </div>
      </Centro>
    );
  }
  if (fase === "erro") {
    return (
      <Centro>
        <p className="font-heading text-lg text-foreground">Não consegui concluir agora</p>
        <p className="text-sm text-muted-foreground">{erroMsg || "Tente de novo em instantes."}</p>
        <Button onClick={() => finalizar(answers, outros)}>Tentar de novo</Button>
      </Centro>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-3">
      <div className="rounded-2xl bg-secondary/50 p-4 text-center">
        <p className="font-heading text-lg text-foreground">{copy.intro.titulo}</p>
        <p className="mt-1 text-sm text-muted-foreground">{copy.intro.subtitulo}</p>
      </div>

      {/* histórico — toque pra corrigir */}
      {passos.slice(0, idx).map((p, k) => (
        <div key={p.id} className="flex flex-col gap-1.5">
          <Bolha lado="ayla">{fill(p.ayla, nome, voce)}</Bolha>
          {answers[p.id] !== undefined && (
            <div className="flex justify-end">
              <button
                onClick={() => editar(k)}
                title="Tocar pra corrigir"
                className="max-w-[85%] rounded-2xl rounded-tr-sm bg-brand-purple px-3.5 py-2.5 text-left text-sm text-white hover:opacity-80"
              >
                {legivel(p, answers[p.id])}
                <span className="ml-1.5 opacity-70">✎</span>
              </button>
            </div>
          )}
        </div>
      ))}

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
                value={passo.tipo === "whatsapp" ? maskTel(texto) : texto}
                placeholder={passo.placeholder}
                inputMode={passo.tipo === "data" || passo.tipo === "whatsapp" ? "numeric" : undefined}
                onChange={(e) =>
                  setTexto(passo.tipo === "data" ? mascararDataBr(e.target.value) : e.target.value)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && texto.trim()) proximo({ [passo.id]: texto.trim() });
                }}
              />
              {passo.nota && <span className="text-xs text-muted-foreground">{fill(passo.nota, nome, voce)}</span>}
              <div className="flex justify-end">
                <Button size="sm" disabled={!texto.trim()} onClick={() => proximo({ [passo.id]: texto.trim() })}>
                  Continuar
                </Button>
              </div>
            </div>
          )}

          {passo.tipo === "chips_uni" && (
            <div className="flex flex-col gap-2">
              <ChipGroup label={passo.id}>
                {(passo.opcoes ?? []).map((o) => (
                  <Chip
                    key={o.value}
                    selected={uni === o.value}
                    onClick={() => (o.livre ? setUni(o.value) : proximo({ [passo.id]: o.value }))}
                  >
                    {o.label}
                  </Chip>
                ))}
              </ChipGroup>
              {uni && (passo.opcoes ?? []).find((o) => o.value === uni)?.livre && (
                <div className="flex flex-col gap-1.5">
                  <Input value={texto} placeholder="Escreva aqui — ex.: tia, madrinha, tutor(a)" onChange={(e) => setTexto(e.target.value)} />
                  <div className="flex justify-end">
                    <Button size="sm" disabled={!texto.trim()} onClick={() => proximo({ [passo.id]: uni! }, { id: passo.id, texto: texto.trim() })}>
                      Continuar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {passo.tipo === "chips_multi" &&
            (() => {
              const opcoes = opcoesDoPasso(passo, (answers["membro_nascimento"] as string) ?? "");
              const temLivre = multi.some((v) => opcoes.find((o) => o.value === v)?.livre);
              const pode = (passo.opcional || multi.length > 0) && (!temLivre || texto.trim().length > 0);
              return (
                <div className="flex flex-col gap-2">
                  <ChipGroup label={passo.id}>
                    {opcoes.map((o) => (
                      <Chip
                        key={o.value}
                        selected={multi.includes(o.value)}
                        onClick={() => setMulti((m) => (m.includes(o.value) ? m.filter((x) => x !== o.value) : [...m, o.value]))}
                      >
                        {o.label}
                      </Chip>
                    ))}
                  </ChipGroup>
                  {temLivre && (
                    <Input value={texto} placeholder="Escreva aqui — qual?" onChange={(e) => setTexto(e.target.value)} />
                  )}
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      disabled={!pode}
                      onClick={() => proximo({ [passo.id]: multi }, temLivre ? { id: passo.id, texto: texto.trim() } : undefined)}
                    >
                      {passo.opcional && multi.length === 0 ? "Pular" : "Continuar"}
                    </Button>
                  </div>
                </div>
              );
            })()}

          {passo.tipo === "aceites" && (
            <div className="flex flex-col gap-2 rounded-2xl bg-white/70 p-3">
              <label className="flex items-start gap-2 text-sm text-foreground">
                <input type="checkbox" checked={aceites.termos} onChange={(e) => setAceites((a) => ({ ...a, termos: e.target.checked }))} className="mt-0.5" />
                <span>
                  Aceito os{" "}
                  <a href="/termos" target="_blank" rel="noopener noreferrer" className="text-brand-purple underline">termos de uso</a>{" "}
                  e a{" "}
                  <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="text-brand-purple underline">política de privacidade</a>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-foreground">
                <input type="checkbox" checked={aceites.ayla} onChange={(e) => setAceites((a) => ({ ...a, ayla: e.target.checked }))} className="mt-0.5" />
                A Ayla pode me escrever no WhatsApp
              </label>
              <div className="flex justify-end">
                <Button size="sm" disabled={!aceites.termos || !aceites.ayla} onClick={() => proximo({ [passo.id]: "ok" })}>
                  Continuar
                </Button>
              </div>
            </div>
          )}
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

function Centro({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-10 text-center">{children}</div>;
}
