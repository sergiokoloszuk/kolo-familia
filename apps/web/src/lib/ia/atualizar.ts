import { z } from "zod";
import { getAnthropicClient, MODELS } from "./anthropic";
import { MEMBRO_CAMPOS_TOPLEVEL, MEMBRO_CAMPOS_EXTRAS } from "@/lib/kolo-vivo/campos";
import { SUBCAMPOS_DOMINIO } from "@/lib/kolo-vivo/subcampos";

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

// Campos válidos da criança = todos os domínios reais do Kolo Vivo (toplevel
// legados + os domínios novos em categorias_extras). Antes só havia os 5
// legados, então alimentação/sono/comunicação caíam errado em corpo_rotina.
export const CAMPOS_CAMADA1: readonly string[] = [
  ...MEMBRO_CAMPOS_TOPLEVEL,
  ...MEMBRO_CAMPOS_EXTRAS,
];

export const CAMPOS_CAMADA2 = ["composicao", "rotina", "recursos", "dinamica"] as const;

export type ItemKoloVivo = {
  camada: "camada1" | "camada2";
  campo: string;
  /** Sub-campo (ex.: nutricional → "rejeita"), quando o domínio tem sub-campos. */
  subcampo?: string | null;
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
        subcampo: z.string().trim().nullable().optional(),
        texto: z.string().trim().min(1),
        operacao: z.enum(["adicionar", "reescrever"]).default("adicionar"),
      }),
    )
    .default([]),
  conquista: z.string().trim().min(1).nullable().default(null),
  desafio: z.string().trim().min(1).nullable().default(null),
});

const SYSTEM = `Você é o assistente de registro do Kolo Família. Lê uma conversa entre um adulto responsável e a Kolo (assistente) e CAPTURA o que vale guardar sobre a criança/família. Devolve APENAS JSON, nada antes ou depois.

Sua missão é ajudar a plataforma a ir aprendendo sobre a criança a cada conversa. Seja GENEROSO com o que é NOVO: é melhor propor um fato novo e o adulto desmarcar do que deixar passar. Mas capture só FATOS ditos pelo adulto — NUNCA o conselho/sugestão que a Kolo deu.

REGRA DE NOVIDADE (dura): antes de propor QUALQUER item, confira o "Kolo Vivo atual". Se a informação JÁ está registrada — mesmo dita com outras palavras — NÃO proponha (não duplique). Só proponha o que ACRESCENTA algo realmente novo, ou use "reescrever" para REFINAR/CORRIGIR o que já existe. Na dúvida entre repetir e omitir, OMITA.

Capture em 3 destinos (qualquer um pode ficar vazio):

1. kolo_vivo — informações duradouras. Cada item { camada, campo, texto, operacao }:
   - camada "camada1" (a criança) — escolha o campo MAIS específico:
     • nutricional → ALIMENTAÇÃO: o que come/aceita, o que recusa, texturas, seletividade, dificuldades à mesa, água. GATILHOS: "come", "não come", "aceita", "recusa", "fruta", "verdura", "textura", "seletiv", "à mesa".
     • sono → como adormece, como dorme, despertares, horário de dormir.
     • sensorial → reações a som, luz, textura, toque, cheiro, movimento.
     • comunicacao → como se expressa e como entende (fala, palavras, apontar, imagens, CAA).
     • socializacao → como se relaciona com outras pessoas, com quem flui, o que trava.
     • emocional → gatilhos, sinais quando está difícil, crises, o que ajuda a regular. GATILHOS: "crise", "birra", "frustra", "explode", "chora", "acalma".
     • foco → atenção, concentração, dispersão, hiperfoco.
     • motor → coordenação do corpo todo (grossa) e das mãos (fina).
     • autonomia → o que faz sozinha, o que ainda precisa de ajuda.
     • aprendizado → como aprende, o que ajuda a aprender.
     • imitacao → o que imita (gestos, sons, faz de conta).
     • tela_midia → relação com telas (o que assiste, quanto, como reage).
     • escola → adaptações, o que funciona, queixas.
     • saude_geral → acompanhamentos, alergias, saúde.
     • como_e → interesses, gostos, jeito de ser (que NÃO sejam comida). GATILHOS: "gosta de", "adora", "ama", "curte".
     • essencial → diagnóstico ou algo central de quem ela é.
     • (legado — evite, prefira os específicos acima) corpo_rotina, desafios_regulacao.
   - camada "camada2" (a família), campo: composicao, rotina, recursos (terapias/escola/apoios), dinamica.
   - **operacao** — olhe o "Kolo Vivo atual" antes de decidir:
     • "adicionar" → é um FATO NOVO que NÃO está na seção. texto = a frase curta nova.
     • "reescrever" → o assunto JÁ está na seção e você vai REFINAR/atualizar (mais detalhe, correção). texto = o TEXTO COMPLETO e atualizado da seção, integrando o que já existia + o novo, SEM perder nada importante e SEM repetir.
   - Se a info já está na seção (igual OU equivalente, com outras palavras), NÃO inclua o item.

2. conquista — algo que deu certo / um avanço pra celebrar (frase curta), senão null.

3. desafio — uma dificuldade pontual do dia (frase curta), senão null.

Exemplos:
- "ela adora andar de bicicleta" e a seção como_e não menciona bicicleta → { camada1, como_e, "Adora andar de bicicleta.", "adicionar" }.
- "não aceita frutas e só come o que é crocante" → { camada1, nutricional, "Não aceita frutas; aceita bem alimentos crocantes.", "adicionar" }.
- "ela demora muito pra dormir, só com luz baixa" → { camada1, sono, "Demora pra adormecer; precisa de luz baixa.", "adicionar" }.
- "ele comeu brócolis pela primeira vez" → conquista: "Comeu brócolis pela primeira vez."

Alguns campos têm SUB-CAMPOS — quando propuser um item nesses campos, escolha também "subcampo" (a dimensão exata). Se o sub-campo tiver valor fixo, o "texto" deve ser exatamente um desses valores. (A lista exata vem na mensagem.)

Formato OBRIGATÓRIO (apenas isto):
{ "kolo_vivo": [ { "camada": "camada1", "campo": "nutricional", "subcampo": "rejeita", "texto": "frutas", "operacao": "adicionar" } ], "conquista": null, "desafio": "..." }`;

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

  const instrSub = Object.entries(SUBCAMPOS_DOMINIO)
    .map(([campo, subs]) => {
      const lista = subs
        .map((s) => (s.opcoes ? `${s.key} (valor: ${s.opcoes.join("/")})` : s.key))
        .join(", ");
      return `- ${campo}: ${lista}`;
    })
    .join("\n");

  const userMsg = `${regraMembro}

<campos_com_subcampos>
Ao propor itens nestes campos, defina "subcampo":
${instrSub}
</campos_com_subcampos>

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
  const koloVivo: ItemKoloVivo[] = parsed.kolo_vivo
    .filter((item) => {
      if (item.camada === "camada1") {
        if (!membro) return false;
        return (CAMPOS_CAMADA1 as readonly string[]).includes(item.campo);
      }
      return (CAMPOS_CAMADA2 as readonly string[]).includes(item.campo);
    })
    .map((item) => {
      // Valida o subcampo contra a definição do domínio (descarta se inválido).
      const subs = SUBCAMPOS_DOMINIO[item.campo];
      const subcampo =
        subs && item.subcampo && subs.some((s) => s.key === item.subcampo)
          ? item.subcampo
          : null;
      return {
        camada: item.camada,
        campo: item.campo,
        subcampo,
        texto: item.texto,
        operacao: item.operacao,
      };
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
