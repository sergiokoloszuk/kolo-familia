import { describe, expect, it } from "vitest";
import {
  BLACK_FRIDAY_2026,
  calcularTrialDeQuinzeDias,
  checkoutExpiraEm,
  checkoutFoiConcluidoNoPrazo,
  completarTrialExistente,
  fimOfertaIndividualExclusivo,
  janelaPublicaAberta,
  ofertaDisponivelParaFamilia,
} from "./black-friday-2026";

describe("Black Friday 2026 — contrato comercial", () => {
  it("abre exatamente à meia-noite de Brasília em 1º de novembro", () => {
    expect(janelaPublicaAberta("2026-11-01T02:59:59.999Z")).toBe(false);
    expect(janelaPublicaAberta("2026-11-01T03:00:00.000Z")).toBe(true);
  });

  it("inclui todo o dia 30 e fecha à meia-noite de Brasília em 1º de dezembro", () => {
    expect(janelaPublicaAberta("2026-12-01T02:59:59.999Z")).toBe(true);
    expect(janelaPublicaAberta("2026-12-01T03:00:00.000Z")).toBe(false);
  });

  it("concede 15 dias completos, inclusive para entrada no último minuto", () => {
    expect(calcularTrialDeQuinzeDias("2026-12-01T02:59:59.000Z"))
      .toBe("2026-12-16T02:59:59.000Z");
  });

  it("completa 15 dias totais de um teste em curso e nunca encurta acesso", () => {
    expect(completarTrialExistente("2026-10-28T12:00:00Z", "2026-11-04T12:00:00Z"))
      .toBe("2026-11-12T12:00:00.000Z");
    expect(completarTrialExistente("2026-10-01T12:00:00Z", "2026-12-20T12:00:00Z"))
      .toBe("2026-12-20T12:00:00.000Z");
  });

  it("mantém a oferta até o fim de 30/11 quando o teste termina antes", () => {
    expect(fimOfertaIndividualExclusivo("2026-11-12T12:00:00Z"))
      .toBe("2026-12-01T03:00:00.000Z");
  });

  it("leva a oferta até o fim do dia local em que um teste tardio termina", () => {
    expect(fimOfertaIndividualExclusivo("2026-12-15T02:59:59Z"))
      .toBe("2026-12-15T03:00:00.000Z");
    expect(fimOfertaIndividualExclusivo("2026-12-15T03:00:00Z"))
      .toBe("2026-12-16T03:00:00.000Z");
  });

  it("só apresenta a oferta com a chave ativa e antes do limite individual", () => {
    const fim = "2026-12-10T03:00:00Z";
    expect(ofertaDisponivelParaFamilia({ estado: "desligada", agora: "2026-11-20T12:00:00Z", ofertaTerminaEm: fim })).toBe(false);
    expect(ofertaDisponivelParaFamilia({ estado: "pausada", agora: "2026-11-20T12:00:00Z", ofertaTerminaEm: fim })).toBe(true);
    expect(ofertaDisponivelParaFamilia({ estado: "ativa", agora: "2026-12-10T02:59:59Z", ofertaTerminaEm: fim })).toBe(true);
    expect(ofertaDisponivelParaFamilia({ estado: "ativa", agora: fim, ofertaTerminaEm: fim })).toBe(false);
  });

  it("reserva o checkout por exatamente 30 minutos, sem ampliar a oferta", () => {
    expect(checkoutExpiraEm("2026-11-30T23:59:00Z")).toBe("2026-12-01T00:29:00.000Z");
    expect(checkoutFoiConcluidoNoPrazo({ iniciadoEm: "2026-11-30T23:59:00Z", concluidoEm: "2026-12-01T00:29:00Z" })).toBe(true);
    expect(checkoutFoiConcluidoNoPrazo({ iniciadoEm: "2026-11-30T23:59:00Z", concluidoEm: "2026-12-01T00:29:00.001Z" })).toBe(false);
  });

  it("fixa os fatos que poderiam causar cobrança errada", () => {
    expect(BLACK_FRIDAY_2026).toMatchObject({
      diasTrial: 15,
      valorCentavos: 3990,
      moeda: "brl",
      intervalo: "month",
      intervaloCount: 1,
      priceIdAprovado: "price_1UTQfzPAH1xSrJeSwmrOEor2",
    });
  });
});
