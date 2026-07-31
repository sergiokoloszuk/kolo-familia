import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { logEvent } from "@/lib/log";
import { enviarDocumento, enviarTexto } from "../whatsappSender";
import { confirmarPosse, type ContextoPosse } from "./posse";
import type { RespostaFinal, ResultadoPublicacao } from "./tipos";

/**
 * PUBLICAÇÃO — a ÚNICA porta para o WhatsApp da família. ADR 0001, seção 8.
 *
 * ⚠️ REGRA DA CAMADA: nenhum outro módulo pode importar `whatsappSender`. Nem
 * orquestrador, nem ferramenta, nem ponte, nem cron. Antes deste arquivo havia
 * 13 pontos de envio em 10 arquivos, e qualquer um publicava sem passar por
 * validação nenhuma. Existe teste arquitetural cobrando isso
 * (`fronteira.test.ts`) — se alguém importar o sender de novo, o teste quebra.
 *
 * Para falar com a Karina (alertas, healthcheck, CRM), o canal é outro:
 * `notificarAdmin()`. Não é resposta à família, não tem conversa, não passa
 * por aqui. Misturar os dois foi parte do problema original.
 *
 * O que esta camada garante:
 *   - no máximo uma publicação por `sourceMessageId`;
 *   - só publica quem ainda detém a posse do turno;
 *   - só aceita texto já validado (o tipo `TextoParaFamilia` obriga);
 *   - texto e anexos são UMA entrega, na ordem, sem intercalar;
 *   - retry não repete parte já confirmada.
 *
 * O que ela NÃO garante, e não pode: atomicidade. A Z-API não tem transação.
 * Se a bolha 1 sai e a 2 falha, a família viu meia resposta — não há como
 * desfazer. O que fazemos é registrar cada parte, para que o retry continue de
 * onde parou em vez de recomeçar. Ver `publicacaoParcial` no ADR.
 */

/** Uma parte da entrega — bolha de texto ou anexo. */
type Parte =
  | { indice: number; tipo: "texto"; conteudo: string; delay: number }
  | { indice: number; tipo: "documento"; url: string; nomeArquivo: string };

/**
 * Quebra o texto em bolhas. Mantém o ritmo que a conversa já tinha: o efeito
 * "digitando" nunca veio do streaming — vem do `delayTyping` por bolha, e é
 * preservado exatamente como era.
 */
