/**
 * AUDITORIA DA ENTREGA — duas perguntas que podem bloquear o piloto.
 *
 * (1) A Ayla distingue ESTRATÉGIA de ATIVIDADE de BRINCADEIRA, ou produz a
 *     mesma orientação com três títulos?
 * (2) Ela oferece Plano mecanicamente?
 *
 * Nenhuma família real. Perfis sintéticos.
 *
 *   npx tsx scripts/aud-entrega.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { ANCORA_PERFIL, LICENCA_GENERATIVA } from "../apps/web/src/lib/conducao/composicao.ts";

const env = Object.fromEntries(
  readFileSync("apps/web/.env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const BASE = `Você é a Ayla, da Kolo Família. Conversa por escrito com quem cuida de uma criança atípica.
Sem diagnóstico, sem promessa de resultado. Hipóteses, não causas afirmadas.`;

const CASOS = [
  {
    id: "leitura",
    desafio: "criança de 7 anos junta as sílabas mas perde a palavra inteira ao falar",
    perfil: "Bento · 7 anos · decodifica sílaba a sílaba; perde a palavra ao juntar. INTERESSES: dinossauros, sabe nomes difíceis de cor.",
  },
  {
    id: "iniciar-licao",
    desafio: "criança de 8 anos não começa a lição de matemática, fica olhando pra folha",
    perfil: "Nina · 8 anos · TDAH. Sustenta atenção longa no que interessa. Trava para começar tarefa escolar. INTERESSES: Lego, espaço, planetas.",
  },
  {
    id: "sinais-precoces",
    desafio: "criança de 6 anos explode e a mãe só percebe quando já está no auge",
    perfil: "Téo · 6 anos · TEA 1. Sinais: fica mais rápido, fala mais alto, anda de um lado pro outro. INTERESSES: trens e metrô, sabe as estações da linha azul.",
  },
];

const PEDIDOS = [
  ["A · ESTRATÉGIA", "Dê UMA estratégia. Estratégia é mudança na atuação do adulto, no ambiente, na comunicação ou na organização da tarefa — não é uma atividade nem uma brincadeira. Máximo 6 linhas."],
  ["B · ATIVIDADE", "Dê UMA atividade. Atividade é uma prática estruturada, feita com uma finalidade clara, para treinar a habilidade que está difícil. Não precisa ser lúdica nem ter nome fantasioso. Máximo 6 linhas."],
  ["C · BRINCADEIRA", "Dê UMA brincadeira. Brincadeira é experiência genuinamente lúdica — jogo, missão, faz de conta, descoberta, desafio, narrativa, personagem. Use o interesse da criança como ponte, com nome, como brincar e o que ela treina. Máximo 8 linhas."],
];

async function chamar(sistema, pedido) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-5-20250929", max_tokens: 600, system: sistema, messages: [{ role: "user", content: pedido }] }),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return (await r.json()).content.map((c) => c.text ?? "").join("");
}

const out = [];
const w = (s) => out.push(s);
w("AUDITORIA · ESTRATÉGIA × ATIVIDADE × BRINCADEIRA\n");

for (const c of CASOS) {
  w(`\n${"█".repeat(78)}\nDESAFIO: ${c.desafio}\nPERFIL: ${c.perfil}`);
  const sistema = `${BASE}\n\n---\n\n<o_que_ja_sabemos>\n${ANCORA_PERFIL}\n${c.perfil}\n</o_que_ja_sabemos>\n\n---\n\n${LICENCA_GENERATIVA}`;
  const respostas = [];
  for (const [rot, instrucao] of PEDIDOS) {
    const t = await chamar(sistema, `Desafio: ${c.desafio}\n\n${instrucao}`);
    respostas.push(t);
    w(`\n${"─".repeat(78)}\n${rot}\n\n${t}`);
  }
  // sobreposição grosseira: quantas palavras de conteúdo as três compartilham
  const conj = respostas.map((t) =>
    new Set(
      t.toLowerCase().replace(/[^a-záàâãéêíóôõúç\s]/g, " ").split(/\s+/)
        .filter((p) => p.length > 5),
    ),
  );
  const inter = [...conj[0]].filter((p) => conj[1].has(p) && conj[2].has(p));
  w(`\n  → palavras de conteúdo comuns às três: ${inter.length}  (${inter.slice(0, 10).join(", ")})`);
}

writeFileSync("D:/Projetos/Kolo Família/aud-entrega.txt", out.join("\n"), "utf8");
console.log("pronto");
