import type { BiaChunk, BiaNucleo, BiaTipoConhecimento } from "./tipos";
import { BIA_NUCLEO_LABEL, BIA_NUCLEO_PARA_DOMINIOS, BIA_NUCLEOS, faixaServe } from "./tipos";

/**
 * PONTUAÇÃO DA BIA — o núcleo do retriever, PURO.
 *
 * Zero I/O: sem Supabase, sem rede, sem IA, sem embedding. É de propósito — é o
 * que permite testar a qualidade da recuperação isoladamente, antes de qualquer
 * integração com a Ayla. Todo o julgamento mora aqui; `retriever.ts` só busca
 * candidatos e chama estas funções.
 *
 * A abordagem é a MESMA de `lib/conhecimento/boas-praticas.ts`, que já provou
 * funcionar em produção: filtro duro + pontuação determinística, com os sinais
 * estruturados valendo muito mais que a coincidência textual. Nada de LLM no
 * caminho da recuperação (custo por mensagem e latência num canal já lento).
 *
 * A diferença em relação às BPs é que aqui CADA resultado explica por que foi
 * escolhido (`motivos`) — sem isso não dá para calibrar a recuperação antes de
 * ligar na Ayla, que é justamente o ponto desta etapa.
 */

// ============================================================
// Entrada
// ============================================================

/**
 * O contexto estruturado da consulta. Todos os campos são opcionais: o
 * retriever tem que funcionar tanto com o contexto rico (perfil completo +
 * conversa) quanto com quase nada.
 */
export type ContextoBia = {
  /** Idade em ANOS. Convertida para meses internamente. */
  idadeAnos?: number | null;
  /** Alternativa direta, quando quem chama já tem meses. Tem precedência. */
  idadeMeses?: number | null;
  /** Perfil/diagnóstico como a família descreve ("TEA", "TDAH e dislexia"). */
  perfil?: string | null;
  /** Domínio do Kolo Vivo em foco ("comunicacao", "sono", "nutricional"). */
  dominio?: string | null;
  /** Situação do cotidiano ("escola", "banho", "refeicao"). */
  contexto?: string | null;
  /** A dificuldade relatada, nas palavras da família. */
  dificuldade?: string | null;
  /** O que a família quer alcançar. */
  objetivo?: string | null;
  /** O trecho relevante da conversa — o sinal textual mais forte. */
  textoDaConversa?: string | null;
};

/** O subconjunto de colunas que a pontuação precisa. */
export type ChunkParaPontuar = Pick<
  BiaChunk,
  | "id"
  | "nucleo"
  | "secao"
  | "titulo"
  | "tipo_conhecimento"
  | "faixa_etaria_min_meses"
  | "faixa_etaria_max_meses"
  | "faixa_rotulo"
  | "situacoes_relacionadas"
  | "diagnosticos_relacionados"
  | "nivel_de_cautela"
  | "muda_conduta"
  | "texto_original"
  | "revisao_pendente"
  | "ordem"
>;

// ============================================================
// Saída — o "por que foi selecionado"
// ============================================================

export type CodigoMotivo =
  | "dominio"
  | "faixa_etaria"
  | "situacao"
  | "diagnostico"
  | "tipo"
  | "muda_conduta"
  | "texto"
  | "sinal_de_alerta"
  | "penalidade";

/**
 * Um motivo é estruturado (código + peso) E legível (descrição). O código serve
 * para o teste automatizado assertar; a descrição, para a Karina ler na
 * ferramenta manual e dizer "esse resultado não faz sentido".
 */
export type MotivoSelecao = {
  codigo: CodigoMotivo;
  descricao: string;
  peso: number;
};

export type ResultadoBia = {
  chunk: ChunkParaPontuar;
  score: number;
  motivos: MotivoSelecao[];
  /** Uma linha legível — o resumo dos motivos, para log e para a CLI. */
  explicacao: string;
};

