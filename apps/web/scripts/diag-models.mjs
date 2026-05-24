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

console.log("ANTHROPIC_API_KEY presente:", Boolean(process.env.ANTHROPIC_API_KEY));
console.log("ANTHROPIC_MODEL_PRINCIPAL:", process.env.ANTHROPIC_MODEL_PRINCIPAL || "(default claude-sonnet-4-6)");
console.log("ANTHROPIC_MODEL_LEVE:", process.env.ANTHROPIC_MODEL_LEVE || "(default claude-haiku-4-5)");

if (!process.env.ANTHROPIC_API_KEY) {
  console.log("\n⚠️  Sem ANTHROPIC_API_KEY no .env.local — não dá pra testar localmente.");
  process.exit(0);
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const modelos = [
  process.env.ANTHROPIC_MODEL_PRINCIPAL || "claude-sonnet-4-6",
  process.env.ANTHROPIC_MODEL_LEVE || "claude-haiku-4-5",
];

for (const model of modelos) {
  try {
    const r = await client.messages.create({
      model,
      max_tokens: 10,
      messages: [{ role: "user", content: "responda só: ok" }],
    });
    const txt = r.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    console.log(`✅ ${model} → "${txt.trim()}"`);
  } catch (e) {
    console.log(`❌ ${model} → ${e?.status ?? ""} ${e?.message ?? e}`);
  }
}
