/**
 * CONFLITOS BIA × BOAS PRÁTICAS — detecção determinística, PURA.
 *
 * Por que existe: as duas fontes convivem no mesmo prompt e podem se
 * contradizer. O caso concreto já medido (auditoria de 30/07, em
 * `docs/auditoria-brincar-bia.md`): BP-COM-12, BP-COM-02 e BP-IMI-02
 * PRESCREVEM contato visual ("Estabeleça contato visual frequente… observe se
 * mantém o olhar"), sem ressalva — enquanto a BIA diz, em vários núcleos, que
 * contato visual não deve ser forçado, porque em muitas crianças autistas olhar
 * é processado como sobrecarga sensorial.
 *
 * Sem detecção, o modelo receberia as duas coisas no mesmo turno e escolheria
 * uma. Com detecção, o bloco instrui a seguir a alternativa MAIS CAUTELOSA e o
 * conflito fica registrado para auditoria.
 *
 * ⚠️ LIMITE HONESTO DESTE MÓDULO: ele é um detector ESTREITO, de tensões
 * conhecidas — não um verificador geral de contradição. Sem LLM (decisão desta
 * etapa) não há como detectar contradição semântica arbitrária. Ele pega o que
 * já sabemos que existe; o que não estiver na lista passa despercebido. Cada
 * tensão nova que a revisão da Karina encontrar vira uma entrada aqui.
 */

export type Tensao = {
  /** Identificador curto — é o que vai para o log de auditoria. */
  tema: string;
  /** Explicação para quem lê a auditoria. */
  descricao: string;
  /** O padrão do lado PRESCRITIVO (tipicamente a Boa Prática). */
  prescritivo: RegExp;
  /** O padrão do lado CAUTELOSO (tipicamente a BIA). */
  cauteloso: RegExp;
};

/**
 * As tensões conhecidas. Ordem não importa — todas são avaliadas.
 *
 * Os padrões trabalham sobre texto normalizado (minúsculo, sem acento), então
 * são escritos sem acentuação.
 */
export const TENSOES: readonly Tensao[] = [
  {
    tema: "contato_visual",
    descricao:
      "orientação prática pede contato visual; a BIA desaconselha forçar o olhar",
    prescritivo:
      /(estabele[cç]a|incentive|estimule|exija|pe[cç]a|mantenha|busque|garanta)[^.]{0,40}(contato visual|olhar nos olhos)/,
    cauteloso:
      /(nao|jamais)[^.]{0,40}(force|forcar|exigir|exija|obrigue|obrigar|cobrar)[^.]{0,40}(contato visual|olhar)|contato visual[^.]{0,60}(sobrecarga|custa caro|aversivo|nao exigir)/,
  },
  {
    tema: "recompensa",
    descricao:
      "orientação prática usa recompensa/prêmio por comportamento; o método Kolo e a BIA vetam",
    prescritivo:
      /(recompens|premi|se[^.]{0,25}(fizer|comer|escovar|obedecer)[^.]{0,25}(ganha|pode))/,
    cauteloso:
      /(nao|nunca)[^.]{0,40}(recompensa|premio|moeda de troca|reforc)|(nao|nunca) us(e|ar)[^.]{0,40}(comida|tela|brinquedo|interesse)[^.]{0,30}(recompensa|premio)/,
  },
  {
    tema: "exposicao_forcada",
    descricao:
      "orientação prática manda insistir/forçar exposição; a BIA diz que exposição forçada aumenta a reatividade",
    prescritivo: /(insista|force|forcar|obrigue|persista)[^.]{0,50}(prov|toque|experiment|encare|enfrent)/,
    cauteloso:
      /exposi[cç]ao for[cç]ada[^.]{0,60}(aumenta|fortalece|piora)|(nao|nunca) for[cç]ar?[^.]{0,40}(exposi|contato|toque)/,
  },
];

export type ConflitoDetectado = {
  tema: string;
  descricao: string;
  /** Trecho curto do lado prescritivo, para auditoria. Nunca a conversa. */
  trechoPrescritivo: string;
  /** Trecho curto do lado cauteloso. */
  trechoCauteloso: string;
};

function normalizar(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** Um recorte curto ao redor do casamento — o suficiente para auditar. */
function trecho(texto: string, re: RegExp): string {
  const m = normalizar(texto).match(re);
  if (!m || m.index == null) return "";
  const inicio = Math.max(0, m.index - 20);
  return texto.slice(inicio, inicio + 140).replace(/\s+/g, " ").trim();
}

/**
 * Detecta tensões entre o que a BIA trouxe e o que as Boas Práticas trouxeram
 * NESTE turno.
 *
 * Só reporta quando os DOIS lados aparecem: uma BP que prescreve contato visual
 * sem nenhum chunk da BIA falando de olhar não é conflito — é só uma BP. O que
 * o modelo precisa saber é que recebeu as duas coisas ao mesmo tempo.
 */
export function detectarConflitos(params: {
  textosBia: string[];
  textosBoasPraticas: string[];
}): ConflitoDetectado[] {
  const bia = params.textosBia.join("\n");
  const bp = params.textosBoasPraticas.join("\n");
  if (!bia.trim() || !bp.trim()) return [];

  const biaNorm = normalizar(bia);
  const bpNorm = normalizar(bp);

  const achados: ConflitoDetectado[] = [];
  for (const t of TENSOES) {
    // O lado prescritivo pode vir de qualquer uma das duas fontes; o cauteloso,
    // idem. O que importa é a COEXISTÊNCIA das duas posturas no mesmo turno.
    const prescritivoNaBp = t.prescritivo.test(bpNorm);
    const prescritivoNaBia = t.prescritivo.test(biaNorm);
    const cautelosoNaBia = t.cauteloso.test(biaNorm);
    const cautelosoNaBp = t.cauteloso.test(bpNorm);

    const conflita =
      (prescritivoNaBp && cautelosoNaBia) || (prescritivoNaBia && cautelosoNaBp);
    if (!conflita) continue;

    achados.push({
      tema: t.tema,
      descricao: t.descricao,
      trechoPrescritivo: trecho(prescritivoNaBp ? bp : bia, t.prescritivo),
      trechoCauteloso: trecho(cautelosoNaBia ? bia : bp, t.cauteloso),
    });
  }
  return achados;
}