// ============================================================
// Pesos — num lugar só, para poder calibrar sem caçar código
// ============================================================

export const PESOS = {
  /** O sinal mais forte: o núcleo é exatamente o domínio em foco. */
  dominioExato: 50,
  /** Faixa etária ESPECÍFICA compatível vale mais que faixa aberta: um
   *  conhecimento escrito para 3-5 anos é mais preciso que o geral do núcleo. */
  faixaEspecifica: 12,
  /** Situação do cotidiano bate ("escola", "banho"). Até 2 contam. */
  situacao: 25,
  /**
   * Diagnóstico declarado bate. Medido no corpus real (30/07): só 3% dos chunks
   * declaram `tea` — é um sinal forte no geral. Mas DENTRO do núcleo de
   * Comunicação são 48%, então lá ele quase não discrimina. Por isso vale menos
   * que o tipo: senão um chunk que só MENCIONA autismo passa na frente do que
   * responde à pergunta.
   */
  diagnostico: 10,
  /** Tipos acionáveis valem mais — é o que a BIA tem de melhor e o que
   *  diferencia a BIA das Boas Práticas (raciocínio × receita). */
  tipo: {
    regra_operacional: 18,
    pergunta_investigativa: 15,
    interpretacao: 12,
    estrategia: 12,
    principio_de_ouro: 8,
    sinal_de_alerta: 6,
    encaminhamento: 6,
    explicacao_para_familia: 5,
    conceito: 2,
    fundamento: 2,
    orientacao_para_escola: 2,
    ferramenta: 2,
    brincadeira: 0,
    atividade: 0,
    cautela_cientifica: 0,
  } as Record<BiaTipoConhecimento, number>,
  /** A pergunta declara que a resposta MUDA a conduta. É o mesmo critério do
   *  decisor de entrega e do freio anti-anamnese do Core: pergunta que não muda
   *  conduta não deve ser feita. */
  mudaConduta: 10,
  /**
   * Coincidência textual, por COBERTURA da pergunta — não por contagem bruta.
   *
   * Calibrado com evidência (30/07): na primeira versão o texto valia 1 ponto
   * por termo e rendia +2 a +4, contra +50 do domínio. Resultado medido na
   * bancada: DENTRO de um núcleo o texto da conversa não discriminava nada, e a
   * regra que respondia exatamente à pergunta ("SE a criança puxa a mão do
   * adulto…") perdia para um chunk genérico que só mencionava autismo. Um
   * retriever em que a pergunta quase não pesa não é um retriever.
   *
   * Contar COBERTURA (quantos termos da pergunta o chunk cobre, sobre o total
   * perguntado) em vez de ocorrências evita o outro erro: premiar o chunk longo
   * só porque ele tem mais palavras.
   */
  textoCoberturaTitulo: 20,
  textoCoberturaCorpo: 22,
  /** Teto da contribuição textual — nunca ultrapassa o peso do domínio. */
  textoMaximo: 38,
  /** Conteúdo de encaminhamento fora de um contexto de risco: rebaixado com
   *  força para não virar alarme em conversa de rotina — mas NÃO excluído, para
   *  não esconder informação de segurança quando nada mais existir. */
  encaminhamentoSemSinal: -40,
  /** O mesmo conteúdo QUANDO há sinal de risco: sobe na frente de tudo. */
  encaminhamentoComSinal: 60,
  /** Cautela alta em contexto comum. */
  cautelaAlta: -15,
  /** A Parte I ("Fundamentos de condução") já está no Core da Ayla, em prosa
   *  (lib/conducao/diretrizes.ts). Devolvê-la seria a Ayla recuperando a
   *  própria identidade como se fosse conhecimento externo. */
  nucleoFundamentos: -25,
} as const;

/** Quantos resultados por padrão. */
export const LIMITE_PADRAO = 6;
/** Teto por tipo, para a saída não virar 6 regras e nenhuma pergunta. */
export const MAX_POR_TIPO_PADRAO = 3;

