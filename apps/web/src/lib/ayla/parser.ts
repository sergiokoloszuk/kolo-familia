import { z } from "zod";
import { getAylaAnthropicClient, AYLA_MODEL, AYLA_MODEL_FALLBACK } from "./anthropic";
import { getSystemPrompt } from "@/lib/ai/prompts";
import type { ParserResult } from "./types";

const ParserSchema = z.object({
  membro_atipico_id: z.string().uuid().nullable(),
  confianca_identificacao: z.number().min(0).max(100),
  conquista: z.string().nullable(),
  desafio: z.string().nullable(),
  emocao_mae: z
    .enum(["muito_bem", "bem", "neutro", "triste", "cansada", "ansiosa_estressada"])
    .nullable(),
  possivel_gatilho: z.string().nullable(),
  observacao_livre: z.string().nullable(),
  quem_estava: z
    .enum(["mae", "pai", "avo_a", "avo_o", "irmao_a", "baba", "professor_a", "outro"])
    .nullable(),
  estado_adulto: z
    .enum(["calmo", "firme", "cansado", "ansioso", "impaciente"])
    .nullable(),
  reacao_adulto: z
    .enum(["acolhedor", "esperou", "interveio", "impositivo", "chamou_ajuda", "outro"])
    .nullable(),
  confianca_camada_adulto: z.number().min(0).max(100),
  sugestao_kolo_vivo: z.boolean(),
  // .nullish() (string | null | undefined): o modelo emite null nesses
  // campos quando não há sugestão; .optional() sozinho rejeitava o null e
  // derrubava TODO parse no fallback → "não consegui entender".
  campo_kolo_vivo_sugerido: z.string().nullish(),
  texto_kolo_vivo_sugerido: z.string().nullish(),
  confianca: z.number().min(0).max(100),
  precisa_clarificar: z.string().nullish(),
});

const SYSTEM_PROMPT_FALLBACK = `Você é o parser da Ayla — converte uma frase livre da mãe (resposta a pergunta diária no WhatsApp) em estrutura.

# Regras
- Devolva APENAS um JSON com a forma do schema. Sem texto antes/depois.
- Se a frase não tiver evento de membro atípico (só "tudo bem" / "passa" / "amanhã eu te conto"), preencha tudo com null e confianca baixa.
- Em famílias com mais de 1 membro atípico, identifique pelo nome citado, pronome ou contexto. Se confiança < 70, deixe membro_atipico_id=null e marque precisa_clarificar.
- Camada B (adulto cuidador): só preencha se a mensagem mencionar quem estava + como o adulto agiu/sentiu. Se ambíguo, confianca_camada_adulto < 70.
- emocao_mae: detecte tom da mensagem (ela está cansada? bem?). Se ambíguo, null.
- sugestao_kolo_vivo=true só se a mensagem revelou algo NOVO sobre o membro que vale arquivar (ex: "descobri que ele acalma com música baixa", "passou a aceitar morango"). Caso contrário false.
- Quando sugestao_kolo_vivo=true, escolha campo_kolo_vivo_sugerido pelo DOMÍNIO mais específico da lista abaixo e escreva texto_kolo_vivo_sugerido como um fato curto (1 frase).

# Domínios do Kolo Vivo (valores válidos de campo_kolo_vivo_sugerido)
Escolha sempre o MAIS específico:
- sensorial — sons, texturas, luz, toque; o que acalma ou incomoda o corpo
- nutricional — comida: o que come, recusa ou passou a aceitar; como prefere comer
- comunicacao — como fala, entende, aponta, usa imagens/gestos
- emocional — gatilhos, sinais de desregulação (crises), o que acalma
- foco — concentração, hiperfoco, dispersão
- sono — como adormece, como dorme, como acorda
- socializacao — relação com outras crianças e adultos, brincar junto/lado a lado
- motor — coordenação do corpo todo e das mãos
- rotina — transições, previsibilidade, avisos antes de mudar de atividade
Use "essencial" só pra identidade ampla (diagnóstico, forças, personalidade) que não couber em nenhum domínio acima.

# Schema de saída
{
  "membro_atipico_id": "uuid-ou-null",
  "confianca_identificacao": 0-100,
  "conquista": "texto-ou-null",
  "desafio": "texto-ou-null",
  "emocao_mae": "muito_bem|bem|neutro|triste|cansada|ansiosa_estressada|null",
  "possivel_gatilho": "texto-ou-null",
  "observacao_livre": "texto-ou-null",
  "quem_estava": "mae|pai|avo_a|avo_o|irmao_a|baba|professor_a|outro|null",
  "estado_adulto": "calmo|firme|cansado|ansioso|impaciente|null",
  "reacao_adulto": "acolhedor|esperou|interveio|impositivo|chamou_ajuda|outro|null",
  "confianca_camada_adulto": 0-100,
  "sugestao_kolo_vivo": true/false,
  "campo_kolo_vivo_sugerido": "sensorial|nutricional|comunicacao|emocional|foco|sono|socializacao|motor|rotina|essencial|null",
  "texto_kolo_vivo_sugerido": "texto-curto-opcional",
  "confianca": 0-100,
  "precisa_clarificar": "frase-opcional"
}`;

