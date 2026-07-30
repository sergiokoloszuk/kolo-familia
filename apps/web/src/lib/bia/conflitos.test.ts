import { describe, expect, it } from "vitest";
import { detectarConflitos } from "./conflitos";

/**
 * O caso que motivou este módulo é real e está medido em
 * `docs/auditoria-brincar-bia.md`: BP-COM-12, BP-COM-02 e BP-IMI-02 prescrevem
 * contato visual sem ressalva, enquanto a BIA desaconselha forçar o olhar.
 */

const BP_CONTATO_VISUAL =
  "Estabeleça contato visual frequente durante a brincadeira e observe se ele mantém o olhar.";
const BIA_CONTATO_VISUAL =
  "SE a criança evita contato visual ENTÃO não forçar o olhar — investigar se é sobrecarga visual-social e permitir comunicação sem exigência de contato visual.";

describe("detectarConflitos", () => {
  it("pega a tensão do contato visual (o caso real)", () => {
    const c = detectarConflitos({
      textosBia: [BIA_CONTATO_VISUAL],
      textosBoasPraticas: [BP_CONTATO_VISUAL],
    });
    expect(c).toHaveLength(1);
    expect(c[0].tema).toBe("contato_visual");
    expect(c[0].trechoPrescritivo).toBeTruthy();
    expect(c[0].trechoCauteloso).toBeTruthy();
  });

  it("não acusa conflito quando só um dos lados aparece", () => {
    // BP sozinha não é conflito — é só uma BP.
    expect(
      detectarConflitos({ textosBia: [], textosBoasPraticas: [BP_CONTATO_VISUAL] }),
    ).toHaveLength(0);
    // BIA sozinha, idem.
    expect(
      detectarConflitos({ textosBia: [BIA_CONTATO_VISUAL], textosBoasPraticas: [] }),
    ).toHaveLength(0);
  });

  it("não acusa conflito em material que apenas MENCIONA o tema", () => {
    const c = detectarConflitos({
      textosBia: ["O contato visual é um estímulo visual e social intenso."],
      textosBoasPraticas: ["Brinque no chão, na altura da criança, seguindo o interesse dela."],
    });
    expect(c).toHaveLength(0);
  });

  it("pega a tensão da recompensa (o veto do método Kolo)", () => {
    const c = detectarConflitos({
      textosBia: [
        "Nunca use comida, tela ou brinquedo como recompensa por comportamento — não é o método.",
      ],
      textosBoasPraticas: ["Se ele escovar os dentes, ganha 10 minutos de tablet como prêmio."],
    });
    expect(c.map((x) => x.tema)).toContain("recompensa");
  });

  it("pega a tensão da exposição forçada", () => {
    const c = detectarConflitos({
      textosBia: [
        "Exposição forçada aumenta a reatividade; exposição gradual em segurança aumenta tolerância.",
      ],
      textosBoasPraticas: ["Insista para que ele prove pelo menos uma colher do alimento novo."],
    });
    expect(c.map((x) => x.tema)).toContain("exposicao_forcada");
  });

  it("funciona com ou sem acento", () => {
    const c = detectarConflitos({
      textosBia: ["nao forcar o contato visual, e sobrecarga"],
      textosBoasPraticas: ["Estabeleca contato visual antes de pedir"],
    });
    expect(c).toHaveLength(1);
  });

  it("entradas vazias não quebram nem inventam conflito", () => {
    expect(detectarConflitos({ textosBia: [], textosBoasPraticas: [] })).toEqual([]);
    expect(detectarConflitos({ textosBia: [""], textosBoasPraticas: ["  "] })).toEqual([]);
  });

  it("o trecho guardado é curto — é auditoria, não cópia do conteúdo", () => {
    const [c] = detectarConflitos({
      textosBia: [BIA_CONTATO_VISUAL + " ".repeat(50) + "texto longo".repeat(100)],
      textosBoasPraticas: [BP_CONTATO_VISUAL],
    });
    expect(c.trechoCauteloso.length).toBeLessThanOrEqual(160);
    expect(c.trechoPrescritivo.length).toBeLessThanOrEqual(160);
  });
});
