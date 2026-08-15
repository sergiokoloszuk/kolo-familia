import { readFileSync } from "node:fs";
const RAIZ = "d:/Projetos/Kolo Família/apps/web";
const env = {};
for (const l of readFileSync(RAIZ + "/.env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const src = readFileSync(RAIZ + "/src/lib/ayla/eventos.ts", "utf8");
const i = src.indexOf("const SYSTEM = `");
const A = src.slice(src.indexOf("`", i) + 1, src.indexOf("`;", i))
  .replace('${TIPOS.join(" | ")}', "troca_professora | mudanca_escola | mudanca_turma | medicacao | inicio_terapia | ferias | perda_familiar | separacao | mudanca_rotina | marco | regressao | outro");
const F = "Ana";
const B = A + `\n\nDE QUEM É ESTE REGISTRO: a linha do tempo é de **${F}**, e só dela.
- Extraia apenas fatos cujo SUJEITO é ${F}. Um avanço, mudança, perda ou marco de OUTRA pessoa (irmão, primo, adulto) NÃO entra, mesmo que seja importante.
- Quem CONTOU o fato não importa: "meu marido disse que ${F} dormiu melhor" é fato de ${F}.
- Outra pessoa pode aparecer como circunstância. Se o fato relevante for a REAÇÃO de ${F}, isso é fato de ${F} e entra.
- Se a frase fala de ${F} E de outra pessoa, extraia só a parte de ${F}.
- Se o sujeito for ambíguo e você não conseguir decidir se é ${F}, devolva [].`;
const CASOS = [
  ["B", "O irmão dela, João, começou a andar sozinho essa semana.", []],
  ["F", "Meu marido disse que a Ana começou a dormir melhor.", []],
  ["G", "O João começou a falar frases e a Ana ainda usa palavras soltas.", []],
  ["C", "Ele começou a fazer isso sozinho.", ["Mãe: a Ana tem muita dificuldade de calçar o sapato"]],
];
async function ex(system, texto, ctx) {
  const uc = (ctx.length ? `<conversa_recente>\n${ctx.join("\n")}\n</conversa_recente>\n\n` : "") + `<mensagem_de_agora>\n${texto}\n</mensagem_de_agora>`;
  const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST",
    headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-haiku-4-5", max_tokens: 300, system, messages: [{ role: "user", content: uc }] }) });
  const j = await r.json(); if (!r.ok) return "ERRO";
  const t = j.content?.[0]?.text ?? ""; const m = t.match(/\[[\s\S]*\]/); if (!m) return "SEM_JSON";
  try { const arr = JSON.parse(m[0]); return arr.length ? arr.map(x => x.descricao).join(" ⏐ ") : "[]"; } catch { return "JSON_INVALIDO"; }
}
const N = 3;
for (const [rot, sys] of [["ATUAL", A], ["PROPOSTO", B]]) {
  console.log(`\n===== ${rot} (${N}x) =====`);
  for (const [id, texto, ctx] of CASOS) {
    const outs = []; for (let k = 0; k < N; k++) outs.push(await ex(sys, texto, ctx));
    const outra = outs.filter(o => /jo[ãa]o|irm[ãa]o/i.test(o)).length;
    const vazio = outs.filter(o => o === "[]").length;
    const quebrou = outs.filter(o => /INVALIDO|SEM_JSON|ERRO/.test(o)).length;
    console.log(`${id}: cita OUTRA pessoa ${outra}/${N} | vazio ${vazio}/${N} | quebrou ${quebrou}/${N}`);
    outs.forEach((o, k) => console.log(`    #${k + 1} ${o.slice(0, 95)}`));
  }
}
