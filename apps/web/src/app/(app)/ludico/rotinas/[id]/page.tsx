import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { capitalizarNome } from "@/lib/nome";
import { idadeAnos } from "@/lib/idade";
import { RotinaEditor } from "./rotina-editor";

export default async function RotinaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, family } = await loadFamilyContext();

  const { data: rotina } = await supabase
    .from("rotinas")
    .select("id, nome, membro_atipico_id, membros_atipicos(nome, data_nascimento)")
    .eq("id", id)
    .eq("family_account_id", family!.id)
    .maybeSingle();

  if (!rotina) notFound();

  const rel = rotina.membros_atipicos as
    | { nome: string; data_nascimento: string | null }
    | { nome: string; data_nascimento: string | null }[]
    | null;
  const membro = rel ? (Array.isArray(rel) ? rel[0] ?? null : rel) : null;
  const nomeMembro = membro?.nome ? capitalizarNome(membro.nome) : null;
  const idade = idadeAnos(membro?.data_nascimento ?? null);

  const { data: tarefas } = await supabase
    .from("rotina_tarefas")
    .select("id, texto, icone, concluida")
    .eq("rotina_id", rotina.id)
    .order("ordem", { ascending: true });

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/ludico/rotinas"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground print:hidden"
      >
        <ChevronLeft aria-hidden className="size-3" /> Rotinas
      </Link>

      {nomeMembro && (
        <p className="text-sm text-muted-foreground print:hidden">
          {nomeMembro}
          {idade != null ? `, ${idade} anos` : ""}
        </p>
      )}

      <RotinaEditor
        rotinaId={rotina.id as string}
        nomeInicial={rotina.nome as string}
        idade={idade}
        tarefasIniciais={(tarefas ?? []).map((t) => ({
          id: t.id as string,
          texto: t.texto as string,
          icone: (t.icone as string | null) ?? null,
          concluida: Boolean(t.concluida),
        }))}
      />
    </div>
  );
}
