import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * BANCADA DE REGIÃO — mede, de DENTRO da função da Vercel, quanto custa falar
 * com cada dependência do caminho crítico da Ayla.
 *
 * ⚠️ POR QUE ISTO EXISTE (14/08/2026, PEND-065). PROVAMOS que a função executa
 * em `iad1` (Washington) enquanto o Supabase está em São Paulo: a mesma
 * consulta trivial custa ~390 ms de lá e ~54 ms do Brasil. Mover a execução
 * para `gru1` economizaria ~330 ms em cada uma das ~25 idas ao banco — mas as
 * chamadas a OpenAI, Anthropic e Z-API hoje saem dos EUA, e podem piorar.
 *
 * Ninguém sabe a conta líquida sem medir dos DOIS lados, com o mesmo código.
 * É isso, e só isso, que esta rota faz.
 *
 * ⚠️ ELA NÃO É PARA PRODUÇÃO. Vive num branch de preview e gasta tokens pagos
 * a cada chamada. Fail-closed: sem `CRON_SECRET` configurado, recusa; sem o
 * token certo, recusa. Nunca escreve, nunca envia mensagem, nunca toca em
 * dados de família.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Amostras = { min: number; mediana: number; media: number; max: number; n: number; brutas: number[] };

function resumir(v: number[]): Amostras {
  const s = [...v].sort((a, b) => a - b);
  return {
    min: s[0],
    mediana: s[Math.floor(s.length / 2)],
    media: Math.round(s.reduce((a, b) => a + b, 0) / s.length),
    max: s[s.length - 1],
    n: s.length,
    brutas: v,
  };
}

async function cronometrar(n: number, f: () => Promise<unknown>): Promise<Amostras> {
  const v: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = Date.now();
    try {
      await f();
    } catch {
      /* a falha também consome tempo; registrar é mais honesto que descartar */
    }
    v.push(Date.now() - t);
  }
  return resumir(v);
}

export async function GET(request: NextRequest) {
  // FAIL-CLOSED: sem segredo configurado, a rota não existe na prática.
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return NextResponse.json({ error: "indisponivel" }, { status: 404 });
  if (request.nextUrl.searchParams.get("token") !== segredo) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const t0 = Date.now();
  const regiao = {
    // O que a própria função sabe sobre onde está rodando.
    VERCEL_REGION: process.env.VERCEL_REGION ?? null,
    VERCEL_ENV: process.env.VERCEL_ENV ?? null,
    VERCEL_URL: process.env.VERCEL_URL ?? null,
  };

  const supabase = createServiceRoleClient();
  /** A MESMA consulta trivial das medições anteriores — comparação só vale com
   *  a operação idêntica. Não lê linha nenhuma: o que ela mede é o transporte. */
  const trivial = async () =>
    await supabase.from("output_types").select("key", { count: "exact", head: true }).limit(1);

  // ── 1. BANCO, uma por vez ────────────────────────────────────────────────
  const primeira = await cronometrar(1, trivial); // isolada: pega o cold start
  const banco = await cronometrar(10, trivial);

  // ── 2. PARALELISMO ───────────────────────────────────────────────────────
  const par = async (n: number) => {
    const t = Date.now();
    await Promise.all(Array.from({ length: n }, () => trivial()));
    return Date.now() - t;
  };
  const tSeq3 = await (async () => {
    const t = Date.now();
    for (let i = 0; i < 3; i++) await trivial();
    return Date.now() - t;
  })();
  const paralelismo = {
    seq3: tSeq3,
    par3: await par(3),
    par5: await par(5),
    par10: await par(10),
  };

  // ── 3. OPENAI — o modelo REAL da resposta principal ──────────────────────
  // ⚠️ Saída FIXA e curta. Comparar regiões com respostas de tamanhos
  // diferentes mediria o comprimento do texto, não a distância.
  const modeloOpenai = process.env.OPENAI_MODEL_PRINCIPAL || "gpt-5.6-luna";
  const chamarOpenai = async () => {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: modeloOpenai,
        max_completion_tokens: 32,
        messages: [{ role: "user", content: "Responda apenas: ok" }],
      }),
    });
    return r.json();
  };
  const openaiPrimeira = await cronometrar(1, chamarOpenai);
  const openai = await cronometrar(3, chamarOpenai);

  // ── 4. ANTHROPIC — o modelo REAL dos auxiliares ──────────────────────────
  const modeloAnthropic = "claude-haiku-4-5";
  const chamarAnthropic = async () => {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: modeloAnthropic,
        max_tokens: 32,
        messages: [{ role: "user", content: "Responda apenas: ok" }],
      }),
    });
    return r.json();
  };
  const anthropicPrimeira = await cronometrar(1, chamarAnthropic);
  const anthropic = await cronometrar(3, chamarAnthropic);

  // ── 5. Z-API — SOMENTE LEITURA DE STATUS ─────────────────────────────────
  // ⚠️ Nenhuma mensagem é enviada. `/status` é consulta da instância; se as
  // credenciais não estiverem no ambiente, o resultado é honesto: null.
  const zapiInstancia = process.env.ZAPI_INSTANCE_ID;
  const zapiToken = process.env.ZAPI_TOKEN;
  const zapiCliente = process.env.ZAPI_CLIENT_TOKEN;
  const zapi =
    zapiInstancia && zapiToken
      ? await cronometrar(3, () =>
          fetch(`https://api.z-api.io/instances/${zapiInstancia}/token/${zapiToken}/status`, {
            headers: zapiCliente ? { "Client-Token": zapiCliente } : {},
          }).then((r) => r.text()),
        )
      : null;

  return NextResponse.json({
    regiao,
    banco: { primeira: primeira.brutas[0], amostras: banco },
    paralelismo,
    openai: { modelo: modeloOpenai, primeira: openaiPrimeira.brutas[0], amostras: openai },
    anthropic: { modelo: modeloAnthropic, primeira: anthropicPrimeira.brutas[0], amostras: anthropic },
    zapi: zapi ? { amostras: zapi } : { erro: "credenciais Z-API ausentes no ambiente" },
    total_ms: Date.now() - t0,
    ts: new Date().toISOString(),
  });
}
