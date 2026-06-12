import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { classificarIntencao } from "@/lib/ia/intencao";
import { gerarPlano } from "@/lib/ia/plano";
import { planoParaPdf } from "@/lib/plano/pdf";
import { enviarDocumento } from "./whatsappSender";

/**
 * Gera o PDF do plano, sobe no Storage (URL assinada, 1h) e envia como
 * documento no WhatsApp. Falha 100% silenciosa — o PDF é um bônus; se falhar,
 * o link segue normal. Z-API baixa o arquivo na hora do envio, então a URL
 * curta basta (e mantém o dado privado, sem URL pública permanente).
 */
async function entregarPdfDoPlano(
  supabase: SupabaseClient,
  params: {
    familyId: string;
    phoneE164: string;
    titulo: string;
    secoes: Array<{ tipo: string; titulo: string; conteudo_markdown: string }>;
    nomeMembro?: string | null;
  },
): Promise<void> {
  try {
    const bytes = await planoParaPdf({
      titulo: params.titulo,
      nome: params.nomeMembro,
      secoes: params.secoes,
    });
    const path = `${params.familyId}/plano/${crypto.randomUUID()}.pdf`;
    const { error: upErr } = await supabase.storage
      .from("imagens")
      .upload(path, Buffer.from(bytes), { contentType: "application/pdf", upsert: false });
    if (upErr) throw upErr;
    const { data: signed } = await supabase.storage
      .from("imagens")
      .createSignedUrl(path, 3600);
    if (!signed?.signedUrl) throw new Error("sem signed url");

    const fileName = `${(params.titulo || "plano").replace(/[^\w\sÀ-ÿ-]/g, "").slice(0, 50).trim() || "plano"}.pdf`;
    await enviarDocumento({ phoneE164: params.phoneE164, url: signed.signedUrl, fileName });
  } catch (e) {
    console.warn("[ayla:ponte] falha ao entregar PDF:", e instanceof Error ? e.message : e);
  }
}

async function nomeDoMembro(
  supabase: SupabaseClient,
  familyId: string,
  membroId: string | null,
): Promise<string | null> {
  if (!membroId) return null;
  const { data } = await supabase
    .from("membros_atipicos")
    .select("nome")
    .eq("id", membroId)
    .eq("family_account_id", familyId)
    .maybeSingle();
  return (data?.nome as string | undefined) ?? null;
}

/**
 * Ponte WhatsApp → app (Fase 3).
 *
 * A Ayla responde no WhatsApp (o momento). Quando a mãe traz um DESAFIO de
 * verdade — algo que renderia um plano completo —, montamos um "gostinho":
 * deixamos a pergunta dela já começada nas Estratégias e mandamos um
 * magic-link que abre o app JÁ LOGADO, direto na conversa, onde ela acha o
 * plano completo (Fase 1) com toda a profundidade.
 *
 * Princípios:
 * - Só em desafio (crise acolhe; desabafo ouve; dúvida é curta) — Fase 2.
 * - No máximo uma vez por dia, pra não virar spam de link.
 * - Falha 100% silenciosa: qualquer erro → null, e a resposta do WhatsApp
 *   segue normal, sem link. A ponte nunca pode quebrar a conversa.
 */
const JANELA_DEDUP_HORAS = 20;

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

/**
 * Mint de um magic-link que abre o app já logado num destino interno.
 * Reusado pela ponte e pelo follow-up de plano (Fase 4). Devolve null se
 * não conseguir (sem e-mail, falha no admin) — o chamador decide o fallback.
 */
