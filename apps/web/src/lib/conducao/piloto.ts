/**
 * FASE 4A · a flag do piloto de Estratégias Web.
 *
 * Uma variável, um lugar, e o padrão é DESLIGADO. Com ela fora do ambiente, a
 * conversa web monta o contexto exatamente como montava antes — não é "quase
 * igual", é o mesmo caminho, porque as três leituras novas ficam atrás de um
 * `if` que não executa.
 *
 * ── por que uma flag própria, e não o núcleo ─────────────────────────────
 *
 * O WhatsApp compartilha `recuperarBoasPraticas` com a web, mas não passa por
 * `lib/ia/context.ts`. Então o piloto alcança só a web por construção — e esta
 * flag existe para que ele alcance **só Estratégias**, e para que desligar seja
 * uma variável de ambiente e não um deploy.
 *
 * ── o que ela liga (4A.1) ────────────────────────────────────────────────
 *
 * Só LEITURA: perfil consultável (Fase 1), BASE 2 seletiva (Fase 2) e ranking
 * por aderência (Fase 3). **Não** liga a licença generativa nem a âncora
 * (`composicao.ts`), e **não** ativa os 10 registros em rascunho.
 *
 * A pergunta que a 4A.1 responde é estreita de propósito: *o que muda só
 * porque a Ayla passou a enxergar melhor?*
 */

/** `1` liga. Qualquer outra coisa — inclusive ausência — mantém o fluxo antigo. */
export function pilotoEstrategiasLigado(): boolean {
  return process.env.KOLO_PILOTO_ESTRATEGIAS === "1";
}

/**
 * O nome da variável, exportado para os testes e para a documentação de
 * rollback não precisarem repetir a string.
 */
export const FLAG_PILOTO = "KOLO_PILOTO_ESTRATEGIAS";
