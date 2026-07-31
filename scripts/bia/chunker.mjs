/**
 * Chunker da BIA — texto puro → unidades de RACIOCÍNIO com metadados.
 *
 * Princípio que organiza tudo: a BIA não é prosa para ser recortada em pedaços
 * de N caracteres. O que faz ela valer é a REGRA (SE/ENTÃO), a PERGUNTA com sua
 * interpretação, e a CADEIA de hipóteses. Cortar por tamanho destruiria
 * exatamente isso. Então cada família de conteúdo tem sua própria granularidade:
 *
 *   regra SE/ENTÃO      → 1 regra = 1 chunk (atômico, foi escrito assim)
 *   pergunta investig.  → pergunta + "por que existe" + hipóteses + "muda
 *                         conduta" JUNTOS (separados viram interrogatório, que
 *                         é o que o FREIO ANTI-ANAMNESE do Core proíbe)
 *   estratégia          → com "quando NÃO funciona" e "erros comuns" juntos
 *                         (cortar o "quando não funciona" é perigoso)
 *   princípio de ouro   → 1 princípio = 1 chunk
 *   prosa               → blocos por subseção, sem quebrar par crença→reconstrução
 *
 * REGRA DE OURO DO IMPORTER: quando não dá pra classificar com segurança, ele
 * marca `revisao_pendente` — NUNCA chuta. Chute vira conhecimento errado servido
 * com cara de curado.
 */

import { createHash } from "node:crypto";

// ============================================================
// Normalização de marca
// ============================================================

/**
 * O documento carrega "Kolo Materno" como assinatura em alguns núcleos (Sono,
 * Rotina) — resíduo do material de origem. Aqui é SEMPRE Kolo Família. Isto
 * roda antes de qualquer coisa, pra a marca errada não chegar ao banco nem, no
 * futuro, a um prompt.
 */
export function normalizarMarca(texto) {
  return texto
    .replace(/Kolo\s+Materno/gi, "Kolo Família")
    // A assinatura costuma vir como "· Kolo Família Um guia feito com..."; não
    // dá pra remover o rodapé com segurança sem arriscar comer conteúdo, então
    // só a marca é corrigida. O resto é ruído inofensivo.
    .replace(/Especialista\s+em\s+Sono\s*·\s*Sono\s+Tranquilo/gi, "Sono e Descanso");
}

// ============================================================
// Núcleos — títulos do documento → chave canônica
// ============================================================

/** Ordem importa: o mais específico primeiro. */
const NUCLEOS = [
  [/^Parte\s+I\b|Fundamentos\s+de\s+condu[çc][ãa]o/i, "fundamentos"],
  [/^N[úu]cleo\s*1\b|Regula[çc][ãa]o\s+Emocional/i, "regulacao_emocional"],
  [/^N[úu]cleo\s*2\b|Sono\s+e\s+Descanso/i, "sono"],
  [/^N[úu]cleo\s*3\b|Alimenta[çc][ãa]o\s+e\s+Nutri[çc][ãa]o/i, "alimentacao"],
  [/^N[úu]cleo\s*4\b|Rotina,\s*Previsibilidade/i, "rotina"],
  [/^N[úu]cleo\s*5\b|Processamento\s+Sensorial/i, "sensorial"],
  [/^N[úu]cleo\s*6\b|^N[úu]cleo\s*\d+\s*-\s*Comunica[çc][ãa]o/i, "comunicacao"],
  [/^N[úu]cleo\s*7\b|Imita[çc][ãa]o\s+e\s+Aprendizado/i, "imitacao"],
  [/^N[úu]cleo\s*8\b|Socializa[çc][ãa]o\s+e\s+Conex[õo]es/i, "socializacao"],
  [/^N[úu]cleo\s*9\b|Desenvolvimento\s+Motor/i, "motor"],
  [/^N[úu]cleo\s*10\b|Autonomia\s+e\s+Atividades/i, "autonomia"],
  [/^N[úu]cleo\s*11\b|Aprendizagem\s+e\s+Constru[çc][ãa]o/i, "aprendizagem"],
  [/^N[úu]cleo\s*12\b|Foco,\s*Aten[çc][ãa]o\s+e\s+Fun[çc][õo]es/i, "foco_executivas"],
  [/Cap[íi]tulo\s+transversal|Pensamentos,\s*sentimentos/i, "pensamentos_crencas"],
  [/Cat[áa]logo\s+(completo\s+)?de\s+brincadeiras/i, "brincadeiras_atividades"],
];

