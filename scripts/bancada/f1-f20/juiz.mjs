/**
 * O JUIZ SEMÂNTICO — rubrica fechada, veredito por critério.
 *
 * ⚠️ ELE NÃO É A AYLA E NÃO MELHORA NADA. Recebe a resposta pronta e julga; não
 * reescreve, não sugere, não completa. Um juiz que "conserta" mede o que ele
 * mesmo produziu, não o que o produto produziu.
 *
 * ⚠️ E ELE NÃO PREMIA PROLIXIDADE. A instrução diz isso por extenso porque é o
 * viés natural de um modelo julgando texto: resposta longa parece mais
 * completa. Aqui, tamanho é assunto do F16 e do F1, que são determinísticos —
 * o juiz que der `pass` a mais por uma resposta ser maior está errando.
 *
 * ⚠️ O RACIOCÍNIO NÃO SAI. O contrato pede `evidencia_curta` — um trecho da
 * própria resposta, não uma explicação. Explicação de juiz vira ensaio, e
 * ensaio não se compara entre execuções.
 */

import { CRITERIOS_JUIZ } from "./rubrica.mjs";

const INSTRUCOES = `Você avalia UMA resposta de uma assistente (Ayla) a uma mãe/responsável, segundo critérios fixos. Você não é a assistente, não reescreve nada e não sugere melhorias.

Devolva SOMENTE um JSON, sem cercas de código:

{ "criterios": [ { "criterio": "F3", "veredito": "pass" | "fail" | "nao_aplicavel", "evidencia_curta": "trecho literal da resposta, até 120 caracteres", "confianca": 0.0 a 1.0 } ] }

REGRAS DO JULGAMENTO:

1. Use "nao_aplicavel" quando o critério não faz sentido para este turno — e não como escapatória para dúvida. Na dúvida entre pass e fail, escolha o veredito e baixe a "confianca".
2. "evidencia_curta" é um TRECHO LITERAL da resposta avaliada. Não escreva explicação, justificativa nem raciocínio. Se o veredito for "nao_aplicavel", use string vazia.
3. NÃO premie resposta longa. Tamanho é avaliado por outro mecanismo. Uma resposta curta e certa vale mais que uma longa e completa.
4. NÃO premie simpatia, elogio à mãe nem linguagem afetuosa. Isso não é critério aqui.
5. Julgue SÓ a última resposta da Ayla, usando o histórico apenas como contexto.
6. Para F11, compare com o CONTEXTO CONHECIDO fornecido: qualquer afirmação sobre a criança que não esteja lá é invenção, por mais plausível que soe.

Avalie exatamente estes critérios, e nenhum outro:`;

/**
 * Julga um turno. Uma chamada por turno, com todos os critérios semânticos.
 *
 * ⚠️ UMA CHAMADA, NÃO DOZE. Um critério por chamada daria doze vezes o custo e
 * doze oportunidades de variação. Juntos, o juiz lê a resposta uma vez só — e
 * os vereditos ficam coerentes entre si, o que separadamente não aconteceria.
 */
export async function julgar({ turno, historico, contextoConhecido, chamarModelo }) {
  const criterios = CRITERIOS_JUIZ.map((c) => `- ${c.id} (${c.nome}): ${c.pergunta}`).join("\n");

  const hist = (historico ?? [])
    .map((h) => `${h.quem === "mae" ? "Responsável" : "Ayla"}: ${h.texto}`)
    .join("\n")
    .slice(-3000);

  const marcas = [
    turno.desabafo ? "Este turno é um DESABAFO sem risco." : "",
    turno.risco ? "Este turno tem RISCO REAL — segurança vence estilo." : "",
    turno.correcao ? "Neste turno a família CORRIGIU algo que a Ayla disse." : "",
    turno.pediuPassoAPasso ? "A família pediu passo a passo explicitamente." : "",
  ].filter(Boolean).join(" ");

  const prompt = [
    `<contexto_conhecido_sobre_a_crianca>\n${contextoConhecido || "(vazio — nada se sabe sobre esta criança)"}\n</contexto_conhecido_sobre_a_crianca>`,
    hist ? `<conversa_ate_aqui>\n${hist}\n</conversa_ate_aqui>` : "",
    `<mensagem_da_familia>${turno.msg}</mensagem_da_familia>`,
    marcas ? `<marcas_do_turno>${marcas}</marcas_do_turno>` : "",
    `<resposta_da_ayla_a_avaliar>\n${turno.texto}\n</resposta_da_ayla_a_avaliar>`,
  ].filter(Boolean).join("\n\n");

  const bruto = await chamarModelo({
    system: `${INSTRUCOES}\n${criterios}`,
    user: prompt,
  });

  return interpretarVeredito(bruto);
}

/**
 * Lê o JSON do juiz sem confiar nele.
 *
 * ⚠️ VEREDITO ILEGÍVEL VIRA `indeterminado`, NUNCA `pass`. Um juiz que falha ao
 * responder não aprova nada por omissão — senão a bancada ficaria melhor quanto
 * mais o juiz quebrasse, que é o incentivo exatamente invertido.
 */
export function interpretarVeredito(bruto) {
  const out = {};
  const validos = new Set(["pass", "fail", "nao_aplicavel"]);
  const idsConhecidos = new Set(CRITERIOS_JUIZ.map((c) => c.id));
  try {
    const limpo = String(bruto ?? "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const i = limpo.indexOf("{");
    const j = limpo.lastIndexOf("}");
    if (i < 0 || j <= i) throw new Error("sem json");
    const o = JSON.parse(limpo.slice(i, j + 1));
    for (const c of o.criterios ?? []) {
      const id = String(c?.criterio ?? "").trim().toUpperCase();
      if (!idsConhecidos.has(id)) continue;
      const v = String(c?.veredito ?? "").trim().toLowerCase();
      out[id] = {
        veredito: validos.has(v) ? v : "indeterminado",
        evidencia: String(c?.evidencia_curta ?? "").slice(0, 120),
        confianca: typeof c?.confianca === "number" ? Math.max(0, Math.min(1, c.confianca)) : null,
      };
    }
  } catch {
    // cai no preenchimento abaixo
  }
  // Critério que o juiz não devolveu é indeterminado, e aparece no relatório.
  for (const c of CRITERIOS_JUIZ) {
    if (!out[c.id]) out[c.id] = { veredito: "indeterminado", evidencia: "", confianca: null };
  }
  return out;
}
