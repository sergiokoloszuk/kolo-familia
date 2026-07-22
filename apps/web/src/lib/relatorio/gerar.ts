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

const MESES_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** 'YYYY-MM-01' → 'mês de YYYY' (pt-BR), sem depender de Date/timezone. */
function mesLabel(periodo: string): string {
  const [y, m] = periodo.split("-").map(Number);
  const nome = MESES_PT[(m ?? 1) - 1] ?? "";
  return `${nome} de ${y}`;
}

/**
 * Monta o bloco longitudinal (a "máquina do tempo") a partir das fotos mensais
 * — uma linha por mês, da mais antiga à mais recente. Vazio se não houver fotos
 * o bastante pra narrar um arco.
 */
function blocoEvolucaoMensal(
  snaps: Array<{ periodo: string; resumo: string | null; sinais: Record<string, unknown> | null }>,
): string {
  if (snaps.length < 2) return "";
  const linhas = snaps
    .map((s) => {
      const sinais = s.sinais ?? {};
      const humor = typeof sinais.humor_label === "string" ? sinais.humor_label : null;
      const resumo = s.resumo?.trim();
      if (!resumo && !humor) return "";
      const partes = [resumo || "(sem resumo)"];
      if (humor) partes.push(`humor predominante: ${humor}`);
      return `${mesLabel(s.periodo)}: ${partes.join(" — ")}`;
    })
    .filter(Boolean);
  return linhas.length >= 2 ? linhas.join("\n") : "";
}

const SYSTEM = `Você escreve um GUIA da criança/pessoa para a família entregar à ESCOLA ou ao TERAPEUTA, em português do Brasil. NÃO é laudo nem relatório clínico — é um guia ACOLHEDOR e PRÁTICO pra o profissional conhecer a criança e saber, no dia a dia, o que fazer. O espírito é "Conhecendo a [nome] — como ajudá-la a aprender e se sentir bem".

PRINCÍPIOS:
- ESCANEÁVEL: bullets curtos, não prosa longa. O professor lê em 1 minuto e já sai sabendo agir.
- Comece pelo que AJUDA, não por "quem é" — o profissional ganha logo na primeira olhada.
- DESCRITIVO e factual a partir do que a FAMÍLIA observa ("a família relata…", "em casa costuma…", "foi observado…"). NUNCA diagnostique nem use rótulo clínico como conclusão.
- SEPARE FATO de HIPÓTESE. Nas seções factuais, só o que se SABE. Suposição vai SÓ na seção "Pontos a investigar" — NUNCA misture ("o dia exigiu muito dela" é hipótese, não fato).
- NÃO invente NADA — use só o que foi dado. Tema com pouca informação: melhor curto do que inventado.

ESTRUTURA (use "## ", PULE seção sem informação, NESTA ORDEM):
## Quem é a [nome] — 3 linhas: idade, um traço marcante, e o espírito ("este guia reúne o que ajuda a [nome] a aprender e se sentir bem").
## Como a [nome] aprende melhor — bullets (previsibilidade, apoio visual, passos curtos, mediação do adulto…).
## O que costuma ser difícil — bullets (o que pesa, e quando).
## O que ajuda — bullets práticos e acionáveis.
## O que evitar — bullets (ex.: corrigir na frente da turma; insistir quando já está sobrecarregada; instruções longas; mudanças sem aviso; falar várias coisas ao mesmo tempo). Seção de OURO — capriche a partir do que se sabe.
## Sinais de sobrecarga — bullets do que aparece ANTES de escalar (cobre os ouvidos, se fecha, fica irritada…), pra o profissional agir cedo.
## Como se comunica — bullets.
## Perfil sensorial — bullets por canal (som, toque, luz, texturas), cada um com a estratégia que ajuda.
## Interesses e pontos fortes — bullets (portas de entrada pro engajamento).
## Linha do tempo — SÓ se houver <evolucao_mensal> ou eventos datados: marcos em ordem (mês: o que mudou — regressões, troca de professora, avanços). Sem inventar; se estável, diga que se manteve.
## Pontos a investigar — HIPÓTESES e o que ainda falta entender (ex.: "como ela pede ajuda", "como reage a correções", "como entende instruções longas"). Deixe claro que são pontos a confirmar, não conclusões — convida a família a completar.

Devolva APENAS o guia em markdown, sem comentários.`;

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

  // Fotos mensais (máquina do tempo) — últimos ~18 meses, da mais antiga à
  // mais recente, pra o relatório narrar o arco. Só entra se houver ≥2 meses.
  const { data: snapsRaw } = await supabase
    .from("evolucao_snapshots")
    .select("periodo, resumo, sinais")
    .eq("membro_atipico_id", membroId)
    .eq("periodo_tipo", "mensal")
    .order("periodo", { ascending: false })
    .limit(18);
  const snaps = (snapsRaw ?? [])
    .map((s) => ({
      periodo: s.periodo as string,
      resumo: (s.resumo as string | null) ?? null,
      sinais: (s.sinais as Record<string, unknown> | null) ?? null,
    }))
    .reverse(); // mais antiga → mais recente
  const evolucaoMensal = blocoEvolucaoMensal(snaps);

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
</registros_recentes>${
    evolucaoMensal
      ? `

<evolucao_mensal>
${evolucaoMensal}
</evolucao_mensal>`
      : ""
  }`;

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
