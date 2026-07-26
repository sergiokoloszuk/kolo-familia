import { z } from "zod";

/**
 * Campo de e-mail dos formulários de auth (login, signup, recuperar senha).
 *
 * Existe porque `z.string().email()` cru rejeita coisas que a pessoa NÃO
 * digitou: espaço no fim (autofill e teclado de celular põem), espaço colado
 * junto do endereço (quem copia o e-mail de outra conversa traz), caractere
 * invisível (zero-width) que vem de colagem, e maiúscula. Aí a tela diz
 * "E-mail inválido" pra um e-mail perfeitamente válido, e a pessoa fica
 * trancada fora — foi o que aconteceu com duas mães em teste (26/07), uma
 * delas tentando redefinir a senha.
 *
 * Aqui a entrada é NORMALIZADA antes de validar: e-mail não tem espaço no
 * meio, então tirar qualquer espaço/invisível é seguro e sempre o que a
 * pessoa quis dizer.
 */

/** Espaço (inclui NBSP), zero-width e BOM — o que colagem traz de invisível. */
const INVISIVEIS = new RegExp("[\\s\\u00a0\\u200b-\\u200d\\ufeff]", "g");

export function normalizarEmail(valor: unknown): unknown {
  if (typeof valor !== "string") return valor;
  return valor.replace(INVISIVEIS, "").toLowerCase();
}

/**
 * Mensagem de erro que AJUDA: dizer "inválido" não conta o que fazer. Só
 * aparece quando, mesmo depois de normalizar, o texto não é endereço.
 */
export const MSG_EMAIL_INVALIDO =
  "Confere o e-mail? Precisa ter o @ e o domínio (ex.: nome@gmail.com)";

/** Campo pronto pra usar no schema: z.object({ email: emailCampo, ... }). */
export const emailCampo = z.preprocess(normalizarEmail, z.string().email(MSG_EMAIL_INVALIDO));
