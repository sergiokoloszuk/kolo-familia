/**
 * FASE 3E · duas medições que decidem se vale escrever os 42.
 *
 * (1) SEQUESTRO — quais boas práticas antigas sobem no top-3 de MUITOS
 *     subproblemas diferentes. Uma BP que vence em oito casos distintos não é
 *     versátil: é genérica o bastante para caber em qualquer lugar, e é ela que
 *     empurra o conteúdo específico para fora.
 *
 * (2) A CAUSA DA DILUIÇÃO — o caso "bate na irmã" ficou PIOR com BASE 3. Quatro
 *     hipóteses concorrem: o conteúdo antigo é genérico · a composição do prompt
 *     deixa o repertório dominar · falta instrução de ancorar no Perfil · falta
 *     licença generativa. As condições abaixo separam as quatro.
 *
 * Perfil sintético, nenhuma família real, nada enviado a ninguém.
 *
 *   npx tsx scripts/ablacao-3e.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { BASE2 } from "../apps/web/src/lib/conducao/base2-conteudo.ts";
import { ordenarPorAderencia, PISO_ADERENCIA } from "../apps/web/src/lib/conhecimento/aderencia.ts";

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

const out = [];
const w = (s) => out.push(s);
const ok = (i, a, b) => (a == null || i >= a) && (b == null || i <= b);

// ══════════════════════════════════════════════════════════════════════════
// (1) SEQUESTRO
// ══════════════════════════════════════════════════════════════════════════
const SUBS = [
  ["emocional", "quando eu digo não ou quando acaba o que ela queria, ela grita e bate", 5],
  ["emocional", "minha filha bate na irmã quando é contrariada", 5],
  ["emocional", "ele explode por qualquer coisa no fim da tarde, principalmente depois da escola", 6],
  ["emocional", "quando eu percebo já é tarde, ele já está no auge e não adianta falar nada", 6],
  ["emocional", "quando a tarefa fica difícil ele grita e joga o caderno", 7],
  ["emocional", "ela chora muito e se fecha, não explode, some pro quarto", 8],
  ["rotina", "ele não larga o tablet pra ir tomar banho, aviso várias vezes e continua brincando", 6],
  ["rotina", "a brincadeira já acabou e ele fica parado sem começar a lição", 7],
  ["rotina", "quando muda alguma coisa do combinado ele fica muito bravo e chora", 7],
  ["sensorial", "na festa ele começa bem e depois de um tempo tapa os ouvidos e quer ir embora", 6],
  ["sensorial", "ele grita quando eu lavo o cabelo dele e não deixa cortar a unha", 5],
  ["sensorial", "ela só aceita usar a mesma roupa, reclama da costura e da etiqueta", 6],
  ["comunicacao", "ele me puxa pela mão pra pegar as coisas mas quase não pede sozinho", 4],
  ["comunicacao", "eu peço pega o sapato e ele só faz se eu apontar", 4],
  ["comunicacao", "ele repete tudo o que a gente fala e às vezes repete falas de desenho", 5],
  ["sono", "eu fico deitada com ele até pegar no sono, se eu saio ele levanta", 8],
  ["sono", "ele diz que está com medo do escuro na hora de dormir", 8],
  ["sono", "pede água, pede xixi, sempre mais uma coisa antes de dormir", 6],
];

const vitorias = new Map();
for (const [skill, relato, idade] of SUBS) {
  const eleg = todas.filter(
    (b) => (b.skills_relacionadas ?? []).includes(skill) && b.status === "ativo" && ok(idade, b.faixa_etaria_min, b.faixa_etaria_max),
  );
  const res = ordenarPorAderencia(eleg, relato);
  for (const b of res.itens.slice(0, 3)) {
    if ((res.aderencias.get(b.id)?.pontos ?? 0) < PISO_ADERENCIA) continue;
    const v = vitorias.get(b.id) ?? { titulo: b.titulo, n: 0, temas: new Set(), pts: [] };
    v.n++;
    v.temas.add(skill);
    v.pts.push(res.aderencias.get(b.id).pontos);
    vitorias.set(b.id, v);
  }
}

w("#".repeat(78));
w("(1) SEQUESTRO — quem sobe no top-3 de mais de um subproblema\n");
w("Uma BP que vence em muitos casos diferentes nao e versatil: e generica o");
w("bastante pra caber em qualquer lugar, e empurra o especifico pra fora.\n");
w(`  ${SUBS.length} subproblemas medidos, 5 temas\n`);
const rank = [...vitorias.values()].sort((a, b) => b.n - a.n);
for (const v of rank.filter((v) => v.n >= 2)) {
  w(`  ${String(v.n).padStart(2)}x  temas=${[...v.temas].join(",").padEnd(34)} pts ${v.pts.join("/")}`);
  w(`      ${v.titulo.slice(0, 70)}`);
}
w(`\n  (${rank.filter((v) => v.n === 1).length} BPs venceram em exatamente 1 subproblema — essas sao especificas)`);

// ══════════════════════════════════════════════════════════════════════════
// (2) A CAUSA DA DILUIÇÃO
// ══════════════════════════════════════════════════════════════════════════
const PERFIL = `PERFIL DA CRIANÇA (o que já sabemos)
Nome: Téo · 6 anos · menino · TEA nível 1

EMOCIONAL
- Gatilhos: quando precisa parar algo que está gostando; quando erra alguma coisa
- Sinais de que vem vindo: fica mais rápido, fala mais alto, começa a andar de um lado pro outro
- Como se manifesta: grita, joga o que está na mão, às vezes bate
- O que ajuda a passar: ficar perto sem falar muito; luz baixa
- O que NÃO ajuda / piora: explicar na hora, perguntar por quê, aumentar o tom
- Depois: fica muito cansado e quer colo

INTERESSES
- Trens e metrô. Sabe as estações da linha azul de cor. Gosta de desenhar mapas`;

const NUCLEO = `Você é a Ayla, da Kolo Família. Conversa por escrito com a mãe ou o pai de uma criança atípica.
Responda como quem conversa, não como quem escreve relatório. Sem diagnóstico. Sem prometer resultado.
Pode usar emoji com parcimônia e *negrito* como âncora. Uma pergunta por vez, quando for perguntar.`;

const ANCORA = `
O PERFIL É ÂNCORA. Ele é o que sabemos DESTA criança e tem precedência sobre qualquer orientação geral.
NÃO descarte informação específica do Perfil em favor de orientação genérica: se o Perfil já diz quais são
os sinais, os gatilhos ou o que ajuda esta criança, use ESSES — não pergunte de novo nem substitua por
recomendação padrão. O repertório abaixo é subsidiário: serve quando acrescenta ao que já sabemos.`;

const LICENCA = `
AS BASES SÃO LASTRO, NÃO TEXTO PARA COPIAR. Raciocine sobre o repertório e crie a melhor intervenção para
ESTA criança. Pode combinar práticas, adaptar ao Perfil, transformar orientação em aplicação concreta,
criar frase, atividade, nome e próximo passo. Use o interesse da criança para CRIAR — como ponte para a
experiência, nunca como prêmio por obediência.
Não invente como fato: mecanismo cerebral, evidência, diagnóstico, dado da criança que não foi informado
ou eficácia garantida. Dose: uma leitura curta, uma orientação, um ou dois recursos.`;

const base2 = BASE2.filter((s) => s.tema === "emocional" && s.estado === "investigacao")
  .slice(0, 4)
  .map((s) => `### ${s.titulo}\n${s.conteudo}`)
  .join("\n\n");

function base3(relato, quais, n = 3) {
  const eleg = todas.filter(
    (b) =>
      (b.skills_relacionadas ?? []).includes("emocional") &&
      (quais === "antiga" ? b.status === "ativo" : quais === "nova" ? b.status === "rascunho" : true) &&
      ok(6, b.faixa_etaria_min, b.faixa_etaria_max),
  );
  const res = ordenarPorAderencia(eleg, relato);
  const top = res.itens.filter((b) => (res.aderencias.get(b.id)?.pontos ?? 0) >= PISO_ADERENCIA).slice(0, n);
  return {
    txt: top.map((b) => `### ${b.titulo}\nQUANDO USAR: ${b.quando_usar}\n${b.versao_conversa}`).join("\n\n"),
    ids: top.map((b) => `${res.aderencias.get(b.id).pontos}pts ${b.titulo.slice(0, 40)}`),
  };
}

async function chamar(sistema, relato) {
  const t0 = Date.now();
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 900,
      system: sistema,
      messages: [{ role: "user", content: relato }],
    }),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  const j = await r.json();
  return { texto: j.content.map((c) => c.text ?? "").join(""), ms: Date.now() - t0, ent: j.usage.input_tokens };
}

const CASOS = [
  ["bate na irmã (o caso que PIOROU)", "Meu filho bate na irmã quando é contrariado. Ontem ela pegou o brinquedo dele e ele partiu pra cima."],
  ["sobrecarga", "Ele explode por qualquer coisa no fim da tarde, principalmente depois da escola. Hoje foi porque a meia estava do lado errado."],
  ["chora e se fecha", "Ela não explode, ela chora muito e some pro quarto. Fica lá sozinha e não deixa eu entrar."],
];

for (const [nome, relato] of CASOS) {
  const antiga = base3(relato, "antiga");
  const nova = base3(relato, "nova");
  w(`\n\n${"█".repeat(78)}\nCASO: ${nome}\n"${relato}"`);
  w(`\n  BASE 3 ANTIGA: ${antiga.ids.join(" | ") || "nada"}`);
  w(`  BASE 3 NOVA:   ${nova.ids.join(" | ") || "nada"}`);

  const CONDS = [
    ["C  · Perfil + BASE 2", [PERFIL, `COMO COMPREENDER (interno):\n${base2}`]],
    ["D1 · + BASE 3 antiga", [PERFIL, `COMO COMPREENDER (interno):\n${base2}`, antiga.txt && `REPERTÓRIO (interno):\n${antiga.txt}`]],
    ["D1a· + BASE 3 antiga + ÂNCORA", [PERFIL, ANCORA, `COMO COMPREENDER (interno):\n${base2}`, antiga.txt && `REPERTÓRIO (interno):\n${antiga.txt}`]],
    ["E1 · + antiga + âncora + licença", [PERFIL, ANCORA, `COMO COMPREENDER (interno):\n${base2}`, antiga.txt && `REPERTÓRIO (interno):\n${antiga.txt}`, LICENCA]],
    ["E2 · + NOVA + âncora + licença", [PERFIL, ANCORA, `COMO COMPREENDER (interno):\n${base2}`, nova.txt && `REPERTÓRIO (interno):\n${nova.txt}`, LICENCA]],
  ];

  for (const [rot, blocos] of CONDS) {
    const sistema = [NUCLEO, ...blocos.filter(Boolean)].join("\n\n---\n\n");
    const r = await chamar(sistema, relato);
    w(`\n${"─".repeat(78)}\n${rot}   ${r.ms}ms · ${r.ent}tok entrada · ${r.texto.length} chars\n`);
    w(r.texto);
  }
}

writeFileSync("D:/Projetos/Kolo Família/ablacao3e.txt", out.join("\n"), "utf8");
console.log("pronto");
