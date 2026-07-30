import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnthropicClient, MODELS } from "@/lib/ia/anthropic";

/**
 * "Já dá pra entregar o plano?" — o gate de SUFICIÊNCIA.
 *
 * Histórico (importa pra não repetir o vaivém):
 * - Até 24/07/2026 a ponte entregava o plano sozinha assim que o parser marcava
 *   um desafio. Karina reclamou, com razão: atropelava a conversa e, com quem
 *   tinha acabado de chegar, saía genérico (perfil raso).
 * - No commit 6d4e21a isso foi removido e o plano passou a depender da mãe
 *   dizer a palavra "plano" (ou aceitar uma oferta). Aí virou o outro extremo:
 *   conversas de dias, ricas, terminando sem NENHUMA entrega.
 *
 * O meio-termo que a Karina pediu era "conversa rica → ao ter elementos
 * suficientes, entregar". É isso que mora aqui: não é a PALAVRA que libera o
 * plano, é o ESTADO da conversa.
 *
 * O critério é conteúdo de produto — está escrito em CRITERIO_SUFICIENCIA de
 * propósito, num lugar só, pra a Karina poder ler e ajustar sem caçar prompt.
 */

/** O que precisa estar na mesa pra um plano sair BOM (e não genérico). */
export const CRITERIO_SUFICIENCIA = `Um plano estratégico só vale a pena quando a conversa JÁ TEM, ao mesmo tempo:
1. PROBLEMA DEFINIDO — um desafio concreto e nomeável do dia a dia (a transição que gera crise, a seletividade alimentar, o travamento na fala), não um mal-estar difuso ("tô cansada", "tá difícil").
2. CONTEXTO — quando/onde aquilo acontece (em casa, na escola, na hora de dormir, quando precisa parar algo).
3. EXEMPLO CONCRETO — pelo menos UMA situação real que a família contou, com detalhe ("não termina o quebra-cabeça antes do sinal tocar", "grita quando ofereço a palavra que ele procura").

NÃO está pronto quando:
- é crise acontecendo agora, desabafo ou sofrimento do adulto (aí a pessoa precisa de acolhimento, não de material);
- é dúvida pontual que a resposta na conversa já resolve;
- o tema apareceu agora e ainda não foi explorado (1 mensagem solta);
- a conversa está sobre outra coisa (preço, acesso ao app, agradecimento, assunto do time humano);
- a família está falando de várias crianças e ainda não ficou claro de quem é o desafio.`;

export type Prontidao = {
  pronto: boolean;
  /** O tema específico do plano, nas palavras da conversa. */
  tema: string | null;
  /** Por que sim/não — vai pro log, ajuda a calibrar o critério. */
  motivo: string;
};

const NAO = (motivo: string): Prontidao => ({ pronto: false, tema: null, motivo });

/**
 * Lê as últimas trocas e decide. Chamada leve (Haiku) — roda só quando a ponte
 * já passou pelos freios baratos (cooldown, dedup de 20h, profundidade).
 * Qualquer falha → NÃO entrega: na dúvida, a conversa segue (o silêncio é
 * recuperável; um plano genérico entregue não é).
 */
export async function avaliarProntidaoParaPlano(
  supabase: SupabaseClient,
  params: { familyId: string; mensagemAtual: string },
): Promise<Prontidao> {
  try {
    const { data } = await supabase
      .from("ayla_messages")
      .select("direcao, texto, created_at")
      .eq("family_account_id", params.familyId)
      .order("created_at", { ascending: false })
      .limit(14);

    const linhas = ((data ?? []) as Array<{ direcao: string; texto: string | null }>)
      .reverse()
      .map((m) => {
        const t = m.texto?.trim();
        if (!t) return null;
        return `${m.direcao === "inbound" ? "Mãe" : "Ayla"}: ${t.slice(0, 400)}`;
      })
      .filter((l): l is string => Boolean(l));

    if (linhas.length < 3) return NAO("conversa curta demais");

    const system = `Você avalia se uma conversa entre uma mãe e a assistente Ayla já tem material suficiente pra montar um plano estratégico personalizado pra a criança.

${CRITERIO_SUFICIENCIA}

Responda APENAS JSON: {"pronto":true|false,"tema":"...","motivo":"..."}
- tema: o desafio específico, em 3 a 8 palavras, nas palavras da própria conversa (ex.: "parar atividade antes de terminar"). null se não estiver pronto.
- motivo: no máximo 12 palavras.
Seja CRITERIOSO: na dúvida, responda false. É melhor conversar mais uma vez do que entregar um plano genérico.`;

    const client = getAnthropicClient();
    const final = await client.messages.create({
      model: MODELS.leve,
      max_tokens: 200,
      system: [{ type: "text", text: system }],
      messages: [
        {
          role: "user",
          content: `<conversa>\n${linhas.join("\n")}\n</conversa>\n\n<mensagem_de_agora>\n${params.mensagemAtual.slice(0, 800)}\n</mensagem_de_agora>\n\nSó o JSON.`,
        },
      ],
    });

    const raw = (final.content as Array<{ type: string; text?: string }>)
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return NAO("resposta ilegível do classificador");
    const o = JSON.parse(m[0]) as Record<string, unknown>;
    const pronto = o.pronto === true;
    const tema = typeof o.tema === "string" && o.tema.trim() ? o.tema.trim() : null;
    const motivo = typeof o.motivo === "string" ? o.motivo.slice(0, 120) : "";
    // Sem tema não há plano focado — e plano sem foco é o genérico que a
    // Karina não quer.
    if (pronto && !tema) return NAO("pronto sem tema definido");
    return { pronto, tema, motivo };
  } catch (e) {
    return NAO(`falha: ${e instanceof Error ? e.message : "erro"}`);
  }
}
