import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnthropicClient, MODELS } from "@/lib/ia/anthropic";
import { logarUsoApi } from "@/lib/billing/logar";
import { idadeAnos } from "@/lib/idade";

/**
 * Relatório pra ESCOLA/TERAPEUTA — "tradução" do Kolo Vivo + registros recentes
 * numa linguagem clara pro profissional. Descritivo e factual (o que a família
 * observa), NUNCA diagnóstico. A família edita o rascunho e baixa em PDF.
 */

// Domínios → rótulo legível (toplevel + extras).
const ROTULOS: Array<{ key: string; toplevel: boolean; label: string }> = [
  { key: "essencial", toplevel: true, label: "O essencial" },
  { key: "como_e", toplevel: true, label: "Como é / interesses" },
  { key: "comunicacao", toplevel: false, label: "Comunicação" },
  { key: "sensorial", toplevel: true, label: "Sensorial" },
  { key: "nutricional", toplevel: false, label: "Alimentação" },
  { key: "socializacao", toplevel: false, label: "Socialização" },
  { key: "emocional", toplevel: false, label: "Regulação emocional" },
  { key: "foco", toplevel: false, label: "Foco e atenção" },
  { key: "sono", toplevel: false, label: "Sono" },
  { key: "motor", toplevel: false, label: "Motor" },
  { key: "rotina", toplevel: false, label: "Rotina" },
  { key: "autonomia", toplevel: false, label: "Autonomia" },
  { key: "aprendizado", toplevel: false, label: "Aprendizado" },
  { key: "imitacao", toplevel: false, label: "Imitação" },
  { key: "tela_midia", toplevel: false, label: "Tela e mídia" },
  { key: "escola", toplevel: false, label: "Escola" },
  { key: "saude_geral", toplevel: false, label: "Saúde geral" },
  { key: "gostos", toplevel: false, label: "Gostos e interesses" },
  { key: "corpo_rotina", toplevel: true, label: "Corpo e rotina" },
  { key: "desafios_regulacao", toplevel: true, label: "Desafios" },
];

function textoDe(v: unknown): string {
  if (!v || typeof v !== "object") return "";
  const t = (v as { texto?: unknown }).texto;
  return typeof t === "string" ? t.trim() : "";
}

const SYSTEM = `Você redige um RELATÓRIO da família para entregar à ESCOLA ou ao TERAPEUTA, em português do Brasil. Você traduz o que a família registrou (o perfil da criança/pessoa + observações recentes do diário) numa linguagem clara, organizada e respeitosa para o profissional — para ele conhecer rápido quem é essa criança.

Tom: DESCRITIVO e factual a partir do que a FAMÍLIA observa ("a família observa que…", "em casa, costuma…", "segundo a família…"). NUNCA diagnostique nem use rótulo clínico como conclusão. É a família compartilhando o que conhece, não um laudo.

Organize em seções markdown (use "## "), na ordem abaixo, PULANDO as que não tiverem informação:
## Identificação — nome, idade e uma linha de contexto.
## Como se comunica
## Sensorial
## Alimentação
## Socialização
## Regulação emocional
## Rotina e autonomia
## Pontos fortes e interesses
## O que ajuda
## Observações recentes — avanços e desafios do diário, se houver.

Seja conciso e útil; use bullets quando ajudar. NÃO invente nada — use só o que foi dado. Devolva APENAS o relatório em markdown, sem comentários.`;

export type Destinatario = "escola" | "terapeuta";

