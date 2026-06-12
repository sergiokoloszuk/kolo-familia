import { z } from "zod";
import { getAylaAnthropicClient, AYLA_MODEL, AYLA_MODEL_FALLBACK } from "./anthropic";
import { logarUsoApi } from "@/lib/billing/logar";
import type { UsageTracking } from "./responder";

/**
 * Dedup semântico do DIÁRIO (caminho da Ayla WhatsApp). Numa mesma conversa,
 * a mãe costuma detalhar o MESMO episódio em várias mensagens — e cada uma
 * virava uma linha nova no diário ("Birra para dormir" + "Não queria dormir
 * enquanto os pais assistiam vôlei", o mesmo evento duplicado).
 *
 * Antes de inserir, comparamos o evento novo com os registros de HOJE daquele
 * membro. Se for o mesmo episódio, devolvemos `merge` com a versão consolidada
 * (mais rica, sem repetição) pra ATUALIZAR a linha existente; se for novo, `novo`.
 *
 * Espelha decidirDedup (Kolo Vivo). Roda no mesmo passo de background da
 * resposta. Fallback seguro: na dúvida/erro → `novo` (nunca perde registro).
 */

export type DiarioEvento = {
  conquista: string | null;
  desafio: string | null;
  observacao: string | null;
  gatilho: string | null;
};

const Schema = z.object({
  acao: z.enum(["novo", "merge"]).default("novo"),
  alvo: z.number().int().nonnegative().default(0),
  conquista: z.string().nullable().default(null),
  desafio: z.string().nullable().default(null),
  observacao: z.string().nullable().default(null),
  gatilho: z.string().nullable().default(null),
});
export type DedupDiarioResult = z.infer<typeof Schema>;

const SYSTEM = `Você recebe um EVENTO NOVO que uma mãe acabou de contar sobre o filho atípico, e a lista de eventos que JÁ foram registrados HOJE para essa mesma criança. Decida se o novo é o MESMO episódio de algum já registrado (a mãe está detalhando algo que já contou) ou um episódio NOVO/diferente.

Devolva APENAS JSON:
{ "acao": "novo" | "merge", "alvo": <índice>, "conquista": "...|null", "desafio": "...|null", "observacao": "...|null", "gatilho": "...|null" }

- "novo" → é um episódio diferente (outra situação, outro momento). Ignore os demais campos.
- "merge" → é o MESMO episódio de um já registrado. "alvo" = o índice (0-based) do registro existente que é o mesmo. Os campos conquista/desafio/observacao/gatilho devem trazer a versão CONSOLIDADA e mais RICA do episódio (juntando o que o existente já tinha + o detalhe novo, SEM repetir, em 1 frase clara por campo). Use null no campo que não se aplica.

Regras:
- Mesmo TEMA não basta pra ser merge — tem que ser claramente o MESMO acontecimento. Duas birras diferentes no mesmo dia são dois registros.
- Uma conquista e um desafio são episódios diferentes, mesmo que relacionados.
- Preserve a voz da mãe; não invente detalhe que ela não disse.

# Exemplos
Existentes: [0] desafio: "Birra para dormir — estava elétrico e não queria dormir."
Novo: desafio "Não queria dormir enquanto os pais assistiam vôlei; chorou na hora de ir pra cama."
→ {"acao":"merge","alvo":0,"conquista":null,"desafio":"Não queria dormir — estava elétrico enquanto os pais assistiam vôlei; chorou e deu trabalho pra colocá-lo na cama.","observacao":null,"gatilho":null}

Existentes: [0] desafio: "Fez birra na transição da escola pra casa."
Novo: conquista "Comeu brócolis pela primeira vez no jantar."
→ {"acao":"novo","alvo":0,"conquista":null,"desafio":null,"observacao":null,"gatilho":null}`;

export async function decidirDedupDiario(
  params: { novo: DiarioEvento; existentes: DiarioEvento[] },
  tracking?: UsageTracking,
): Promise<DedupDiarioResult> {
  // Sem nada hoje pra comparar → é novo (e nem chamamos o modelo).
  if (params.existentes.length === 0) return { acao: "novo", alvo: 0, conquista: null, desafio: null, observacao: null, gatilho: null };

  const listaExistentes = params.existentes
    .map((e, i) => {
      const partes = [
        e.conquista && `conquista: "${e.conquista}"`,
        e.desafio && `desafio: "${e.desafio}"`,
        e.observacao && `observação: "${e.observacao}"`,
        e.gatilho && `gatilho: "${e.gatilho}"`,
      ].filter(Boolean);
      return `[${i}] ${partes.join(" | ")}`;
    })
    .join("\n");

  const novoTxt = [
    params.novo.conquista && `conquista: "${params.novo.conquista}"`,
    params.novo.desafio && `desafio: "${params.novo.desafio}"`,
    params.novo.observacao && `observação: "${params.novo.observacao}"`,
    params.novo.gatilho && `gatilho: "${params.novo.gatilho}"`,
  ]
    .filter(Boolean)
    .join(" | ");

  const userMsg = `<eventos_de_hoje>
${listaExistentes}
</eventos_de_hoje>

<evento_novo>
${novoTxt}
</evento_novo>

Devolva o JSON.`;

  const client = getAylaAnthropicClient();

  const tentar = async (model: string): Promise<DedupDiarioResult | null> => {
    try {
      const stream = client.messages.stream({
        model,
        max_tokens: 400,
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: userMsg }],
      });
      const finalMessage = await stream.finalMessage();
      const raw = finalMessage.content
        .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
        .map((b) => b.text)
        .join("");
      if (tracking) {
        await logarUsoApi(tracking.supabase, {
          family_account_id: tracking.family_account_id,
          provider: "anthropic",
          model,
          feature: tracking.feature,
          input_tokens: finalMessage.usage.input_tokens,
          output_tokens: finalMessage.usage.output_tokens,
        });
      }
      const json = parseJsonLoose(raw);
      if (!json) return null;
      const safe = Schema.safeParse(json);
      return safe.success ? safe.data : null;
    } catch (e) {
      console.warn(`[dedup-diario] falha do modelo ${model}:`, e instanceof Error ? e.message : e);
      return null;
    }
  };

  const decisao = (await tentar(AYLA_MODEL)) ?? (await tentar(AYLA_MODEL_FALLBACK));
  // Fallback seguro: na dúvida, registra como novo (não perde info).
  if (!decisao) return { acao: "novo", alvo: 0, conquista: null, desafio: null, observacao: null, gatilho: null };
  // Guarda contra índice fora do range.
  if (decisao.acao === "merge" && (decisao.alvo < 0 || decisao.alvo >= params.existentes.length)) {
    return { ...decisao, acao: "novo" };
  }
  return decisao;
}

function parseJsonLoose(s: string): unknown {
  const trimmed = s.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const m = trimmed.match(/```json\s*([\s\S]*?)\s*```/i) ?? trimmed.match(/(\{[\s\S]*\})/);
    if (!m) return null;
    try {
      return JSON.parse(m[1]);
    } catch {
      return null;
    }
  }
}