/** Uma linha abre um núcleo novo? Devolve a chave, ou null. */
function nucleoDaLinha(linha) {
  // Só linhas curtas são título — parágrafo que MENCIONA "regulação emocional"
  // não abre núcleo. É o que evita o documento inteiro virar um núcleo só.
  if (linha.length > 90) return null;
  if (!/^(Parte\s+I|N[úu]cleo\s*\d+|Cap[íi]tulo\s+transversal|Anexo)/i.test(linha)) return null;
  for (const [re, chave] of NUCLEOS) {
    if (re.test(linha)) return chave;
  }
  return null;
}

// ============================================================
// Seções numeradas dentro do núcleo
// ============================================================

/**
 * "1. Princípios", "14. Conhecimento para IA", "TEMA 3 · A Luz e o Escuro",
 * "Capítulo 7 — Estratégias Práticas", "7.2 Imitar a criança primeiro".
 */
function secaoDaLinha(linha) {
  if (linha.length > 120) return null;
  const padroes = [
    /^(\d{1,2})\.\s+([A-ZÀ-Ú][^.]{3,110})$/, // "14. Conhecimento para IA"
    /^(\d{1,2}\.\d{1,2})\s+(.{3,110})$/, // "7.2 Imitar a criança primeiro"
    /^(TEMA\s+\d+)\s*[·:\-—]\s*(.{3,110})$/i,
    /^(Cap[íi]tulo\s+\d+)\s*[·:\-—]?\s*(.{3,110})$/i,
    /^(ESTRAT[ÉE]GIA\s+\d+)\s*[:\-—]\s*(.{3,110})$/i,
    /^(REGRA\s+\d+)\b/i,
  ];
  for (const re of padroes) {
    const m = linha.match(re);
    if (m) return linha.trim();
  }
  return null;
}

// ============================================================
// Faixa etária
// ============================================================

const FAIXAS = [
  [/\b0\s*[-–a]\s*1\s*ano/i, 0, 12, "0-1 ano"],
  [/\b0\s*[-–a]\s*2\s*anos?\b/i, 0, 24, "0-2 anos"],
  [/\b1\s*[-–a]\s*3\s*anos?\b/i, 12, 36, "1-3 anos"],
  [/\b3\s*[-–a]\s*5\s*anos?\b/i, 36, 60, "3-5 anos"],
  [/\b4\s*[-–a]\s*6\s*anos?\b/i, 48, 72, "4-6 anos"],
  [/\b6\s*[-–a]\s*8\s*anos?\b/i, 72, 96, "6-8 anos"],
  [/\b7\s*[-–a]\s*12\s*anos?\b/i, 84, 144, "7-12 anos"],
  [/\b9\s*[-–a]\s*12\s*anos?\b/i, 108, 144, "9-12 anos"],
  [/\b13\s*[-–a]\s*18\s*anos?\b/i, 156, 216, "13-18 anos"],
];

/** Detecta faixa etária no texto. Sem faixa = conhecimento geral do núcleo. */
function detectarFaixa(texto) {
  for (const [re, min, max, rotulo] of FAIXAS) {
    if (re.test(texto)) {
      return { min, max, rotulo };
    }
  }
  return { min: null, max: null, rotulo: null };
}

// ============================================================
// Tipo de conhecimento, a partir da seção
// ============================================================

/**
 * Mapa seção → tipo. Deliberadamente conservador: o que não casar aqui vira
 * `conceito` COM `revisao_pendente`, e não um tipo chutado.
 */
