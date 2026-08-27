import type { SupabaseClient } from "@supabase/supabase-js";
import { logEvent, logServerError } from "@/lib/log";
import { reservarEnvioProativo } from "@/lib/ayla/cadencia";
import { loadFamiliaParaEnvio, enviarEPersistir } from "@/lib/ayla/orchestrator";
import { primeiroNomeCriancaConfiavel } from "@/lib/ayla/crianca-especifica";

/**
 * A PRIMEIRA MENSAGEM DA AYLA COMO ASSINANTE — 27/08/2026.
 *
 * ⚠️ QUEM FALA É A AYLA, no mesmo WhatsApp de sempre. Não é confirmação de
 * pagamento, não é boas-vindas institucional, e a família NÃO está começando
 * de novo. O que a mensagem precisa dizer é uma coisa só:
 *
 *   > "eu continuo aqui, e não perdemos o que construímos."
 *
 * ⚠️ A IDEMPOTÊNCIA É O PRÓPRIO TIPO DA MENSAGEM. A pergunta não é "mandei
 * hoje?" — é "mandei ALGUMA VEZ?". Uma linha em `ayla_messages` com
 * `tipo = 'assinante_boas_vindas'` é a prova, e é por isso que não existe
 * coluna nova nem migração. Webhook repetido, reconciliador, renovação,
 * ressincronização e recarga de página convergem todos para "já foi".
 *
 * ⚠️ NÃO DETECTA TRANSIÇÃO, E ISSO É DE PROPÓSITO. Seria natural disparar em
 * "status mudou de X para active", mas transição é estado efêmero: se o
 * webhook falhar e o reconciliador corrigir uma hora depois, a transição já
 * passou e ninguém a viu. A pergunta aqui é sobre o ESTADO — "está ativa e
 * nunca foi recebida?" —, que sobrevive a qualquer ordem de chegada. É a mesma
 * lição do §8: estado de coordenação vive no banco, não no instante.
 *
 * ⚠️ UMA REGRA, DOIS CHAMADORES. Webhook e reconciliador chamam esta função;
 * nenhum dos dois tem lógica própria. Duas implementações da mesma decisão
 * sempre divergem.
 *
 * ⚠️ NUNCA LANÇA. O pagamento não pode falhar porque a mensagem não saiu — mas
 * a falha também não pode passar em silêncio (§7), então tudo que dá errado
 * vira registro.
 */

export const TIPO_BOAS_VINDAS = "assinante_boas_vindas" as const;

export type ResultadoBoasVindas =
  | { enviada: true }
  | { enviada: false; motivo: "nao_ativa" | "ja_enviada" | "sem_contexto" | "erro" | string };

/**
 * O texto. Curto, humano, com o nome da criança da família real.
 *
 * ⚠️ SEM PERGUNTA. A mensagem abre e espera — se a mãe responder trazendo
 * assunto, a Ayla conversa sobre aquilo; se responder só "obrigada", aí sim a
 * conversa decide se há algo a retomar. Emendar uma pergunta aqui transformaria
 * o momento em questionário.
 */
export function textoBoasVindas(nomeCrianca: string | null): string {
  const sobre = nomeCrianca?.trim() ? ` sobre ${nomeCrianca.trim()}` : "";
  return `Que bom que vocês vão continuar comigo 💜 Sua assinatura já está ativa.\n\nEu continuo por aqui com tudo o que fomos construindo${sobre}, então não precisamos começar de novo.`;
}

/** Já recebeu esta mensagem alguma vez? A pergunta é "alguma vez", não "hoje". */
export async function jaRecebeuBoasVindas(
  admin: SupabaseClient,
  familyId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("ayla_messages")
    .select("id")
    .eq("family_account_id", familyId)
    .eq("tipo", TIPO_BOAS_VINDAS)
    .eq("direcao", "outbound")
    .limit(1);
  // ⚠️ ERRO DE LEITURA RESPONDE "JÁ RECEBEU". O custo de errar para o lado do
  // silêncio é uma mensagem que não sai; para o outro lado, é a família ser
  // recebida duas vezes — que quebra justamente a promessa de continuidade.
  if (error) return true;
  return (data ?? []).length > 0;
}

/**
 * O PONTO ÚNICO. Webhook e reconciliador chamam ISTO — nenhum dos dois tem
 * regra própria (§11 do pedido: "não criar duas implementações diferentes da
 * regra"). E ela é segura de chamar quantas vezes quiser.
 */
export async function talvezReceberComoAssinante(
  admin: SupabaseClient,
  familyId: string,
): Promise<ResultadoBoasVindas> {
  try {
    // 1. Está mesmo ativa? A pergunta é sobre o ESTADO, não sobre a transição.
    const { data: sub, error: erroSub } = await admin
      .from("subscription_accesses")
      .select("status")
      .eq("family_account_id", familyId)
      .maybeSingle();
    if (erroSub) {
      await logServerError("boas_vindas_assinante_leitura", erroSub, { family_account_id: familyId });
      return { enviada: false, motivo: "erro" };
    }
    if (sub?.status !== "active") return { enviada: false, motivo: "nao_ativa" };

    // 2. Já foi recebida alguma vez? (idempotência — ver o topo do arquivo)
    if (await jaRecebeuBoasVindas(admin, familyId)) return { enviada: false, motivo: "ja_enviada" };

    // 3. Reserva ANTES de escrever: webhook e reconciliador podem correr juntos,
    //    e "consultar e depois enviar" não basta — os dois consultam antes de
    //    qualquer um registrar (§8). Este é o mesmo mecanismo da cadência.
    const reserva = await reservarEnvioProativo(admin, {
      familyAccountId: familyId,
      tipo: TIPO_BOAS_VINDAS,
      // Janela larga: a pergunta é "alguém já está mandando ISTO agora?".
      janelaMs: 10 * 60 * 1000,
    });
    if (!reserva.ok) return { enviada: false, motivo: reserva.motivo ?? "reservada_por_outro" };

    const ctx = await loadFamiliaParaEnvio(admin, familyId);
    if (!ctx?.whatsapp_e164) return { enviada: false, motivo: "sem_contexto" };

    // O nome da criança vem da família real — nunca hardcoded.
    const nomeCrianca = primeiroNomeCriancaConfiavel(
      (ctx.membros?.[0] as { nome?: string } | undefined)?.nome ?? null,
    );
    const res = await enviarEPersistir(admin, {
      family_account_id: familyId,
      membro_atipico_id: ((ctx.membros?.[0] as { id?: string } | undefined)?.id ?? null) as string | null,
      phone: ctx.whatsapp_e164 as string,
      texto: textoBoasVindas(nomeCrianca),
      category: "proativa",
      tipo: TIPO_BOAS_VINDAS,
    });

    await logEvent({
      kind: "assinante_boas_vindas",
      severity: res.enviada ? "info" : "warn",
      persistir: true,
      family_account_id: familyId,
      message: res.enviada ? "primeira mensagem como assinante enviada" : `não enviou: ${res.motivo}`,
      payload: { enviada: res.enviada },
    });
    return res.enviada ? { enviada: true } : { enviada: false, motivo: res.motivo };
  } catch (e) {
    // ⚠️ NUNCA LANÇA: o pagamento não pode falhar porque a mensagem não saiu.
    await logServerError("boas_vindas_assinante_excecao", e, { family_account_id: familyId });
    return { enviada: false, motivo: "erro" };
  }
}
