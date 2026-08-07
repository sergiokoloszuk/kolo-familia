import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { contarAutorizadas, classificarFalha } from "./diagnostico";

/**
 * A ROTA QUE PROVA A CHAVE — e que, por isso, não pode mentir.
 *
 * Ela existe pra ser aberta uma vez, no meio de uma ativação, por alguém que
 * vai decidir "posso seguir?" com base no que estiver na tela. Um número errado
 * aqui vale mais que um bug comum: leva a ligar o GPT achando que a
 * configuração chegou quando não chegou.
 */

const SRC = readFileSync(resolve(__dirname, "route.ts"), "utf8");
const DIAG = readFileSync(resolve(__dirname, "diagnostico.ts"), "utf8");
/** O código sem comentários — o cabeçalho CITA os segredos pra dizer que eles
 *  não saem daqui, e uma busca ingênua leria a explicação como violação. */
const CODIGO = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// ============================================================
// CONTAGEM DA ALLOWLIST — o número que decide "posso seguir?"
// ============================================================

describe("familias_autorizadas_no_teste", () => {
  // UUIDs SINTÉTICOS. A allowlist de verdade vive na variável de ambiente e não
  // pode encostar no repositório — que é público. O que estes testes medem é a
  // CONTAGEM (únicos, espaços, entradas vazias), e pra isso qualquer uuid bem
  // formado serve: o valor não participa da regra.
  const A = "aaaaaaaa-0000-4000-8000-000000000001";
  const B = "bbbbbbbb-0000-4000-8000-000000000002";
  const C = "cccccccc-0000-4000-8000-000000000003";

  it("três ids → 3", () => {
    expect(contarAutorizadas(`${A},${B},${C}`)).toBe(3);
  });

  it("espaços, vírgulas sobrando e quebras de linha não inventam famílias", () => {
    expect(contarAutorizadas(` ${A} , ${B},${C} `)).toBe(3);
    expect(contarAutorizadas(`${A},,${B},${C},`)).toBe(3);
    expect(contarAutorizadas(`${A}\n${B}\n${C}`)).toBe(3);
  });

  it("id repetido conta UMA vez", () => {
    // Sem isto, um copiar-colar duplicado mostraria 4 quando são 3 — e a
    // conferência "bate com o que eu configurei?" mentiria justamente no caso
    // em que alguém errou a lista.
    expect(contarAutorizadas(`${A},${B},${A},${C}`)).toBe(3);
    expect(contarAutorizadas(`${A}, ${A}`)).toBe(1);
  });

  it("vazia ou ausente → 0, que é o diagnóstico de 'a env não chegou'", () => {
    for (const v of ["", "   ", ",", ",,, ,", undefined, null]) {
      expect(contarAutorizadas(v), String(v)).toBe(0);
    }
  });
});

// ============================================================
// CLASSIFICAÇÃO DA FALHA — cada uma tem uma saída diferente
// ============================================================

describe("classe da falha", () => {
  it("chave inválida", () => {
    for (const m of [
      "openai 401: Incorrect API key provided",
      "openai 401: invalid_api_key",
      "openai 500: authentication error",
    ]) {
      expect(classificarFalha(m), m).toBe("chave");
    }
  });

  it("modelo fora do projeto da chave — o caso que motivou a rota", () => {
    // `sk-proj-*` tem escopo por projeto: dá pra ter imagem e transcrição
    // (que o produto já usa) e NÃO ter o modelo de texto.
    for (const m of [
      "openai 404: The model `gpt-5.6-luna` does not exist",
      "openai 404: model_not_found",
      "openai 403: Project does not have access to model",
    ]) {
      expect(classificarFalha(m), m).toBe("modelo");
    }
  });

  it("quota e rate limit", () => {
    for (const m of [
      "openai 429: Rate limit reached",
      "openai 429: You exceeded your current quota",
      "openai 400: insufficient_quota",
    ]) {
      expect(classificarFalha(m), m).toBe("quota");
    }
  });

  it("o resto é técnica — nunca vira 'chave' por acidente", () => {
    for (const m of ["fetch failed", "openai 503: overloaded", "socket hang up", ""]) {
      expect(classificarFalha(m), m).toBe("tecnica");
    }
  });
});

