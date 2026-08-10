/**
 * TTFT DA ESTRATÉGIAS WEB + as três provas da oferta de Plano.
 *
 * O bench anterior quebrava no `JSON.parse`: um chunk de rede pode terminar no
 * meio de uma linha `data: {...}`, e dividir chunk a chunk parte o JSON ao meio.
 * A correção é um buffer que só consome linhas COMPLETAS e guarda o resto para
 * o próximo chunk — que é o que qualquer leitor de SSE faz.
 *
 * O que importa medir aqui não é o tempo total: a web faz `messages.stream()`,
 * então a mãe começa a ler no PRIMEIRO token. Total interessa para custo; TTFT
 * interessa para a experiência.
 *
 *   npx tsx scripts/ttft-web.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { BASE2 } from "../apps/web/src/lib/conducao/base2-conteudo.ts";
import { ANCORA_PERFIL, LICENCA_GENERATIVA } from "../apps/web/src/lib/conducao/composicao.ts";
import { ordenarPorAderencia } from "../apps/web/src/lib/conhecimento/aderencia.ts";
import { MARCADOR_PLANO } from "../apps/web/src/lib/ia/marcadores.ts";

const env = Object.fromEntries(
  readFileSync("apps/web/.env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };
const todas = await (
  await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/boas_praticas?select=*`, { headers: { ...H, Range: "0-9999" } })
).json();

const BLOCO_DESAFIO = `# Esta mensagem traz um desafio do dia a dia

Ajude de verdade JÁ na conversa: traga 1 ideia prática e possível agora — não segure as ideias esperando o plano.
PLANO NÃO É FECHAMENTO PADRÃO DE CONVERSA BOA. Antes de oferecer, responda a si mesma: **transformar isto num plano acrescenta algo que esta conversa sozinha não entrega?** Se a resposta for não, não ofereça — e uma conversa que ajudou de verdade e terminou sem oferta é um bom resultado, não uma oportunidade perdida.
Ofereça quando: houver várias ações para organizar ao longo dos próximos dias; OU o caso precisar de continuidade, progressão e acompanhamento que uma resposta isolada não sustenta.
E QUANDO A FAMÍLIA PEDIR, o pedido basta — mesmo que você ainda precise perguntar o que o plano deve organizar, **ofereça o botão na mesma resposta**. Deixar a mãe pedir um plano e sair sem o botão é fazê-la pedir duas vezes.
Quando oferecer, diga o GANHO DAQUELE CASO, não o que o produto contém.
Aponte pro BOTÃO e, na ÚLTIMA linha, escreva exatamente o marcador ${MARCADOR_PLANO}. NUNCA termine sistematicamente com oferta de plano.
Não termine toda resposta com pergunta.`;

const FORMATO = `# Formatação (markdown)

A tela renderiza markdown de verdade: \`## título\`, \`**negrito**\`, listas, \`> \` e \`---\`.
- **A estrutura nasce do raciocínio, não de um gabarito.**
- **Negrito é âncora, não decoração.**
- **Nem tudo vira bloco.**`;

const NUCLEO = `Você é a Ayla, da Kolo Família. Conversa por escrito com a mãe ou o pai de uma criança atípica, na Web.
Sem diagnóstico, sem promessa de resultado. Hipóteses, não causas afirmadas.
Escreve como quem conversa. Uma pergunta por vez, quando for perguntar.`;

const CASOS = [
  {
    id: "A · pedido EXPLÍCITO de plano",
    esperado: "OFERECER",
    skill: "emocional", idade: 6,
    relato: "Você consegue me montar um plano pra essa semana?",
    perfil: "Téo · 6 anos · TEA 1. EMOCIONAL — sinais: fica mais rápido, fala mais alto. INTERESSES: trens e metrô.",
  },
  {
    id: "B · várias frentes, Plano AGREGA",
    esperado: "OFERECER",
    skill: "emocional", idade: 6,
    relato: "Ele explode no fim da tarde, briga com a irmã, não quer tomar banho e ainda tem a lição. Todo dia é uma guerra e eu não sei por onde começar.",
    perfil: "Téo · 6 anos · TEA 1. EMOCIONAL — sinais: fica mais rápido, fala mais alto. ROTINA — precisa saber o que vem depois. INTERESSES: trens e metrô.",
  },
  {
    id: "C · dúvida pontual, Plano NÃO agrega",
    esperado: "NÃO OFERECER",
    skill: "emocional", idade: 6,
    relato: "Ele pode dormir com a luz acesa?",
    perfil: "Téo · 6 anos · TEA 1. SONO — dorme com a mãe junto.",
  },
];

const ok = (i, a, b) => (a == null || i >= a) && (b == null || i <= b);

/**
 * SSE com buffer entre chunks — a correção desta missão.
 *
 * `r.body` entrega pedaços de rede, não linhas. Um `data: {...}` pode chegar
 * partido em dois chunks; consumir chunk a chunk quebra o JSON no meio.
 */
