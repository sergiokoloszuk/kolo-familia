import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { apontaParaPendente } from "./rotina-retomada";

/**
 * ⚠️ O REPLAY OBRIGATÓRIO. Karina, 06/09/2026, produção:
 *
 *   15:01:09  Ayla: "Pronto! A rotina da Manu está montada"  ← e não estava
 *   17:14:17  Karina: "E agora?"
 *   17:14:23  Karina: "Consegue trazer?"
 *   17:14:38  Ayla: "Sobre quem você está falando? Mario ou Manu?"
 *
 * A conversa geral respondeu por cima de uma cobrança, com a rotina órfã na
 * mesa. Estes testes prendem as duas metades da correção: reconhecer a
 * cobrança, e não confundi-la com assunto novo.
 */
describe("REPLAY KARINA — as cinco cobranças da missão", () => {
  it.each(["E agora?", "Consegue trazer?", "Cadê?", "E as figuras?", "Não apareceu"])(
    "%s é reconhecida como cobrança",
    (t) => expect(apontaParaPendente(t)).toBe(true),
  );
});

describe("outras formas da mesma coisa — não é lista de cinco frases", () => {
  it.each([
    "cadê a rotina",
    "onde está?",
    "não chegou nada",
    "não recebi",
    "não abriu",
    "me manda",
    "consegue gerar?",
    "e aí?",
    "?",
    "E os cartões?",
  ])("%s também", (t) => expect(apontaParaPendente(t)).toBe(true));
});

describe("o que NÃO pode virar retomada", () => {
  it.each([
    // Assunto novo, mesmo curto.
    "Bom dia",
    "Ela dormiu bem hoje",
    "Obrigada!",
    "Tema princesa",
    "Quero uma rotina visual",
    // ⚠️ MENSAGEM LONGA É CONTEÚDO, não cobrança — mesmo começando com "e agora".
    "E agora eu não sei mais o que fazer, ela chorou a tarde inteira e eu já tentei de tudo que a gente conversou semana passada",
  ])("%s não dispara a retomada", (t) => expect(apontaParaPendente(t)).toBe(false));

  it("string vazia não dispara", () => {
    expect(apontaParaPendente("")).toBe(false);
    expect(apontaParaPendente(null)).toBe(false);
  });
});

/**
 * ⚠️ TESTE ESTRUTURAL — ele prende uma DECISÃO, não um comportamento.
 *
 * A missão exige que a inteligência de recuperação seja UMA função chamada de
 * dois lugares. Se alguém escrever uma segunda no cron, as duas divergem com o
 * tempo e a divergência aparece na tela de uma mãe. Este teste quebra nesse dia.
 */
describe("uma inteligência, dois chamadores", () => {
  const ORQ = readFileSync(new URL("./orchestrator.ts", import.meta.url), "utf8");
  const CRON = readFileSync(
    new URL("../../app/api/ayla/cron/route.ts", import.meta.url),
    "utf8",
  );

  it("o reativo chama a função compartilhada", () => {
    expect(ORQ).toMatch(/resolverRotinaOrfa\(/);
    expect(ORQ).toMatch(/from "\.\/rotina-reconciliacao"/);
  });
  it("o cron chama a MESMA função compartilhada", () => {
    expect(CRON).toMatch(/resolverRotinaOrfa\(/);
    expect(CRON).toMatch(/from "@\/lib\/ayla\/rotina-reconciliacao"/);
  });
  it("o cron NÃO reimplementa a decisão de tema", () => {
    // Se `temaEnunciado` ou `decidirReconciliacao` aparecerem direto no cron,
    // alguém começou a segunda inteligência.
    expect(CRON).not.toMatch(/temaEnunciado|decidirReconciliacao/);
  });
  it("a retomada roda ANTES da classificação geral", () => {
    const iRetomada = ORQ.indexOf("apontaParaPendente(inbound.texto)");
    const iClassificador = ORQ.indexOf("const turnoClassificado = rotinaConversa");
    expect(iRetomada).toBeGreaterThan(0);
    expect(iRetomada).toBeLessThan(iClassificador);
  });
  it("a pergunta do tema sai como rotina_conversa, para a resposta voltar à condução", () => {
    const trecho = ORQ.slice(
      ORQ.indexOf("apontaParaPendente(inbound.texto)"),
      ORQ.indexOf("apontaParaPendente(inbound.texto)") + 2600,
    );
    expect(trecho).toMatch(/"rotina_conversa"/);
  });
});
