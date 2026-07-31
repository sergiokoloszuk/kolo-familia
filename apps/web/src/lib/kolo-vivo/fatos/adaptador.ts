import type { CandidatoFato, Escopo, Proveniencia, VerificationStatus } from "./tipos";

/**
 * ADAPTADOR: o que o extrator já produz → candidato a fato.
 *
 * O extrator atual devolve `{ campo, subcampo, texto }` — domínio e frase, sem
 * conceito canônico. Uma restrição desta rodada é **não aumentar o número de
 * chamadas de IA por turno**, então o conceito é DERIVADO do que já existe, e
 * não classificado por um modelo novo.
 *
 * A derivação é deliberadamente burra: `dominio.subcampo` (ou só `dominio`).
 * Isso dá uma chave estável e agrupável, suficiente para contar recorrência por
 * área — que é tudo que a maturação vai precisar no começo. Uma taxonomia
 * canônica de verdade ("autonomy.requests_water") exige curadoria e é trabalho
 * de outra rodada; inventá-la aqui, por heurística de texto, produziria
 * conceitos instáveis que teriam de ser refeitos depois.
 *
 * A `extractor_version` marca esta escolha, então quando a taxonomia real
 * existir dá para reprocessar sem confundir com o que já foi gravado.
 */

/** Slug conservador: sem acento, minúsculo, separado por underscore. */
export function slug(s: string): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

/** `dominio.subcampo` quando há subcampo; senão só o domínio. */
export function derivarConceito(campo: string, subcampo?: string | null): string {
  const d = slug(campo);
  const s = subcampo ? slug(subcampo) : "";
  return s ? `${d}.${s}` : d;
}

export type EntradaAdaptador = {
  familyId: string;
  membroId: string | null;
  campo: string;
  subcampo?: string | null;
  texto: string;
  proveniencia: Proveniencia;
  escopo?: Escopo;
  observadoEm?: string | null;
  contexto?: string | null;
  /** Ausente = default do servico (`reported`, ou `inferred` se a fonte e IA). */
  verificationStatus?: VerificationStatus;
};

/**
 * Monta o candidato.
 *
 * Note o que NÃO é decidido aqui: `factKind` fica no default `statement`, e
 * `verificationStatus` fica no default `reported` (ou `inferred`, imposto pelo
 * serviço quando a fonte é a IA). Classificar como traço ou preferência exigiria
 * julgamento que este adaptador não tem — e errar para o lado conservador é o
 * comportamento certo: um evento isolado nunca vira característica permanente
 * só porque pareceu relevante.
 */
export function candidatoDeItemKoloVivo(e: EntradaAdaptador): CandidatoFato {
  return {
    familyId: e.familyId,
    membroId: e.membroId,
    conceito: derivarConceito(e.campo, e.subcampo),
    dominio: slug(e.campo),
    afirmacao: (e.texto ?? "").trim(),
    contexto: e.contexto ?? null,
    observadoEm: e.observadoEm ?? null,
    observadoEmPreciso: false,
    escopo: e.escopo,
    proveniencia: e.proveniencia,
    verificationStatus: e.verificationStatus,
  };
}
