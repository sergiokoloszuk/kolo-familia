import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), "..", ".env.local");
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const MODEL = process.env.ANTHROPIC_MODEL_PRINCIPAL || "claude-sonnet-4-6";
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// System prompt grande-ish pra aproximar o prefill real (skills + contexto).
const system = `Você é uma especialista em desenvolvimento infantil atípico do Kolo Família. ${"Você acolhe, abre hipóteses (nunca afirma causa), personaliza pela criança, não diagnostica nem prescreve, usa linguagem quente e simples. ".repeat(30)}`;

const user = `Meu filho André, 7 anos, TEA nível 1, teve uma crise na transição da escola pra casa hoje. Ama dinossauros. O que pode estar acontecendo e como eu ajudo nas próximas vezes?`;

async function medir(label, thinking) {
  const t0 = Date.now();
  let firstText = null;
  let firstAny = null;
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 2048,
    ...(thinking ? { thinking } : {}),
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
  });
  stream.on("streamEvent", () => {
    if (firstAny == null) firstAny = Date.now() - t0;
  });
  stream.on("text", () => {
    if (firstText == null) firstText = Date.now() - t0;
  });
  const final = await stream.finalMessage();
  const total = Date.now() - t0;
  const outTokens = final.usage.output_tokens;
  console.log(
    `${label.padEnd(24)} 1º evento: ${String(firstAny ?? "-").padStart(5)}ms · 1º TEXTO: ${String(firstText ?? "-").padStart(6)}ms · total: ${String(total).padStart(6)}ms · out:${outTokens}tok`,
  );
}

console.log("modelo:", MODEL, "\n(1º TEXTO = quando o usuário começa a VER a resposta)\n");
await medir("adaptive (atual)", { type: "adaptive" });
await medir("enabled budget=1024", { type: "enabled", budget_tokens: 1024 });
await medir("sem thinking", { type: "disabled" });
console.log("\n(repetindo p/ reduzir ruído)");
await medir("adaptive (atual)", { type: "adaptive" });
await medir("enabled budget=1024", { type: "enabled", budget_tokens: 1024 });
await medir("sem thinking", { type: "disabled" });
