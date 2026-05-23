import type { SupabaseClient } from "@supabase/supabase-js";
import type { SkillRow } from "./router";
import { idadeAnos } from "@/lib/idade";

// Campos jsonb top-level em perfil_vivo_membro (legados, mantidos)
const KOLO_VIVO_FIELDS_MEMBRO_TOPLEVEL = [
  "essencial",
  "como_e",
  "corpo_rotina",
  "desafios_regulacao",
  "sensorial",
] as const;

// Chaves dentro de perfil_vivo_membro.categorias_extras (Adendo PRD v1 §6).
// Skills lêem essas como gavetas espelho. Coletadas pela Ayla via conversa.
const KOLO_VIVO_FIELDS_MEMBRO_EXTRAS = [
  "comunicacao",
  "socializacao",
  "imitacao",
  "motor",
  "autonomia",
  "aprendizado",
  "foco",
  "sono",
  "nutricional",
  "tela_midia",
  "escola",
  "saude_geral",
] as const;

const KOLO_VIVO_FIELDS_MEMBRO = [
  ...KOLO_VIVO_FIELDS_MEMBRO_TOPLEVEL,
  ...KOLO_VIVO_FIELDS_MEMBRO_EXTRAS,
] as const;
type KoloVivoFieldMembro = (typeof KOLO_VIVO_FIELDS_MEMBRO)[number];

// Campos jsonb top-level em perfil_vivo_familia (legados, mantidos)
const KOLO_VIVO_FIELDS_FAMILIA_TOPLEVEL = [
  "composicao",
  "rotina",
  "recursos",
  "dinamica",
] as const;

// Chaves dentro de perfil_vivo_familia.categorias_extras
const KOLO_VIVO_FIELDS_FAMILIA_EXTRAS = [
  "apoio_comunitario",
  "marcos_conquistas",
  "estrategias_ativas",
  "terapias",
] as const;

const KOLO_VIVO_FIELDS_FAMILIA = [
  ...KOLO_VIVO_FIELDS_FAMILIA_TOPLEVEL,
  ...KOLO_VIVO_FIELDS_FAMILIA_EXTRAS,
] as const;
type KoloVivoFieldFamilia = (typeof KOLO_VIVO_FIELDS_FAMILIA)[number];

export type ContextoSkillResposta = {
  membroFoco: {
    id: string;
    nome: string;
    idade: number | null;
    perfil: string;
    secoes: Partial<Record<KoloVivoFieldMembro, string>>;
  } | null;
  familia: Partial<Record<KoloVivoFieldFamilia, string>>;
  diariosRecentes: Array<{
    data: string;
    membro_nome: string;
    conquista: string | null;
    desafio: string | null;
    estado_adulto: string | null;
    reacao_adulto: string | null;
  }>;
  ultimoCheckin: {
    data: string;
    escala_emocional_mae: string;
    escala_emocional_membro: string | null;
  } | null;
  boasPraticas: Array<{
    titulo: string;
    versao_curta: string;
    versao_conversa: string | null;
  }>;
  historico: Array<{ papel: "user" | "assistant"; conteudo: string }>;
};

/**
 * Coleta o contexto completo para uma resposta de skill (PRD §7.4.3).
 * Aplica os limites de orçamento de tokens (top-3 boas práticas, 7 dias
 * de diário com no máx 5 entradas, últimas 6 mensagens da conversa).
 */
