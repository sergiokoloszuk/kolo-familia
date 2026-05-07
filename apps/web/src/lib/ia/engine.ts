import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnthropicClient, MODELS } from "./anthropic";
import { loadActiveSkills, routeSkills, type RoutedSkill } from "./router";
import { buildContext } from "./context";
import { assemblePrompt } from "./prompt";
import { runAllValidators } from "./validators";

export type EngineResponse = {
  texto: string;
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
 * Fluxo:
 *   input + contexto da família
 *     → router decide skill(s) por keywords + priority
 *     → context builder traz Kolo Vivo, Diário, Boas Práticas, histórico
 *     → prompt assembler monta system (cacheável) + messages
 *     → Claude Sonnet com adaptive thinking, streaming
 *     → validators (anti-cópia, anti-substituição-profissional, etc.)
 *     → se falha: regenera 1× com prompt ajustado; se persiste, retorna
 *       resposta marcada com aviso
 */
export async function respond(params: {
  supabase: SupabaseClient;
  familyId: string;
  membroAtipicoId: string | null;
  conversaId: string | null;
  userInput: string;
}): Promise<EngineResponse> {
  const { supabase, familyId, membroAtipicoId, conversaId, userInput } = params;

  // 1. Roteamento
  const skills = await loadActiveSkills(supabase);
  if (skills.length === 0) {
    throw new Error(
      "Nenhuma skill ativa cadastrada. Aplique a migração 0003_seed.sql no Supabase.",
    );
  }
  const roteadas = routeSkills(userInput, skills);

  // 2. Contexto
  const ctx = await buildContext(supabase, {
    familyId,
    membroAtipicoId,
    skills: roteadas.map((r) => r.skill),
    conversaId,
  });

  // 3. Primeira tentativa
  let resposta = await callClaude(roteadas, ctx, userInput);

  // 4. Validação
  let validacao = runAllValidators(resposta.texto, ctx.boasPraticas);
  let regenerou = false;

  if (!validacao.ok) {
    regenerou = true;
    resposta = await callClaude(roteadas, ctx, userInput, {
      regeneracao: { motivo: validacao.motivo, sugestao: validacao.sugestao },
    });
    validacao = runAllValidators(resposta.texto, ctx.boasPraticas);
  }

  return {
    texto: resposta.texto,
    skillsAcionadas: roteadas.map((r) => ({
      name: r.skill.name,
      display_name: r.skill.display_name,
      score: r.score,
    })),
    validacao: validacao.ok ? { ok: true } : { ok: false, motivo: validacao.motivo, regenerou },
    uso: resposta.uso,
  };
}

async function callClaude(
  roteadas: RoutedSkill[],
  ctx: Awaited<ReturnType<typeof buildContext>>,
  userInput: string,
  options: {
    regeneracao?: { motivo: string; sugestao?: string };
  } = {},
): Promise<{ texto: string; uso: EngineResponse["uso"] }> {
  const client = getAnthropicClient();

  const inputComRegeneracao = options.regeneracao
    ? `${userInput}\n\n<sistema>A resposta anterior falhou na validação: ${options.regeneracao.motivo}. ${options.regeneracao.sugestao ?? ""} Refaça respeitando as 7 partes e os limites.</sistema>`
    : userInput;

  const { system, messages } = assemblePrompt({
    skills: roteadas.map((r) => r.skill),
    ctx,
    userInput: inputComRegeneracao,
  });

  const stream = client.messages.stream({
    model: MODELS.principal,
    max_tokens: 2048,
    thinking: { type: "adaptive" },
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
