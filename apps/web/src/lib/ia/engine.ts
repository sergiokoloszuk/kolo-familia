import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnthropicClient, MODELS } from "./anthropic";
import { loadActiveSkills, routeSkillsAI, type RoutedSkill } from "./router";
import { buildContext } from "./context";
import { assemblePrompt, type Modo, type OutputTypeData } from "./prompt";
import { classificarIntencao, type Intencao } from "./intencao";
// BIA — conhecimento de apoio. MESMO serviço que o WhatsApp usa.
// Desligado por padrão (flag BIA_PROMPT_ENABLED): devolve "" e nada muda.
import { carregarBlocoBia } from "@/lib/bia/contexto-ayla";
import {
  runTomValidators,
  runEstruturalValidators,
  validateAntiSubstituicaoProfissional,
  validateAntiComparacao,
  validateAntiAlarme,
  validateAntiCopy,
  type ValidationResult,
} from "./validators";
import { validateWithAI } from "./validator-ai";

export type EngineResponse = {
  texto: string;
  intencao: Intencao;
  skillsAcionadas: Array<{ name: string; display_name: string; score: number }>;
  validacao: { ok: true } | { ok: false; motivo: string; regenerou: boolean };
  uso: {
    tokens_input?: number;
    tokens_output?: number;
    cache_read_tokens?: number;
    cache_write_tokens?: number;
  };
};

/**
 * SpecialistPromptEngine — peça central do produto (PRD §7.4).
 *
 * Modo conversa:
 *   input + contexto da família
 *     → router decide skill(s) por keywords + priority
 *     → context builder traz Kolo Vivo, Diário, Boas Práticas, histórico
 *     → prompt assembler monta system (cacheável) + messages
 *     → Claude Sonnet com adaptive thinking, streaming
 *     → validators (anti-cópia, anti-substituição-profissional, etc.)
 *     → se falha: regenera 1× com prompt ajustado.
 */
export async function respond(params: {
  supabase: SupabaseClient;
  familyId: string;
  membroAtipicoId: string | null;
  conversaId: string | null;
  userInput: string;
}): Promise<EngineResponse> {
  const { supabase, familyId, membroAtipicoId, conversaId, userInput } = params;

  const skills = await loadActiveSkills(supabase);
  if (skills.length === 0) {
    throw new Error(
      "Nenhuma skill ativa cadastrada. Aplique a migração 0003_seed.sql no Supabase.",
    );
  }
  const [roteadas, intencao] = await Promise.all([
    routeSkillsAI(userInput, skills),
    classificarIntencao({ supabase, familyId, texto: userInput }),
  ]);

  const ctx = await buildContext(supabase, {
    familyId,
    membroAtipicoId,
    skills: roteadas.map((r) => r.skill),
    conversaId,
    userInput,
  });

  // BIA — conhecimento de apoio, MESMO serviço do WhatsApp. Só no caminho de
  // CONVERSA: `respondAsOutputType` (os botões, que alimentam as seções do
  // plano) fica de fora de propósito, para os planos não mudarem.
  const bia = await carregarBlocoBia({
    supabase,
    canal: "web",
    familyId,
    contexto: {
      idadeAnos: ctx.membroFoco?.idade ?? null,
      perfil: ctx.membroFoco?.perfil ?? null,
      textoDaConversa: userInput,
    },
    textosBoasPraticas: ctx.boasPraticas.map(
      (bp) => `${bp.titulo} ${bp.versao_curta} ${bp.versao_conversa ?? ""}`,
    ),
  });

  let resposta = await callClaude(
    roteadas,
    ctx,
    userInput,
    { kind: "conversa" },
    { intencao, bia },
  );

  let validacao = await runFullValidation(resposta.texto, ctx);
  let regenerou = false;

  if (!validacao.ok) {
    regenerou = true;
    resposta = await callClaude(
      roteadas,
      ctx,
      userInput,
      { kind: "conversa" },
      { intencao, regeneracao: { motivo: validacao.motivo, sugestao: validacao.sugestao } },
    );
    validacao = await runFullValidation(resposta.texto, ctx);
  }

  return {
    texto: resposta.texto,
    intencao,
    skillsAcionadas: roteadas.map((r) => ({
      name: r.skill.name,
      display_name: r.skill.display_name,
      score: r.score,
    })),
    validacao: validacao.ok ? { ok: true } : { ok: false, motivo: validacao.motivo, regenerou },
    uso: resposta.uso,
  };
}