const TIPO_POR_SECAO = [
  // Os núcleos 1-4 (Regulação, Sono, Alimentação, Rotina) vêm de outra geração
  // de material: em vez de seções numeradas, têm "TEMA N · Assunto" com o
  // quarteto O que acontece / O que observar / Estratégias / Crença limitante.
  // É conteúdo legítimo, não seção desconhecida.
  [/^TEMA\s+\d+/i, "conceito"],
  [/conhecimento\s+para\s+ia|regras\s+cl[íi]nicas|regras\s+operacionais/i, "regra_operacional"],
  [/n[ãa]o\s+deve\s+responder/i, "regra_operacional"],
  [/princ[íi]pios?\s+de\s+ouro/i, "principio_de_ouro"],
  [/princ[íi]pios?\s+que\s+sustentam|^\d*\.?\s*princ[íi]pios/i, "fundamento"],
  [/perguntas?\s+investigativas?/i, "pergunta_investigativa"],
  [/como\s+interpretar\s+as\s+respostas|racioc[íi]nio\s+cl[íi]nico/i, "interpretacao"],
  [/cren[çc]as?\s+limitantes?/i, "interpretacao"],
  [/erros?\s+(comuns?\s+)?d[oa]s?\s+adultos?|interpreta[çc][õo]es\s+equivocadas/i, "interpretacao"],
  [/como\s+descobrir\s+onde\s+a\s+tarefa\s+se\s+rompe/i, "interpretacao"],
  // "Estratégias práticas", "Estratégias de ensino", "ESTRATÉGIA 4: Força Pesada".
  [/^\d*[\.\d]*\s*estrat[ée]gias?\b|estrat[ée]gias?\s+(pr[áa]ticas?|de\s+ensino)/i, "estrategia"],
  [/progress[õo]es\s+funcionais|n[íi]veis\s+de\s+ajuda/i, "estrategia"],
  [/quando\s+encaminhar|profissionais\s+(que|envolvidos)|limites\s+e\s+encaminhamentos?/i, "encaminhamento"],
  [/sinais?\s+de\s+alerta|sinais?\s+que\s+(exigem|merecem)|riscos?\s+e\s+limites/i, "sinal_de_alerta"],
  [/mecanismos?/i, "conceito"],
  [/orienta[çc][õo]es?\s+(ao|para\s+as?)\s+(cuidador|fam[íi]lia)/i, "explicacao_para_familia"],
  [/orienta[çc][ãa]o\s+para\s+professores?/i, "orientacao_para_escola"],
  [/tradu[çc][ãa]o\s+do\s+especialista|como\s+a\s+ayla\s+explica/i, "explicacao_para_familia"],
  // "O que normalmente preocupa os pais", "Dúvidas frequentes" — o que a família
  // traz, na língua dela. É material de acolhimento, não conceito clínico.
  [/preocupa\s+os\s+pais|d[úu]vidas?\s+frequentes?|preocupa[çc][õo]es\s+ocultas/i, "explicacao_para_familia"],
  [/materiais?\s+e\s+ferramentas?|timers?|tempo\s+visual/i, "ferramenta"],
  [/adapta[çc][ãa]o\s+por\s+idade|situa[çc][õo]es\s+do\s+cotidiano/i, "conceito"],
  // Seções de desenvolvimento/etapas/tipos — descritivas, não acionáveis.
  [/(desenvolvimento|aprendizagem).*(por\s+faixa\s+et[áa]ria)|^\d*[\.\d]*\s*tipos\s+de\b/i, "conceito"],
  [/etapas\s+do\s+processo|como\s+(este|o)\s+.{0,40}influencia/i, "conceito"],
  // Subseções que são só a faixa etária ("4.2 — 3–5 anos").
  [/^\d+\.\d+\s*[—–-]?\s*\d+\s*[–-]\s*\d+\s*anos/i, "conceito"],
  [/rela[çc][ãa]o\s+com\s+(os\s+)?outros\s+(dom[íi]nios|n[úu]cleos)|fronteiras?\s+do\s+n[úu]cleo/i, "regra_operacional"],
  [/brincadeiras?/i, "brincadeira"],
  [/atividades?/i, "atividade"],
];

// ============================================================
// Normalização estrutural do título
// ============================================================

/**
 * Numeração HIERÁRQUICA ("6.2", "1.7.3"), com ou sem separador depois.
 * Hierárquica é sempre editorial: ninguém escreve "6.2" como conteúdo.
 */
const NUM_HIERARQUICA = /^\s*\d+(?:\.\d+)+\s*\.?\s*[-–—―‒−·•:]?\s*/u;

/**
 * Numeração SIMPLES ("3."), e só quando vem seguida de marca editorial — ponto,
 * parêntese ou traço. Sem essa exigência, "5 sinais de alerta" perderia o 5 e
 * "2026 em revisão" viraria "em revisão": número que é conteúdo ficaria mutilado.
 */
const NUM_SIMPLES = /^\s*\d+\s*(?:[.)]|[-–—―‒−])\s*[-–—―‒−·•:]?\s*/u;

