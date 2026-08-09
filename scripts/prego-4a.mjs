/**
 * PRÉ-GO — três perguntas fechadas antes de liberar o piloto.
 *
 * (1) LATÊNCIA · 3 BPs contra 2, nos mesmos casos.
 * (2) PERSONALIZAÇÃO · o mesmo caso repetido, para separar falha estrutural de
 *     variação do modelo.
 * (3) INVENÇÃO · quantas vezes o cérebro vira sujeito de verbo de intenção.
 *
 * HIPÓTESE QUE ESTE SCRIPT TESTA: (1) e (2) podem ser o mesmo problema. No caso
 * "bate na irmã" as três BPs genéricas somam muito texto, e o Perfil pode estar
 * sendo afogado por volume. Se for isso, cortar para 2 melhora latência **e**
 * personalização de uma vez.
 *
 *   npx tsx scripts/prego-4a.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { BASE2 } from "../apps/web/src/lib/conducao/base2-conteudo.ts";
import { ANCORA_PERFIL, LICENCA_GENERATIVA } from "../apps/web/src/lib/conducao/composicao.ts";
import { ordenarPorAderencia } from "../apps/web/src/lib/conhecimento/aderencia.ts";

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

const NUCLEO = `Você é a Ayla, da Kolo Família. Conversa por escrito com a mãe ou o pai de uma criança atípica, na Web.
Você NÃO dá diagnóstico, não promete resultado e não fala como médica.
Você abre hipóteses para quem cuida observar — nunca afirma o que está acontecendo.
Escreve como quem conversa, não como quem faz relatório. Emoji com parcimônia, *negrito* como âncora.
Quando for perguntar, uma pergunta por vez.`;

/** O bloco de formatação do ramo de ENTREGA, copiado de `prompt.ts`. */
const FORMATO_WEB = `# Formatação (markdown)

A tela renderiza markdown de verdade: \`## título\`, \`**negrito**\`, listas com \`- \` ou \`1. \`, citação com \`> \` e divisória com \`---\`. Use o que ajudar a mãe a ENCONTRAR a informação — ela lê no celular, muitas vezes com pressa.

- **A estrutura nasce do raciocínio, não de um gabarito.** Não existe conjunto fixo de seções: uma resposta pode ter um título só ("Uma pista importante"), outra pode ter três ("O que pode estar acontecendo", "O que eu testaria hoje", "O que observar"), e outra nenhum. Escolha os títulos pelo que você está dizendo — "Estratégias" e "Considerações finais" não ajudam ninguém.
- **Negrito é âncora, não decoração.** Uma ideia-chave por bloco. Se tudo está em negrito, nada está.
- **A frase pronta pro adulto usar merece destaque** — é o que a mãe volta a procurar depois. Use \`> \` ou negrito, e escreva como alguém falaria de verdade em casa.
- **Lista quando forem passos ou opções paralelas**; parágrafo quando for raciocínio. Transformar explicação em bullets pica o sentido e faz perder o fio.
- **Nem tudo vira bloco.** Título seguido de dois parágrafos longos é relatório; quinze bloquinhos com emoji é post de rede social. O alvo é o meio.

Emoji com parcimônia, e só quando marcar uma passagem de assunto.`;

const CASO1 = {
  skill: "emocional",
  idade: 6,
  relato: "Meu filho bate na irmã quando é contrariado. Ontem ela pegou o brinquedo dele e ele partiu pra cima.",
  perfil: `Téo · 6 anos · menino · TEA nível 1
EMOCIONAL — gatilhos: parar algo que está gostando; errar. Sinais de que vem vindo: fica mais rápido, fala mais alto, anda de um lado pro outro. Como se manifesta: grita, joga o que está na mão, às vezes bate. O que ajuda a passar: ficar perto sem falar muito; luz baixa. O que NÃO ajuda: explicar na hora, perguntar por quê, aumentar o tom. Depois: fica muito cansado e quer colo.
INTERESSES — trens e metrô; sabe as estações da linha azul de cor; gosta de desenhar mapas.`,
  /** Os dados que uma boa resposta deveria conseguir usar. */
  marcadores: [
    ["sinais precoces", /mais r[aá]pid|fala mais alto|anda de um lado|andar de um lado|acelerad/i],
    ["o que ajuda", /perto sem falar|sem falar muito|luz baixa|menos palavra/i],
    ["o que piora", /explicar na hora|perguntar por qu|aumentar o tom|elevar a voz/i],
    ["interesse", /trem|metr[oô]|linha azul|mapa/i],
    ["depois", /cansad|colo/i],
  ],
};

