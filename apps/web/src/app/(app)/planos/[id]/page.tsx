import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { capitalizarNome } from "@/lib/nome";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { PlanoView, type PlanoSecaoView } from "./plano-view";
import { PlanoMontando } from "./plano-poller";

// A geração do plano roda em segundo plano (after) — pode levar ~1 min.
export const maxDuration = 300;

export default async function PlanoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, family } = await loadFamilyContext();

  const { data: plano } = await supabase
    .from("planos")
    .select(
      "id, titulo, tema, secoes, resultado, resultado_nota, created_at, membros_atipicos(nome)",
    )
    .eq("id", id)
    .eq("family_account_id", family!.id)
    .maybeSingle();

  if (!plano) notFound();

  const rel = plano.membros_atipicos as
    | { nome: string }
    | { nome: string }[]
    | null;
  const crianca = rel ? (Array.isArray(rel) ? rel[0]?.nome ?? null : rel.nome) : null;
  const nomeCrianca = crianca ? capitalizarNome(crianca) : null;
  const secoes = (plano.secoes as PlanoSecaoView[] | null) ?? [];

  // Ainda gerando em segundo plano (plano vazio) → tela "montando…" que faz polling.
  if (secoes.length === 0) {
    return <PlanoMontando crianca={nomeCrianca} />;
  }

  // Geração falhou (sentinela __erro__) → mensagem amigável com saída.
  const erroSec = secoes.find((s) => s.tipo === "__erro__");
  if (erroSec) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
        <h1 className="font-heading text-2xl text-foreground">Não consegui montar o plano</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {erroSec.conteudo_markdown || "Tive um problema ao montar este plano."}
        </p>
        <Link
          href="/estrategias"
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-purple px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-purple-dark"
        >
          <ChevronLeft className="size-4" aria-hidden /> Voltar às Estratégias
        </Link>
      </div>
    );
  }

  return (
    <PlanoView
      planoId={plano.id as string}
      titulo={plano.titulo as string}
      crianca={crianca}
      secoes={secoes}
      resultado={
        (plano.resultado as
          | "funcionou"
          | "parcial"
          | "nao_funcionou"
          | "nao_testou"
          | null) ?? null
      }
      resultadoNota={(plano.resultado_nota as string | null) ?? null}
    />
  );
}
