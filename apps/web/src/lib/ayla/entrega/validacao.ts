import {
  comoTextoParaFamilia,
  type TextoBruto,
  type TextoParaFamilia,
} from "./tipos";

/**
 * VALIDAÇÃO DA SAÍDA — ADR 0001, etapa 7 do pipeline.
 *
 * O que ela protege: o modelo às vezes escreve SOBRE a conversa em vez de
 * escrever PARA a mãe. "percebi uma inconsistência no prompt", "orientação da
 * Karina", "ela respondeu 1", "preciso ignorar aquilo" — tudo isso saiu no
 * WhatsApp de famílias reais.
 *
 * O que ela NÃO faz: mexer no sentido, no tom ou na voz. Ela aprova ou barra.
 * Reescrever seria a Validação opinando sobre conteúdo, que é responsabilidade
 * de outra camada (e de outra pessoa).
 *
 * PORQUE NÃO É SÓ BLACKLIST. Uma lista de frases erra dos dois lados: não pega
 * a variação ("segundo a Karina", "conforme orientado") e pega a mãe falando
 * normalmente ("ela respondeu que sim"). Então são quatro camadas:
 *
 *   1. ESTRUTURAL — a forma de bastidor (cabeçalho de log, JSON, rótulo
 *      "Assistant:", bloco de código com metadado). Independe de vocabulário.
 *   2. ORIGEM — quem produziu isto tinha permissão de falar com a família?
 *      Texto de ferramenta e erro interno não têm.
 *   3. DEFENSIVA — padrões de meta-discurso, sobre texto normalizado (sem
 *      acento, sem markdown, caixa única, espaços colapsados).
 *   4. FALLBACK — barrou, entra um texto neutro curto. A família nunca fica
 *      sem resposta e nunca sabe que houve filtro.
 *
 * A camada 3 é a que pode dar falso positivo, e é por isso que o modo padrão é
 * `observe`: ela registra o que barraria sem barrar, até termos medida. Ver
 * `modoValidacao()`.
 */

// ============================================================
// Normalização
// ============================================================

/**
 * Texto comparável: sem acento, sem markdown, caixa única, espaço colapsado.
 * "ORIENTAÇÃO  da  *Karina*" e "orientacao da karina" viram a mesma coisa.
 */