/**
 * O título sem os elementos editoriais do começo — SÓ PARA CLASSIFICAR.
 *
 * O título original continua inteiro no chunk (`secao`) e é ele que entra no
 * `hash`, então normalizar não move nenhum identificador.
 *
 * Existe porque os padrões de `TIPO_POR_SECAO` estão ancorados no começo do
 * texto e recebiam o título com a numeração colada. "1.7 — Tipos de Imitação"
 * não casava com a regra de "tipos de" por causa do travessão; "24. Como
 * descobrir onde a aprendizagem se rompe" não casava com a regra equivalente.
 * O resultado era tipo nulo → `conceito` com `revisao_pendente`, e 296 dos 298
 * bloqueados vieram daí.
 *
 * A alternativa seria repetir cada padrão com prefixos opcionais. Uma
 * normalização só é menos código e, principalmente, não precisa ser refeita a
 * cada formato editorial novo que a Karina usar.
 *
 * Cobre hífen (-), travessão (—), meia-risca (–), traço de figura (―), traço
 * de tabela (‒), sinal de menos (−), ponto médio (·), bala (•) e dois-pontos.
 */
export function tituloParaClassificar(secao) {
  if (!secao) return "";
  const original = String(secao).replace(/\s+/g, " ").trim();

  let t = original.replace(NUM_HIERARQUICA, "");
  if (t === original) t = original.replace(NUM_SIMPLES, "");
  t = t.replace(/\s+/g, " ").trim();

  // Sobrou pouco demais: era numeração e mais nada de útil. Fica o original —
  // classificar por um resto de duas letras seria pior que não classificar.
  return t.length >= 3 ? t : original;
}

/**
 * O texto PRESCREVE alguma coisa ao adulto?
 *
 * Serve para separar o que a normalização do título não resolve. Um título como
 * "6.2 — Neurônios-Espelho" ou "3.5 — Escola" não casa com nenhuma regra de
 * `TIPO_POR_SECAO` — não por causa do prefixo, mas porque é um título
 * EXPOSITIVO, e material expositivo é `conceito` por natureza, não por chute.
 *
 * O risco de aceitar isso em bloco seria uma seção acionável com título
 * idiossincrático virar `conceito` silenciosamente. Então quem decide não é o
 * título: é o CONTEÚDO. Se o texto dá ordem ao adulto (imperativo, proibição,
 * "sempre/nunca"), o tipo é de fato incerto e o chunk continua bloqueado para
 * revisão humana. Se o texto só descreve, `conceito` está correto.
 *
 * Deliberadamente conservador: na dúvida, PRESCREVE — o custo de segurar um
 * chunk descritivo a mais é zero, e o de liberar um prescritivo mal tipado não.
 */
function textoPrescreve(texto) {
  return (
    // Imperativo dirigido ao adulto, começando frase.
    /(^|[.!?;:\n]\s*)(fa[çc]a|evite|use|ofere[çc]a|permita|reduza|aumente|mantenha|espere|observe|comece|pare|tente|deixe|coloque|retire|prefira|ajuste|antecipe|avise|valide|nomeie|proponha|convide|separe|combine)\b/i.test(
      texto,
    ) ||
    // Proibição / obrigação explícita.
    /\b(nunca|jamais|sempre)\s+\w+|\bn[ãa]o\s+(fa[çc]a|force|insista|exija|obrigue|corrija|interrompa|castigue)\b/i.test(
      texto,
    ) ||
    /\b(deve[- ]se|é\s+preciso|é\s+necess[áa]rio|recomenda[- ]se|o\s+adulto\s+(deve|precisa))\b/i.test(
      texto,
    ) ||
    // Estrutura de regra explícita, que já tem tratamento próprio.
    /\bSE\b[^.]{0,120}\bENT[ÃA]O\b/i.test(texto)
  );
}

/**
 * @param secao    o título da seção
 * @param contexto o BLOCO em que ela está (ver `contextoDaLinha`). Necessário
 *   porque nos núcleos 1-4 os princípios vêm como títulos numerados comuns
 *   ("2. Seletividade não é teimosia — é proteção") e, sem saber que estão sob
 *   "Princípios que Sustentam Tudo", seriam indistinguíveis de qualquer outra
 *   seção numerada.
 */