/**
 * Modo conversa em STREAMING — prepara routing/contexto/prompt para a
 * resposta ser transmitida token a token (o route handler abre o stream
 * Anthropic e persiste no fim). Não regenera (não dá pra "des-streamar").
 */
export async function prepararRespostaStream(params: {
  supabase: SupabaseClient;
  familyId: string;
  membroAtipicoId: string | null;
  conversaId: string;
  userInput: string;
}) {
  const { supabase, familyId, membroAtipicoId, conversaId, userInput } = params;

  const skills = await loadActiveSkills(supabase);
  if (skills.length === 0) {
    throw new Error("Nenhuma skill ativa cadastrada.");
  }
  const [roteadas, intencao] = await Promise.all([
    routeSkillsAI(userInput, skills),
    classificarIntencao({ supabase, familyId, texto: userInput }),
  ]);

  const ctx = await buildContext(supabase, {
    familyId,
    membroAtipicoId,
    skills: roteadas.map((r) => r.skill),
    conversaId,
    userInput,
  });

  // O histórico já inclui a última mensagem do usuário (= userInput);
  // remover pra não duplicar no prompt.
  if (ctx.historico.length > 0) {
    const ultima = ctx.historico[ctx.historico.length - 1];
    if (ultima.papel === "user" && ultima.conteudo === userInput) {
      ctx.historico = ctx.historico.slice(0, -1);
    }
  }

  // BIA — mesmo serviço do WhatsApp, só no caminho de conversa.
  const bia = await carregarBlocoBia({
    supabase,
    canal: "web",
    familyId,
    contexto: {
      idadeAnos: ctx.membroFoco?.idade ?? null,
      perfil: ctx.membroFoco?.perfil ?? null,
      textoDaConversa: userInput,
    },
    textosBoasPraticas: ctx.boasPraticas.map(
      (bp) => `${bp.titulo} ${bp.versao_curta} ${bp.versao_conversa ?? ""}`,
    ),
  });

  const { system, messages } = assemblePrompt({
    skills: roteadas.map((r) => r.skill),
    ctx,
    userInput,
    modo: { kind: "conversa" },
    intencao,
    bia,
  });

  return { system, messages, roteadas, intencao };
}

/**
 * Modo OUTPUT_TYPE — atalhos dos 7 botões de apoio (PRD §7.12).
 *
 * Diferente de respond():
 *   - Roteia pra no máximo 1 skill (a mais relevante)
 *   - Não usa template de 7 partes — segue output_type.prompt_template
 *   - Não usa histórico (cada pedido é independente)
 *   - Validadores: aplica todos exceto o de tamanho (output types variam)
 */
export async function respondAsOutputType(params: {
  supabase: SupabaseClient;
  familyId: string;
  membroAtipicoId: string | null;
  outputType: OutputTypeData;
  pedido: string;
}): Promise<EngineResponse> {
  const { supabase, familyId, membroAtipicoId, outputType, pedido } = params;

  const skills = await loadActiveSkills(supabase);
  if (skills.length === 0) {
    throw new Error(
      "Nenhuma skill ativa cadastrada. Aplique a migração 0003_seed.sql no Supabase.",
    );
  }
  // Aciona só a skill mais relevante (output_type já dita o formato)
  const roteadas = await routeSkillsAI(pedido, skills, { maxSkills: 1 });

  const ctx = await buildContext(supabase, {
    familyId,
    membroAtipicoId,
    skills: roteadas.map((r) => r.skill),
    conversaId: null,
    userInput: pedido,
  });

  const modo: Modo = { kind: "output_type", outputType };

  const resposta = await callClaude(roteadas, ctx, pedido, modo);

  // Validadores: rodar tudo exceto tamanho (output types têm tamanho próprio)
  const validacao = runAllValidatorsExceptSize(resposta.texto, ctx.boasPraticas);

  return {
    texto: resposta.texto,
    intencao: "desafio",
    skillsAcionadas: roteadas.map((r) => ({
      name: r.skill.name,
      display_name: r.skill.display_name,
      score: r.score,
    })),
    validacao: validacao.ok
      ? { ok: true }
      : { ok: false, motivo: validacao.motivo, regenerou: false },
    uso: resposta.uso,
  };
}

