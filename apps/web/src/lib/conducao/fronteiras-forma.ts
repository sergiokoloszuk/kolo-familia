/**
 * A REDE DE FORMA — 26/08/2026, missão P0 da conversa.
 *
 * ⚠️ POR QUE NÃO ENTRA EM `fronteiras.ts`. A rede de lá é de SEGURANÇA: quando
 * uma resposta atravessa a fronteira clínica ou a de diagnóstico e a
 * regeneração também falha, existe um PISO — uma resposta segura, escrita pela
 * própria fronteira, que substitui a original. Isso é correto lá: uma resposta
 * que afirma diagnóstico não pode sair de jeito nenhum.
 *
 * Aqui é outra coisa. Uma resposta longa demais, ou com duas perguntas, é uma
 * resposta PIOR — não uma resposta perigosa. Substituí-la por um piso genérico
 * trocaria conteúdo bom (utilidade 4,1 e segurança 4,6, MEDIDAS em 18 pares
 * reais de 17–26/08) por texto neutro. O modo de falha correto aqui é
 * **manter a primeira resposta**.
 *
 * Duas semânticas diferentes, dois registros. A rede de segurança roda PRIMEIRO
 * e continua intocada; esta roda depois, e nunca pode enfraquecê-la.
 *
 * ⚠️ NADA AQUI CHAMA MODELO NEM BANCO. São funções puras sobre o texto que já
 * está em memória — o mesmo instante em que a rede de segurança já inspeciona.
 * O custo de detectar é desprezível; o custo de REGENERAR é uma chamada a mais,
 * e é por isso que existe o modo `sombra` (ver `ModoForma`).
 *
 * BASELINE QUE ORIGINOU ESTA REDE (MEDI, 317 respostas do Oficial):
 *   · 26,5% das respostas com 2+ perguntas — o Core proíbe, e perde;
 *   · p50 = 666 caracteres, 38,5% acima de 800, máximo 3.376;
 *   · pior caso medido: 7 menus numerados antes da primeira orientação.
 */

/** Um achado de forma — o código vai pro log, o detalhe vai pra instrução. */
export type AchadoForma = {
  codigo: string;
  detalhe: string;
};

/**
 * ⚠️ SEM `piso`, E ISSO É O CONTRATO. Ver o cabeçalho: falha de forma degrada
 * para a resposta original, nunca para um texto substituto.
 */
export type FronteiraDeForma = {
  /** Vai pro log — é por aqui que se acompanha qual dispara mais. */
  nome: string;
  achar: (texto: string, contexto: ContextoDeForma) => AchadoForma[];
  instrucao: (achados: AchadoForma[]) => string;
};

/**
 * A NATUREZA DO TURNO — o que decide o teto de tamanho.
 *
 * ⚠️ TETO ÚNICO SERIA PIOR QUE TETO NENHUM. "Oi, boa tarde" e um pedido de
 * embasamento legal não podem caber na mesma régua: MEDI um caso real de 1.544
 * caracteres sobre leis de inclusão que é uma das melhores respostas da
 * amostra, e um de 620 caracteres respondendo "Sim conversa" que é das piores.
 * O que separa as duas não é o tamanho — é a proporção com o que foi pedido.
 */
export type NaturezaDoTurno = "simples" | "continuacao" | "orientacao" | "tecnico";

export type ContextoDeForma = {
  /** A mensagem da família neste turno — é ela que dá a proporção. */
  mensagem: string;
  /**
   * Já houve orientação prática nesta conversa? Decide se menu é permitido.
   * `true` libera o menu; `false` é o estado do começo, onde ele vira
   * interrogatório. Ver `FRONTEIRA_MENU_ANTES_DO_VALOR`.
   */
  jaHouveOrientacao: boolean;
};

/** Tetos por natureza, em caracteres. Referência inicial para teste. */
export const TETO: Record<NaturezaDoTurno, number> = {
  simples: 350,
  continuacao: 500,
  orientacao: 700,
  tecnico: 1200,
};

/**
 * PEDIDO EXPLICITAMENTE COMPLEXO — o único caso que compra teto maior.
 *
 * A lista é curta e concreta de propósito: são assuntos em que a resposta curta
 * é a resposta ruim (citar a lei errada é pior do que não citar). Qualquer
 * coisa fora daqui cai em `orientacao`.
 */
const PEDIDO_TECNICO =
  /\blei\b|\bleis\b|jurídic|advogad|laudo|relatóri|documento|ofício|perícia|direito (dele|dela|da|do)|LBI|estatuto|convênio|plano de saúde|medica(ção|mento)|bula|dosagem|receita/i;

