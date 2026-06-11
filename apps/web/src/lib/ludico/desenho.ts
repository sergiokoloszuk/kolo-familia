import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnthropicClient, MODELS } from "@/lib/ia/anthropic";
import { logarUsoApi } from "@/lib/billing/logar";

/**
 * "O que o desenho conta?" — leitura OBSERVACIONAL (nunca diagnóstica) de um
 * desenho infantil. Claude lê a imagem e devolve 4 blocos: o que se observa,
 * possíveis leituras (sempre em hipótese), perguntas pra explorar e o que
 * registrar. As regras de segurança estão travadas no system.
 */

export type MediaTypeImagem = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

export type AnaliseDesenho = {
  observamos: string[];
  leituras: string[];
  perguntas: string[];
  registro: string;
};

const SYSTEM = `Você ajuda a MÃE de uma criança neurodivergente a OBSERVAR um desenho e a fazer boas perguntas — NUNCA a diagnosticar. O desenho é um convite à conversa, não um laudo.

REGRAS INVIOLÁVEIS:
- NUNCA afirme estados ou condições. Proibido: "está ansiosa", "sofreu trauma", "tem autismo/depressão", "isso é abuso", "prova dificuldade social", ou qualquer conclusão clínica.
- Fale SEMPRE em hipótese: "pode sugerir", "pode indicar", "uma possibilidade é", "vale observar". Em 'leituras', inclua SEMPRE ao menos uma alternativa neutra ("também pode ser só uma cena que ela gosta").
- O sentido é da CRIANÇA: o mais importante é a mãe PERGUNTAR a ela o que aquilo significa.
- Um desenho isolado diz pouco — o valor está em observar recorrências ao longo do tempo.

Para crianças que falam pouco / não-verbais: pergunte sobre o PERSONAGEM, não sobre a criança ("esse menino está feliz?", "o dinossauro está bravo ou tranquilo?") e use perguntas de ESCOLHA (apontar uma carinha feliz/triste/brava/com medo; escolher entre dois; mostrar com gesto) — a projeção é mais fácil.

Devolva APENAS um JSON, sem nada antes ou depois:
{
  "observamos": ["4 a 7 fatos VISUAIS e objetivos: cores predominantes; nº de figuras; quem aparece (criança/mãe/pai/amigos/animais); proximidade e tamanho das figuras; expressões; objetos repetidos; cenário (casa/escola/natureza/monstros/veículos); uso do espaço da folha; presença de proteção (casa/muro/abraço/escudo). SÓ o que dá pra ver."],
  "leituras": ["2 a 4 POSSÍVEIS leituras emocionais, TODAS em hipótese, com ao menos uma alternativa neutra. Categorias possíveis: bem-estar, busca de segurança, vínculo com cuidador, interesse social, preferência por brincar sozinho, preocupação/necessidade de controle, intensidade emocional, medo, imaginação, hiperfoco/interesse intenso."],
  "perguntas": ["4 a 6 perguntas calorosas pra mãe explorar com a criança; inclua perguntas sobre o personagem e de escolha (carinhas) quando ajudar."],
  "registro": "1 a 2 frases sobre o que vale anotar e observar nos próximos desenhos (recorrências de cores, personagens, temas, presença social, hiperfocos)."
}

Tom: caloroso, cuidadoso, humilde. Sem termos clínicos. Em português do Brasil.`;

export async function analisarDesenho(
  params: {
    base64: string;
    mediaType: MediaTypeImagem;
    membro: { nome: string; idade: number | null } | null;
    interesses?: string;
    contextoDia?: string;
  },
  tracking?: { supabase: SupabaseClient; family_account_id: string | null },
): Promise<AnaliseDesenho> {
  const client = getAnthropicClient();

  const linhas: string[] = ["Observe este desenho com cuidado."];
  if (params.membro) {
    linhas.push(
      `Quem desenhou: ${params.membro.nome}${params.membro.idade != null ? `, ${params.membro.idade} anos` : ""}.`,
    );
  }
  if (params.interesses?.trim()) {
    linhas.push(`Interesses que já conhecemos dela: ${params.interesses.trim()}.`);
  }
  if (params.contextoDia?.trim()) {
    linhas.push(`Contexto do dia (segundo a mãe): ${params.contextoDia.trim()}.`);
  }
  linhas.push("Devolva o JSON com os 4 blocos.");

  const msg = await client.messages.create({
    model: MODELS.principal,
    max_tokens: 1500,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: params.mediaType, data: params.base64 },
          },
          { type: "text", text: linhas.join("\n") },
        ],
      },
    ],
  });

  if (tracking) {
    await logarUsoApi(tracking.supabase, {
      family_account_id: tracking.family_account_id,
      provider: "anthropic",
      model: MODELS.principal,
      feature: "desenho_analise",
      input_tokens: msg.usage.input_tokens,
      output_tokens: msg.usage.output_tokens,
    });
  }

  const raw = msg.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("");

  const parsed = parseAnalise(raw);
  if (!parsed) throw new Error("Não consegui ler o desenho. Tente uma foto mais nítida.");
  return parsed;
}

function parseAnalise(s: string): AnaliseDesenho | null {
  const trimmed = s.trim();
  let candidate: unknown;
  try {
    candidate = JSON.parse(trimmed);
  } catch {
    const m =
      trimmed.match(/```json\s*([\s\S]*?)\s*```/i) ?? trimmed.match(/(\{[\s\S]*\})/);
    if (!m) return null;
    try {
      candidate = JSON.parse(m[1]);
    } catch {
      return null;
    }
  }
  if (!candidate || typeof candidate !== "object") return null;
  const obj = candidate as Record<string, unknown>;
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  const observamos = arr(obj.observamos);
  const leituras = arr(obj.leituras);
  const perguntas = arr(obj.perguntas);
  const registro = typeof obj.registro === "string" ? obj.registro : "";
  if (observamos.length === 0 && leituras.length === 0) return null;
  return { observamos, leituras, perguntas, registro };
}