/**
 * Parser da Ayla — PRD §12.7. Usa Haiku (rápido, barato).
 *
 * Em caso de erro do modelo ou JSON inválido, retorna um ParserResult
 * fallback com confiança 0 e precisa_clarificar — o orquestrador então
 * envia uma mensagem de clarificação determinística.
 */
export async function parseInbound(params: {
  texto: string;
  membros: Array<{ id: string; nome: string }>;
  ultimoMembroFoco?: string | null;
}): Promise<ParserResult> {
  const client = getAylaAnthropicClient();

  const contextoMembros = params.membros
    .map((m) => `- ${m.nome} (id: ${m.id})`)
    .join("\n");

  const userMsg = `<membros_atipicos>
${contextoMembros}
</membros_atipicos>
${params.ultimoMembroFoco ? `\n<ultimo_membro_foco>\n${params.ultimoMembroFoco}\n</ultimo_membro_foco>\n` : ""}
<mensagem_da_mae>
${params.texto}
</mensagem_da_mae>

Devolva o JSON.`;

  const systemPrompt = await getSystemPrompt("parser_ayla", SYSTEM_PROMPT_FALLBACK);

  // Tenta o modelo leve; se falhar (erro, JSON ou schema inválido) tenta o
  // principal antes de desistir — o Haiku às vezes vacila em produção.
  const tentar = async (model: string): Promise<ParserResult | null> => {
    let raw: string;
    try {
      const stream = client.messages.stream({
        model,
        max_tokens: 1024,
        system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: userMsg }],
      });
      const finalMessage = await stream.finalMessage();
      raw = finalMessage.content
        .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
        .map((b) => b.text)
        .join("");
    } catch (e) {
      console.warn(`[ayla:parser] falha do modelo ${model}:`, e instanceof Error ? e.message : e);
      return null;
    }

    const json = parseJsonLoose(raw);
    if (!json) return null;

    const parsed = ParserSchema.safeParse(json);
    if (!parsed.success) return null;

    // Defesa: se o ID retornado pela IA não existe na lista de membros, anula.
    if (
      parsed.data.membro_atipico_id &&
      !params.membros.some((m) => m.id === parsed.data.membro_atipico_id)
    ) {
      parsed.data.membro_atipico_id = null;
      parsed.data.confianca_identificacao = 0;
    }

    return parsed.data;
  };

  const resultado = (await tentar(AYLA_MODEL)) ?? (await tentar(AYLA_MODEL_FALLBACK));
  return resultado ?? fallbackResult("modelo não devolveu JSON válido");
}

function fallbackResult(motivo: string): ParserResult {
  return {
    membro_atipico_id: null,
    confianca_identificacao: 0,
    conquista: null,
    desafio: null,
    emocao_mae: null,
    possivel_gatilho: null,
    observacao_livre: null,
    quem_estava: null,
    estado_adulto: null,
    reacao_adulto: null,
    confianca_camada_adulto: 0,
    sugestao_kolo_vivo: false,
    confianca: 0,
    precisa_clarificar: motivo,
  };
}

function parseJsonLoose(s: string): unknown {
  const trimmed = s.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match =
      trimmed.match(/```json\s*([\s\S]*?)\s*```/i) ?? trimmed.match(/(\{[\s\S]*\})/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

// ============================================================
// Detector de comandos textuais — PRD §12.5 §12.13
// Não passa pelo parser IA (mais rápido, mais barato).
// ============================================================

import type { Comando } from "./types";

export function detectarComando(texto: string): Comando | null {
  const t = texto.trim().toLowerCase();

  if (t === "ajuda" || t === "/ajuda") return { tipo: "ajuda" };
  if (t === "sair" || t === "/sair" || t === "cancelar") return { tipo: "sair" };

  // PAUSAR ou PAUSAR <n> dias
  const pausarMatch = t.match(/^pausar(?:\s+(\d{1,2})(?:\s*dias?)?)?$/);
  if (pausarMatch) {
    const dias = pausarMatch[1] ? parseInt(pausarMatch[1], 10) : 7;
    return { tipo: "pausar", dias };
  }

  // MUDAR HORARIO HH:MM
  const horarioMatch = t.match(/^mudar\s*horario\s+(\d{1,2}:\d{2})$/);
  if (horarioMatch) return { tipo: "mudar_horario", hora: horarioMatch[1] };

  return null;
}