// ============================================================
// Texto
// ============================================================

/**
 * Stopwords. Duplicadas de `lib/conhecimento/boas-praticas.ts` DE PROPÓSITO: a
 * BIA precisa ser um módulo desacoplado, testável sozinho, sem puxar o
 * retriever das Boas Práticas junto. São duas listas que podem divergir sem
 * quebrar nada — e a lista é estável há meses.
 */
const STOP = new Set([
  "para","pela","pelo","como","que","com","uma","uns","umas","dos","das","por","nao",
  "sim","mas","ele","ela","eles","elas","meu","minha","seu","sua","isso","esse","essa",
  "aqui","ali","tem","ter","fazer","faz","esta","estao","muito","mais","menos","quando",
  "onde","porque","tudo","nada","todo","toda","ainda","ja","so","da","de","do","em","no",
  "na","os","as","um","e","o","a","eu","se","ao","aos","pra","pro","ta","vai","filho",
  "filha","crianca","criancas","dia","dias","vez","vezes","coisa","coisas",
  // Saudações e o próprio nome da Ayla. "ayla" aparece no corpus inteiro (o
  // documento fala DELA), então deixá-la valer como termo fazia "oi Ayla, tudo
  // bem?" casar com meio acervo e recuperar regra operacional aleatória.
  "ayla","kolo","oi","ola","bom","boa","tarde","noite","obrigada","obrigado","tudo","bem",
  // Palavras de ligação que sobravam e viravam "termo" na busca.
  "sem","nisso","nisto","disso","desse","dessa","nesse","nessa","tao","pouco","assim","algo",
]);

/**
 * Quantos termos a pergunta precisa ter para que a cobertura textual valha
 * cheia. Abaixo disso a cobertura é diluída (ver `pontuar`).
 */
const PISO_TERMOS_COBERTURA = 3;

export function termos(texto: string): Set<string> {
  return new Set(
    (texto ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !STOP.has(t)),
  );
}

/** Radical simples — casa "alimentacao" com "alimentar". Igual ao das BPs. */
function radical(t: string): string {
  return t.length > 5 ? t.slice(0, 5) : t;
}

// ============================================================
// Sinal de risco no contexto
// ============================================================

/**
 * O contexto sugere risco? É isto que decide se conteúdo de encaminhamento sobe
 * ou desce. Conservador: falso positivo custa um chunk de encaminhamento a
 * mais; falso negativo esconde informação de segurança de quem precisava.
 *
 * NÃO substitui o PISO do Core — o PISO age na RESPOSTA, sempre. Isto só ordena
 * a recuperação.
 */
export function contextoTemSinalDeRisco(ctx: ContextoBia): boolean {
  const texto = [ctx.textoDaConversa, ctx.dificuldade, ctx.contexto, ctx.objetivo]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  if (!texto.trim()) return false;
  return /\b(regress|perdeu|perda de habilidade|autoles|se machuc|se bat|bate a cabeca|nao come ha|nao dorme ha|emagrec|perdeu peso|engasg|convuls|desmai|sangr|dor forte|febre|bullying|abuso|risco|urgent|emergenc|socorro)/.test(
    texto,
  );
}

// ============================================================
// Normalização do contexto
// ============================================================

type ContextoNormalizado = {
  idadeMeses: number | null;
  nucleosDoDominio: BiaNucleo[];
  situacoes: string[];
  diagnosticos: string[];
  alvo: Set<string>;
  alvoRadical: Set<string>;
  temSinalDeRisco: boolean;
};

const DIAGNOSTICOS_CONHECIDOS: Array<[string, RegExp]> = [
  ["tea", /\btea\b|autis|espectro/],
  ["tdah", /\btdah\b|deficit de atencao|hiperativ/],
  ["dislexia", /dislex/],
  ["dispraxia", /disprax|coordenacao/],
  ["ansiedade", /ansiedade|\btag\b/],
];

