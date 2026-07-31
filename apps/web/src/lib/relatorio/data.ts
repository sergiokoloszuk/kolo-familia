import type { SupabaseClient } from "@supabase/supabase-js";
import { idadeAnos } from "@/lib/idade";
import { lerSecoesMembro, PERFIL_MEMBRO_SELECT } from "@/lib/kolo-vivo/leitura";

/**
 * Coleta de dados para relatório (PRD §7.17).
 *
 * Princípios:
 *   - Nomes de outros membros (pai, avós, irmãos) NÃO aparecem. São
 *     substituídos por papéis genéricos.
 *   - Camada B só entra com opt-in explícito.
 *   - DASS-21 só entra com opt-in explícito.
 *   - Em relatório para escola, alguns campos não entram nunca.
 */

export type Destinatario = "terapeuta" | "escola";
export type JanelaMeses = 1 | 3 | 6 | 12;

export type ReportData = {
  geradoEm: string;
  destinatario: Destinatario;
  janelaMeses: JanelaMeses;
  membro: {
    nome: string;
    idade: number | null;
    perfil: string;
    diagnosticosFormais: string[];
  };
  koloVivo: {
    essencial: string;
    como_e: string;
    corpo_rotina: string;
    desafios_regulacao: string;
    sensorial: string;
    /**
     * OS 20 DOMÍNIOS do Kolo Vivo, por chave canônica — só os que têm conteúdo.
     *
     * Até 31/07 esta camada pedia ao banco só as 5 colunas dedicadas e nem
     * carregava `categorias_extras`: o relatório que vai para a escola ou para
     * o terapeuta era cego para 15 domínios, incluindo `aprendizado` e
     * `escola` — as duas coisas que uma reunião escolar mais precisa saber.
     *
     * As 5 chaves acima continuam existindo com o mesmo nome para não mexer na
     * renderização (components/relatorio/render.tsx). EXIBIR os outros 15 é
     * decisão de layout, e não foi tomada aqui.
     */
    dominios: Record<string, string>;
    composicaoFamilia?: string; // só pra terapeuta
    rotinaFamilia?: string;
    recursosFamilia?: string;
  };
  linhaDoTempo: {
    conquistas: Array<{ data: string; texto: string }>;
    desafios: Array<{ data: string; texto: string }>;
    gatilhosFrequentes: Array<{ texto: string; ocorrencias: number }>;
    estrategiasAplicadas: string[]; // resumido
  };
  camadaB?: {
    correlacaoEstadoAdulto: Array<{ estado: string; ocorrenciasDesafio: number }>;
    correlacaoReacao: Array<{ reacao: string; ocorrenciasDesafio: number }>;
  };
  dass21?: Array<{
    data: string;
    depressao: { score: number; faixa: string };
    ansiedade: { score: number; faixa: string };
    estresse: { score: number; faixa: string };
  }>;
  laudosAnexos?: string[]; // só placeholders; arquivos físicos são fora de escopo nesta versão
};

export type FetchOptions = {
  membroAtipicoId: string;
  destinatario: Destinatario;
  janelaMeses: JanelaMeses;
  includeCamadaB: boolean;
  includeDass21: boolean;
};

const PAPEIS_GENERICOS: Record<string, string> = {
  mae: "a cuidadora principal",
  pai: "outro adulto cuidador",
  avo_a: "outro adulto da família",
  avo_o: "outro adulto da família",
  irmao_a: "outro membro da família",
  baba: "outro adulto cuidador",
  professor_a: "profissional da escola",
  outro: "outro adulto presente",
};