export function tipoPorSecao(secao, contexto) {
  if (!secao) return null;
  if (contexto === "principios" && /^\d{1,2}\.\s/.test(secao)) return "fundamento";

  // O título CRU primeiro: alguns padrões dependem da numeração (a subseção que
  // é só faixa etária, "4.2 — 3–5 anos", vira "3–5 anos" depois de normalizada
  // e deixaria de casar). Assim, o que já classificava certo continua idêntico,
  // e a normalização só acrescenta.
  const normalizado = tituloParaClassificar(secao);
  for (const candidato of normalizado === secao ? [secao] : [secao, normalizado]) {
    for (const [re, tipo] of TIPO_POR_SECAO) {
      if (re.test(candidato)) return tipo;
    }
  }
  return null;
}

/**
 * Cabeçalhos que abrem um BLOCO (e não uma seção). Não geram chunk: só mudam
 * como as seções seguintes devem ser lidas.
 */
function contextoDaLinha(linha) {
  if (linha.length > 90) return null;
  if (/princ[íi]pios\s+que\s+sustentam/i.test(linha)) return "principios";
  if (/temas?\s+(pr[áa]ticos|do\s+dia\s+a\s+dia)|no\s+dia\s+a\s+dia\s*:/i.test(linha)) return "temas";
  return null;
}

// ============================================================
// Cautela
// ============================================================

const SINAIS_CAUTELA_ALTA =
  /medica[çc][ãa]o|medicamento|dosagem|diagn[óo]stico\s+de|autoles[ãa]o|suic[íi]d|CVV|SAMU|urg[êe]ncia|emerg[êe]ncia/i;
const SINAIS_CAUTELA_MODERADA =
  /c[ée]rebro|neur[oôa]|sistema\s+l[íi]mbico|amígdala|amigdala|cerebelo|t[áa]lamo|hormon|neuroplasticidade|\d+\s*%/i;

/**
 * Deriva a cautela. Conservador por construção: na dúvida SOBE o nível, nunca
 * desce. Um chunk classificado como mais cauteloso do que precisava custa uma
 * recuperação a menos; o contrário custa orientação clínica servida solta.
 */
function derivarCautela(tipo, texto) {
  if (tipo === "sinal_de_alerta" || tipo === "encaminhamento") return "requer_encaminhamento";
  if (SINAIS_CAUTELA_ALTA.test(texto)) return "alto";
  if (tipo === "cautela_cientifica") return "nao_usar_sem_contexto";
  if (SINAIS_CAUTELA_MODERADA.test(texto)) return "moderado";
  return "baixo";
}

// ============================================================
// Situações do cotidiano (para filtro de recuperação)
// ============================================================

const SITUACOES = [
  ["banho", /\bbanho\b|tomar\s+banho/i],
  ["refeicao", /\brefei[çc][ãa]o|hora\s+de\s+comer|à\s+mesa\b|almo[çc]o|jantar/i],
  ["sono", /hora\s+de\s+dormir|adormecer|despertar\s+noturno|rotina\s+noturna/i],
  ["escola", /\bescola\b|sala\s+de\s+aula|professor|recreio|refeit[óo]rio/i],
  ["transicao", /transi[çc][ãa]o|mudan[çc]a\s+de\s+atividade|sair\s+de\s+casa/i],
  ["tela", /\btelas?\b|tablet|televis[ãa]o|videogame/i],
  ["festa", /\bfesta\b|anivers[áa]rio/i],
  ["supermercado", /supermercado|shopping|mercado/i],
  ["irmaos", /\birm[ãa]os?\b|\birm[ãa]\b/i],
  ["vestir", /vestir|abotoar|z[íi]per|cadar[çc]o|roupa/i],
  ["banheiro", /banheiro|desfralde|descarga|higiene\s+[íi]ntima/i],
  ["parque", /parque|parquinho|escorregador|balan[çc]o/i],
  ["consulta", /consulta|dentista|pediatra/i],
  ["viagem", /viagem|viajar|f[ée]rias/i],
  ["brincar", /brincar|brincadeira|faz[-\s]de[-\s]conta/i],
];

function detectarSituacoes(texto) {
  return SITUACOES.filter(([, re]) => re.test(texto)).map(([nome]) => nome);
}

