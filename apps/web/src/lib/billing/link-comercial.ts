import type { SupabaseClient } from "@supabase/supabase-js";
import { criarLinkAcesso } from "@/lib/auth/acesso-link";
import { linkAssinatura, destinoAssinatura } from "./destino-comercial";

/**
 * O LINK COMERCIAL DE UMA FAMÍLIA IDENTIFICADA — dono único.
 *
 * ⚠️ O DEFEITO QUE ISTO CORRIGE, VISTO EM PRODUÇÃO EM 27/08/2026, 15:18.
 * Karina escreveu *"Não, eu quero pagar, eu quero assinar."* e a Ayla
 * respondeu com `kolo-familia-web.vercel.app/precos`. Intenção de compra
 * explícita, de uma família que a Kolo conhece pelo número, e o destino foi a
 * página **pública de aquisição** — que, sem sessão, abre com a manchete
 * "7 dias grátis" e o botão "Começar 7 dias grátis" → `/signup`.
 *
 * ⚠️ E O MODELO NÃO INVENTOU NADA. O link chegou pronto, por `notaComercial()`,
 * vindo de `linkPlanos()`. O defeito não era o prompt nem a alucinação: era a
 * REGRA. `/precos` é o destino certo para quem chega de fora, e o errado para
 * quem já tem conta.
 *
 * ⚠️ A CORREÇÃO DO D7 (26/08) NÃO ALCANÇAVA ISTO. Lá o caminho é o template
 * proativo; aqui é a conversa reativa, que passa por `notaComercial` — outro
 * arquivo, outro fluxo, mesma decisão. Duas cópias da mesma decisão sempre
 * divergem; por isso agora existe **uma função** e os dois lados a chamam.
 *
 * ── a regra, em uma linha ────────────────────────────────────────────────
 *
 * Quem a Kolo IDENTIFICA (conversa no WhatsApp, sessão na web) recebe o
 * caminho autenticado para `/assinatura`, onde está o checkout de verdade.
 * `/precos` continua servindo quem chega de fora, e não muda.
 *
 * ⚠️ POR QUE VALE TAMBÉM PARA "QUANTO CUSTA". Seria tentador mandar `/precos`
 * a quem só pesquisa e o link autenticado a quem quer comprar. Mas essa
 * fronteira é frágil — "onde eu pago?" e "quais os planos?" moram perto demais
 * uma da outra —, e o preço aparece nos DOIS destinos: `/assinatura` mostra
 * mensal e anual, e o TrialGate de quem venceu também. Então não há informação
 * a perder, e há uma classificação a menos para errar.
 */
export async function linkComercialAutenticado(
  supabase: SupabaseClient,
  familyId: string | null | undefined,
  de: "d7" | "d3" | "pos_trial",
): Promise<string> {
  if (familyId) {
    const autenticado = await criarLinkAcesso(supabase, {
      familyId,
      next: destinoAssinatura(de),
      criadoPor: "ayla",
    });
    if (autenticado) return autenticado;
  }
  // Sem token (falha de escrita) ou sem família: `/assinatura` puro. Ela cai no
  // `/login` e entra — atrito, mas o destino continua certo.
  // ⚠️ NÃO EXISTE DEGRAU PARA `/precos`: um fallback "seguro" para a página
  // pública seria o defeito voltando pela porta dos fundos, e justo quando algo
  // já falhou. Um teste MORDE isso.
  return linkAssinatura(de) ?? "";
}
