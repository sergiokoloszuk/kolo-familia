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

const AYLA_MODEL = process.env.ANTHROPIC_MODEL_LEVE || "claude-haiku-4-5";
console.log("modelo:", AYLA_MODEL, "\n");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `Você é o parser da Ayla — converte uma frase livre da mãe (resposta a pergunta diária no WhatsApp) em estrutura.

# Regras
- Devolva APENAS um JSON com a forma do schema. Sem texto antes/depois.
- Se a frase não tiver evento de membro atípico (só "tudo bem" / "passa" / "amanhã eu te conto"), preencha tudo com null e confianca baixa.
- Em famílias com mais de 1 membro atípico, identifique pelo nome citado, pronome ou contexto. Se confiança < 70, deixe membro_atipico_id=null e marque precisa_clarificar.
- Camada B (adulto cuidador): só preencha se a mensagem mencionar quem estava + como o adulto agiu/sentiu. Se ambíguo, confianca_camada_adulto < 70.
- emocao_mae: detecte tom da mensagem (ela está cansada? bem?). Se ambíguo, null.
- sugestao_kolo_vivo=true só se a mensagem revelou algo NOVO sobre o membro que vale arquivar (ex: "descobri que ele acalma com música baixa"). Caso contrário false.

# Schema de saída
{
  "membro_atipico_id": "uuid-ou-null",
  "confianca_identificacao": 0-100,
  "conquista": "texto-ou-null",
  "desafio": "texto-ou-null",
  "emocao_mae": "muito_bem|bem|neutro|triste|cansada|ansiosa_estressada|null",
  "possivel_gatilho": "texto-ou-null",
  "observacao_livre": "texto-ou-null",
  "quem_estava": "mae|pai|avo_a|avo_o|irmao_a|baba|professor_a|outro|null",
  "estado_adulto": "calmo|firme|cansado|ansioso|impaciente|null",
  "reacao_adulto": "acolhedor|esperou|interveio|impositivo|chamou_ajuda|outro|null",
  "confianca_camada_adulto": 0-100,
  "sugestao_kolo_vivo": true/false,
  "campo_kolo_vivo_sugerido": "como_e|desafios_regulacao|...|opcional",
  "texto_kolo_vivo_sugerido": "texto-curto-opcional",
  "confianca": 0-100,
  "precisa_clarificar": "frase-opcional"
}`;

function parseJsonLoose(s) {
  const trimmed = s.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match =
      trimmed.match(/```json\s*([\s\S]*?)\s*```/i) ?? trimmed.match(/(\{[\s\S]*\})/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

const membros = [{ id: "11111111-1111-1111-1111-111111111111", nome: "André" }];
const contextoMembros = membros.map((m) => `- ${m.nome} (id: ${m.id})`).join("\n");

// frase exata que a usuária mandou em produção (sem acentos)
const texto = "Hoje o André nao quis comer brocolis";
const N = 6;

async function run(i) {
  const userMsg = `<membros_atipicos>
${contextoMembros}
</membros_atipicos>
<mensagem_da_mae>
${texto}
</mensagem_da_mae>

Devolva o JSON.`;
  const stream = client.messages.stream({
    model: AYLA_MODEL,
    max_tokens: 1024,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userMsg }],
  });
  const finalMessage = await stream.finalMessage();
  const raw = finalMessage.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const j = parseJsonLoose(raw);
  if (!j) return console.log(`#${i} JSON inválido (parseJsonLoose=null) → confianca 0 → BOUNCE`);
  const bounceVelho = j.confianca < 50;
  const temConteudo = Boolean(j.conquista || j.desafio || j.observacao_livre || (j.sugestao_kolo_vivo && j.texto_kolo_vivo_sugerido));
  console.log(`#${i} confianca=${String(j.confianca).padStart(3)} id=${String(j.confianca_identificacao).padStart(3)} desafio=${JSON.stringify(j.desafio)} | gate ANTIGO=${bounceVelho ? "BOUNCE" : "ok"} | gate NOVO=${temConteudo ? "ok" : "BOUNCE"}`);
}

console.log(`FRASE: "${texto}" — ${N} execuções\n`);
for (let i = 1; i <= N; i++) await run(i);
