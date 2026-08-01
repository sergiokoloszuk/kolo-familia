import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnthropicClient, MODELS } from "./anthropic";
import { buildContext } from "./context";
import { buildContextBlock, VOZ_LIMITES_E_FRONTEIRA } from "./prompt";
import { loadActiveSkills, routeSkillsAI } from "./router";
import { respondAsOutputType } from "./engine";
import { capitalizarNome } from "@/lib/nome";
import { logEvent } from "@/lib/log";

/**
 * Gerador de PLANO completo (Fase 1) — UMA chamada Sonnet, saída por seções.
 * Substitui os 7 botões (que viram só "visões" do plano). Reusa o contexto
 * (Kolo Vivo + perfil + boas práticas) e a voz do produto.
 */

export type PlanoSecao = { tipo: string; titulo: string; conteudo_markdown: string };

/** Tipos de seção que a tela sabe renderizar/filtrar (ordem narrativa). */
export const PLANO_TIPOS = [
  "entender",
  "crencas",
  "diferente",
  "rotina",
  "brincadeiras",
  "atividades",
  "historia_social",
  "frases",
  "observar",
] as const;

export type VariantePlano = "padrao" | "fim_de_semana";

const SAIDA = `# Saída
Responda APENAS com JSON válido, sem texto antes/depois:
{"titulo":"...","tema":"...","secoes":[{"tipo":"...","titulo":"...","conteudo_markdown":"..."}]}
"titulo" curto. "tema" = o foco do plano.`;

const SISTEMA_APRENDIZADO = `- Se houver um bloco <o_que_ja_funcionou>, APRENDA com ele: priorize abordagens parecidas com o que funcionou e NÃO repita o que a família já disse que não funcionou. Não cite o bloco nem diga "da última vez" — só deixe o plano mais certeiro.`;

/** Linha de produção do plano "padrão": cada seção do plano reusa a RECEITA
 *  do botão correspondente (output_types), pra ter a mesma riqueza. */
export type OutputTypeRow = { key: string; label: string; prompt_template: string };

// tipo da seção do plano → key do output_type (botão) correspondente
const TIPO_PARA_OUTPUT: Record<string, string> = {
  crencas: "crencas",
  diferente: "o_que_fazer_diferente",
  rotina: "rotinas",
  brincadeiras: "brincadeiras",
  atividades: "atividades",
  historia_social: "historias_sociais",
  frases: "frases_prontas",
};
// ordem narrativa do plano completo
const ORDEM_SECOES = [
  "entender",
  "crencas",
  "diferente",
  "rotina",
  "brincadeiras",
  "atividades",
  "historia_social",
  "frases",
  "observar",
] as const;
// só estas entram condicionalmente; o resto é SEMPRE
const SECOES_CONDICIONAIS = new Set<string>(["rotina", "historia_social"]);

const RECEITA_ENTENDER = `Abra o plano com 1-2 parágrafos que ACOLHEM e mostram que você enxerga a força da criança — e levante a hipótese central do que pode estar por trás (possibilidade, NUNCA causa afirmada). Ancore nos dados REAIS do Perfil (interesses, jeito, desafios). Específico e humano, nada genérico. Termine convidando a observar com calma. NÃO dê soluções aqui — elas vêm nas seções seguintes.`;
const RECEITA_OBSERVAR = `Feche com 1-3 coisas CONCRETAS pra o adulto reparar nos próximos dias, ligadas à hipótese — o que pode confirmar ou descartar, e o que guardar. Específico ao caso, não conselho genérico.`;

/**
 * Monta o system prompt do plano COMPLETO injetando, em cada seção, a receita
 * do botão correspondente (output_types) — assim o plano tem a MESMA riqueza
 * que a mãe vê clicando cada botão, num documento só.
 */