const ok = (i, a, b) => (a == null || i >= a) && (b == null || i <= b);

function contexto(c, nBPs) {
  const partes = [NUCLEO];
  partes.push(`<o_que_ja_sabemos>\n${ANCORA_PERFIL}\n${c.perfil}\n</o_que_ja_sabemos>`);
  const b2 = BASE2.filter((s) => s.tema === c.skill && s.estado === "investigacao").slice(0, 3);
  partes.push(`<como_compreender_este_tema>
Material INTERNO de raciocínio — não repita nada disto para a família e não
transforme as bifurcações em questionário. Use para decidir O QUE ainda muda a
conduta, e faça no máximo UMA pergunta: a que separa os caminhos.
${b2.map((s) => `### ${s.titulo}\n${s.conteudo}`).join("\n\n")}
</como_compreender_este_tema>`);
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
  const bps = res.itens.slice(0, nBPs);
  if (bps.length) {
    partes.push(`<boas_praticas>
${bps.map((b) => `### ${b.titulo}\nQUANDO USAR: ${b.quando_usar ?? "-"}\n${b.versao_conversa ?? ""}`).join("\n\n")}
</boas_praticas>`);
  }
  partes.push(FORMATO_WEB);
  partes.push(LICENCA_GENERATIVA);
  return {
    texto: partes.join("\n\n---\n\n"),
    bps: bps.map((b) => `${res.aderencias.get(b.id)?.pontos ?? 0}pts ${b.titulo.slice(0, 40)}`),
  };
}

async function chamar(sistema, relato) {
  const t0 = Date.now();
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-5-20250929", max_tokens: 1200, system: sistema, messages: [{ role: "user", content: relato }] }),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  const j = await r.json();
  return { texto: j.content.map((c) => c.text ?? "").join(""), ms: Date.now() - t0, ent: j.usage.input_tokens };
}

/** O cérebro como SUJEITO de verbo de intenção — o padrão que escapou. */
const CEREBRO_SUJEITO =
  /\b(o )?c[ée]rebro (dela?|dele|d[oa] [A-Z]\w+)?\s*(est[aá]|t[aá]|vai|precisa|quer|pede|decide|diz|entende|aprende|sabe|manda|escolhe|interpreta|acha)/i;

const out = [];
const w = (s) => out.push(s);
const N = 5;

w("PRÉ-GO · 3 BPs contra 2, no caso que falhou em personalização\n");
w(`"${CASO1.relato}"\n`);

for (const nBPs of [3, 2]) {
  const ctx = contexto(CASO1, nBPs);
  w(`\n${"#".repeat(78)}\n${nBPs} BPs  ·  ${ctx.bps.join(" | ")}\n`);
  const ms = [];
  const ents = [];
  let comMarcador = 0;
  let comInvencao = 0;
  for (let i = 0; i < N; i++) {
    const r = await chamar(ctx.texto, CASO1.relato);
    ms.push(r.ms);
    ents.push(r.ent);
    const achados = CASO1.marcadores.filter(([, re]) => re.test(r.texto)).map(([n]) => n);
    const inventou = CEREBRO_SUJEITO.test(r.texto);
    if (achados.length) comMarcador++;
    if (inventou) comInvencao++;
    w(`  rodada ${i + 1}: ${r.ms}ms · ${r.ent}tok · ${r.texto.length}ch · perfil usado: ${achados.join(", ") || "NENHUM"}${inventou ? " · ⚠ INVENÇÃO" : ""}`);
    if (i === 0) w(`\n    ┌─ resposta da rodada 1\n${r.texto.split("\n").map((l) => `    │ ${l}`).join("\n")}\n    └─\n`);
  }
  const mediana = ms.slice().sort((a, b) => a - b)[Math.floor(N / 2)];
  w(`\n  → mediana ${mediana}ms · pior ${Math.max(...ms)}ms · entrada ${Math.round(ents.reduce((a, b) => a + b) / N)}tok`);
  w(`  → usou o Perfil em ${comMarcador}/${N} · inventou mecanismo em ${comInvencao}/${N}`);
}

writeFileSync("D:/Projetos/Kolo Família/prego.txt", out.join("\n"), "utf8");
console.log("pronto");