const DIAGNOSTICOS = [
  ["tea", /\bTEA\b|autis|espectro\s+autista/i],
  ["tdah", /\bTDAH\b|d[ée]ficit\s+de\s+aten[çc][ãa]o/i],
  ["dislexia", /dislexia/i],
  ["dispraxia", /dispraxia|transtorno\s+do\s+desenvolvimento\s+da\s+coordena/i],
  ["ansiedade", /ansiedade|\bTAG\b/i],
];

function detectarDiagnosticos(texto) {
  return DIAGNOSTICOS.filter(([, re]) => re.test(texto)).map(([nome]) => nome);
}

// ============================================================
// Extratores de estrutura interna
// ============================================================

/** Regras "SE ... ENTÃO ..." — cada uma é um chunk atômico. */
function extrairRegras(texto) {
  const regras = [];
  // As regras aparecem coladas em parágrafo corrido. Quebramos em cada "SE " que
  // inicia frase e exigimos um ENTÃO/ENTAO no corpo — sem o ENTÃO não é regra.
  const partes = texto.split(/(?=\bSE\s+[a-zà-úA-ZÀ-Ú])/);
  for (const p of partes) {
    const t = p.trim();
    if (!/^SE\s/i.test(t)) continue;
    if (!/\bENT[ÃA]O\b/i.test(t)) continue;
    if (t.length < 30) continue;
    // "SE ... ENTÃO ..." sem conteúdo depois do ENTÃO é gabarito, não regra.
    if (/\bENT[ÃA]O\.{2,}/i.test(t)) continue;
    regras.push(t.replace(/\s+/g, " ").trim());
  }
  return regras;
}

/**
 * Perguntas investigativas. A âncora é "Por que existe:" — o marcador que a BIA
 * usa consistentemente. A pergunta vem ANTES dele; a interpretação, depois.
 * Tudo isso é UM chunk.
 */
function extrairPerguntas(texto) {
  const perguntas = [];
  const partes = texto.split(/(?=(?:Pergunta\s+\d+|P\d\s*:|\d{1,2}[–-]\d{1,2}\s+anos\s+P\d)\s*:?)/i);
  for (const p of partes) {
    const t = p.trim();
    if (!/Por\s+que\s+existe\s*:/i.test(t)) continue;
    if (t.length < 60) continue;
    perguntas.push(t.replace(/\s+/g, " ").trim());
  }
  return perguntas;
}

/** "Muda conduta? Sim/Não" — o filtro anti-interrogatório da própria BIA. */
function detectarMudaConduta(texto) {
  const m = texto.match(/Muda\s+conduta\?\s*(Sim|N[ãa]o)/i);
    if (!m) return null;
  return /^s/i.test(m[1]);
}

/** Os 20 princípios de ouro — um por chunk. */
function extrairPrincipios(texto) {
  const out = [];
  const partes = texto.split(/(?=Princ[íi]pio\s+\d+)/i);
  for (const p of partes) {
    const t = p.trim();
    if (!/^Princ[íi]pio\s+\d+/i.test(t)) continue;
    if (t.length < 40) continue;
    out.push(t.replace(/\s+/g, " ").trim());
  }
  return out;
}

// ============================================================
// Gabarito não preenchido
// ============================================================

/**
 * Os núcleos 6 e 9 têm o BRIEFING de encomenda vazado no texto final ("Explique
 * de maneira simples...", "Formato obrigatório SE... ENTÃO..."). Isso não é
 * conhecimento — é o pedido que gerou o conhecimento. Entra marcado, nunca
 * ativo, pra a Karina decidir se completa ou descarta.
 */
const GABARITO = [
  /Explique\s+de\s+maneira\s+simples\s*$/im,
  /Formato\s+obrigat[óo]rio/i,
  /Para\s+cada\s+estrat[ée]gia\s+explique\s*$/im,
  /Escreva\s+exclusivamente\s+regras/i,
  /Liste\s+assuntos\s+que\s+pertencem/i,
  /Sempre\s+pergunte\s+a\s+si\s+mesmo/i,
  /N[ãa]o\s+economize\s+exemplos/i,
];

function pareceGabarito(texto) {
  return GABARITO.some((re) => re.test(texto));
}

// ============================================================
// Blocos de prosa
// ============================================================

const ALVO_PALAVRAS = 320;
const MAX_PALAVRAS = 520;
const MIN_PALAVRAS = 25;

