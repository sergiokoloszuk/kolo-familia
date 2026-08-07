import { NextResponse, type NextRequest, after } from "next/server";
import { timingSafeEqual, createHash } from "node:crypto";
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

/**
 * Compara em tempo constante, sem vazar o segredo por tamanho. O hash iguala o
 * comprimento — `timingSafeEqual` estoura com buffers de tamanhos diferentes.
 */
function segredoConfere(enviado: string | null, esperado: string): boolean {
  if (!enviado) return false;
  const a = createHash("sha256").update(enviado).digest();
  const b = createHash("sha256").update(esperado).digest();
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  // FAIL-CLOSED. Era `if (secret && ...)`: sem a variável no ambiente, o
  // endpoint ficava ABERTO — e em 07/08/2026 produção respondia 404 (não 401)
  // a um POST sem credencial nenhuma, ou seja, qualquer um com um `rotinaId`
  // disparava geração de imagem PAGA na conta de outra família. Sem segredo
  // configurado, agora não gera pra ninguém.
  //
  // SEGREDO PRÓPRIO, não o `AYLA_WEBHOOK_SECRET`. Aquele nome já tem dois
  // consumidores — o webhook de ENTRADA da Z-API (que é fail-open hoje) e o
  // HMAC do cookie de ativação. Reaproveitá-lo faria uma única variável mudar
  // três comportamentos de uma vez, e um deles é a porta por onde chega toda
  // mensagem de WhatsApp: criá-la ligaria a exigência de header no inbound e
  // emudeceria a Ayla se o painel da Z-API não estivesse configurado igual.
  // Fechar aquele webhook é uma frente própria, com passo manual no painel.
  const secret = process.env.KOLO_GERACAO_SECRET;
  if (!secret) {
    console.error(
      "[ludico:gerar-rotina] KOLO_GERACAO_SECRET ausente no ambiente — geração recusada",
    );
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!segredoConfere(request.headers.get("x-ayla-secret"), secret)) {
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
    .select("id, nome, family_account_id, membro_atipico_id, cards_status, mascote_url, membros_atipicos(data_nascimento)")
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

  // O AVATAR DA CRIANÇA COMO PERSONAGEM. O caminho do app já fazia isso; o da
  // Ayla passava usarAvatar:false fixo, então o cartão saía com um mascote do
  // tema mesmo quando a família tinha o avatar pronto. Aqui é oportunista: se
  // existe avatar, a criança vira o personagem; se não existe, nada muda e o
  // mascote temático continua — ninguém fica sem cartão por causa disso.
  let avatarUrl: string | null = null;
  const membroId = (rotina.membro_atipico_id as string | null) ?? null;
  if (membroId && !preservar) {
    const { data: av } = await svc
      .from("avatares_membros_atipicos")
      .select("imagem_url")
      .eq("membro_atipico_id", membroId)
      .eq("family_account_id", familyId)
      .order("selecionado", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    avatarUrl = (av?.imagem_url as string | null) ?? null;
  }
  const usarAvatar = Boolean(avatarUrl);
  if (usarAvatar) console.log("[rotina:cards] avatar da criança como personagem");

  await svc.from("rotinas").update({ tema, cards_status: "gerando" }).eq("id", rotinaId);

  after(async () => {
    try {
      const roteiro = await gerarRoteiroRotina(
        { tema, atividades, idade, nomeRotina, usarAvatar },
        { supabase: svc, family_account_id: familyId },
      );
      const { mascoteUrl, imagens } = await ilustrarCards(svc, {
        familyAccountId: familyId,
        tema,
        mascoteDescricao: roteiro.mascote,
        cards: roteiro.cards,
        referenciaUrl: preservar ? (mascoteAtual ?? undefined) : (avatarUrl ?? undefined),
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
