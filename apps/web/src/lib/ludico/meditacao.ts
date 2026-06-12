import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnthropicClient, MODELS } from "@/lib/ia/anthropic";
import { logarUsoApi } from "@/lib/billing/logar";

/**
 * Meditação guiada (Lúdico). Dois usos:
 *   - sugerirTemas: a partir do que está acontecendo com a criança, propõe
 *     2-3 intenções/temas pertinentes (Haiku, barato).
 *   - gerarMeditacao: escreve o roteiro pra mãe ler em voz alta (Sonnet).
 *
 * Tom calmo, sensorial, idade-apropriado, com o nome e os interesses da
 * criança. Anti-ABA (sem recompensa/obediência), nada clínico.
 */

export type Intencao = "acalmar" | "visualizar" | "dormir" | "coragem" | "seguranca" | "outra";

export const INTENCOES: Array<{ key: Intencao; label: string; desc: string }> = [
  { key: "acalmar", label: "Acalmar", desc: "voltar ao corpo quando está agitada ou brava" },
  { key: "visualizar", label: "Visualizar um momento", desc: "ensaiar algo que vai acontecer, correndo bem" },
  { key: "dormir", label: "Relaxar pra dormir", desc: "soltar o corpo e desacelerar à noite" },
  { key: "coragem", label: "Coragem", desc: "sentir-se forte antes de algo difícil" },
  { key: "seguranca", label: "Sentir-se segura", desc: "sentir-se protegida e querida" },
];

function rotuloIntencao(i: Intencao): string {
  return INTENCOES.find((x) => x.key === i)?.label ?? "Meditação";
}

const SYSTEM_MED = `Você cria MEDITAÇÕES GUIADAS curtas para crianças neurodivergentes, em português do Brasil, pra um ADULTO LER EM VOZ ALTA devagar.

Tom: calmo, lento, concreto, sensorial, afetuoso e previsível. Use o NOME e os interesses da criança quando ajudar (deixa pessoal e envolvente). Linguagem simples e adequada à idade. Inclua uma respiração simples, âncoras no corpo (mãos, pés, barriga) e PAUSAS marcadas com "…" ou "(pausa)". Nada assustador, nada clínico, sem diagnóstico.

ANTI-ABA: nada de recompensa, prêmio ou obediência ("se ficar quietinha ganha…"). É acolhimento, não controle.

Adapte pela INTENÇÃO:
- acalmar: trazer de volta ao corpo e à respiração, devagar, validando o que ela sente.
- visualizar: conduzir a criança a imaginar a cena futura acontecendo com CALMA e APOIO, do começo ao fim, ela lidando bem (sem prometer que será perfeito — só seguro e possível).
- dormir: relaxamento progressivo, ritmo cada vez mais lento e sonolento.
- coragem: sentir uma força tranquila no corpo antes de algo difícil.
- seguranca: sensação de estar protegida, acompanhada e querida.

Fecho sempre tranquilo.

Devolva EXATAMENTE neste formato (sem JSON, sem markdown, sem comentários):
TÍTULO: <título curto e doce>
ROTEIRO:
<o texto pra ler em voz alta, com quebras de linha e pausas marcadas com "…" ou "(pausa)">`;

export async function gerarMeditacao(
  params: {
    intencao: Intencao;
    tema?: string;
    contexto?: string;
    membro: { nome: string; idade: number | null } | null;
    interesses?: string;
  },
  tracking?: { supabase: SupabaseClient; family_account_id: string | null },
): Promise<{ titulo: string; roteiro: string }> {
  const client = getAnthropicClient();
  const linhas: string[] = [`Intenção: ${rotuloIntencao(params.intencao)}.`];
  if (params.membro) {
    linhas.push(
      `Criança: ${params.membro.nome}${params.membro.idade != null ? `, ${params.membro.idade} anos` : ""}.`,
    );
  }
  if (params.interesses?.trim()) linhas.push(`Interesses dela: ${params.interesses.trim()}.`);
  if (params.tema?.trim()) linhas.push(`Foco/tema: ${params.tema.trim()}.`);
  if (params.contexto?.trim()) linhas.push(`O que está acontecendo: ${params.contexto.trim()}.`);
  linhas.push("Escreva a meditação. Devolva o JSON.");

  const msg = await client.messages.create({
    model: MODELS.principal,
    max_tokens: 1600,
    system: [{ type: "text", text: SYSTEM_MED, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: linhas.join("\n") }],
  });
  if (tracking) {
    await logarUsoApi(tracking.supabase, {
      family_account_id: tracking.family_account_id,
      provider: "anthropic",
      model: MODELS.principal,
      feature: "meditacao_roteiro",
      input_tokens: msg.usage.input_tokens,
      output_tokens: msg.usage.output_tokens,
      meta: { intencao: params.intencao },
    });
  }
  const raw = msg.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("");
  const parsed = parseMeditacao(raw);
  if (!parsed) throw new Error("Não consegui escrever a meditação. Tente de novo.");
  return parsed;
}

