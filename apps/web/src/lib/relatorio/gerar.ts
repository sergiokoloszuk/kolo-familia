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

// Reconciliação (o perfil ao vivo NÃO reescreve conflito, de propósito — é a mãe
// que revisa; o relatório é o lugar seguro de limpar, sem mutar dado) + nome atual.
const RECONCILIA_E_NOME = `- RECONCILIE contradições: se as fontes se contradizem sobre a MESMA coisa (ex.: "não verbaliza nada" e "está mais falante"), o estado ATUAL é o MAIS RECENTE — NÃO liste as duas como verdades de hoje. Use as datas de <eventos_linha_do_tempo>/<evolucao_mensal> pra saber o que é mais novo e enquadre como EVOLUÇÃO ("após um período sem verbalizar, a família observa que voltou a falar mais e já conta sobre a escola"). O passado datado fica na Linha do tempo, não no retrato de agora.
- NOME: use sempre o nome ATUAL da criança. Se algum registro antigo citar OUTRO nome pra a mesma criança (houve troca de nome ao longo do tempo), é a MESMA pessoa — use só o nome atual, nunca o antigo.`;

const SYSTEM_ESCOLA = `Você escreve um GUIA DE BOAS-VINDAS da criança/pessoa, para a família entregar à ESCOLA, em português do Brasil. NÃO é laudo nem relatório de problema — é um guia ACOLHEDOR e PRÁTICO pra o professor CONHECER e AJUDAR. Espírito: "Conhecendo a [nome] — como ajudá-la a aprender, participar e se sentir segura", construído em PARCERIA (família + Kolo).

PRINCÍPIOS:
- ESCANEÁVEL: bullets curtos; o professor lê o essencial em minutos e já sabe agir.
- ENXUTO no que importa: info CRÍTICAS pra a rotina escolar vêm claras e primeiro. Detalhes FINOS (comidas específicas, cheiros, preferências miúdas) NÃO viram prioridade nem enchem o topo — reúna-os curtos em "## Outros detalhes úteis" no fim, só se houver.
- FATO × HIPÓTESE (sagrado): nas seções factuais, só o que se SABE, com voz de família ("a família relata / observa que…", "até o momento…"). NUNCA apresente interpretação como fato. Se é um padrão de casa ainda não confirmado na escola, escreva o FATO ("a família percebeu esse padrão após a troca de professora") e leve a interpretação/verificação pra a seção "O que gostaríamos de entender melhor". NUNCA diagnostique nem use rótulo clínico como conclusão.
- EVITE absolutos: "flui melhor com adultos" → "até o momento, a família observa que costuma interagir com mais facilidade com adultos do que com crianças da mesma idade".
- NÃO invente NADA — use só o que foi dado.
${RECONCILIA_E_NOME}

ESTRUTURA (use "## ", PULE seção sem informação, NESTA ORDEM):
## Quem é a [nome] — 3 linhas calorosas (idade, um traço marcante, o espírito do guia).
## Prioridades deste semestre — 4-5 bullets inferidos do perfil (ex.: ampliar formas de comunicação; favorecer participação com colegas; reduzir o esforço na rotina; aumentar autonomia; preservar o interesse pelas atividades).
## Como a [nome] aprende melhor — bullets.
## O que ajuda — bullets acionáveis.
## O que evitar — bullets (seção de OURO: corrigir na frente da turma; insistir quando já sobrecarregada; instruções longas; mudanças sem aviso; falar várias coisas ao mesmo tempo…).
## Sinais de sobrecarga — bullets do que aparece ANTES de escalar + o que fazer quando aparecem (reduzir estímulos, baixar a exigência, presença calma).
## Como perceber que uma estratégia funcionou — bullets práticos (permanece mais na atividade; inicia com menos ajuda; aceita melhor as transições; comunica com menos frustração; chega menos cansada).
## Situações que podem exigir mais apoio — bullets (o que pesa e quando), SEM tom de déficit.
## O que faz a [nome] sorrir — bullets do que a deixa bem e engajada (acolhimento, previsibilidade, observar antes de entrar, reconhecimento das pequenas conquistas). Humaniza — a professora enxerga a criança, não o diagnóstico.
## Como se comunica — bullets.
## Perfil sensorial — por canal (som, toque, luz, textura), cada um com a estratégia. Conciso.
## Interesses e pontos fortes — bullets (portas de entrada pro engajamento).
## Linha do tempo — SÓ se houver <evolucao_mensal> ou <eventos_linha_do_tempo>: marcos em ordem, como FATO ("em junho a família observou…"), sem cravar causa.
## Outros detalhes úteis — curtos: preferências finas (comidas, cheiros, texturas específicas). Só se houver; não é prioridade.
## O que gostaríamos de entender melhor — checklist, cada item começando com "☐ " (ex.: ☐ em quais momentos demonstra mais cansaço; ☐ como participa das atividades coletivas; ☐ se pede ajuda quando não entende; ☐ como reage às mudanças de rotina na escola; ☐ quais estratégias já funcionaram). São pontos pra escola OBSERVAR e construir junto — não conclusões.
## Como escola e família podem se comunicar — parceria: seria útil a escola avisar quando observar (mudanças importantes de comportamento, novas habilidades, situações de sobrecarga, estratégias que funcionaram, mudanças na comunicação); a família compartilhará mudanças relevantes de rotina, saúde ou desenvolvimento.

Termine com UMA frase: "Este guia continua sendo construído — vai sendo atualizado conforme a família e a escola registram novas informações." (a data a tela põe; não invente número de versão.)

Devolva APENAS o guia em markdown, sem comentários.`;

