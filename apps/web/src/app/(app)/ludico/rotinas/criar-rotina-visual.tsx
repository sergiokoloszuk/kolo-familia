"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Plus } from "lucide-react";
import { criarRotinaVisual } from "./actions";
import { passosDoTexto } from "@/lib/ludico/interesses";

/**
 * A FÓRMULA ÚNICA da Rotina Visual.
 *
 * Antes existiam três portas — "Montar com a Kolo" (chat), "Rotina da semana" e
 * "Nova rotina" — e a mãe precisava entender a arquitetura do produto pra
 * escolher. Agora é uma coisa só: nome (opcional), os passos, o tema, gerar.
 *
 * "Segunda-feira", "Dia do dentista" e "brincar → guardar → banho → pijama" são
 * a mesma coisa pra ela: uma sequência que a criança precisa ENXERGAR. Por isso
 * não se pergunta o tipo.
 *
 * Sem horário: era a maior fonte de rotina barrada, e a mãe não precisa saber a
 * que horas nada acontece pra a criança entender a ordem.
 */

const EXEMPLO = [
  "Estou em casa",
  "Coloco o sapato",
  "Vou de carro até o dentista",
  "Chego ao consultório",
  "Espero minha vez",
  "Entro na sala do dentista",
  "Sento na cadeira",
  "Abro a boca para o dentista olhar",
  "O dentista cuida dos meus dentes",
  "Termino e vou embora",
  "Volto para casa",
];
/** Quantos passos aparecem antes de "ver exemplo completo". Onze de cara faz a
 *  tela parecer trabalho; seis ensinam a mesma coisa. */
const EXEMPLO_CURTO = 6;

const LINHAS_INICIAIS = 4;

