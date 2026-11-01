import { TRIAL_DIAS } from "@/lib/billing/fatos-comerciais";

const MS_DIA = 86_400_000;
const DATA_BRASILIA = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function diaCivilBrasilia(data: Date): number {
  const partes = Object.fromEntries(
    DATA_BRASILIA.formatToParts(data)
      .filter((parte) => parte.type !== "literal")
      .map((parte) => [parte.type, Number(parte.value)]),
  );
  return Date.UTC(partes.year, partes.month - 1, partes.day) / MS_DIA;
}

function diferencaEmDias(dataFinal: Date, dataInicial: Date): number {
  return diaCivilBrasilia(dataFinal) - diaCivilBrasilia(dataInicial);
}

export type ParticipacaoBlackFridayTrial = {
  trial_inicio_em?: string | null;
  trial_fim_em?: string | null;
} | null;

type EntradaResumoTrial = {
  inicioPadrao: string;
  fim: string;
  hoje: Date;
  participacaoBlackFriday?: ParticipacaoBlackFridayTrial;
};

function dataValida(valor: string | null | undefined): Date | null {
  if (!valor) return null;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
}

/**
 * O Admin atende ao mesmo tempo trials normais de 7 dias e promocionais de
 * 15 dias. A participação da Black Friday é a fonte da duração promocional;
 * sem ela, preservamos a duração comercial normal.
 */
export function resumoTrialAdmin({
  inicioPadrao,
  fim,
  hoje,
  participacaoBlackFriday,
}: EntradaResumoTrial): {
  diasUsados: number;
  diasRestantes: number;
  duracaoDias: number;
} {
  const inicioPromocional = dataValida(participacaoBlackFriday?.trial_inicio_em);
  const fimPromocional = dataValida(participacaoBlackFriday?.trial_fim_em);
  const inicio = inicioPromocional ?? dataValida(inicioPadrao) ?? hoje;
  const fimReal = dataValida(fim) ?? hoje;
  const duracaoPromocional =
    inicioPromocional && fimPromocional
      ? diferencaEmDias(fimPromocional, inicioPromocional)
      : null;
  const duracaoDias =
    duracaoPromocional != null && duracaoPromocional > 0
      ? duracaoPromocional
      : TRIAL_DIAS;

  return {
    diasUsados: Math.min(
      duracaoDias,
      Math.max(1, diferencaEmDias(hoje, inicio) + 1),
    ),
    diasRestantes: diferencaEmDias(fimReal, hoje),
    duracaoDias,
  };
}
