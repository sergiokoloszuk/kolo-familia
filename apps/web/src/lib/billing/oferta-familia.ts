import type { SupabaseClient } from "@supabase/supabase-js";
import {
  checkoutExpiraEm,
  janelaPublicaAberta,
  ofertaDisponivelParaFamilia,
  type EstadoBlackFriday,
} from "./black-friday-2026";
import { lerEstadoBlackFriday } from "./estado-black-friday";
import { lerOfertaBlackFridayNoStripe } from "./oferta-black-friday";

export type OfertaDaFamilia = {
  priceId: string;
  valorCentavos: number;
  trialFimEm: string;
  ofertaFimExclusivo: string;
  checkoutIniciadoEm: string;
  checkoutExpiraEm: string;
};

export type SituacaoBlackFridayDaFamilia = {
  estado: EstadoBlackFriday;
  consultaConfiavel: boolean;
  participa: boolean;
  direitoAoPreco: boolean;
  oferta: OfertaDaFamilia | null;
};

type LinhaMinhaOferta = {
  participa: boolean;
  trial_fim_em: string;
  oferta_fim_exclusivo: string;
};

export type AssinaturaParaReentradaBlackFriday = {
  status?: string | null;
  trial_ends_at?: string | null;
  cortesia?: boolean | null;
  cortesia_ate?: string | null;
  pagamento_falhou_em?: string | null;
};

/**
 * Decide se uma conta sem acesso pode pedir voluntariamente o novo teste.
 *
 * Esta regra vive fora da página para o bloqueio global e a tela de assinatura
 * não divergirem. Pagante, cortesia e pagamento em recuperação nunca entram.
 */
export function podeSolicitarTrialBlackFriday(args: {
  assinatura: AssinaturaParaReentradaBlackFriday | null | undefined;
  consultaConfiavel: boolean;
  jaParticipa: boolean;
  estado: EstadoBlackFriday;
  agora?: Date;
}): boolean {
  const agora = args.agora ?? new Date();
  if (!args.consultaConfiavel || args.jaParticipa || args.estado !== "ativa" ||
    !janelaPublicaAberta(agora)) {
    return false;
  }

  const assinatura = args.assinatura;
  const cortesiaVigente = assinatura?.cortesia === true &&
    (!assinatura.cortesia_ate ||
      new Date(assinatura.cortesia_ate).getTime() > agora.getTime());
  if (cortesiaVigente) return false;

  const trialVencido = assinatura?.status === "trialing" &&
    Boolean(assinatura.trial_ends_at) &&
    new Date(assinatura!.trial_ends_at as string).getTime() <= agora.getTime();

  return trialVencido || assinatura?.status === "canceled" ||
    (assinatura?.status === "past_due" && !assinatura.pagamento_falhou_em);
}

/**
 * Decide no servidor, a partir da sessão autenticada. Nenhum campo vindo do
 * navegador escolhe preço, prazo ou elegibilidade.
 */
export async function resolverOfertaDaFamilia(
  supabase: SupabaseClient,
  agora = new Date(),
): Promise<OfertaDaFamilia | null> {
  return (await resolverSituacaoBlackFridayDaFamilia(supabase, agora)).oferta;
}

/**
 * Mantém separados dois fatos diferentes: a conta já participou e o preço
 * está disponível agora. Uma falha temporária no Stripe não pode fazer uma
 * participante parecer elegível para ganhar um segundo trial.
 */
export async function resolverSituacaoBlackFridayDaFamilia(
  supabase: SupabaseClient,
  agora = new Date(),
): Promise<SituacaoBlackFridayDaFamilia> {
  const estado = await lerEstadoBlackFriday(supabase);
  if (estado !== "ativa" && estado !== "pausada") {
    return {
      estado,
      consultaConfiavel: true,
      participa: false,
      direitoAoPreco: false,
      oferta: null,
    };
  }

  const { data, error } = await supabase.rpc("minha_oferta_black_friday_2026");
  if (error) {
    return {
      estado,
      consultaConfiavel: false,
      participa: false,
      direitoAoPreco: false,
      oferta: null,
    };
  }
  const linha = (Array.isArray(data) ? data[0] : data) as LinhaMinhaOferta | null;
  const participa = linha?.participa === true;
  const direitoAoPreco = participa && ofertaDisponivelParaFamilia({
    estado,
    agora,
    ofertaTerminaEm: linha!.oferta_fim_exclusivo,
  });
  if (!direitoAoPreco) {
    return {
      estado,
      consultaConfiavel: true,
      participa,
      direitoAoPreco,
      oferta: null,
    };
  }

  const preco = await lerOfertaBlackFridayNoStripe();
  if (!preco.ok || !preco.priceId || preco.valorCentavos == null) {
    return {
      estado,
      consultaConfiavel: true,
      participa,
      direitoAoPreco,
      oferta: null,
    };
  }
  const iniciado = agora.toISOString();
  const expira = checkoutExpiraEm(agora);
  if (!expira) {
    return {
      estado,
      consultaConfiavel: true,
      participa,
      direitoAoPreco,
      oferta: null,
    };
  }

  return {
    estado,
    consultaConfiavel: true,
    participa,
    direitoAoPreco,
    oferta: {
      priceId: preco.priceId,
      valorCentavos: preco.valorCentavos,
      trialFimEm: linha.trial_fim_em,
      ofertaFimExclusivo: linha.oferta_fim_exclusivo,
      checkoutIniciadoEm: iniciado,
      checkoutExpiraEm: expira,
    },
  };
}
