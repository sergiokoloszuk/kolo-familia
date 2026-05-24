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

const PROMPT_TEMPLATE = `Escreva UMA história curta e encantadora para a criança. Use um PERSONAGEM cativante como protagonista — NÃO a própria criança. Crie o personagem a partir de um interesse dela (um dinossauro, um carrinho, um aviãozinho, um sapo, etc.) e dê um nome a ele. A criança se identifica com o personagem; ela não aparece como personagem na história. O personagem vive a mesma situação descrita.

Como construir (não rotule "cena 1, cena 2" na saída):
- Apresente o personagem no universo que a criança ama.
- Traga uma pequena tensão ligada à situação.
- Crie um REFRÃO curto que se repete 2 a 3 vezes — algo que a criança consiga antecipar e falar junto.
- Use batidas sensoriais e sonoras concretas ("Tchibum!", "splash", "tic-tac") e detalhes simples que dão vida.
- Resolva com um final caloroso e satisfatório: o personagem consegue, do jeito dele.

Linguagem: frases curtas e claras, no presente, gostosas de ler em voz alta. Previsível e concreta (importa para o perfil), mas com calor e um humor leve. NADA de hipótese, análise ou conselho dentro da história ("pode ser que...", "vale observar..." não entram).

Saída: um título com 1 emoji; a história corrida (quebras curtas são bem-vindas); o refrão em destaque quando reaparece. No final, separe um bloco curto "Para você, adulto:" com 2 ou 3 dicas práticas de uso, incluindo como ajudar a criança a se identificar com o personagem — é o único lugar com linguagem para o adulto.

Tamanho: a história em si entre 120 e 220 palavras.`;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data: antes } = await supabase
  .from("output_types")
  .select("key, prompt_template")
  .eq("key", "historias_sociais")
  .maybeSingle();

console.log("ANTES:", antes?.prompt_template?.slice(0, 80), "...\n");

const { error } = await supabase
  .from("output_types")
  .update({ prompt_template: PROMPT_TEMPLATE })
  .eq("key", "historias_sociais");

if (error) {
  console.error("Falha ao atualizar:", error.message);
  process.exit(1);
}

const { data: depois } = await supabase
  .from("output_types")
  .select("prompt_template")
  .eq("key", "historias_sociais")
  .maybeSingle();

console.log("DEPOIS:", depois?.prompt_template?.slice(0, 80), "...");
console.log("\n✅ historias_sociais atualizado.");
