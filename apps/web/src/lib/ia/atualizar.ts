import { z } from "zod";
import { getAnthropicClient, MODELS } from "./anthropic";

/**
 * Extração estruturada do "Atualizar" — lê uma conversa e propõe o que vale
 * guardar, sem gravar nada. A IA decide entre 3 destinos (qualquer um pode
 * ficar vazio; muitas vezes só um se aplica):
 *   - kolo_vivo: fatos novos e duradouros sobre a criança/família
 *   - conquista: algo que deu certo (pra celebrar)
 *   - desafio: uma dificuldade do dia
 *
 * Quem grava é a action, depois do usuário revisar o preview.
 */

export const CAMPOS_CAMADA1 = [
  "essencial",
  "como_e",
  "corpo_rotina",
  "desafios_regulacao",
  "sensorial",
] as const;

export const CAMPOS_CAMADA2 = ["composicao", "rotina", "recursos", "dinamica"] as const;

export type ItemKoloVivo = {
  camada: "camada1" | "camada2";
  campo: string;
  texto: string;
};

export type PropostaAtualizacao = {
  koloVivo: ItemKoloVivo[];
  conquista: string | null;
  desafio: string | null;
};

const PropostaSchema = z.object({
  kolo_vivo: z
    .array(
      z.object({
        camada: z.enum(["camada1", "camada2"]),
        campo: z.string(),
        texto: z.string().trim().min(1),
      }),
    )
    .default([]),
  conquista: z.string().trim().min(1).nullable().default(null),
  desafio: z.string().trim().min(1).nullable().default(null),
});

const SYSTEM = `Você é o assistente de registro do Kolo Família. Lê uma conversa entre um adulto responsável e a Kolo (assistente) e decide o que vale guardar. Devolve APENAS JSON, nada antes ou depois.

Decida 3 coisas — qualquer uma pode ficar vazia, e muitas vezes só uma se aplica:

1. kolo_vivo: informações NOVAS e duradouras sobre a criança ou a família que apareceram na conversa e que ainda NÃO estão no "Kolo Vivo atual". Cada item é { camada, campo, texto }.
   - camada "camada1" (sobre a criança) — campo deve ser um de: essencial, como_e, corpo_rotina, desafios_regulacao, sensorial.
   - camada "camada2" (sobre a família) — campo deve ser um de: composicao, rotina, recursos, dinamica.
   - texto: frase curta e objetiva pra guardar (NÃO a conversa inteira). Ex.: "Evita folhas verdes cruas; aceita melhor legumes cozidos."
   - Só inclua FATO observado/relatado pelo adulto, nunca o conselho que a Kolo deu.
   - Se não houver nada novo e duradouro, deixe a lista vazia.

2. conquista: se a conversa relata algo que deu certo ou um avanço pra celebrar, escreva uma frase curta. Senão, null.

3. desafio: se a conversa relata uma dificuldade/desafio, escreva uma frase curta. Senão, null.

Formato OBRIGATÓRIO (apenas isto):
{ "kolo_vivo": [ { "camada": "camada1", "campo": "como_e", "texto": "..." } ], "conquista": null, "desafio": "..." }`;

export async function extrairAtualizacoes(params: {
  transcript: string;
  koloVivoResumo: string;
  membro: { nome: string; idade: number | null; perfil: string } | null;
}): Promise<PropostaAtualizacao> {
  const { transcript, koloVivoResumo, membro } = params;

  const client = getAnthropicClient();

  const regraMembro = membro
    ? `A conversa é sobre a criança: ${membro.nome}${membro.idade != null ? `, ${membro.idade} anos` : ""}, perfil ${membro.perfil}.`
    : `A conversa é sobre a família em geral (sem criança específica): use SÓ camada2 no kolo_vivo, e deixe conquista e desafio como null.`;

  const userMsg = `${regraMembro}

<kolo_vivo_atual>
${koloVivoResumo || "(vazio)"}
</kolo_vivo_atual>

<conversa>
${transcript}
</conversa>

Decida o que vale guardar e devolva o JSON.`;

  const stream = client.messages.stream({
    model: MODELS.leve,
    max_tokens: 800,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userMsg }],
  });

  const finalMessage = await stream.finalMessage();
  const raw = finalMessage.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("");

  const parsed = parseJson(raw);
  if (!parsed) {
    return { koloVivo: [], conquista: null, desafio: null };
  }

  // Filtra campos inválidos e respeita a ausência de membro.
  const koloVivo = parsed.kolo_vivo.filter((item) => {
    if (item.camada === "camada1") {
      if (!membro) return false;
      return (CAMPOS_CAMADA1 as readonly string[]).includes(item.campo);
    }
    return (CAMPOS_CAMADA2 as readonly string[]).includes(item.campo);
  });

  return {
    koloVivo,
    conquista: membro ? parsed.conquista : null,
    desafio: membro ? parsed.desafio : null,
  };
}

function parseJson(s: string): z.infer<typeof PropostaSchema> | null {
  const trimmed = s.trim();
  let candidate: unknown;
  try {
    candidate = JSON.parse(trimmed);
  } catch {
    const match =
      trimmed.match(/```json\s*([\s\S]*?)\s*```/i) ?? trimmed.match(/(\{[\s\S]*\})/);
    if (!match) return null;
    try {
      candidate = JSON.parse(match[1]);
    } catch {
      return null;
    }
  }
  const parsed = PropostaSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}