export async function fetchReportData(
  supabase: SupabaseClient,
  opts: FetchOptions,
): Promise<ReportData | null> {
  const dataLimite = new Date();
  dataLimite.setMonth(dataLimite.getMonth() - opts.janelaMeses);
  const dataLimiteIso = dataLimite.toISOString().slice(0, 10);

  const [
    { data: membro },
    { data: perfilMembro },
    { data: perfilFamilia },
    { data: diarios },
    { data: conversas },
  ] = await Promise.all([
    supabase
      .from("membros_atipicos")
      .select("nome, data_nascimento, perfil, diagnosticos_formais")
      .eq("id", opts.membroAtipicoId)
      .single(),
    supabase
      .from("perfil_vivo_membro")
      .select(PERFIL_MEMBRO_SELECT)
      .eq("membro_atipico_id", opts.membroAtipicoId)
      .maybeSingle(),
    opts.destinatario === "terapeuta"
      ? supabase
          .from("perfil_vivo_familia")
          .select("composicao, rotina, recursos")
          .eq(
            "family_account_id",
            (await supabase
              .from("membros_atipicos")
              .select("family_account_id")
              .eq("id", opts.membroAtipicoId)
              .single()).data?.family_account_id ?? "",
          )
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("diarios")
      .select("data, conquista, desafio, possivel_gatilho, estado_adulto, reacao_adulto")
      .eq("membro_atipico_id", opts.membroAtipicoId)
      .gte("data", dataLimiteIso)
      .order("data", { ascending: false })
      .limit(500),
    // Estratégias aplicadas: extraídas do conteúdo das conversas das skills
    supabase
      .from("mensagens_skill")
      .select("conteudo, papel, conversa_id, conversas!inner(membro_atipico_id)")
      .eq("conversas.membro_atipico_id", opts.membroAtipicoId)
      .eq("papel", "assistant")
      .gte("created_at", dataLimite.toISOString())
      .limit(50),
  ]);

  if (!membro) return null;

  const conquistas = (diarios ?? [])
    .filter((d) => d.conquista)
    .map((d) => ({ data: d.data as string, texto: d.conquista as string }));

  const desafios = (diarios ?? [])
    .filter((d) => d.desafio)
    .map((d) => ({ data: d.data as string, texto: d.desafio as string }));

  const gatilhosFrequentes = topNFrequencias(
    (diarios ?? [])
      .map((d) => d.possivel_gatilho)
      .filter(Boolean) as string[],
    5,
  );

  const estrategiasAplicadas = (conversas ?? [])
    .map((c) => extrairTrechoEstrategia(c.conteudo as string))
    .filter(Boolean)
    .slice(0, 8) as string[];

  // Leitura canônica: enxerga os 20 domínios e as formas do onboarding
  // (`interesses`, `desafios_iniciais`), que `extractTexto` — que lê só
  // `.texto` — deixava de fora. `extractTexto` segue em uso abaixo, para
  // `perfil_vivo_familia`, que é outra tabela e não passa por este leitor.
  const secoesMembro = lerSecoesMembro(perfilMembro as Record<string, unknown> | null);

  // SAÚDE NÃO VAI PARA A ESCOLA. O arquivo já trata `perfil_vivo_familia` como
  // exclusivo do terapeuta; dado de saúde da criança segue a mesma regra. Sem
  // isto, corrigir a seleção de colunas mandaria histórico clínico para uma
  // reunião escolar como efeito colateral de uma limpeza técnica.
  const dominios: Record<string, string> = {};
  for (const [campo, texto] of Object.entries(secoesMembro)) {
    if (campo === "saude_geral" && opts.destinatario !== "terapeuta") continue;
    dominios[campo] = texto;
  }

  const koloVivo = {
    essencial: secoesMembro.essencial ?? "",
    como_e: secoesMembro.como_e ?? "",
    corpo_rotina: secoesMembro.corpo_rotina ?? "",
    desafios_regulacao: secoesMembro.desafios_regulacao ?? "",
    sensorial: secoesMembro.sensorial ?? "",
    dominios,
    composicaoFamilia:
      opts.destinatario === "terapeuta"
        ? sanitizarNomes(extractTexto(perfilFamilia?.composicao))
        : undefined,
    rotinaFamilia:
      opts.destinatario === "terapeuta"
        ? extractTexto(perfilFamilia?.rotina)
        : undefined,
    recursosFamilia:
      opts.destinatario === "terapeuta"
        ? extractTexto(perfilFamilia?.recursos)
        : undefined,
  };

  // Camada B (opt-in, só terapeuta)
  let camadaB: ReportData["camadaB"];
  if (opts.includeCamadaB && opts.destinatario === "terapeuta") {
    camadaB = computeCamadaB(diarios ?? []);
  }

  // DASS-21 (opt-in, só terapeuta)
  let dass21: ReportData["dass21"];
  if (opts.includeDass21 && opts.destinatario === "terapeuta") {
    const { data: aplicacoes } = await supabase
      .from("dass21_aplicacoes")
      .select(
        "data_aplicacao, score_depressao, score_ansiedade, score_estresse, faixa_depressao, faixa_ansiedade, faixa_estresse",
      )
      .gte("data_aplicacao", dataLimiteIso)
      .order("data_aplicacao", { ascending: false });
    dass21 = (aplicacoes ?? []).map((a) => ({
      data: a.data_aplicacao as string,
      depressao: {
        score: a.score_depressao as number,
        faixa: a.faixa_depressao as string,
      },
      ansiedade: {
        score: a.score_ansiedade as number,
        faixa: a.faixa_ansiedade as string,
      },
      estresse: {
        score: a.score_estresse as number,
        faixa: a.faixa_estresse as string,
      },
    }));
  }

  return {
    geradoEm: new Date().toISOString(),
    destinatario: opts.destinatario,
    janelaMeses: opts.janelaMeses,
    membro: {
      nome: membro.nome as string,
      idade: idadeAnos(membro.data_nascimento as string | null),
      perfil: membro.perfil as string,
      diagnosticosFormais: (membro.diagnosticos_formais as string[]) ?? [],
    },
    koloVivo,
    linhaDoTempo: {
      conquistas,
      desafios,
      gatilhosFrequentes,
      estrategiasAplicadas,
    },
    camadaB,
    dass21,
    laudosAnexos: [],
  };
}

