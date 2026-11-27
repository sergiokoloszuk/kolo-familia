import type { SupabaseClient } from "@supabase/supabase-js";
import { lerConfig } from "@/lib/config/geral";
import { nuncaTeveTeste, type AcessoAssinatura } from "@/lib/auth/assinatura";

/**
 * A VIRADA COMERCIAL — 27/11/2026.
 *
 * A partir de uma data escolhida pela responsável, família NOVA não ganha mais
 * dias grátis: ela conhece a Ayla por uma demonstração e assina direto
 * (R$ 54,90/mês ou o anual). Quem já tem teste, cortesia, oferta Black Friday
 * ou assinatura mantém o que tem até o próprio prazo — nada aqui corta direito
 * concedido.
 *
 * ── a data mora no BANCO, não no código ───────────────────────────────────
 *
 * `configuracao_geral` (0068), chave `virada_comercial_em`, valor ISO 8601.
 * Mudar ou adiar a virada é trocar uma linha pelo Admin (`/admin/virada`),
 * sem deploy. Sem a chave, ou com valor inválido, a jornada antiga continua
 * byte a byte — a virada **nunca** liga por engano, e é isso que deixa o
 * código publicado esperando a autorização.
 *
 * ── e a Black Friday? ─────────────────────────────────────────────────────
 *
 * A campanha desliga sozinha em `BLACK_FRIDAY_2026.fimPublicoExclusivo`
 * (01/12 00h de Brasília), no app e nas travas SQL da 0096. Se a virada for
 * adiada, o intervalo volta à jornada que existia antes da campanha — 7 dias,
 * R$ 54,90 — que é coerente em todas as telas e na Ayla. Estender a campanha
 * além de 01/12 é outra decisão: exige migração (a data está no SQL).
 */

export const CHAVE_VIRADA_COMERCIAL = "virada_comercial_em";

/** O instante da virada, ou null quando não está programada/é inválida. */
export function instanteDaVirada(valor: string | null | undefined): number | null {
  if (!valor) return null;
  const ms = Date.parse(valor);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * O campo do Admin é `datetime-local`, sem fuso: é horário de Brasília
 * (UTC−3, sem horário de verão desde 2019). Devolve o instante em UTC.
 */
export function instanteDeBrasilia(valor: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(valor.trim());
  if (!m) return null;
  const ms = instanteDaVirada(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00-03:00`);
  return ms === null ? null : new Date(ms).toISOString();
}

/** O inverso, para preencher o campo com a data já programada. */
export function paraCampoDeBrasilia(iso: string | null): string {
  const ms = instanteDaVirada(iso);
  if (ms === null) return "";
  return new Date(ms - 3 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

/** Puro: a jornada sem teste vale para `agora`? */
export function viradaAtivaEm(
  valor: string | null | undefined,
  agora: Date | number = Date.now(),
): boolean {
  const ms = instanteDaVirada(valor);
  const t = agora instanceof Date ? agora.getTime() : agora;
  return ms !== null && t >= ms;
}

export type EstadoVirada = {
  /** O valor gravado, como está (para o Admin mostrar). */
  programadaPara: string | null;
  /** A jornada nova já vale agora. */
  ativa: boolean;
};

/**
 * Lê a virada. Falha fechada para a jornada ANTIGA: erro de leitura equivale a
 * "não programada", que é o comportamento de hoje.
 */
export async function lerVirada(
  supabase: SupabaseClient,
  agora: Date | number = Date.now(),
): Promise<EstadoVirada> {
  const valor = await lerConfig(supabase, CHAVE_VIRADA_COMERCIAL);
  const programadaPara = instanteDaVirada(valor) !== null ? valor : null;
  return { programadaPara, ativa: viradaAtivaEm(programadaPara, agora) };
}

/** Atalho para quem só precisa saber se a jornada nova vale agora. */
export async function jornadaSemTrial(
  supabase: SupabaseClient,
  agora: Date | number = Date.now(),
): Promise<boolean> {
  return (await lerVirada(supabase, agora)).ativa;
}

/**
 * Esta família chegou pela jornada nova e NUNCA teve teste? Decide o que a
 * Ayla pode dizer a quem ainda não assinou: "seu período grátis acabou" é
 * falso para ela.
 *
 * Só responde `true` com a virada valendo E a linha provando que não houve
 * teste (`nuncaTeveTeste`). Qualquer erro de leitura devolve `false` — o texto
 * antigo, que é o de hoje.
 */
export async function familiaSemTesteAnterior(
  supabase: SupabaseClient,
  familyId: string,
  agora: Date | number = Date.now(),
): Promise<boolean> {
  try {
    if (!(await jornadaSemTrial(supabase, agora))) return false;
    const { data, error } = await supabase
      .from("subscription_accesses")
      .select("status, trial_ends_at, cortesia")
      .eq("family_account_id", familyId)
      .maybeSingle();
    if (error) return false;
    return nuncaTeveTeste((data ?? null) as AcessoAssinatura | null);
  } catch {
    return false;
  }
}