async function chamarStream(sistema, relato) {
  const t0 = Date.now();
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1200,
      system: sistema,
      stream: true,
      messages: [{ role: "user", content: relato }],
    }),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);

  const dec = new TextDecoder();
  let buffer = "";
  let texto = "";
  let ttft = null;
  let ent = 0;

  for await (const chunk of r.body) {
    buffer += dec.decode(chunk, { stream: true });
    // Só consome o que estiver COMPLETO; o resto fica para o próximo chunk.
    let quebra;
    while ((quebra = buffer.indexOf("\n")) !== -1) {
      const linha = buffer.slice(0, quebra).trim();
      buffer = buffer.slice(quebra + 1);
      if (!linha.startsWith("data: ")) continue;
      const corpo = linha.slice(6);
      if (corpo === "[DONE]") continue;
      let ev;
      try {
        ev = JSON.parse(corpo);
      } catch {
        continue; // linha malformada não derruba a medição
      }
      if (ev.type === "message_start") ent = ev.message?.usage?.input_tokens ?? 0;
      if (ev.type === "content_block_delta" && ev.delta?.text) {
        if (ttft === null) ttft = Date.now() - t0;
        texto += ev.delta.text;
      }
    }
  }
  return { texto, total: Date.now() - t0, ttft: ttft ?? 0, ent };
}

function contexto(c) {
  const b2 = BASE2.filter((s) => s.tema === c.skill && s.estado === "investigacao").slice(0, 3);
  const eleg = todas.filter(
    (b) =>
      (b.skills_relacionadas ?? []).includes(c.skill) &&
      (b.status === "ativo" || b.status === "rascunho") &&
      ok(c.idade, b.faixa_etaria_min, b.faixa_etaria_max),
  );
  const res = ordenarPorAderencia(
    eleg.slice().sort((a, b) => (b.peso_relevancia ?? 0) - (a.peso_relevancia ?? 0)),
    c.relato,
  );
  const bps = res.itens.slice(0, 2);
  return [
    NUCLEO,
    `<o_que_ja_sabemos>\n${ANCORA_PERFIL}\n${c.perfil}\n</o_que_ja_sabemos>`,
    `<como_compreender_este_tema>\nMaterial INTERNO — não repita e não vire questionário. Faça no máximo UMA pergunta.\n${b2.map((s) => `### ${s.titulo}\n${s.conteudo}`).join("\n\n")}\n</como_compreender_este_tema>`,
    bps.length ? `<boas_praticas>\n${bps.map((b) => `### ${b.titulo}\n${b.versao_conversa ?? ""}`).join("\n\n")}\n</boas_praticas>` : "",
    BLOCO_DESAFIO,
    FORMATO,
    LICENCA_GENERATIVA,
  ].filter(Boolean).join("\n\n---\n\n");
}

const out = [];
const w = (s) => out.push(s);
const ttfts = [];
const totais = [];

for (const c of CASOS) {
  const sistema = contexto(c);
  w(`\n${"█".repeat(78)}\n${c.id}`);
  w(`"${c.relato}"\nesperado: ${c.esperado}\n`);
  let ofertas = 0;
  const N = 4;
  for (let i = 0; i < N; i++) {
    const r = await chamarStream(sistema, c.relato);
    ttfts.push(r.ttft);
    totais.push(r.total);
    const ofereceu = r.texto.includes(MARCADOR_PLANO);
    if (ofereceu) ofertas++;
    w(`  rodada ${i + 1}: TTFT ${r.ttft}ms · total ${r.total}ms · ${r.ent}tok · ${r.texto.length}ch · ${ofereceu ? "OFERECEU" : "não ofereceu"}`);
    if (i === 0) w(`\n    ┌─ rodada 1\n${r.texto.split("\n").map((l) => `    │ ${l}`).join("\n")}\n    └─\n`);
  }
  const acertou = c.esperado === "OFERECER" ? ofertas === N : ofertas === 0;
  w(`  → ofertas ${ofertas}/${N} · ${acertou ? "PASS" : "FAIL"}`);
}

const p = (a, q) => a.slice().sort((x, y) => x - y)[Math.floor(a.length * q)];
w(`\n\n${"#".repeat(78)}`);
w(`TTFT  (o que a mãe espera pra começar a ler) · mediana ${p(ttfts, 0.5)}ms · p90 ${p(ttfts, 0.9)}ms · pior ${Math.max(...ttfts)}ms`);
w(`TOTAL (geração inteira)                      · mediana ${p(totais, 0.5)}ms · pior ${Math.max(...totais)}ms`);
w(`amostra: ${ttfts.length} execuções`);

writeFileSync("D:/Projetos/Kolo Família/ttft.txt", out.join("\n"), "utf8");
console.log("pronto");
