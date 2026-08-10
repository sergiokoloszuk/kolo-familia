/**
 * FATOS COMERCIAIS — fonte canônica única.
 *
 * ── por que este arquivo existe ───────────────────────────────────────────
 *
 * Em 09/08/2026 uma família em teste de 7 dias podia receber, pelo WhatsApp,
 * "te lembrando que seus 30 dias grátis terminam em 3 dias". Duas causas, e a
 * segunda é a grave:
 *
 * 1. O template `trial_d3` nasceu na migração 0010, quando o trial era de 30
 *    dias. As migrações 0047 e 0051 encurtaram para 7 e ninguém voltou no
 *    texto. Corrigido no banco, tirando o número em vez de trocá-lo.
 *
 * 2. **A Ayla nunca soube quanto dura o trial.** Nenhum prompt de conversa —
 *    nem web, nem WhatsApp — informava a duração. Perguntada, ela inferia. E
 *    30 dias é o palpite mais provável do mercado. O único lugar que fazia
 *    certo era o `/ajuda`, com um bloco "use estes valores; NÃO invente" que
 *    ninguém tinha generalizado.
 *
 * ── a regra que este arquivo estabelece ───────────────────────────────────
 *
 * **Informação comercial e estrutural não é generativa.** A Ayla pode inventar
 * uma brincadeira; não pode decidir quantos dias dura o teste, quanto custa,
 * como funciona o cancelamento ou o que o Plano entrega. Esses números vêm
 * daqui, ou não são ditos.
 *
 * ── os dois "30 dias" que não podem se confundir ──────────────────────────
 *
 * `TRIAL_DIAS = 7` é o período de teste comercial do produto.
 * A duração de um **Plano Kolo** é outra coisa, e pode ser 30 dias. Um número
 * nunca justifica o outro — por isso os dois vivem aqui, nomeados, e o texto
 * do prompt diz explicitamente que não se misturam.
 */

/** Período de teste grátis do produto, em dias. **Não é a duração do Plano.** */
export const TRIAL_DIAS = 7;

/**
 * O bloco de fatos que vai para o prompt da Ayla — nos dois canais.
 *
 * Curto de propósito: o núcleo tem teto, e o que não muda comportamento só
 * gasta contexto. Preço fica FORA daqui porque vive em `configuracao_precos` e
 * muda sem deploy; quem precisa dele o lê da tabela, como o `/ajuda` já faz.
 */
export const FATOS_COMERCIAIS = `FATO COMERCIAL, nunca invente: o teste grátis é de ${TRIAL_DIAS} dias — corrija quem disser outro prazo, e não confunda com a duração de um Plano. Preço e cobrança: mande para a tela de Assinatura.`;