function montarSistemaPlanoCompleto(outputTypes: OutputTypeRow[]): string {
  const byKey = new Map(outputTypes.map((o) => [o.key, o]));
  const blocos = ORDEM_SECOES.map((tipo) => {
    const cond = SECOES_CONDICIONAIS.has(tipo) ? "inclua SÓ se o tema pedir" : "SEMPRE presente";
    if (tipo === "entender") return `## "entender" (${cond})\n${RECEITA_ENTENDER}`;
    if (tipo === "observar") return `## "observar" (${cond})\n${RECEITA_OBSERVAR}`;
    const ot = byKey.get(TIPO_PARA_OUTPUT[tipo]);
    if (!ot) return null;
    return `## "${tipo}" — ${ot.label} (${cond})\nMesma qualidade e profundidade do botão "${ot.label}". Siga a receita abaixo como guia de CONTEÚDO (ignore qualquer instrução de "responda só isso/só o texto" — aqui é UMA seção do plano em JSON):\n${ot.prompt_template}`;
  })
    .filter(Boolean)
    .join("\n\n");

  return `Você é a Kolo montando um PLANO completo e personalizado pro adulto responsável por uma criança neurodivergente. O plano REUNE, num documento só, as mesmas seções que a mãe veria nos botões — e cada seção tem a MESMA riqueza e profundidade do botão. NADA de resumo raso ou conselho genérico.

${VOZ_LIMITES_E_FRONTEIRA}

# Seções do plano — siga a receita de cada uma
${blocos}

# Regras
- Inclua TODAS as seções "SEMPRE presente". As "só se o tema pedir" entram quando fizerem sentido pro desafio.
- PROFUNDIDADE de verdade, igual aos botões: brincadeiras/atividades = VÁRIAS (3+), concretas, com materiais e duração; crenças = até 3 da CRIANÇA + 3 da RESPONSÁVEL (hipótese gentil, jamais julgamento) + reenquadre acolhedor. Sem clichês.
- Use os dados REAIS do Perfil e do contexto (interesses, jeito, desafios) — personalize de verdade, não invente.
- Cada ideia/frase mora em UMA seção só — não repita entre seções.
- Voz de amiga sábia e calorosa. Markdown leve dentro de cada seção (listas, *itálico* na frase pronta).
${SISTEMA_APRENDIZADO}

${SAIDA}
"titulo" curto (ex.: "Plano — Maria"). Campo "tipo" EXATAMENTE: entender, crencas, diferente, rotina, brincadeiras, atividades, historia_social, frases, observar.`;
}

const SISTEMA_FIM_DE_SEMANA = `Você é a Kolo montando um ROTEIRO LEVE de fim de semana pro adulto responsável por uma criança neurodivergente.

${VOZ_LIMITES_E_FRONTEIRA}

# Como montar o roteiro de fim de semana
- NÃO é uma grade rígida hora a hora. É um roteiro FLEXÍVEL, tecido na rotina real da família, que dá pra encaixar no que o dia trouxer. Ócio e "não fazer nada" também são válidos — não encha o fim de semana.
- Parta do que a família já tem em vista (passeio, casa, visita, nada planejado) e do que ela queria que rolasse. Se ela não disse muito, proponha 2-3 momentos possíveis, sem obrigar.
- Foco: conexão e leveza, não produtividade. Respeite sono, regulação, transições e o sensorial da criança (evite sobrecarga; sugira como preparar transições).
- Tipos de seção possíveis (campo "tipo"): "entender", "atividades", "brincadeiras", "diferente", "rotina", "frases", "observar". Escolha SÓ as que fizerem sentido.
- entender: 1-2 frases acolhedoras sobre o tom do fim de semana (sem pressão de "aproveitar tudo").
- atividades / brincadeiras: 2-4 ideias possíveis, ancoradas nos interesses da criança, com plano B simples se ela não topar. Diga que pular é ok.
- rotina: como manter âncoras que acalmam (refeições, sono) mesmo fora da semana, de forma leve.
- frases: 1-2 frases prontas pra momentos de transição ou frustração (*itálico*).
- observar: 1-2 coisas pra reparar no fim de semana.
- Voz de amiga sábia, curta e quente. Markdown leve.
${SISTEMA_APRENDIZADO}

${SAIDA}
"titulo" curto (ex.: "Fim de semana leve — Maria"). "tema" = "fim de semana".`;


