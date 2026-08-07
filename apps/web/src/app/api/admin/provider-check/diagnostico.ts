/**
 * A LÓGICA PURA DO PROVIDER-CHECK — separada do `route.ts` por uma razão do
 * framework: um Route Handler do Next só pode exportar os handlers e um punhado
 * de configs. Qualquer export a mais quebra o typecheck do build.
 *
 * Mas a separação é boa por si: estas duas funções decidem o que a pessoa lê na
 * tela no meio de uma ativação, e por isso precisam ser testáveis sem subir
 * servidor, sem sessão e sem chamar a OpenAI.
 */

/**
 * Quantas famílias a allowlist realmente autoriza — ÚNICOS, não entradas.
 *
 * Espaços, vírgulas sobrando e quebras de linha caem fora; id repetido conta
 * uma vez. Sem a deduplicação, um copiar-colar duplicado mostraria 4 quando são
 * 3 — e a conferência "bate com o que eu configurei?" passaria a mentir
 * justamente no caso em que alguém errou a lista.
 *
 * Devolve o NÚMERO. Os ids não saem daqui: ver a lista inteira numa resposta
 * HTTP não ajuda a operar e espalha identificador de família por log de proxy.
 */
export function contarAutorizadas(bruto: string | undefined | null): number {
  return new Set((bruto ?? "").split(/[,\s]+/).filter(Boolean)).size;
}

/**
 * O TIPO DE FALHA, porque cada uma tem uma saída diferente — e ler status HTTP
 * dentro de uma string é frágil demais pra deixar por conta de quem estiver
 * lendo o JSON às onze da noite.
 *
 *   chave      → a OPENAI_API_KEY não vale (ou não é a que se pensa)
 *   modelo     → a chave vale, mas o projeto dela não enxerga o modelo.
 *                É O CASO QUE MOTIVOU ESTA ROTA: `sk-proj-*` tem escopo por
 *                projeto, e dá pra ter imagem/transcrição sem ter texto.
 *   quota      → chave e modelo ok, faltou saldo/limite
 *   tecnica    → rede, timeout, 5xx do provedor
 *
 * A mensagem vem do `ErroDeProvider`, que a prefixa com `<provider> <status>:`
 * e a monta a partir de `error.message` da API — nunca do header. Nenhuma
 * chave passa por aqui.
 */
export function classificarFalha(msg: string): "chave" | "modelo" | "quota" | "tecnica" {
  if (/\b401\b|invalid[_ ]api[_ ]key|authentication|unauthorized/i.test(msg)) return "chave";
  if (/\b40[34]\b|model[_ ]not[_ ]found|does not (exist|have access)/i.test(msg)) return "modelo";
  if (/\b429\b|quota|rate[_ ]limit|insufficient/i.test(msg)) return "quota";
  return "tecnica";
}