// ============================================================
// O QUE A ROTA NÃO PODE FAZER
// ============================================================

describe("segredo e dado pessoal nunca saem daqui", () => {
  it("nenhum secret entra na resposta", () => {
    // A rota lê a EXISTÊNCIA da chave (`Boolean(process.env[...])`), nunca o
    // valor. Qualquer uso do valor num objeto de resposta é o bug que este
    // teste existe pra impedir.
    expect(CODIGO).toMatch(/chavePresente = Boolean\(process\.env\[envDaChave\]\)/);
    expect(CODIGO).not.toMatch(/process\.env\.OPENAI_API_KEY|process\.env\.ANTHROPIC_API_KEY/);
    expect(CODIGO).not.toMatch(/apiKey|Authorization|Bearer/);
  });

  it("os ids da allowlist não são devolvidos — só a contagem", () => {
    // `contarAutorizadas` devolve number. A variável bruta não pode aparecer
    // em nenhum objeto de resposta.
    expect(CODIGO).toMatch(/contarAutorizadas\(process\.env\.OPENAI_TEST_FAMILY_IDS\)/);
    expect(CODIGO).not.toMatch(/familias?[_a-z]*:\s*.*OPENAI_TEST_FAMILY_IDS/);
    expect(CODIGO).not.toMatch(/ids:|allowlist:|family_account_id/);
  });

  it("o módulo de diagnóstico também não toca em segredo nem em id", () => {
    // Ele recebe a string bruta da allowlist e devolve um número — nunca
    // guarda, loga ou reemite os ids que passaram por ele.
    expect(DIAG).not.toMatch(/console\.|process\.env|fetch\(/);
    expect(DIAG).toMatch(/export function contarAutorizadas\([^)]*\): number/);
  });

  it("a chamada de teste não usa dado de família", () => {
    // Sem núcleo, sem perfil, sem histórico: o que se prova aqui é a chave,
    // não a Ayla.
    expect(CODIGO).toMatch(/system: "Responda em uma palavra\."/);
    expect(CODIGO).not.toMatch(/nucleoConducao|buildContext|supabase|from\(/);
  });

  it("não polui o billing das famílias", () => {
    // O custo é CALCULADO e devolvido, nunca persistido: uma linha em
    // `api_calls` sem família apareceria no /admin/uso-api como consumo de
    // origem desconhecida, e um teste de chave não é conversa de ninguém.
    expect(CODIGO).toMatch(/calcularCustoTokens\(/);
    expect(CODIGO).not.toMatch(/logarUsoApi|api_calls|insert\(/);
  });
});

describe("acesso", () => {
  it("o gate de admin é a PRIMEIRA coisa, antes de gastar token", () => {
    const corpo = CODIGO.slice(CODIGO.indexOf("export async function GET"));
    const guarda = corpo.indexOf("ehAdmin()");
    const chamada = corpo.indexOf("gerarConversacional(");
    expect(guarda).toBeGreaterThan(-1);
    expect(chamada).toBeGreaterThan(-1);
    // Uma rota que chama a API antes de checar quem é seria um jeito de
    // qualquer um queimar a nossa quota.
    expect(guarda).toBeLessThan(chamada);
    expect(corpo).toMatch(/if \(!\(await ehAdmin\(\)\)\)/);
  });

  it("reusa o gate de admin do produto — não inventa auth", () => {
    expect(SRC).toMatch(/from "@\/lib\/auth\/require-admin"/);
    // `uso/snapshot` usa Bearer CRON_SECRET porque é cron. Esta rota é aberta
    // no NAVEGADOR, logada — um segredo em header não viria de uma sessão.
    expect(CODIGO).not.toMatch(/CRON_SECRET/);
  });
});

describe("reusa a camada de provider, não uma segunda implementação", () => {
  it("chama gerarConversacional, e não fetch direto na OpenAI", () => {
    expect(CODIGO).toMatch(/gerarConversacional\(/);
    expect(CODIGO).not.toMatch(/api\.openai\.com|fetch\(/);
  });

  it("o modelo vem da configuração do produto", () => {
    expect(CODIGO).toMatch(/MODELO_CONVERSA\[provider\]/);
    expect(CODIGO).not.toMatch(/"gpt-5\.6-luna"|"claude-sonnet/);
  });
});
