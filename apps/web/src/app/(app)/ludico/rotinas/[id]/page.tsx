import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { assinarImagens } from "@/lib/storage/imagens";
import { capitalizarNome } from "@/lib/nome";
import { idadeAnos } from "@/lib/idade";
import { Eyebrow } from "@/components/brand/eyebrow";
import { RotinaEditor } from "./rotina-editor";
import { statusSeguroDosCards } from "@/lib/ludico/rotina-cards";

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
      "id, nome, tema, historia, cards_status, modo_exibicao, dia_semana, membro_atipico_id, resultado, updated_at, membros_atipicos(nome, data_nascimento)",
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
  // O default continua "cartoes" pra não mexer no que já existe no banco; quem
  // nasce pela Ayla agora chega com o modo já decidido.
  const modoInicial = ((rotina.modo_exibicao as string | null) ?? "cartoes") as "cartoes" | "lista";

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
    .select("id, texto, icone, hora, concluida, nome_tematico, imagem_url")
    .eq("rotina_id", rotina.id)
    .order("ordem", { ascending: true });

  // `after()` pode ser interrompido pelo runtime. Além disso, versões antigas
  // marcavam `pronto` mesmo com imagem nula. Na visita, esses dois estados
  // deixam de prender a família em polling ou numa tela de cartões vazios e
  // viram `erro`, que já oferece o retry idempotente.
  const statusPersistido = ((rotina.cards_status as string | null) ?? "nenhum");
  let cardsStatus = statusSeguroDosCards({
    status: statusPersistido,
    updatedAt: rotina.updated_at as string,
    imagens: (tarefas ?? []).map((tarefa) => (tarefa.imagem_url as string | null) ?? null),
  });
  if (cardsStatus !== statusPersistido) {
    const { data: reconciliada, error: reconciliacaoErro } = await supabase
      .from("rotinas")
      .update({ cards_status: cardsStatus })
      .eq("id", rotina.id)
      .eq("family_account_id", family!.id)
      .eq("cards_status", statusPersistido)
      .select("id")
      .maybeSingle();
    // Se outra execução terminou no intervalo, a escrita condicional não toca
    // nada e o próximo polling traz o estado novo. Não exibimos erro falso.
    if (reconciliacaoErro || !reconciliada) cardsStatus = statusPersistido;
  }

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

      <div className="print:hidden">
        {/* O rótulo segue o MODO. Dizer "Rotina Visual" sempre era prometer
            cartões ilustrados numa rotina que nunca ia ter nenhum. */}
        <Eyebrow>{modoInicial === "cartoes" ? "Rotina Visual" : "Rotina"}</Eyebrow>
        {nomeMembro && (
          <p className="mt-1 text-sm text-muted-foreground">
            {nomeMembro}
            {idade != null ? `, ${idade} anos` : ""}
          </p>
        )}
      </div>

      <RotinaEditor
        key={cardsStatus}
        rotinaId={rotina.id as string}
        membroAtipicoId={membroId as string}
        diaSemana={(rotina.dia_semana as number | null) ?? null}
        nomeInicial={rotina.nome as string}
        modoInicial={modoInicial}
        nomeMembro={nomeMembro}
        avatares={avataresMembro}
        tema={(rotina.tema as string | null) ?? null}
        historia={(rotina.historia as string | null) ?? null}
        resultadoInicial={(rotina.resultado as string | null) ?? null}
        cardsStatus={cardsStatus as
          | "nenhum"
          | "aguardando"
          | "revisao"
          | "gerando"
          | "pronto"
          | "erro"}
        tarefasIniciais={(tarefas ?? []).map((t, i) => ({
          id: t.id as string,
          texto: t.texto as string,
          icone: (t.icone as string | null) ?? null,
          hora: (t.hora as string | null) ?? null,
          concluida: Boolean(t.concluida),
          nomeTematico: (t.nome_tematico as string | null) ?? null,
          imagemUrl: tarefasUrls[i] ?? (t.imagem_url as string | null) ?? null,
        }))}
      />
    </div>
  );
}