/** Mensagem curta e sem pedido concreto: cumprimento, "ok", "sim", "obrigada". */
const MENSAGEM_MINIMA = 25;

/**
 * A natureza deste turno — determinística, sem modelo.
 *
 * ⚠️ NA DÚVIDA, `orientacao`. É o teto do meio: não estrangula o pedido
 * técnico (que sobe por regra explícita) nem deixa passar o excesso na resposta
 * a "oi". Errar para o meio é o erro barato.
 */
export function naturezaDoTurno(
  mensagem: string,
  /**
   * ⚠️ ESTE PARÂMETRO NASCEU DE UMA FALHA DE FIXTURE, e ela é instrutiva.
   *
   * A primeira versão olhava só o tamanho da mensagem. Com isso, "Já era
   * segunda vez" — 18 caracteres — caía em `simples` (teto 350), e a resposta
   * REAL que a auditoria classificou como forte (398 caracteres, usa a idade de
   * 11 anos para calibrar a conduta e faz UMA pergunta) era barrada.
   *
   * O erro era conceitual: mensagem curta não é sinônimo de turno pequeno.
   * "Sim", "Isso", "Já era segunda vez" são CONTINUAÇÕES de um assunto que já
   * está em pé — e continuação merece mais espaço que um cumprimento e menos
   * que um problema novo. Daí `continuacao`, com teto no meio.
   *
   * O sinal reusa o que o contexto já carrega: se já houve orientação nesta
   * conversa, uma mensagem curta é continuação, não abertura.
   */
  jaHouveOrientacao = false,
): NaturezaDoTurno {
  const m = (mensagem ?? "").trim();
  if (PEDIDO_TECNICO.test(m)) return "tecnico";
  // Pedido longo e detalhado também compra espaço: quem escreveu 400 caracteres
  // contando uma situação não recebe bem uma resposta de três linhas.
  if (m.length >= 400) return "tecnico";
  if (m.length <= MENSAGEM_MINIMA) {
    return jaHouveOrientacao ? "continuacao" : "simples";
  }
  return "orientacao";
}

/**
 * QUANTAS PERGUNTAS A AYLA REALMENTE FEZ.
 *
 * ⚠️ CONTAR `?` É O JEITO ERRADO, e foi por isso que a poda textual simples foi
 * recusada. Três fontes de `?` não são pergunta da Ayla:
 *
 *   1. FALA PRONTA — "diga: 'Você prefere agora ou em 5 minutos?'". A Ayla está
 *      dando à mãe uma frase para USAR. Contar isso puniria exatamente a
 *      prática que a auditoria classificou como o melhor do produto (utilidade
 *      4,1; a resposta mais forte da amostra entrega três falas prontas).
 *   2. URL — o link de acesso tem `?k=...`.
 *   3. MENU — "1. isso; 2. aquilo?" é interrogatório, e tem fronteira própria;
 *      contá-lo aqui faria as duas dispararem pelo mesmo defeito.
 *
 * O que sobra é pergunta de verdade: uma frase da Ayla, fora de citação, que
 * termina em `?`.
 */
export function perguntasReais(texto: string): string[] {
  let t = String(texto ?? "");
  // 2. URLs primeiro — senão o `?` da querystring vira "pergunta".
  t = t.replace(/https?:\/\/\S+/g, " ");
  // 1. Falas prontas: aspas retas, curvas e o travessão de citação do WhatsApp.
  t = t.replace(/["“”'‘’][^"“”'‘’]{0,400}["“”'‘’]/g, " ");
  // 3. Linhas de menu numerado saem antes da contagem.
  t = t
    .split(/\n/)
    .filter((l) => !/^\s*\d+\s*[.)]\s/.test(l))
    .join("\n");
  // Menu inline ("1. a; 2. b; 3. c") — remove o trecho a partir do primeiro item.
  // ⚠️ `[\s\S]*` e não `.*` com flag `s`: o alvo de compilação deste projeto é
  // anterior a es2018, e `dotAll` não existe lá (TS1501). O efeito é o mesmo.
  t = t.replace(/\b1\s*[.)]\s+[\s\S]*$/, " ");

  const frases = t.split(/(?<=[?])/);
  return frases
    .map((f) => f.trim())
    .filter((f) => f.endsWith("?") && f.replace(/[^A-Za-zÀ-ú]/g, "").length >= 3);
}

/**
 * ISTO É UM MENU DE ALTERNATIVAS?
 *
 * Três ou mais itens numerados — o formato exato do caso real que abriu esta
 * frente: uma mãe recebeu SETE menus consecutivos antes de qualquer ajuda e
 * respondeu com um dígito seis vezes seguidas, até parar de responder.
 *
 * ⚠️ TRÊS, e não dois: uma escolha binária em prosa ("prefere começar pelo
 * banho ou pelo jantar?") é condução legítima, não formulário.
 */
