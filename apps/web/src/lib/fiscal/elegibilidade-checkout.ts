export type EstadoCheckoutDaFamilia = {
  status?: string | null;
  stripeSubscriptionId?: string | null;
  checkoutConcluidoEm?: string | null;
};

/**
 * Uma assinatura existente é dona da cobrança. O status interno pode continuar
 * `trialing` durante o trial da Stripe, por isso o vínculo e a conclusão do
 * checkout têm precedência sobre o rótulo de acesso.
 */
export function jaPossuiAssinaturaOuCheckoutConcluido(
  estado: EstadoCheckoutDaFamilia,
): boolean {
  // Assinatura cancelada é terminal e pode ser recontratada pelo preço vigente.
  // A RPC promocional continua impedindo reutilizar a mesma oferta Black Friday.
  if (estado.status === "canceled" && !estado.checkoutConcluidoEm) return false;
  return estado.status === "active" ||
    Boolean(estado.stripeSubscriptionId) ||
    Boolean(estado.checkoutConcluidoEm);
}
