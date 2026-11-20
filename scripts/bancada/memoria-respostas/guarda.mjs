/**
 * TRAVAS DA BANCADA — valem para geração e julgamento.
 *
 * A bancada usa as chaves de PRODUÇÃO (decisão do responsável, 19/11/2026).
 * Por isso nenhuma chamada sai sem passar por aqui:
 *   · teto de gasto por provider, somado do `usage` que a própria API devolve;
 *   · arquivo PARAR na pasta de acompanhamento interrompe antes da próxima chamada;
 *   · janela noturna (21h–6h, America/Sao_Paulo);
 *   · 429 (limite de uso) PARA tudo — não insiste, para não disputar com famílias;
 *   · uma chamada por vez (o chamador é sequencial; aqui só se confere).
 *   · rede só para os dois endpoints de modelo.
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

export const MON = process.env.MON_DIR ?? "/mon";
mkdirSync(resolve(MON, "resultados"), { recursive: true });

const PRECO = {
  "gpt-5.6-luna": [0.249, 1.199],
  "claude-sonnet-4-6": [3.0, 15.0],
  "claude-haiku-4-5": [1.0, 5.0],
};
export const TETO = {
  openai: Number(process.env.TETO_OPENAI ?? 50),
  anthropic: Number(process.env.TETO_ANTHROPIC ?? 150),
};
const TETO_RODADA = Number(process.env.TETO_RODADA ?? Infinity);
const ARQ_GASTO = resolve(MON, "gasto.json");
const gasto = existsSync(ARQ_GASTO)
  ? JSON.parse(readFileSync(ARQ_GASTO, "utf8"))
  : { openai: 0, anthropic: 0, chamadas: 0 };
const inicioRodada = gasto.openai + gasto.anthropic;

export const gastoAtual = () => ({ ...gasto });

export function log(msg) {
  const h = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const linha = `[${h}] ${msg}`;
  console.log(linha);
  appendFileSync(resolve(MON, "progresso.log"), linha + "\n");
}

export class Parada extends Error {}

function conferirAntes(provider) {
  if (existsSync(resolve(MON, "PARAR"))) throw new Parada("arquivo PARAR encontrado");
  const hora = Number(
    new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false }),
  );
  if (process.env.IGNORAR_JANELA !== "1" && hora >= 6 && hora < 21)
    throw new Parada(`fora da janela noturna (hora ${hora})`);
  if (gasto[provider] >= TETO[provider])
    throw new Parada(`teto ${provider} atingido: US$ ${gasto[provider].toFixed(2)}`);
  if (gasto.openai + gasto.anthropic - inicioRodada >= TETO_RODADA)
    throw new Parada(`teto da rodada atingido: US$ ${TETO_RODADA}`);
}

function registrar(provider, modelo, entrada, saida) {
  const [pi, po] = PRECO[modelo] ?? (provider === "openai" ? PRECO["gpt-5.6-luna"] : PRECO["claude-sonnet-4-6"]);
  const custo = (entrada / 1e6) * pi + (saida / 1e6) * po;
  gasto[provider] += custo;
  gasto.chamadas += 1;
  writeFileSync(ARQ_GASTO, JSON.stringify(gasto, null, 2));
  return custo;
}

const ENDPOINTS = {
  "https://api.openai.com/v1/chat/completions": "openai",
  "https://api.anthropic.com/v1/messages": "anthropic",
};

/** A última requisição de modelo — para guardar o que de fato foi enviado. */
export const ultima = { corpo: null, custo: 0 };
let emVoo = 0;
let fila = Promise.resolve();

/**
 * COMPARAÇÃO DE MODELOS SEM TOCAR NO CÓDIGO DE PRODUÇÃO.
 *
 * O caminho oficial fixa `openai`/`gpt-5.6-luna`/esforço `low`. Para medir
 * outro modelo, a bancada troca a chamada AQUI, na rede, e o turno inteiro
 * (contexto, Core, envelope, fronteiras) continua byte a byte o de produção.
 *   MODELO_BANCADA=luna-medium → mesmo corpo, `reasoning_effort: "medium"`;
 *   MODELO_BANCADA=sonnet → o corpo chat/completions vira /v1/messages da
 *     Anthropic e a resposta volta no formato da OpenAI. O envelope JSON
 *     (`response_format`) não existe lá: o esquema vai como instrução no system
 *     e o JSON é recortado do texto — adaptação da bancada, não do produto.
 */