export function ehMenuDeAlternativas(texto: string): boolean {
  const t = String(texto ?? "");
  const emLinhas = (t.match(/^\s*\d+\s*[.)]\s+\S/gm) ?? []).length;
  if (emLinhas >= 3) return true;
  // Inline, que é como o caso real aparece: "1. isso; 2. aquilo; 3. outra".
  const inline = (t.match(/(?:^|[\s;])\d\s*[.)]\s+[^;\n]{3,}/g) ?? []).length;
  return inline >= 3;
}

/**
 * O CORPO PRINCIPAL É O MENU?
 *
 * Um menu no fim de uma resposta que JÁ ajudou é outra coisa — foi assim que um
 * caso real ofereceu uma "dança de despedida" concreta e só depois perguntou.
 * O que a fronteira barra é a resposta que é SÓ menu.
 */
function menuDominaAResposta(texto: string): boolean {
  const t = String(texto ?? "");
  if (!ehMenuDeAlternativas(t)) return false;
  // Quanto do texto está dentro dos itens numerados?
  const itens = t.match(/(?:^|[\s;])\d\s*[.)]\s+[^;\n]{3,}/g) ?? [];
  const dentro = itens.join("").length;
  return dentro >= t.length * 0.4;
}

// ============================================================
// As fronteiras
// ============================================================

/**
 * R2 — NO MÁXIMO UMA PERGUNTA, E QUE SEJA A QUE MUDA A CONDUTA.
 *
 * MEDI: 26,5% das respostas do Oficial trazem duas ou mais. O caso extremo da
 * amostra tem QUATRO numa resposta só, sobre uma criança que quebrou objetos e
 * acertou a vizinha — a mãe precisava de um próximo passo, e recebeu um
 * questionário no meio da orientação.
 */
export const FRONTEIRA_DUAS_PERGUNTAS: FronteiraDeForma = {
  nome: "forma_duas_perguntas",
  achar: (texto) => {
    const ps = perguntasReais(texto);
    if (ps.length <= 1) return [];
    return [
      {
        codigo: "perguntas_demais",
        detalhe: `${ps.length} perguntas: ${ps.map((p) => p.slice(0, 60)).join(" | ")}`,
      },
    ];
  },
  instrucao: () =>
    `# Refaça: uma pergunta só

Sua resposta anterior fez mais de uma pergunta. Reescreva mantendo TODO o conteúdo útil — a orientação, a fala pronta, a ressalva de segurança e o que já estava personalizado para esta criança — e deixe **uma única** pergunta: aquela cuja resposta mais mudaria a sua próxima orientação.

O resto não se perde: o que era pergunta secundária vira parte da orientação ("se for o caso de X, faça Y") ou fica para outro momento. Não encurte a ajuda para caber a pergunta; encurte as perguntas.`,
};

/**
 * R3 — NENHUM INTERROGATÓRIO ANTES DO VALOR.
 *
 * ⚠️ MENU NÃO É PROIBIDO. Depois que a família já recebeu algo aplicável, uma
 * lista curta às vezes é a forma MAIS leve de perguntar. O que esta fronteira
 * barra é a sequência que MEDI numa jornada real: menu → menu → menu → menu →
 * menu → menu → menu, e só então a primeira orientação.
 */
export const FRONTEIRA_MENU_ANTES_DO_VALOR: FronteiraDeForma = {
  nome: "forma_menu_antes_do_valor",
  achar: (texto, ctx) => {
    if (ctx.jaHouveOrientacao) return [];
    if (!menuDominaAResposta(texto)) return [];
    return [{ codigo: "menu_antes_do_valor", detalhe: "resposta é um menu de alternativas e ainda não houve orientação" }];
  },
  instrucao: () =>
    `# Refaça: ajude antes de perguntar

Sua resposta anterior é uma lista de alternativas para a pessoa escolher, e vocês ainda não chegaram a nenhuma ajuda concreta. Uma sequência de menus faz a conversa virar formulário — e quem está cansada responde com um número até parar de responder.

Reescreva em prosa:
- se o que você já sabe permite, entregue **uma** coisa aplicável hoje, mesmo pequena, dizendo que é um primeiro caminho e que dá para ajustar;
- se realmente falta a informação que decide a conduta, faça **uma** pergunta, em frase normal — e que seja uma pergunta que ajude a pessoa a reparar em algo concreto, não uma escolha entre opções abstratas.

Nada de listas numeradas de alternativas nesta resposta.`,
};