export function normalizarParaAnalise(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[*_`~#>]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

// ============================================================
// Camada 1 — estrutural
// ============================================================

const ESTRUTURAIS: ReadonlyArray<[string, RegExp]> = [
  ["rotulo_de_papel", /^\s*(assistant|system|user|ayla|human)\s*:/im],
  ["tag_interna", /<\/?(pensamento|thinking|scratchpad|system|instrucoes?|contexto|conhecimento_de_apoio|mensagem_da_mae|boas_praticas)\b/i],
  ["json_solto", /^\s*[{[][\s\S]{0,200}["'](tipo|kind|payload|status|error|codigo)["']\s*:/m],
  ["linha_de_log", /\[(ayla|bia|debug|info|warn|error|orchestrator)[:\]]/i],
  ["cabecalho_de_prompt", /^\s*#{1,3}\s*(prompt|system|instru[çc][õo]es|regras|contexto)\b/im],
];

// ============================================================
// Camada 3 — defensiva (meta-discurso)
// ============================================================

/**
 * Padrões de "a Ayla falando sobre a conversa em vez de conversar".
 *
 * Cada um roda sobre o texto JÁ normalizado — por isso são escritos sem acento
 * e em minúsculas. Ancorados o suficiente para não pegar fala normal: a mãe
 * dizendo "ela respondeu que sim" não casa com "ela respondeu 1".
 */
const DEFENSIVOS: ReadonlyArray<[string, RegExp]> = [
  // Referência ao próprio andaime.
  ["referencia_a_prompt", /\b(no|do|neste|nesse|meu|o)\s+prompt\b|\bprompt\s+(diz|pede|instrui|interno|do sistema)\b/],
  ["instrucao_de_sistema", /\b(instru(cao|coes)|orienta(cao|coes)|diretriz(es)?|regra)\s+(interna|do sistema|de sistema|recebida|dada)\b/],
  ["orientacao_nominal", /\b(orienta(cao|coes)|instru(cao|coes)|diretriz)\s+d[ao]\s+\w+/],
  ["inconsistencia_interna", /\b(percebi|notei|identifiquei|encontrei)\s+(uma?\s+)?(inconsistencia|conflito|contradicao|erro|problema)\b/],

  // Deliberação interna vazando.
  ["preciso_devo", /\b(preciso|devo|vou ter que|tenho que)\s+(ignorar|desconsiderar|seguir|aplicar|usar|responder|escolher|considerar)\b/],
  ["escolha_de_opcao", /\b(op(cao|coes)|alternativa)\s*\d\b|\bvou\s+(escolher|optar por|usar)\s+a?\s*(op(cao|coes)|alternativa)\b/],
  ["como_assistente", /\bcomo\s+(assistente|ia|modelo|sistema|llm)\b/],
  ["provavelmente_interno", /^\s*(provavelmente|talvez|imagino que)\b[^.!?]{0,80}(usuari|context|prompt|instru|model)/],

  // Terceira pessoa sobre a mãe / a conversa.
  ["terceira_pessoa_sobre_a_mae", /\b(a mae|o usuari[oa]|a usuaria|a familia|a pessoa)\s+(respondeu|disse|escreveu|perguntou|mencionou|relatou|informou)\b/],
  ["ela_respondeu_n", /\bela\s+respondeu\s+\d+\b/],
  ["analise_da_conversa", /\b(analisando|avaliando|considerando)\s+(a\s+)?(conversa|mensagem|resposta|historico|contexto)\b/],

  // Bastidor técnico.
  ["comentario_de_ferramenta", /\b(ferramenta|tool|funcao|api|endpoint|webhook)\s+(retornou|devolveu|falhou|foi chamada|nao respondeu)\b/],
  ["comentario_de_memoria", /\b(meu|no meu|do meu)\s+(contexto|historico|banco|base de dados|prompt)\b|\b(memoria|contexto|banco de dados|base de dados)\s+(interna|do sistema|nao (tem|possui|contem))\b/],
  ["comentario_de_modelo", /\b(modelo|token|temperatura|janela de contexto|chamada de ia)\b.{0,40}\b(gerou|falhou|estourou|limite)\b/],
];

export type AchadoValidacao = { camada: 1 | 2 | 3; codigo: string };

/** Roda os detectores. Não decide nada — só relata. */
export function analisar(texto: string): AchadoValidacao[] {
  const achados: AchadoValidacao[] = [];
  for (const [codigo, re] of ESTRUTURAIS) {
    if (re.test(texto)) achados.push({ camada: 1, codigo });
  }
  const norm = normalizarParaAnalise(texto);
  for (const [codigo, re] of DEFENSIVOS) {
    if (re.test(norm)) achados.push({ camada: 3, codigo });
  }
  return achados;
}

// ============================================================
// Modo
// ============================================================

export type ModoValidacao = "observe" | "enforce";

export const VALIDACAO_MODO_ENV = "AYLA_VALIDACAO_MODO";

/**
 * `observe` é o padrão, e é deliberado (ADR, etapa 3 da migração): o detector
 * defensivo é a única camada que pode dar falso positivo, e barrar uma resposta
 * boa é pior que o problema que estamos resolvendo. Em `observe` ele registra o
 * que barraria; medimos a taxa; então liga-se `enforce` por variável de
 * ambiente, sem tocar em código.
 *
 * As camadas 1 e 2 (estrutural e origem) NÃO dependem do modo — bloqueiam
 * sempre. Não há leitura em que um cabeçalho de log ou um erro interno de
 * ferramenta seja resposta legítima.
 */
export function modoValidacao(
  env: Record<string, string | undefined> = process.env,
): ModoValidacao {
  return (env[VALIDACAO_MODO_ENV] ?? "").trim().toLowerCase() === "enforce"
    ? "enforce"
    : "observe";
}

// ============================================================
// Fallback
// ============================================================

/**
 * Resposta neutra quando a original é barrada. Curta, na voz da Ayla, sem
 * pedir desculpa por algo que a família não viu e sem sugerir que houve erro.
 * É texto fixo do repositório — não vem do modelo, então não precisa de
 * validação.
 */
export const TEXTO_FALLBACK =
  "Tô aqui com você 🌿 Me conta um pouquinho mais sobre isso?";

export function fallbackSeguro(): TextoParaFamilia {
  return comoTextoParaFamilia(TEXTO_FALLBACK);
}

// ============================================================
// A decisão
// ============================================================

export type Veredito =
  | { ok: true; texto: TextoParaFamilia; achados: AchadoValidacao[] }
  | { ok: false; motivo: "bloqueado" | "vazio"; achados: AchadoValidacao[] };

export type OpcoesValidacao = {
  modo?: ModoValidacao;
  /**
   * A origem do texto. Camada 2: só o que a Ayla escreveu para a família pode
   * ser publicado. Texto de ferramenta chega como `ferramenta` e precisa ter
   * sido explicitamente marcado como publicável pela Montagem.
   */
  origem?: "modelo" | "ferramenta" | "operacional";
};

/**
 * Aprova ou barra. Nunca reescreve.
 *
 * `operacional` é o texto fixo do próprio repositório (filler, convite de
 * assinatura, fallback): não passou por modelo nenhum, então não há
 * meta-discurso possível — só a checagem estrutural, por segurança.
 */
export function validarSaida(
  bruto: TextoBruto | string,
  opcoes: OpcoesValidacao = {},
): Veredito {
  const texto = String(bruto ?? "").trim();
  if (!texto) return { ok: false, motivo: "vazio", achados: [] };

  const origem = opcoes.origem ?? "modelo";
  const modo = opcoes.modo ?? modoValidacao();
  const achados = analisar(texto);

  const estruturais = achados.filter((a) => a.camada === 1);
  const defensivos = achados.filter((a) => a.camada === 3);

  // Camada 1: bloqueia sempre, em qualquer modo. Não existe leitura em que um
  // cabeçalho de log seja resposta legítima.
  if (estruturais.length > 0) return { ok: false, motivo: "bloqueado", achados };

  // Camada 2: origem. Ferramenta não fala com a família por conta própria.
  if (origem === "ferramenta") return { ok: false, motivo: "bloqueado", achados };

  // Camada 3: só bloqueia em enforce.
  if (defensivos.length > 0 && modo === "enforce") {
    return { ok: false, motivo: "bloqueado", achados };
  }

  return { ok: true, texto: comoTextoParaFamilia(texto), achados };
}
