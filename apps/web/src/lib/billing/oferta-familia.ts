import type { SupabaseClient } from "@supabase/supabase-js";
import {
  checkoutExpiraEm,
  ofertaDisponivelParaFamilia,
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

type LinhaMinhaOferta = {
  participa: boolean;
  trial_fim_em: string;
  oferta_fim_exclusivo: string;
};

/**
 * Decide no servidor, a partir da sessão autenticada. Nenhum campo vindo do
 * navegador escolhe preço, prazo ou elegibilidade.
 */
export async function resolverOfertaDaFamilia(
  supabase: SupabaseClient,
  agora = new Date(),
): Promise<OfertaDaFamilia | null> {
  const estado = await lerEstadoBlackFriday(supabase);
  if (estado !== "ativa" && estado !== "pausada") return null;

  const { data, error } = await supabase.rpc("minha_oferta_black_friday_2026");
  if (error) return null;
  const linha = (Array.isArray(data) ? data[0] : data) as LinhaMinhaOferta | null;
  if (!linha?.participa || !ofertaDisponivelParaFamilia({
    estado,
    agora,
    ofertaTerminaEm: linha.oferta_fim_exclusivo,
  })) return null;

  const preco = await lerOfertaBlackFridayNoStripe();
  if (!preco.ok || !preco.priceId || preco.valorCentavos == null) return null;
  const iniciado = agora.toISOString();
  const expira = checkoutExpiraEm(agora);
  if (!expira) return null;

  return {
    priceId: preco.priceId,
    valorCentavos: preco.valorCentavos,
    trialFimEm: linha.trial_fim_em,
    ofertaFimExclusivo: linha.oferta_fim_exclusivo,
    checkoutIniciadoEm: iniciado,
    checkoutExpiraEm: expira,
  };
}
