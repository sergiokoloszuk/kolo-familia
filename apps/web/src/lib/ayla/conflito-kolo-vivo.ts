import { z } from "zod";
import { getAylaAnthropicClient, AYLA_MODEL, AYLA_MODEL_FALLBACK } from "./anthropic";
import { logarUsoApi } from "@/lib/billing/logar";
import { metaDoTurno, type UsageTracking } from "./responder";

/**
 * Detector de CONFLITO ENTRE CAMPOS do Kolo Vivo.
 *
 * O dedup (decidirDedup) só compara DENTRO do mesmo campo. Mas fatos de
 * campos diferentes podem se contradizer — ex.: "Comunicação: ama conversar,
 * gagueja" vs "Regulação emocional: não monta frases, só palavras soltas".
 *
 * Quando um fato novo é incorporado num campo, este detector compara o texto
 * desse campo com os DEMAIS e, se houver contradição clara, devolve qual campo
 * conflita + uma descrição humana. NÃO reescreve nada: a contradição é
 * SINALIZADA pra mãe revisar (apagar dado de saúde de criança no automático
 * é arriscado). Roda no mesmo passo de background da incorporação.
 *
 * Fallback seguro: erro/dúvida → null (não inventa conflito).
 */

export type CampoTexto = { campo: string; label: string; texto: string };

const Schema = z.object({
  conflito: z.boolean().default(false),
  campo: z.string().nullable().default(null),
  descricao: z.string().default(""),
});
export type ConflitoResult = { campo: string; descricao: string } | null;

const SYSTEM = `Você compara um TRECHO recém-atualizado do perfil de uma criança atípica com OUTRAS áreas do mesmo perfil, procurando uma CONTRADIÇÃO FACTUAL clara entre elas.

Devolva APENAS JSON: { "conflito": true|false, "campo": "<chave da área que conflita>"|null, "descricao": "..." }

- conflito=true SÓ quando há contradição factual real e clara entre o trecho novo e UMA das outras áreas (ex.: uma diz que a criança "monta frases / conversa" e a outra diz que "não fala / só palavras soltas"). "campo" = a chave da área que conflita. "descricao" = 1 frase curta, em português, nomeando as DUAS áreas e o que se contradiz, no tom de quem aponta com cuidado (não alarmista).
- conflito=false quando são só aspectos diferentes, complementares, ou evolução no tempo — NÃO é contradição. descricao="".

Seja CONSERVADOR: na dúvida, conflito=false. Diferença de grau, contexto ou momento NÃO é contradição.

# Exemplos
Novo (comunicacao): "Ama conversar, mas às vezes gagueja."
Outras: [emocional] "Não monta frases ainda; comunicação limitada a palavras soltas."
→ {"conflito":true,"campo":"emocional","descricao":"‘Comunicação’ diz que ela conversa (com gagueira), mas ‘Regulação emocional’ diz que ela ainda não monta frases — parecem se contradizer."}

Novo (sensorial): "Incomoda com som alto."
Outras: [nutricional] "Aceita poucas texturas."
→ {"conflito":false,"campo":null,"descricao":""}`;

export async function detectarConflitoCrossCampo(
  params: { campoNovo: string; labelNovo: string; textoNovo: string; outros: CampoTexto[] },
  tracking?: UsageTracking,
): Promise<ConflitoResult> {
  const outrosComTexto = params.outros.filter((o) => o.texto.trim().length > 0);
  if (!params.textoNovo.trim() || outrosComTexto.length === 0) return null;

  const listaOutros = outrosComTexto
    .map((o) => `[${o.campo}] (${o.label}): "${o.texto}"`)
    .join("\n");

  const userMsg = `<trecho_novo campo="${params.campoNovo}" area="${params.labelNovo}">
${params.textoNovo}
</trecho_novo>

<outras_areas>
${listaOutros}
</outras_areas>

Devolva o JSON.`;

  const client = getAylaAnthropicClient();

  const tentar = async (model: string): Promise<z.infer<typeof Schema> | null> => {
    try {
      // O cronômetro fecha na resposta do modelo — o `JSON.parse` acontece
      // depois, fora deste bloco. Ver `parser.ts`, onde o padrão foi provado.
      const t0 = Date.now();
      const stream = client.messages.stream({
        model,
        max_tokens: 300,
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: userMsg }],
      });
      const finalMessage = await stream.finalMessage();
      const msModelo = Date.now() - t0;
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
          meta: metaDoTurno(tracking, { ms: msModelo, tentativas: 1 }),
        });
      }
      const json = parseJsonLoose(raw);
      if (!json) return null;
      const safe = Schema.safeParse(json);
      return safe.success ? safe.data : null;
    } catch (e) {
      console.warn(`[conflito-kolo-vivo] falha do modelo ${model}:`, e instanceof Error ? e.message : e);
      return null;
    }
  };

  const r = (await tentar(AYLA_MODEL)) ?? (await tentar(AYLA_MODEL_FALLBACK));
  if (!r || !r.conflito || !r.campo || !r.descricao.trim()) return null;
  // O campo apontado precisa existir entre os comparados.
  if (!outrosComTexto.some((o) => o.campo === r.campo)) return null;
  return { campo: r.campo, descricao: r.descricao.trim() };
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
