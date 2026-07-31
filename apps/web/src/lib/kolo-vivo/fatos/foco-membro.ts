import { classificarSujeito, type SujeitoCandidato } from "./sujeito";

/**
 * RESOLUÇÃO DO MEMBRO EM FOCO — camada única.
 *
 * O achado que motivou este arquivo: **quatro caminhos resolvem o membro de
 * quatro formas**, e uma delas é `ctx.membros[0]` no orquestrador do WhatsApp —
 * o primeiro filho do array, não um foco de verdade. Numa família com dois
 * filhos, tudo é gravado em quem estiver em primeiro, para sempre, sem nenhum
 * sinal de que está errado.
 *
 * Os outros três são melhores mas divergentes: a web manual usa
 * `conversa.membro_atipico_id`, a web automática recebe `membroId` do chamador,
 * e o diário usa a seleção explícita do formulário.
 *
 * Esta função não conserta o foco de cada canal — isso exigiria mexer no fluxo
 * de conversa, que está fora desta fase. O que ela faz é **transformar a
 * qualidade do foco em dado**: cada escrita passa a declarar de onde veio o
 * membro, com que confiança, e a decisão que isso implica. Sem isso, um fato
 * gravado a partir de `membros[0]` é indistinguível de um fato gravado a partir
 * de seleção explícita — e a Fase 10 não teria como saber em quem confiar.
 */

/** De onde veio o membro. Ordenado do mais forte para o mais frágil. */
export type FonteDoFoco =
  /** A pessoa selecionou no formulário. É o mais forte que existe. */
  | "selecao_explicita"
  /** A conversa está vinculada a um membro (web). */
  | "vinculo_da_conversa"
  /** O chamador informou, sem dizer como soube. */
  | "informado_pelo_chamador"
  /** Primeiro membro da família. NÃO é foco — é acaso. */
  | "primeiro_da_familia"
  | "desconhecida";

/** Quanto dá para confiar no membro resolvido. */
export type ConfiancaFoco = "alta" | "media" | "baixa";

const CONFIANCA_POR_FONTE: Record<FonteDoFoco, ConfiancaFoco> = {
  selecao_explicita: "alta",
  vinculo_da_conversa: "alta",
  informado_pelo_chamador: "media",
  // Deliberadamente baixa: `membros[0]` numa família com um filho só está
  // certo por sorte, e numa família com dois está errado metade do tempo.
  primeiro_da_familia: "baixa",
  desconhecida: "baixa",
};

export type DecisaoFoco = "persistir" | "quarentena" | "rejeitar";

export type ResolucaoMembro = {
  membroId: string | null;
  fonte: FonteDoFoco;
  confianca: ConfiancaFoco;
  sujeito: SujeitoCandidato;
  /** O que pesou a favor. */
  sinais: string[];
  /** O que pesou contra — cada um é motivo de não persistir direto. */
  contraSinais: string[];
  decisao: DecisaoFoco;
  motivo: string;
};

export type EntradaFoco = {
  membroId: string | null;
  fonte: FonteDoFoco;
  texto: string;
  /** Nomes dos membros da família, para detectar conflito com o texto. */
  nomesDaFamilia?: Array<{ id: string; nome: string }>;
};

function normalizar(t: string): string {
  return (t ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Resolve, e explica.
 *
 * A hierarquia de decisão, do mais grave para o menos:
 *
 * 1. **Sujeito não elegível** → nunca persiste. Cuidadora, outra pessoa,
 *    múltiplas pessoas e desconhecido não viram fato da criança.
 * 2. **Conflito de nome** → o texto cita OUTRO membro da família, diferente do
 *    que está em foco. É o caso "a conversa era sobre o Pedro e a mãe passou a
 *    falar da Ana": vai para quarentena, nunca para o membro em foco.
 * 3. **Foco frágil** (`primeiro_da_familia`) numa família com mais de um filho
 *    → quarentena. Com um filho só, persiste: não há em quem errar.
 * 4. Caso contrário → persiste.
 *
 * A regra que organiza tudo continua a mesma: perder um candidato incerto é
 * preferível a gravar um fato na pessoa errada.
 */
export function resolverMembro(e: EntradaFoco): ResolucaoMembro {
  const sinais: string[] = [];
  const contraSinais: string[] = [];
  const confianca = CONFIANCA_POR_FONTE[e.fonte];
  const sujeito = classificarSujeito({
    texto: e.texto,
    membroSelecionado: Boolean(e.membroId),
  });

  sinais.push(`fonte:${e.fonte}`);
  if (sujeito === "accompanied_member") sinais.push("sujeito:elegivel");

  const base = {
    membroId: e.membroId,
    fonte: e.fonte,
    confianca,
    sujeito,
    sinais,
    contraSinais,
  };

  if (!e.membroId) {
    contraSinais.push("sem_membro");
    return { ...base, decisao: "rejeitar", motivo: "sem_membro" };
  }

  // 1. Sujeito. O texto pode desmentir a estrutura, e quando desmente, manda.
  if (sujeito !== "accompanied_member") {
    contraSinais.push(`sujeito:${sujeito}`);
    // Cuidadora e outra pessoa são conclusivos: não é fato da criança, ponto.
    // Ambíguo e desconhecido são incerteza — e incerteza vai para quarentena,
    // porque a informação pode ser valiosa e só falta saber de quem é.
    const conclusivo = sujeito === "caregiver" || sujeito === "another_person";
    return {
      ...base,
      decisao: conclusivo ? "rejeitar" : "quarentena",
      motivo: `sujeito_${sujeito}`,
    };
  }

  // 2. O texto cita outro membro da família?
  const nomes = e.nomesDaFamilia ?? [];
  if (nomes.length > 1) {
    const t = normalizar(e.texto);
    const citados = nomes.filter(
      (m) => m.nome.trim().length >= 3 && t.includes(normalizar(m.nome)),
    );
    const outros = citados.filter((m) => m.id !== e.membroId);
    if (outros.length > 0) {
      contraSinais.push("nome_de_outro_membro_no_texto");
      return { ...base, decisao: "quarentena", motivo: "conflito_de_nome" };
    }
    if (citados.length > 0) sinais.push("nome_do_membro_em_foco_no_texto");
  }

  // 3. Foco frágil só é aceitável quando não há em quem errar.
  if (e.fonte === "primeiro_da_familia" && nomes.length > 1) {
    contraSinais.push("foco_por_ordem_do_array_com_varios_membros");
    return { ...base, decisao: "quarentena", motivo: "foco_fragil" };
  }

  return { ...base, decisao: "persistir", motivo: "ok" };
}
