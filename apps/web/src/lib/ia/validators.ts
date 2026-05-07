/**
 * Validadores pós-resposta — PRD §7.4.4.
 *
 * Cada validator retorna { ok: true } ou { ok: false, motivo, sugestao? }.
 * Quando falha, o engine pode regenerar com prompt ajustado.
 */

export type ValidationResult =
  | { ok: true }
  | { ok: false; motivo: string; sugestao?: string };

/**
 * Anti-cópia (PRD §11): se uma Boa Prática aparece quase literalmente na
 * resposta, regenera. Implementação simples: substring inclusion.
 */
export function validateAntiCopy(
  resposta: string,
  boasPraticas: { versao_curta: string; versao_conversa: string | null }[],
  threshold = 0.8,
): ValidationResult {
  const respLower = normalize(resposta);
  for (const bp of boasPraticas) {
    for (const versao of [bp.versao_curta, bp.versao_conversa].filter(
      Boolean,
    ) as string[]) {
      if (versao.length < 30) continue;
      const versaoLower = normalize(versao);
      if (respLower.includes(versaoLower)) {
        return {
          ok: false,
          motivo: "Resposta copia literalmente uma Boa Prática.",
          sugestao: "Reescreva com suas palavras, integrando a ideia.",
        };
      }
      if (jaccardSimilarity(respLower, versaoLower) > threshold) {
        return {
          ok: false,
          motivo: "Resposta muito parecida com uma Boa Prática.",
          sugestao: "Reescreva com suas palavras, integrando a ideia.",
        };
      }
    }
  }
  return { ok: true };
}

/**
 * Anti-substituição-profissional: lista negra de termos clínicos
 * prescritivos. Quando aparecem, redirecionar pra profissional.
 */
const TERMOS_CLINICOS_PRESCRITIVOS = [
  /\bdiagnóstic[oa]\b/i,
  /\bdiagnostiq[ue]/i,
  /\bprognóstico\b/i,
  /\btratamento\b/i,
  /\bcura\b/i,
  /\bmedicaç[ãa]o\b/i,
  /\breceit[ao]\b/i,
  /\bvocê deveria (tomar|dar)\b/i,
];

export function validateAntiSubstituicaoProfissional(
  resposta: string,
): ValidationResult {
  for (const re of TERMOS_CLINICOS_PRESCRITIVOS) {
    const m = resposta.match(re);
    if (m) {
      return {
        ok: false,
        motivo: `Termo clínico prescritivo detectado: "${m[0]}"`,
        sugestao:
          "Remova os termos clínicos. Se for o caso, redirecione: 'isso é com profissional de saúde'.",
      };
    }
  }
  return { ok: true };
}

/**
 * Anti-comparação: PRD §7.4.4. Detecta termos como "outras crianças",
 * "o normal seria".
 */
const COMPARACOES_PROIBIDAS = [
  /\boutras crianças\b/i,
  /\boutras pessoas (com|que)\b/i,
  /\bo normal seria\b/i,
  /\bnormalmente as crianças\b/i,
  /\bdeveria estar\b/i,
];

export function validateAntiComparacao(resposta: string): ValidationResult {
  for (const re of COMPARACOES_PROIBIDAS) {
    const m = resposta.match(re);
    if (m) {
      return {
        ok: false,
        motivo: `Comparação proibida detectada: "${m[0]}"`,
        sugestao: "Reescreva sem comparar com outras crianças ou referências do 'normal'.",
      };
    }
  }
  return { ok: true };
}

/**
 * Anti-alarme: termos como "preocupante", "grave", "urgente" fora de
 * contexto de risco real.
 */
const TERMOS_ALARMISTAS = [
  /\bpreocupante\b/i,
  /\bgrave\b/i,
  /\burgente\b/i,
  /\balarmante\b/i,
  /\bsério\b/i,
];

export function validateAntiAlarme(resposta: string): ValidationResult {
  for (const re of TERMOS_ALARMISTAS) {
    const m = resposta.match(re);
    if (m) {
      return {
        ok: false,
        motivo: `Termo alarmista: "${m[0]}"`,
        sugestao: "Reescreva com tom mais sereno, sem palavras alarmistas.",
      };
    }
  }
  return { ok: true };
}

/**
 * Tamanho ≤ 350 palavras (sem contar o bloco "registrar este papo").
 */
export function validateTamanho(resposta: string, maxPalavras = 350): ValidationResult {
  const semBloco = resposta.replace(
    /Registrar este papo[\s\S]*$/i,
    "",
  );
  const palavras = semBloco
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (palavras.length > maxPalavras) {
    return {
      ok: false,
      motivo: `Resposta tem ${palavras.length} palavras (máx ${maxPalavras}).`,
      sugestao: "Encurte mantendo as 7 partes.",
    };
  }
  return { ok: true };
}

/**
 * Roda todos os validadores em sequência. Retorna o primeiro erro ou
 * { ok: true } se todos passaram.
 */
export function runAllValidators(
  resposta: string,
  boasPraticas: { versao_curta: string; versao_conversa: string | null }[],
): ValidationResult {
  for (const v of [
    () => validateAntiSubstituicaoProfissional(resposta),
    () => validateAntiComparacao(resposta),
    () => validateAntiAlarme(resposta),
    () => validateTamanho(resposta),
    () => validateAntiCopy(resposta, boasPraticas),
  ]) {
    const r = v();
    if (!r.ok) return r;
  }
  return { ok: true };
}

// ---------- helpers ----------

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function jaccardSimilarity(a: string, b: string): number {
  const tokensA = new Set(a.split(/\s+/).filter((t) => t.length > 3));
  const tokensB = new Set(b.split(/\s+/).filter((t) => t.length > 3));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let inter = 0;
  for (const t of tokensA) if (tokensB.has(t)) inter++;
  const union = tokensA.size + tokensB.size - inter;
  return inter / union;
}
