"use server";

import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * O PORTÃO DO E-MAIL, DESLIGADO.
 *
 * MEDIDO EM PRODUÇÃO (31/08/2026): de 244 contas criadas, 78 NUNCA confirmaram
 * o e-mail — 32%. Nos últimos 30 dias, 45 de 120 (37,5%); nos últimos 7, 5 de
 * 11. São pessoas que já tinham digitado e-mail, senha e aceitado os termos: a
 * intenção estava lá, o portão é que estava no caminho. Para efeito de
 * comparação, o portão do WhatsApp — que vem depois e é uma prova mais forte —
 * derruba 11%.
 *
 * A verificação de identidade da Kolo é o WhatsApp, por código de 6 dígitos, no
 * meio do onboarding (`lib/whatsapp/acoes.ts`). Ela continua intacta. O que sai
 * daqui é a SEGUNDA prova, a que não paga o próprio custo.
 *
 * ⚠️ ISTO É UM CONTORNO, E DE PROPÓSITO. O lugar certo de desligar isso é
 * `GOTRUE_MAILER_AUTOCONFIRM=true` no serviço Supabase Auth (Easypanel) —
 * conferido em 31/08/2026 via `/auth/v1/settings`: está `false`. Mexer lá exige
 * redeploy do stack do Supabase, que neste projeto já zerou o banco uma vez
 * (08/06/2026). Enquanto essa env não virar, o desligamento vive aqui.
 *
 * QUANDO A ENV VIRAR, ESTE CÓDIGO SE APAGA SOZINHO: com autoconfirm ligado o
 * `signUp` já devolve sessão, o ramo `!data.session` da tela nunca roda, e esta
 * função deixa de ser chamada. Não há nada para desfazer — só um arquivo para
 * remover quando sobrar tempo.
 *
 * O QUE ELA NÃO RESOLVE: com autoconfirm `false`, o GoTrue ainda dispara o
 * e-mail "confirme seu e-mail" no `signUp`. A mãe entra direto e recebe um
 * e-mail que não precisa mais obedecer. Feio, não bloqueia, e morre junto com a
 * env.
 */

/** Janela em que uma conta recém-criada pode ser confirmada por esta rota. */
const JANELA_MS = 5 * 60 * 1000;

export type ResultadoAutoconfirma =
  | { ok: true }
  | { ok: false; motivo: "nao_encontrado" | "fora_da_janela" | "erro" };

/**
 * Confirma o e-mail de uma conta ACABADA DE CRIAR.
 *
 * Recebe o id do usuário que o `signUp` devolveu na própria tela. Como a
 * confirmação de e-mail deixou de ser fronteira de segurança (é isso que esta
 * frente decide), confirmar uma conta alheia não concede nada — quem chamasse
 * com o id de outra pessoa continuaria sem a senha e sem sessão. Ainda assim a
 * função se limita ao caso legítimo: conta que existe, que ainda NÃO está
 * confirmada, e que nasceu nos últimos cinco minutos.
 */
export async function confirmarEmailAutomatico(
  userId: string,
): Promise<ResultadoAutoconfirma> {
  if (typeof userId !== "string" || !/^[0-9a-f-]{36}$/i.test(userId)) {
    return { ok: false, motivo: "nao_encontrado" };
  }

  try {
    const supabase = createServiceRoleClient();

    const { data: atual, error: erroLeitura } =
      await supabase.auth.admin.getUserById(userId);
    if (erroLeitura || !atual?.user) {
      return { ok: false, motivo: "nao_encontrado" };
    }

    // Já confirmado (a env virou, ou a pessoa clicou no link antes): nada a
    // fazer, e isso é sucesso — a tela só precisa saber que pode seguir.
    if (atual.user.email_confirmed_at) return { ok: true };

    const nasceuMs = atual.user.created_at
      ? new Date(atual.user.created_at).getTime()
      : 0;
    if (!nasceuMs || Date.now() - nasceuMs > JANELA_MS) {
      return { ok: false, motivo: "fora_da_janela" };
    }

    // ⚠️ Escrita crítica: o cliente Supabase DEVOLVE o erro em vez de lançar.
    // Sem conferir, uma falha aqui viraria "entrou" na tela e a mãe bateria na
    // porta do login com "confirme seu e-mail" — o defeito que a frente veio
    // corrigir, agora silencioso.
    const { error: erroEscrita } = await supabase.auth.admin.updateUserById(
      userId,
      { email_confirm: true },
    );
    if (erroEscrita) {
      console.error("[signup] autoconfirmacao falhou", {
        userId,
        erro: erroEscrita.message,
      });
      return { ok: false, motivo: "erro" };
    }

    return { ok: true };
  } catch (e) {
    console.error("[signup] autoconfirmacao lancou", {
      userId,
      erro: e instanceof Error ? e.message : String(e),
    });
    return { ok: false, motivo: "erro" };
  }
}
