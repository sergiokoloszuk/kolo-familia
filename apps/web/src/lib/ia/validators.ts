/**
 * Validadores pós-resposta — PRD §7.4.4 + Adendo PRD §4.
 *
 * Cada validator retorna { ok: true } ou { ok: false, motivo, sugestao? }.
 * Quando falha, o engine pode regenerar com prompt ajustado.
 */

import { createServiceRoleClient } from "@/lib/supabase/server";
import { acharConclusaoDiagnostica } from "@/lib/conducao/deteccao-diagnostico";
import { acharConclusaoClinica } from "@/lib/conducao/deteccao-clinica";

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
 * Anti-substituição-profissional.
 *
 * AUDITORIA DA CLASSE INTEIRA (01/08/2026). A lista original era de PALAVRAS
 * clínicas, e uma lista de palavras erra nos dois sentidos — sempre. Não era um
 * problema da palavra "diagnóstico": era do método.
 *
 * O que ela BARRAVA e não devia (respostas seguras):
 *   - "quem fecha um diagnóstico é o médico"            -> a ressalva honesta
 *   - "leve essa dúvida a quem prescreveu a medicação"  -> a redireção CERTA
 *   - "quem acompanha o tratamento dele decide isso"    -> a redireção CERTA
 *   - "não existe cura, e não é disso que se trata"     -> verdadeiro e acolhedor
 *   - "posso te dar uma receita simples de panqueca"    -> num produto que fala
 *     de seletividade alimentar o dia inteiro, "receita" é vocabulário comum
 *
 * O que ela DEIXAVA PASSAR e é perigoso (nenhuma usa palavra da lista):
 *   - "pode dar meia dose e ver como ele fica"
 *   - "experimenta suspender por uns dias"
 *   - "isso é efeito colateral, com certeza"
 *   - "melatonina é segura pra criança"
 *   - "não precisa levar no pronto-socorro"
 *   - "esse tremor é estereotipia, é do autismo mesmo"
 *
 * Ou seja: penalizava a cautela e ignorava a prescrição. Substituída por
 * detectores de ATO — `validateAntiDiagnostico` e `validateAntiClinico`.
 *
 * O que SOBRA aqui são as poucas formas em que a própria construção da frase é
 * a prescrição, independentemente de contexto — não substantivos.
 */
