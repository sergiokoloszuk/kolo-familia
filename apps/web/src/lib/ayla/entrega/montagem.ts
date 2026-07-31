import { validarSaida, fallbackSeguro, type ModoValidacao, type AchadoValidacao } from "./validacao";
import type {
  AnexoParaFamilia,
  RespostaFinal,
  ResultadoFerramenta,
  TextoBruto,
  TipoResposta,
} from "./tipos";

/**
 * MONTAGEM — ADR 0001, etapa 6.
 *
 * Converte "vários pedaços de resultado" em UMA entrega. Existe como camada
 * própria porque, sem ela, a tentação de mandar "só mais um balãozinho"
 * reaparece — e foi exatamente ela que produziu quatro envios independentes por
 * turno (filler, bolhas do modelo, nudge da ponte, PDF).
 *
 * Três coerências que só dá para checar aqui, com tudo na mão:
 *
 *   1. ANEXO ÓRFÃO — anexo sem texto que o apresente. Chega um PDF do nada.
 *   2. PROMESSA VAZIA — o texto diz "mandei o PDF" e não existe anexo. É pior
 *      que o órfão: a mãe procura uma coisa que não veio.
 *   3. ERRO INTERNO VAZANDO — ferramenta que falhou devolve `erroInterno`, que
 *      é um objeto tipado justamente para não conseguir grudar no texto.
 */

/** Frases que anunciam um anexo. Se aparecerem sem anexo, é promessa vazia. */
const PROMETE_ANEXO =
  /\b(pdf|documento|arquivo|em anexo|te mandei|acabei de mandar|segue o|segue a|baixar)\b/i;

export type EntradaMontagem = {
  conversationId: string;
  sourceMessageId: string;
  executionId: string;
  phoneE164: string;
  /** Texto cru do modelo. Pode faltar (entrega só de anexo). */
  textoDoModelo?: TextoBruto | string | null;
  /** O que as ferramentas devolveram. Nenhuma delas publicou nada. */
  ferramentas?: ResultadoFerramenta[];
  responseType?: TipoResposta;
  delayInicialSegundos?: number;
  modoValidacao?: ModoValidacao;
  /** Texto operacional fixo do repositório (convite, filler). Não vem de IA. */
  operacional?: boolean;
};

export type SaidaMontagem = {
  resposta: RespostaFinal | null;
  /** Por que não há resposta, ou o que foi ajustado. Para o log. */
  achados: AchadoValidacao[];
  bloqueada: boolean;
  ajustes: string[];
};

/**
 * Monta a entrega final. Devolve `null` quando não há nada publicável — e aí
 * quem chama NÃO publica; não inventa mensagem.
 */
export function montarEntrega(entrada: EntradaMontagem): SaidaMontagem {
  const ajustes: string[] = [];

  // Anexos vêm só de ferramenta, e só quando ela não falhou.
  const anexos: AnexoParaFamilia[] = [];
  for (const f of entrada.ferramentas ?? []) {
    if (f.erroInterno) {
      // Nunca vira texto. Só rastro.
      ajustes.push(`ferramenta_${f.tipo}_falhou:${f.erroInterno.codigo}`);
      continue;
    }
    for (const a of f.anexos ?? []) anexos.push(a);
  }

  // Texto: o do modelo, mais o que as ferramentas sugeriram (a ponte, por
  // exemplo, sugere o link do plano). O texto da ferramenta é sugestão, não
  // publicação — passa pela mesma validação.
  const pedacos: string[] = [];
  const bruto = String(entrada.textoDoModelo ?? "").trim();
  if (bruto) pedacos.push(bruto);
  for (const f of entrada.ferramentas ?? []) {
    if (f.erroInterno) continue;
    const t = (f.textoSugerido ?? "").trim();
    if (t) pedacos.push(t);
  }
  const textoUnido = pedacos.join("\n\n");

  const achados: AchadoValidacao[] = [];
  let textoFinal: RespostaFinal["text"] | undefined;

  if (textoUnido) {
    const v = validarSaida(textoUnido, {
      modo: entrada.modoValidacao,
      origem: entrada.operacional ? "operacional" : "modelo",
    });
    achados.push(...v.achados);
    if (v.ok) {
      textoFinal = v.texto;
    } else if (v.motivo === "bloqueado") {
      // Bloqueado → fallback neutro. A família nunca fica sem resposta e nunca
      // sabe que houve filtro.
      textoFinal = fallbackSeguro();
      ajustes.push("fallback_aplicado");
      // Com fallback, anexo perde o texto que o apresentava: vira órfão.
      if (anexos.length > 0) {
        anexos.length = 0;
        ajustes.push("anexos_descartados_com_fallback");
      }
      return {
        resposta: montar(entrada, textoFinal, anexos),
        achados,
        bloqueada: true,
        ajustes,
      };
    }
  }

  // Coerência 1 — anexo órfão.
  if (!textoFinal && anexos.length > 0) {
    ajustes.push("anexo_orfao_bloqueado");
    return { resposta: null, achados, bloqueada: false, ajustes };
  }

  // Coerência 2 — promessa vazia.
  if (textoFinal && anexos.length === 0 && PROMETE_ANEXO.test(textoFinal)) {
    ajustes.push("promessa_de_anexo_sem_anexo");
    // Não reescrevemos o texto (isso é voz, e voz não é desta camada). O texto
    // sai; o ajuste fica registrado para investigação. Bloquear a resposta
    // inteira por causa da palavra "arquivo" seria pior.
  }

  if (!textoFinal && anexos.length === 0) {
    return { resposta: null, achados, bloqueada: false, ajustes };
  }

  return { resposta: montar(entrada, textoFinal, anexos), achados, bloqueada: false, ajustes };
}

function montar(
  e: EntradaMontagem,
  text: RespostaFinal["text"],
  attachments: AnexoParaFamilia[],
): RespostaFinal {
  return {
    conversationId: e.conversationId,
    sourceMessageId: e.sourceMessageId,
    executionId: e.executionId,
    phoneE164: e.phoneE164,
    text,
    attachments: attachments.length > 0 ? attachments : undefined,
    responseType: e.responseType ?? (attachments.length > 0 ? "entrega" : "resposta"),
    delayInicialSegundos: e.delayInicialSegundos,
  };
}
