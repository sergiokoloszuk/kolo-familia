import { describe, expect, it } from "vitest";
import { idadeDitaSobreMembro, idadeRelatadaValida } from "./idade-relatada";

describe("idade informada pela família", () => {
  it("reconhece a correção nomeada do caso real mesmo com espaço duplo", () => {
    expect(idadeDitaSobreMembro("Lívia tem  4 anos", "Lívia Silva")).toBe(4);
    expect(idadeDitaSobreMembro("A Lívia está com 4 anos", "Lívia")).toBe(4);
  });

  it("não atribui a idade de outra pessoa à criança em foco", () => {
    expect(idadeDitaSobreMembro("A filha da vizinha tem 4 anos", "Lívia")).toBeNull();
    expect(idadeDitaSobreMembro("O irmão tem 14 anos", "Lívia")).toBeNull();
    expect(idadeDitaSobreMembro("Ela tem 4 anos", "Lívia")).toBeNull();
  });

  it("correção deixa de prevalecer quando a data de nascimento muda no cadastro", () => {
    const metadata = { idade_reportada: {
      anos: 4,
      nascimento_base: "2024-01-10",
      informada_em: "2026-10-05T00:47:59Z",
    } };
    expect(idadeRelatadaValida(metadata, "2024-01-10")?.anos).toBe(4);
    expect(idadeRelatadaValida(metadata, "2022-03-10")).toBeNull();
  });
});