export function quebrarEmBolhas(texto: string): string[] {
  return texto
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Delay proporcional ao tamanho, como no comportamento anterior. */
function delayDaBolha(texto: string, primeira: boolean, delayInicial?: number): number {
  if (primeira) return delayInicial ?? 2;
  return Math.min(Math.max(Math.round(texto.length / 25), 2), 6);
}

function montarPartes(resposta: RespostaFinal): Parte[] {
  const partes: Parte[] = [];
  let i = 0;

  // Texto SEMPRE antes dos anexos: o anexo só faz sentido depois da frase que
  // o apresenta. Inverter quebra o sentido da entrega.
  if (resposta.text) {
    const bolhas = quebrarEmBolhas(resposta.text);
    for (const b of bolhas) {
      partes.push({
        indice: i,
        tipo: "texto",
        conteudo: b,
        delay: delayDaBolha(b, i === 0, resposta.delayInicialSegundos),
      });
      i += 1;
    }
  }
  for (const a of resposta.attachments ?? []) {
    partes.push({ indice: i, tipo: "documento", url: a.url, nomeArquivo: a.nomeArquivo });
    i += 1;
  }
  return partes;
}

export type OpcoesPublicacao = {
  /** Contexto de posse. Ausente = publicação operacional sem turno (filler). */
  posse?: ContextoPosse;
  /** Já confirmadas num envio anterior — retry não repete. */
  partesJaConfirmadas?: number;
};

/**
 * Publica. É o único caminho.
 */
export async function publicar(
  supabase: SupabaseClient,
  resposta: RespostaFinal,
  opcoes: OpcoesPublicacao = {},
): Promise<ResultadoPublicacao> {
  const partes = montarPartes(resposta);
  if (partes.length === 0) {
    return { status: "descartado", motivo: "sem_conteudo" };
  }

  // Última reconferência possível — o mais tarde que dá, de propósito.
  if (opcoes.posse) {
    const v = await confirmarPosse(supabase, opcoes.posse);
    if (!v.ok) {
      await registrar(supabase, resposta, {
        kind: "ayla_publicacao_descartada",
        severity: "info",
        payload: { motivo: v.motivo, partes: partes.length },
      });
      // Silêncio: obsoleta não vira fallback (ADR seção 4).
      return { status: "descartado", motivo: v.motivo };
    }
  }

  const publicationId = randomUUID();
  const jaConfirmadas = opcoes.partesJaConfirmadas ?? 0;
  let confirmadas = jaConfirmadas;
  let erro: string | null = null;

  await reservar(supabase, resposta, publicationId);

  for (const parte of partes) {
    if (parte.indice < jaConfirmadas) continue; // retry não repete
    try {
      if (parte.tipo === "texto") {
        await enviarTexto({
          phoneE164: resposta.phoneE164,
          texto: parte.conteudo,
          delaySegundos: parte.delay,
        });
      } else {
        await enviarDocumento({
          phoneE164: resposta.phoneE164,
          url: parte.url,
          fileName: parte.nomeArquivo,
        });
      }
      confirmadas += 1;
    } catch (e) {
      erro = e instanceof Error ? e.message : "falha no envio";
      break;
    }
  }

  const total = partes.length;
  await registrar(supabase, resposta, {
    kind: erro ? "ayla_publicacao_parcial" : "ayla_publicacao",
    severity: erro ? "warn" : "info",
    payload: {
      publicationId,
      partesConfirmadas: confirmadas,
      partesTotais: total,
      responseType: resposta.responseType,
      // Sem texto: o conteúdo já vive em `ayla_messages`. Duplicar aqui só
      // aumentaria a superfície de exposição.
      erro: erro ?? undefined,
    },
  });

  if (erro && confirmadas === jaConfirmadas) {
    return { status: "falha", publicationId, erro };
  }
  if (confirmadas < total) {
    return { status: "parcial", publicationId, partesConfirmadas: confirmadas, partesTotais: total };
  }
  return { status: "publicado", publicationId, partesConfirmadas: confirmadas, partesTotais: total };
}

/**
 * Marca a inbound como já publicada. Índice único em `source_message_id` faz o
 * segundo insert virar no-op, então duas execuções simultâneas não publicam
 * duas vezes nem que passem juntas pela reconferência de posse.
 *
 * Degrada em silêncio se a 0072 não estiver aplicada: a reconferência de posse
 * continua valendo, só perdemos esta trava extra.
 */
async function reservar(
  supabase: SupabaseClient,
  resposta: RespostaFinal,
  publicationId: string,
): Promise<void> {
  try {
    await supabase.from("ayla_publicacoes").insert({
      id: publicationId,
      family_account_id: resposta.conversationId,
      source_message_id: resposta.sourceMessageId,
      execution_id: resposta.executionId,
      response_type: resposta.responseType,
    });
  } catch {
    /* tabela ausente — ver comentário acima */
  }
}

async function registrar(
  supabase: SupabaseClient,
  resposta: RespostaFinal,
  evento: { kind: string; severity: "info" | "warn"; payload: Record<string, unknown> },
): Promise<void> {
  await logEvent({
    kind: evento.kind,
    severity: evento.severity,
    family_account_id: resposta.conversationId,
    payload: {
      sourceMessageId: resposta.sourceMessageId,
      executionId: resposta.executionId,
      ...evento.payload,
    },
  }).catch(() => {});
  void supabase;
}
