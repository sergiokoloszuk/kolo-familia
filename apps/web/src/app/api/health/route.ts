import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { posTrialAtivo, experimentalParaTodas } from "@/lib/ayla/experimental";
import { lerPlanosNoStripe, PLANOS } from "@/lib/billing/planos";

/**
 * Health check: responde com latência do DB + presença das envs
 * críticas. Útil pra dashboards externos / smoke test pós-deploy.
 *
 * Não vaza chaves — só retorna boolean de presença.
 */
export async function GET() {
  const t0 = Date.now();

  const stripeKey = process.env.STRIPE_SECRET_KEY ?? "";
  const stripeMode = stripeKey.startsWith("sk_live_")
    ? "live"
    : stripeKey.startsWith("sk_test_")
      ? "test"
      : stripeKey
        ? "unknown"
        : "missing";

  // Diagnóstico: verifica se cada price do .env existe no modo do secret
  // (live com price de teste devolve 404 — explica falha do checkout).
  async function checkPrice(id: string | undefined): Promise<string> {
    if (!stripeKey) return "no_key";
    if (!id) return "missing_env";
    try {
      const r = await fetch(`https://api.stripe.com/v1/prices/${id}`, {
        headers: { authorization: `Bearer ${stripeKey}` },
        signal: AbortSignal.timeout(8000),
      });
      if (r.status === 200) return "ok";
      if (r.status === 404) return "not_found_in_mode";
      return `http_${r.status}`;
    } catch {
      return "error";
    }
  }
  const [priceMensal, priceAnual] = await Promise.all([
    checkPrice(process.env.STRIPE_PRICE_ID_MENSAL),
    checkPrice(process.env.STRIPE_PRICE_ID_ANUAL),
  ]);

  /**
   * QUAL PREÇO ESTÁ NO AR, DE VERDADE — 20/08/2026.
   *
   * `env.stripe_price_*` acima só responde "o price existe no modo da chave?".
   * Isso não impediu o defeito: o anual EXISTIA e respondia "ok" enquanto
   * cobrava R$ 603,90 por MÊS.
   *
   * Pior: na Vercel as duas `STRIPE_PRICE_ID_*` estão marcadas como
   * **Sensitive** — o painel não devolve o valor nem para quem tem acesso.
   * Provado em 20/08, ao trocar a variável: "Copy to Clipboard" desabilitado,
   * campo em branco na edição. Ou seja, **não havia NENHUMA forma de saber
   * qual preço a produção usava.**
   *
   * ID de price e recorrência são informação pública do Stripe, não segredo —
   * pelo mesmo critério que já publica o SHA do commit logo abaixo. Fica fora
   * de `env`, que só publica booleanos de presença.
   */
  const planosStripe = await lerPlanosNoStripe().catch(() => null);
  const planos = planosStripe
    ? Object.fromEntries(
        PLANOS.map((p) => [
          p,
          {
            price_id: planosStripe[p].priceId,
            centavos: planosStripe[p].centavos,
            moeda: planosStripe[p].moeda,
            intervalo: planosStripe[p].intervalo,
            intervalo_count: planosStripe[p].intervaloCount,
            ativo: planosStripe[p].ativo,
            ok: planosStripe[p].ok,
            problema: planosStripe[p].problema,
          },
        ]),
      )
    : null;

  const env = {
    supabase_url: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabase_anon: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    supabase_service_role: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
    stripe_secret: Boolean(process.env.STRIPE_SECRET_KEY),
    stripe_secret_mode: stripeMode,
    stripe_webhook_secret: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    stripe_price_mensal: priceMensal,
    stripe_price_anual: priceAnual,
    zapi_token: Boolean(process.env.ZAPI_TOKEN),
    cron_secret: Boolean(process.env.CRON_SECRET),
  };

  /**
   * AS FLAGS DE COMPORTAMENTO — 18/08/2026.
   *
   * ⚠️ FORA DE `env`, E ISSO NÃO É ORGANIZAÇÃO: É CORREÇÃO. Logo abaixo,
   * `allEnvOk` faz `Object.values(env).every(Boolean)` — uma flag DESLIGADA é
   * `false`, então pôr as flags ali derrubaria o health para 503 exatamente
   * quando o produto está no estado padrão e saudável. Peguei isto ao reler o
   * arquivo depois de editar; teria transformado um recurso de observabilidade
   * na causa de um alarme falso permanente.
   *
   * Semanticamente também são coisas diferentes: `env` responde "o segredo está
   * configurado?"; aqui é "qual comportamento está ligado?". A segunda pergunta
   * não tem resposta certa — só tem resposta verdadeira.
   *
   * Vai o VALOR EFETIVO lido pelo código, não a presença da variável: é a
   * diferença entre "alguém digitou algo" e "o runtime está ligado".
   */
  const flags = {
    ayla_pos_trial: posTrialAtivo(),
    ayla_experimental_todas: experimentalParaTodas(),
  };

  let db_ok = false;
  let db_latency_ms: number | null = null;
  let db_error: string | null = null;

  try {
    const supabase = createServiceRoleClient();
    const t1 = Date.now();
    const { error } = await supabase
      .from("output_types")
      .select("key", { count: "exact", head: true })
      .limit(1);
    db_latency_ms = Date.now() - t1;
    if (error) db_error = error.message;
    else db_ok = true;
  } catch (e) {
    db_error = e instanceof Error ? e.message : "unknown";
  }

  const total_ms = Date.now() - t0;
  const allEnvOk = Object.values(env).every(Boolean);
  const ok = db_ok && allEnvOk;

  // ⚠️ QUAL COMMIT ESTÁ NO AR (17/08/2026).
  //
  // "Publicado" e "deployado" são estados diferentes — o §18 do protocolo
  // separa os dois de propósito — e até aqui não havia NENHUMA forma de
  // responder a segunda pergunta de fora da Vercel. Na prática isso já custou
  // caro: pendências ficaram meses marcadas como "corrigida, não publicada"
  // quando o commit estava em `main` há semanas (foi o caso da PEND-071), e
  // toda auditoria precisava confiar em memória em vez de medir.
  //
  // A Vercel injeta estas variáveis sozinha em cada build. O SHA de um commit
  // é informação pública do repositório — não há segredo aqui, e por isso este
  // bloco fica fora do `env`, que só publica booleanos de presença.
  const deploy = {
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    ref: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    ambiente: process.env.VERCEL_ENV ?? null,
  };

  return NextResponse.json(
    {
      ok,
      deploy,
      db: { ok: db_ok, latency_ms: db_latency_ms, error: db_error },
      env,
      flags,
      planos,
      total_ms,
      ts: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 },
  );
}
