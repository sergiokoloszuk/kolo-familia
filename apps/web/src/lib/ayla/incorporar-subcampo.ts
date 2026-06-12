import { z } from "zod";
import { getAylaAnthropicClient, AYLA_MODEL, AYLA_MODEL_FALLBACK } from "./anthropic";
import { logarUsoApi } from "@/lib/billing/logar";
import type { UsageTracking } from "./responder";
import type { SubCampo } from "@/lib/kolo-vivo/subcampos";

/**
 * Roteia um FATO novo (que a Ayla aprendeu) pro SUB-CAMPO certo de um domínio
 * do Kolo Vivo, integrando ali — em vez de empilhar frase solta em "Outras
 * observações" (o que deixava o perfil com "frases jogadas").
 *
 * Recebe os sub-campos (rótulo, tipo, valor atual) + o fato, e devolve em qual
 * campo ele entra e o valor já integrado. Falha/dúvida → cai no último campo
 * (observações) com o fato anexado — nunca perde informação.
 */

export type RotearResult = { skip: boolean; campoSub: string | null; valor: string };

const Schema = z.object({
  skip: z.boolean().default(false),
  campo: z.string().nullable().default(null),
  valor: z.string().default(""),
});

function tipoDe(c: SubCampo): string {
  if (c.opcoes) return `seletor (escolha UMA: ${c.opcoes.join(" | ")})`;
  if (c.lista) return "lista (itens separados por '; ')";
  return "texto curto";
}

const SYSTEM = `Você organiza o perfil de uma criança atípica (Kolo Vivo). Uma ÁREA tem CAMPOS específicos. Você recebe os campos (rótulo, tipo e o que JÁ está em cada um) e um FATO NOVO que a mãe contou. Coloque o fato no campo certo, integrando.

Devolva APENAS JSON: { "skip": true|false, "campo": "<key do campo>"|null, "valor": "..." }

- skip=true → o fato JÁ está coberto pelo que existe (mesmo parafraseado). campo=null, valor="".
- senão → escolha o campo MAIS específico onde o fato se encaixa e devolva o "valor" ATUALIZADO daquele campo:
  • integre o que já estava + o fato novo, conciso e SEM repetir;
  • campo "lista" → devolva os itens separados por "; " (mantendo os que já existiam);
  • campo "seletor" → o valor TEM que ser exatamente UMA das opções; só escolha se o fato indicar claramente;
  • campo "texto" → 1 frase curta e clara;
  • se o fato não encaixa em nenhum campo específico, use o ÚLTIMO campo (observações).
- Use a "key" EXATA do campo. Preserve a voz da mãe; não invente o que ela não disse.

# Exemplo
Campos: key="sons" · Reação a sons · texto · atual: (vazio) | key="movimento" · Movimento · texto · atual: (vazio) | key="outras" · Outras observações · texto · atual: (vazio)
Fato: "cobre os ouvidos quando ligo o liquidificador"
→ {"skip":false,"campo":"sons","valor":"cobre os ouvidos com barulho alto (ex.: liquidificador)"}`;

export async function rotearFatoSubcampo(
  params: { subcampos: SubCampo[]; valoresAtuais: Record<string, string>; fato: string },
  tracking?: UsageTracking,
): Promise<RotearResult> {
  const ultimo = params.subcampos[params.subcampos.length - 1];
  const fallbackOutras = (): RotearResult => {
    const atual = (params.valoresAtuais[ultimo.key] ?? "").trim();
    return {
      skip: false,
      campoSub: ultimo.key,
      valor: [atual, params.fato.trim()].filter(Boolean).join("\n"),
    };
  };

  if (!params.fato.trim() || params.subcampos.length === 0) {
    return { skip: false, campoSub: null, valor: "" };
  }

  const lista = params.subcampos
    .map(
      (c) =>
        `- key="${c.key}" · ${c.label} · ${tipoDe(c)} · atual: ${
          (params.valoresAtuais[c.key] ?? "").trim() || "(vazio)"
        }`,
    )
    .join("\n");
  const userMsg = `<campos>\n${lista}\n</campos>\n\n<fato_novo>\n${params.fato.trim()}\n</fato_novo>\n\nDevolva o JSON.`;

  const client = getAylaAnthropicClient();
  const tentar = async (model: string): Promise<z.infer<typeof Schema> | null> => {
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
      console.warn(`[rotear-subcampo] falha do modelo ${model}:`, e instanceof Error ? e.message : e);
      return null;
    }
  };

  const r = (await tentar(AYLA_MODEL)) ?? (await tentar(AYLA_MODEL_FALLBACK));
  if (!r) return fallbackOutras(); // modelo falhou → não perde o fato
  if (r.skip) return { skip: true, campoSub: null, valor: "" };

  const sub = params.subcampos.find((c) => c.key === r.campo);
  if (!sub || !r.valor.trim()) return fallbackOutras();
  // Seletor: valor tem que ser uma das opções; senão joga em observações.
  if (sub.opcoes && !sub.opcoes.includes(r.valor.trim())) return fallbackOutras();

  return { skip: false, campoSub: sub.key, valor: r.valor.trim() };
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
