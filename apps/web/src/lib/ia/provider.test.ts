import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MODELO_CONVERSA, gerarConversacional } from "./provider";

/**
 * O PROVIDER SÓ PODE SER TRANSPORTE — 06/08/2026.
 *
 * Esta camada existe pra permitir a comparação Claude × GPT sem espalhar
 * `if (provider === …)` pelo produto. O risco dela é virar um segundo lugar
 * onde a Ayla é definida: aí passam a existir duas Aylas, uma por provider,
 * e elas divergem. Foi exatamente assim que a web ficou com um motor morto e
 * um vivo, e é o que estes testes impedem.
 */

const SRC = readFileSync(resolve(__dirname, "provider.ts"), "utf8");
/**
 * O CÓDIGO, sem os comentários. O cabeçalho CITA `nucleoConducao()` justamente
 * para dizer que ele fica de fora — e uma asserção ingênua sobre o arquivo
 * inteiro leria essa menção como se fosse um acoplamento.
 */
const CODIGO = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("nenhuma regra de negócio mora aqui", () => {
  it("não importa nada do domínio da Ayla", () => {
    const imports = CODIGO.match(/^import .*$/gm) ?? [];
    expect(imports).toHaveLength(0); // hoje: zero imports, só fetch
  });

  it("não conhece prompt, condução, prontidão nem artefato", () => {
    for (const proibido of [
      /nucleoConducao/,
      /diretrizes/,
      /prontidao/i,
      /formasDeEntrega/,
      /classificarIntencao/,
      /gerarPlano|gerarRotina|gerarHistoria/i,
      /fronteiraAtravessada/,
    ]) {
      expect(CODIGO).not.toMatch(proibido);
    }
  });

  it("não reescreve o system — só repassa", () => {
    // Se algum dia alguém "adaptar" o prompt por provider, a comparação deixa
    // de medir o modelo e passa a medir dois produtos diferentes.
    expect(SRC).toMatch(/text: e\.system/);
    expect(SRC).toMatch(/content: e\.system/);
    expect(SRC).not.toMatch(/e\.system\s*\.(replace|concat)|`\$\{e\.system\}/);
  });
});

describe("as quatro diferenças reais de API estão traduzidas", () => {
  it("system: parâmetro na Anthropic, mensagem na OpenAI", () => {
    expect(SRC).toMatch(/system: \[\s*\{/);
    expect(SRC).toMatch(/\{ role: "system", content: e\.system \}/);
  });

  it("teto de saída: max_tokens × max_completion_tokens", () => {
    expect(SRC).toMatch(/max_tokens: e\.maxTokens/);
    expect(SRC).toMatch(/max_completion_tokens: e\.maxTokens/);
  });

  it("texto: content[] × choices[0].message.content", () => {
    expect(SRC).toMatch(/j\.content \?\? \[\]/);
    expect(SRC).toMatch(/j\.choices\?\.\[0\]\?\.message\?\.content/);
  });

  it("uso: input_tokens × prompt_tokens, normalizados no MESMO campo", () => {
    expect(SRC).toMatch(/tokensIn: j\.usage\?\.input_tokens/);
    expect(SRC).toMatch(/tokensIn: j\.usage\?\.prompt_tokens/);
    expect(SRC).toMatch(/cacheRead: j\.usage\?\.cache_read_input_tokens/);
    expect(SRC).toMatch(/cacheRead: j\.usage\?\.prompt_tokens_details\?\.cached_tokens/);
  });

  it("cache write só existe na Anthropic — na OpenAI é 0, não undefined", () => {
    expect(SRC).toMatch(/cacheWrite: 0,/);
  });
});

describe("modelos", () => {
  it("o default é o de produção, e o env manda", () => {
    expect(MODELO_CONVERSA.anthropic).toBe(
      process.env.ANTHROPIC_MODEL_PRINCIPAL || "claude-sonnet-4-6",
    );
    expect(MODELO_CONVERSA.openai).toBe(process.env.OPENAI_MODEL_PRINCIPAL || "gpt-5.6-luna");
  });

  it("o modelo OpenAI é o que a bancada escolheu com medição", () => {
    expect(SRC).toMatch(/scripts\/bancada\/ab-conversa\/rodar\.mjs/);
  });
});

describe("erro não vira resposta vazia", () => {
  it("falha do provider levanta, não devolve texto em branco", () => {
    expect(SRC).toMatch(/if \(!r\.ok \|\| j\.error\) throw new ErroDeProvider/);
  });

  it("a mensagem de erro NÃO carrega a chave", () => {
    // O detalhe vem de `j.error.message`, nunca do header montado.
    expect(SRC).not.toMatch(/ErroDeProvider\([^)]*API_KEY/);
  });

  it("chave ausente não quebra a montagem — a API é quem recusa", async () => {
    const antes = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "";
    await expect(
      gerarConversacional({
        provider: "anthropic",
        model: "claude-sonnet-4-6",
        system: "oi",
        messages: [{ role: "user", content: "oi" }],
        maxTokens: 8,
      }),
    ).rejects.toThrow(/anthropic/);
    if (antes) process.env.ANTHROPIC_API_KEY = antes;
  });
});
