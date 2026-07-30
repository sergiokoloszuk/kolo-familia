import type { SupabaseClient } from "@supabase/supabase-js";
import type { SkillRow } from "./router";
import { idadeAnos } from "@/lib/idade";
import { descricaoCuidador, type Genero } from "@/lib/ayla/pronomes";
import { resumirComposicao } from "@/lib/familia/composicao";
// Leitura do perfil e das memórias datadas — fonte única com a Ayla (WhatsApp).
import {
  PERFIL_MEMBRO_SELECT,
  lerSecoesMembro,
  carregarEventosRecentes,
  carregarExperimentos,
  type EventoLinhaDoTempo,
  type Experimento,
} from "@/lib/kolo-vivo/leitura";
import { selecionarBoasPraticas } from "@/lib/conhecimento/boas-praticas";

// Os campos do MEMBRO saíram daqui: viviam nesta lista à mão (19 dos 20 — sem
// `gostos`) e agora vêm de lib/kolo-vivo/campos.ts via lerSecoesMembro, a mesma
// fonte da Ayla no WhatsApp. Um domínio novo passa a valer nos dois canais de uma vez.

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
    genero: Genero;
    /**
     * TODOS os domínios do Kolo Vivo com conteúdo. Até 30/07 isto era filtrado
     * pelos `kolo_vivo_fields` das skills roteadas — o perfil que a Kolo via
     * MUDAVA conforme o sorteio do roteador, e `gostos` não era lido nunca.
     * Agora é o mesmo leitor da Ayla do WhatsApp (lib/kolo-vivo/leitura.ts).
     */
    secoes: Record<string, string>;
  } | null;
  /** Linha do tempo DATADA — antes só o relatório lia. */
  eventos: EventoLinhaDoTempo[];
  /** O que já foi tentado e como foi — antes só o cron semanal lia. */
  experimentos: Experimento[];
  /** Quem está falando (cuidador): nome + parentesco + gênero. */
  cuidador: { nome: string; relacao: string; genero: Genero } | null;
  /** Elenco da família — todos os membros atípicos cadastrados, com um
   *  snapshot (perfil). Sempre presente, mesmo no modo "família em geral", pra
   *  a Kolo saber quem são quando o cuidador citar um nome. A evolução do que
   *  acontece vem dos diários (diariosRecentes), que são da família toda. */
  membros: Array<{
    nome: string;
    idade: number | null;
    genero: Genero;
    perfil: string;
  }>;
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
    /**
     * As skills roteadas do turno. NÃO filtram mais nada aqui — ficam no
     * parâmetro porque quem monta o prompt (assemblePrompt) as usa como lentes
     * de especialista. Até 30/07 elas decidiam quais domínios do perfil eram
     * carregados, e por isso o perfil visível variava por turno.
     */
    skills: SkillRow[];
    conversaId?: string | null;
    /** O que a pessoa escreveu agora — usado pra escolher as boas práticas. */
    userInput?: string;
  },
): Promise<ContextoSkillResposta> {
  const { familyId, membroAtipicoId, conversaId, userInput } = params;

  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - 7);
  const dataLimiteIso = dataLimite.toISOString().slice(0, 10);

  const [
    membroResult,
    perfilMembroResult,
    familiaResult,
    diariosResult,
    checkinResult,
    eventos,
    experimentos,
    historicoResult,
    profileResult,
    membrosResult,
  ] = await Promise.all([
    membroAtipicoId
      ? supabase
          .from("membros_atipicos")
          .select("id, nome, data_nascimento, perfil, genero")
          .eq("id", membroAtipicoId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    membroAtipicoId
      ? supabase
          .from("perfil_vivo_membro")
          .select(PERFIL_MEMBRO_SELECT)
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
    // Memórias DATADAS — mesma leitura da Ayla no WhatsApp.
    carregarEventosRecentes(supabase, membroAtipicoId),
    carregarExperimentos(supabase, membroAtipicoId),
    conversaId
      ? supabase
          .from("mensagens_skill")
          .select("papel, conteudo")
          .eq("conversa_id", conversaId)
          .order("created_at", { ascending: false })
          .limit(6)
      : Promise.resolve({ data: [] }),
    supabase
      .from("family_profiles")
      .select("nome_mae, como_chamar, papel, papel_outro, genero_responsavel")
      .eq("family_account_id", familyId)
      .maybeSingle(),
    // Elenco completo — sempre, pra a Kolo saber quem são os membros (e um
    // snapshot de cada) mesmo quando a conversa é sobre "a família em geral".
    supabase
      .from("membros_atipicos")
      .select("nome, data_nascimento, genero, perfil")
      .eq("family_account_id", familyId)
      .eq("ativo", true)
      .order("created_at", { ascending: true }),
  ]);

  const membroFoco = membroResult.data
    ? {
        id: (membroResult.data as { id: string }).id,
        nome: (membroResult.data as { nome: string }).nome,
        idade: idadeAnos((membroResult.data as { data_nascimento: string | null }).data_nascimento),
        perfil: (membroResult.data as { perfil: string }).perfil,
        genero: (membroResult.data as { genero: Genero }).genero ?? null,
        // TODOS os domínios (fonte única com o WhatsApp) — sem filtro por skill.
        secoes: lerSecoesMembro(perfilMembroResult.data as Record<string, unknown> | null),
      }
    : null;

  // Boas práticas: depende da idade e do perfil que acabamos de ler, então roda
  // depois do lote — uma ida a mais ao banco em troca de respeitar a faixa
  // etária e o perfil que a própria BP declara.
  const boasPraticas = await selecionarBoasPraticas(supabase, {
    assunto: userInput ?? "",
    idade: membroFoco?.idade ?? null,
    perfil: membroFoco?.perfil ?? null,
    limite: 5,
  });

  const familia = extractFamiliaSections(
    familiaResult.data as Record<string, unknown> | null,
  );

  const membros = ((membrosResult.data ?? []) as Array<{
    nome: string;
    data_nascimento: string | null;
    genero: Genero;
    perfil: string | null;
  }>).map((m) => ({
    nome: m.nome,
    idade: idadeAnos(m.data_nascimento),
    genero: (m.genero ?? null) as Genero,
    perfil: m.perfil ?? "",
  }));

  const profile = profileResult.data as {
    nome_mae?: string | null;
    como_chamar?: string | null;
    papel?: string | null;
    papel_outro?: string | null;
    genero_responsavel?: Genero;
  } | null;
  const cuidadorDesc = profile
    ? descricaoCuidador({
        papel: profile.papel ?? null,
        papelOutro: profile.papel_outro ?? null,
        genero: profile.genero_responsavel ?? null,
      })
    : null;
  const cuidador = cuidadorDesc
    ? {
        nome: profile?.como_chamar?.trim() || profile?.nome_mae?.trim() || "responsável",
        relacao: cuidadorDesc.relacao,
        genero: cuidadorDesc.genero,
      }
    : null;

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

  // Inverte pra ordem cronológica (mais antigo primeiro) ao montar prompt
  const historico = ((historicoResult.data ?? []) as HistoricoRow[])
    .slice()
    .reverse()
    .map((h) => ({ papel: h.papel as "user" | "assistant", conteudo: h.conteudo }));

  return {
    membroFoco,
    eventos,
    experimentos,
    cuidador,
    membros,
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

// `resolveSecaoMembro` e `filterMembroSections` foram substituídas por
// `lerSecoesMembro` (lib/kolo-vivo/leitura.ts): mesma leitura nos dois canais e
// sem o filtro por skill, que fazia o perfil visível variar por turno.

function extractFamiliaSections(
  json: Record<string, unknown> | null,
): Partial<Record<KoloVivoFieldFamilia, string>> {
  if (!json) return {};
  const out: Partial<Record<KoloVivoFieldFamilia, string>> = {};
  // Top-level (legados)
  for (const c of KOLO_VIVO_FIELDS_FAMILIA_TOPLEVEL) {
    // composicao guarda irmãos estruturados — formata com idade calculada na
    // hora (atualiza com o tempo) + nota livre opcional.
    const texto = c === "composicao" ? resumirComposicao(json[c]) : extractTextoFrom(json[c]);
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
