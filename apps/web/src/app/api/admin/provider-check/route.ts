import { NextResponse } from "next/server";
import { ehAdmin } from "@/lib/auth/require-admin";
import {
  gerarConversacional,
  providerConversacionalAtivo,
  modoConversacional,
  MODELO_CONVERSA,
  type Provider,
} from "@/lib/ia/provider";
import { calcularCustoTokens } from "@/lib/billing/prices";
import { contarAutorizadas, classificarFalha } from "./diagnostico";

/**
 * PROVA A CHAVE DO AMBIENTE — o bloqueador da ativação (06/08/2026).
 *
 * A chave OpenAI de PRODUÇÃO não é a mesma que a de desenvolvimento, e uma
 * `sk-proj-*` pode ter escopo restrito por projeto: dá pra ter acesso a
 * transcrição e imagem (que o produto já usa) e NÃO ter acesso ao modelo de
 * texto. Descobrir isso com `IA_PROVIDER=openai` já ligado significa descobrir
 * pela mãe que ficou sem resposta.
 *
 * Esta rota faz a MENOR chamada possível com a chave que o servidor realmente
 * tem, e responde só com o que precisa ser provado:
 *
 *   autenticação · acesso ao modelo · resposta válida · provider · model ·
 *   usage · custo calculável pela PRICE_TABLE do produto
 *
 * ⚠️ A CHAVE NUNCA SAI DAQUI. Nem no corpo, nem no erro, nem no log: o
 * `ErroDeProvider` do provider já monta a mensagem a partir de `error.message`
 * do provedor, nunca do header — e o teste `provider.test.ts` trava isso.
 *
 * Admin-only, e de propósito: é uma rota que gasta token de API.
 *
 *   GET /api/admin/provider-check            → prova o provider ATIVO
 *   GET /api/admin/provider-check?p=openai   → prova um braço específico
 *
 * NÃO ativa nada. Provar a chave e trocar `IA_PROVIDER` são dois atos
 * separados, nesta ordem.
 */
export async function GET(req: Request) {
  if (!(await ehAdmin())) {
    return NextResponse.json({ erro: "Acesso negado" }, { status: 403 });
  }

  const pedido = new URL(req.url).searchParams.get("p");
  const provider: Provider =
    pedido === "openai" || pedido === "anthropic" ? pedido : providerConversacionalAtivo();
  const model = MODELO_CONVERSA[provider];

  // A chave em si nunca é lida aqui — só a existência dela, que é a diferença
  // entre "a variável não foi configurada neste ambiente" e "a API recusou".
  const envDaChave = provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY";
  const chavePresente = Boolean(process.env[envDaChave]);

  // Quantas famílias estão autorizadas — o NÚMERO, nunca os ids. Ver a lista
  // inteira numa resposta HTTP não ajuda a operar e espalha identificador de
  // família por log de proxy. Zero sob `openai_teste` é o dado que importa:
  // significa que ninguém está no GPT, por mais que a chave funcione.
  //
  // ÚNICOS, não entradas. Um id repetido na variável (copiar-colar, um id
  // acrescentado duas vezes) faria a contagem dizer 4 quando são 3 — e a
  // conferência "bate com o que eu configurei?" passaria a mentir justamente
  // no caso em que alguém errou a lista.
  const modo = modoConversacional();
  const autorizadas = contarAutorizadas(process.env.OPENAI_TEST_FAMILY_IDS);

  const base = {
    modo_de_rollout: modo,
    provider_pedido: provider,
    /** O que uma família FORA da allowlist recebe. Em `openai_teste`: anthropic. */
    provider_ativo_no_ambiente: providerConversacionalAtivo(),
    ia_provider_env: process.env.IA_PROVIDER ?? null,
    familias_autorizadas_no_teste: modo === "openai_teste" ? autorizadas : null,
    modelo_configurado: model,
    chave_presente: chavePresente,
  };

  if (!chavePresente) {
    return NextResponse.json(
      { ...base, ok: false, falha: `${envDaChave} não configurada neste ambiente` },
      { status: 503 },
    );
  }

  try {
    const r = await gerarConversacional({
      provider,
      model,
      // A menor chamada que ainda prova o caminho inteiro. Nada do produto —
      // sem núcleo, sem perfil, sem dado de família nenhum.
      system: "Responda em uma palavra.",
      messages: [{ role: "user", content: "diga: ok" }],
      maxTokens: 16,
    });

    const custo = calcularCustoTokens(r.model, r.tokensIn, r.tokensOut);

    return NextResponse.json({
      ...base,
      ok: r.texto.trim().length > 0 && custo > 0,
      autenticacao: "ok",
      acesso_ao_modelo: "ok",
      resposta: r.texto.trim().slice(0, 40),
      provider_no_retorno: r.provider,
      model_no_retorno: r.model,
      usage: { input: r.tokensIn, output: r.tokensOut, cache_read: r.cacheRead },
      custo_usd: custo,
      // Custo zero com resposta válida = modelo fora da PRICE_TABLE. O
      // /admin/uso-api mostraria a migração como se fosse de graça.
      custo_calculavel: custo > 0,
      latencia_ms: r.ms,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro desconhecido";
    return NextResponse.json(
      {
        ...base,
        ok: false,
        classe: classificarFalha(msg),
        // Vem de `error.message` do provedor — que o `ErroDeProvider` monta a
        // partir de `error.message` da API, nunca do header. A chave não passa
        // por aqui em nenhum caminho.
        falha: msg.slice(0, 300),
      },
      { status: 502 },
    );
  }
}