/**
 * R4 — A RESPOSTA PROPORCIONAL.
 *
 * ⚠️ O RISCO DESTA FRONTEIRA É O CONTRÁRIO DO DAS OUTRAS: as duas de cima
 * tiram coisa que sobra; esta pode tirar coisa que falta. Por isso a instrução
 * nomeia, item por item, o que NÃO pode sair — e por isso as fixtures de
 * não-regressão existem antes de ela ser ligada.
 */
export const FRONTEIRA_TAMANHO: FronteiraDeForma = {
  nome: "forma_tamanho",
  achar: (texto, ctx) => {
    const natureza = naturezaDoTurno(ctx.mensagem, ctx.jaHouveOrientacao);
    const teto = TETO[natureza];
    const n = String(texto ?? "").length;
    if (n <= teto) return [];
    return [
      {
        codigo: "longa_demais",
        detalhe: `${n} caracteres para um turno de natureza "${natureza}" (teto ${teto})`,
      },
    ];
  },
  instrucao: (achados) => {
    const d = achados[0]?.detalhe ?? "";
    return `# Refaça: mais curta, sem perder o que importa

Sua resposta anterior ficou longa demais para o WhatsApp (${d}). A menor resposta que realmente ajuda é melhor do que a resposta completa.

Condense mantendo, obrigatoriamente:
- a orientação principal — o que fazer, de forma concreta;
- qualquer ressalva de segurança ou de incerteza que você tenha feito;
- o que é específico desta criança e desta família;
- a fala pronta, quando ela é a parte que ajuda;
- o que observar, quando há de fato algo a decidir depois.

Corte o que é: repetição do que a pessoa acabou de contar, explicação que ela não pediu, alternativas que você mesma não recomendaria, e passos que não mudam nada hoje. Se precisar escolher, mantenha o passo prático e solte a explicação.`;
  },
};

/**
 * ORDEM IMPORTA, pelo mesmo motivo da rede de segurança: a regeneração recebe
 * UMA instrução por vez, e empilhar correções produz a resposta defensiva que
 * todas elas existem para evitar.
 *
 * A ordem é por dano à experiência, do maior para o menor:
 *   1. menu antes do valor — é o que fez uma mãe responder com dígitos e sumir;
 *   2. duas perguntas — carga sobre quem já está sobrecarregada;
 *   3. tamanho — piora a leitura, mas o conteúdo está lá.
 */
export const FRONTEIRAS_DE_FORMA: readonly FronteiraDeForma[] = [
  FRONTEIRA_MENU_ANTES_DO_VALOR,
  FRONTEIRA_DUAS_PERGUNTAS,
  FRONTEIRA_TAMANHO,
];

export type AtravessamentoDeForma = {
  fronteira: FronteiraDeForma;
  achados: AchadoForma[];
};

/**
 * A primeira fronteira de forma atravessada, ou `null` quando a resposta está
 * publicável. Puro: não lê banco, não chama modelo, não muta nada.
 */
export function formaAtravessada(
  texto: string,
  contexto: ContextoDeForma,
): AtravessamentoDeForma | null {
  if (!String(texto ?? "").trim()) return null;
  for (const fronteira of FRONTEIRAS_DE_FORMA) {
    const achados = fronteira.achar(texto, contexto);
    if (achados.length > 0) return { fronteira, achados };
  }
  return null;
}

/**
 * O MODO — e por que ele existe.
 *
 * ⚠️ REGENERAR CUSTA UMA CHAMADA DE MODELO. MEDI em produção: `msTotal` de 12 a
 * 26 segundos por turno, dominado pela recuperação de repertório. Se as
 * fronteiras dispararem nos 26,5% + 38,5% que o baseline sugere, um quarto das
 * conversas pagaria o dobro do tempo — e a tentativa de melhorar a experiência
 * teria piorado a experiência.
 *
 * `sombra` existe para responder ISSO antes de arriscar: detecta, registra e
 * **devolve a resposta original intacta**. Nenhuma família percebe diferença; a
 * taxa real de disparo passa a ser um número, e não um palpite.
 *
 *   off ...... nem detecta. É o produto de hoje, byte a byte.
 *   sombra ... detecta e registra. NÃO regenera, NÃO altera a resposta.
 *   ativo .... detecta, regenera UMA vez, e mantém a original se falhar.
 */
export type ModoForma = "off" | "sombra" | "ativo";

export function modoForma(): ModoForma {
  try {
    const v = (process.env.AYLA_FORMA_MODO ?? "").trim().toLowerCase();
    if (v === "ativo") return "ativo";
    if (v === "sombra") return "sombra";
    return "off";
  } catch {
    // Erro ao ler configuração nunca liga nada.
    return "off";
  }
}