export type TemaSugerido = { intencao: Intencao; tema: string; motivo: string };

const SYSTEM_SUG = `Você sugere TEMAS de meditação guiada pertinentes ao que está acontecendo com uma criança neurodivergente, em PT-BR. A partir do contexto, proponha 2 a 3 ideias úteis AGORA. NÃO diagnostique; fale com cuidado.

Intenções possíveis: acalmar, visualizar (ensaiar um momento futuro), dormir, coragem, seguranca.

Devolva APENAS um JSON array:
[ { "intencao": "acalmar|visualizar|dormir|coragem|seguranca", "tema": "foco curto (ex.: 'antes da consulta no dentista')", "motivo": "1 frase curta de por que pode ajudar agora" } ]`;

export async function sugerirTemas(
  params: { contexto: string; membro: { nome: string; idade: number | null } | null },
  tracking?: { supabase: SupabaseClient; family_account_id: string | null },
): Promise<TemaSugerido[]> {
  const client = getAnthropicClient();
  const userMsg = `${params.membro ? `Criança: ${params.membro.nome}${params.membro.idade != null ? `, ${params.membro.idade} anos` : ""}.\n` : ""}O que sabemos do momento dela:
${params.contexto || "(pouca informação — sugira temas gerais e suaves)"}

Sugira 2-3 temas. Devolva o JSON array.`;

  const msg = await client.messages.create({
    model: MODELS.leve,
    max_tokens: 700,
    system: [{ type: "text", text: SYSTEM_SUG, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userMsg }],
  });
  if (tracking) {
    await logarUsoApi(tracking.supabase, {
      family_account_id: tracking.family_account_id,
      provider: "anthropic",
      model: MODELS.leve,
      feature: "meditacao_sugestoes",
      input_tokens: msg.usage.input_tokens,
      output_tokens: msg.usage.output_tokens,
    });
  }
  const raw = msg.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("");
  return parseSugestoes(raw);
}

function parseMeditacao(s: string): { titulo: string; roteiro: string } | null {
  const txt = s.trim();
  // Formato delimitado (preferido — texto multilinha quebra JSON com newline cru).
  const mRot = txt.match(/ROTEIRO:\s*([\s\S]+)$/i);
  if (mRot && mRot[1].trim()) {
    const mTit = txt.match(/T[ÍI]TULO:\s*(.+)/i);
    return {
      titulo: mTit && mTit[1].trim() ? mTit[1].trim() : "Meditação",
      roteiro: mRot[1].trim(),
    };
  }
  // Fallback: JSON (caso o modelo ignore o formato).
  const obj = extrairJson(txt) as { titulo?: unknown; roteiro?: unknown } | null;
  if (obj && typeof obj.roteiro === "string" && obj.roteiro.trim()) {
    return {
      titulo: typeof obj.titulo === "string" && obj.titulo.trim() ? obj.titulo : "Meditação",
      roteiro: obj.roteiro,
    };
  }
  return null;
}

const INTENCOES_VALIDAS: Intencao[] = ["acalmar", "visualizar", "dormir", "coragem", "seguranca"];

function parseSugestoes(s: string): TemaSugerido[] {
  const arr = extrairJson(s);
  if (!Array.isArray(arr)) return [];
  const out: TemaSugerido[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const it = item as { intencao?: unknown; tema?: unknown; motivo?: unknown };
    const intencao = INTENCOES_VALIDAS.includes(it.intencao as Intencao)
      ? (it.intencao as Intencao)
      : "acalmar";
    if (typeof it.tema !== "string" || !it.tema.trim()) continue;
    out.push({
      intencao,
      tema: it.tema,
      motivo: typeof it.motivo === "string" ? it.motivo : "",
    });
  }
  return out.slice(0, 3);
}

function extrairJson(s: string): unknown {
  const trimmed = s.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const m =
      trimmed.match(/```json\s*([\s\S]*?)\s*```/i) ??
      trimmed.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (!m) return null;
    try {
      return JSON.parse(m[1]);
    } catch {
      return null;
    }
  }
}
