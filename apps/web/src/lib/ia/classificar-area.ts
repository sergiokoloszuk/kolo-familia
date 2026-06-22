import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnthropicClient, MODELS } from "./anthropic";
import { logarUsoApi } from "@/lib/billing/logar";

/**
 * Áreas válidas pra etiquetar conquista/desafio — subconjunto experiencial dos
 * domínios do Perfil. A CHAVE é guardada em diarios.conquista_area/desafio_area
 * e casa com MEMBRO_CAMPO_LABEL (lib/kolo-vivo/campos).
 */
export const AREAS_DIARIO: Record<string, string> = {
  sono: "Sono",
  nutricional: "Alimentação",
  comunicacao: "Comunicação",
  socializacao: "Socialização",
  emocional: "Regulação emocional",
  foco: "Foco e atenção",
  sensorial: "Sensorial",
  motor: "Motor",
  autonomia: "Autonomia",
  aprendizado: "Aprendizado",
  imitacao: "Imitação",
  tela_midia: "Tela e mídia",
  escola: "Escola",
  rotina: "Rotina e transições",
  saude_geral: "Saúde geral",
};

export type AreaDiario = {
  conquistaArea: string | null;
  desafioArea: string | null;
  conquistaLimpa: string | null;
  desafioLimpa: string | null;
};

/**
 * Lê a conquista/desafio crus (texto da mãe) e devolve:
 *  - a ÁREA (domínio do Perfil) de cada um, ou null;
 *  - uma versão LIMPA e calorosa do texto (corrige a escrita, encurta, soa como
 *    observação humana) — SEM inventar fatos nem mudar o sentido. Com `polir:false`,
 *    mantém o texto original (usado no fluxo do WhatsApp, que já vem limpo).
 *
 * Degradação graciosa: sem chave/erro → áreas null e texto original.
 */
export async function classificarAreasDiario(
  params: { conquista?: string | null; desafio?: string | null; polir?: boolean },
  tracking?: { supabase: SupabaseClient; family_account_id: string | null },
): Promise<AreaDiario> {
  const conquista = params.conquista?.trim() || null;
  const desafio = params.desafio?.trim() || null;
  const polir = params.polir ?? true;
  const base: AreaDiario = {
    conquistaArea: null,
    desafioArea: null,
    conquistaLimpa: conquista,
    desafioLimpa: desafio,
  };
  if (!conquista && !desafio) return base;

  let client;
  try {
    client = getAnthropicClient();
  } catch {
    return base;
  }

  const vocab = Object.entries(AREAS_DIARIO)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");
  const system = `Você organiza registros do dia a dia de uma criança neurodivergente. Para a CONQUISTA e o DESAFIO recebidos:
1) ÁREA: escolha UMA área da lista (a CHAVE) que melhor representa cada um. Se não couber em nenhuma, use null.
2) TEXTO LIMPO: reescreva curto, claro e caloroso, como uma OBSERVAÇÃO humana — corrija a escrita, NÃO invente nada, NÃO mude o sentido, sem emoji, em 1 frase.

Áreas válidas (use a CHAVE):
${vocab}

Responda APENAS um JSON, sem nada antes/depois:
{"conquista_area":"<chave|null>","desafio_area":"<chave|null>","conquista_limpa":"<texto|null>","desafio_limpa":"<texto|null>"}`;

  const user = `Conquista: ${conquista ?? "(nenhuma)"}\nDesafio: ${desafio ?? "(nenhum)"}`;

  try {
    const stream = client.messages.stream({
      model: MODELS.leve,
      max_tokens: 400,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
    });
    const final = await stream.finalMessage();
    const raw = final.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("");
    if (tracking) {
      void logarUsoApi(tracking.supabase, {
        family_account_id: tracking.family_account_id,
        provider: "anthropic",
        model: MODELS.leve,
        feature: "classificar_area_diario",
        input_tokens: final.usage.input_tokens,
        output_tokens: final.usage.output_tokens,
      });
    }
    const parsed = parseJson(raw);
    if (!parsed) return base;

    const validArea = (v: unknown): string | null =>
      typeof v === "string" && v in AREAS_DIARIO ? v : null;
    const limpa = (v: unknown, original: string | null): string | null =>
      polir && typeof v === "string" && v.trim() ? v.trim() : original;

    return {
      conquistaArea: conquista ? validArea(parsed.conquista_area) : null,
      desafioArea: desafio ? validArea(parsed.desafio_area) : null,
      conquistaLimpa: conquista ? limpa(parsed.conquista_limpa, conquista) : null,
      desafioLimpa: desafio ? limpa(parsed.desafio_limpa, desafio) : null,
    };
  } catch {
    return base;
  }
}

function parseJson(s: string): Record<string, unknown> | null {
  const t = s.trim();
  try {
    return JSON.parse(t) as Record<string, unknown>;
  } catch {
    const m = t.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}
