import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnthropicClient, MODELS } from "./anthropic";
import { loadActiveSkills, routeSkillsAI, type RoutedSkill } from "./router";
import { buildContext } from "./context";
import { fronteiraAtravessada } from "@/lib/conducao/fronteiras";
import { logEvent } from "@/lib/log";
import { assemblePrompt, type Modo, type OutputTypeData } from "./prompt";
import { classificarIntencao, type Intencao } from "./intencao";
import {
  runTomValidators,
  runEstruturalValidators,
  validateAntiSubstituicaoProfissional,
  validateAntiDiagnostico,
  validateAntiClinico,
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
 * ⚠️ `respond()` FOI REMOVIDA EM 06/08/2026 — era arquitetura paralela morta.
 *
 * Ela existia desde antes do streaming e carregava o pipeline completo de
 * validação (tom, estrutural, validador por IA, regeneração, piso). Só que
 * NENHUM `.tsx` a chamava: o único caller era `enviarMensagem`, que também não
 * era chamada por ninguém desde que a conversa migrou pro streaming.
 *
 * O efeito prático era o pior possível — a leitura do código dizia que a web
 * tinha rede de segurança, e a conversa real não tinha nenhuma. Consertar as
 * duas teria mantido dois motores divergindo; a rede de fronteiras foi pro
 * caminho VIVO (`/api/conversar/stream`), e este aqui saiu junto com o
 * `runFullValidation` que só ela usava.
 *
 * `respondAsOutputType` (os 7 botões de apoio) continua e é usada de verdade.
 */

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
  // O CLASSIFICADOR PRECISA DA CONVERSA. Até 06/08/2026 ele era chamado só com
  // o texto do turno — `classificarIntencao({supabase, familyId, texto})` e mais
  // nada. O parâmetro `historico` existia e nenhum caller o preenchia, então no
  // meio de uma conversa "Sim." chegava nele como se fosse a primeira mensagem,
  // o referente sumia e a Kolo respondia outra coisa.
  //
  // O histórico é carregado EM PARALELO com o roteamento, e a classificação em
  // paralelo com o contexto: a correção não custa uma ida a mais no relógio.
  const [roteadas, anterior] = await Promise.all([
    routeSkillsAI(userInput, skills),
    carregarTurnosAnteriores(supabase, conversaId, userInput),
  ]);

  const [ctx, turno] = await Promise.all([
    buildContext(supabase, {
      familyId,
      membroAtipicoId,
      skills: roteadas.map((r) => r.skill),
      conversaId,
    }),
    classificarIntencao({
      supabase,
      familyId,
      texto: userInput,
      historico: anterior.historico,
      temaAnterior: anterior.tema,
    }),
  ]);

  // O histórico já inclui a última mensagem do usuário (= userInput);
  // remover pra não duplicar no prompt.
  if (ctx.historico.length > 0) {
    const ultima = ctx.historico[ctx.historico.length - 1];
    if (ultima.papel === "user" && ultima.conteudo === userInput) {
      ctx.historico = ctx.historico.slice(0, -1);
    }
  }

  const { system, messages } = assemblePrompt({
    skills: roteadas.map((r) => r.skill),
    ctx,
    userInput,
    modo: { kind: "conversa" },
    intencao: turno.intencao,
    tema: turno.tema,
    aceite: turno.aceite,
  });

  return { system, messages, roteadas, intencao: turno.intencao, tema: turno.tema, ctx };
}

/**
 * Os turnos anteriores desta conversa, e o TEMA em que ela estava.
 *
 * O tema vive em `mensagens_skill.metadata` — a mesma coluna jsonb que já
 * guardava a intenção. Sem tabela nova, sem coluna nova, sem migração: era essa
 * a alternativa a fazer a Kolo reconstruir o assunto da conversa inteira a
 * partir da última frase, a cada turno.
 *
 * 12 mensagens (≈6 turnos) — a mesma janela que o WhatsApp usa. A web enxergava
 * 6 mensagens, metade do outro canal, e a mãe não sabe que existem dois canais.
 */
async function carregarTurnosAnteriores(
  supabase: SupabaseClient,
  conversaId: string | null,
  userInput: string,
): Promise<{
  historico: Array<{ papel: "user" | "assistant"; conteudo: string }>;
  tema: string | null;
}> {
  if (!conversaId) return { historico: [], tema: null };
  const { data } = await supabase
    .from("mensagens_skill")
    .select("papel, conteudo, metadata, created_at")
    .eq("conversa_id", conversaId)
    .order("created_at", { ascending: false })
    .limit(12);

  const linhas = (data ?? []) as Array<{
    papel: string;
    conteudo: string;
    metadata: { tema?: string | null } | null;
  }>;
  const tema =
    linhas.find((l) => l.papel === "assistant" && l.metadata?.tema)?.metadata?.tema ?? null;

  const historico = linhas
    .slice()
    .reverse()
    .map((l) => ({ papel: l.papel as "user" | "assistant", conteudo: l.conteudo }));

  // A mensagem que estamos respondendo já entra separada no classificador,
  // como "última mensagem" — aqui ela sairia duplicada.
  const ultima = historico[historico.length - 1];
  if (ultima?.papel === "user" && ultima.conteudo === userInput) historico.pop();

  return { historico, tema };
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

function runAllValidatorsExceptSize(
  texto: string,
  bps: { versao_curta?: string | null; versao_conversa: string | null; passos_praticos?: string[] }[],
): ValidationResult {
  for (const check of [
    () => validateAntiSubstituicaoProfissional(texto),
    () => validateAntiDiagnostico(texto),
    () => validateAntiClinico(texto),
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
