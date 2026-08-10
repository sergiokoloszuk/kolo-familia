import { alcancaFamilia, estadoDeRollout, listaDeFamilias } from "./rollout";

/**
 * FASE 4A · o piloto da inteligência nova — perfil consultável, BASE 2, ranking
 * por aderência, âncora e licença generativa.
 *
 * ── O QUE MUDOU EM 10/08/2026, e por quê ─────────────────────────────────
 *
 * Até aqui isto era `KOLO_PILOTO_ESTRATEGIAS`, um booleano GLOBAL: `1` ligava
 * a 4A para TODAS as famílias da web. Fazia sentido enquanto a pergunta era "o
 * que muda só porque a Ayla enxerga melhor?" — mediu-se em bancada, com a flag
 * desligada em produção o tempo todo.
 *
 * O piloto restrito (Admin, Rosangela, Sergio) tornou isso impossível de usar:
 * não havia como alcançar três famílias sem alcançar as 172. A flag virou o
 * mesmo rollout de três estados que `lib/ia/provider.ts` já usava — o padrão
 * está em `./rollout.ts`, agora compartilhado pelos dois.
 *
 * ⚠️ A FLAG ANTIGA NUNCA ESTEVE LIGADA EM PRODUÇÃO — conferido em 10/08/2026
 * pela ausência de qualquer efeito 4A no tráfego real. Por isso a renomeação
 * não tem custo de rollback: não há estado a preservar.
 *
 * ── POR QUE NÃO REUSAR `OPENAI_TEST_FAMILY_IDS` ──────────────────────────
 *
 * Seria uma lista a menos para manter, e foi considerado. Mas acopla dois
 * conceitos que precisam se mover em ritmos diferentes: "quem responde" e "com
 * o que ela pensa". Acoplados, nunca mais daria para dar 4A a uma família no
 * Claude, nem GPT sem 4A — e o rollout seguinte precisa exatamente disso.
 *
 * ── ROLLOUT ──────────────────────────────────────────────────────────────
 *
 *   (ausente) | off | qualquer outra coisa → ninguém
 *   teste                                  → só KOLO_PILOTO_4A_FAMILIAS
 *   on                                     → todas as famílias
 *
 * Liberar para todos é trocar `teste` por `on`. Nenhuma implementação nova.
 */

/** A variável que decide o estado. */
export const FLAG_PILOTO_4A = "KOLO_PILOTO_4A";
/** A allowlist do modo `teste`, por `family_account_id`. */
export const FLAG_PILOTO_4A_FAMILIAS = "KOLO_PILOTO_4A_FAMILIAS";

/** O estado atual do rollout da 4A. */
export function estadoPiloto4A() {
  return estadoDeRollout(process.env[FLAG_PILOTO_4A], "teste", "on");
}

/**
 * ESTA FAMÍLIA ESTÁ NO PILOTO DA 4A?
 *
 * A MESMA função nos dois canais — web (`lib/ia/context.ts`) e WhatsApp
 * (`lib/ayla/orchestrator.ts`). Regra duplicada seria a forma mais fácil de uma
 * família receber a inteligência nova num canal e a antiga no outro, dentro da
 * mesma conversa.
 */
export function pilotoQuatroA(familyAccountId?: string | null): boolean {
  return alcancaFamilia(
    estadoPiloto4A(),
    listaDeFamilias(process.env[FLAG_PILOTO_4A_FAMILIAS]),
    familyAccountId,
  );
}