/**
 * Prosa em blocos, quebrando SÓ em fronteira de parágrafo e nunca no meio de um
 * par crença→reconstrução (o "Desconstrução:"/"Reconstrução:" tem que ficar com
 * a crença que ele desfaz — separados, o chunk vira a crença errada solta).
 */
function blocosDeProsa(texto) {
  const paragrafos = texto
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const blocos = [];
  let atual = [];
  let palavras = 0;

  const fechar = () => {
    if (atual.length === 0) return;
    const t = atual.join("\n").trim();
    if (t.split(/\s+/).length >= MIN_PALAVRAS) blocos.push(t);
    atual = [];
    palavras = 0;
  };

  for (let i = 0; i < paragrafos.length; i++) {
    const p = paragrafos[i];
    const n = p.split(/\s+/).length;
    const proximo = paragrafos[i + 1] ?? "";
    // Não fecha se o próximo parágrafo é a reconstrução deste.
    const proximoEhPar = /^(Descontru|Desconstru|Reconstru|Realidade\s+Neurofuncional|Como\s+a\s+Ayla|Como\s+reconstruir)/i.test(
      proximo,
    );

    if (palavras + n > MAX_PALAVRAS && atual.length > 0) fechar();
    atual.push(p);
    palavras += n;
    if (palavras >= ALVO_PALAVRAS && !proximoEhPar) fechar();
  }
  fechar();
  return blocos;
}

// ============================================================
// Hash
// ============================================================

function hashDe(documento, nucleo, secao, texto) {
  return createHash("sha256")
    .update(`${documento}|${nucleo}|${secao ?? ""}|${texto}`)
    .digest("hex");
}

// ============================================================
// O chunker
// ============================================================

/**
 * Texto do documento → array de chunks prontos para a tabela `bia_chunks`.
 *
 * @param texto  saída de lerDocx()
 * @param meta   { documento_origem, versao_documento }
 */