/** Reúne o contexto da criança (foco + perfil + Kolo Vivo + registros). */
async function montarContextoRelatorio(
  supabase: SupabaseClient,
  familyId: string,
  membroId: string,
  destinatario: Destinatario,
): Promise<{ nome: string; bloco: string } | null> {
  const { data: m } = await supabase
    .from("membros_atipicos")
    .select("id, nome, data_nascimento, perfil")
    .eq("id", membroId)
    .eq("family_account_id", familyId)
    .maybeSingle();
  if (!m) return null;

  const { data: pv } = await supabase
    .from("perfil_vivo_membro")
    .select(
      "essencial, como_e, corpo_rotina, desafios_regulacao, sensorial, categorias_extras",
    )
    .eq("membro_atipico_id", membroId)
    .maybeSingle();
  const extras = (pv?.categorias_extras as Record<string, unknown> | null) ?? {};

  const dominios = ROTULOS.map((r) => {
    const val = r.toplevel ? (pv as Record<string, unknown> | null)?.[r.key] : extras[r.key];
    const t = textoDe(val);
    return t ? `${r.label}: ${t}` : "";
  })
    .filter(Boolean)
    .join("\n");

  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - 60);
  const { data: diarios } = await supabase
    .from("diarios")
    .select("data, conquista, desafio")
    .eq("family_account_id", familyId)
    .eq("membro_atipico_id", membroId)
    .gte("data", dataLimite.toISOString().slice(0, 10))
    .order("data", { ascending: false })
    .limit(15);
  const registros = (diarios ?? [])
    .map((d) => {
      const partes: string[] = [];
      if (d.conquista) partes.push(`avanço: ${d.conquista}`);
      if (d.desafio) partes.push(`desafio: ${d.desafio}`);
      return partes.length ? `${d.data} — ${partes.join("; ")}` : "";
    })
    .filter(Boolean)
    .join("\n");

  const idade = idadeAnos((m.data_nascimento as string | null) ?? null);
  const nome = m.nome as string;
  const foco =
    destinatario === "escola"
      ? "Este relatório é para a ESCOLA. Foque no que ajuda no dia a dia escolar: como se comunica, sensorial, regulação, foco, o que ajuda em sala, pontos fortes e adaptações úteis. NÃO inclua detalhes íntimos da família."
      : "Este relatório é para o TERAPEUTA. Pode ser mais completo (comunicação, sensorial, regulação, alimentação, avanços e desafios ao longo do tempo), sempre no tom descritivo da família.";

  const bloco = `${foco}

Pessoa: ${nome}${idade != null ? `, ${idade} anos` : ""}.
Perfil informado pela família: ${(m.perfil as string) || "(não informado)"}

<kolo_vivo>
${dominios || "(pouca informação preenchida)"}
</kolo_vivo>

<registros_recentes>
${registros || "(sem registros recentes)"}
</registros_recentes>`;

  return { nome, bloco };
}

async function chamarRelatorio(
  supabase: SupabaseClient,
  familyId: string,
  userMsg: string,
): Promise<string> {
  const client = getAnthropicClient();
  const msg = await client.messages.create({
    model: MODELS.principal,
    max_tokens: 2200,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userMsg }],
  });
  await logarUsoApi(supabase, {
    family_account_id: familyId,
    provider: "anthropic",
    model: MODELS.principal,
    feature: "relatorio_escola",
    input_tokens: msg.usage.input_tokens,
    output_tokens: msg.usage.output_tokens,
  });
  return msg.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

export async function gerarRelatorio(params: {
  supabase: SupabaseClient;
  familyId: string;
  membroId: string;
  destinatario: Destinatario;
}): Promise<{ markdown: string; nome: string } | null> {
  const { supabase, familyId, membroId, destinatario } = params;
  const ctx = await montarContextoRelatorio(supabase, familyId, membroId, destinatario);
  if (!ctx) return null;
  const markdown = await chamarRelatorio(
    supabase,
    familyId,
    `${ctx.bloco}\n\nEscreva o relatório em markdown.`,
  );
  if (!markdown) return null;
  return { markdown, nome: ctx.nome };
}

/** Reescreve o relatório aplicando um ajuste pedido pela família (chat de IA). */
export async function ajustarRelatorio(params: {
  supabase: SupabaseClient;
  familyId: string;
  membroId: string;
  destinatario: Destinatario;
  markdownAtual: string;
  pedido: string;
}): Promise<{ markdown: string; nome: string } | null> {
  const { supabase, familyId, membroId, destinatario, markdownAtual, pedido } = params;
  const ctx = await montarContextoRelatorio(supabase, familyId, membroId, destinatario);
  if (!ctx) return null;
  const userMsg = `${ctx.bloco}

<relatorio_atual>
${markdownAtual}
</relatorio_atual>

A família pediu este AJUSTE: "${pedido.trim()}"

Reescreva o relatório APLICANDO o ajuste pedido, mantendo o tom descritivo (não-diagnóstico), a estrutura em seções e os fatos verdadeiros. Mude só o que o pedido pede. Devolva o relatório COMPLETO em markdown.`;
  const markdown = await chamarRelatorio(supabase, familyId, userMsg);
  if (!markdown) return null;
  return { markdown, nome: ctx.nome };
}
