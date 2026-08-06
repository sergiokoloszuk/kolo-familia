import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient, MODELS } from "@/lib/ia/anthropic";
import { prepararRespostaStream } from "@/lib/ia/engine";
import { fronteiraAtravessada } from "@/lib/conducao/fronteiras";
import { logEvent } from "@/lib/log";
import { requireActiveWrite } from "@/lib/auth/require-active-write";
import { resolveFamily } from "@/lib/auth/current-family";

/**
 * Resposta da Kolo em STREAMING (texto token a token).
 * Body: { conversaId }. Responde a ÚLTIMA mensagem do usuário na conversa.
 * Persiste a mensagem do assistente quando o stream termina.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return new Response("Não autenticado", { status: 401 });

    const { data: family } = await resolveFamily(supabase);
    if (!family) return new Response("Família não inicializada", { status: 400 });

    const body = (await req.json().catch(() => null)) as { conversaId?: string } | null;
    const conversaId = body?.conversaId;
    if (!conversaId || typeof conversaId !== "string") {
      return new Response("conversaId inválido", { status: 400 });
    }

    const { data: conversa } = await supabase
      .from("conversas")
      .select("id, membro_atipico_id")
      .eq("id", conversaId)
      .eq("family_account_id", family.id)
      .maybeSingle();
    if (!conversa) return new Response("Conversa não encontrada", { status: 404 });

    try {
      await requireActiveWrite(family.id);
    } catch {
      return new Response("Assinatura inativa", { status: 402 });
    }

    // Responde a última mensagem do usuário.
    const { data: msgs } = await supabase
      .from("mensagens_skill")
      .select("papel, conteudo, created_at")
      .eq("conversa_id", conversaId)
      .order("created_at", { ascending: true });
    const all = msgs ?? [];
    const ultima = all[all.length - 1];
    if (!ultima || ultima.papel !== "user") {
      return new Response("Nada a responder", { status: 409 });
    }
    const userInput = ultima.conteudo as string;

    const { system, messages, roteadas, intencao, tema, ctx } = await prepararRespostaStream({
      supabase,
      familyId: family.id,
      membroAtipicoId: conversa.membro_atipico_id as string | null,
      conversaId,
      userInput,
    });

    const client = getAnthropicClient();
    const encoder = new TextEncoder();

    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        const stream = client.messages.stream({
          model: MODELS.principal,
          max_tokens: 2048,
          // Sem extended thinking nesta rota: o "thinking" é silencioso e
          // atrasava o 1º token visível de 3 a 10s (medido). Desligado, a
          // resposta começa a aparecer em ~1s — o que importa no chat. A
          // qualidade segue alta (Sonnet + contexto rico do Kolo Vivo).
          thinking: { type: "disabled" },
          system,
          messages,
        });

        // ⚠️ O TEXTO NÃO SAI ENQUANTO NÃO FOR INSPECIONADO (06/08/2026).
        //
        // Esta rota é a conversa REAL da web, e até hoje ela não passava por
        // rede de segurança nenhuma. O caminho que tinha os validadores e o
        // piso — `respond()` em `engine.ts`, via `enviarMensagem` — não é
        // chamado por nenhum `.tsx`: é código morto desde a migração pro
        // streaming. Ou seja: a proteção que impediu o diagnóstico informal no
        // WhatsApp simplesmente não existia aqui.
        //
        // O WhatsApp já enfrentou exatamente esta escolha e decidiu igual (ver
        // `responder.ts`): "o streaming continua, mas só INTERNO — sem o
        // instante em que a resposta inteira está em memória, NÃO HÁ ONDE
        // inspecionar o que vai sair. Foi por aí que uma mãe recebeu um
        // diagnóstico informal da filha, em produção."
        //
        // Custo: a mãe deixa de ver a resposta nascendo token a token e passa a
        // recebê-la de uma vez. É a mesma troca já feita no outro canal, e a
        // única forma de não publicar sabendo.
        let buffer = "";
        stream.on("text", (delta: string) => {
          buffer += delta;
        });

        try {
          const final = await stream.finalMessage();
          const bruto = final.content
            .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
            .map((b) => b.text)
            .join("")
            .trim();

          // SÓ A REDE DE FRONTEIRAS. Os outros validadores de `engine.ts`
          // ficaram DE FORA de propósito — a classificação está em
          // `validators.ts`. Regra de estilo não pode jogar fora uma resposta
          // boa, e `validateAntiDiagnostico` (a palavra "diagnóstico" derruba
          // o texto) é o exemplo documentado de filtro que selecionava CONTRA
          // a segurança: ele punia a ressalva honesta e deixava passar a
          // conclusão.
          const vazamento = fronteiraAtravessada(bruto);
          let texto = bruto;
          if (vazamento) {
            await logEvent({
              kind: "fronteira_piso_web_stream",
              severity: "error",
              family_account_id: family.id,
              payload: {
                fronteira: vazamento.fronteira.nome,
                codigos: vazamento.achados.map((v) => v.codigo),
                conversa_id: conversaId,
              },
            }).catch(() => {});
            texto = vazamento.fronteira.piso({
              nomeCuidador: ctx.cuidador?.nome ?? null,
              nomeMembro: ctx.membroFoco?.nome ?? null,
            });
          }

          try {
            controller.enqueue(encoder.encode(texto));
          } catch {
            // controller já fechado — ignora
          }

          await supabase.from("mensagens_skill").insert({
            conversa_id: conversaId,
            family_account_id: family.id,
            papel: "assistant",
            conteudo: texto,
            skills_acionadas: roteadas.map((r) => ({
              name: r.skill.name,
              display_name: r.skill.display_name,
              score: r.score,
            })),
            // `tema` entra aqui pra o PRÓXIMO turno saber em que assunto a
            // conversa estava. É o que evita reconstruir o tema da conversa
            // inteira a partir da última frase — sem coluna nova.
            metadata: { intencao, tema, fronteira: vazamento?.fronteira.nome ?? null },
            tokens_input: final.usage.input_tokens,
            tokens_output: final.usage.output_tokens,
          });

          controller.close();
        } catch (e) {
          try {
            controller.enqueue(
              encoder.encode("\n\n[A resposta foi interrompida. Tente de novo.]"),
            );
          } catch {
            // ignora
          }
          controller.error(e);
        }
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Erro inesperado", { status: 500 });
  }
}
