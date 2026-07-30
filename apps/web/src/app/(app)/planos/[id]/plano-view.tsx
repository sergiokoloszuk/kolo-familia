"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Printer, Sparkles, Trash2, RefreshCw } from "lucide-react";
import { RespostaMarkdown } from "@/components/resposta-markdown";
import { capitalizarNome } from "@/lib/nome";
import { cn } from "@/lib/utils";
import { PlanoResultado } from "./plano-resultado";
import { ajustarPlano, deletarPlano } from "../actions";

export type PlanoSecaoView = {
  tipo: string;
  titulo: string;
  conteudo_markdown: string;
};

const LABEL: Record<string, string> = {
  entender: "Entendendo",
  crencas: "Crenças",
  diferente: "O que fazer diferente",
  rotina: "Rotina",
  brincadeiras: "Brincadeiras",
  atividades: "Atividades",
  historia_social: "Histórias sociais",
  frases: "Frases prontas",
  observar: "O que observar",
};

/** Rótulo da seção, adaptado à idade: "Brincadeiras" só faz sentido pra
 *  criança — adolescente/adulto vê "Lazer e interesses". */
function labelDe(tipo: string, idade: number | null): string | undefined {
  if (tipo === "brincadeiras" && idade != null && idade >= 13) return "Lazer e interesses";
  return LABEL[tipo];
}

export function PlanoView({
  planoId,
  titulo,
  crianca,
  idade,
  secoes,
  resultado,
  resultadoNota,
  aviso,
}: {
  planoId: string;
  titulo: string;
  crianca: string | null;
  idade: number | null;
  secoes: PlanoSecaoView[];
  resultado: "funcionou" | "parcial" | "nao_funcionou" | "nao_testou" | null;
  resultadoNota: string | null;
  /** Recado no topo — ex.: o ajuste pedido não deu certo e o plano voltou
   *  como estava. O plano continua inteiro logo abaixo. */
  aviso?: string | null;
}) {
  const [filtro, setFiltro] = useState<string>("tudo");
  const tipos = Array.from(new Set(secoes.map((s) => s.tipo)));
  const visiveis = filtro === "tudo" ? secoes : secoes.filter((s) => s.tipo === filtro);
  const nome = crianca ? capitalizarNome(crianca) : null;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <Link
          href="/planos"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground print:hidden"
        >
          <ChevronLeft aria-hidden="true" className="size-3" />
          Meus Planos
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-3xl text-foreground md:text-4xl">{titulo}</h1>
            {nome && <p className="mt-1 text-sm text-muted-foreground">Sobre {nome}</p>}
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-brand-purple/20 bg-white px-4 py-2 text-sm font-semibold text-brand-purple shadow-sm transition-colors hover:bg-kolo-lilas-bg-2 print:hidden"
          >
            <Printer className="size-4" aria-hidden /> Imprimir
          </button>
        </div>
      </header>

      {aviso && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm leading-relaxed text-amber-900 print:hidden">
          {aviso}
        </p>
      )}

      {/* Filtro — os antigos "botões" viram visões do mesmo plano (0 chamada). */}
      {tipos.length > 1 && (
        <div className="flex flex-wrap gap-2 print:hidden">
          <Aba ativo={filtro === "tudo"} onClick={() => setFiltro("tudo")}>
            Tudo
          </Aba>
          {tipos.map((t) => (
            <Aba key={t} ativo={filtro === t} onClick={() => setFiltro(t)}>
              {labelDe(t, idade) ?? t}
            </Aba>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-8">
        {visiveis.map((s, i) => (
          <section key={`${s.tipo}-${i}`}>
            <h2 className="font-heading text-xl text-brand-purple md:text-2xl">
              {labelDe(s.tipo, idade) || s.titulo || "Seção"}
            </h2>
            <RespostaMarkdown
              texto={s.conteudo_markdown}
              className="mt-2 flex flex-col gap-3 text-base leading-relaxed text-foreground"
            />
          </section>
        ))}
      </div>

      <PlanoResultado planoId={planoId} resultado={resultado} nota={resultadoNota} />

      <PlanoGestao planoId={planoId} />
    </div>
  );
}

/** Pedir um ajuste (regenera) + excluir o plano. */
function PlanoGestao({ planoId }: { planoId: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [instrucao, setInstrucao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ajustando, startAjuste] = useTransition();
  const [excluindo, startExcluir] = useTransition();
  const [confirmaExcluir, setConfirmaExcluir] = useState(false);

  function pedirAjuste() {
    const t = instrucao.trim();
    if (t.length < 3 || ajustando) return;
    setErro(null);
    startAjuste(async () => {
      const r = await ajustarPlano({ planoId, instrucao: t });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      // Volta pro estado "montando…"; a própria página re-renderiza no poller.
      router.refresh();
    });
  }

  function excluir() {
    if (excluindo) return;
    setErro(null);
    startExcluir(async () => {
      const r = await deletarPlano({ planoId });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      router.push("/planos");
    });
  }

  return (
    <div className="flex flex-col gap-4 border-t border-foreground/[0.06] pt-6 print:hidden">
      {erro && <p className="text-sm text-destructive">{erro}</p>}

      {/* Pedir um ajuste */}
      <div className="rounded-2xl border border-brand-purple/15 bg-kolo-lilas-bg-2/40 p-4">
        {!aberto ? (
          <button
            type="button"
            onClick={() => setAberto(true)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-purple hover:text-brand-purple-dark"
          >
            <Sparkles className="size-4" aria-hidden /> Pedir um ajuste neste plano
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="font-heading text-base font-medium text-foreground">
              O que você quer ajustar?
            </p>
            <textarea
              rows={2}
              value={instrucao}
              onChange={(e) => setInstrucao(e.target.value)}
              placeholder="Ex.: deixa mais simples · foca em ideias pra fora de casa · mais frases prontas · tira a parte de rotina…"
              className="w-full resize-none rounded-xl border border-foreground/[0.08] bg-white/70 px-3.5 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-foreground/10"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={pedirAjuste}
                disabled={ajustando || instrucao.trim().length < 3}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-purple px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-purple-dark disabled:opacity-50"
              >
                {ajustando ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" aria-hidden /> Refazendo…
                  </>
                ) : (
                  "Refazer com o ajuste"
                )}
              </button>
              <button
                type="button"
                onClick={() => setAberto(false)}
                disabled={ajustando}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Cancelar
              </button>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Refaço o plano inteiro levando seu ajuste em conta — leva ~1 min e a tela
              atualiza sozinha.
            </p>
          </div>
        )}
      </div>

      {/* Excluir */}
      <div className="flex items-center justify-end">
        {confirmaExcluir ? (
          <span className="inline-flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">Excluir este plano?</span>
            <button
              type="button"
              onClick={excluir}
              disabled={excluindo}
              className="inline-flex items-center gap-1.5 font-semibold text-destructive hover:underline disabled:opacity-50"
            >
              {excluindo ? <RefreshCw className="size-3.5 animate-spin" aria-hidden /> : null}
              Sim, excluir
            </button>
            <button
              type="button"
              onClick={() => setConfirmaExcluir(false)}
              disabled={excluindo}
              className="text-muted-foreground hover:text-foreground"
            >
              Não
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmaExcluir(true)}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-4" aria-hidden /> Excluir plano
          </button>
        )}
      </div>
    </div>
  );
}

function Aba({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        "rounded-full border px-4 py-2 text-sm transition-colors",
        ativo
          ? "border-brand-purple bg-brand-purple font-semibold text-white shadow-sm"
          : "border-input bg-white font-medium text-muted-foreground hover:border-brand-purple/40 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