/**
 * Pipeline completo de validação — Adendo PRD §4.
 *
 *   1. Tom (Grupo C, regex)        → falha = regenera
 *   2. Estrutural (tamanho + cópia) → falha = regenera
 *   3. IA Validator (Grupos A + B)  → 2+ falhas = regenera, 1 falha tolera
 *
 * Custo: o IA Validator adiciona +15-18% por mensagem. Vale pra zerar
 * vazamentos de tom/personalização que regex não captura.
 */
async function runFullValidation(
  resposta: string,
  ctx: Awaited<ReturnType<typeof buildContext>>,
): Promise<ValidationResult> {
  const nomeCrianca = ctx.membroFoco?.nome ?? null;

  // 1. Tom (eliminatório)
  const tom = await runTomValidators(resposta, { nomeCrianca });
  if (!tom.ok) return tom;

  // 2. Estrutural
  const estrutural = runEstruturalValidators(resposta, ctx.boasPraticas);
  if (!estrutural.ok) return estrutural;

  // 3. IA Validator (semântico)
  return validateWithAI(resposta, {
    nome_crianca: nomeCrianca,
    idade: ctx.membroFoco?.idade ?? null,
    perfil: ctx.membroFoco?.perfil ?? null,
    interesses: ctx.membroFoco?.secoes?.como_e ?? null,
    desafios: ctx.membroFoco?.secoes?.desafios_regulacao ?? null,
  });
}

function runAllValidatorsExceptSize(
  texto: string,
  bps: { versao_curta: string; versao_conversa: string | null }[],
): ValidationResult {
  for (const check of [
    () => validateAntiSubstituicaoProfissional(texto),
    () => validateAntiComparacao(texto),
    () => validateAntiAlarme(texto),
    () => validateAntiCopy(texto, bps),
  ]) {
    const r = check();
    if (!r.ok) return r;
  }
  return { ok: true };
}

async function callClaude(
  roteadas: RoutedSkill[],
  ctx: Awaited<ReturnType<typeof buildContext>>,
  userInput: string,
  modo: Modo,
  options: {
    intencao?: Intencao;
    regeneracao?: { motivo: string; sugestao?: string };
    /** Bloco da BIA (conhecimento de apoio). Vazio quando a flag está off. */
    bia?: string;
  } = {},
): Promise<{ texto: string; uso: EngineResponse["uso"] }> {
  const client = getAnthropicClient();

  const inputComRegeneracao = options.regeneracao
    ? `${userInput}\n\n<sistema>A resposta anterior falhou na validação: ${options.regeneracao.motivo}. ${options.regeneracao.sugestao ?? ""} Refaça respeitando o formato e os limites.</sistema>`
    : userInput;

  const { system, messages } = assemblePrompt({
    skills: roteadas.map((r) => r.skill),
    ctx,
    userInput: inputComRegeneracao,
    modo,
    intencao: options.intencao,
    bia: options.bia,
  });

  const stream = client.messages.stream({
    model: MODELS.principal,
    max_tokens: 2048,
    // Budget fixo em vez de "adaptive": o adaptive disparava picos de até
    // ~10s de thinking. Limitado, o custo fica previsível mantendo algum
    // raciocínio (estes caminhos não fazem streaming, então o tempo total
    // é o que a pessoa espera).
    thinking: { type: "enabled", budget_tokens: 1024 },
    system,
    messages,
  });

  const finalMessage = await stream.finalMessage();

  const texto = finalMessage.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("");

  return {
    texto: texto.trim(),
    uso: {
      tokens_input: finalMessage.usage.input_tokens,
      tokens_output: finalMessage.usage.output_tokens,
      cache_read_tokens: finalMessage.usage.cache_read_input_tokens ?? undefined,
      cache_write_tokens: finalMessage.usage.cache_creation_input_tokens ?? undefined,
    },
  };
}
