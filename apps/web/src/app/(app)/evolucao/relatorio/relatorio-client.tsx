"use client";

import { useState, useTransition } from "react";
import { Printer, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RespostaMarkdown } from "@/components/resposta-markdown";
import { cn } from "@/lib/utils";
import { gerarRelatorio } from "./actions";

type Destinatario = "escola" | "terapeuta";

export function RelatorioClient({ membros }: { membros: Array<{ id: string; nome: string }> }) {
  const [membroId, setMembroId] = useState(membros[0]?.id ?? "");
  const [destinatario, setDestinatario] = useState<Destinatario>("terapeuta");
  const [markdown, setMarkdown] = useState("");
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function gerar() {
    if (!membroId || pending) return;
    setErro(null);
    start(async () => {
      const r = await gerarRelatorio({ membroId, destinatario });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setMarkdown(r.markdown);
      setNome(r.nome);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Controles — não entram na impressão */}
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
                  "rounded-full border px-4 py-2 text-sm font-medium capitalize transition-colors",
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

        <div className="flex items-center gap-3">
          <Button type="button" onClick={gerar} disabled={pending || !membroId}>
            {pending ? (
              <>
                <Sparkles className="size-4 animate-pulse" aria-hidden /> Montando…
              </>
            ) : (
              <>
                <Sparkles className="size-4" aria-hidden /> {markdown ? "Gerar de novo" : "Gerar rascunho"}
              </>
            )}
          </Button>
          {markdown && (
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-white px-4 py-2 text-sm font-semibold text-brand-purple transition-colors hover:bg-kolo-lilas-bg-2"
            >
              <Printer className="size-4" aria-hidden /> Baixar PDF
            </button>
          )}
        </div>
      </div>

      {markdown && (
        <>
          {/* Edição — fora da impressão */}
          <div className="flex flex-col gap-2 print:hidden">
            <span className="text-sm font-medium text-foreground">
              Revise e ajuste antes de baixar
            </span>
            <textarea
              rows={14}
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              className="w-full resize-y rounded-xl border border-foreground/[0.08] bg-white/70 px-4 py-3 font-mono text-sm leading-relaxed text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/10"
            />
            <p className="text-xs text-muted-foreground">
              Pré-visualização abaixo — é exatamente o que sai no PDF.
            </p>
          </div>

          {/* Documento — o que é impresso/baixado */}
          <article className="rounded-2xl border border-foreground/[0.08] bg-white p-8 print:border-0 print:p-0">
            <header className="mb-5 border-b border-foreground/10 pb-4">
              <h1 className="font-heading text-2xl text-foreground">
                Relatório {destinatario === "escola" ? "para a escola" : "para o terapeuta"}
              </h1>
              {nome && <p className="mt-1 text-sm text-muted-foreground">Sobre {nome}</p>}
            </header>
            <RespostaMarkdown
              texto={markdown}
              className="flex flex-col gap-3 text-[15px] leading-relaxed text-foreground"
            />
            <footer className="mt-8 border-t border-foreground/10 pt-3 text-xs text-muted-foreground">
              Gerado pela Kolo Família, com base nos registros da família. Não substitui
              avaliação profissional.
            </footer>
          </article>
        </>
      )}
    </div>
  );
}
