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

export function instalarFetch() {
  const rede = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String(input?.url ?? input);
    const provider = Object.entries(ENDPOINTS).find(([p]) => url.startsWith(p))?.[1];
    if (!provider) throw new Error("rede fora do endpoint autorizado: " + url.split("?")[0]);
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
