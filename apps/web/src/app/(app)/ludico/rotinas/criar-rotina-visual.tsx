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
/**
 * O exemplo começa FECHADO. Onze passos abertos dominam a tela e fazem a
 * criação parecer trabalho — quem já sabe o que quer escrever passa direto,
 * quem não sabe abre e entende que a rotina visual também prepara pra uma
 * experiência, não só representa a agenda do dia.
 */
const EXEMPLO_CURTO = 6;

const LINHAS_INICIAIS = 4;

/**
 * Sugestões pra quem não tem interesse registrado no perfil — ou tem, mas
 * quer outro. Não é catálogo nem categoria: tema é só uma instrução visual, e
 * "princesas" não é mais especial que "dinossauros".
 */
const TEMAS_POPULARES = [
  "Princesas",
  "Dinossauros",
  "Animais",
  "Futebol",
  "Espaço",
  "Carros",
  "Super-heróis",
  "Natureza",
];

export function CriarRotinaVisual({
  membroId,
  nomeMembro,
  interesses,
  temAvatar,
  avatarUrl,
}: {
  membroId: string;
  nomeMembro: string;
  /** Interesses reais DESTA criança. Vazio = só "outro tema". */
  interesses: string[];
  temAvatar: boolean;
  /** Miniatura do personagem já criado, quando existe. */
  avatarUrl?: string | null;
}) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [linhas, setLinhas] = useState<string[]>(() => Array(LINHAS_INICIAIS).fill(""));
  const [tema, setTema] = useState("");
  const [temaLivre, setTemaLivre] = useState("");
  const [usarAvatar, setUsarAvatar] = useState(temAvatar);
  const [verExemplo, setVerExemplo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  const passos = useMemo(() => linhas.map((l) => l.trim()).filter(Boolean), [linhas]);

  /**
   * Os interesses REAIS da criança vêm primeiro — é o que faz o cartão ter a
   * cara dela. Os populares entram depois, pra quem não tem nada registrado
   * não ficar diante de um campo vazio. Sem repetir o que já apareceu.
   */
  const sugestoes = useMemo(() => {
    const vistos = new Set(interesses.map((i) => i.toLowerCase()));
    return [...interesses, ...TEMAS_POPULARES.filter((t) => !vistos.has(t.toLowerCase()))].slice(0, 9);
  }, [interesses]);
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

        {!verExemplo ? (
          <button
            type="button"
            onClick={() => setVerExemplo(true)}
            className="w-fit text-sm font-semibold text-brand-purple hover:underline"
          >
            Ver exemplo · Dia do dentista →
          </button>
        ) : (
          <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-brand-purple/50 bg-brand-purple/[0.05] p-4">
            <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-brand-purple-dark">
              Exemplo · Dia do dentista
            </p>
            <ol className="flex flex-col gap-1 text-[15px] text-foreground">
              {EXEMPLO.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ol>
            <p className="text-sm italic text-muted-foreground">
              Uma rotina visual também prepara {nomeMembro || "a criança"} pra uma experiência —
              não é só a agenda do dia. Pense nos passos que ela precisa conhecer pra entender o
              que vai acontecer do começo ao fim.
            </p>
            <button
              type="button"
              onClick={() => setVerExemplo(false)}
              className="w-fit text-sm font-semibold text-brand-purple hover:underline"
            >
              Fechar exemplo
            </button>
          </div>
        )}

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
          {sugestoes.map((it) => (
            <Chip key={it} sel={tema === it} onClick={() => setTema(tema === it ? "" : it)}>
              {it}
            </Chip>
          ))}
          <Chip sel={tema === "__outro"} onClick={() => setTema(tema === "__outro" ? "" : "__outro")}>
            Outro tema
          </Chip>
        </div>
        {tema === "__outro" && (
          <label className="flex max-w-sm flex-col gap-1.5 text-sm text-muted-foreground">
            Qual tema você quer?
          <input
            value={temaLivre}
            onChange={(e) => setTemaLivre(e.target.value)}
            placeholder="Ex.: fundo do mar, cavalos, trens, unicórnios…"
            maxLength={40}
            autoFocus
            className="rounded-xl border border-kolo-linha bg-white px-4 py-2.5 text-[15px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-brand-purple/30"
          />
          </label>
        )}
      </div>

      {/* QUEM APARECE NOS CARTÕES — decisão diferente do tema (que é o cenário).
          "Avatar" é palavra do produto, não da família: quem nunca usou não sabe
          o que é. A pergunta é pelo nome da criança. */}
      {temAvatar ? (
        <div className="flex flex-col gap-3">
          <p className="text-[15px] font-semibold text-foreground">
            Quer que {nomeMembro || "a criança"} apareça nos cartões?
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {avatarUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                className="size-12 shrink-0 rounded-full border border-kolo-linha object-cover"
              />
            )}
            <Chip sel={usarAvatar} onClick={() => setUsarAvatar(true)}>
              Sim, usar {nomeMembro || "a criança"} como personagem
            </Chip>
            <Chip sel={!usarAvatar} onClick={() => setUsarAvatar(false)}>
              Não, usar personagens do tema
            </Chip>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Quer que {nomeMembro || "a criança"} seja personagem dos cartões?{" "}
          <a
            href="/configuracoes/avatar"
            className="font-semibold text-brand-purple hover:underline"
          >
            Criar personagem {nomeMembro ? `d${nomeMembro.endsWith("a") ? "a" : "o"} ${nomeMembro}` : ""} →
          </a>
        </p>
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
