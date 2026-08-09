/**
 * GATE DA ESTRATÉGIAS WEB — as três últimas provas.
 *
 * (1) OFERTA DE PLANO · quantos dos casos recebem oferta, e por quê.
 * (2) FORMATAÇÃO · a liberdade nova de markdown aparece de verdade na saída?
 * (3) LATÊNCIA com 2 BPs.
 *
 * Usa os blocos reais de `prompt.ts` e `composicao.ts`. Perfis sintéticos.
 *
 *   npx tsx scripts/gate-estrategias.mjs
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

/** O bloco de desafio, com a regra de oferta já corrigida. */
const BLOCO_DESAFIO = `# Esta mensagem traz um desafio do dia a dia

Ajude de verdade JÁ na conversa: traga 1 ideia prática e possível agora — não segure as ideias esperando o plano.
PLANO NÃO É FECHAMENTO PADRÃO DE CONVERSA BOA. Antes de oferecer, responda a si mesma: **transformar isto num plano acrescenta algo que esta conversa sozinha não entrega?** Se a resposta for não, não ofereça — e uma conversa que ajudou de verdade e terminou sem oferta é um bom resultado, não uma oportunidade perdida.
Ofereça quando: houver várias ações para organizar ao longo dos próximos dias; OU o caso precisar de continuidade, progressão e acompanhamento que uma resposta isolada não sustenta.
E QUANDO A FAMÍLIA PEDIR, o pedido basta — mesmo que você ainda precise perguntar o que o plano deve organizar, **ofereça o botão na mesma resposta**. Deixar a mãe pedir um plano e sair sem o botão é fazê-la pedir duas vezes.
Quando oferecer, diga o GANHO DAQUELE CASO, não o que o produto contém.
Aponte pro BOTÃO e, na ÚLTIMA linha, escreva exatamente o marcador ${MARCADOR_PLANO}. NUNCA termine sistematicamente com oferta de plano.
Não termine toda resposta com pergunta.`;

const FORMATO = `# Formatação (markdown)

A tela renderiza markdown de verdade: \`## título\`, \`**negrito**\`, listas com \`- \` ou \`1. \`, citação com \`> \` e divisória com \`---\`. Use o que ajudar a mãe a ENCONTRAR a informação — ela lê no celular, muitas vezes com pressa.

- **A estrutura nasce do raciocínio, não de um gabarito.** Não existe conjunto fixo de seções. Escolha os títulos pelo que você está dizendo — "Estratégias" e "Considerações finais" não ajudam ninguém.
- **Negrito é âncora, não decoração.** Uma ideia-chave por bloco.
- **A frase pronta pro adulto usar merece destaque** — use \`> \` ou negrito, e escreva como alguém falaria em casa.
- **Lista quando forem passos ou opções paralelas**; parágrafo quando for raciocínio.
- **Nem tudo vira bloco.** Título com dois parágrafos longos é relatório; quinze bloquinhos é post de rede social.`;

const NUCLEO = `Você é a Ayla, da Kolo Família. Conversa por escrito com a mãe ou o pai de uma criança atípica, na Web.
Sem diagnóstico, sem promessa de resultado. Hipóteses, não causas afirmadas.
Escreve como quem conversa. Uma pergunta por vez, quando for perguntar.`;

const CASOS = [
  { id: "curta · dúvida pontual", skill: "emocional", idade: 6, relato: "Ele pode dormir com a luz acesa?", perfil: "Téo · 6 anos · TEA 1. SONO — dorme com a mãe junto." },
  { id: "média · uma frente", skill: "emocional", idade: 6, relato: "Meu filho bate na irmã quando é contrariado.", perfil: "Téo · 6 anos · TEA 1. EMOCIONAL — sinais: fica mais rápido, fala mais alto. O que ajuda: ficar perto sem falar muito. INTERESSES: trens e metrô." },
  { id: "rica · várias frentes", skill: "emocional", idade: 6, relato: "Ele explode no fim da tarde, briga com a irmã, não quer tomar banho e ainda tem a lição pra fazer. Todo dia é uma guerra e eu não sei por onde começar.", perfil: "Téo · 6 anos · TEA 1. EMOCIONAL — sinais: fica mais rápido, fala mais alto. ROTINA — precisa saber o que vem depois. INTERESSES: trens e metrô, sabe as estações da linha azul." },
  { id: "atividade · leitura", skill: "aprendizado", idade: 7, relato: "Ele junta as sílabas mas perde a palavra inteira. Queria uma forma de treinar isso em casa.", perfil: "Bento · 7 anos. APRENDIZADO — decodifica sílaba a sílaba. INTERESSES: dinossauros, sabe nomes difíceis de cor." },
  { id: "brincadeira · pedido explícito", skill: "emocional", idade: 6, relato: "Queria uma brincadeira pra ajudar ele a perceber quando está começando a ficar bravo.", perfil: "Téo · 6 anos · TEA 1. EMOCIONAL — sinais: fica mais rápido, fala mais alto, anda de um lado pro outro. INTERESSES: trens e metrô." },
  { id: "pedido de plano", skill: "emocional", idade: 6, relato: "Você consegue me montar um plano pra essa semana?", perfil: "Téo · 6 anos · TEA 1. EMOCIONAL — sinais: fica mais rápido." },
];