const MODELO_BANCADA = process.env.MODELO_BANCADA ?? "luna-low";

async function chamarComoSonnet(rede, init) {
  const corpo = JSON.parse(init.body);
  const [sys, ...msgs] = corpo.messages;
  const esquema = corpo.response_format?.json_schema?.schema;
  const system =
    sys.content +
    (esquema
      ? `\n\nResponda SOMENTE com um objeto JSON válido, sem texto fora dele, neste esquema:\n${JSON.stringify(esquema)}`
      : "");
  const r = await rede("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: corpo.max_completion_tokens ?? 1200,
      system,
      messages: msgs.map((m) => ({ role: m.role, content: m.content })),
    }),
    signal: AbortSignal.timeout(120000),
  });
  const j = await r.json();
  if (!r.ok) return { r: new Response(JSON.stringify(j), { status: r.status }), j };
  let texto = (j.content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("");
  if (esquema) texto = texto.match(/\{[\s\S]*\}/)?.[0] ?? texto;
  const conv = {
    choices: [{ message: { content: texto }, finish_reason: j.stop_reason === "max_tokens" ? "length" : "stop" }],
    usage: { prompt_tokens: j.usage?.input_tokens ?? 0, completion_tokens: j.usage?.output_tokens ?? 0 },
  };
  return { r: new Response(JSON.stringify(conv), { status: 200, headers: { "content-type": "application/json" } }), j };
}

export function instalarFetch() {
  const rede = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String(input?.url ?? input);
    let provider = Object.entries(ENDPOINTS).find(([p]) => url.startsWith(p))?.[1];
    if (!provider) throw new Error("rede fora do endpoint autorizado: " + url.split("?")[0]);
    const comoSonnet = provider === "openai" && MODELO_BANCADA === "sonnet" && !init?.juiz;
    if (comoSonnet) provider = "anthropic";
    if (provider === "openai" && MODELO_BANCADA === "luna-medium" && !init?.juiz) {
      const c = JSON.parse(init.body);
      if (c.reasoning_effort) init = { ...init, body: JSON.stringify({ ...c, reasoning_effort: "medium" }) };
    }
    // Fila: se o próprio turno disparar duas chamadas juntas, a segunda espera.
    const vez = fila;
    let liberar;
    fila = new Promise((ok) => (liberar = ok));
    await vez;
    emVoo++;
    try {
      conferirAntes(provider);
      let corpo = null;
      try { corpo = JSON.parse(init?.body ?? "null"); } catch {}
      ultima.corpo = corpo;
      if (comoSonnet) {
        const { r, j } = await chamarComoSonnet(rede, init);
        if (r.status === 429) {
          writeFileSync(resolve(MON, "PARAR"), `429 do provider anthropic em ${new Date().toISOString()}\n`);
          throw new Parada("429 (limite de uso) em anthropic — parada automática");
        }
        ultima.custo = registrar("anthropic", "claude-sonnet-4-6", j?.usage?.input_tokens ?? 0, j?.usage?.output_tokens ?? 0);
        return r;
      }
      const r = await rede(input, { ...init, signal: AbortSignal.timeout(120000) });
      if (r.status === 429) {
        writeFileSync(resolve(MON, "PARAR"), `429 do provider ${provider} em ${new Date().toISOString()}\n`);
        throw new Parada(`429 (limite de uso) em ${provider} — parada automática`);
      }
      const clone = r.clone();
      try {
        const j = await clone.json();
        const u = j?.usage ?? {};
        const ent = u.prompt_tokens ?? u.input_tokens ?? 0;
        const sai = u.completion_tokens ?? u.output_tokens ?? 0;
        ultima.custo = registrar(provider, corpo?.model ?? "", ent, sai);
      } catch {}
      return r;
    } finally {
      emVoo--;
      liberar();
    }
  };
}
