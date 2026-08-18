/**
 * FEATURE FLAG da BIA no prompt.
 *
 * Desligada por padrão, e por construção: só liga com a variável explicitamente
 * em "1"/"true". Se a variável não existir, estiver vazia ou vier com qualquer
 * outro valor, a BIA NÃO entra no prompt e a Ayla responde exatamente como
 * responde hoje.
 *
 * Ela controla só a INSERÇÃO NO PROMPT. A infraestrutura (tabela, importer,
 * retriever, testes) continua no lugar com a flag desligada — dá para consultar
 * a BIA pela bancada e pelos testes sem nenhum risco para a conversa real.
 *
 * Por que env var e não a tabela `configuracao_geral`: ligar a BIA muda o que o
 * modelo lê em TODA mensagem dos dois canais. Isso é decisão de deploy, com
 * rollback por redeploy — não algo para alternar num painel enquanto famílias
 * conversam. Uma leitura no banco por mensagem também sairia caro num caminho
 * que já é sensível a latência.
 */

export const BIA_FLAG_ENV = "BIA_PROMPT_ENABLED";

/** A BIA pode entrar no prompt? */
export function biaHabilitadaNoPrompt(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const v = (env[BIA_FLAG_ENV] ?? "").trim().toLowerCase();
  return v === "1" || v === "true";
}
