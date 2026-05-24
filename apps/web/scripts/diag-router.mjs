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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data: skills } = await supabase
  .from("specialist_prompt_templates")
  .select("name, display_name, objective, scope, routing_priority")
  .eq("ativo", true);

const maxSkills = 2;
const catalogo = skills
  .map((s) => `- ${s.name}: ${s.display_name} — ${(s.scope || s.objective || "").slice(0, 160)}`)
  .join("\n");

const input = "ela nao monta frases como posso ajudar";

const system = `Você é o roteador de especialistas do Kolo Família. Dada a mensagem de um adulto responsável sobre uma criança neurodivergente, escolha de 1 a ${maxSkills} especialistas MAIS relevantes da lista, do mais relevante ao menos. Responda APENAS com JSON, sem texto antes/depois: {"skills":["name1","name2"]}. Use EXATAMENTE os identificadores (name) da lista. Não invente nomes.`;
const user = `Especialistas disponíveis:\n${catalogo}\n\nMensagem do adulto:\n"""${input}"""\n\nQuais especialistas? Responda só o JSON.`;

console.log("CATÁLOGO:\n" + catalogo + "\n");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
try {
  const r = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL_LEVE || "claude-haiku-4-5",
    max_tokens: 150,
    system: [{ type: "text", text: system }],
    messages: [{ role: "user", content: user }],
  });
  const raw = r.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  console.log("RAW RESPOSTA HAIKU:\n" + raw);
} catch (e) {
  console.log("❌ ERRO:", e?.status ?? "", e?.message ?? e);
}
