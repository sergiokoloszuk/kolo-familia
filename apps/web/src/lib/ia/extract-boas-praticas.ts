import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getAnthropicClient, MODELS } from "./anthropic";
import { getSystemPrompt } from "@/lib/ai/prompts";

const BPCandidatasSchema = z.object({
  candidatas: z
    .array(
      z.object({
        titulo: z.string().min(3).max(120),
        texto_original: z.string().min(20).max(2000),
        skills_relacionadas: z.array(z.string()).max(5).default([]),
        tags: z.array(z.string()).max(8).default([]),
        nivel: z.enum(["iniciante", "intermediario", "avancado"]).optional(),
      }),
    )
    .max(10),
});

export type BPCandidata = z.infer<typeof BPCandidatasSchema>["candidatas"][number];

const SKILL_NAMES_HINT =
  "sensorial, regulacao_emocional, comunicacao, transicoes, sono, meu_bem_estar, comportamento_e_limites";

const SYSTEM_PROMPT_FALLBACK = `Você ajuda a fundadora do Kolo Família a transformar a transcrição de uma aula em sugestões de Boas Práticas curadas.

# O que é uma Boa Prática
Orientação curta e aplicável que as skills do app vão consumir em conversas reais. Não é resumo de aula — é uma dica concreta que a mãe pode usar.

Cada Boa Prática deve:
- Ser autocontida (entendível sem o resto da aula).
- Trazer uma ideia/estratégia/dica clara e aplicável.
- Estar em português direto, sem jargão clínico.
- Abrir hipóteses, nunca afirmar causas.

# Formato de saída
Devolva APENAS um JSON com a forma { "candidatas": [...] } — nada antes, nada depois. No máximo 10 candidatas por aula.

Cada candidata:
- titulo: frase curta de 3-12 palavras
- texto_original: o trecho da transcrição (até 2 frases) que motiva a prática, parafraseado se necessário pra ficar autocontido
- skills_relacionadas: nomes das skills que se beneficiam (escolha entre: ${SKILL_NAMES_HINT})
- tags: 2-5 palavras-chave temáticas
- nivel (opcional): iniciante | intermediario | avancado

# Limites
- NÃO use termos clínicos prescritivos (diagnóstico, tratamento, cura).
- NÃO compare com outras crianças.
- NÃO use palavras alarmistas (preocupante, grave) fora de risco real.
- Se a transcrição não tiver orientações práticas, devolva { "candidatas": [] }.`;

/**
 * Processa a transcrição de uma aula e extrai candidatas de Boa Prática.
 * Chamado server-side quando a aula é publicada (status muda pra ativo).
 *
 * Insere as candidatas em boas_praticas com status='rascunho', origem='aula',
 * aula_id setado. Admin revisa, aprova → vira ativa.
 *
 * Retorna número de candidatas inseridas. Se a chave da Anthropic não estiver
 * configurada, registra um warning e retorna 0 (não bloqueia o publish).
 */
export async function extractBoasPraticasFromAula(
  supabase: SupabaseClient,
  aulaId: string,
): Promise<{ inseridas: number; aviso?: string }> {
  const { data: aula, error: aulaErr } = await supabase
    .from("aulas")
    .select("id, titulo, transcricao, perfis_aplicaveis, faixa_etaria_min, faixa_etaria_max")
    .eq("id", aulaId)
    .single();
  if (aulaErr || !aula) {
    return { inseridas: 0, aviso: `Aula não encontrada: ${aulaErr?.message}` };
  }

  if (!aula.transcricao || aula.transcricao.trim().length < 100) {
    return { inseridas: 0, aviso: "Transcrição vazia ou muito curta — nada extraído." };
  }

  let client;
  try {
    client = getAnthropicClient();
  } catch {
    return {
      inseridas: 0,
      aviso: "ANTHROPIC_API_KEY não configurada — extração pulada. Configure e despublique/republique a aula para tentar de novo.",
    };
  }

  const systemPrompt = await getSystemPrompt("extract_boas_praticas", SYSTEM_PROMPT_FALLBACK);

  const stream = client.messages.stream({
    model: MODELS.principal,
    max_tokens: 4096,
    system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: `<aula>
titulo: ${aula.titulo}
transcricao:
${aula.transcricao}
</aula>

Devolva o JSON com as candidatas.`,
      },
    ],
  });

  const finalMessage = await stream.finalMessage();
  const texto = finalMessage.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("");

  const json = parseJsonLoose(texto);
  if (!json) {
    return { inseridas: 0, aviso: "Resposta da IA não veio em JSON válido." };
  }

  const parsed = BPCandidatasSchema.safeParse(json);
  if (!parsed.success) {
    return {
      inseridas: 0,
      aviso: `Estrutura inválida: ${parsed.error.message.slice(0, 200)}`,
    };
  }

  if (parsed.data.candidatas.length === 0) {
    return { inseridas: 0, aviso: "Nenhuma candidata identificada nesta aula." };
  }

  const rows = parsed.data.candidatas.map((c) => ({
    texto_original: c.texto_original,
    titulo: c.titulo,
    versao_curta: c.titulo,
    skills_relacionadas: c.skills_relacionadas,
    tags: c.tags,
    perfis_aplicaveis: aula.perfis_aplicaveis ?? [],
    faixa_etaria_min: aula.faixa_etaria_min,
    faixa_etaria_max: aula.faixa_etaria_max,
    nivel: c.nivel ?? null,
    origem: "aula",
    aula_id: aula.id,
    status: "rascunho",
    versao: 1,
    peso_relevancia: 0.5,
  }));

  const { error: insertErr } = await supabase.from("boas_praticas").insert(rows);
  if (insertErr) {
    return { inseridas: 0, aviso: `Falha ao inserir: ${insertErr.message}` };
  }

  return { inseridas: rows.length };
}

/**
 * Tenta extrair JSON do texto. Aceita JSON puro ou JSON dentro de ```json ... ```
 */
function parseJsonLoose(s: string): unknown {
  const trimmed = s.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // pode ser ```json ... ``` ou cercado de prosa
    const match = trimmed.match(/```json\s*([\s\S]*?)\s*```/i) ?? trimmed.match(/(\{[\s\S]*\})/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch {
        return null;
      }
    }
    return null;
  }
}
