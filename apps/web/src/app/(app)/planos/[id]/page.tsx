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
    .select("id, titulo, tema, secoes, created_at, membros_atipicos(nome)")
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
    <PlanoView titulo={plano.titulo as string} crianca={crianca} secoes={secoes} />
  );
}
