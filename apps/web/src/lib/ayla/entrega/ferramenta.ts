import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { publicar } from "./publicacao";
import { comoTextoParaFamilia, type AnexoParaFamilia } from "./tipos";

/**
 * ATALHOS DE PUBLICAÇÃO PARA FLUXOS QUE NÃO PASSAM PELO TURNO.
 *
 * A regra do ADR continua valendo: só a Publicação fala com o WhatsApp. Estes
 * dois helpers existem para os fluxos que produzem entrega FORA do ciclo
 * inbound → resposta, e que por isso não têm `sourceMessageId` nem posse:
 *
 *   - a rotina guiada, que é um fluxo conversacional próprio e entrega o PDF
 *     no meio dele;
 *   - as mensagens proativas/operacionais (convite de assinatura, templates),
 *     que nascem de um cron ou de um gate, não de uma fala da mãe.
 *
 * Eles não driblam a fronteira: chamam `publicar()`, com um `sourceMessageId`
 * sintético e sem contexto de posse — porque não há turno a disputar. O que se
 * perde é a trava de idempotência por inbound, que nestes casos não se aplica
 * (o próprio fluxo já tem a sua: dedup por dia, por oferta, por template).
 *
 * ⚠️ Se você está escrevendo uma RESPOSTA a uma mensagem da mãe, não é aqui.
 * É `montarEntrega` + `publicar` com contexto de posse.
 */

/** Entrega um anexo produzido por uma ferramenta, num fluxo sem turno. */
export async function publicarAnexoDeFerramenta(
  supabase: SupabaseClient,
  params: { familyId: string; phoneE164: string; anexo: AnexoParaFamilia; texto?: string },
): Promise<void> {
  await publicar(supabase, {
    conversationId: params.familyId,
    sourceMessageId: `ferramenta:${params.anexo.rotulo ?? "anexo"}:${randomUUID()}`,
    executionId: randomUUID(),
    phoneE164: params.phoneE164,
    // Texto operacional do próprio repositório quando existir — não vem de IA.
    text: params.texto ? comoTextoParaFamilia(params.texto) : undefined,
    attachments: [params.anexo],
    responseType: "entrega",
  });
}

/**
 * Publica texto OPERACIONAL (proativa, template, convite). O texto é do
 * repositório ou de um template do banco — não é saída livre de modelo.
 */
export async function publicarOperacional(
  supabase: SupabaseClient,
  params: { familyId: string; phoneE164: string; texto: string },
): Promise<{ messageId: string; raw: unknown }> {
  const r = await publicar(supabase, {
    conversationId: params.familyId,
    sourceMessageId: `operacional:${randomUUID()}`,
    executionId: randomUUID(),
    phoneE164: params.phoneE164,
    text: comoTextoParaFamilia(params.texto),
    responseType: "sistema",
  });
  if (r.status === "falha") throw new Error(r.erro);
  return {
    messageId: r.status === "descartado" ? "descartado" : r.publicationId,
    raw: null,
  };
}
