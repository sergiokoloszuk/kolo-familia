/**
 * O TEMA VESTE, NÃO SUBSTITUI — casos A, B e C.
 *
 * O "Dia do dentista" com tema de princesas saiu com o dentista virando "mago
 * do sorriso", o carro virando carruagem e a cadeira do dentista virando
 * cadeira mágica. A rotina visual existe pra PREVISIBILIDADE: se a criança
 * chega esperando um mago e encontra um dentista, o quadro fez o contrário.
 */
import { readFileSync } from "node:fs";
const WEB = new URL("../../apps/web/", import.meta.url);
const env = readFileSync(new URL(".env.local", WEB), "utf8");
const g = (k) => (env.match(new RegExp("^" + k + "=(.*)$", "m")) || [])[1]?.trim().replace(/^["']|["']$/g, "");
process.env.ANTHROPIC_API_KEY = g("ANTHROPIC_API_KEY");
const { registerHooks } = await import("node:module");
registerHooks({ resolve(e,c,n){ if(e.startsWith(".")&&!/\.[a-z]+$/.test(e)){try{return n(`${e}.ts`,c)}catch{}} return n(e,c);} });
registerHooks({ resolve(e,c,n){ if(e.startsWith("@/")) return n(new URL(`src/${e.slice(2)}.ts`,WEB).href,c); return n(e,c);} });
const { gerarRoteiroRotina } = await import(new URL("src/lib/ludico/gerar.ts", WEB).href);

const CASOS = [
  {
    id: "A · dentista + princesas", tema: "Princesas", nome: "Dia do dentista", idade: 6,
    passos: ["Estou em casa","Coloco o sapato","Vou de carro até o dentista","Chego ao consultório","Espero minha vez","Entro na sala","Sento na cadeira","Abro a boca","O dentista olha meus dentes","Vou embora"],
    // O que NÃO pode aparecer no lugar do real.
    proibido: /carruagem|mago|feiticeir|castelo|trono|varinha|poção|reino encantado|fada/i,
    exige: /dentista/i,
  },
  {
    id: "B · dia + dinossauros", tema: "Dinossauros", nome: "Meu dia", idade: 5,
    passos: ["Café","Escola","Almoço","Brincar","Banho","Jantar","Dormir"],
    proibido: /\b\d{1,2}h\b|\d{1,2}:\d{2}/,
    exige: /escola/i,
  },
  {
    id: "C · transição + tema livre", tema: "fundo do mar", nome: "Hora de dormir", idade: 4,
    passos: ["Guardar brinquedos","Ir ao banheiro","Tomar banho","Colocar pijama","Ler história","Dormir"],
    proibido: /sereia mágica troca|castelo de coral no lugar/i,
    exige: /banho|pijama/i,
  },
];

const PROMETE = /vai ficar calm|não vai doer|vai ser rápid|vai adorar|não vai sentir/i;
const R = [];
for (const c of CASOS) {
  const r = await gerarRoteiroRotina({ tema: c.tema, atividades: c.passos, idade: c.idade, nomeRotina: c.nome });
  const nomes = r.cards.map((x) => x.nome_tematico);
  const cenas = r.cards.map((x) => x.cena).join(" ");
  const tudo = `${nomes.join(" ")} ${cenas}`;

  const mesmaQtd = r.cards.length === c.passos.length;
  const mesmaOrdem = r.cards.every((x, i) => x.atividade.trim() === c.passos[i]);
  const semFantasia = !c.proibido.test(tudo);
  const preservaReal = c.exige.test(tudo);
  const semPromessa = !PROMETE.test(r.historia);
  // A história não pode ser só a lista dos cards repetida.
  const repete = c.passos.filter((p) => r.historia.toLowerCase().includes(p.toLowerCase())).length;
  const naoRepete = repete < c.passos.length;

  const ok = mesmaQtd && mesmaOrdem && semFantasia && preservaReal && semPromessa && naoRepete;
  console.log(`\n${"█".repeat(70)}\n${c.id}  (tema: ${c.tema})\n${"█".repeat(70)}`);
  console.log("CARDS: " + nomes.join(" · "));
  console.log("\nHISTÓRIA:\n" + r.historia.slice(0, 700));
  console.log(`\n  ${ok ? "ok " : "FALHA"} qtd=${mesmaQtd} ordem=${mesmaOrdem} semFantasia=${semFantasia} preservaReal=${preservaReal} semPromessa=${semPromessa} naoRepeteCards=${naoRepete} (${repete}/${c.passos.length})`);
  R.push({ id: c.id, ok });
}
console.log("\n" + "═".repeat(70));
for (const r of R) console.log(`${r.ok ? "  ok " : "FALHA"}  ${r.id}`);
const f = R.filter((x) => !x.ok);
console.log(`\n${R.length - f.length}/${R.length}`);
if (f.length) process.exitCode = 1;
