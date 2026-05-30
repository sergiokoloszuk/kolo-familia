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

const VOZ = `# Voz do produto
- HIPÓTESES, NÃO CAUSAS AFIRMADAS. Abra possibilidades, nunca afirme o que está acontecendo.
- Tom: amiga experiente, não terapeuta. Direta, humana, afetuosa. Sem performar empatia.
- NÃO usar termos clínicos prescritivos (diagnóstico, tratamento, cura). NÃO comparar com outras crianças. NÃO alarmar.`;

const SKILL = `## Especialista: Regulação emocional
- Objetivo: ajudar a criança a lidar com desregulação e transições.
- Tom: calmo, prático.`;

const ANATOMIA_ATUAL = `# Estrutura obrigatória da resposta — 6 partes
1. **Acolhimento breve** — 1 frase.
2. **Leitura contextual** — cite 1-2 elementos do Kolo Vivo, referenciando o membro.
3. **Interpretação** — hipóteses, várias possibilidades.
4. **Estratégia prática** — 1-2 ideias acionáveis ancoradas em Boas Práticas.
5. **Frase pronta** — para o adulto usar literalmente, em itálico (*frase*).
6. **Pergunta final** — mantém a conversa aberta.

# Tamanho
Resposta total ≤ 350 palavras.`;

const ANATOMIA_NOVA = `# Como responder
Responda como uma amiga sábia conversando no WhatsApp — curto, quente, direto. Não é redação.
- Acolha e mostre que entende, citando de leve 1 coisa do Kolo Vivo da criança (1-2 frases).
- Se ajudar, levante 1 hipótese do que pode estar por trás — possibilidade, nunca causa afirmada.
- Dê 1 ideia prática e possível agora (ancorada nas Boas Práticas). Se couber, ofereça uma *frase pronta* pro adulto usar, em itálico.
- Termine com 1 pergunta curta que mantém a conversa aberta.
Nem todo item é obrigatório — siga o que a mensagem pede. Lista com "- " só se houver 2+ passos.

# Tamanho
Curto: alvo de 120 palavras, máximo 180. Resposta longa cansa quem está no meio de um perrengue.`;

const CONTEXT = `<membro_atipico>
nome: André
idade: 7 anos
perfil: TEA nível 1
como_e: Ama dinossauros e trens. Gosta de rotina previsível.
desafios_regulacao: Dificuldade em transições e quando o plano muda.
sensorial: Incomoda com sons altos.
</membro_atipico>

<boas_praticas>
1. Antecipar transições com aviso e contagem regressiva.
2. Usar o interesse da criança como ponte pra tarefas difíceis.
</boas_praticas>

<mensagem_da_mae>
O André não quis sair do parque hoje e teve uma crise enorme na hora de ir embora. Como lido com isso?
</mensagem_da_mae>`;

async function gerar(label, anatomia) {
  const system = `Você é uma equipe de especialistas do Kolo Família.\n\n${SKILL}\n\n${VOZ}\n\n${anatomia}`;
  const t0 = Date.now();
  const r = await client.messages.create({
    model: MODEL,
    max_tokens: 1200,
    thinking: { type: "disabled" },
    system: [{ type: "text", text: system }],
    messages: [{ role: "user", content: CONTEXT }],
  });
  const txt = r.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  const palavras = txt.split(/\s+/).length;
  console.log("\n" + "=".repeat(70));
  console.log(`${label}  (${palavras} palavras · ${r.usage.output_tokens} tokens · ${((Date.now()-t0)/1000).toFixed(1)}s)`);
  console.log("=".repeat(70));
  console.log(txt);
}

await gerar("ATUAL (6 partes, ≤350)", ANATOMIA_ATUAL);
await gerar("PROPOSTA (enxuta, ~120)", ANATOMIA_NOVA);
