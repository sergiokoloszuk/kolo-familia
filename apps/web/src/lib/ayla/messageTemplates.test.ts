import { describe, it, expect } from "vitest";
import { limparNomeAusente } from "./messageTemplates";

/**
 * Sem nome cadastrado, o padrão era a string literal "oi" — e vazava no meio
 * das frases ("Tô com você, oi", "Isso é uma conquista real, oi", caso real de
 * 29/07/2026). Agora o padrão é vazio e a cicatriz é limpa aqui.
 */
describe("limparNomeAusente", () => {
  it("tira a vírgula que sobra antes do ponto", () => {
    expect(limparNomeAusente("Tô com você, . Me conta mais?")).toBe(
      "Tô com você. Me conta mais?",
    );
  });

  it("tira a vírgula antes de exclamação e interrogação", () => {
    expect(limparNomeAusente("Oi, ! Como foi o dia?")).toBe("Oi! Como foi o dia?");
    expect(limparNomeAusente("Tudo bem, ?")).toBe("Tudo bem?");
  });

  it("tira a vírgula pendurada no fim da linha", () => {
    expect(limparNomeAusente("Oi, \n\nSou a Ayla.")).toBe("Oi\n\nSou a Ayla.");
  });

  it("tira a vírgula pendurada no fim do texto", () => {
    expect(limparNomeAusente("Passando pra saber de vocês, ")).toBe(
      "Passando pra saber de vocês",
    );
  });

  it("colapsa o espaço duplo que o nome vazio deixa", () => {
    expect(limparNomeAusente("Oi,  tudo bem?")).toBe("Oi, tudo bem?");
  });

  it("não estraga texto com nome de verdade", () => {
    const t = "Oi, Giselda. Montei o plano estratégico hoje — me conta o que achou?";
    expect(limparNomeAusente(t)).toBe(t);
  });

  it("preserva quebras de parágrafo", () => {
    const t = "Oi, Ana 🌿\n\nSou a Ayla.\n\nPode me escrever quando quiser.";
    expect(limparNomeAusente(t)).toBe(t);
  });

  it("não mexe em vírgula legítima seguida de palavra", () => {
    const t = "Ele grita, se afasta e depois volta.";
    expect(limparNomeAusente(t)).toBe(t);
  });
});
