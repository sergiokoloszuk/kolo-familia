"use client";

import { useState, useTransition } from "react";
import { Pencil, Printer, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RespostaMarkdown } from "@/components/resposta-markdown";
import { cn } from "@/lib/utils";
import { gerarRelatorio, ajustarRelatorio } from "./actions";

type Destinatario = "escola" | "terapeuta";

export function RelatorioClient({
  membros,
  membroAtivoId,
  dataHoje,
}: {
  membros: Array<{ id: string; nome: string }>;
  membroAtivoId: string;
  dataHoje: string;
}) {
  const [membroId, setMembroId] = useState(membroAtivoId || membros[0]?.id || "");
  const [destinatario, setDestinatario] = useState<Destinatario>("terapeuta");
  const [markdown, setMarkdown] = useState("");
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startGerar] = useTransition();
  const [pedido, setPedido] = useState("");
  const [ajustando, startAjuste] = useTransition();
  const [mostrarEdicao, setMostrarEdicao] = useState(false);

  function gerar() {
    if (!membroId || pending) return;
    setErro(null);
    startGerar(async () => {
      const r = await gerarRelatorio({ membroId, destinatario });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setMarkdown(r.markdown);
      setNome(r.nome);
    });
  }

  // O nome do PDF salvo vem do document.title. Setamos pra "Relatório Kolo
  // Família — [nome]" antes de imprimir e restauramos depois (senão salvava
  // como "Kolo Família").
  function imprimir() {
    const anterior = document.title;
    const limpo = nome.trim();
    document.title = `Conhecendo ${limpo || "a criança"} — Guia Kolo Família`;
    const restaurar = () => {
      document.title = anterior;
      window.removeEventListener("afterprint", restaurar);
    };
    window.addEventListener("afterprint", restaurar);
    window.print();
  }

  function ajustar() {
    const p = pedido.trim();
    if (!p || !markdown || ajustando) return;
    setErro(null);
    startAjuste(async () => {
      const r = await ajustarRelatorio({ membroId, destinatario, markdownAtual: markdown, pedido: p });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setMarkdown(r.markdown);
      setNome(r.nome);
      setPedido("");
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Controles — não imprimem */}
      <div className="flex flex-col gap-4 rounded-2xl border border-brand-purple/15 bg-kolo-lilas-bg-2/40 p-5 print:hidden">
        {erro && <p className="text-sm text-destructive">{erro}</p>}

        {membros.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="rel-membro" className="text-sm font-medium text-foreground">
              Sobre quem
            </label>
            <select
              id="rel-membro"
              value={membroId}
              onChange={(e) => setMembroId(e.target.value)}
              className="h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm"
            >
              {membros.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Para quem é o relatório</span>
          <div className="flex flex-wrap gap-2">
            {(["terapeuta", "escola"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDestinatario(d)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                  destinatario === d
                    ? "border-brand-purple bg-brand-purple text-white"
                    : "border-input bg-white text-foreground hover:border-brand-purple/40",
                )}
              >
                {d === "terapeuta" ? "Terapeuta" : "Escola"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={gerar} disabled={pending || !membroId}>
            {pending ? (
              <>
                <Sparkles className="size-4 animate-pulse" aria-hidden /> Montando…
              </>
            ) : (
              <>
                <Sparkles className="size-4" aria-hidden /> {markdown ? "Gerar de novo" : "Gerar o guia"}
              </>
            )}
          </Button>
          {markdown && (
            <button
              type="button"
              onClick={imprimir}
              className="inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-white px-4 py-2 text-sm font-semibold text-brand-purple transition-colors hover:bg-kolo-lilas-bg-2"
            >
              <Printer className="size-4" aria-hidden /> Imprimir / salvar PDF
            </button>
          )}
        </div>

        {pending && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Pode levar até um minuto — estou lendo o Perfil e escrevendo o relatório com cuidado. 🌿
          </p>
        )}
      </div>

      {markdown && (
        <>
          {/* Ajuste por chat de IA — não imprime */}
          <div className="flex flex-col gap-2.5 rounded-2xl border border-brand-purple/15 bg-white p-4 print:hidden">
            <span className="text-sm font-medium text-foreground">
              Quer mudar algo? Peça pra Kolo ajustar
            </span>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={pedido}
                onChange={(e) => setPedido(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") ajustar();
                }}
                disabled={ajustando}
                placeholder="Ex.: deixa mais curto · tom mais caloroso · acrescenta sobre o sono · tira a parte da família"
                className="h-10 flex-1 rounded-xl border border-foreground/[0.08] bg-white px-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-foreground/10"
              />
              <Button type="button" onClick={ajustar} disabled={ajustando || !pedido.trim()}>
                {ajustando ? (
                  <>
                    <Sparkles className="size-4 animate-pulse" aria-hidden /> Ajustando…
                  </>
                ) : (
                  <>
                    <Send className="size-4" aria-hidden /> Ajustar
                  </>
                )}
              </Button>
            </div>
            <button
              type="button"
              onClick={() => setMostrarEdicao((v) => !v)}
              className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <Pencil className="size-3" aria-hidden />
              {mostrarEdicao ? "Esconder edição manual" : "Ou editar à mão"}
            </button>
            {mostrarEdicao && (
              <textarea
                rows={12}
                value={markdown}
                onChange={(e) => setMarkdown(e.target.value)}
                className="w-full resize-y rounded-xl border border-foreground/[0.08] bg-white/70 px-4 py-3 font-mono text-sm leading-relaxed text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/10"
              />
            )}
          </div>

          {/* Documento elegante — alvo da impressão */}
          <article className="rounded-2xl border border-foreground/[0.08] bg-white px-8 py-10 shadow-[0_1px_2px_rgba(46,10,82,0.04),_0_8px_24px_rgba(46,10,82,0.05)] md:px-12 md:py-12 print:rounded-none print:border-0 print:px-0 print:py-0 print:shadow-none">
            <header className="mb-7 border-b-2 border-brand-purple/15 pb-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-purple">
                Guia {destinatario === "escola" ? "pra escola" : "pra terapeuta"}
              </p>
              <h1 className="mt-2 font-heading text-3xl text-foreground md:text-4xl">
                Conhecendo {nome}
              </h1>
              {dataHoje && <p className="mt-1.5 text-sm text-muted-foreground">{dataHoje}</p>}
            </header>
            <RespostaMarkdown
              texto={markdown}
              className="flex flex-col gap-3.5 text-[15px] leading-[1.75] text-foreground/90"
            />
            <footer className="mt-10 border-t border-foreground/10 pt-4 text-xs leading-relaxed text-muted-foreground">
              Gerado pela <strong className="font-semibold text-foreground/70">Kolo Família</strong>,
              com base nos registros da família. É um apoio à observação — não substitui avaliação
              profissional.
            </footer>
          </article>
        </>
      )}
    </div>
  );
}
