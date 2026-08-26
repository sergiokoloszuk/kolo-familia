/**
 * A ORIGEM DA VISITA — módulo NEUTRO, de propósito.
 *
 * ⚠️ POR QUE ISTO NÃO MORA EM `marco-origem.tsx`, e o erro que isso causou.
 *
 * `origemValida` nasceu ao lado do componente que emite o evento, num arquivo
 * com `"use client"` no topo. **Uma diretiva `"use client"` marca o ARQUIVO
 * inteiro, não só o componente** — todas as exportações dele viram client-only.
 * O Server Component da página chamava `origemValida()` e o Next derrubava a
 * renderização inteira:
 *
 *   Error: Attempted to call origemValida() from the server but origemValida
 *   is on the client.
 *
 * Resultado em produção: `/precos` respondia HTTP 200 com **27 KB de casca** —
 * sem planos, sem preço, sem botão. A página pública de conversão, vazia.
 *
 * ⚠️ E NEM `tsc` NEM `npm run build` PEGARAM. Os dois passaram limpos; o erro
 * só existe em runtime. Foi um `next start` local + um `curl` que revelou.
 * É a mesma lição do §18 do protocolo, um degrau adiante: build verde não é
 * página funcionando.
 *
 * Este arquivo não tem diretiva nenhuma, então serve aos dois lados.
 */

/**
 * As origens que reconhecemos. Vocabulário fechado de propósito: qualquer coisa
 * fora daqui vira `null` e NÃO emite evento — senão um link colado com um
 * parâmetro qualquer viraria uma origem inventada dentro da métrica.
 */
const ORIGENS = new Set(["d7", "d3", "pos_trial"]);

export function origemValida(bruta: string | string[] | undefined): string | null {
  const v = typeof bruta === "string" ? bruta.trim().toLowerCase() : "";
  return ORIGENS.has(v) ? v : null;
}
