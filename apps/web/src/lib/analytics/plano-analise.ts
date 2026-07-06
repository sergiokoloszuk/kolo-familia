import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnthropicClient, MODELS } from "@/lib/ia/anthropic";
import { AREAS_DIARIO } from "@/lib/ia/classificar-area";
import { familiasInternas } from "./internos";

/**
 * Analisa os pedidos de PLANO: o campo `tema` é o texto cru da mãe, então uma
 * IA (1 chamada) classifica cada pedido numa ÁREA (domínio do Perfil) e escreve
 * um resumo dos padrões. Assim "Planos por tema" vira algo legível.
 *
 * Sem cache/coluna: roda na carga (dentro de um Suspense pra não travar a
 * página). Se ficar caro com o volume, dá pra cachear depois.
 */

export type PlanoAnalise = {
  porArea: { label: string; n: number }[];
  resumo: string;
  /** Pedidos reais (texto cru) — só admin lê. */
  pedidos: { tema: string; nome: string; area: string }[];
  total: number;
};

function extrairJson(s: string): unknown {
  try {
    return JSON.parse(s.trim());
  } catch {
    const m = s.match(/```json\s*([\s\S]*?)\s*```/i) ?? s.match(/(\{[\s\S]*\})/);
    if (!m) return null;
    try {
      return JSON.parse(m[1]);
    } catch {
      return null;
    }
  }
}

export async function analisarPlanos(admin: SupabaseClient): Promise<PlanoAnalise> {
  const [{ data: planos }, internas] = await Promise.all([
    admin.from("planos").select("family_account_id, tema, created_at").order("created_at", { ascending: false }).limit(300),
    familiasInternas(admin),
  ]);
  const reais = (planos ?? []).filter(
    (p) => p.family_account_id && !internas.has(p.family_account_id as string),
  );
  if (reais.length === 0) {
    return { porArea: [], resumo: "Nenhum plano ainda.", pedidos: [], total: 0 };
  }

  const ids = [...new Set(reais.map((p) => p.family_account_id as string))];
  const { data: profiles } = await admin
    .from("family_profiles")
    .select("family_account_id, nome_mae, como_chamar")
    .in("family_account_id", ids);
  const nomeBy = new Map(
    (profiles ?? []).map((p) => [
      p.family_account_id as string,
      ((p.como_chamar as string | null)?.trim() || (p.nome_mae as string | null)?.trim() || "Anônimo") as string,
    ]),
  );

  const temas = reais.map((p) => ((p.tema as string | null) ?? "").trim() || "(sem tema)");
  const areasList = Object.entries(AREAS_DIARIO)
    .map(([k, l]) => `${k} (${l})`)
    .join(", ");

  const system = `Você classifica PEDIDOS DE PLANO de famílias de pessoas atípicas em ÁREAS e resume os padrões, pra a fundadora entender sobre o que as famílias mais pedem ajuda.
Áreas válidas (use a CHAVE): ${areasList}. Se não encaixar, use "outro".
O "resumo" é visto pela agência de tráfego: fale de PADRÕES AGREGADOS — não cite nomes de famílias nem transcreva o pedido individual de ninguém.
Devolva APENAS JSON, sem texto antes/depois:
{"itens":[{"i":0,"area":"chave"}, ...um por pedido, na ordem...],"resumo":"2 a 4 frases, tom analítico e humano, sobre os temas mais pedidos e padrões que aparecem"}`;
  const userMsg = temas.map((t, i) => `${i}. ${t.slice(0, 200)}`).join("\n");

  let porAreaKey: Record<string, number> = {};
  let resumo = "";
  const areaPorItem: string[] = temas.map(() => "outro");
  try {
    const client = getAnthropicClient();
    let raw = "";
    for (const model of [MODELS.leve, MODELS.principal]) {
      try {
        const resp = await client.messages.create({
          model,
          max_tokens: 1200,
          system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: userMsg }],
        });
        const b = resp.content[0];
        raw = b?.type === "text" ? b.text : "";
        if (raw.trim()) break;
      } catch {
        raw = "";
      }
    }
    const parsed = extrairJson(raw) as { itens?: { i: number; area: string }[]; resumo?: string } | null;
    if (parsed?.itens) {
      for (const it of parsed.itens) {
        if (typeof it.i === "number" && it.i >= 0 && it.i < areaPorItem.length && typeof it.area === "string") {
          areaPorItem[it.i] = AREAS_DIARIO[it.area] ? it.area : "outro";
        }
      }
    }
    if (typeof parsed?.resumo === "string") resumo = parsed.resumo.trim();
  } catch {
    /* graceful */
  }

  for (const a of areaPorItem) porAreaKey[a] = (porAreaKey[a] ?? 0) + 1;
  const label = (k: string) => AREAS_DIARIO[k] ?? "Outro";
  const porArea = Object.entries(porAreaKey)
    .map(([k, n]) => ({ label: label(k), n }))
    .sort((a, b) => b.n - a.n);

  const pedidos = reais.map((p, i) => ({
    tema: temas[i],
    nome: nomeBy.get(p.family_account_id as string) ?? "Anônimo",
    area: label(areaPorItem[i]),
  }));

  return {
    porArea,
    resumo: resumo || "Não consegui resumir agora — tente recarregar.",
    pedidos,
    total: reais.length,
  };
}