const SYSTEM_TERAPEUTA = `Você escreve um RESUMO pra um PROFISSIONAL DE SAÚDE (médico, neuropediatra ou terapeuta — fono, TO, psicólogo) da criança/pessoa, a partir dos registros da FAMÍLIA, em português do Brasil. O objetivo é a família chegar à consulta/sessão com uma história ORGANIZADA e CRONOLÓGICA, pra o tempo do profissional render mais. NÃO é laudo, NÃO diagnostica, NÃO substitui avaliação — é a família compartilhando o que observa.

PRINCÍPIOS:
- Técnico e OBJETIVO, mas sempre como OBSERVAÇÃO DA FAMÍLIA ("a família relata / observa…"). NUNCA afirme causa nem diagnóstico.
- Bullets curtos, escaneável — o profissional entende em 2 minutos.
- FATO × HIPÓTESE separados: fatos nas seções; suposições SÓ em "Questões que merecem investigação".
- NÃO invente NADA; seção sem dado, PULE (ou escreva "sem dados suficientes").
${RECONCILIA_E_NOME}

ESTRUTURA (use "## ", PULE seção vazia, NESTA ORDEM):
## Motivo deste resumo — 2 linhas (organizar a história pra a consulta/sessão).
## Diagnósticos informados pela família — só os que a família registrou. Se nenhum, pule.
## Principais preocupações atuais da família — bullets (o que mais pesa agora).
## Linha do tempo — SÓ se houver <evolucao_mensal> ou <eventos_linha_do_tempo>: por mês, o que a família observou (regressões, marcos, mudanças de contexto). Como FATO, sem cravar causa.
## Comunicação — situação atual (bullets) + evolução (o que já apareceu, o que mudou).
## Perfil sensorial — por canal (audição, toque, visual, movimento/vestibular, olfato…), só os com dado.
## Regulação emocional — gatilhos observados + sinais (bullets).
## Participação social — bullets.
## Sono · Alimentação · Autonomia — bullets, cada um só se houver dado.
## Saúde — medicamentos, exames, intercorrências — SÓ se a família registrou.
## Terapias atuais — fono, TO, psicologia… — só se houver.
## Evolução observada — o que a família SENTE que melhorou, se manteve ou piorou nos últimos meses (bullets; pode usar ↑ ↔ ↓). Leitura da família, não medida clínica.
## Questões que merecem investigação — HIPÓTESES/pontos a investigar (ex.: origem do aumento do cansaço; a regressão da fala; relação entre mudanças escolares e regulação). PERCEBE, não afirma.
## Perguntas que a família gostaria de discutir — bullets de perguntas reais pra a consulta (ex.: essa regressão é esperada? vale investigar a audição? faz sentido revisar os objetivos terapêuticos?).

Termine com UMA frase: "Este resumo reúne observações da família pra apoiar a consulta — não substitui avaliação profissional."

Devolva APENAS o resumo em markdown, sem comentários.`;

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

  // Linha do tempo de EVENTOS importantes (Livro Vivo): troca de professora,
  // mudança de escola/rotina, medicação, início de terapia, perda, marco…
  const { data: eventosRaw } = await supabase
    .from("eventos_membro")
    .select("data, tipo, descricao, fonte")
    .eq("membro_atipico_id", membroId)
    .order("data", { ascending: true })
    .limit(40);
  const eventos = (eventosRaw ?? [])
    .map((e) => `${e.data} — ${e.descricao}${e.fonte && e.fonte !== "familia" ? ` (${e.fonte})` : ""}`)
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
</registros_recentes>${
    evolucaoMensal
      ? `

<evolucao_mensal>
${evolucaoMensal}
</evolucao_mensal>`
      : ""
  }${
    eventos
      ? `

<eventos_linha_do_tempo>
${eventos}
</eventos_linha_do_tempo>`
      : ""
  }`;

  return { nome, bloco };
}

async function chamarRelatorio(
  supabase: SupabaseClient,
  familyId: string,
  userMsg: string,
  destinatario: Destinatario,
): Promise<string> {
  // Escola = GUIA de boas-vindas (prático). Terapeuta/médico = RESUMO clínico
  // (história do desenvolvimento). Mesma base, documentos bem diferentes.
  const system = destinatario === "terapeuta" ? SYSTEM_TERAPEUTA : SYSTEM_ESCOLA;
  const client = getAnthropicClient();
  const msg = await client.messages.create({
    model: MODELS.principal,
    max_tokens: 2200,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userMsg }],
  });
  await logarUsoApi(supabase, {
    family_account_id: familyId,
    provider: "anthropic",
    model: MODELS.principal,
    feature: destinatario === "terapeuta" ? "resumo_terapeuta" : "guia_escola",
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
    `${ctx.bloco}\n\nEscreva o documento em markdown.`,
    destinatario,
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

Reescreva o documento APLICANDO o ajuste pedido, mantendo o tom descritivo (não-diagnóstico), a estrutura em seções e os fatos verdadeiros. Mude só o que o pedido pede. Devolva o documento COMPLETO em markdown.`;
  const markdown = await chamarRelatorio(supabase, familyId, userMsg, destinatario);
  if (!markdown) return null;
  return { markdown, nome: ctx.nome };
}
