import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
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
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data } = await supabase.from("ai_prompts").select("system_text").eq("key", "voz_ayla").maybeSingle();
const system = data.system_text;

const userMsg = `Você está falando com Karina.
A criança em foco é André, 7 anos.

<o_que_ja_sabemos_da_crianca>
Como é / interesses: Ama dinossauros e trens.
Desafios e regulação: Dificuldade em transições.
Sensorial: Incomoda com sons altos.
</o_que_ja_sabemos_da_crianca>

<mensagem_de_agora>
O André está em crise agora, o que eu faço?
</mensagem_de_agora>

Responda como a Ayla.`;

const t0 = Date.now();
const ms = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

const stream = client.messages.stream({
  model: MODEL,
  max_tokens: 600,
  system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
  messages: [{ role: "user", content: userMsg }],
});

let buffer = "";
let n = 0;
for await (const event of stream) {
  if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
    buffer += event.delta.text;
    let idx;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const par = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 2);
      if (par) console.log(`[${ms()}] chunk ${++n}: ${par}`);
    }
  }
}
const resto = buffer.trim();
if (resto) console.log(`[${ms()}] chunk ${++n}: ${resto}`);
console.log(`\n>>> total: ${n} chunks, completou em ${ms()}`);
