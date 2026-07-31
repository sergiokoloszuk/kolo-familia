/**
 * DATA CIVIL — o contrato de `observado_em`.
 *
 * Dois defeitos reais, os dois medidos contra Postgres:
 *
 * 1. O Postgres ACEITA um ISO com hora numa coluna `date` e **trunca em
 *    silêncio**. `2026-08-10T23:45:00Z` vira `2026-08-10` sem aviso — e se a
 *    intenção era outro fuso, virou o dia errado sem ninguém saber.
 *
 * 2. Ler a coluna como `Date` e formatar em horário local **desloca um dia no
 *    Brasil**: `2026-08-10` vira `09/08/2026`. Medido no harness. O banco
 *    guarda certo; quem desloca é o JavaScript.
 *
 * A regra que resolve os dois: **data civil é STRING, não `Date`.**
 *
 * "10 de agosto" não é um instante — é um dia do calendário. Convertê-lo em
 * `Date` acrescenta uma hora que não existe, e toda hora inventada carrega um
 * fuso inventado junto. O tipo certo para um dia é `"YYYY-MM-DD"`, e ele
 * atravessa serialização, fuso e ambiente sem mudar de significado.
 *
 * Nada aqui converte para `Date`. É de propósito.
 */

const DATA_CIVIL = /^\d{4}-\d{2}-\d{2}$/;

/** Uma data de calendário, sem hora e sem fuso. */
export type DataCivil = string & { readonly __tipo: "DataCivil" };

export function ehDataCivil(v: unknown): v is DataCivil {
  if (typeof v !== "string" || !DATA_CIVIL.test(v)) return false;
  const [a, m, d] = v.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  // Rejeita 31 de fevereiro e companhia, sem construir Date local.
  const dias = [31, a % 4 === 0 && (a % 100 !== 0 || a % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d <= dias[m - 1];
}

export type NormalizacaoData =
  | { ok: true; data: DataCivil; truncou: boolean }
  | { ok: false; motivo: "formato_invalido" | "vazio" };

/**
 * Normaliza para data civil, **de forma consciente**.
 *
 * Um timestamp não é rejeitado — seria perder informação que a família deu.
 * Ele é truncado, e o `truncou: true` obriga quem chama a saber que houve
 * perda. A alternativa (deixar o Postgres truncar) esconde a decisão dentro do
 * banco, que é onde ninguém olha.
 *
 * O fuso usado no truncamento é o de São Paulo, porque a data que interessa é
 * o dia em que a coisa aconteceu **para a família** — não em UTC.
 */
export function normalizarDataCivil(
  bruto: string | null | undefined,
  timeZone = "America/Sao_Paulo",
): NormalizacaoData {
  const v = (bruto ?? "").trim();
  if (!v) return { ok: false, motivo: "vazio" };

  if (DATA_CIVIL.test(v)) {
    return ehDataCivil(v)
      ? { ok: true, data: v as DataCivil, truncou: false }
      : { ok: false, motivo: "formato_invalido" };
  }

  // Timestamp: converte para o DIA no fuso da família, explicitamente.
  const t = Date.parse(v);
  if (Number.isNaN(t)) return { ok: false, motivo: "formato_invalido" };
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(t));
  return ehDataCivil(partes)
    ? { ok: true, data: partes as DataCivil, truncou: true }
    : { ok: false, motivo: "formato_invalido" };
}

/**
 * Formata para exibição sem passar por `Date`.
 *
 * `new Date("2026-08-10").toLocaleDateString("pt-BR")` devolve **09/08/2026**
 * no Brasil. Esta função devolve 10/08/2026, porque não inventa hora nenhuma.
 */
export function exibirDataCivil(data: string): string {
  if (!DATA_CIVIL.test(data)) return data;
  const [a, m, d] = data.split("-");
  return `${d}/${m}/${a}`;
}

// ============================================================
// Expressão temporal original
// ============================================================

/**
 * Expressões de tempo que a família usa. Guardadas COMO DITAS, sem resolver.
 *
 * "desde a troca de professora" não vira data — vira `tempo_original`. Resolver
 * isso exige saber quando foi a troca, e essa é outra conversa. O que não pode
 * acontecer é a expressão se perder na captura: `observado_em` guardaria a data
 * da mensagem, e a informação de que o relato é retrospectivo sumiria.
 */
const EXPRESSOES: readonly RegExp[] = [
  /\b(ontem|anteontem|hoje de manh[ãa]|semana passada|m[êe]s passado|ano passado)\b/i,
  /\b(desde|depois d[aeo]|antes d[aeo]|a partir d[aeo])\s+\w+/i,
  /\b(faz|h[áa])\s+(uns?|umas?)?\s*\w+\s+(dias?|semanas?|meses|anos?)\b/i,
  /\b(ultimamente|recentemente|ha pouco|h[áa] pouco|nos [úu]ltimos)\b/i,
];

/** Devolve a expressão temporal encontrada, ou null. Não resolve nada. */
export function extrairTempoOriginal(texto: string | null | undefined): string | null {
  const t = (texto ?? "").trim();
  if (!t) return null;
  for (const re of EXPRESSOES) {
    const m = t.match(re);
    if (m) return m[0].trim().slice(0, 120);
  }
  return null;
}