export function normalizarContexto(ctx: ContextoBia): ContextoNormalizado {
  const idadeMeses =
    ctx.idadeMeses != null
      ? ctx.idadeMeses
      : ctx.idadeAnos != null
        ? Math.round(ctx.idadeAnos * 12)
        : null;

  // Domínio do Kolo Vivo → núcleos da BIA (o mapa vive em tipos.ts).
  const dominio = (ctx.dominio ?? "").trim().toLowerCase();
  const nucleosDoDominio = dominio
    ? BIA_NUCLEOS.filter((n) =>
        (BIA_NUCLEO_PARA_DOMINIOS[n] as readonly string[]).includes(dominio),
      )
    : [];

  const situacoes = (ctx.contexto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .split(/[,;/]|\s+e\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const perfilNorm = (ctx.perfil ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  const diagnosticos = DIAGNOSTICOS_CONHECIDOS.filter(([, re]) => re.test(perfilNorm)).map(
    ([nome]) => nome,
  );

  // O texto que conta para a coincidência textual. A conversa domina, mas a
  // dificuldade e o objetivo entram porque muitas vezes são o pedido real.
  const alvo = termos(
    [ctx.textoDaConversa, ctx.dificuldade, ctx.objetivo, ctx.contexto].filter(Boolean).join(" "),
  );

  return {
    idadeMeses,
    nucleosDoDominio,
    situacoes,
    diagnosticos,
    alvo,
    alvoRadical: new Set([...alvo].map(radical)),
    temSinalDeRisco: contextoTemSinalDeRisco(ctx),
  };
}

// ============================================================
// Filtros duros — exclusão, não penalidade
// ============================================================

export type MotivoExclusao =
  | "revisao_pendente"
  | "faixa_etaria"
  | "nao_usar_sem_contexto";

/**
 * O chunk está fora, e por quê? `null` = passou.
 *
 * Estes são inegociáveis, ao contrário dos pesos:
 *
 * 1. `revisao_pendente` — conteúdo que o importer não conseguiu classificar com
 *    segurança. NUNCA sai daqui. Deixar passar seria servir chute com cara de
 *    conhecimento curado, que é o pior resultado possível.
 * 2. Faixa etária incompatível — a mesma semântica das Boas Práticas.
 * 3. `nao_usar_sem_contexto` sem o domínio explícito — o próprio nome do nível
 *    diz o que fazer.
 */
export function filtrarDuro(
  chunk: ChunkParaPontuar,
  ctx: ContextoNormalizado,
): MotivoExclusao | null {
  if (chunk.revisao_pendente) return "revisao_pendente";
  if (!faixaServe(chunk, ctx.idadeMeses)) return "faixa_etaria";
  if (
    chunk.nivel_de_cautela === "nao_usar_sem_contexto" &&
    !ctx.nucleosDoDominio.includes(chunk.nucleo)
  ) {
    return "nao_usar_sem_contexto";
  }
  return null;
}

// ============================================================
// Pontuação
// ============================================================

/** Pontua um chunk. `null` quando ele foi excluído por filtro duro. */
export function pontuar(
  chunk: ChunkParaPontuar,
  ctx: ContextoNormalizado,
): { score: number; motivos: MotivoSelecao[] } | null {
  if (filtrarDuro(chunk, ctx)) return null;

  const motivos: MotivoSelecao[] = [];
  let score = 0;

  const add = (codigo: CodigoMotivo, descricao: string, peso: number) => {
    if (peso === 0) return;
    score += peso;
    motivos.push({ codigo, descricao, peso });
  };

  // ----- Estruturado: domínio -----
  if (ctx.nucleosDoDominio.includes(chunk.nucleo)) {
    add(
      "dominio",
      `corresponde ao domínio ${BIA_NUCLEO_LABEL[chunk.nucleo]}`,
      PESOS.dominioExato,
    );
  }

  // ----- Estruturado: faixa etária -----
  if (ctx.idadeMeses != null) {
    const especifica =
      chunk.faixa_etaria_min_meses != null || chunk.faixa_etaria_max_meses != null;
    if (especifica) {
      add(
        "faixa_etaria",
        `faixa etária compatível (${chunk.faixa_rotulo ?? "específica"})`,
        PESOS.faixaEspecifica,
      );
    }
  }

  // ----- Estruturado: situação do cotidiano -----
  const situacoesQueBatem = chunk.situacoes_relacionadas.filter((s) =>
    ctx.situacoes.some((alvo) => alvo.includes(s) || s.includes(alvo)),
  );
  for (const s of situacoesQueBatem.slice(0, 2)) {
    add("situacao", `situação "${s}"`, PESOS.situacao);
  }

  // ----- Estruturado: diagnóstico -----
  const diagQueBatem = chunk.diagnosticos_relacionados.filter((d) =>
    ctx.diagnosticos.includes(d),
  );
  if (diagQueBatem.length > 0) {
    add("diagnostico", `perfil ${diagQueBatem.join("/").toUpperCase()}`, PESOS.diagnostico);
  }

  // ----- Estruturado: tipo de conhecimento -----
  const pesoTipo = PESOS.tipo[chunk.tipo_conhecimento] ?? 0;
  add("tipo", rotuloTipo(chunk.tipo_conhecimento), pesoTipo);

  if (chunk.muda_conduta === true) {
    add("muda_conduta", "a resposta muda a conduta", PESOS.mudaConduta);
  }

  // ----- Textual, por cobertura da pergunta -----
  if (ctx.alvo.size > 0) {
    const doTitulo = termos(`${chunk.titulo ?? ""} ${chunk.secao ?? ""}`);
    const doCorpo = termos(chunk.texto_original);
    const radicaisCorpo = new Set([...doCorpo].map(radical));

    let noTitulo = 0;
    let noCorpo = 0;
    const casados: string[] = [];

    // Percorre os termos DA PERGUNTA (não os do chunk): é a cobertura do que
    // foi perguntado que interessa, e isso independe do tamanho do chunk.
    for (const t of ctx.alvo) {
      if (doTitulo.has(t)) {
        noTitulo += 1;
        casados.push(t);
      } else if (doCorpo.has(t) || radicaisCorpo.has(radical(t))) {
        noCorpo += 1;
        casados.push(t);
      }
    }

    // Divisor com PISO: cobrir "o único termo da pergunta" não é o mesmo que
    // cobrir a pergunta. Sem o piso, um relato de uma palavra saturava a
    // cobertura em 100% e dava pontuação textual cheia para qualquer chunk que
    // contivesse aquela palavra — foi assim que uma saudação recuperou regra
    // operacional. Com o piso, relato curto rende pouco ponto textual, que é o
    // certo: ainda não há sinal suficiente para afirmar pertinência.
    const divisor = Math.max(ctx.alvo.size, PISO_TERMOS_COBERTURA);
    const pontosTexto = Math.min(
      (noTitulo / divisor) * PESOS.textoCoberturaTitulo +
        (noCorpo / divisor) * PESOS.textoCoberturaCorpo,
      PESOS.textoMaximo,
    );

    if (pontosTexto >= 1) {
      add(
        "texto",
        `correspondência textual (${casados.slice(0, 4).join(", ")})`,
        Math.round(pontosTexto),
      );
    }
  }

  // ----- Prioridade / segurança -----
  const ehEncaminhamento =
    chunk.nivel_de_cautela === "requer_encaminhamento" ||
    chunk.tipo_conhecimento === "encaminhamento" ||
    chunk.tipo_conhecimento === "sinal_de_alerta";

  if (ehEncaminhamento) {
    if (ctx.temSinalDeRisco) {
      add("sinal_de_alerta", "há sinal de risco no contexto", PESOS.encaminhamentoComSinal);
    } else {
      add(
        "penalidade",
        "conteúdo de encaminhamento sem sinal de risco no contexto",
        PESOS.encaminhamentoSemSinal,
      );
    }
  } else if (chunk.nivel_de_cautela === "alto") {
    add("penalidade", "cautela alta", PESOS.cautelaAlta);
  }

  if (chunk.nucleo === "fundamentos") {
    add("penalidade", "a Parte I já vive no Core da Ayla", PESOS.nucleoFundamentos);
  }

  return { score, motivos };
}

function rotuloTipo(tipo: BiaTipoConhecimento): string {
  const rotulos: Record<BiaTipoConhecimento, string> = {
    fundamento: "fundamento",
    conceito: "conceito",
    pergunta_investigativa: "pergunta investigativa",
    interpretacao: "interpretação de resposta",
    estrategia: "estratégia",
    regra_operacional: "regra operacional (SE/ENTÃO)",
    principio_de_ouro: "princípio de ouro",
    explicacao_para_familia: "explicação para a família",
    orientacao_para_escola: "orientação para a escola",
    sinal_de_alerta: "sinal de alerta",
    encaminhamento: "encaminhamento",
    brincadeira: "brincadeira",
    atividade: "atividade",
    ferramenta: "ferramenta",
    cautela_cientifica: "cautela científica",
  };
  return rotulos[tipo] ?? tipo;
}

// ============================================================
// Seleção
// ============================================================

export type OpcoesSelecao = {
  limite?: number;
  /** Teto por tipo de conhecimento — garante variedade na saída. */
  maxPorTipo?: number;
  /** Score mínimo. Abaixo disso o chunk não ajuda o suficiente. */
  scoreMinimo?: number;
};

/**
 * Ordena, diversifica e corta.
 *
 * A diversificação existe por um motivo concreto: `regra_operacional` tem o
 * maior peso de tipo e é o tipo mais numeroso do corpus (285 de 1120). Sem teto
 * por tipo, a saída seria seis regras e nenhuma pergunta investigativa — o
 * oposto do que o decisor de entrega precisaria.
 */
export function selecionar(
  chunks: ChunkParaPontuar[],
  ctx: ContextoBia,
  opcoes: OpcoesSelecao = {},
): ResultadoBia[] {
  const limite = opcoes.limite ?? LIMITE_PADRAO;
  const maxPorTipo = opcoes.maxPorTipo ?? MAX_POR_TIPO_PADRAO;
  const scoreMinimo = opcoes.scoreMinimo ?? 1;

  const normalizado = normalizarContexto(ctx);

  const pontuados: ResultadoBia[] = [];
  for (const chunk of chunks) {
    const p = pontuar(chunk, normalizado);
    if (!p) continue;
    if (p.score < scoreMinimo) continue;
    pontuados.push({
      chunk,
      score: p.score,
      motivos: p.motivos,
      explicacao: explicar(p.motivos),
    });
  }

  // Ordem estável: score desc, depois a ordem no documento (preserva a
  // sequência narrativa entre chunks empatados).
  pontuados.sort((a, b) => b.score - a.score || a.chunk.ordem - b.chunk.ordem);

  const porTipo = new Map<string, number>();
  const saida: ResultadoBia[] = [];
  for (const r of pontuados) {
    if (saida.length >= limite) break;
    const t = r.chunk.tipo_conhecimento;
    const n = porTipo.get(t) ?? 0;
    if (n >= maxPorTipo) continue;
    porTipo.set(t, n + 1);
    saida.push(r);
  }
  return saida;
}

/** Os motivos numa linha só — para log e para a ferramenta manual. */
export function explicar(motivos: MotivoSelecao[]): string {
  return motivos
    .slice()
    .sort((a, b) => b.peso - a.peso)
    .map((m) => (m.peso < 0 ? `${m.descricao} (${m.peso})` : m.descricao))
    .join(" · ");
}
