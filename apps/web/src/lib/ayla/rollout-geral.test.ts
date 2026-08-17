import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ehFamiliaExperimental, experimentalParaTodas, familiasExperimentais } from "./experimental";

/**
 * A LIBERAÇÃO GERAL DO CAMINHO NOVO NO WHATSAPP.
 *
 * Decisão de produto de 17/08/2026: sair da allowlist e atender todas as
 * famílias elegíveis. A implementação é uma chave PRÓPRIA
 * (`AYLA_EXPERIMENTAL_TODAS`), e não "lista vazia = todo mundo" — porque a
 * segunda forma inverteria a proteção que o módulo já documentava: apagar a
 * variável por engano promoveria as 202 famílias de uma vez.
 *
 * ⚠️ O QUE ESTE PORTÃO NÃO TOCA. Ele roda depois do gate de acesso, da
 * segurança, da identificação de família/criança e da idempotência do inbound.
 * Liberar aqui não afrouxa nada disso — os testes desses portões continuam
 * onde estão e continuam verdes.
 */

const ENV_LISTA = process.env.AYLA_EXPERIMENTAL_FAMILY_IDS;
const ENV_TODAS = process.env.AYLA_EXPERIMENTAL_TODAS;

const QA = "9c14b56b-32ca-4410-b830-09b16cc9a7a1";
const FORA_DA_LISTA = "7c764314-0305-445f-b673-b47d55e4ee3e";

beforeEach(() => {
  delete process.env.AYLA_EXPERIMENTAL_TODAS;
  delete process.env.AYLA_EXPERIMENTAL_FAMILY_IDS;
});
afterEach(() => {
  if (ENV_LISTA === undefined) delete process.env.AYLA_EXPERIMENTAL_FAMILY_IDS;
  else process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = ENV_LISTA;
  if (ENV_TODAS === undefined) delete process.env.AYLA_EXPERIMENTAL_TODAS;
  else process.env.AYLA_EXPERIMENTAL_TODAS = ENV_TODAS;
});

describe("ANTES DA LIBERAÇÃO — nada mudou", () => {
  it("sem nenhuma variável, ninguém entra", () => {
    expect(ehFamiliaExperimental(QA)).toBe(false);
    expect(ehFamiliaExperimental(FORA_DA_LISTA)).toBe(false);
  });

  it("a allowlist continua funcionando exatamente como antes", () => {
    process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = QA;
    expect(ehFamiliaExperimental(QA)).toBe(true);
    expect(ehFamiliaExperimental(FORA_DA_LISTA)).toBe(false);
    expect(familiasExperimentais()).toEqual([QA]);
  });
});

describe("DEPOIS DA LIBERAÇÃO — todas as famílias elegíveis", () => {
  it("família FORA da antiga allowlist passa a entrar", () => {
    process.env.AYLA_EXPERIMENTAL_TODAS = "1";
    expect(ehFamiliaExperimental(FORA_DA_LISTA)).toBe(true);
  });

  it("a família de QA continua entrando", () => {
    process.env.AYLA_EXPERIMENTAL_TODAS = "1";
    expect(ehFamiliaExperimental(QA)).toBe(true);
  });

  it("funciona sem precisar cadastrar id nenhum", () => {
    process.env.AYLA_EXPERIMENTAL_TODAS = "true";
    expect(familiasExperimentais()).toEqual([]);
    expect(ehFamiliaExperimental(FORA_DA_LISTA)).toBe(true);
  });

  it("id ausente NUNCA entra — nem na liberação geral", () => {
    // Sem saber de quem é o turno, o resto do caminho não tem o que fazer.
    process.env.AYLA_EXPERIMENTAL_TODAS = "1";
    expect(ehFamiliaExperimental(null)).toBe(false);
    expect(ehFamiliaExperimental("")).toBe(false);
    expect(ehFamiliaExperimental("   ")).toBe(false);
    expect(ehFamiliaExperimental(undefined)).toBe(false);
  });
});

describe("FAIL CLOSED — só um SIM explícito libera", () => {
  it("valores que NÃO liberam", () => {
    for (const v of ["", " ", "0", "false", "sim", "SIM", "yes", "on", "2", "null"]) {
      process.env.AYLA_EXPERIMENTAL_TODAS = v;
      expect(experimentalParaTodas(), `"${v}" liberou geral e não deveria`).toBe(false);
      expect(ehFamiliaExperimental(FORA_DA_LISTA)).toBe(false);
    }
  });

  it("valores que liberam — e são só estes dois", () => {
    for (const v of ["1", "true", "TRUE", " true "]) {
      process.env.AYLA_EXPERIMENTAL_TODAS = v;
      expect(experimentalParaTodas(), `"${v}" deveria liberar`).toBe(true);
    }
  });

  it("APAGAR a variável é o rollback — volta todo mundo para a Ayla atual", () => {
    process.env.AYLA_EXPERIMENTAL_TODAS = "1";
    expect(ehFamiliaExperimental(FORA_DA_LISTA)).toBe(true);
    delete process.env.AYLA_EXPERIMENTAL_TODAS;
    expect(ehFamiliaExperimental(FORA_DA_LISTA)).toBe(false);
  });

  it("a proteção antiga continua de pé: lista vazia NÃO significa todo mundo", () => {
    // Era o cuidado documentado no módulo, e a liberação geral não podia
    // invertê-lo — apagar a lista por engano não pode promover ninguém.
    process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = "";
    expect(ehFamiliaExperimental(FORA_DA_LISTA)).toBe(false);
  });
});