export async function gerarMagicLink(
  supabase: SupabaseClient,
  params: { familyId: string; next: string },
): Promise<string | null> {
  try {
    const next =
      params.next.startsWith("/") && !params.next.startsWith("//")
        ? params.next
        : "/estrategias";

    const { data: fam } = await supabase
      .from("family_accounts")
      .select("user_id")
      .eq("id", params.familyId)
      .maybeSingle();
    const userId = fam?.user_id as string | undefined;
    if (!userId) return null;

    const admin = createServiceRoleClient();
    const { data: userData } = await admin.auth.admin.getUserById(userId);
    const email = userData?.user?.email;
    if (!email) return null;

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${appUrl()}/auth/wa` },
    });
    const tokenHash = linkData?.properties?.hashed_token;
    if (linkErr || !tokenHash) return null;

    return `${appUrl()}/auth/wa?token_hash=${encodeURIComponent(
      tokenHash,
    )}&next=${encodeURIComponent(next)}`;
  } catch (e) {
    console.warn(
      "[ayla:ponte] falha ao gerar magic-link:",
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

export async function montarPonteWhatsApp(
  supabase: SupabaseClient,
  params: {
    familyId: string;
    membroAtipicoId: string | null;
    mensagem: string;
    /** O parser detectou um desafio concreto nesta mensagem. */
    temDesafio: boolean;
    /** Telefone pra enviar o PDF do plano como documento. */
    phoneE164: string;
    /** Pedido explícito de plano: pula os gates (dedup/intenção/temDesafio). */
    forcar?: boolean;
  },
): Promise<string | null> {
  const { familyId, membroAtipicoId, mensagem, temDesafio, phoneE164, forcar } = params;

  try {
    if (!forcar) {
      // Gate 1 (barato): só quando ela descreveu um desafio concreto.
      if (!temDesafio) {
        console.log("[ayla:ponte] sem plano — gate1: parser não marcou desafio");
        return null;
      }

      // Gate 2 (dedup): já mandamos um plano nas últimas ~20h? Não insiste.
      const desde = new Date(Date.now() - JANELA_DEDUP_HORAS * 3600_000).toISOString();
      const { data: recentes } = await supabase
        .from("ayla_messages")
        .select("id")
        .eq("family_account_id", familyId)
        .eq("direcao", "outbound")
        .gte("enviada_em", desde)
        .ilike("texto", "%/auth/wa%")
        .limit(1);
      if (recentes && recentes.length > 0) {
        console.log("[ayla:ponte] sem plano — gate2: já enviou um plano nas últimas ~20h");
        return null;
      }

      // Gate 3 (intenção): crise/desabafo/dúvida não recebem plano.
      const intencao = await classificarIntencao({ supabase, familyId, texto: mensagem });
      console.log(`[ayla:ponte] gate3 intencao=${intencao}`);
      if (intencao !== "desafio") {
        console.log("[ayla:ponte] sem plano — gate3: intenção não é 'desafio'");
        return null;
      }
    }

    // Gera o plano completo na hora (single-call) a partir do desafio. Fica
    // salvo em /planos — então o link abre o plano JÁ PRONTO (não precisa
    // clicar em "gerar"), e o PDF vai junto no WhatsApp.
    console.log(`[ayla:ponte] gerando plano (forcar=${Boolean(forcar)}) membro=${membroAtipicoId ?? "null"}`);
    const plano = await gerarPlano({
      supabase,
      familyId,
      membroAtipicoId,
      desafio: mensagem,
      origem: "estrategias",
    });
    console.log(`[ayla:ponte] plano gerado id=${plano.id} secoes=${plano.secoes.length}`);

    const nomeMembro = await nomeDoMembro(supabase, familyId, membroAtipicoId);
    await entregarPdfDoPlano(supabase, {
      familyId,
      phoneE164,
      titulo: plano.titulo,
      secoes: plano.secoes,
      nomeMembro,
    });

    const link = await gerarMagicLink(supabase, { familyId, next: `/planos/${plano.id}` });
    console.log(`[ayla:ponte] magic-link ${link ? "ok" : "FALHOU"} → /planos/${plano.id}`);

    const base =
      "Montei um plano completo sobre isso — mandei em PDF aqui em cima 👆 (dá pra salvar e imprimir).";
    if (!link) return base;
    return `${base}\nE se quiser ver no app, ajustar ou me contar depois como foi, é só abrir (já entra direto):\n${link}`;
  } catch (e) {
    console.warn(
      "[ayla:ponte] falha ao montar ponte WhatsApp→app:",
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/**
 * Gera o roteiro leve de fim de semana (Fase 5) a partir do que a mãe
 * contou no WhatsApp e devolve uma mensagem com o magic-link pro plano.
 * Flexível, sem grade rígida (a variante do gerarPlano cuida do tom).
 * Falha silenciosa → null (a Ayla segue com a resposta normal).
 */
export async function montarPlanoFimDeSemana(
  supabase: SupabaseClient,
  params: {
    familyId: string;
    membroAtipicoId: string | null;
    contexto: string;
    nomeMembro?: string | null;
    phoneE164: string;
  },
): Promise<string | null> {
  try {
    const desafio =
      params.contexto.trim() ||
      "Montar um fim de semana leve e gostoso, sem grade rígida, com o que a família já tem em vista.";

    const plano = await gerarPlano({
      supabase,
      familyId: params.familyId,
      membroAtipicoId: params.membroAtipicoId,
      desafio,
      variante: "fim_de_semana",
      origem: "fim_de_semana",
    });

    await entregarPdfDoPlano(supabase, {
      familyId: params.familyId,
      phoneE164: params.phoneE164,
      titulo: plano.titulo,
      secoes: plano.secoes,
      nomeMembro: params.nomeMembro,
    });

    const link = await gerarMagicLink(supabase, {
      familyId: params.familyId,
      next: `/planos/${plano.id}`,
    });

    const ref = params.nomeMembro ? ` pra ${params.nomeMembro}` : "";
    const base = `Montei um roteiro leve pro fim de semana${ref} — mandei em PDF aqui em cima 👆.`;
    if (!link) return base;
    return `${base}\nQuer ver no app ou ajustar? É só abrir (já entra direto):\n${link}`;
  } catch (e) {
    console.warn(
      "[ayla:ponte] falha ao montar plano de fim de semana:",
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}
