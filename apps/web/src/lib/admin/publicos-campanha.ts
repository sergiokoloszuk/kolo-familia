import { trialValido, type AcessoAssinatura } from "@/lib/auth/assinatura";

/** Grupos visíveis no Admin. Uma família pode estar em mais de um grupo. */
export const GRUPOS_PUBLICO = [
  { id: "todos", nome: "Todos cadastrados", descricao: "Inclusive quem não usa mais a Ayla" },
  { id: "assinantes", nome: "Assinantes", descricao: "Acesso pago ativo registrado na Kolo" },
  { id: "trial", nome: "Trial em andamento", descricao: "Período gratuito ainda válido" },
  { id: "trial_vencido", nome: "Trial vencido", descricao: "Período gratuito terminou" },
  { id: "cancelamento_solicitado", nome: "Cancelamento solicitado", descricao: "Assinatura ainda ativa até o fim do período" },
  { id: "cancelados", nome: "Assinatura cancelada", descricao: "Assinatura encerrada no registro da Kolo" },
  { id: "pagamento_pendente", nome: "Pagamento pendente", descricao: "Cobrança em falha ou atraso" },
  { id: "cortesias", nome: "Cortesias", descricao: "Acesso gratuito concedido e válido" },
  { id: "pausadas", nome: "Pausadas", descricao: "Assinatura suspensa" },
  { id: "revisar", nome: "Revisar cadastro", descricao: "Estado de acesso ausente ou inconsistente" },
] as const;

export type GrupoPublico = (typeof GRUPOS_PUBLICO)[number]["id"];

export type AssinaturaPublico = {
  status?: string | null;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
  stripe_subscription_id?: string | null;
  pagamento_falhou_em?: string | null;
  cancel_at_period_end?: boolean | null;
  cortesia?: boolean | null;
  cortesia_ate?: string | null;
} | null;

export function classificarPublico(
  assinatura: AssinaturaPublico,
  agora: number = Date.now(),
): { grupos: GrupoPublico[]; situacao: string; motivo: string } {
  const grupos: GrupoPublico[] = ["todos"];
  if (!assinatura) {
    return { grupos: [...grupos, "revisar"], situacao: "Sem registro de acesso", motivo: "Não há linha de assinatura na Kolo" };
  }

  const cortesiaValida = assinatura.cortesia === true &&
    (!assinatura.cortesia_ate || new Date(assinatura.cortesia_ate).getTime() > agora);
  if (cortesiaValida) grupos.push("cortesias");

  switch (assinatura.status) {
    case "trialing": {
      const valido = trialValido(assinatura as AcessoAssinatura, agora);
      // Cortesia é um acesso distinto: não anunciar que o teste acabou para
      // alguém que continua com acesso gratuito concedido.
      if (cortesiaValida) {
        return { grupos, situacao: "Cortesia válida", motivo: "Acesso concedido, independentemente da data do trial" };
      }
      grupos.push(valido ? "trial" : "trial_vencido");
      return {
        grupos,
        situacao: valido ? "Trial em andamento" : "Trial vencido",
        motivo: valido ? "Data final do teste ainda futura" : "Data final do teste ausente ou passada",
      };
    }
    case "active": {
      if (assinatura.stripe_subscription_id && !cortesiaValida) {
        grupos.push("assinantes");
        if (assinatura.cancel_at_period_end) grupos.push("cancelamento_solicitado");
        return {
          grupos,
          situacao: assinatura.cancel_at_period_end ? "Cancelamento solicitado" : "Assinatura ativa",
          motivo: assinatura.cancel_at_period_end
            ? "Acesso pago ativo; cancelamento previsto no fim do período"
            : "Status ativo e assinatura Stripe vinculada na Kolo",
        };
      }
      if (cortesiaValida) {
        return { grupos, situacao: "Cortesia válida", motivo: "Cortesia prevalece sobre o status ativo" };
      }
      grupos.push("revisar");
      return { grupos, situacao: "Ativo sem assinatura vinculada", motivo: "Não classificar como pagante sem vínculo Stripe registrado" };
    }
    case "past_due":
      // past_due sem carimbo é usado também para trial encerrado sem cartão.
      // A mesma distinção governa o gate de acesso em assinaturaLiberada.
      if (assinatura.pagamento_falhou_em) {
        grupos.push("pagamento_pendente");
        return { grupos, situacao: "Pagamento pendente", motivo: "Falha de cobrança registrada na Kolo" };
      }
      if (!assinatura.stripe_subscription_id && !cortesiaValida) {
        grupos.push("trial_vencido");
        return { grupos, situacao: "Trial encerrado sem pagamento", motivo: "past_due sem carimbo de falha nem assinatura Stripe" };
      }
      grupos.push("revisar");
      return { grupos, situacao: "Pagamento a revisar", motivo: "past_due sem carimbo de falha; não presumir inadimplência" };
    case "canceled":
      grupos.push("cancelados");
      return { grupos, situacao: cortesiaValida ? "Cancelada · cortesia válida" : "Assinatura cancelada", motivo: "Status de assinatura cancelada na Kolo" };
    case "paused":
      grupos.push("pausadas");
      return { grupos, situacao: "Pausada", motivo: "Assinatura suspensa na Kolo" };
    default:
      grupos.push("revisar");
      return { grupos, situacao: "Status desconhecido", motivo: "Não inferir público de um estado não reconhecido" };
  }
}
