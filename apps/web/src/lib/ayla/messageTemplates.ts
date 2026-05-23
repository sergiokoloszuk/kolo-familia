/**
 * Templates determinísticos da Ayla — PRD §12.8 e §12.12.
 *
 * Cada template tem 1-5 variações de redação; o scheduler escolhe
 * round-robin pra evitar repetição. Os textos vivem em
 * public.ayla_message_templates (editáveis pelo admin via /admin/mensagens)
 * com fallback hardcoded aqui pra segurança — se a query ao DB falhar
 * ou o template não existir, usamos o fallback e logamos um warning.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

type TemplateVars = Record<string, string | number | undefined>;

function fill(template: string, vars: TemplateVars): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k];
    return v == null ? "" : String(v);
  });
}

/**
 * Escolhe round-robin baseado em um seed (geralmente o id da família +
 * o dia, pra que a mesma família receba a mesma variação no mesmo dia mas
 * varie ao longo da semana).
 */
function pickVariation(variations: string[], seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return variations[Math.abs(hash) % variations.length];
}

// ============================================================
// Fallbacks — sempre coincidem com o seed inicial em 0010_ayla_message_templates.sql.
// Se o DB cair ou retornar vazio, caímos aqui pra Ayla não ficar muda.
// ============================================================

const FALLBACK: Record<string, string[]> = {
  boas_vindas: [
    "Oi, {nomeMae}. Sou a Ayla 🌿\n\nObrigada por confiar a gente com a história do/da {nomeMembro}. A partir de agora vou aparecer por aqui pra te perguntar como foi o dia — sem cobrança, só pra organizar junto.\n\nQuando quiser, é só me escrever. Digite AJUDA pra ver os comandos.",
    "{nomeMae}, oi! Aqui é a Ayla.\n\nCadastro concluído ✅. Daqui pra frente vou te mandar uma perguntinha por dia sobre o/a {nomeMembro} — uma conquista e um desafio bastam.\n\nVocê pode pausar (PAUSAR), mudar horário (MUDAR HORARIO 20:00) ou sair (SAIR) quando quiser.",
    "Oi, {nomeMae} 🌿\n\nSou a Ayla. A partir de hoje fico do seu lado pra organizar o dia a dia com o/a {nomeMembro}. Sem pressa, sem cobrança.\n\nResponde quando der. Se precisar de ajuda, digite AJUDA.",
  ],
  rotina: [
    "Oi, {nomeMae}.\nComo foi o dia do/da {nomeMembro}?\n\nMe conta só 2 coisas:\n1. uma conquista, mesmo pequena\n2. um desafio que apareceu hoje",
    "{nomeMae}, oi.\nE aí, como foi o dia hoje com {nomeMembro}?\n\nUma conquista + um desafio é suficiente.",
    "Oi! Como foi o dia do/da {nomeMembro} hoje?\n\nQuando puder responder: uma coisa boa e uma difícil.",
    "Oi, {nomeMae} 🌿\nComo está o dia? Conta uma coisa que deu certo e uma que foi difícil com {nomeMembro}.",
    "{nomeMae}, fim de dia. Como foi com {nomeMembro}?\n\nUma conquista + um desafio bastam — pode ser frase curta.",
  ],
  engajamento_2dias: [
    "Oi, {nomeMae}. Sumida há uns dias — está tudo bem aí?\n\nSe quiser me contar uma coisa do dia hoje, qualquer frase serve.",
    "{nomeMae}, faltou seu registro nesses dias. Tudo bem?\n\nUma frase curta sobre como vocês estão já ajuda.",
    "Oi! Não te ouvi nos últimos dias 🌿. Está tudo bem com {nomeMembro}?",
  ],
  engajamento_5dias: [
    "{nomeMae}, faz alguns dias que não nos falamos. Sem cobrança — quero só saber se estão bem.\n\nSe puder responder, mesmo que com 'tudo bem', já me conforta.",
    "Oi, {nomeMae}. Caí da rotina aqui sem você 😅. Me conta uma coisa do dia quando puder.",
  ],
  trial_d3: [
    "Oi, {nomeMae}. Te lembrando que seus 30 dias grátis terminam em 3 dias.\n\nSe quiser continuar, entra em /assinatura quando der.",
    "{nomeMae}, faltam 3 dias do seu trial. Sem pressão — só pra você não ser pega de surpresa.",
  ],
  trial_d0: [
    "Oi, {nomeMae}. Hoje é o último dia do seu trial 🌿\n\nSe quiser seguir, é só assinar em /assinatura. Cancela quando quiser.",
    "{nomeMae}, hoje termina seu trial. Tudo que você registrou continua aqui — pra continuar usando, é só assinar.",
  ],
  emocional_streak: [
    "{nomeMae}, você registrou 7 dias seguidos. Isso é cuidado de verdade — o/a {nomeMembro} está tendo um cuidado bem presente. 🌿",
    "Sete dias de papo seguidos, {nomeMae}. Você tá fazendo um trabalho enorme com {nomeMembro}.",
  ],
  clarificacao_membro: [
    "Sobre quem você está falando? {opcoes}?",
  ],
  clarificacao_conteudo: [
    "Não consegui entender direito o que aconteceu. Pode me contar de outro jeito? Uma frase curta serve.",
  ],
  comando_ajuda: [
    "Comandos disponíveis:\n• PAUSAR ou PAUSAR 7 — pausa minhas mensagens\n• MUDAR HORARIO 20:00 — atualiza o horário das perguntas diárias\n• SAIR — desativa as mensagens (mantém seus dados)\n• AJUDA — mostra esta lista",
  ],
  comando_pausada: [
    "Pausada por {dias_label}. Volto depois — pode escrever a qualquer hora se quiser falar antes.",
  ],
  comando_horario_mudado: [
    "Anotado, vou perguntar às {hora}.",
  ],
  comando_sair: [
    "Desativada. Seus dados continuam aqui, e quando quiser voltar é só me responder qualquer coisa.",
  ],
};

