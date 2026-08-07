/**
 * BANCADA DO REPERTÓRIO — o conteúdo chega, e chega CERTO?
 *
 * NÃO TOCA FAMÍLIA REAL. Lê o acervo (inclusive rascunhos, via `statusAceitos`),
 * roda o classificador de produção e o recuperador de produção, e mede o que o
 * modelo receberia. Não gera resposta: primeiro se prova o INGREDIENTE.
 *
 *   node scripts/bancada/repertorio/rodar.mjs
 *   node scripts/bancada/repertorio/rodar.mjs --so foco
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "../../..");
const WEB = resolve(RAIZ, "apps/web");
const envPath = resolve(WEB, ".env.local");
if (existsSync(envPath)) {
  for (const l of readFileSync(envPath, "utf8").split("\n")) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { registerHooks } = await import("node:module");
registerHooks({
  resolve(e, c, n) {
    if (e.startsWith("@/")) return n(new URL("file:///" + WEB + "/src/" + e.slice(2) + ".ts"), c);
    const dentro = String(c?.parentURL ?? "").includes("/apps/web/src/");
    if (dentro && e.startsWith(".") && !/\.[a-z]+$/.test(e)) return n(e + ".ts", c);
    return n(e, c);
  },
});
const { classificarIntencao } = await import("file:///" + WEB + "/src/lib/ayla/intent.ts");
const { recuperarBoasPraticas, blocoBoasPraticas } = await import(
  "file:///" + WEB + "/src/lib/conhecimento/recuperar.ts"
);

const { data: rows } = await sb
  .from("specialist_prompt_templates")
  .select("name, routing_keywords, ativo")
  .neq("name", "comportamento_e_limites");
const catalogo = rows.map((r) => ({ name: r.name, routing_keywords: r.routing_keywords ?? [] }));

// Depois da publicação (06/08/2026), a bancada roda no MESMO status que a
// produção: se algo passar a faltar, falta pra família também.
const STATUS = ["ativo"];

const CASOS = [
  ["foco", 7, "Quando desenha ou mexe em alguma coisa ele fica um tempão, mas na tarefa levanta toda hora."],
  ["foco", 8, "Ele levanta toda hora, não consegue ficar sentado."],
  ["foco", 7, "Ele começa e depois esquece o que estava fazendo."],
  ["foco", 6, "Ele só presta atenção se estiver mexendo em alguma coisa com as mãos."],
  ["aprendizado", 6, "Ele copia do quadro sem problema, mas escrever sozinho ele não consegue."],
  ["aprendizado", 6, "Só escreve se eu for falando letra por letra."],
  ["aprendizado", 7, "Ele reconhece a letra quando vê, mas na hora de escrever não lembra qual usar."],
  ["aprendizado", 8, "Ele não consegue fazer as contas, se perde no meio."],
  ["autonomia", 5, "Ele sabe se vestir, mas fica esperando eu fazer."],
  ["autonomia", 6, "Ele faz tudo sozinho menos a camiseta."],
  ["autonomia", 5, "Se eu não falar cada passo ele não escova os dentes."],
  ["socializacao", 5, "Ele quer brincar com as outras crianças, mas não sabe como chegar."],
  ["socializacao", 7, "Ele brinca junto, mas tudo tem que ser do jeito dele."],
  ["socializacao", 6, "Ele fica muito bravo quando perde no jogo."],
  ["socializacao", 6, "Ele entra na brincadeira mas sai logo depois."],
  ["nutricional", 4, "Ele só aceita comida sequinha e crocante."],
  ["nutricional", 5, "Ele olha a comida nova e já empurra o prato."],
  ["nutricional", 6, "Só come de uma marca, se eu troco ele percebe."],
  ["nutricional", 4, "Ele já deixa no prato, mas não encosta a boca."],
  ["motor", 6, "Ele aperta demais o lápis, quase fura o papel."],
  ["motor", 6, "Ele corta tudo fora da linha."],
  ["motor", 7, "Ele não consegue fechar o zíper do casaco."],
  ["imitacao", 3, "Ele repete tudo do desenho, mas se eu faço ele não copia."],
  ["imitacao", 3, "Ele imita o irmão sozinho, mas se eu peço não faz."],
  ["imitacao", 2, "Quando eu falo 'faz igual' ele nem olha."],
  ["sensorial", 5, "Ela tapa os ouvidos quando ligo o liquidificador."],
  ["sensorial", 6, "Ele vive se jogando no sofá e apertando a gente."],
  ["sensorial", 7, "Depois de festa ele desaba, fica desregulado."],
  ["sensorial", 6, "Ele não percebe que está com fome até passar mal."],
];

const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const filtro = arg("--so");

let comSkill = 0, comBP = 0, comPassos = 0, acertoSkill = 0, total = 0;
const tamanhos = [];

console.log("esperada      skill obtida        BPs  passos  bloco   situação");
for (const [esp, idade, frase] of CASOS) {
  if (filtro && esp !== filtro) continue;
  total++;
  const t = await classificarIntencao({ texto: frase, catalogoSkills: catalogo });
  const bps = await recuperarBoasPraticas({
    supabase: sb, skills: t.skills, idade, statusAceitos: STATUS,
  });
  const bloco = blocoBoasPraticas(bps);
  const passos = bps.filter((b) => b.passos_praticos.length > 0).length;
  if (t.skills.length) comSkill++;
  if (t.skills[0] === esp) acertoSkill++;
  if (bps.length) comBP++;
  if (passos) comPassos++;
  if (bloco) tamanhos.push(bloco.length);
  console.log(
    `${(t.skills[0] === esp ? "✓" : "✗")} ${esp.padEnd(12)} ${(t.skills.join("+") || "—").padEnd(19)} ${String(bps.length).padStart(3)}  ${String(passos).padStart(6)}  ${String(bloco.length).padStart(5)}   ${frase.slice(0, 46)}`,
  );
}

console.log("\n── RESUMO ──");
console.log(`casos ..................... ${total}`);
console.log(`skill correta ............. ${acertoSkill}/${total} (${Math.round(acertoSkill / total * 100)}%)`);
console.log(`com alguma skill .......... ${comSkill}/${total}`);
console.log(`com BP recuperada ......... ${comBP}/${total}`);
console.log(`com passos_praticos ....... ${comPassos}/${total}`);
if (tamanhos.length) {
  const med = Math.round(tamanhos.reduce((a, b) => a + b, 0) / tamanhos.length);
  console.log(`bloco: média ${med} chars ≈ ${Math.round(med / 3)} tokens · máx ${Math.max(...tamanhos)} chars ≈ ${Math.round(Math.max(...tamanhos) / 3)} tokens`);
}
