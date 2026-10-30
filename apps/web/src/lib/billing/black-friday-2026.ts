const DIA_MS = 24 * 60 * 60 * 1000;

export const BLACK_FRIDAY_2026 = {
  chave: "black_friday_2026",
  inicio: "2026-10-30T03:00:00.000Z",
  fimPublicoExclusivo: "2026-12-01T03:00:00.000Z",
  diasTrial: 15,
  checkoutSegundos: 30 * 60,
  valorCentavos: 3_990,
  moeda: "brl",
  intervalo: "month",
  intervaloCount: 1,
  priceIdAprovado: "price_1UTQfzPAH1xSrJeSwmrOEor2",
} as const;

export type EstadoBlackFriday = "desligada" | "ativa" | "pausada" | "encerrada";

export function instanteValido(valor: Date | string | number): number | null {
  const ms = valor instanceof Date ? valor.getTime() : new Date(valor).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function janelaPublicaAberta(agora: Date | string | number): boolean {
  const ms = instanteValido(agora);
  return ms !== null &&
    ms >= Date.parse(BLACK_FRIDAY_2026.inicio) &&
    ms < Date.parse(BLACK_FRIDAY_2026.fimPublicoExclusivo);
}

/**
 * O prazo individual termina à meia-noite de Brasília do dia seguinte ao mais
 * tardio entre 30/11 e o dia local do fim do teste. O retorno é exclusivo.
 */
export function fimOfertaIndividualExclusivo(trialEndsAt: Date | string | number): string | null {
  const trialMs = instanteValido(trialEndsAt);
  if (trialMs === null) return null;

  // Novembro de 2026 está em UTC-3. Somar o deslocamento antes de extrair a
  // data evita usar o fuso do servidor (que na Vercel é UTC).
  const brasilia = new Date(trialMs - 3 * 60 * 60 * 1000);
  const ano = brasilia.getUTCFullYear();
  const mes = brasilia.getUTCMonth();
  const dia = brasilia.getUTCDate();
  const fimDoDiaDoTrial = Date.UTC(ano, mes, dia + 1, 3, 0, 0, 0);
  const fimCampanha = Date.parse(BLACK_FRIDAY_2026.fimPublicoExclusivo);
  return new Date(Math.max(fimCampanha, fimDoDiaDoTrial)).toISOString();
}

export function calcularTrialDeQuinzeDias(inicio: Date | string | number): string | null {
  const ms = instanteValido(inicio);
  return ms === null ? null : new Date(ms + BLACK_FRIDAY_2026.diasTrial * DIA_MS).toISOString();
}

/** Completa 15 dias totais de um trial normal de 7 dias sem nunca encurtá-lo. */
export function completarTrialExistente(
  inicioOriginal: Date | string | number,
  fimAtual: Date | string | number,
): string | null {
  const inicioMs = instanteValido(inicioOriginal);
  const fimMs = instanteValido(fimAtual);
  if (inicioMs === null || fimMs === null) return null;
  return new Date(Math.max(fimMs, inicioMs + BLACK_FRIDAY_2026.diasTrial * DIA_MS)).toISOString();
}

export function ofertaDisponivelParaFamilia(args: {
  estado: EstadoBlackFriday;
  agora: Date | string | number;
  ofertaTerminaEm: Date | string | number | null;
}): boolean {
  if ((args.estado !== "ativa" && args.estado !== "pausada") || args.ofertaTerminaEm == null) {
    return false;
  }
  const agora = instanteValido(args.agora);
  const fim = instanteValido(args.ofertaTerminaEm);
  return agora !== null && fim !== null && agora < fim;
}

export function checkoutExpiraEm(agora: Date | string | number): string | null {
  const ms = instanteValido(agora);
  return ms === null
    ? null
    : new Date(ms + BLACK_FRIDAY_2026.checkoutSegundos * 1000).toISOString();
}

export function checkoutFoiConcluidoNoPrazo(args: {
  iniciadoEm: Date | string | number;
  concluidoEm: Date | string | number;
}): boolean {
  const inicio = instanteValido(args.iniciadoEm);
  const fim = instanteValido(args.concluidoEm);
  return inicio !== null && fim !== null && fim >= inicio &&
    fim <= inicio + BLACK_FRIDAY_2026.checkoutSegundos * 1000;
}
