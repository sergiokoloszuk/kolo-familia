import { describe, expect, it } from "vitest";
import { vinculoDitoSobreMembro, vinculoRelatadoValido } from "./vinculo-relatado";

describe("vínculo explicitamente informado", () => {
  it("corrige vínculo sem transformar negação em fato", () => {
    expect(vinculoDitoSobreMembro("Não sou mãe da Lia, sou tia dela", "Lia", false)).toBe("tia");
    expect(vinculoDitoSobreMembro("Sou a tia da Lia", "Lia", false)).toBe("tia");
    expect(vinculoDitoSobreMembro("Não sou mãe da Lia", "Lia", false)).toBe("nao_informado");
    expect(vinculoDitoSobreMembro("Não sou tia", "Lia", true)).toBe("nao_informado");
  });

  it("não atribui vínculo sem alvo quando há irmãos", () => {
    expect(vinculoDitoSobreMembro("Sou tia", "Lia", false)).toBeNull();
    expect(vinculoDitoSobreMembro("Sou tia da Bia", "Lia", false)).toBeNull();
    expect(vinculoDitoSobreMembro("Lia não veio; sou tia da Bia", "Lia", false)).toBeNull();
    expect(vinculoDitoSobreMembro("Sou tia", "Lia", true)).toBe("tia");
  });

  it("lê somente registro tipado e datado", () => {
    expect(vinculoRelatadoValido({ vinculo_reportado: { tipo: "tia", informada_em: "2026-10-06T10:00:00Z" } })?.tipo).toBe("tia");
    expect(vinculoRelatadoValido({ vinculo_reportado: { tipo: "vizinha", informada_em: "2026-10-06T10:00:00Z" } })).toBeNull();
    expect(vinculoRelatadoValido({ vinculo_reportado: { tipo: "toString", informada_em: "2026-10-06T10:00:00Z" } })).toBeNull();
  });
});
