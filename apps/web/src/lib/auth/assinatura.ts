/**
 * Regra ÚNICA de "a assinatura libera o uso?". Usada no guarda de escrita
 * (requireActiveWrite) e no bloqueio de acesso do app (layout).
 *
 * Pega o bug do trial: antes o status ficava "trialing" pra sempre e liberava
 * acesso grátis infinito. Aqui o trial só vale ATÉ trial_ends_at.
 *
 * Falha de pagamento (dunning): `past_due` dá GRACA_DIAS de graça a partir da
 * falha (carimbada em `pagamento_falhou_em`); depois BLOQUEIA. Os dados ficam
 * guardados até RETENCAO_DIAS da falha — depois um cron apaga (ver o cron de
 * exclusão). Recuperou o pagamento → status volta a active + carimbo limpo.
 *
 * Libera em: cortesia válida, active, trialing dentro do prazo, past_due dentro
 * da graça (com carimbo). Bloqueia em: trial vencido, trialing sem data,
 * past_due SEM carimbo (trial encerrado sem cartão), paused, canceled, past_due
 * fora da graça, ou sem row.
 */

const MS_DIA = 24 * 60 * 60 * 1000;
export const GRACA_DIAS = 2; // acesso continua por 2 dias após a 1ª falha
export const RETENCAO_DIAS = 7; // dados guardados por 7 dias após a falha

export type AcessoAssinatura = {
  status: string | null;
  trial_ends_at?: string | null;
  cortesia?: boolean | null;
  cortesia_ate?: string | null;
  /** Carimbo da 1ª falha de pagamento (dunning). Limpo quando regulariza. */
  pagamento_falhou_em?: string | null;
};

export function assinaturaLiberada(sub: AcessoAssinatura | null | undefined): boolean {
  if (!sub) return false;
  const agora = Date.now();

  // Cortesia (comp): libera independente de status. cortesia_ate NULL = vitalícia.
  const cortesiaValida =
    sub.cortesia === true &&
    (!sub.cortesia_ate || new Date(sub.cortesia_ate).getTime() > agora);
  if (cortesiaValida) return true;

  if (sub.status === "active") return true;

  // Falha de pagamento (dunning): 2 dias de graça a partir da falha CARIMBADA
  // (invoice.payment_failed), depois bloqueia. SEM carimbo = past_due que veio
  // de TRIAL ENCERRADO sem cartão — não é dunning de assinante → BLOQUEIA.
  // (Antes liberava por engano e virava acesso grátis eterno.)
  if (sub.status === "past_due") {
    if (!sub.pagamento_falhou_em) return false;
    const dias = (agora - new Date(sub.pagamento_falhou_em).getTime()) / MS_DIA;
    return dias < GRACA_DIAS;
  }

  if (sub.status === "trialing") return trialValido(sub, agora);

  return false;
}

/**
 * O TESTE AINDA VALE? Predicado positivo do trial, em um lugar só.
 *
 * `trialVencido` responde "passou da data" e exige que a data exista — então
 * `trialing` SEM data não é "vencido" por ela, mas também não libera nada. Quem
 * precisa saber "esta família está em teste de verdade?" (o gate de acesso e a
 * contagem do funil) tem que fazer a mesma pergunta, e é esta função.
 *
 * Sem isto, uma contagem por `status` conta como "em teste" quem já saiu dele.
 */
export function trialValido(
  sub: AcessoAssinatura | null | undefined,
  agora: number = Date.now(),
): boolean {
  if (sub?.status !== "trialing") return false;
  return !!sub.trial_ends_at && new Date(sub.trial_ends_at).getTime() > agora;
}

/**
 * Acesso encerrado porque o TESTE acabou sem assinar — trial vencido OU
 * past_due sem carimbo de dunning (trial que virou past_due sem cartão).
 * Usado pra mostrar "seu período grátis acabou" em vez de "assine pra continuar".
 */
export function acessoEncerradoSemPagar(sub: AcessoAssinatura | null | undefined): boolean {
  if (!sub) return false;
  if (sub.status === "trialing")
    return !!sub.trial_ends_at && new Date(sub.trial_ends_at).getTime() <= Date.now();
  if (sub.status === "past_due") return !sub.pagamento_falhou_em;
  return false;
}

/**
 * O teste JÁ NASCEU vencido — é quem apagou a conta e cadastrou de novo com o
 * mesmo e-mail/WhatsApp (migração 0065 fecha a brecha dos "7 dias infinitos").
 * Serve pra falar a verdade na tela: "seu período grátis acabou" confundiria
 * quem acabou de criar a conta e nunca usou NESSA conta.
 *
 * Sinal: trial_ends_at praticamente igual à criação da assinatura (o trigger
 * grava now() em vez de now() + 7 dias). Tolerância de 1 minuto pro tempo entre
 * os dois inserts.
 */
export function testeJaUsadoAntes(
  sub: (AcessoAssinatura & { created_at?: string | null }) | null | undefined,
): boolean {
  if (!sub?.trial_ends_at || !sub.created_at) return false;
  const fim = new Date(sub.trial_ends_at).getTime();
  const criado = new Date(sub.created_at).getTime();
  if (!Number.isFinite(fim) || !Number.isFinite(criado)) return false;
  return fim - criado < 60_000;
}

/** True quando o trial existe mas já venceu (pra mensagem específica). */
export function trialVencido(sub: AcessoAssinatura | null | undefined): boolean {
  return (
    sub?.status === "trialing" &&
    !!sub.trial_ends_at &&
    new Date(sub.trial_ends_at).getTime() <= Date.now()
  );
}

/** Está no fluxo de falha de pagamento (past_due/canceled com carimbo)? */
export function pagamentoEmFalha(sub: AcessoAssinatura | null | undefined): boolean {
  return !!sub?.pagamento_falhou_em && (sub.status === "past_due" || sub.status === "canceled");
}

/** Dias restantes até a exclusão dos dados (a partir da falha), ou null. */
export function diasAteExclusao(sub: AcessoAssinatura | null | undefined): number | null {
  if (!sub?.pagamento_falhou_em) return null;
  const dias = Math.floor((Date.now() - new Date(sub.pagamento_falhou_em).getTime()) / MS_DIA);
  return Math.max(0, RETENCAO_DIAS - dias);
}
