import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { assinarImagens } from "@/lib/storage/imagens";
import { capitalizarNome } from "@/lib/nome";
import { idadeAnos } from "@/lib/idade";
import { RotinaEditor } from "./rotina-editor";

// A geração dos cards (história + N ilustrações) roda em segundo plano e pode
// levar ~2 min. 300s = teto, igual às Histórias/Planos.
export const maxDuration = 300;

export default async function RotinaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, family } = await loadFamilyContext();

  const { data: rotina } = await supabase
    .from("rotinas")
    .select(
      "id, nome, tema, historia, cards_status, membro_atipico_id, membros_atipicos(nome, data_nascimento)",
    )
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

  // #2: avatares da criança (pra oferecer "usar o avatar nos cards" + escolher qual)
  const membroId = rotina.membro_atipico_id as string | null;
  let avataresMembro: { id: string; url: string; selecionado: boolean }[] = [];
  if (membroId) {
    const { data: avs } = await supabase
      .from("avatares_membros_atipicos")
      .select("id, imagem_url, selecionado, created_at")
      .eq("membro_atipico_id", membroId)
      .order("selecionado", { ascending: false })
      .order("created_at", { ascending: false });
    const urls = await assinarImagens(supabase, (avs ?? []).map((a) => (a.imagem_url as string | null) ?? null));
    avataresMembro = (avs ?? [])
      .map((a, i) => ({
        id: a.id as string,
        url: urls[i] ?? (a.imagem_url as string | null) ?? "",
        selecionado: Boolean(a.selecionado),
      }))
      .filter((a) => a.url);
  }

  const { data: tarefas } = await supabase
    .from("rotina_tarefas")
    .select("id, texto, icone, concluida, nome_tematico, imagem_url")
    .eq("rotina_id", rotina.id)
    .order("ordem", { ascending: true });

  // Bucket privado → assina as ilustrações dos cards na leitura.
  const tarefasUrls = await assinarImagens(
    supabase,
    (tarefas ?? []).map((t) => (t.imagem_url as string | null) ?? null),
  );

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
        key={(rotina.cards_status as string) ?? "nenhum"}
        rotinaId={rotina.id as string}
        nomeInicial={rotina.nome as string}
        nomeMembro={nomeMembro}
        avatares={avataresMembro}
        tema={(rotina.tema as string | null) ?? null}
        historia={(rotina.historia as string | null) ?? null}
        cardsStatus={((rotina.cards_status as string | null) ?? "nenhum") as
          | "nenhum"
          | "gerando"
          | "pronto"
          | "erro"}
        tarefasIniciais={(tarefas ?? []).map((t, i) => ({
          id: t.id as string,
          texto: t.texto as string,
          icone: (t.icone as string | null) ?? null,
          concluida: Boolean(t.concluida),
          nomeTematico: (t.nome_tematico as string | null) ?? null,
          imagemUrl: tarefasUrls[i] ?? (t.imagem_url as string | null) ?? null,
        }))}
      />
    </div>
  );
}