const ok = (i, a, b) => (a == null || i >= a) && (b == null || i <= b);

/** STREAMING, como a web faz — o que importa para a mãe é o TTFT. */
async function chamar(sistema, relato) {
  const t0 = Date.now();
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-5-20250929", max_tokens: 1200, system: sistema, stream: true, messages: [{ role: "user", content: relato }] }),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  let texto = "", ttft = null, ent = 0;
  const dec = new TextDecoder();
  for await (const chunk of r.body) {
    for (const linha of dec.decode(chunk).split("\n")) {
      if (!linha.startsWith("data: ")) continue;
      const ev = JSON.parse(linha.slice(6));
      if (ev.type === "message_start") ent = ev.message.usage.input_tokens;
      if (ev.type === "content_block_delta" && ev.delta?.text) {
        if (ttft === null) ttft = Date.now() - t0;
        texto += ev.delta.text;
      }
    }
  }
  return { texto, ms: Date.now() - t0, ttft: ttft ?? 0, ent };
}

const out = [];
const w = (s) => out.push(s);
const ms = [];
const ttfts = [];

for (const c of CASOS) {
  const b2 = BASE2.filter((s) => s.tema === c.skill && s.estado === "investigacao").slice(0, 3);
  const eleg = todas.filter(
    (b) =>
      (b.skills_relacionadas ?? []).includes(c.skill) &&
      (b.status === "ativo" || b.status === "rascunho") &&
      ok(c.idade, b.faixa_etaria_min, b.faixa_etaria_max),
  );
  const res = ordenarPorAderencia(eleg.slice().sort((a, b) => (b.peso_relevancia ?? 0) - (a.peso_relevancia ?? 0)), c.relato);
  const bps = res.itens.slice(0, 2); // 2 BPs, como o piloto

  const sistema = [
    NUCLEO,
    `<o_que_ja_sabemos>\n${ANCORA_PERFIL}\n${c.perfil}\n</o_que_ja_sabemos>`,
    `<como_compreender_este_tema>\nMaterial INTERNO — não repita e não vire questionário. Faça no máximo UMA pergunta.\n${b2.map((s) => `### ${s.titulo}\n${s.conteudo}`).join("\n\n")}\n</como_compreender_este_tema>`,
    bps.length ? `<boas_praticas>\n${bps.map((b) => `### ${b.titulo}\n${b.versao_conversa ?? ""}`).join("\n\n")}\n</boas_praticas>` : "",
    BLOCO_DESAFIO,
    FORMATO,
    LICENCA_GENERATIVA,
  ].filter(Boolean).join("\n\n---\n\n");

  const r = await chamar(sistema, c.relato);
  ms.push(r.ms); ttfts.push(r.ttft);
  const ofereceu = r.texto.includes(MARCADOR_PLANO);
  const md = {
    titulo: (r.texto.match(/^#{1,4}\s/gm) ?? []).length,
    negrito: (r.texto.match(/\*\*[^*]+\*\*/g) ?? []).length,
    lista: (r.texto.match(/^[-*]\s|^\d+\.\s/gm) ?? []).length,
    citacao: (r.texto.match(/^>\s/gm) ?? []).length,
  };
  w(`\n${"█".repeat(78)}\n${c.id}`);
  w(`"${c.relato}"`);
  w(`\n${r.ms}ms · ${r.ent}tok · ${r.texto.length}ch · PLANO: ${ofereceu ? "OFERECEU" : "não ofereceu"}`);
  w(`MARKDOWN: ${md.titulo} títulos · ${md.negrito} negritos · ${md.lista} itens de lista · ${md.citacao} citações\n`);
  w(r.texto);
}

const ord = ms.slice().sort((a, b) => a - b);
w(`\n\n${"#".repeat(78)}\nLATÊNCIA · p50 ${ord[Math.floor(ord.length / 2)]}ms · p90 ${ord[Math.floor(ord.length * 0.9)]}ms · pior ${Math.max(...ms)}ms`);

writeFileSync("D:/Projetos/Kolo Família/gate.txt", out.join("\n"), "utf8");
console.log("pronto");