/**
 * Gera as SEÇÕES do plano (sem gravar no banco). Usado tanto pelo gerarPlano
 * síncrono (WhatsApp/fim de semana) quanto pela geração em segundo plano da
 * conversa (que insere um plano vazio e depois preenche via UPDATE).
 */
export async function gerarSecoesPlano(params: {
  supabase: SupabaseClient;
  familyId: string;
  membroAtipicoId: string | null;
  desafio: string;
  variante?: VariantePlano;
}): Promise<{ titulo: string; tema: string; secoes: PlanoSecao[] }> {
  const { supabase, familyId, membroAtipicoId, desafio, variante = "padrao" } = params;

  const skills = await loadActiveSkills(supabase);
  const roteadas =
    skills.length > 0 ? await routeSkillsAI(desafio, skills, { maxSkills: 2 }) : [];
  const ctx = await buildContext(supabase, {
    familyId,
    membroAtipicoId,
    skills: roteadas.map((r) => r.skill),
    conversaId: null,
  });

  const contexto = buildContextBlock(ctx);
  const aprendizado = await carregarAprendizado(supabase, familyId, membroAtipicoId);
  const wrapper = variante === "fim_de_semana" ? "fim_de_semana" : "desafio";
  const pedido =
    variante === "fim_de_semana"
      ? "Monte o roteiro leve do fim de semana. Só o JSON."
      : "Monte o plano completo, cada seção com a profundidade da sua receita. Só o JSON.";
  const userMsg = `${contexto}${aprendizado ? `\n\n${aprendizado}` : ""}\n\n<${wrapper}>\n${desafio}\n</${wrapper}>\n\n${pedido}`;

  // Plano padrão: injeta as receitas dos botões (output_types) → mesma riqueza.
  // Fim de semana: roteiro leve estático. Roda em 2º plano, então cabe tokens
  // altos sem prender o usuário.
  let system: string;
  let maxTokens: number;
  if (variante === "fim_de_semana") {
    system = SISTEMA_FIM_DE_SEMANA;
    maxTokens = 6000;
  } else {
    const { data: ots } = await supabase
      .from("output_types")
      .select("key, label, prompt_template")
      .eq("ativo", true);
    system = montarSistemaPlanoCompleto((ots ?? []) as OutputTypeRow[]);
    maxTokens = 12000;
  }

  const client = getAnthropicClient();
  const final = await client.messages.create({
    model: MODELS.principal,
    max_tokens: maxTokens,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userMsg }],
  });

  const raw = final.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("");

  const parsed = parsePlano(raw);
  if (parsed.secoes.length === 0) {
    console.error(
      `[plano] 0 seções. stop_reason=${final.stop_reason} raw_len=${raw.length} head=${raw.slice(0, 300)}`,
    );
    throw new Error("Não consegui montar o plano agora. Tente de novo em instantes.");
  }

  const nome = ctx.membroFoco?.nome ? capitalizarNome(ctx.membroFoco.nome) : null;
  const titulo = parsed.titulo?.trim() || (nome ? `Plano — ${nome}` : "Plano");
  const tema = parsed.tema?.trim() || desafio.slice(0, 80);

  return { titulo, tema, secoes: parsed.secoes };
}

