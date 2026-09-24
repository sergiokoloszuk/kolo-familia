import { describe, expect, it } from "vitest";
import { cpfValido, normalizarCpf } from "./cpf";

describe("CPF fiscal", () => {
  it("normaliza pontuação sem alterar dígitos", () => {
    expect(normalizarCpf("529.982.247-25")).toBe("52998224725");
  });

  it("aceita CPF com dígitos verificadores válidos", () => {
    expect(cpfValido("529.982.247-25")).toBe(true);
  });

  it("rejeita repetição e dígito verificador incorreto", () => {
    expect(cpfValido("111.111.111-11")).toBe(false);
    expect(cpfValido("529.982.247-24")).toBe(false);
  });
});
