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
  // "adicionar": fato novo pra anexar. "reescrever": texto completo da seção
  // já mesclando o que existia + o novo (quando a info se sobrepõe).
  operacao: "adicionar" | "reescrever";
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
        operacao: z.enum(["adicionar", "reescrever"]).default("adicionar"),
      }),
    )
    .default([]),
  conquista: z.string().trim().min(1).nullable().default(null),
  desafio: z.string().trim().min(1).nullable().default(null),
});

const SYSTEM = `Você é o assistente de registro do Kolo Família. Lê uma conversa entre um adulto responsável e a Kolo (assistente) e CAPTURA o que vale guardar sobre a criança/família. Devolve APENAS JSON, nada antes ou depois.

Sua missão é ajudar a plataforma a ir aprendendo sobre a criança a cada conversa. Seja GENEROSO em capturar: é melhor propor e o adulto desmarcar do que deixar passar. Mas capture só FATOS ditos pelo adulto — NUNCA o conselho/sugestão que a Kolo deu.

Capture em 3 destinos (qualquer um pode ficar vazio):

1. kolo_vivo — informações duradouras. Cada item { camada, campo, texto, operacao }:
   - camada "camada1" (a criança), campo:
     • como_e → interesses, gostos, jeito de ser. GATILHOS: "gosta de", "adora", "ama", "curte", "se interessa por".
     • desafios_regulacao → dificuldades, o que pesa, o que precisa melhorar. GATILHOS: "tem dificuldade", "preciso ajudar com", "não consegue", "foco", "atenção", "birra", "crise", "frustra".
     • corpo_rotina → sono, alimentação, banho, horários, energia ao longo do dia.
     • sensorial → reações a som, luz, textura, toque, cheiro.
     • essencial → diagnóstico ou algo central de quem ela é.
   - camada "camada2" (a família), campo: composicao, rotina, recursos (terapias/escola/apoios), dinamica.
   - **operacao** — olhe o "Kolo Vivo atual" antes de decidir:
     • "adicionar" → é um FATO NOVO que NÃO está na seção. texto = a frase curta nova.
     • "reescrever" → o assunto JÁ está na seção e você vai REFINAR/atualizar (mais detalhe, correção). texto = o TEXTO COMPLETO e atualizado da seção, integrando o que já existia + o novo, SEM perder nada importante e SEM repetir.
   - Se a info já está na seção EXATAMENTE igual (nada novo a acrescentar), NÃO inclua o item.

2. conquista — algo que deu certo / um avanço pra celebrar (frase curta), senão null.

3. desafio — uma dificuldade pontual do dia (frase curta), senão null.

Exemplos:
- "ela adora andar de bicicleta" e a seção como_e não menciona bicicleta → { camada1, como_e, "Adora andar de bicicleta.", "adicionar" }.
- como_e já diz "Adora dinossauros" e o adulto conta "também ama cozinhar" → { camada1, como_e, "Adora dinossauros e cozinhar.", "reescrever" }.
- "ele comeu brócolis pela primeira vez" → conquista: "Comeu brócolis pela primeira vez."

Formato OBRIGATÓRIO (apenas isto):
{ "kolo_vivo": [ { "camada": "camada1", "campo": "como_e", "texto": "...", "operacao": "adicionar" } ], "conquista": null, "desafio": "..." }`;

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
    model: MODELS.principal,
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