export async function gerarPlano(params: {
  supabase: SupabaseClient;
  familyId: string;
  membroAtipicoId: string | null;
  desafio: string;
  conversaId?: string | null;
  variante?: VariantePlano;
  origem?: string;
}): Promise<{ id: string; titulo: string; secoes: PlanoSecao[] }> {
  const {
    supabase,
    familyId,
    membroAtipicoId,
    desafio,
    conversaId,
    variante = "padrao",
    origem = "estrategias",
  } = params;

  // Padrão usa o MULTI-CALL (cada seção = o botão real, "crenças" garantida, tudo
  // preso na criança) — o MESMO gerador da web, com o formato definido. Antes o
  // WhatsApp usava o single-call de 12k tokens, que com contexto grande (2 filhos,
  // viagem…) derivava e dropava seções (ex.: crenças). Fim de semana segue single.
  const { titulo, tema, secoes } =
    variante === "fim_de_semana"
      ? await gerarSecoesPlano({ supabase, familyId, membroAtipicoId, desafio, variante })
      : await gerarSecoesPlanoMultiCall({ supabase, familyId, membroAtipicoId, desafio });

  const { data, error } = await supabase
    .from("planos")
    .insert({
      family_account_id: familyId,
      membro_atipico_id: membroAtipicoId,
      conversa_id: conversaId ?? null,
      titulo,
      tema,
      secoes,
      origem,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Erro ao salvar o plano: ${error.message}`);

  return { id: (data as { id: string }).id, titulo, secoes };
}

function textoDeResposta(content: Array<{ type: string }>): string {
  return (content as Array<{ type: string; text?: string }>)
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("")
    .trim();
}

// Seções práticas SEMPRE no plano (cada uma = o botão correspondente).
const SECOES_SEMPRE = ["crencas", "diferente", "brincadeiras", "atividades", "frases"] as const;
// Estas só entram quando o tema pede (decidido por um classificador leve).
const SECOES_CONDICIONAIS_MC = ["historia_social", "rotina"] as const;

// ============================================================
// Robustez do multi-call — medido em 26/07/2026
//
// 18 de 60 planos de produção saíram SEM NENHUMA seção prática (só
// "entender + observar"): as 7 seções rodavam todas em paralelo, cada falha
// virava `null` em silêncio, e o único guard só disparava se TUDO falhasse.
// Resultado: plano amputado salvo e entregue como se estivesse completo —
// enquanto o catálogo da Ayla promete crenças, brincadeiras e frases.
//
// Três travas, nesta ordem: (1) menos chamadas ao mesmo tempo, (2) retentativa
// com espera crescente, (3) nunca salvar plano sem o "o que fazer".
// ============================================================

/** Quantas seções práticas geram ao mesmo tempo. 7 em paralelo (cada uma =
 *  1 roteador + 1 Sonnet = 14 chamadas simultâneas) era ímã de rate-limit. */
const CONCORRENCIA_SECOES = 3;
/** Tentativas por seção antes de desistir dela. */
const TENTATIVAS_POR_SECAO = 3;
/**
 * Mínimo de seções PRÁTICAS pra o plano poder ser entregue. Abaixo disso a mãe
 * recebe diagnóstico sem "o que fazer" — que foi exatamente o caso dos 18.
 * É contagem, não lista fixa: exigir uma seção específica recusaria plano bom
 * (4 práticas ricas sem uma delas continua sendo um plano).
 */
const MINIMO_PRATICAS = 3;

/**
 * Plano gerado sem as práticas essenciais. Existe como tipo próprio pra quem
 * chama poder distinguir "não veio completo" (pede pra tentar de novo) de um
 * erro qualquer (silencioso) — e pra nunca gravar meio plano no lugar.
 */
export class PlanoIncompletoError extends Error {
  readonly geradas: string[];
  readonly falhas: string[];
  constructor(geradas: string[], falhas: string[]) {
    super("Não consegui montar o plano completo agora. Tente de novo em instantes.");
    this.name = "PlanoIncompletoError";
    this.geradas = geradas;
    this.falhas = falhas;
  }
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Roda `fn` até `TENTATIVAS_POR_SECAO` vezes, com espera crescente + jitter
 *  (rate-limit some sozinho em segundos; falhar de primeira não é motivo pra
 *  entregar plano capenga). Propaga o último erro se todas falharem. */
async function comRetentativa<T>(rotulo: string, fn: () => Promise<T>): Promise<T> {
  let ultimo: unknown;
  for (let tentativa = 1; tentativa <= TENTATIVAS_POR_SECAO; tentativa++) {
    try {
      return await fn();
    } catch (e) {
      ultimo = e;
      if (tentativa === TENTATIVAS_POR_SECAO) break;
      const ms = 700 * 2 ** (tentativa - 1) + Math.floor(Math.random() * 400);
      console.warn(
        `[plano.retry] ${rotulo} tentativa ${tentativa}/${TENTATIVAS_POR_SECAO} falhou (${
          ultimo instanceof Error ? ultimo.message : ultimo
        }) — nova tentativa em ${ms}ms`,
      );
      await espera(ms);
    }
  }
  throw ultimo instanceof Error ? ultimo : new Error(String(ultimo));
}

/** Promise.all com teto de concorrência, preservando a ordem de entrada. */
async function mapComLimite<T, R>(
  itens: readonly T[],
  limite: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const saida = new Array<R>(itens.length);
  let proximo = 0;
  const trabalhadores = Array.from(
    { length: Math.min(limite, itens.length) },
    async function trabalhar() {
      for (;;) {
        const i = proximo++;
        if (i >= itens.length) return;
        saida[i] = await fn(itens[i]);
      }
    },
  );
  await Promise.all(trabalhadores);
  return saida;
}

/**
 * Numa chamada Haiku barata: resume o ASSUNTO (pra título do plano) e decide
 * quais seções condicionais entram. Degradação: sem título, inclui história.
 */
async function analisarDesafio(
  desafio: string,
): Promise<{ titulo: string; historia_social: boolean; rotina: boolean }> {
  try {
    const client = getAnthropicClient();
    const sys = `Dado o desafio de uma criança neurodivergente, devolva APENAS JSON:
{"titulo":"...","historia_social":true|false,"rotina":true|false}
- titulo: 3 a 6 palavras resumindo o ASSUNTO do desafio, específico, SEM a palavra "plano". Ex.: "Brincar com outras crianças", "Sono e hora de dormir", "Transição da escola pra casa".
- historia_social: true quando o tema envolve transições, regras, situações sociais, ou antecipar/ensaiar algo.
- rotina: true quando envolve estruturar o dia a dia (sono, refeições, horários, sequências).`;
    const final = await client.messages.create({
      model: MODELS.leve,
      max_tokens: 80,
      system: [{ type: "text", text: sys }],
      messages: [{ role: "user", content: desafio.slice(0, 800) }],
    });
    const raw = textoDeResposta(final.content);
    const m = raw.match(/\{[\s\S]*\}/);
    const o = m ? (JSON.parse(m[0]) as Record<string, unknown>) : {};
    return {
      titulo: typeof o.titulo === "string" ? o.titulo.trim() : "",
      historia_social: Boolean(o.historia_social),
      rotina: Boolean(o.rotina),
    };
  } catch {
    return { titulo: "", historia_social: true, rotina: false };
  }
}

/** Gera "entender" (acolhe + hipótese) e "observar" numa chamada focada. */
async function gerarEntenderObservar(params: {
  supabase: SupabaseClient;
  familyId: string;
  membroAtipicoId: string | null;
  desafio: string;
}): Promise<{ entender: string; observar: string }> {
  const { supabase, familyId, membroAtipicoId, desafio } = params;
  try {
    return await comRetentativa("entender/observar", async () => {
      const skills = await loadActiveSkills(supabase);
      const roteadas =
        skills.length > 0 ? await routeSkillsAI(desafio, skills, { maxSkills: 2 }) : [];
      const ctx = await buildContext(supabase, {
        familyId,
        membroAtipicoId,
        skills: roteadas.map((r) => r.skill),
        conversaId: null,
      });
      const contexto = buildContextBlock(ctx);
      const system = `Você é a Kolo.

${VOZ_LIMITES_E_FRONTEIRA}

# Tarefa
Produza DUAS partes curtas, ESPECÍFICAS e personalizadas (use os dados reais do contexto):
- entender: ${RECEITA_ENTENDER}
- observar: ${RECEITA_OBSERVAR}
Responda APENAS JSON válido: {"entender":"...markdown...","observar":"...markdown..."}`;
      const client = getAnthropicClient();
      const final = await client.messages.create({
        model: MODELS.principal,
        max_tokens: 1600,
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages: [
          {
            role: "user",
            content: `${contexto}\n\n<desafio>\n${desafio}\n</desafio>\n\nSó o JSON.`,
          },
        ],
      });
      const raw = textoDeResposta(final.content);
      const m = raw.match(/\{[\s\S]*\}/);
      const o = m ? (JSON.parse(m[0]) as Record<string, unknown>) : {};
      const entender = typeof o.entender === "string" ? o.entender.trim() : "";
      const observar = typeof o.observar === "string" ? o.observar.trim() : "";
      // Vazio conta como falha (senão a retentativa nunca acontece).
      if (!entender && !observar) throw new Error("resposta sem entender/observar");
      return { entender, observar };
    });
  } catch (e) {
    // Degradação: o plano ainda pode sair com as PRÁTICAS, que é o que a mãe
    // usa. O guard do multi-call decide se dá pra entregar assim.
    console.warn("[plano.entenderObservar]", e instanceof Error ? e.message : e);
    return { entender: "", observar: "" };
  }
}

/**
 * Gera o plano com a MESMA qualidade dos botões: cada seção prática é o
 * output_type correspondente (respondAsOutputType — o exato gerador do botão),
 * em lotes de 3 com retentativa; entender/observar numa chamada focada;
 * condicionais (história/rotina) só quando o tema pede. Mais caro que a chamada
 * única, mas é a qualidade que a mãe pediu — e roda em 2º plano, então não
 * prende ninguém.
 *
 * Lança PlanoIncompletoError quando as práticas não vêm: plano sem "o que
 * fazer" não é entregue nem gravado.
 */
export async function gerarSecoesPlanoMultiCall(params: {
  supabase: SupabaseClient;
  familyId: string;
  membroAtipicoId: string | null;
  desafio: string;
}): Promise<{ titulo: string; tema: string; secoes: PlanoSecao[] }> {
  const { supabase, familyId, membroAtipicoId, desafio } = params;

  const [{ data: otsRaw }, { data: membroRow }, analise] = await Promise.all([
    supabase.from("output_types").select("key, label, prompt_template").eq("ativo", true),
    membroAtipicoId
      ? supabase.from("membros_atipicos").select("nome").eq("id", membroAtipicoId).maybeSingle()
      : Promise.resolve({ data: null }),
    analisarDesafio(desafio),
  ]);
  const conds = { historia_social: analise.historia_social, rotina: analise.rotina };
  const otByKey = new Map((otsRaw ?? []).map((o) => [o.key as string, o as OutputTypeRow]));

  const tiposPraGerar = [
    ...SECOES_SEMPRE,
    ...SECOES_CONDICIONAIS_MC.filter((t) => conds[t as "historia_social" | "rotina"]),
  ];

  // Cada seção prática = o botão real. Em lotes de CONCORRENCIA_SECOES (não
  // todas de uma vez) e com retentativa — as práticas são o plano.
  const falhas: Array<{ tipo: string; motivo: string }> = [];
  const [secoesOutput, framing] = await Promise.all([
    mapComLimite(tiposPraGerar, CONCORRENCIA_SECOES, async (tipo) => {
      const ot = otByKey.get(TIPO_PARA_OUTPUT[tipo]);
      if (!ot) {
        falhas.push({ tipo, motivo: "output_type ausente ou inativo" });
        return null;
      }
      try {
        return await comRetentativa(tipo, async () => {
          const r = await respondAsOutputType({
            supabase,
            familyId,
            membroAtipicoId,
            outputType: { key: ot.key, label: ot.label, prompt_template: ot.prompt_template },
            pedido: desafio,
          });
          const txt = (r.texto ?? "").trim();
          if (!txt) throw new Error("seção veio vazia");
          return { tipo, titulo: ot.label, conteudo_markdown: txt } as PlanoSecao;
        });
      } catch (e) {
        const motivo = e instanceof Error ? e.message : String(e);
        console.warn("[plano.multicall]", tipo, motivo);
        falhas.push({ tipo, motivo: motivo.slice(0, 200) });
        return null;
      }
    }),
    gerarEntenderObservar({ supabase, familyId, membroAtipicoId, desafio }),
  ]);
  if (!framing.entender && !framing.observar) {
    falhas.push({ tipo: "entender/observar", motivo: "não veio depois das retentativas" });
  }

  const porTipo = new Map<string, PlanoSecao>();
  if (framing.entender.trim())
    porTipo.set("entender", { tipo: "entender", titulo: "", conteudo_markdown: framing.entender });
  if (framing.observar.trim())
    porTipo.set("observar", { tipo: "observar", titulo: "", conteudo_markdown: framing.observar });
  for (const s of secoesOutput) if (s) porTipo.set(s.tipo, s);

  const secoes = ORDEM_SECOES.map((t) => porTipo.get(t)).filter(
    (s): s is PlanoSecao => Boolean(s),
  );

  // GUARD: plano sem "o que fazer" não é plano — é diagnóstico. Antes daqui,
  // 18 de 60 planos saíam só com entender+observar e eram salvos assim mesmo.
  const praticas = secoes.filter((s) => (SECOES_SEMPRE as readonly string[]).includes(s.tipo));
  const completo = praticas.length >= MINIMO_PRATICAS;

  if (falhas.length > 0 || !completo) {
    // severity warn+ persiste em eventos_app — antes isto era só console.warn,
    // e por isso o problema viveu semanas sem rastro nenhum.
    await logEvent({
      kind: completo ? "plano_secoes_falharam" : "plano_incompleto",
      severity: completo ? "warn" : "error",
      family_account_id: familyId,
      message: `${falhas.length} seção(ões) falharam; ${secoes.length} geradas`,
      payload: {
        falhas,
        geradas: secoes.map((s) => s.tipo),
        praticas: praticas.length,
        completo,
      },
    });
  }

  if (!completo) {
    throw new PlanoIncompletoError(
      secoes.map((s) => s.tipo),
      falhas.map((f) => f.tipo),
    );
  }

  const nome = (membroRow as { nome?: string } | null)?.nome
    ? capitalizarNome((membroRow as { nome: string }).nome)
    : null;
  const assunto = analise.titulo;
  return {
    titulo: assunto || (nome ? `Plano — ${nome}` : "Plano"),
    tema: assunto || desafio.slice(0, 80),
    secoes,
  };
}

/**
 * Aprendizado (Fase 4): o que a família já disse sobre planos anteriores
 * desta criança. Vira um bloco curto pra o modelo priorizar o que funcionou
 * e evitar o que não funcionou.
 */
async function carregarAprendizado(
  supabase: SupabaseClient,
  familyId: string,
  membroAtipicoId: string | null,
): Promise<string | null> {
  let q = supabase
    .from("planos")
    .select("tema, resultado, resultado_nota")
    .eq("family_account_id", familyId)
    .not("resultado", "is", null)
    .order("resultado_em", { ascending: false })
    .limit(8);
  q = membroAtipicoId
    ? q.eq("membro_atipico_id", membroAtipicoId)
    : q.is("membro_atipico_id", null);
  const { data } = await q;
  if (!data || data.length === 0) return null;

  const rotulo: Record<string, string> = {
    funcionou: "funcionou",
    parcial: "funcionou mais ou menos",
    nao_funcionou: "NÃO funcionou",
    nao_testou: "ainda não testou",
  };
  const linhas = data
    .filter((p) => p.resultado && p.resultado !== "nao_testou")
    .map((p) => {
      const tema = (p.tema as string | null)?.trim() || "plano";
      const r = rotulo[p.resultado as string] ?? (p.resultado as string);
      const nota = (p.resultado_nota as string | null)?.trim();
      return `- ${tema}: ${r}${nota ? ` — "${nota}"` : ""}`;
    });
  if (linhas.length === 0) return null;

  return `<o_que_ja_funcionou>\n${linhas.join("\n")}\n</o_que_ja_funcionou>`;
}

function normalizarSecao(s: unknown): PlanoSecao {
  const x = (s ?? {}) as Record<string, unknown>;
  const tipo =
    typeof x.tipo === "string" && (PLANO_TIPOS as readonly string[]).includes(x.tipo)
      ? x.tipo
      : "entender";
  return {
    tipo,
    titulo: typeof x.titulo === "string" ? x.titulo : "",
    conteudo_markdown: typeof x.conteudo_markdown === "string" ? x.conteudo_markdown : "",
  };
}

/**
 * Resgata as seções mesmo quando o JSON vem truncado (ex.: estourou
 * max_tokens) ou com prosa em volta. Faz brace-matching ciente de strings:
 * cada objeto `{...}` balanceado que contiver "conteudo_markdown" é parseado
 * individualmente — o último objeto incompleto é simplesmente ignorado, em
 * vez de derrubar o plano inteiro.
 */
function salvarSecoes(raw: string): PlanoSecao[] {
  const out: PlanoSecao[] = [];
  const seen = new Set<string>();
  const stack: number[] = [];
  let inStr = false;
  let esc = false;

  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") stack.push(i);
    else if (c === "}") {
      const start = stack.pop();
      if (start === undefined) continue;
      const slice = raw.slice(start, i + 1);
      if (!slice.includes("conteudo_markdown")) continue;
      try {
        const o = JSON.parse(slice) as Record<string, unknown>;
        if (typeof o.conteudo_markdown === "string" && o.conteudo_markdown.trim()) {
          const sec = normalizarSecao(o);
          const key = `${sec.tipo}|${sec.conteudo_markdown.slice(0, 48)}`;
          if (!seen.has(key)) {
            seen.add(key);
            out.push(sec);
          }
        }
      } catch {
        // objeto interno inválido — ignora e segue
      }
    }
  }
  return out;
}

function parsePlano(raw: string): {
  titulo?: string;
  tema?: string;
  secoes: PlanoSecao[];
} {
  let obj: unknown = null;
  try {
    obj = JSON.parse(raw.trim());
  } catch {
    const m = raw.match(/```json\s*([\s\S]*?)\s*```/i) ?? raw.match(/(\{[\s\S]*\})/);
    if (m) {
      try {
        obj = JSON.parse(m[1]);
      } catch {
        obj = null;
      }
    }
  }
  const o = (obj ?? {}) as { titulo?: unknown; tema?: unknown; secoes?: unknown };
  const secoesRaw = Array.isArray(o.secoes) ? o.secoes : [];
  let secoes: PlanoSecao[] = secoesRaw
    .map(normalizarSecao)
    .filter((s) => s.conteudo_markdown.trim().length > 0);

  // JSON cortado/ilegível → resgata o que dá das seções soltas no texto.
  if (secoes.length === 0) {
    secoes = salvarSecoes(raw);
  }

  return {
    titulo: typeof o.titulo === "string" ? o.titulo : undefined,
    tema: typeof o.tema === "string" ? o.tema : undefined,
    secoes,
  };
}
