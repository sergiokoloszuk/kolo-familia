import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Fluxo GUIADO de plano (reativo): quando a pessoa pede um plano, a Ayla não
 * gera na hora — primeiro pergunta "como está hoje?" (áudio ou texto) e cita os
 * interesses que já conhece, pedindo mais. O relato que ela mandar vira o
 * desafio do plano (rico, com a cara da criança).
 *
 * O estado "pendente" é INFERIDO do histórico (mesmo padrão da oferta de fim de
 * semana): uma pergunta outbound tipo="plano_pergunta" nas últimas 48h, sem
 * nenhum inbound depois. Zero coluna nova, zero migração.
 */

export async function planoGuiadoPendente(
  supabase: SupabaseClient,
  familyId: string,
  agora: Date,
): Promise<{ membroId: string | null } | null> {
  const limite = new Date(agora.getTime() - 48 * 60 * 60 * 1000);
  const { data: perguntas } = await supabase
    .from("ayla_messages")
    .select("created_at, membro_atipico_id")
    .eq("family_account_id", familyId)
    .eq("tipo", "plano_pergunta")
    .eq("direcao", "outbound")
    .gte("created_at", limite.toISOString())
    .order("created_at", { ascending: false })
    .limit(1);
  const p = perguntas?.[0];
  if (!p) return null;

  const perguntaEm = p.created_at as string;
  // Calculado ANTES de persistir o inbound atual, então "nenhum inbound depois"
  // vale pra este relato ser o primeiro (mesma lógica do fim de semana).
  const { data: respostas } = await supabase
    .from("ayla_messages")
    .select("id")
    .eq("family_account_id", familyId)
    .eq("direcao", "inbound")
    .gt("created_at", perguntaEm)
    .limit(1);
  if ((respostas?.length ?? 0) > 0) return null;

  return { membroId: (p.membro_atipico_id as string | null) ?? null };
}

/**
 * A pergunta que a Ayla manda ao receber um pedido de plano: pede o estado de
 * HOJE (áudio/texto) e cita os interesses que já conhece, convidando a somar.
 */
export async function montarPerguntaPlano(
  supabase: SupabaseClient,
  membroId: string | null,
  nomeMembro: string | null,
): Promise<string> {
  let interesses: string[] = [];
  if (membroId) {
    try {
      const { data } = await supabase
        .from("perfil_vivo_membro")
        .select("como_e, categorias_extras")
        .eq("membro_atipico_id", membroId)
        .maybeSingle();
      const comoE = (data?.como_e as { interesses?: string[] } | null) ?? null;
      const extras = (data?.categorias_extras as { preferencias?: { temas?: string[] } } | null) ?? null;
      interesses = comoE?.interesses ?? extras?.preferencias?.temas ?? [];
    } catch {
      /* sem interesses, tudo bem */
    }
  }

  const nome = nomeMembro?.trim() || "quem você cuida";
  const gostos = interesses.length
    ? ` Ah — sobre os gostos: vi que ${nome} curte ${interesses.slice(0, 3).join(", ")}, e quero usar isso pra o plano ficar com a cara ${nomeMembro ? `de ${nome}` : "dele ou dela"}. Se tiver mais algum interesse (um personagem, uma música, um bichinho…), me conta também. 🌿`
    : "";

  return `Boa 💛 Vou montar um plano pra isso. Antes, me conta com as suas palavras: como está esse desafio **hoje**? O que mais complica? Pode escrever ou mandar um **áudio** — o que for mais fácil pra você.${gostos}`;
}
