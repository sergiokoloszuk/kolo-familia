import { describe, it, expect } from "vitest";
import {
  gerarCodigo,
  validarFormatoCodigo,
  normalizarCodigo,
} from "./codigos";

describe("beta/codigos", () => {
  it("gera código com 8 caracteres válidos", () => {
    for (let i = 0; i < 50; i++) {
      const c = gerarCodigo();
      expect(c).toHaveLength(8);
      expect(validarFormatoCodigo(c)).toBe(true);
    }
  });

  it("não usa caracteres ambíguos (0/O/1/I/L)", () => {
    const todos = Array.from({ length: 200 }, () => gerarCodigo()).join("");
    for (const c of ["0", "O", "1", "I", "L"]) {
      expect(todos.includes(c)).toBe(false);
    }
  });

  it("normaliza removendo espaços, hífens e maiúsculas", () => {
    expect(normalizarCodigo(" abcd-2345 ")).toBe("ABCD2345");
    expect(normalizarCodigo("ABcd 2345")).toBe("ABCD2345");
  });

  it("valida formato corretamente", () => {
    expect(validarFormatoCodigo("ABCD2345")).toBe(true);
    expect(validarFormatoCodigo("ABCD234")).toBe(false); // 7 chars
    expect(validarFormatoCodigo("ABCD23456")).toBe(false); // 9 chars
    expect(validarFormatoCodigo("ABCD2340")).toBe(false); // contém 0
    expect(validarFormatoCodigo("ABcd2345")).toBe(false); // minúsculo
  });
});
