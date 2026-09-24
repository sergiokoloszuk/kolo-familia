import { describe, expect, it } from "vitest";
import { dadosFiscaisSchema, enderecoStripe } from "./dados";

const completos = {
  plano: "mensal" as const,
  nomeFiscal: "Maria da Silva",
  emailFiscal: "maria@example.com",
  cpf: "529.982.247-25",
  cep: "01310-100",
  logradouro: "Avenida Paulista",
  numero: "1000",
  complemento: "Apto 12",
  bairro: "Bela Vista",
  cidade: "São Paulo",
  estado: "sp",
};

describe("dados fiscais obrigatórios", () => {
  it("normaliza CPF, CEP e UF e monta endereço completo para o Customer Stripe", () => {
    const dados = dadosFiscaisSchema.parse(completos);
    expect(dados).toMatchObject({ cpf: "52998224725", cep: "01310100", estado: "SP" });
    expect(enderecoStripe(dados)).toEqual({
      line1: "Avenida Paulista, 1000",
      line2: "Bairro: Bela Vista · Complemento: Apto 12",
      postal_code: "01310100",
      city: "São Paulo",
      state: "SP",
      country: "BR",
    });
  });

  it.each([
    ["nome completo", { nomeFiscal: "Maria" }],
    ["CPF", { cpf: "111.111.111-11" }],
    ["CEP", { cep: "123" }],
    ["logradouro", { logradouro: "" }],
    ["número", { numero: "" }],
    ["bairro", { bairro: "" }],
    ["cidade", { cidade: "" }],
    ["UF", { estado: "XX" }],
  ])("não aceita pagamento sem %s", (_campo, alteracao) => {
    expect(dadosFiscaisSchema.safeParse({ ...completos, ...alteracao }).success).toBe(false);
  });

  it("permite complemento vazio porque ele não faz parte de todo endereço", () => {
    expect(dadosFiscaisSchema.safeParse({ ...completos, complemento: "" }).success).toBe(true);
  });
});
