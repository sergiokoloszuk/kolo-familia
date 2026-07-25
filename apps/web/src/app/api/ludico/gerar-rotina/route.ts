import { NextResponse, type NextRequest, after } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { gerarRoteiroRotina, ilustrarCards } from "@/lib/ludico/gerar";
import { idadeAnos } from "@/lib/idade";

/**
 * Endpoint INTERNO pra a Ayla disparar a geração dos cartões de uma rotina —
 * assim a mãe pede pela Ayla e, ao abrir o link, já está gerando/pronto. A Ayla
 * vive num mundo separado (não importa /lib/ia); então ela "bate" aqui, e a
 * geração (que usa /lib/ia + imagem) roda no lado do app. Protegido por segredo.
 *
 * Só tema (sem avatar) — o caminho da Ayla. Idempotente: se já está gerando ou
 * pronto, não refaz. Roda em segundo plano (after) e devolve 200 na hora.
 */
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const secret = process.env.AYLA_WEBHOOK_SECRET;
  if (secret && request.headers.get("x-ayla-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { rotinaId?: string; tema?: string; preservarArte?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const rotinaId = body.rotinaId;
  const tema = (body.tema ?? "").trim();
  if (!rotinaId || tema.length < 2) {
    return NextResponse.json({ error: "rotinaId e tema (>=2) obrigatórios" }, { status: 400 });
  }

  const svc = createServiceRoleClient();
  const { data: rotina } = await svc
    .from("rotinas")
    .select("id, nome, family_account_id, cards_status, mascote_url, membros_atipicos(data_nascimento)")
    .eq("id", rotinaId)
    .maybeSingle();
  if (!rotina) return NextResponse.json({ error: "rotina não encontrada" }, { status: 404 });

  // Idempotência: não refaz se já está a caminho ou pronto.
  const status = (rotina.cards_status as string | null) ?? "nenhum";
  if (status === "gerando" || status === "pronto") {
    return NextResponse.json({ ok: true, skipped: status });
  }

  const familyId = rotina.family_account_id as string;
  const { data: tarefasData } = await svc
    .from("rotina_tarefas")
    .select("id, texto, ordem, nome_tematico, cena, imagem_url")
    .eq("rotina_id", rotinaId)
    .order("ordem", { ascending: true });
  const tarefas = tarefasData ?? [];
  if (!tarefas.length) return NextResponse.json({ error: "rotina sem tarefas" }, { status: 400 });

  // EDIÇÃO pela Ayla: a arte que já existe fica. Só os passos novos são
  // desenhados, com o MESMO mascote de antes como referência — assim mudar um
  // passo não torra a rotina inteira nem muda o personagem no meio do caminho.
  const mascoteAtual = (rotina.mascote_url as string | null) ?? null;
  const preservar = body.preservarArte === true && !!mascoteAtual;
  const arteExistente = preservar
    ? tarefas.map((t) => (t.imagem_url as string | null) ?? null)
    : undefined;
  // Se todos os passos já têm arte (só saiu passo), nenhuma imagem é gerada —
  // o que muda é a história, que cita a sequência.

  const rel = rotina.membros_atipicos as
    | { data_nascimento: string | null }
    | { data_nascimento: string | null }[]
    | null;
  const membro = rel ? (Array.isArray(rel) ? rel[0] ?? null : rel) : null;
  const idade = idadeAnos(membro?.data_nascimento ?? null);
  const nomeRotina = rotina.nome as string;
  const atividades = tarefas.map((t) => t.texto as string);
  const tarefaIds = tarefas.map((t) => t.id as string);

  await svc.from("rotinas").update({ tema, cards_status: "gerando" }).eq("id", rotinaId);

  after(async () => {
    try {
      const roteiro = await gerarRoteiroRotina(
        { tema, atividades, idade, nomeRotina, usarAvatar: false },
        { supabase: svc, family_account_id: familyId },
      );
      const { mascoteUrl, imagens } = await ilustrarCards(svc, {
        familyAccountId: familyId,
        tema,
        mascoteDescricao: roteiro.mascote,
        cards: roteiro.cards,
        referenciaUrl: preservar ? (mascoteAtual ?? undefined) : undefined,
        arteExistente,
      });
      await Promise.all(
        tarefaIds.map((id, i) => {
          const card = roteiro.cards[i];
          if (!card) return Promise.resolve();
          // Card preservado NÃO é reescrito: o nome temático é o que a mãe já
          // leu no cartão impresso; trocar por um sinônimo novo só confunde.
          if (preservar && arteExistente?.[i]) return Promise.resolve();
          return svc
            .from("rotina_tarefas")
            .update({ nome_tematico: card.nome_tematico, cena: card.cena, imagem_url: imagens[i] ?? null })
            .eq("id", id);
        }),
      );
      await svc
        .from("rotinas")
        .update({ historia: roteiro.historia, mascote_url: mascoteUrl, cards_status: "pronto" })
        .eq("id", rotinaId);
    } catch (e) {
      console.error("[api gerar-rotina]", e instanceof Error ? e.message : e);
      await svc.from("rotinas").update({ cards_status: "erro" }).eq("id", rotinaId);
    }
  });

  return NextResponse.json({ ok: true, queued: true });
}
