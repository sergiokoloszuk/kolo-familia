/**
 * Regra ÚNICA de "a assinatura libera o uso?". Usada no guarda de escrita
 * (requireActiveWrite) e no bloqueio de acesso do app (layout).
 *
 * Pega o bug do trial: antes o status ficava "trialing" pra sempre e liberava
 * acesso grátis infinito. Aqui o trial só vale ATÉ trial_ends_at.
 *
 * Libera em: cortesia válida, active, past_due (graça), ou trialing dentro do
 * prazo. Bloqueia em: trial vencido, paused, canceled, ou sem row.
 */
export type AcessoAssinatura = {
  status: string | null;
  trial_ends_at?: string | null;
  cortesia?: boolean | null;
  cortesia_ate?: string | null;
};

export function assinaturaLiberada(sub: AcessoAssinatura | null | undefined): boolean {
  if (!sub) return false;
  const agora = Date.now();

  // Cortesia (comp): libera independente de status. cortesia_ate NULL = vitalícia.
  const cortesiaValida =
    sub.cortesia === true &&
    (!sub.cortesia_ate || new Date(sub.cortesia_ate).getTime() > agora);
  if (cortesiaValida) return true;

  if (sub.status === "active" || sub.status === "past_due") return true;

  if (sub.status === "trialing") {
    // Trial vale só até a data. Sem data (não deveria ocorrer), não trava.
    return !sub.trial_ends_at || new Date(sub.trial_ends_at).getTime() > agora;
  }

  return false;
}

/** True quando o trial existe mas já venceu (pra mensagem específica). */
export function trialVencido(sub: AcessoAssinatura | null | undefined): boolean {
  return (
    sub?.status === "trialing" &&
    !!sub.trial_ends_at &&
    new Date(sub.trial_ends_at).getTime() <= Date.now()
  );
}
