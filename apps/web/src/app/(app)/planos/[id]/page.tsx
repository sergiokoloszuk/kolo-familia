import { notFound } from "next/navigation";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { PlanoView, type PlanoSecaoView } from "./plano-view";

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
  const secoes = (plano.secoes as PlanoSecaoView[] | null) ?? [];

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
