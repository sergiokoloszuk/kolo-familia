import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { classificarIntencao } from "@/lib/ia/intencao";

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

export async function montarPonteWhatsApp(
  supabase: SupabaseClient,
  params: {
    familyId: string;
    membroAtipicoId: string | null;
    mensagem: string;
    /** O parser detectou um desafio concreto nesta mensagem. */
    temDesafio: boolean;
  },
): Promise<string | null> {
  const { familyId, membroAtipicoId, mensagem, temDesafio } = params;

  try {
    // Gate 1 (barato): só quando ela descreveu um desafio concreto.
    if (!temDesafio) return null;

    // Gate 2 (dedup): já mandamos um link nas últimas ~20h? Não insiste.
    const desde = new Date(Date.now() - JANELA_DEDUP_HORAS * 3600_000).toISOString();
    const { data: recentes } = await supabase
      .from("ayla_messages")
      .select("id")
      .eq("family_account_id", familyId)
      .eq("direcao", "outbound")
      .gte("enviada_em", desde)
      .ilike("texto", "%/auth/wa%")
      .limit(1);
    if (recentes && recentes.length > 0) return null;

    // Gate 3 (intenção): crise/desabafo/dúvida não recebem link de plano.
    const intencao = await classificarIntencao({ supabase, familyId, texto: mensagem });
    if (intencao !== "desafio") return null;

    // Semeia a conversa nas Estratégias com a pergunta dela. Ao chegar pelo
    // link, ela vê a própria mensagem e a Ayla responde no app (com o CTA de
    // plano completo da Fase 1).
    const titulo = mensagem.trim().slice(0, 80) || "Conversa do WhatsApp";
    const { data: conversa, error: convErr } = await supabase
      .from("conversas")
      .insert({
        family_account_id: familyId,
        membro_atipico_id: membroAtipicoId,
        titulo,
      })
      .select("id")
      .single();
    if (convErr || !conversa) return null;

    const { error: msgErr } = await supabase.from("mensagens_skill").insert({
      conversa_id: conversa.id,
      family_account_id: familyId,
      papel: "user",
      conteudo: mensagem,
    });
    if (msgErr) return null;

    // E-mail do usuário dono da família (pra mintar o magic-link).
    const { data: fam } = await supabase
      .from("family_accounts")
      .select("user_id")
      .eq("id", familyId)
      .maybeSingle();
    const userId = fam?.user_id as string | undefined;
    if (!userId) return null;

    const admin = createServiceRoleClient();
    const { data: userData } = await admin.auth.admin.getUserById(userId);
    const email = userData?.user?.email;
    if (!email) return null;

    const next = `/conversar/${conversa.id}`;
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${appUrl()}/auth/wa` },
    });
    const tokenHash = linkData?.properties?.hashed_token;
    if (linkErr || !tokenHash) return null;

    const link = `${appUrl()}/auth/wa?token_hash=${encodeURIComponent(
      tokenHash,
    )}&next=${encodeURIComponent(next)}`;

    return `Se quiser, deixei o começo de um plano completo sobre isso aqui no app — com ideias práticas, frases pra usar e o que observar. É só abrir, você já entra direto:\n${link}`;
  } catch (e) {
    console.warn(
      "[ayla:ponte] falha ao montar ponte WhatsApp→app:",
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}
