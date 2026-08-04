/**
 * O TÍTULO DO PLANO — o caso real de 03/08/2026.
 *
 * A mãe pediu um plano sobre pinça e pegada do lápis. O PDF chegou chamado
 * "Guardar brinquedos com modelo junto" — assunto de uma conversa de 9h25
 * antes, que ainda cabia nas 10 últimas mensagens usadas como "desafio".
 *
 * Mede o que o titulador faz com o desafio ANTIGO (as 10 mensagens cruas) e
 * com o NOVO (pedido de agora em primeiro plano, conversa como contexto).
 */
import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";

const WEB = new URL("../../apps/web/", import.meta.url);
const env = readFileSync(new URL(".env.local", WEB), "utf8");
const get = (k) => (env.match(new RegExp("^" + k + "=(.*)$", "m")) || [])[1]?.trim().replace(/^["']|["']$/g, "");
const cli = new Anthropic({ apiKey: get("ANTHROPIC_API_KEY") });

const PEDIDO = "Minha filha precisa desenvolver pinça. Pegar melhor no lápis. Que brincadeiras e atividades sugere. Quero um plano.";

const CONVERSA = [
  "Ayla: Ótimo — então o modelo junto é o caminho dela agora. Ela não está ignorando, está esperando ver.",
  "Mãe: Tem como a gente mostrar visualmente? O que sugere?",
  "Mãe: Assim vai se preparando para cada próximo passo",
  "Ayla: Dá sim — e pra Manu faz ainda mais sentido porque a instrução visual substitui a verbal.",
  "Ayla: Exatamente isso — é a lógica inteira por trás do visual.",
  "Mãe: Pode montar",
  "Ayla: Aqui está a rotina da Manu para arrumar o quarto. A ideia é dividir em passos pequenos: guardar brinquedos, guardar livros, arrumar a cama.",
  `Mãe: ${PEDIDO}`,
].join("\n");

// ANTIGO — o bloco cru, como era antes.
const ANTIGO = `A família pediu um plano sobre o que estávamos conversando. O plano deve ser EXCLUSIVAMENTE sobre este assunto — NÃO amplie pra outros temas, outros filhos, viagens ou eventos que não aparecem aqui.\n\nConversa recente:\n${CONVERSA}`;

// NOVO — exatamente o formato que `desafioDaConversa` monta hoje.
const NOVO = `A família pediu um plano. O PEDIDO DE AGORA é este: "${PEDIDO}" — o plano é sobre ISSO, e o título tem que refletir ISSO.\n\nA conversa abaixo serve pra você entender melhor a criança e o contexto. NÃO amplie pra outros temas, outros filhos, viagens ou eventos que aparecem nela: se o assunto da conversa for outro, ele é contexto, não é o plano.\n\nConversa recente:\n${CONVERSA}`;

// O prompt REAL do titulador (analisarDesafio), lido do fonte.
const src = readFileSync(new URL("src/lib/ia/plano.ts", WEB), "utf8");
const i = src.indexOf("const sys = `") + 13;
const SYS = src.slice(i, src.indexOf("`;", i));

async function titular(desafio) {
  const r = await cli.messages.create({
    model: "claude-haiku-4-5-20251001", max_tokens: 80,
    system: [{ type: "text", text: SYS }],
    messages: [{ role: "user", content: desafio.slice(0, 800) }],
  });
  const t = r.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  try { return JSON.parse(t.match(/\{[\s\S]*\}/)[0]).titulo; } catch { return "(sem json)"; }
}

const PINCA = /pin[çc]a|l[áa]pis|pegada|coordena|motor|mão|dedos|escrit/i;
console.log("PEDIDO:", PEDIDO, "\n");
for (const [nome, d] of [["ANTIGO (10 msgs cruas)", ANTIGO], ["NOVO (pedido em 1º plano)", NOVO]]) {
  const ts = [];
  for (let k = 0; k < 3; k++) ts.push(await titular(d));
  const ok = ts.filter((t) => PINCA.test(t)).length;
  console.log(`${nome}`);
  for (const t of ts) console.log(`   ${PINCA.test(t) ? "ok " : "ERRO"} "${t}"`);
  console.log(`   → ${ok}/3 sobre o pedido atual\n`);
}
