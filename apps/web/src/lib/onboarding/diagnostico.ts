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

/**
 * O bloco `<diagnostico_registrado>` que vai pro prompt da Ayla, nos DOIS canais.
 *
 * Por que existe: até 01/08/2026 a conversa recebia só `perfil` — o enum único.
 * A distinção entre diagnóstico CONFIRMADO e HIPÓTESE em investigação existia no
 * banco (`diagnosticos_formais`, com o prefixo "Hipótese: "), era capturada no
 * onboarding e era lida pelo relatório — e não chegava a canal nenhum. Quando a
 * família tinha marcado "Em investigação", o que o modelo lia era a string crua
 * `perfil EmInvestigacao`: um código opaco, que ele tinha que adivinhar. Foi
 * assim que a Ayla respondeu a uma mãe como se não houvesse nada registrado, e
 * depois preencheu o vazio com a própria conclusão.
 *
 * O bloco é declarativo de propósito: ele NÃO instrui o modelo a se conter (isso
 * é da FRONTEIRA DO DIAGNÓSTICO, no núcleo). Ele só diz, sem ambiguidade, o que
 * a família afirmou × o que ela está investigando — as duas coisas que o modelo
 * não pode inferir sozinho e não pode confundir.
 *
 * Devolve `null` quando não há nada registrado (nenhum bloco entra no prompt).
 */
export function blocoDiagnosticoRegistrado(
  formais: unknown,
  perfilFallback: string | null,
  nome: string,
): string | null {
  const sel = parseDiagnosticosFormais(formais, perfilFallback ?? "");
  const confirmados = sel.diagnosticos
    .filter((d) => d !== "EmInvestigacao")
    .map((d) => (d === "Outro" ? sel.outro?.trim() || "Outro" : LABEL[d] ?? d));
  const hipoteses = sel.hipoteses.map((h) => LABEL[h] ?? h);
  const investigando = sel.diagnosticos.includes("EmInvestigacao");

  if (confirmados.length === 0 && hipoteses.length === 0 && !investigando) return null;

  const linhas: string[] = [];
  if (confirmados.length > 0) {
    linhas.push(
      `CONFIRMADO pela família: ${confirmados.join(", ")}. Isto ${nome} tem — a família informou. Fale disso com naturalidade e planeje em cima; nunca responda "não posso falar de diagnóstico" sobre o que ela mesma registrou.`,
    );
  } else {
    linhas.push(
      `CONFIRMADO pela família: nenhum. Ninguém informou diagnóstico fechado de ${nome}.`,
    );
  }
  if (investigando || hipoteses.length > 0) {
    linhas.push(
      hipoteses.length > 0
        ? `EM INVESTIGAÇÃO (hipótese da família, NÃO é diagnóstico): ${hipoteses.join(", ")}. Isto é o que estão suspeitando — trate como pergunta aberta, nunca como confirmado, e não confirme nem descarte você.`
        : `EM INVESTIGAÇÃO: a família marcou que ainda está investigando, sem hipótese nomeada. Nada está fechado.`,
    );
  }
  linhas.push(
    `Esta é a lista COMPLETA do que está registrado. O que não está aqui, não foi diagnosticado — e você não preenche a lacuna com dedução sua.`,
  );
  return `<diagnostico_registrado>\n${linhas.join("\n")}\n</diagnostico_registrado>`;
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
