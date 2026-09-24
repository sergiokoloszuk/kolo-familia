import { z } from "zod";
import { cpfValido, normalizarCpf } from "./cpf";

const UFS = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

const textoObrigatorio = (campo: string, max: number) =>
  z.string().trim().min(1, `Informe ${campo}.`).max(max, `${campo} está muito longo.`);

export const dadosFiscaisSchema = z.object({
  plano: z.enum(["mensal", "anual"]),
  nomeFiscal: z
    .string()
    .trim()
    .min(3, "Informe o nome completo.")
    .max(160, "O nome está muito longo.")
    .refine((nome) => nome.split(/\s+/).filter(Boolean).length >= 2, "Informe nome e sobrenome."),
  emailFiscal: z.string().trim().email("Informe um e-mail válido.").max(320),
  cpf: z
    .string()
    .trim()
    .transform(normalizarCpf)
    .refine(cpfValido, "Informe um CPF válido."),
  cep: z
    .string()
    .trim()
    .transform((valor) => valor.replace(/\D/g, ""))
    .refine((valor) => /^\d{8}$/.test(valor), "Informe um CEP válido."),
  logradouro: textoObrigatorio("o logradouro", 160),
  numero: textoObrigatorio("o número", 30),
  complemento: z.string().trim().max(100, "O complemento está muito longo.").optional().default(""),
  bairro: textoObrigatorio("o bairro", 100),
  cidade: textoObrigatorio("a cidade", 100),
  estado: z
    .string()
    .trim()
    .transform((valor) => valor.toUpperCase())
    .refine((valor) => UFS.has(valor), "Informe uma UF válida."),
});

export type DadosFiscaisInput = z.input<typeof dadosFiscaisSchema>;
export type DadosFiscais = z.output<typeof dadosFiscaisSchema>;

export function enderecoStripe(dados: DadosFiscais) {
  const detalhes = [`Bairro: ${dados.bairro}`];
  if (dados.complemento) detalhes.push(`Complemento: ${dados.complemento}`);

  return {
    line1: `${dados.logradouro}, ${dados.numero}`,
    line2: detalhes.join(" · "),
    postal_code: dados.cep,
    city: dados.cidade,
    state: dados.estado,
    country: "BR" as const,
  };
}

export function primeiraMensagemDeErro(erro: z.ZodError): string {
  return erro.issues[0]?.message ?? "Confira os dados fiscais informados.";
}
