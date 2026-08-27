import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * O QUE A AYLA PODE RETOMAR DEPOIS DE UM "OBRIGADA" — e, sobretudo, o que não.
 *
 * ⚠️ A REGRA É EDITORIAL, E É RESTRITIVA DE PROPÓSITO — 27/08/2026.
 *
 * O primeiro desenho reusava a janela do `runSeguimento` (3 a 14 dias) e
 * chegou a cogitar 45, para "demonstrar memória". A decisão foi a oposta:
 *
 *   > queremos que a família perceba que a Ayla mantém o que conhece sobre
 *   > ela — não que a Ayla fique vasculhando problemas antigos para provar
 *   > memória.
 *
 * Então: **até 7 dias**, e na dúvida pergunta aberta. A ausência de resultado
 * num plano NÃO é evidência suficiente para ressuscitar um assunto — um plano
 * de três semanas atrás sem resposta provavelmente significa que ela seguiu a
 * vida, não que o assunto está pendente.
 *
 * ⚠️ E O QUE ELA NUNCA TROUXE NÃO SE RETOMA. MEDI: dos 179 planos, **19 têm
 * `origem = "fim_de_semana"`**, gerados pelo cron de sexta-feira, e **11 estão
 * sem resultado**. Perguntar "e aquele plano de fim de semana?" seria a Ayla
 * cobrando algo que a família nunca pediu. Só entra `origem = "estrategias"`,
 * que é assunto trazido por ela.
 *
 * ⚠️ NÃO EXISTE MOTOR NOVO AQUI. É a MESMA consulta que `runSeguimento` já faz
 * (`resultado IS NULL` + `seguimento_enviado_em IS NULL`), com janela e origem
 * apertadas para este momento. Uma segunda inteligência longitudinal para
 * pós-pagamento seria exatamente o que não se deve construir.
 */

/** Sete dias. Mais que isso é ressurreição, não continuidade. */
const JANELA_DIAS = 7;

/** Planos que a FAMÍLIA pediu. `fim_de_semana` é do cron, e não conta. */
const ORIGEM_DELA = "estrategias";

export type TemaRetomavel = {
  planoId: string;
  tema: string;
  titulo: string | null;
  criadoEm: string;
};

/**
 * Existe assunto realmente aberto, trazido por ela, nos últimos 7 dias?
 *
 * Devolve `null` sempre que houver qualquer dúvida — e `null` é o caminho
 * BOM: vira pergunta aberta, que nunca erra e nunca inventa continuidade.
 */
export async function temaParaRetomar(
  admin: SupabaseClient,
  familyId: string,
  agora: number = Date.now(),
): Promise<TemaRetomavel | null> {
  const desde = new Date(agora - JANELA_DIAS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("planos")
    .select("id, tema, titulo, created_at")
    .eq("family_account_id", familyId)
    .eq("origem", ORIGEM_DELA)
    // Sem resultado: ela não disse se funcionou.
    .is("resultado", null)
    // Sem seguimento: ninguém já perguntou. Não cobramos duas vezes.
    .is("seguimento_enviado_em", null)
    .gte("created_at", desde)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // ⚠️ ERRO DE LEITURA VIRA "SEM TEMA", nunca exceção. Uma consulta que falha
  // não pode derrubar a mensagem de boas-vindas — e o fallback (pergunta
  // aberta) é seguro por construção.
  if (error || !data) return null;

  const tema = String(data.tema ?? "").trim();
  if (!tema) return null;

  return {
    planoId: String(data.id),
    tema,
    titulo: (data.titulo as string | null)?.trim() || null,
    criadoEm: String(data.created_at),
  };
}

/**
 * A RESPOSTA FOI SÓ SOCIAL? — "obrigada", "ok", um emoji.
 *
 * ⚠️ O CRITÉRIO É POR AUSÊNCIA DE CONTEÚDO, não por lista de frases. Uma lista
 * fechada quebraria no primeiro "muito obrigada mesmo, viu 🙏". O que decide é:
 * é curta, e o que sobra depois de tirar as fórmulas de cortesia e os emojis é
 * praticamente nada.
 *
 * ⚠️ E O VIÉS É CONSERVADOR: na dúvida, devolve `false`. Um falso negativo
 * custa uma pergunta a menos; um falso positivo faria a Ayla ignorar o que a
 * mãe acabou de contar para disparar uma pergunta automática — que é
 * exatamente o pior comportamento possível neste momento.
 */
/**
 * ⚠️ NADA DE `\b` AQUI, e o motivo já custou caro neste repositório.
 *
 * Em JavaScript sem a flag `u`, `\b` é ASCII: entre o início da string e "ó"
 * NÃO existe fronteira de palavra, então `\bótimo\b` nunca casa. Foi
 * exatamente assim que "quanto é?" — das perguntas mais comuns — passou batido
 * pelo detector comercial até um teste pegar (ver `QUANTO_CUSTA` em
 * `destino-comercial.ts`). Aqui a fronteira é feita à mão, com classes que
 * enxergam acento.
 */
const CORTESIA =
  /(?<![\p{L}])(muito\s+)?(obrigad[ao]s?|valeu|vlw|show|[óo]tim[ao]|legal|perfeit[ao]|maravilha|que\s+bom|bom\s+demais|isso|ok|okay|blz|beleza|t[áa]\s+bom|tudo\s+bem|combinado|fechado|certo|entendi|amei|adorei|top|sim|uhum|aham|de\s+nada|imagina|gratid[ãa]o|abra[çc]os?|bjs?|beijos?|viu|mesmo|demais|nossa|eba)(?![\p{L}])/giu;
const EMOJI_E_PONTUACAO = /[\p{Extended_Pictographic}\p{Emoji_Presentation}‍️\p{P}\p{S}\s]/gu;

export function ehRespostaSocial(texto: string | null | undefined): boolean {
  const t = (texto ?? "").trim();
  if (!t) return false;
  // Mensagem longa carrega conteúdo, por definição. O corte é generoso: cabe
  // "muito obrigada mesmo, viu 🙏" e não cabe uma frase sobre a criança.
  if (t.length > 60) return false;
  const resto = t.replace(CORTESIA, "").replace(EMOJI_E_PONTUACAO, "").replace(/\d/g, "");
  // Sobrou letra? Então veio conteúdo junto — e conteúdo manda.
  return resto.length === 0;
}