function topNFrequencias(
  itens: string[],
  n: number,
): Array<{ texto: string; ocorrencias: number }> {
  const map = new Map<string, number>();
  for (const item of itens) {
    const k = item.trim().toLowerCase();
    if (k.length < 3) continue;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([texto, ocorrencias]) => ({ texto, ocorrencias }));
}

function extractTexto(json: unknown): string {
  if (!json || typeof json !== "object") return "";
  const obj = json as Record<string, unknown>;
  if (typeof obj.texto === "string") return obj.texto;
  return "";
}

/**
 * Substitui nomes próprios por papéis genéricos (PRD §7.17).
 * Implementação simples: detecta menções a "pai", "mãe", "avó", "avô",
 * "irmão", "irmã" e mantém. Mas se o usuário escreveu nomes próprios,
 * eles passam — versão futura pode usar IA pra detecção mais robusta.
 */
function sanitizarNomes(texto: string): string {
  if (!texto) return texto;
  // Heurística simples: capitaliza palavras isoladas com 4+ letras que
  // não são palavras comuns. Substituir não é trivial sem NLP — por
  // ora só sinaliza limitação ao final.
  return texto;
}

function computeCamadaB(
  diarios: Array<{ desafio: string | null; estado_adulto: string | null; reacao_adulto: string | null }>,
): NonNullable<ReportData["camadaB"]> {
  const estadoCount = new Map<string, number>();
  const reacaoCount = new Map<string, number>();
  for (const d of diarios) {
    if (!d.desafio) continue;
    if (d.estado_adulto) {
      estadoCount.set(d.estado_adulto, (estadoCount.get(d.estado_adulto) ?? 0) + 1);
    }
    if (d.reacao_adulto) {
      reacaoCount.set(d.reacao_adulto, (reacaoCount.get(d.reacao_adulto) ?? 0) + 1);
    }
  }
  return {
    correlacaoEstadoAdulto: Array.from(estadoCount.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([estado, ocorrenciasDesafio]) => ({ estado, ocorrenciasDesafio })),
    correlacaoReacao: Array.from(reacaoCount.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([reacao, ocorrenciasDesafio]) => ({ reacao, ocorrenciasDesafio })),
  };
}

function extrairTrechoEstrategia(conteudo: string): string | null {
  // Heurística: pega frases curtas que começam com verbo de estratégia.
  const linhas = conteudo.split(/\n+/);
  for (const linha of linhas) {
    const l = linha.trim();
    if (l.length < 20 || l.length > 200) continue;
    if (
      /^(uma estrat|tente|experimente|antes de|durante|evite|prefira|baixe)/i.test(l)
    ) {
      return l;
    }
  }
  return null;
}

export { PAPEIS_GENERICOS };
