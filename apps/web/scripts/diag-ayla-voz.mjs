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
const system = data?.system_text ?? "(sem prompt no DB)";
console.log("modelo:", MODEL, "| prompt do DB:", data ? "sim" : "NÃO\n");

const koloVivo = `O essencial: André, 7 anos, TEA nível 1.
Como é / interesses: Ama dinossauros e trens. Curioso, gosta de rotina previsível.
Desafios e regulação: Tem dificuldade em transições e quando o plano muda de repente.
Sensorial: Incomoda com sons altos e etiquetas de roupa.`;

const casos = [
  { titulo: "CRISE + PERGUNTA", msg: "O André está em crise agora, o que eu faço?", desafio: "André em crise", sugestao: false },
  { titulo: "RELATO SIMPLES", msg: "Hoje o André não quis comer brócolis", desafio: "recusa em comer brócolis", sugestao: true },
  { titulo: "CUMPRIMENTO", msg: "Olá, tudo bem?", desafio: null, sugestao: false },
];

for (const c of casos) {
  const notas = [];
  if (c.desafio) notas.push(`Nos bastidores já anotei o desafio do dia ("${c.desafio}") — não repita isso como um robô; no máximo reconheça com naturalidade.`);
  if (c.sugestao) notas.push(`Apareceu algo que pode valer guardar no perfil da criança (Kolo Vivo). Se — e só se — fizer sentido no fluxo, pergunte de leve se ela quer que eu guarde. Sem insistir.`);

  const userMsg = [
    `Você está falando com Karina.`,
    `A criança em foco é André, 7 anos.`,
    `\n<o_que_ja_sabemos_da_crianca>\n${koloVivo}\n</o_que_ja_sabemos_da_crianca>`,
    `\n<mensagem_de_agora>\n${c.msg}\n</mensagem_de_agora>`,
    notas.length ? `\n<notas_internas>\n${notas.join("\n")}\n</notas_internas>` : "",
    `\nResponda como a Ayla.`,
  ].filter(Boolean).join("\n");

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 600,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userMsg }],
  });
  const final = await stream.finalMessage();
  const txt = final.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  console.log("=".repeat(64));
  console.log(`[${c.titulo}] mãe: ${c.msg}`);
  console.log("-".repeat(64));
  console.log(txt);
  console.log("");
}