export async function buildContext(
  supabase: SupabaseClient,
  params: {
    familyId: string;
    membroAtipicoId: string | null;
    skills: SkillRow[];
    conversaId?: string | null;
  },
): Promise<ContextoSkillResposta> {
  const { familyId, membroAtipicoId, skills, conversaId } = params;

  // União dos campos do Kolo Vivo que essas skills consomem
  const camposMembroAcionados = new Set<string>();
  for (const s of skills) {
    for (const f of s.kolo_vivo_fields) {
      if ((KOLO_VIVO_FIELDS_MEMBRO as readonly string[]).includes(f)) {
        camposMembroAcionados.add(f);
      }
    }
  }
  // Sempre incluir essencial — identidade básica do membro.
  camposMembroAcionados.add("essencial");

  const tagsConhecimento = new Set<string>();
  for (const s of skills) {
    for (const t of s.knowledge_tags) tagsConhecimento.add(t);
  }
  const skillsNomes = skills.map((s) => s.name);

  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - 7);
  const dataLimiteIso = dataLimite.toISOString().slice(0, 10);

  const [
    membroResult,
    perfilMembroResult,
    familiaResult,
    diariosResult,
    checkinResult,
    boasPraticasResult,
    historicoResult,
  ] = await Promise.all([
    membroAtipicoId
      ? supabase
          .from("membros_atipicos")
          .select("id, nome, data_nascimento, perfil")
          .eq("id", membroAtipicoId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    membroAtipicoId
      ? supabase
          .from("perfil_vivo_membro")
          .select(
            "essencial, como_e, corpo_rotina, desafios_regulacao, sensorial, categorias_extras",
          )
          .eq("membro_atipico_id", membroAtipicoId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("perfil_vivo_familia")
      .select("composicao, rotina, recursos, dinamica, categorias_extras")
      .eq("family_account_id", familyId)
      .maybeSingle(),
    supabase
      .from("diarios")
      .select(
        "data, conquista, desafio, estado_adulto, reacao_adulto, membros_atipicos(nome)",
      )
      .eq("family_account_id", familyId)
      .gte("data", dataLimiteIso)
      .order("data", { ascending: false })
      .limit(5),
    supabase
      .from("check_ins_diarios")
      .select("data, escala_emocional_mae, escala_emocional_membro")
      .eq("family_account_id", familyId)
      .order("data", { ascending: false })
      .limit(1),
    supabase
      .from("boas_praticas")
      .select("titulo, versao_curta, versao_conversa, peso_relevancia, skills_relacionadas, tags")
      .eq("status", "ativo")
      .order("peso_relevancia", { ascending: false })
      .limit(20),
    conversaId
      ? supabase
          .from("mensagens_skill")
          .select("papel, conteudo")
          .eq("conversa_id", conversaId)
          .order("created_at", { ascending: false })
          .limit(6)
      : Promise.resolve({ data: [] }),
  ]);

  const membroFoco = membroResult.data
    ? {
        id: (membroResult.data as { id: string }).id,
        nome: (membroResult.data as { nome: string }).nome,
        idade: idadeAnos((membroResult.data as { data_nascimento: string | null }).data_nascimento),
        perfil: (membroResult.data as { perfil: string }).perfil,
        secoes: filterMembroSections(
          perfilMembroResult.data as Record<string, unknown> | null,
          camposMembroAcionados,
        ),
      }
    : null;

  const familia = extractFamiliaSections(
    familiaResult.data as Record<string, unknown> | null,
  );

  const diariosRecentes = ((diariosResult.data ?? []) as DiarioRow[]).map((d) => ({
    data: d.data,
    membro_nome: nomeFromMembrosAtipicos(d.membros_atipicos),
    conquista: d.conquista,
    desafio: d.desafio,
    estado_adulto: d.estado_adulto,
    reacao_adulto: d.reacao_adulto,
  }));

  const ultimoCheckin =
    checkinResult.data && checkinResult.data.length > 0
      ? (checkinResult.data[0] as ContextoSkillResposta["ultimoCheckin"])
      : null;

  // Filtro de Boas Práticas relevantes: skills_relacionadas overlap OU tags overlap.
  // Top 3 por peso_relevancia (já vem ordenado).
  const boasPraticas = ((boasPraticasResult.data ?? []) as BoaPraticaRow[])
    .filter((bp) => {
      const skillsBP = bp.skills_relacionadas ?? [];
      const tagsBP = bp.tags ?? [];
      const skillsHit = skillsBP.some((s) => skillsNomes.includes(s));
      const tagsHit = tagsBP.some((t) => tagsConhecimento.has(t));
      return skillsHit || tagsHit;
    })
    .slice(0, 3)
    .map((bp) => ({
      titulo: bp.titulo,
      versao_curta: bp.versao_curta,
      versao_conversa: bp.versao_conversa,
    }));

  // Inverte pra ordem cronológica (mais antigo primeiro) ao montar prompt
  const historico = ((historicoResult.data ?? []) as HistoricoRow[])
    .slice()
    .reverse()
    .map((h) => ({ papel: h.papel as "user" | "assistant", conteudo: h.conteudo }));

  return {
    membroFoco,
    familia,
    diariosRecentes,
    ultimoCheckin,
    boasPraticas,
    historico,
  };
}

// ---------- helpers ----------

type DiarioRow = {
  data: string;
  conquista: string | null;
  desafio: string | null;
  estado_adulto: string | null;
  reacao_adulto: string | null;
  membros_atipicos: { nome: string } | { nome: string }[] | null;
};

type BoaPraticaRow = {
  titulo: string;
  versao_curta: string;
  versao_conversa: string | null;
  peso_relevancia: number;
  skills_relacionadas: string[];
  tags: string[];
};

type HistoricoRow = {
  papel: string;
  conteudo: string;
};

function nomeFromMembrosAtipicos(
  m: DiarioRow["membros_atipicos"],
): string {
  if (!m) return "—";
  if (Array.isArray(m)) return m[0]?.nome ?? "—";
  return m.nome ?? "—";
}

/**
 * Resolve um campo do Kolo Vivo no schema híbrido (top-level + categorias_extras).
 * Top-level vence (campos legados). Se vazio, busca dentro de categorias_extras.
 */
function resolveSecaoMembro(
  json: Record<string, unknown> | null,
  campo: string,
): string {
  if (!json) return "";
  // Campos legados (top-level)
  if ((KOLO_VIVO_FIELDS_MEMBRO_TOPLEVEL as readonly string[]).includes(campo)) {
    const direto = extractTextoFrom(json[campo]);
    if (direto) return direto;
  }
  // Categorias novas (dentro de categorias_extras)
  const extras = json.categorias_extras as Record<string, unknown> | undefined;
  if (extras && typeof extras === "object") {
    return extractTextoFrom(extras[campo]);
  }
  return "";
}

function filterMembroSections(
  json: Record<string, unknown> | null,
  campos: Set<string>,
): Partial<Record<KoloVivoFieldMembro, string>> {
  if (!json) return {};
  const out: Partial<Record<KoloVivoFieldMembro, string>> = {};
  for (const c of campos) {
    const texto = resolveSecaoMembro(json, c);
    if (texto) out[c as KoloVivoFieldMembro] = texto;
  }
  return out;
}

function extractFamiliaSections(
  json: Record<string, unknown> | null,
): Partial<Record<KoloVivoFieldFamilia, string>> {
  if (!json) return {};
  const out: Partial<Record<KoloVivoFieldFamilia, string>> = {};
  // Top-level (legados)
  for (const c of KOLO_VIVO_FIELDS_FAMILIA_TOPLEVEL) {
    const texto = extractTextoFrom(json[c]);
    if (texto) out[c] = texto;
  }
  // categorias_extras (novas)
  const extras = json.categorias_extras as Record<string, unknown> | undefined;
  if (extras && typeof extras === "object") {
    for (const c of KOLO_VIVO_FIELDS_FAMILIA_EXTRAS) {
      const texto = extractTextoFrom(extras[c]);
      if (texto) out[c] = texto;
    }
  }
  return out;
}

function extractTextoFrom(valor: unknown): string {
  if (!valor || typeof valor !== "object") return "";
  const obj = valor as Record<string, unknown>;
  if (typeof obj.texto === "string") return obj.texto;
  // Onboarding rápido grava listas em campos como "interesses", "desafios_iniciais"
  // Concatena tudo em uma frase pra entrar no prompt.
  const partes: string[] = [];
  for (const v of Object.values(obj)) {
    if (typeof v === "string") partes.push(v);
    else if (Array.isArray(v))
      partes.push(v.filter((x) => typeof x === "string").join("; "));
  }
  return partes.filter(Boolean).join(" · ");
}