const TERMOS_CLINICOS_PRESCRITIVOS = [
  /\bdiagnostiq[ue]/i,
  /\bprognóstico\b/i,
  /\b(receito|prescrevo|indico o uso)\b/i,
  /\bvocê deveria (tomar|dar|administrar)\b/i,
  /\b(tome|tomem|dê|deem|administre)\s+\d/i,
  /\bgarant(o|imos) que (vai|isso) (curar?|melhorar?|resolver?)\b/i,
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
 * Anti-diagnóstico: a resposta está entregando uma CONCLUSÃO diagnóstica sobre
 * a pessoa (afirmando, excluindo, graduando probabilidade ou nível de suporte,
 * ou minimizando a relevância de um diagnóstico)?
 *
 * A regra de verdade mora no prompt (FRONTEIRA DO DIAGNÓSTICO, em
 * `lib/conducao/diretrizes.ts`). Isto é a rede embaixo: quando dispara, a web
 * regenera com a instrução de refazer sem concluir. Ver
 * `lib/conducao/deteccao-diagnostico.ts` pro porquê de medir a forma da
 * conclusão em vez do vocabulário clínico.
 */
export function validateAntiDiagnostico(resposta: string): ValidationResult {
  const achados = acharConclusaoDiagnostica(resposta);
  if (achados.length === 0) return { ok: true };
  return {
    ok: false,
    motivo: `Conclusão diagnóstica detectada (${achados
      .map((a) => a.codigo)
      .join(", ")}): "${achados[0].trecho}"`,
    sugestao:
      "Refaça SEM concluir, sugerir, graduar ou excluir diagnóstico, e sem dizer que um diagnóstico muda pouco. " +
      "Continue ajudando: nomeie os sinais que a família já observou, diga que comportamentos assim aparecem em " +
      "perfis diferentes e têm outras explicações, organize o que falta observar e o que levar pra avaliação, e " +
      "trabalhe a dificuldade concreta de hoje.",
  };
}

/**
 * Anti-clínico: a resposta prescreve, conclui causa, gradua gravidade, decide
 * atendimento, minimiza um sintoma ou explica algo do CORPO pela
 * neurodivergência?
 *
 * A regra mora no prompt (FRONTEIRA CLÍNICA, em `lib/conducao/diretrizes.ts`).
 * Isto é a rede embaixo — e é o substituto honesto da lista de palavras que
 * `validateAntiSubstituicaoProfissional` era: mede o ATO, não o vocabulário.
 */
export function validateAntiClinico(resposta: string): ValidationResult {
  const achados = acharConclusaoClinica(resposta);
  if (achados.length === 0) return { ok: true };
  return {
    ok: false,
    motivo: `Conclusão clínica detectada (${achados.map((a) => a.codigo).join(", ")}): "${achados[0].trecho}"`,
    sugestao:
      "Refaça SEM concluir causa, graduar gravidade, decidir atendimento, mandar esperar, mexer em medicação ou " +
      "explicar sintoma físico pela neurodivergência. Continue ajudando: reconheça a importância, oriente levar a " +
      "quem avalia, e organize com a família quando começou, o que mudou junto e o que levar pra consulta.",
  };
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
 * Vetos absolutos — Adendo PRD §4 (Q5). Frases/expressões que NUNCA
 * podem aparecer na resposta da skill. Diferente do anti-substituição-
 * profissional (clínico) ou anti-alarme — esses são vetos de TOM.
 *
 * Vetos vivem em public.ai_validator_vetos (editáveis via /admin/vetos)
 * com cache em memória de 60s + fallback hardcoded abaixo.
 */
type VetoEntry = { regex: RegExp; categoria: string; sugestao?: string };

const SUGESTAO_PADRAO =
  "Reescreva sem essa expressão. O acolhimento mora na precisão da informação.";

const VETOS_FALLBACK: VetoEntry[] = [
  // Performar empatia
  { regex: /\bquerida m[ãa]e\b/i, categoria: "performar empatia" },
  { regex: /\bcompreendo perfeitamente\b/i, categoria: "performar empatia" },
  { regex: /\bque situa[çc][ãa]o delicada\b/i, categoria: "performar empatia" },
  { regex: /\bentendo perfeitamente sua (ang[úu]stia|dor|preocupa[çc][ãa]o)\b/i, categoria: "performar empatia" },
  // Clichês de maternidade
  { regex: /\bguerreira\b/i, categoria: "clichê de maternidade" },
  { regex: /\bsuperm[ãa]e\b/i, categoria: "clichê de maternidade" },
  { regex: /\bm[ãa]e (especial|top|incr[íi]vel)\b/i, categoria: "clichê de maternidade" },
  { regex: /\b(mommy|mamis)\b/i, categoria: "clichê de maternidade" },
  { regex: /\b(sua|minha) tribo\b/i, categoria: "clichê de maternidade" },
  { regex: /\bsororidade\b/i, categoria: "clichê de maternidade" },
  { regex: /\bvamos juntas\b/i, categoria: "clichê de maternidade" },
  { regex: /\bjornada da maternidade\b/i, categoria: "clichê de maternidade" },
  // Clichês corporativos
  { regex: /\btransforma[çc][ãa]o\b/i, categoria: "clichê corporativo" },
  { regex: /\brevolu[çc][ãa]o\b/i, categoria: "clichê corporativo" },
  { regex: /\bdisruptiv[oa]\b/i, categoria: "clichê corporativo" },
  { regex: /\bdestrave\b/i, categoria: "clichê corporativo" },
  { regex: /\bdesbloqueie\b/i, categoria: "clichê corporativo" },
  // Palavrão
  { regex: /\bputa\b/i, categoria: "palavrão" },
  { regex: /\bfoda\b/i, categoria: "palavrão" },
  { regex: /\bporra\b/i, categoria: "palavrão" },
  { regex: /\bcaralho\b/i, categoria: "palavrão" },
  { regex: /\bcacete\b/i, categoria: "palavrão" },
  // Nomes de métodos (não citáveis pra mãe)
  { regex: /\bPNL\b/, categoria: "nome de método" },
  { regex: /\bprograma[çc][ãa]o neurolingu[íi]stica\b/i, categoria: "nome de método" },
  { regex: /\bjoe dispenza\b/i, categoria: "nome de método" },
  { regex: /\bREAC\b/, categoria: "nome de método" },
  // Autores de neurodivergência
  { regex: /\b(siegel|bryson|greene|delahooke|prizant|grandin|shanker|barkley)\b/i, categoria: "autor de neurodivergência" },
];

// Cache em memória pros vetos lidos do DB. TTL curto pra refletir edições
// rápidas via /admin/vetos sem precisar restart do serverless.
let vetosCache: VetoEntry[] | null = null;
let vetosCacheLoadedAt = 0;
const VETOS_CACHE_TTL_MS = 60_000;

async function getVetos(): Promise<VetoEntry[]> {
  if (vetosCache && Date.now() - vetosCacheLoadedAt < VETOS_CACHE_TTL_MS) {
    return vetosCache;
  }
  try {
    const supabase = createServiceRoleClient();
    const { data } = await supabase
      .from("ai_validator_vetos")
      .select("padrao, flags, categoria, sugestao")
      .eq("ativo", true);
    if (data && data.length > 0) {
      const parsed: VetoEntry[] = [];
      for (const v of data) {
        try {
          parsed.push({
            regex: new RegExp(v.padrao as string, (v.flags as string) ?? "i"),
            categoria: v.categoria as string,
            sugestao: (v.sugestao as string) || SUGESTAO_PADRAO,
          });
        } catch {
          console.warn(`[validators] regex inválido pulado: ${v.padrao}`);
        }
      }
      vetosCache = parsed;
      vetosCacheLoadedAt = Date.now();
      return parsed;
    }
  } catch (e) {
    console.warn("[validators] DB error pra vetos, usando fallback hardcoded:", e);
  }
  return VETOS_FALLBACK;
}

export async function validateVetosAbsolutos(
  resposta: string,
): Promise<ValidationResult> {
  const vetos = await getVetos();
  for (const v of vetos) {
    const m = resposta.match(v.regex);
    if (m) {
      return {
        ok: false,
        motivo: `Veto absoluto (${v.categoria}): "${m[0]}"`,
        sugestao: v.sugestao ?? SUGESTAO_PADRAO,
      };
    }
  }
  return { ok: true };
}

/**
 * Glossário respeitado — Adendo PRD §4 (Q6). Termos clínicos/técnicos
 * que precisam vir traduzidos pra linguagem comum. Lista derivada do
 * glossário de tradução da Régua de Tom v3.
 */
const TERMOS_TECNICOS_SEM_TRADUCAO: { termo: RegExp; sugestao: string }[] = [
  { termo: /\boffline\b/i, sugestao: "use 'desliga nessa hora' ou 'tá desligada'" },
  { termo: /\bfun[çc][ãa]o executiva\b/i, sugestao: "use 'se organizar'" },
  { termo: /\bcogni[çc][ãa]o social\b/i, sugestao: "use 'entender as pessoas'" },
  { termo: /\bmodular emo[çc][ãa]o\b/i, sugestao: "use 'lidar com o sentimento'" },
  { termo: /\bmodelagem\b/i, sugestao: "use 'se ensina mostrando, não explicando'" },
  { termo: /\bturn-taking\b/i, sugestao: "use 'pingue-pongue da conversa'" },
  { termo: /\bdisrregula[çc][ãa]o\b/i, sugestao: "use 'estar fora do eixo' ou 'sobrecarga'" },
  { termo: /\bhabilidade substituta\b/i, sugestao: "use 'outro jeito de fazer'" },
  { termo: /\bcomportamento adaptativo\b/i, sugestao: "use 'jeito que funciona'" },
];

export function validateGlossarioRespeitado(resposta: string): ValidationResult {
  for (const t of TERMOS_TECNICOS_SEM_TRADUCAO) {
    const m = resposta.match(t.termo);
    if (m) {
      return {
        ok: false,
        motivo: `Termo técnico sem tradução: "${m[0]}"`,
        sugestao: t.sugestao,
      };
    }
  }
  return { ok: true };
}

/**
 * Limite de uso do nome da criança — Adendo PRD §4 (Q7). Máximo 2x
 * na resposta-base. Resto deve usar pronomes ou referências.
 */
export function validateNomeLimite(
  resposta: string,
  nomeCrianca: string | null,
  max = 2,
): ValidationResult {
  if (!nomeCrianca || nomeCrianca.length < 2) return { ok: true };
  // Boundary insensível a maiúscula/minúscula
  const escaped = nomeCrianca.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${escaped}\\b`, "gi");
  const ocorrencias = (resposta.match(re) ?? []).length;
  if (ocorrencias > max) {
    return {
      ok: false,
      motivo: `Nome '${nomeCrianca}' aparece ${ocorrencias} vezes (máx ${max}).`,
      sugestao: "Substitua excessos por 'ela/ele', 'sua filha/seu filho' ou contexto.",
    };
  }
  return { ok: true };
}

/**
 * Abertura empática reflexa — Adendo PRD §4 (Q8). Detecta primeira frase
 * que é declaração genérica de empatia que poderia ser dada a qualquer
 * mãe — não argumento técnico. Acolhimento deve morar dentro do argumento.
 */
const ABERTURAS_REFLEXAS = [
  /^isso cansa mesmo/i,
  /^entendo (perfeitamente )?(o |sua |a sua )/i,
  /^que situa[çc][ãa]o/i,
  /^sei que [ée] dif[íi]cil/i,
  /^imagino o (quanto|que voc[êe])/i,
  /^primeiramente,? (quero|deixo)/i,
];

export function validateAberturaEmpatica(resposta: string): ValidationResult {
  const primeiraLinha = resposta.trim().split(/\n+/)[0] ?? "";
  for (const re of ABERTURAS_REFLEXAS) {
    if (re.test(primeiraLinha)) {
      return {
        ok: false,
        motivo: `Abertura empática reflexa: "${primeiraLinha.slice(0, 50)}"`,
        sugestao: "Abra direto pelo argumento técnico. Acolhimento mora na precisão da informação, não antes dela.",
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
 * Roda validadores de TOM (Grupo C do Adendo PRD §4) — eliminatórios.
 * Falha em qualquer um = regenera. Vetos primeiro porque podem ler DB
 * (mais lento), os outros são regex puro sync.
 */
export async function runTomValidators(
  resposta: string,
  ctx: { nomeCrianca?: string | null } = {},
): Promise<ValidationResult> {
  const vetos = await validateVetosAbsolutos(resposta);
  if (!vetos.ok) return vetos;

  for (const r of [
    validateGlossarioRespeitado(resposta),
    validateAberturaEmpatica(resposta),
    validateAntiSubstituicaoProfissional(resposta),
    validateAntiDiagnostico(resposta),
    validateAntiClinico(resposta),
    validateAntiComparacao(resposta),
    validateAntiAlarme(resposta),
    validateNomeLimite(resposta, ctx.nomeCrianca ?? null),
  ]) {
    if (!r.ok) return r;
  }
  return { ok: true };
}

/**
 * Roda validadores estruturais (tamanho + anti-cópia). Separado de tom
 * porque tom é eliminatório e estes são saneamento.
 */
export function runEstruturalValidators(
  resposta: string,
  boasPraticas: { versao_curta: string; versao_conversa: string | null }[],
): ValidationResult {
  for (const v of [
    () => validateTamanho(resposta),
    () => validateAntiCopy(resposta, boasPraticas),
  ]) {
    const r = v();
    if (!r.ok) return r;
  }
  return { ok: true };
}

/**
 * Roda todos os validadores em sequência. Mantido pra compatibilidade
 * com callers antigos. Novo código deve usar runTomValidators +
 * runEstruturalValidators + validateWithAI separadamente.
 */
export async function runAllValidators(
  resposta: string,
  boasPraticas: { versao_curta: string; versao_conversa: string | null }[],
  ctx: { nomeCrianca?: string | null } = {},
): Promise<ValidationResult> {
  const tom = await runTomValidators(resposta, ctx);
  if (!tom.ok) return tom;
  return runEstruturalValidators(resposta, boasPraticas);
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