export function chunkificar(texto, meta) {
  const documento = meta.documento_origem;
  const versao = meta.versao_documento;

  const linhas = normalizarMarca(texto).split("\n");

  // 1ª passada: fatiar em núcleos e seções, preservando a ordem.
  const fatias = [];
  let nucleoAtual = null;
  let secaoAtual = null;
  let contextoAtual = null;
  let buffer = [];

  const despejar = () => {
    if (!nucleoAtual || buffer.length === 0) {
      buffer = [];
      return;
    }
    const conteudo = buffer.join("\n").trim();
    if (conteudo) {
      fatias.push({
        nucleo: nucleoAtual,
        secao: secaoAtual,
        contexto: contextoAtual,
        texto: conteudo,
      });
    }
    buffer = [];
  };

  for (const linha of linhas) {
    // Cabeçalho/rodapé de página que a conversão deixou.
    if (/^KOLO\s+FAM[ÍI]LIA\s*\|\s*BIBLIOTECA/i.test(linha)) continue;
    if (/^P[áa]gina\s+\d+$/i.test(linha)) continue;

    const nucleo = nucleoDaLinha(linha);
    if (nucleo) {
      despejar();
      nucleoAtual = nucleo;
      secaoAtual = null;
      contextoAtual = null;
      continue;
    }
    const contexto = contextoDaLinha(linha);
    if (contexto && nucleoAtual) {
      despejar();
      contextoAtual = contexto;
      secaoAtual = null;
      continue;
    }
    const secao = secaoDaLinha(linha);
    if (secao && nucleoAtual) {
      despejar();
      secaoAtual = secao;
      continue;
    }
    buffer.push(linha);
  }
  despejar();

  // 2ª passada: cada fatia vira 1..N chunks, conforme a natureza do conteúdo.
  const chunks = [];
  let ordem = 0;

  const empurrar = (fatia, texto_original, tipo, extra = {}) => {
    const t = texto_original.trim();
    if (!t || t.split(/\s+/).length < MIN_PALAVRAS) return;

    const gabarito = pareceGabarito(t);
    const faixa = detectarFaixa(`${fatia.secao ?? ""} ${t}`);
    const tipoFinal = tipo ?? "conceito";

    chunks.push({
      documento_origem: documento,
      versao_documento: versao,
      pagina_origem: null,
      ordem: ordem++,
      titulo: fatia.secao ?? null,
      nucleo: fatia.nucleo,
      subnucleo: null,
      secao: fatia.secao ?? null,
      tipo_conhecimento: tipoFinal,
      faixa_etaria_min_meses: faixa.min,
      faixa_etaria_max_meses: faixa.max,
      faixa_rotulo: faixa.rotulo,
      publico: ["familia"],
      situacoes_relacionadas: detectarSituacoes(t),
      habilidades_relacionadas: [],
      diagnosticos_relacionados: detectarDiagnosticos(t),
      nucleos_relacionados: [],
      perguntas_investigativas: [],
      hipoteses: [],
      estrategias: [],
      o_que_evitar: [],
      quando_encaminhar: null,
      nivel_de_cautela: derivarCautela(tipoFinal, t),
      muda_conduta: null,
      texto_original: t,
      hash: hashDe(documento, fatia.nucleo, fatia.secao, t),
      // Revisão SÓ quando há sinal concreto de problema:
      //  (a) é gabarito de encomenda vazado, ou
      //  (b) a seção existe, nenhuma regra deu o tipo E o texto PRESCREVE algo
      //      ao adulto — aí `conceito` seria de fato um chute, sobre material
      //      acionável, que é o caso em que errar custa caro.
      // Seção sem regra mas com texto só descritivo NÃO é chute: material
      // expositivo é `conceito` por natureza. Marcar isso como revisão inflava
      // o número (296 de 298) e afogava os casos que precisam de olho humano.
      revisao_pendente: gabarito || Boolean(fatia.secao && !tipo && textoPrescreve(t)),
      revisao_motivo: gabarito
        ? "gabarito de encomenda não preenchido no documento"
        : fatia.secao && !tipo && textoPrescreve(t)
          ? `seção sem tipo ("${fatia.secao.slice(0, 60)}") e texto prescritivo — classificação ambígua`
          : null,
      ...extra,
    });
  };

  for (const fatia of fatias) {
    const tipoSecao = tipoPorSecao(fatia.secao, fatia.contexto);

    // (a) Regras SE/ENTÃO — atômicas, venham de onde vierem.
    const regras = extrairRegras(fatia.texto);
    for (const r of regras) {
      empurrar(fatia, r, "regra_operacional");
    }

    // (b) Perguntas investigativas — com a interpretação junto.
    const perguntas = tipoSecao === "pergunta_investigativa" ? extrairPerguntas(fatia.texto) : [];
    for (const p of perguntas) {
      empurrar(fatia, p, "pergunta_investigativa", {
        muda_conduta: detectarMudaConduta(p),
      });
    }

    // (c) Princípios de ouro — um por chunk.
    const principios = tipoSecao === "principio_de_ouro" ? extrairPrincipios(fatia.texto) : [];
    for (const pr of principios) {
      empurrar(fatia, pr, "principio_de_ouro");
    }

    // (d) O que sobrou vira prosa, se sobrou alguma coisa relevante.
    const jaExtraido = regras.length + perguntas.length + principios.length;
    if (jaExtraido > 0) {
      // A seção já entregou suas unidades estruturadas. Reprocessar a prosa
      // inteira aqui duplicaria o mesmo conteúdo em dois chunks.
      continue;
    }
    for (const bloco of blocosDeProsa(fatia.texto)) {
      empurrar(fatia, bloco, tipoSecao);
    }
  }

  return chunks;
}

/** Estatísticas para conferência da importação (o `--dry` imprime isto). */
export function estatisticas(chunks) {
  const conta = (campo) => {
    const m = new Map();
    for (const c of chunks) m.set(c[campo], (m.get(c[campo]) ?? 0) + 1);
    return Object.fromEntries([...m.entries()].sort((a, b) => b[1] - a[1]));
  };
  const hashes = new Set(chunks.map((c) => c.hash));
  return {
    total: chunks.length,
    duplicados: chunks.length - hashes.size,
    revisao_pendente: chunks.filter((c) => c.revisao_pendente).length,
    por_nucleo: conta("nucleo"),
    por_tipo: conta("tipo_conhecimento"),
    por_cautela: conta("nivel_de_cautela"),
    com_faixa_etaria: chunks.filter((c) => c.faixa_rotulo).length,
    palavras_media: Math.round(
      chunks.reduce((s, c) => s + c.texto_original.split(/\s+/).length, 0) /
        Math.max(1, chunks.length),
    ),
  };
}
