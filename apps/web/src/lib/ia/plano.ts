import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnthropicClient, MODELS } from "./anthropic";
import { buildContext } from "./context";
import { buildContextBlock, VOZ_E_LIMITES } from "./prompt";
import { loadActiveSkills, routeSkillsAI } from "./router";
import { capitalizarNome } from "@/lib/nome";

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

const SISTEMA_PADRAO = `Você é a Kolo montando um PLANO completo e personalizado pra o adulto responsável por uma criança neurodivergente.

${VOZ_E_LIMITES}

# Como montar o plano
O plano é UM documento coeso, lido de cima a baixo. Cada seção tem um papel ÚNICO: uma ideia mora em UMA seção só — NUNCA repita a mesma sugestão ou frase em duas seções.

## Seções do NÚCLEO — SEMPRE presentes, nesta ordem:
- entender: 1-2 parágrafos que acolhem + 1 hipótese central do que pode estar por trás (possibilidade, NUNCA causa afirmada). Aqui você NÃO dá soluções.
- diferente: os princípios de como agir — postura, ambiente, abordagem (o "jeito" de lidar). NÃO liste brincadeiras/atividades concretas aqui (elas têm seção própria).
- frases: 2-4 falas prontas pro adulto usar nos momentos-chave, em *itálico*. Frases prontas aparecem SÓ aqui.
- observar: 1-2 coisas pra reparar nos próximos dias pra entender melhor.

## Seções EXTRAS — inclua SÓ quando forem relevantes ao desafio:
- crencas: até 3 crenças limitantes da CRIANÇA + até 3 da RESPONSÁVEL (as do responsável SEMPRE como hipótese gentil pra refletir, jamais julgamento) + como reenquadrar, acolhedor. NÃO repita a hipótese da seção "entender" — aprofunde.
- rotina: como ancorar no dia a dia — estrutura no tempo (quando/como na rotina). NÃO repita os princípios de "diferente".
- brincadeiras: VÁRIAS (3+) brincadeiras LÚDICAS/livres, ancoradas nos interesses da criança, com materiais e duração.
- atividades: atividades mais DIRIGIDAS/estruturadas, com objetivo (ex.: treinar uma habilidade) — diferentes de brincadeira livre.
- historia_social: UMA história social pronta sobre o tema (só quando combinar: transições, regras, situações sociais).

Ordem final quando houver extras: entender → crencas → diferente → rotina → brincadeiras → atividades → historia_social → frases → observar.

Use o que você já sabe da criança (contexto abaixo). Voz de amiga sábia, NÃO relatório. Markdown leve dentro de cada seção.
${SISTEMA_APRENDIZADO}

${SAIDA}
"titulo" curto (ex.: "Plano de foco — Maria"). Use EXATAMENTE estes valores no campo "tipo": entender, crencas, diferente, rotina, brincadeiras, atividades, historia_social, frases, observar.`;

const SISTEMA_FIM_DE_SEMANA = `Você é a Kolo montando um ROTEIRO LEVE de fim de semana pro adulto responsável por uma criança neurodivergente.

${VOZ_E_LIMITES}

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

function sistemaPlano(variante: VariantePlano): string {
  return variante === "fim_de_semana" ? SISTEMA_FIM_DE_SEMANA : SISTEMA_PADRAO;
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
      : "Monte o plano. Só o JSON.";
  const userMsg = `${contexto}${aprendizado ? `\n\n${aprendizado}` : ""}\n\n<${wrapper}>\n${desafio}\n</${wrapper}>\n\n${pedido}`;

  const client = getAnthropicClient();
  const final = await client.messages.create({
    model: MODELS.principal,
    // 6000 = meio-termo: cabe um plano completo (3500 truncava) sem deixar a
    // geração longa demais (8000 levava ~2min e estourava timeout). Se ainda
    // cortar, salvarSecoes() resgata as seções completas.
    max_tokens: 6000,
    system: [
      { type: "text", text: sistemaPlano(variante), cache_control: { type: "ephemeral" } },
    ],
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

  const { data, error } = await supabase
    .from("planos")
    .insert({
      family_account_id: familyId,
      membro_atipico_id: membroAtipicoId,
      conversa_id: conversaId ?? null,
      titulo,
      tema,
      secoes: parsed.secoes,
      origem,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Erro ao salvar o plano: ${error.message}`);

  return { id: (data as { id: string }).id, titulo, secoes: parsed.secoes };
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
