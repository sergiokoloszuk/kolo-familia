import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient, MODELS } from "@/lib/ia/anthropic";
import { prepararRespostaStream } from "@/lib/ia/engine";
import { requireActiveWrite } from "@/lib/auth/require-active-write";

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

    const { data: family } = await supabase
      .from("family_accounts")
      .select("id")
      .eq("user_id", user.id)
      .single();
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

    const { system, messages, roteadas } = await prepararRespostaStream({
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
          thinking: { type: "adaptive" },
          system,
          messages,
        });

        stream.on("text", (delta: string) => {
          try {
            controller.enqueue(encoder.encode(delta));
          } catch {
            // controller já fechado — ignora
          }
        });

        try {
          const final = await stream.finalMessage();
          const texto = final.content
            .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
            .map((b) => b.text)
            .join("")
            .trim();

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
