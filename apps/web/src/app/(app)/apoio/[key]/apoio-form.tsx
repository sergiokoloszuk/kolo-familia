"use client";

import { useState, useTransition } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { RespostaMarkdown } from "@/components/resposta-markdown";
import { gerarApoio, type GerarApoioResultado } from "../actions";
import { gerarCenaParaGaleria } from "../../galeria/actions";

const TIPO_GALERIA: Record<string, "brincadeira" | "atividade" | "historia_social"> = {
  brincadeiras: "brincadeira",
  atividades: "atividade",
  historias_sociais: "historia_social",
};

/**
 * ApoioForm editorial (P-EST-7):
 * - sem Label, select compacto, textarea editorial
 * - botão "Pedir" → "Continuar →"
 * - resposta como bloco de leitura (sem Card pesado)
 * - "Gerar imagem" como section inline discreta
 * - "Pedir outra" → "Outra ideia →"
 */
export function ApoioForm({
  outputTypeKey,
  geraImagemOpcional,
  membros,
}: {
  outputTypeKey: string;
  geraImagemOpcional: boolean;
  membros: Array<{ id: string; nome: string }>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<GerarApoioResultado | null>(null);
  const [membroId, setMembroId] = useState<string>(membros[0]?.id ?? "");
  const [pedido, setPedido] = useState("");
  const [imagemUrl, setImagemUrl] = useState<string | null>(null);
  const [imagemPending, setImagemPending] = useState(false);
  const [imagemErro, setImagemErro] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pedido.trim()) return;
    setError(null);
    setResultado(null);
    startTransition(async () => {
      try {
        const r = await gerarApoio({
          outputTypeKey,
          membroAtipicoId: membroId || null,
          pedido,
        });
        setResultado(r);
      } catch (e) {
        setError(traduzirErro(e instanceof Error ? e.message : "Erro inesperado"));
      }
    });
  }

  function tentarOutra() {
    setResultado(null);
    setPedido("");
    setImagemUrl(null);
    setImagemErro(null);
  }

  function handleGerarImagem() {
    if (!membroId) {
      setImagemErro("Escolha sobre qual membro é a cena pra incluir imagem.");
      return;
    }
    const tipo = TIPO_GALERIA[outputTypeKey];
    if (!tipo) return;
    setImagemErro(null);
    setImagemPending(true);
    (async () => {
      try {
        const r = await gerarCenaParaGaleria({
          membroAtipicoId: membroId,
          descricaoCena: pedido,
          tipo,
        });
        setImagemUrl(r.url);
      } catch (e) {
        setImagemErro(traduzirErro(e instanceof Error ? e.message : "Erro inesperado"));
      } finally {
        setImagemPending(false);
      }
    })();
  }

  if (resultado) {
    return (
      <div className="flex flex-col gap-8">
        {!resultado.validacaoOk && resultado.validacaoMotivo && (
          <div className="rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Aviso de validação: {resultado.validacaoMotivo}
          </div>
        )}

        {/* Resposta como bloco de leitura editorial — sem Card retangular */}
        <div>
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-purple">
            Kolo
          </span>
          <RespostaMarkdown
            texto={resultado.texto}
            className="mt-2 flex flex-col gap-3 text-base leading-relaxed text-foreground"
          />
        </div>

        {geraImagemOpcional && (
          <div className="border-t border-foreground/[0.06] pt-6">
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Quiser ver com imagem
            </span>
            <div className="mt-3 flex flex-col gap-3">
              {imagemErro && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {imagemErro}
                </div>
              )}
              {imagemUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagemUrl}
                    alt="Cena ilustrada"
                    className="aspect-square w-full max-w-sm rounded-2xl object-cover"
                  />
                  <p className="text-xs text-muted-foreground">
                    Salva na galeria — você pode favoritar e baixar lá.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Vai usar o avatar do membro com a descrição da cena.
                    Configure o avatar antes em /configuracoes/avatar.
                  </p>
                  <div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleGerarImagem}
                      disabled={imagemPending}
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "sm" }),
                        "text-brand-purple hover:bg-transparent hover:text-brand-purple-dark",
                      )}
                    >
                      {imagemPending ? "Pensando..." : "Ver com imagem"}
                      {!imagemPending && <ArrowRight className="size-3" aria-hidden />}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={tentarOutra}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "text-brand-purple hover:bg-transparent hover:text-brand-purple-dark",
            )}
          >
            Outra ideia
            <ArrowRight className="size-3" aria-hidden />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {membros.length > 0 && (
        <select
          id="membro"
          aria-label="Sobre quem é?"
          className="h-9 w-fit rounded-full bg-transparent px-1 text-sm text-muted-foreground focus:outline-none focus:ring-0"
          value={membroId}
          onChange={(e) => setMembroId(e.target.value)}
        >
          <option value="">Sobre a família em geral</option>
          {membros.map((m) => (
            <option key={m.id} value={m.id}>
              Sobre {m.nome}
            </option>
          ))}
        </select>
      )}

      <textarea
        id="pedido"
        rows={5}
        value={pedido}
        onChange={(e) => setPedido(e.target.value)}
        placeholder="Ex: dia chuvoso, em casa o dia inteiro, querendo descarregar energia."
        className="w-full resize-none rounded-2xl border border-foreground/[0.08] bg-white/70 px-4 py-3 text-base leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-foreground/10"
        disabled={pending}
      />

      <div className="flex items-center justify-end">
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          disabled={pending || !pedido.trim()}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "text-brand-purple hover:bg-transparent hover:text-brand-purple-dark",
          )}
        >
          {pending ? "Pensando..." : "Continuar"}
          {!pending && <ArrowRight className="size-3" aria-hidden />}
        </Button>
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground/60">
        Kolo Família não substitui profissionais da saúde.
      </p>
    </form>
  );
}

function traduzirErro(msg: string): string {
  if (msg.toLowerCase().includes("anthropic_api_key"))
    return "A chave da Anthropic não está configurada no servidor.";
  if (msg.toLowerCase().includes("nenhuma skill"))
    return "Skills iniciais ainda não estão no banco. Aplique a migração 0003_seed.sql.";
  if (msg.toLowerCase().includes("não encontrado"))
    return "Tipo de apoio não encontrado.";
  return msg;
}
