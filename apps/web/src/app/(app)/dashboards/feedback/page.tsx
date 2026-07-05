import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { ehAdmin } from "@/lib/auth/require-admin";
import { carregarFeedbacks, type FeedbackItem } from "@/lib/analytics/feedback";
import { Bloco, Vazio } from "@/components/dashboard/blocos";
import { FeedbackAcoes } from "./acoes";

export const dynamic = "force-dynamic";

const TIPO_INFO: Record<FeedbackItem["tipo"], { label: string; emoji: string }> = {
  elogio: { label: "Elogio", emoji: "💛" },
  sugestao: { label: "Sugestão", emoji: "💡" },
  reclamacao: { label: "Reclamação", emoji: "😟" },
  duvida: { label: "Dúvida", emoji: "❓" },
};

function dataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function FeedbackPage() {
  const admin = createServiceRoleClient();
  const [feedbacks, isAdmin] = await Promise.all([carregarFeedbacks(admin), ehAdmin()]);

  const porTipo = (t: FeedbackItem["tipo"]) =>
    feedbacks.filter((f) => f.tipo === t && f.status !== "arquivada");
  const secoes: { tipo: FeedbackItem["tipo"]; desc: string }[] = [
    { tipo: "reclamacao", desc: "O que não agradou — pra você responder e olhar." },
    { tipo: "sugestao", desc: "Ideias de melhoria — decida o que vira backlog." },
    { tipo: "elogio", desc: "O carinho que chega — vira depoimento/prova social." },
  ];

  return (
    <div className="flex flex-col gap-8">
      <p className="-mt-2 text-sm text-muted-foreground">
        O que as famílias falam pela ajuda do app (e, em breve, pela Ayla). Elogio, sugestão e reclamação.
      </p>

      {feedbacks.length === 0 ? (
        <Vazio texto="Nenhum feedback ainda." />
      ) : (
        secoes.map(({ tipo, desc }) => {
          const itens = porTipo(tipo);
          const info = TIPO_INFO[tipo];
          return (
            <Bloco key={tipo} titulo={`${info.emoji} ${info.label}s (${itens.length})`} desc={desc}>
              {itens.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nada por aqui.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {itens.map((f) => (
                    <li key={f.id} className="rounded-xl border border-foreground/[0.08] bg-white p-4">
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium text-foreground">{f.nome}</span>
                        <span className="text-xs text-muted-foreground">{dataHora(f.criadoEm)}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-foreground">{f.texto}</p>
                      {isAdmin && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <FeedbackAcoes id={f.id} status={f.status} />
                          {f.familyId && (
                            <Link
                              href={`/dashboards/abordagem/${f.familyId}`}
                              className="rounded-full border border-brand-purple/40 px-2.5 py-1 text-xs font-medium text-brand-purple hover:bg-brand-purple/10"
                            >
                              Responder no WhatsApp
                            </Link>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Bloco>
          );
        })
      )}
    </div>
  );
}
