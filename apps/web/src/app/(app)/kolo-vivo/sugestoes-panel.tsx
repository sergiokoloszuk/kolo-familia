"use client";

import { useState, useTransition } from "react";
import { formatRelative } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { decideSugestao } from "./actions";
import type { MembroData, SugestaoRow } from "./wrapper";

export function SugestoesPanel({
  sugestoes,
  membros,
}: {
  sugestoes: SugestaoRow[];
  membros: MembroData[];
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDecide(id: string, decisao: "aprovar" | "rejeitar") {
    setError(null);
    setPendingId(id);
    startTransition(async () => {
      try {
        await decideSugestao({ sugestao_id: id, decisao });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao decidir");
      } finally {
        setPendingId(null);
      }
    });
  }

  if (sugestoes.length === 0) {
    return (
      <p className="px-1 text-sm text-muted-foreground">
        Por enquanto, nada esperando.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {sugestoes.map((s) => {
        const membro = membros.find((m) => m.id === s.membro_atipico_id);
        const subtitulo =
          s.camada === "camada1"
            ? `${membro?.nome ?? "Membro"} · ${labelCampo(s.campo)}`
            : `Família · ${labelCampo(s.campo)}`;
        return (
          <article
            key={s.id}
            className="rounded-2xl bg-white px-5 py-4 shadow-[0_1px_2px_rgba(46,10,82,0.04),_0_4px_12px_rgba(46,10,82,0.03)]"
          >
            <header className="mb-2 flex flex-col gap-0.5">
              <span className="font-heading text-base font-medium text-foreground">
                {subtitulo}
              </span>
              <span className="text-xs text-muted-foreground">
                De {labelOrigem(s.origem)} ·{" "}
                {formatRelative(new Date(s.created_at), new Date(), {
                  locale: ptBR,
                })}
              </span>
            </header>
            <p className="whitespace-pre-wrap rounded-xl bg-kolo-lilas-bg-2/50 px-4 py-3 text-sm leading-relaxed text-foreground">
              {s.texto_sugerido}
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleDecide(s.id, "rejeitar")}
                disabled={pendingId === s.id}
                className="text-muted-foreground hover:text-foreground"
              >
                <X aria-hidden="true" /> Descartar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => handleDecide(s.id, "aprovar")}
                disabled={pendingId === s.id}
              >
                <Check aria-hidden="true" />{" "}
                {pendingId === s.id ? "..." : "Aceitar"}
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

/**
 * Labels dos campos — espelham os títulos editoriais dos editores
 * (membro-editor.tsx e familia-editor.tsx). Quando o título lá muda,
 * atualizar aqui também.
 */
/**
 * Versões CURTAS dos títulos — no card de sugestão o nome do membro
 * já aparece antes do "·", então não interpolamos nome aqui. Espelha
 * os títulos editoriais do membro-editor.tsx e familia-editor.tsx.
 */
function labelCampo(campo: string): string {
  const map: Record<string, string> = {
    // Domínios do Retrato vivo
    sensorial: "sensorial",
    nutricional: "alimentação",
    comunicacao: "comunicação",
    emocional: "regulação emocional",
    foco: "foco e atenção",
    sono: "sono",
    socializacao: "socialização",
    motor: "motor",
    // Campos legados / sem card próprio
    essencial: "o básico",
    como_e: "o jeito",
    corpo_rotina: "rotina",
    desafios_regulacao: "regulação emocional",
    imitacao: "imitação",
    autonomia: "autonomia",
    aprendizado: "aprendizado",
    tela_midia: "telas e mídia",
    escola: "escola",
    saude_geral: "saúde geral",
    // Família
    composicao: "quem faz parte da rotina",
    rotina: "como os dias costumam ser",
    recursos: "quem está por perto",
    dinamica: "como vocês atravessam os dias",
  };
  return map[campo] ?? campo;
}

function labelOrigem(origem: string): string {
  const map: Record<string, string> = {
    ayla: "uma conversa no WhatsApp",
    skill: "um especialista",
    app: "você mesmo",
    diario_parser: "um registro do diário",
  };
  return map[origem] ?? origem;
}
