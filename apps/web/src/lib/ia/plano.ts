import type { SupabaseClient } from "@supabase/supabase-js";
import {
  escolherTitulo,
  validarPlano,
  resumirFalhasPlano,
  PlanoSemSubstanciaError,
} from "./validacao-plano";
import { getAnthropicClient, MODELS } from "./anthropic";
import { buildContext } from "./context";
import { buildContextBlock, VOZ_LIMITES_E_FRONTEIRA } from "./prompt";
import { loadActiveSkills, routeSkillsAI } from "./router";
import { blocoAntiRepeticao, recursosConcretos, PAPEL_DA_SECAO } from "./plano-recursos";
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
  // O ARCO (uma chamada só, no fim): objetivo → progressão → evitar →
  // incentivar → avaliar → ajustar. São seis papéis que precisam nascer
  // JUNTOS pra formar um caminho; seis chamadas independentes produziriam
  // seis listas soltas — o mesmo defeito que fez metade dos planos repetir
  // "almofada" em três seções.
  "objetivo",
  "progressao",
  "evitar",
  "incentivar",
  "avaliar",
  "ajustar",
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
// A ordem em que a família LÊ. Objetivo abre (pra que serve isto), a
// estratégia central vem logo depois do entendimento, e o arco de avaliação e
// ajuste fecha — é o que transforma o PDF em intervenção com continuidade, em
// vez de uma coleção de seções.
const ORDEM_SECOES = [
  "objetivo",
  "entender",
  "diferente",
  "progressao",
  "rotina",
  "brincadeiras",
  "atividades",
  "historia_social",
  "frases",
  "evitar",
  "crencas",
  "incentivar",
  "observar",
  "avaliar",
  "ajustar",
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
  /**
   * O tema que a PRONTIDÃO já validou a partir da conversa. É o fallback do
   * título quando `analisarDesafio` — que é outra chamada, sobre o mesmo
   * material — devolve algo que admite falta de contexto.
   */
  temaValidado?: string | null;
}): Promise<{ id: string; titulo: string; secoes: PlanoSecao[] }> {
  const {
    supabase,
    familyId,
    membroAtipicoId,
    desafio,
    conversaId,
    variante = "padrao",
    origem = "estrategias",
    temaValidado = null,
  } = params;

  // Padrão usa o MULTI-CALL (cada seção = o botão real, "crenças" garantida, tudo
  // preso na criança) — o MESMO gerador da web, com o formato definido. Antes o
  // WhatsApp usava o single-call de 12k tokens, que com contexto grande (2 filhos,
  // viagem…) derivava e dropava seções (ex.: crenças). Fim de semana segue single.
  const { titulo, tema, secoes } =
    variante === "fim_de_semana"
      ? await gerarSecoesPlano({ supabase, familyId, membroAtipicoId, desafio, variante })
      : await gerarSecoesPlanoMultiCall({ supabase, familyId, membroAtipicoId, desafio });

  // ── TÍTULO: uma fonte, e um plano bom não morre por causa dele ─────────
  // `analisarDesafio` é uma chamada SEPARADA que olha o mesmo material e pode
  // discordar. Foi assim que saiu um PDF chamado "Aguardando a situação
  // específica de Adelly" com sete seções boas dentro. O título é consertável;
  // o conteúdo não. Então o título ruim cai pro tema já validado.
  const escolha = escolherTitulo({ gerado: titulo, temaValidado: temaValidado ?? tema, nome: null });
  if (escolha.trocado) {
    console.warn(`[plano] título trocado — ${escolha.motivo} → "${escolha.titulo}"`);
  }
  const tituloFinal = escolha.titulo;

  // ── PORTÃO: nada é persistido, nem vira PDF ou link, sem substância ────
  const veredito = validarPlano({ titulo: tituloFinal, secoes });
  if (!veredito.ok) {
    console.warn(`[plano] BARRADO — ${resumirFalhasPlano(veredito.falhas)}`);
    await logEvent({
      kind: "plano_sem_substancia",
      severity: "error",
      family_account_id: familyId,
      message: resumirFalhasPlano(veredito.falhas),
      payload: { titulo: tituloFinal, secoes: secoes.map((x) => x.tipo) },
    });
    throw new PlanoSemSubstanciaError(veredito.falhas);
  }

  const { data, error } = await supabase
    .from("planos")
    .insert({
      family_account_id: familyId,
      membro_atipico_id: membroAtipicoId,
      conversa_id: conversaId ?? null,
      titulo: tituloFinal,
      tema,
      secoes,
      origem,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Erro ao salvar o plano: ${error.message}`);

  return { id: (data as { id: string }).id, titulo: tituloFinal, secoes };
}

function textoDeResposta(content: Array<{ type: string }>): string {
  return (content as Array<{ type: string; text?: string }>)
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("")
    .trim();
}

// Seções práticas SEMPRE no plano (cada uma = o botão correspondente).
/** A ESTRATÉGIA CENTRAL. Fora do lote de propósito: é gerada ANTES e alimenta
 *  todas as outras. Era opcional e faltava em 18% dos planos — justamente a
 *  seção que define o caminho. */
const SECAO_ESTRATEGIA = "diferente";
/** As práticas que rodam depois dela, já sabendo o que ela disse. */
const SECOES_SEMPRE = ["crencas", "brincadeiras", "atividades", "frases"] as const;
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
/**
 * O GUARD, e por que deixou de ser contagem.
 *
 * Era "3 de 5 práticas". Um plano passava sem `diferente` — sem o caminho —
 * desde que tivesse três seções quaisquer. A auditoria achou isso em 18% dos
 * planos reais: cheios de atividades, sem dizer o que mudar.
 *
 * Agora é substância. Sem estratégia central, progressão e critério de
 * avaliação não existe intervenção: existe material.
 */
const SECOES_OBRIGATORIAS = ["diferente", "progressao", "avaliar"] as const;
const MINIMO_PRATICAS = 2;

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
/**
 * O ARCO — uma chamada, seis papéis, um caminho só.
 *
 * ⚠️ POR QUE UMA E NÃO SEIS. Objetivo, progressão, o que evitar, como
 * incentivar, como avaliar e quando ajustar são a mesma linha vista de seis
 * ângulos: o degrau de avanço tem que ser o mesmo que o critério de avaliação
 * mede, e o que se evita tem que ser o oposto do que se incentiva. Geradas
 * separadamente, sairiam seis listas que não se encaixam — e o plano passaria
 * de 7-9 para 13-15 chamadas, dobrando custo e latência no canal onde a espera
 * acabou de ser cortada de 14s pra 4s.
 *
 * Ela recebe o plano JÁ PRONTO. É a única chamada que enxerga tudo, e é por
 * isso que ela consegue apontar o próximo degrau de verdade em vez de repetir
 * a estratégia com outras palavras.
 */
async function gerarArcoDoPlano(params: {
  supabase: SupabaseClient;
  familyId: string;
  membroAtipicoId: string | null;
  desafio: string;
  estrategiaCentral: string;
  secoesProntas: readonly PlanoSecao[];
}): Promise<PlanoSecao[]> {
  const { supabase, familyId, membroAtipicoId, desafio, estrategiaCentral } = params;
  const corpo = params.secoesProntas
    .map((x) => `## ${x.titulo || x.tipo}\n${x.conteudo_markdown.slice(0, 1400)}`)
    .join("\n\n");
  try {
    return await comRetentativa("arco", async () => {
      const skills = await loadActiveSkills(supabase);
      const roteadas =
        skills.length > 0 ? await routeSkillsAI(desafio, skills, { maxSkills: 2 }) : [];
      const ctx = await buildContext(supabase, {
        familyId,
        membroAtipicoId,
        skills: roteadas.map((r) => r.skill),
        conversaId: null,
      });
      const system = `Você é a Kolo.

${VOZ_LIMITES_E_FRONTEIRA}

# Tarefa
Você recebe um plano JÁ ESCRITO e fecha o arco que falta. São SEIS partes, e elas têm que formar UM caminho: o degrau que a progressão propõe é o mesmo que a avaliação mede, e o que se evita é o oposto do que se incentiva.

- objetivo: o que vai ficar mais fácil, mais funcional ou mais autônomo. FUNCIONAL e OBSERVÁVEL ("começar a lição sem alguém do lado"), nunca abstrato ("melhorar o foco"). Uma ou duas frases.
- progressao: por onde começar e como avançar. O PRIMEIRO DEGRAU tem que ser pequeno o bastante pra acontecer esta semana. Diga como reduzir ajuda e como aumentar a exigência, nessa ordem.
- evitar: o que costuma manter o problema de pé. Condutas concretas, ditas sem culpar quem cuida — quem faz isso está tentando ajudar.
- incentivar: como sustentar tentativa e participação SEM criar dependência de elogio nem virar recompensa por obedecer.
- avaliar: como saber que está funcionando, em sinais que dá pra ver em duas semanas. NUNCA "melhorou/não melhorou": precisa de menos ajuda, começa mais rápido, permanece mais tempo, aceita uma etapa nova, se recupera antes, consegue em outro contexto.
- ajustar: o que fazer quando funcionou, quando funcionou em parte, quando não funcionou e quando ficou fácil demais. Um caminho pra cada, em uma linha.

NÃO repita o que o plano já diz — você fecha, não resume. Nada de reapresentar as atividades ou as frases que já estão lá.
Markdown curto em cada parte. Responda APENAS JSON válido:
{"objetivo":"...","progressao":"...","evitar":"...","incentivar":"...","avaliar":"...","ajustar":"..."}`;
      const client = getAnthropicClient();
      const final = await client.messages.create({
        model: MODELS.principal,
        max_tokens: 2200,
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages: [
          {
            role: "user",
            content: `${buildContextBlock(ctx)}

<desafio>
${desafio}
</desafio>

<estrategia_central>
${estrategiaCentral.slice(0, 1500)}
</estrategia_central>

<plano_ja_escrito>
${corpo}
</plano_ja_escrito>

Só o JSON.`,
          },
        ],
      });
      const raw = textoDeResposta(final.content);
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("arco sem JSON");
      const o = JSON.parse(m[0]) as Record<string, unknown>;
      const rotulos: Record<string, string> = {
        objetivo: "Objetivo",
        progressao: "Como avançar",
        evitar: "O que evitar",
        incentivar: "Como incentivar",
        avaliar: "Como saber se está funcionando",
        ajustar: "Quando ajustar",
      };
      const out: PlanoSecao[] = [];
      for (const [tipo, titulo] of Object.entries(rotulos)) {
        const txt = typeof o[tipo] === "string" ? (o[tipo] as string).trim() : "";
        if (txt) out.push({ tipo, titulo, conteudo_markdown: txt });
      }
      if (out.length === 0) throw new Error("arco veio vazio");
      return out;
    });
  } catch (e) {
    console.warn("[plano.arco]", e instanceof Error ? e.message : e);
    return [];
  }
}

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

  // ── 1. A ESTRATÉGIA CENTRAL, SOZINHA E PRIMEIRO ───────────────────────
  // Ela define o caminho, então tudo depois dela precisa vê-la. Era só mais
  // uma no lote, e faltava em 18% dos planos: saíam cheios de atividades sem
  // dizer o que mudar.
  const gerarSecao = async (tipo: string, extra: string): Promise<PlanoSecao | null> => {
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
          pedido: extra ? `${desafio}\n\n${extra}` : desafio,
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
  };

  const estrategia = await gerarSecao(
    SECAO_ESTRATEGIA,
    blocoAntiRepeticao({ jaUsados: [], papel: PAPEL_DA_SECAO[SECAO_ESTRATEGIA] }),
  );
  const estrategiaTexto = estrategia?.conteudo_markdown ?? "";

  // ── 2. AS DEMAIS, JÁ SABENDO O QUE EXISTE ─────────────────────────────
  // `usados` acumula durante o lote: cada seção que termina publica os
  // recursos concretos que gastou, e as que ainda não começaram já os evitam.
  // Com concorrência 3 a ordem não é determinística — mas o pior caso é o
  // comportamento antigo, e o caso comum é bem melhor.
  const usados = new Set<string>(recursosConcretos(estrategiaTexto));
  const [secoesOutput, framing] = await Promise.all([
    mapComLimite(tiposPraGerar, CONCORRENCIA_SECOES, async (tipo) => {
      const secao = await gerarSecao(
        tipo,
        blocoAntiRepeticao({
          estrategiaCentral: estrategiaTexto,
          jaUsados: [...usados],
          papel: PAPEL_DA_SECAO[tipo],
        }),
      );
      // Publica o que gastou pra quem ainda não começou.
      if (secao) for (const r of recursosConcretos(secao.conteudo_markdown)) usados.add(r);
      return secao;
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

  if (estrategia) porTipo.set(estrategia.tipo, estrategia);

  // ── 3. O ARCO, vendo o plano inteiro ──────────────────────────────────
  // Só roda se houve estratégia: fechar um caminho que não existe produziria
  // objetivo e progressão sobre o nada.
  if (estrategiaTexto) {
    const arco = await gerarArcoDoPlano({
      supabase,
      familyId,
      membroAtipicoId,
      desafio,
      estrategiaCentral: estrategiaTexto,
      secoesProntas: [...porTipo.values()],
    });
    for (const a of arco) porTipo.set(a.tipo, a);
    if (arco.length === 0) falhas.push({ tipo: "arco", motivo: "fechamento não veio" });
  }

  const secoes = ORDEM_SECOES.map((t) => porTipo.get(t)).filter(
    (s): s is PlanoSecao => Boolean(s),
  );

  // ── O GUARD, por SUBSTÂNCIA ───────────────────────────────────────────
  // Era contagem ("3 de 5 práticas") e deixava passar plano sem `diferente` —
  // sem o caminho. Agora: sem estratégia central, progressão e critério de
  // avaliação não existe intervenção, existe material. As práticas continuam
  // tendo um piso, mas ele deixou de ser o critério principal.
  const tipos = new Set(secoes.map((s) => s.tipo));
  const faltandoObrigatoria = SECOES_OBRIGATORIAS.filter((t) => !tipos.has(t));
  const praticas = secoes.filter((s) => (SECOES_SEMPRE as readonly string[]).includes(s.tipo));
  const completo = faltandoObrigatoria.length === 0 && praticas.length >= MINIMO_PRATICAS;
  if (faltandoObrigatoria.length > 0) {
    for (const t of faltandoObrigatoria) falhas.push({ tipo: t, motivo: "obrigatória e ausente" });
  }

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
