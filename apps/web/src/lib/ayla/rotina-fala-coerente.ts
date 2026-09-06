/**
 * A FALA NÃO PODE AFIRMAR O QUE O ESTADO NÃO SUSTENTA.
 *
 * ⚠️ O CASO REAL. A Ayla escreveu para a Karina:
 *
 *     "Pronto! A rotina da Manu está montada"
 *
 * enquanto a rotina estava em `cards_status='aguardando'` — nenhum cartão
 * encomendado, nenhuma imagem gerada, nada para abrir. A mãe foi olhar e não
 * havia nada. A frase não era mentira do modelo: era o modelo narrando a
 * intenção do turno, sem acesso ao estado do artefato.
 *
 * ⚠️ POR QUE ISTO NÃO É UMA LINHA DE PROMPT. A doutrina deste repositório é
 * explícita, e este é o caso canônico dela: regra que falha em prompt se
 * corrige ESTRUTURALMENTE. Pedir ao modelo "não diga pronto se não estiver
 * pronto" compete com a instrução de ser prestativo e de fechar bem o turno —
 * e perde, porque o modelo não sabe o que `cards_status` diz. Aqui a fala é
 * conferida contra a linha do banco, depois de gerada, por código.
 *
 * ⚠️ E ELE NÃO INVENTA CONCLUSÃO. Este módulo só sabe RETIRAR uma afirmação
 * que o estado não sustenta. Ele nunca acrescenta um "pronto" que o modelo não
 * escreveu — a direção é sempre da afirmação para a ressalva, nunca o inverso.
 */

/** O que a linha `rotinas.cards_status` pode dizer, de verdade. */
export type EstadoDeCartoes = "nenhum" | "aguardando" | "gerando" | "pronto" | "erro";

/**
 * As formas de dizer "acabou, está aí".
 *
 * ⚠️ CADA ALTERNATIVA VEIO DE UMA FALA REAL, não de imaginação sobre o que o
 * modelo poderia escrever. A lista cobre a conclusão do artefato ("está
 * montada", "ficou pronta", "já mandei") e a entrega ("aqui está", "te enviei",
 * "acabei de mandar"). Ela é deliberadamente exigente na forma: `pronto` sozinho
 * numa frase como "vão aparecendo conforme ficarem prontos" é PROMESSA, não
 * afirmação de conclusão, e não pode ser apagada.
 */
const AFIRMA_CONCLUSAO =
  /(\bpront[oa]\s*[!.]|\bprontinho\b|\b(?:est[áa]|ficou|fica|já\s+est[áa])\s+(?:tudo\s+)?(?:pront[oa]|montad[oa]|criad[oa]|feit[oa]|no\s+ar|dispon[íi]vel)\b|\b(?:montei|criei|fiz|preparei|gerei|deixei\s+pront[oa])\b|\b(?:j[áa]\s+)?(?:te\s+)?(?:mandei|enviei|acabei\s+de\s+mandar|acabei\s+de\s+enviar)\b|\baqui\s+est[áa](?![\p{L}])|\bacabou\s+de\s+ficar\s+pront[oa]\b|\bos?\s+cart(?:ões|ao|ões)\s+(?:j[áa]\s+)?est[ãa]o\s+(?:a[íi]|pront[oa]s))/iu;

/**
 * O estado autoriza afirmar conclusão?
 *
 * ⚠️ `pronto` SOZINHO NÃO BASTA, e esta é a metade esquecida do problema. Uma
 * rotina pode ter `cards_status='pronto'` e nenhum artefato recuperável — a
 * geração marcou sucesso e as imagens não vingaram. Afirmar entrega aí é o
 * mesmo erro com outra origem. Por isso a prova é dupla: estado E artefato.
 */
export function podeAfirmarConclusao(
  estado: EstadoDeCartoes,
  temArtefatoVerificavel: boolean,
): boolean {
  return estado === "pronto" && temArtefatoVerificavel;
}

/** O que dizer no lugar, por estado. Sempre verdade, sempre curto. */
function ressalvaHonesta(estado: EstadoDeCartoes): string {
  switch (estado) {
    case "aguardando":
      return "Assim que eu tiver o tema, começo a preparar os cartões";
    case "gerando":
      return "Já comecei a preparar os cartões — eles vão aparecendo conforme ficarem prontos";
    case "erro":
      return "Os cartões não ficaram prontos desta vez — vou tentar de novo e te aviso";
    case "pronto":
      // `pronto` sem artefato: o estado diz que acabou, a prova não aparece.
      return "Estou terminando de deixar os cartões disponíveis";
    default:
      return "";
  }
}

export type FalaConferida = {
  texto: string;
  /** Verdadeiro quando alguma afirmação foi retirada. Vira telemetria. */
  corrigida: boolean;
  /** O que foi retirado — para o evento, nunca para a família. */
  removido: string[];
};

/**
 * Confere a fala contra o estado e devolve a versão que o estado sustenta.
 *
 * A cirurgia é POR FRASE: a primeira que afirma conclusão vira a ressalva
 * honesta do estado; as seguintes saem. O resto do texto — acolhimento,
 * orientação, a pergunta do tema — passa intocado, porque não é ele que está
 * errado.
 */
export function falaCoerenteComEstado(params: {
  texto: string;
  estado: EstadoDeCartoes;
  temArtefatoVerificavel: boolean;
}): FalaConferida {
  const { texto, estado, temArtefatoVerificavel } = params;
  if (podeAfirmarConclusao(estado, temArtefatoVerificavel)) {
    return { texto, corrigida: false, removido: [] };
  }
  // `nenhum` = ninguém pediu cartão. Não há artefato para afirmar nem para
  // negar, e a fala não é sobre isso. Sai intacta.
  if (estado === "nenhum") return { texto, corrigida: false, removido: [] };

  const frases = texto.split(/(?<=[.!?\n])\s*/);
  const removido: string[] = [];
  let jaSubstituiu = false;
  const saida: string[] = [];

  for (const frase of frases) {
    if (!AFIRMA_CONCLUSAO.test(frase)) {
      saida.push(frase);
      continue;
    }
    removido.push(frase.trim());
    if (!jaSubstituiu) {
      const r = ressalvaHonesta(estado);
      if (r) saida.push(`${r} 🌿`);
      jaSubstituiu = true;
    }
  }

  if (removido.length === 0) return { texto, corrigida: false, removido: [] };

  const limpo = saida.join(" ").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  // ⚠️ NUNCA DEVOLVER VAZIO. Se a fala inteira era a afirmação, a ressalva é a
  // resposta — calar seria trocar uma promessa falsa por abandono silencioso,
  // que é justamente o que esta frente existe para acabar.
  return {
    texto: limpo || `${ressalvaHonesta(estado)} 🌿`,
    corrigida: true,
    removido,
  };
}