export function CriarRotinaVisual({
  membroId,
  nomeMembro,
  interesses,
  temAvatar,
}: {
  membroId: string;
  nomeMembro: string;
  /** Interesses reais DESTA criança. Vazio = só "outro tema". */
  interesses: string[];
  temAvatar: boolean;
}) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [linhas, setLinhas] = useState<string[]>(() => Array(LINHAS_INICIAIS).fill(""));
  const [tema, setTema] = useState("");
  const [temaLivre, setTemaLivre] = useState("");
  const [usarAvatar, setUsarAvatar] = useState(temAvatar);
  const [verTudo, setVerTudo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  const passos = useMemo(() => linhas.map((l) => l.trim()).filter(Boolean), [linhas]);
  const podeGerar = passos.length > 0 && !enviando;

  /**
   * A mãe cola um bloco — foi o que ela fez em todos os testes reais. Colar em
   * uma linha espalha nas linhas seguintes em vez de virar um parágrafo só.
   */
  function escrever(i: number, valor: string) {
    const partes = passosDoTexto(valor);
    setLinhas((atual) => {
      const novo = [...atual];
      if (partes.length > 1) {
        novo.splice(i, 1, ...partes);
      } else {
        novo[i] = valor;
      }
      // Sempre uma linha vazia no fim, pra ela nunca precisar clicar em nada.
      while (novo.length && novo[novo.length - 1]?.trim() === "" && novo.length > i + 2) novo.pop();
      if (novo[novo.length - 1]?.trim() !== "") novo.push("");
      return novo;
    });
  }

  function gerar() {
    if (!podeGerar) return;
    setErro(null);
    const temaFinal = (tema === "__outro" ? temaLivre : tema).trim();
    iniciar(async () => {
      const r = await criarRotinaVisual({
        membroAtipicoId: membroId,
        nome: nome.trim(),
        passos,
        tema: temaFinal,
        usarAvatar: temAvatar && usarAvatar,
      });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      router.push(`/ludico/rotinas/${r.rotinaId}`);
    });
  }

  const exemploVisivel = verTudo ? EXEMPLO : EXEMPLO.slice(0, EXEMPLO_CURTO);

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      {/* 1. NOME */}
      <div className="flex flex-col gap-2">
        <label htmlFor="rv-nome" className="text-[15px] font-semibold text-foreground">
          Como vamos chamar essa rotina?
        </label>
        <input
          id="rv-nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Dia do dentista"
          maxLength={80}
          className="rounded-xl border border-kolo-linha bg-white px-4 py-3 text-[15px] placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-brand-purple/30"
        />
        <p className="text-sm text-muted-foreground">
          Se deixar em branco, eu dou um nome a partir do que você escrever.
        </p>
      </div>

      {/* 2. OS PASSOS */}
      <div className="flex flex-col gap-3">
        <p className="text-[15px] font-semibold text-foreground">O que vai acontecer?</p>
        <p className="text-sm text-muted-foreground">
          Coloque na ordem o que {nomeMembro} vai vivenciar — uma coisa por linha.
        </p>

        <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-brand-purple/50 bg-brand-purple/[0.05] p-4">
          <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-brand-purple-dark">
            Exemplo · Dia do dentista
          </p>
          <ol className="flex flex-col gap-1 text-[15px] text-foreground">
            {exemploVisivel.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
          {!verTudo && (
            <button
              type="button"
              onClick={() => setVerTudo(true)}
              className="w-fit text-sm font-semibold text-brand-purple hover:underline"
            >
              Ver exemplo completo →
            </button>
          )}
          <p className="text-sm italic text-muted-foreground">
            Pense nos passos que {nomeMembro} precisa conhecer pra entender o que vai acontecer do
            começo ao fim. Serve pro dia inteiro, pra um passeio ou pra um momento difícil — é
            sempre uma sequência.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {linhas.map((valor, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl border border-kolo-linha bg-white px-4 py-2.5 focus-within:ring-2 focus-within:ring-brand-purple/30"
            >
              <span className="w-5 shrink-0 text-sm font-bold tabular-nums text-brand-purple">
                {i + 1}
              </span>
              <input
                value={valor}
                onChange={(e) => escrever(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const proximo = document.getElementById(`rv-passo-${i + 1}`);
                    if (proximo instanceof HTMLInputElement) proximo.focus();
                  }
                }}
                id={`rv-passo-${i}`}
                maxLength={120}
                placeholder={i === 0 ? "Estou em casa" : ""}
                aria-label={`Passo ${i + 1}`}
                className="flex-1 bg-transparent text-[15px] placeholder:text-muted-foreground/50 focus:outline-none"
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setLinhas((a) => [...a, ""])}
          className="flex w-fit items-center gap-1.5 py-1 text-[15px] font-semibold text-brand-purple hover:underline"
        >
          <Plus className="size-4" aria-hidden /> adicionar
        </button>
        <p className="text-sm text-muted-foreground">
          Pode colar tudo de uma vez — “café, escola, almoço, brincar, banho” vira uma linha pra
          cada.
        </p>
      </div>

      {/* 3. TEMA — o cenário dos cartões */}
      <div className="flex flex-col gap-3">
        <p className="text-[15px] font-semibold text-foreground">Escolha um tema</p>
        <p className="text-sm text-muted-foreground">
          {interesses.length
            ? `É a cara dos cartões. Estes são os interesses que já conheço ${nomeMembro ? `d${nomeMembro.endsWith("a") ? "a" : "o"} ${nomeMembro}` : ""}.`
            : "É a cara dos cartões."}
        </p>
        <div className="flex flex-wrap gap-2">
          {interesses.map((it) => (
            <Chip key={it} sel={tema === it} onClick={() => setTema(tema === it ? "" : it)}>
              {it}
            </Chip>
          ))}
          <Chip sel={tema === "__outro"} onClick={() => setTema(tema === "__outro" ? "" : "__outro")}>
            Outro tema
          </Chip>
        </div>
        {tema === "__outro" && (
          <input
            value={temaLivre}
            onChange={(e) => setTemaLivre(e.target.value)}
            placeholder="Ex.: fundo do mar, princesas, carrinhos…"
            maxLength={40}
            autoFocus
            className="max-w-sm rounded-xl border border-kolo-linha bg-white px-4 py-2.5 text-[15px] placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-brand-purple/30"
          />
        )}
      </div>

      {/* PERSONAGEM — separado do tema de propósito: o tema é o cenário, o
          personagem é quem aparece. Só existe quando a criança tem avatar. */}
      {temAvatar && (
        <div className="flex flex-col gap-3">
          <p className="text-[15px] font-semibold text-foreground">Personagem dos cartões</p>
          <div className="flex flex-wrap gap-2">
            <Chip sel={usarAvatar} onClick={() => setUsarAvatar(true)}>
              Avatar {nomeMembro ? `d${nomeMembro.endsWith("a") ? "a" : "o"} ${nomeMembro}` : ""}
            </Chip>
            <Chip sel={!usarAvatar} onClick={() => setUsarAvatar(false)}>
              Personagem do tema
            </Chip>
          </div>
        </div>
      )}

      {erro && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {erro}
        </p>
      )}

      <button
        type="button"
        onClick={gerar}
        disabled={!podeGerar}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-purple px-6 py-4 text-[17px] font-bold text-white transition-colors hover:bg-brand-purple-dark disabled:opacity-40"
      >
        <Sparkles className="size-5" aria-hidden />
        {enviando ? "Criando…" : "Gerar minha rotina visual"}
      </button>
    </div>
  );
}

function Chip({
  sel,
  onClick,
  children,
}: {
  sel: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={sel}
      className={
        sel
          ? "rounded-full border border-brand-purple bg-brand-purple px-4 py-2 text-[14.5px] font-semibold text-white"
          : "rounded-full border border-kolo-linha bg-white px-4 py-2 text-[14.5px] text-foreground transition-colors hover:border-brand-purple/50"
      }
    >
      {children}
    </button>
  );
}
