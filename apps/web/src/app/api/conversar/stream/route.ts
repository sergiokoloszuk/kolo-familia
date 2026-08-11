import type { NextRequest } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import {
  gerarConversacional,
  providerConversacionalParaFamilia,
  MODELO_CONVERSA,
} from "@/lib/ia/provider";
import { prepararRespostaStream } from "@/lib/ia/engine";
import { fronteiraAtravessada } from "@/lib/conducao/fronteiras";
import { logarUsoApi } from "@/lib/billing/logar";
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

    // O PROVIDER É UMA VARIÁVEL DE AMBIENTE, e o modelo vem dele — nunca uma
    // constante escrita aqui. É o que permite a volta atrás sem deploy e o que
    // garante que o billing abaixo registre o que REALMENTE respondeu.
    //
    // Mesma função que `responder.ts` (WhatsApp) chama, com o mesmo id: no modo
    // de teste, a família autorizada tem que receber GPT nos DOIS canais, e a
    // não autorizada, Claude nos dois.
    const provider = providerConversacionalParaFamilia(family.id);
    const model = MODELO_CONVERSA[provider];
    const encoder = new TextEncoder();

    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
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
        // Como a resposta já era publicada de uma vez, o streaming do SDK só
        // enchia um buffer que ninguém lia deltas de — então trocar por uma
        // chamada única (`gerarConversacional`) não muda nada do que a mãe vê,
        // e é o que torna esta rota portável entre providers.
        try {
          const r = await gerarConversacional({
            provider,
            model,
            // `assemblePrompt` devolve o system em blocos da Anthropic (hoje um
            // só, já marcado pra cache). O provider recebe TEXTO e decide como
            // cada API quer receber isso — então o achatamento é aqui, e
            // `cacheSystem` preserva o desconto que esta rota já tinha.
            system: system.map((b) => b.text).join("\n\n"),
            messages,
            maxTokens: 2048,
            cacheSystem: true,
          });
          const bruto = r.texto.trim();

          // SÓ A REDE DE FRONTEIRAS. Os outros validadores de `engine.ts`
          // ficaram DE FORA de propósito — a classificação está em
          // `validators.ts`. Regra de estilo não pode jogar fora uma resposta
          // boa, e `validateAntiDiagnostico` (a palavra "diagnóstico" derruba
          // o texto) é o exemplo documentado de filtro que selecionava CONTRA
          // a segurança: ele punia a ressalva honesta e deixava passar a
          // conclusão.
          // Mesmo bloco de diagnóstico que `buildContext` já montou e que foi
          // pro system — detector e prompt precisam ler a mesma fonte, senão
          // o código volta a proibir o que o prompt manda fazer.
          const vazamento = fronteiraAtravessada(
            bruto,
            ctx.membroFoco?.diagnosticoRegistrado,
          );
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
            skills_acionadas: roteadas.map((s) => ({
              name: s.skill.name,
              display_name: s.skill.display_name,
              score: s.score,
            })),
            // `tema` entra aqui pra o PRÓXIMO turno saber em que assunto a
            // conversa estava. É o que evita reconstruir o tema da conversa
            // inteira a partir da última frase — sem coluna nova.
            metadata: {
              intencao,
              tema,
              fronteira: vazamento?.fronteira.nome ?? null,
              // Quem respondeu ESTE turno. Sem isto, uma migração com rollback
              // no meio deixa um histórico em que não dá pra saber qual modelo
              // escreveu o quê — e a avaliação da troca fica sem chão.
              provider: r.provider,
              model: r.model,
            },
            tokens_input: r.tokensIn,
            tokens_output: r.tokensOut,
          });

          // BILLING — esta rota é a conversa da web. Provider e modelo saem do
          // RETORNO da chamada, nunca de uma constante local: é o único jeito
          // de o número continuar certo quando o env muda.
          //
          // ⚠️ SERVICE ROLE, E SÓ AQUI (11/08/2026). O `supabase` desta rota é o
          // da SESSÃO DA FAMÍLIA, e `api_calls` é tabela de auditoria: a RLS não
          // deixa um usuário comum inserir. Resultado medido: **zero registros
          // de `conversa_web` em todo o histórico**, enquanto o WhatsApp — que
          // roda em service role — tinha milhares. A chamada existia, os dados
          // estavam certos, e o INSERT era recusado em silêncio.
          //
          // O privilégio fica NESTA linha, não na rota: tudo o mais que esta
          // requisição faz continua passando pela RLS da família, que é onde o
          // isolamento entre famílias mora.
          await logarUsoApi(createServiceRoleClient(), {
            family_account_id: family.id,
            provider: r.provider,
            model: r.model,
            feature: "conversa_web",
            input_tokens: r.tokensIn,
            output_tokens: r.tokensOut,
            meta: {
              conversa_id: conversaId,
              membro_atipico_id: (conversa.membro_atipico_id as string | null) ?? null,
              // PEND-041: canal e ORIGEM são coisas diferentes. "web" diz por
              // onde entrou; "conversa" diz o que era. Sem o segundo, uma
              // geração de Plano e um turno de conversa ficam indistinguíveis.
              origem: "conversa",
              ms: r.ms,
              cache_read: r.cacheRead,
            },
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