async function getVariations(
  supabase: SupabaseClient,
  key: string,
): Promise<string[]> {
  try {
    const { data } = await supabase
      .from("ayla_message_templates")
      .select("variations")
      .eq("key", key)
      .eq("ativo", true)
      .maybeSingle();
    const variations = (data?.variations as string[] | undefined) ?? [];
    if (variations.length > 0) return variations;
  } catch (e) {
    console.warn(`[ayla templates] DB error for '${key}', usando fallback:`, e);
  }
  const fb = FALLBACK[key];
  if (!fb || fb.length === 0) {
    throw new Error(`Template '${key}' não tem variações no DB nem fallback.`);
  }
  return fb;
}

// ============================================================
// Boas-vindas — primeira mensagem após onboarding concluído
// ============================================================

export async function templateBoasVindas(
  supabase: SupabaseClient,
  params: { nomeMae: string; nomeMembro: string; seed: string },
): Promise<string> {
  const variations = await getVariations(supabase, "boas_vindas");
  return fill(pickVariation(variations, params.seed), params);
}

// ============================================================
// Pergunta diária de rotina — PRD §12.4
// ============================================================

export async function templateRotinaDiaria(
  supabase: SupabaseClient,
  params: { nomeMae: string; nomeMembro: string; seed: string },
): Promise<string> {
  const variations = await getVariations(supabase, "rotina");
  return fill(pickVariation(variations, params.seed), params);
}

// ============================================================
// Engajamento por inatividade — PRD §12.4
// ============================================================

export async function templateEngajamento(
  supabase: SupabaseClient,
  params: {
    diasInativos: number;
    nomeMae: string;
    nomeMembro: string;
    seed: string;
  },
): Promise<string> {
  const key = params.diasInativos >= 5 ? "engajamento_5dias" : "engajamento_2dias";
  const variations = await getVariations(supabase, key);
  return fill(pickVariation(variations, params.seed), params);
}

// ============================================================
// Clarificação — quando parser tem confiança baixa (PRD §12.5, §12.7)
// ============================================================

export async function templateClarificacaoMembro(
  supabase: SupabaseClient,
  params: { membros: Array<{ nome: string }> },
): Promise<string> {
  const opcoes = params.membros.map((m) => m.nome).join(" ou ");
  const variations = await getVariations(supabase, "clarificacao_membro");
  return fill(pickVariation(variations, `clarificacao-${opcoes}`), { opcoes });
}

export async function templateClarificacaoConteudo(
  supabase: SupabaseClient,
): Promise<string> {
  const variations = await getVariations(supabase, "clarificacao_conteudo");
  return pickVariation(variations, "clarif-conteudo");
}

// ============================================================
// Resposta a registro — combina template + IA pra parte central
// PRD §12.5: "acolher → organizar → ação". Limite 60 palavras nas 3 frases.
// Mantida como composição pura (sem DB) — não há variações.
// ============================================================

export function templateRespostaRegistro(params: {
  acolhimento: string;
  organizacao: string;
  acao?: string;
}): string {
  const partes = [params.acolhimento, params.organizacao];
  if (params.acao) partes.push(params.acao);
  return partes.join("\n\n");
}

// ============================================================
// Comerciais — trial D-3, D-0 (PRD §12.5)
// ============================================================

export async function templateTrial(
  supabase: SupabaseClient,
  params: { diasRestantes: 3 | 0; nomeMae: string; seed: string },
): Promise<string> {
  const key = params.diasRestantes === 0 ? "trial_d0" : "trial_d3";
  const variations = await getVariations(supabase, key);
  return fill(pickVariation(variations, params.seed), params);
}

// ============================================================
// Emocional — streak 7 dias seguidos (PRD §12.5)
// ============================================================

export async function templateEmocionalStreak(
  supabase: SupabaseClient,
  params: { nomeMae: string; nomeMembro: string; seed: string },
): Promise<string> {
  const variations = await getVariations(supabase, "emocional_streak");
  return fill(pickVariation(variations, params.seed), params);
}

// ============================================================
// Insight — usa mensagem_proposta gerada pelo insightEngine.
// Não há variações: passamos a proposta como está.
// ============================================================

export function templateInsight(mensagemProposta: string): string {
  return mensagemProposta;
}

// ============================================================
// Comandos
// ============================================================

export async function templateComandoAjuda(supabase: SupabaseClient): Promise<string> {
  const variations = await getVariations(supabase, "comando_ajuda");
  return pickVariation(variations, "ajuda");
}

export async function templateComandoPausada(
  supabase: SupabaseClient,
  dias: number,
): Promise<string> {
  const variations = await getVariations(supabase, "comando_pausada");
  const dias_label = `${dias} dia${dias === 1 ? "" : "s"}`;
  return fill(pickVariation(variations, `pausada-${dias}`), { dias_label });
}

export async function templateComandoHorarioMudado(
  supabase: SupabaseClient,
  hora: string,
): Promise<string> {
  const variations = await getVariations(supabase, "comando_horario_mudado");
  return fill(pickVariation(variations, `horario-${hora}`), { hora });
}

export async function templateComandoSair(supabase: SupabaseClient): Promise<string> {
  const variations = await getVariations(supabase, "comando_sair");
  return pickVariation(variations, "sair");
}
