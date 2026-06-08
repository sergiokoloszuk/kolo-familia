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

/** Tipos de seção que a tela sabe renderizar/filtrar. */
export const PLANO_TIPOS = [
  "entender",
  "crencas",
  "brincadeiras",
  "atividades",
  "diferente",
  "frases",
  "rotina",
  "observar",
] as const;

const SISTEMA = `Você é a Kolo montando um PLANO completo e personalizado pra o adulto responsável por uma criança neurodivergente.

${VOZ_E_LIMITES}

# Como montar o plano
- Organize em SEÇÕES. Escolha SÓ as relevantes ao desafio — não force todas.
- Tipos possíveis (campo "tipo"): "entender", "crencas", "brincadeiras", "atividades", "diferente", "frases", "rotina", "observar".
- entender: 1-2 parágrafos acolhedores + a hipótese central (possibilidade, NUNCA causa afirmada).
- crencas: até 3 crenças limitantes sobre a CRIANÇA + até 3 sobre o RESPONSÁVEL — as do responsável SEMPRE como hipótese gentil pra refletir, jamais julgamento ("pode ser que bata um receio de…"). Depois, como ajustar o olhar, com argumentos acolhedores.
- brincadeiras: VÁRIAS (3 ou mais), curtas, ancoradas nos interesses da criança, com materiais e duração.
- atividades / diferente / frases / rotina: conforme fizer sentido pro desafio.
- observar: o que reparar nos próximos dias pra entender melhor.
- Use o que você já sabe da criança (contexto abaixo). Voz de amiga sábia, NÃO relatório. Markdown leve dentro de cada seção (listas, *itálico* na frase pronta).
- Se houver um bloco <o_que_ja_funcionou>, APRENDA com ele: priorize abordagens parecidas com o que funcionou e NÃO repita o que a família já disse que não funcionou. Não cite o bloco nem diga "da última vez" — só deixe o plano mais certeiro.

# Saída
Responda APENAS com JSON válido, sem texto antes/depois:
{"titulo":"...","tema":"...","secoes":[{"tipo":"...","titulo":"...","conteudo_markdown":"..."}]}
"titulo" curto (ex.: "Plano de foco — Maria"). "tema" = o foco do plano.`;

export async function gerarPlano(params: {
  supabase: SupabaseClient;
  familyId: string;
  membroAtipicoId: string | null;
  desafio: string;
  conversaId?: string | null;
}): Promise<{ id: string; titulo: string; secoes: PlanoSecao[] }> {
  const { supabase, familyId, membroAtipicoId, desafio, conversaId } = params;

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
  const userMsg = `${contexto}${aprendizado ? `\n\n${aprendizado}` : ""}\n\n<desafio>\n${desafio}\n</desafio>\n\nMonte o plano. Só o JSON.`;

  const client = getAnthropicClient();
  const final = await client.messages.create({
    model: MODELS.principal,
    max_tokens: 3500,
    system: [{ type: "text", text: SISTEMA, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userMsg }],
  });

  const raw = final.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("");

  const parsed = parsePlano(raw);
  if (parsed.secoes.length === 0) {
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
      origem: "estrategias",
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
  const secoes: PlanoSecao[] = secoesRaw
    .map((s) => {
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
    })
    .filter((s) => s.conteudo_markdown.trim().length > 0);
  return {
    titulo: typeof o.titulo === "string" ? o.titulo : undefined,
    tema: typeof o.tema === "string" ? o.tema : undefined,
    secoes,
  };
}
