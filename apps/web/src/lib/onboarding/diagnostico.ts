/**
 * Diagnóstico do membro: múltiplos valores + detalhe do "Outro" + hipóteses
 * (quando "Em investigação"). Pra não exigir migração, tudo é guardado no
 * `diagnosticos_formais` (string[]), que continua legível pro relatório:
 *   - concretos viram o rótulo ("TEA", "AH/SD"...)
 *   - "Outro" vira o texto livre digitado (ou "Outro" se vazio)
 *   - hipóteses viram "Hipótese: <rótulo>"
 * O `perfil` (enum único, NOT NULL) recebe o diagnóstico principal, mantendo
 * compatibilidade com tudo que já lê `perfil`.
 */

export const DIAGNOSTICO_OPCOES = [
  { value: "TEA", label: "TEA" },
  { value: "TDAH", label: "TDAH" },
  { value: "Dislexia", label: "Dislexia" },
  { value: "AHSD", label: "AH/SD" },
  { value: "Outro", label: "Outro" },
  { value: "EmInvestigacao", label: "Em investigação" },
] as const;

/** Opções de hipótese = diagnósticos concretos (sem "Em investigação"). */
export const HIPOTESE_OPCOES = DIAGNOSTICO_OPCOES.filter(
  (o) => o.value !== "EmInvestigacao",
);

const LABEL: Record<string, string> = {
  TEA: "TEA",
  TDAH: "TDAH",
  Dislexia: "Dislexia",
  AHSD: "AH/SD",
  Outro: "Outro",
  EmInvestigacao: "Em investigação",
};
const VALUE_BY_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(LABEL).map(([v, l]) => [l, v]),
);
const HIPOTESE_PREFIX = "Hipótese: ";

export type DiagnosticoSel = {
  diagnosticos: string[];
  outro: string | null;
  hipoteses: string[];
};

/** Diagnóstico principal pro campo `perfil` (enum único). */
export function perfilPrimario(diagnosticos: string[]): string {
  for (const o of ["TEA", "TDAH", "Dislexia", "AHSD"]) {
    if (diagnosticos.includes(o)) return o;
  }
  if (diagnosticos.includes("EmInvestigacao")) return "EmInvestigacao";
  return "Outro";
}

/** Monta o `diagnosticos_formais` (string[] legível) a partir da seleção. */
export function buildDiagnosticosFormais(sel: DiagnosticoSel): string[] {
  const out: string[] = [];
  for (const d of sel.diagnosticos) {
    if (d === "Outro") out.push(sel.outro?.trim() || "Outro");
    else out.push(LABEL[d] ?? d);
  }
  for (const h of sel.hipoteses) out.push(`${HIPOTESE_PREFIX}${LABEL[h] ?? h}`);
  return out;
}

/** Resumo legível dos diagnósticos pra exibir (ex.: "TEA, TDAH, investigando Dislexia"). */
export function resumoDiagnostico(formais: unknown, perfilFallback: string): string {
  const sel = parseDiagnosticosFormais(formais, perfilFallback);
  const partes = sel.diagnosticos
    .filter((d) => d !== "EmInvestigacao")
    .map((d) => (d === "Outro" ? sel.outro?.trim() || "Outro" : LABEL[d] ?? d));
  if (sel.diagnosticos.includes("EmInvestigacao")) {
    const hip = sel.hipoteses.map((h) => LABEL[h] ?? h);
    partes.push(hip.length > 0 ? `investigando ${hip.join(", ")}` : "em investigação");
  }
  return partes.join(", ");
}

/** Reconstrói a seleção a partir do `diagnosticos_formais` salvo. */
export function parseDiagnosticosFormais(
  formais: unknown,
  perfilFallback: string,
): DiagnosticoSel {
  const arr = Array.isArray(formais) ? (formais as unknown[]) : [];
  if (arr.length === 0) {
    return {
      diagnosticos: perfilFallback ? [perfilFallback] : [],
      outro: null,
      hipoteses: [],
    };
  }
  const diagnosticos: string[] = [];
  const hipoteses: string[] = [];
  let outro: string | null = null;
  for (const raw of arr) {
    if (typeof raw !== "string") continue;
    if (raw.startsWith(HIPOTESE_PREFIX)) {
      const lbl = raw.slice(HIPOTESE_PREFIX.length);
      const v = VALUE_BY_LABEL[lbl] ?? "Outro";
      if (!hipoteses.includes(v)) hipoteses.push(v);
    } else if (VALUE_BY_LABEL[raw]) {
      const v = VALUE_BY_LABEL[raw];
      if (!diagnosticos.includes(v)) diagnosticos.push(v);
    } else {
      if (!diagnosticos.includes("Outro")) diagnosticos.push("Outro");
      outro = raw;
    }
  }
  return { diagnosticos, outro, hipoteses };
}
