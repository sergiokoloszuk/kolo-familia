/**
 * BANCADA 4A.2 — os 8 casos com modelo real, pelo prompt que a aplicação monta.
 *
 * Não é uma chamada isolada com contexto inventado: reusa `ANCORA_PERFIL` e
 * `LICENCA_GENERATIVA` de `composicao.ts` e o núcleo de `diretrizes.ts`, que é
 * exatamente o que `assemblePrompt` empilha quando a flag está ligada. O que
 * fica de fora é o histórico e o roteamento — nenhum dos dois muda a pergunta
 * que esta bancada faz.
 *
 * Perfis sintéticos coerentes, escritos aqui. Nenhuma família real.
 *
 *   npx tsx scripts/bancada-4a2.mjs
 *   npx tsx scripts/bancada-4a2.mjs --sem-licenca   # o contrafactual
 */
import { readFileSync, writeFileSync } from "node:fs";
import { BASE2 } from "../apps/web/src/lib/conducao/base2-conteudo.ts";
import { ANCORA_PERFIL, LICENCA_GENERATIVA } from "../apps/web/src/lib/conducao/composicao.ts";
import { ordenarPorAderencia, PISO_ADERENCIA } from "../apps/web/src/lib/conhecimento/aderencia.ts";

const SEM_LICENCA = process.argv.includes("--sem-licenca");
/** FASE 4A.3 — inclui os 10 registros novos, que seguem em `rascunho` no banco. */
const COM_RASCUNHO = process.argv.includes("--4a3");
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

const CASOS = [
  {
    id: "1 · bate na irmã",
    skill: "emocional",
    idade: 6,
    relato: "Meu filho bate na irmã quando é contrariado. Ontem ela pegou o brinquedo dele e ele partiu pra cima.",
    perfil: `Téo · 6 anos · menino · TEA nível 1
EMOCIONAL — gatilhos: parar algo que está gostando; errar. Sinais de que vem vindo: fica mais rápido, fala mais alto, anda de um lado pro outro. Como se manifesta: grita, joga o que está na mão, às vezes bate. O que ajuda a passar: ficar perto sem falar muito; luz baixa. O que NÃO ajuda: explicar na hora, perguntar por quê, aumentar o tom. Depois: fica muito cansado e quer colo.
INTERESSES — trens e metrô; sabe as estações da linha azul de cor; gosta de desenhar mapas.
COMUNICAÇÃO — fala frases completas; entende bem instrução falada.`,
  },
  {
    id: "2 · explode depois da escola",
    skill: "emocional",
    idade: 6,
    relato: "Ele explode por qualquer coisa no fim da tarde, principalmente depois da escola. Hoje foi porque a meia estava do lado errado.",
    perfil: `Téo · 6 anos · menino · TEA nível 1
EMOCIONAL — sinais de que vem vindo: fica mais rápido, fala mais alto. O que ajuda: ficar perto sem falar muito.
SENSORIAL — reação a sons: incomoda em lugar cheio. Texturas: reclama de etiqueta e costura.
INTERESSES — trens e metrô; desenhar mapas.
ROTINA — precisa saber o que vem depois.`,
  },
  {
    id: "3 · não começa matemática",
    skill: "foco",
    idade: 8,
    relato: "Ele não começa a lição de matemática. Fica olhando pra folha, levanta, vai beber água, e eu perco a paciência. Acho que é preguiça.",
    perfil: `Nina · 8 anos · menina · TDAH
FOCO — sustenta atenção longa no que interessa (montar Lego, desenhar). Trava para começar tarefa escolar. Melhora quando alguém faz a primeira parte junto.
EMOCIONAL — frustra-se quando erra; evita tarefa nova.
INTERESSES — Lego, espaço, planetas.
APRENDIZADO — entende bem quando mostram fazendo.`,
  },
  {
    id: "4 · junta sílabas, perde a palavra",
    skill: "aprendizado",
    idade: 7,
    relato: "Ele junta as sílabas mas na hora de falar a palavra inteira se perde e começa de novo.",
    perfil: `Bento · 7 anos · menino
APRENDIZADO — decodifica sílaba a sílaba; perde a palavra ao juntar. Melhora com apoio visual.
INTERESSES — dinossauros; sabe nomes difíceis de cor.
FOCO — sustenta 10 a 15 minutos com apoio.`,
  },
  {
    id: "5 · sono com medo + presença",
    skill: "sono",
    idade: 8,
    relato: "Ele demora pra dormir, me chama várias vezes, diz que está com medo, e eu fico até ele dormir porque se eu saio ele levanta.",
    perfil: `Léo · 8 anos · menino · TEA nível 1
SONO — como adormece: com a mãe deitada junto. Quanto tempo leva: mais de 40 minutos. Despertares: acorda e chama. O que atrapalha: barulho da rua.
EMOCIONAL — gatilhos: separação; escuro.
INTERESSES — carros e pistas; gosta de história antes de dormir.`,
  },
  {
    id: "6 · sensorial em festa",
    skill: "sensorial",
    idade: 6,
    relato: "Toda vez que vamos a um aniversário ele começa bem, depois fica irritado, tapa os ouvidos e quer ir embora.",
    perfil: `Ana · 6 anos · menina · TEA
SENSORIAL — reação a sons: cobre os ouvidos com liquidificador e secador. Movimento: adora balanço e girar. Luz: incomoda em lugar muito claro.
EMOCIONAL — depois de sair do lugar cheio, melhora em uns 10 minutos.
INTERESSES — bichos, principalmente gato.`,
  },
  {
    id: "7 · puxa pela mão",
    skill: "comunicacao",
    idade: 4,
    relato: "Ele me puxa pela mão pra pegar as coisas mas quase não pede sozinho.",
    perfil: `Davi · 4 anos · menino · TEA
COMUNICAÇÃO — como mostra o que quer: pega a mão do adulto e leva. Vocabulário e fala: umas 15 palavras, usa mais para nomear. Ecolalia: repete falas de desenho. Como demonstra que entende: faz o que pedem quando mostram junto.
INTERESSES — água, banho, bolhas de sabão.`,
  },
  {
    id: "8 · relato insuficiente",
    skill: "emocional",
    idade: 6,
    relato: "Ele tem tido umas crises.",
    perfil: `Téo · 6 anos · menino · TEA nível 1
EMOCIONAL — sinais de que vem vindo: fica mais rápido, fala mais alto.
INTERESSES — trens e metrô.`,
  },
];

const ok = (i, a, b) => (a == null || i >= a) && (b == null || i <= b);

function contexto(c, nBPs = 3) {
  const partes = [NUCLEO];

  // <o_que_ja_sabemos> + âncora colada, como o prompt real monta.
  partes.push(`<o_que_ja_sabemos>
${ANCORA_PERFIL}
${c.perfil}
</o_que_ja_sabemos>`);

  const b2 = BASE2.filter((s) => s.tema === c.skill && s.estado === "investigacao").slice(0, 3);
  if (b2.length) {
    partes.push(`<como_compreender_este_tema>
Material INTERNO de raciocínio — não repita nada disto para a família e não
transforme as bifurcações em questionário. Use para decidir O QUE ainda muda a
conduta, e faça no máximo UMA pergunta: a que separa os caminhos.
${b2.map((s) => `### ${s.titulo}\n${s.conteudo}`).join("\n\n")}
</como_compreender_este_tema>`);
  }

  const eleg = todas.filter(
    (b) =>
      (b.skills_relacionadas ?? []).includes(c.skill) &&
      (b.status === "ativo" || (COM_RASCUNHO && b.status === "rascunho")) &&
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

  if (!SEM_LICENCA) partes.push(LICENCA_GENERATIVA);

  return {
    texto: partes.join("\n\n---\n\n"),
    b2: b2.map((s) => s.titulo),
    bps: bps.map((b) => `${res.aderencias.get(b.id)?.pontos ?? 0}pts ${b.titulo.slice(0, 46)}`),
  };
}

async function chamar(sistema, mensagens) {
  const t0 = Date.now();
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-5-20250929", max_tokens: 1200, system: sistema, messages: mensagens }),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  const j = await r.json();
  return { texto: j.content.map((c) => c.text ?? "").join(""), ms: Date.now() - t0, ent: j.usage.input_tokens, sai: j.usage.output_tokens };
}

const out = [];
const w = (s) => out.push(s);
w(`BANCADA 4A.2 ${SEM_LICENCA ? "· SEM LICENÇA (contrafactual)" : "· COM COMPOSIÇÃO COMPLETA"}\n`);

for (const c of CASOS) {
  const ctx = contexto(c);
  const r = await chamar(ctx.texto, [{ role: "user", content: c.relato }]);
  w(`\n${"█".repeat(78)}\n${c.id}   (${c.idade}a · ${c.skill})`);
  w(`RELATO: "${c.relato}"`);
  w(`BASE 2: ${ctx.b2.join(" | ") || "—"}`);
  w(`BASE 3: ${ctx.bps.join(" | ") || "—"}`);
  w(`\n${r.ent} tok entrada · ${r.sai} saída · ${r.ms}ms · ${r.texto.length} chars\n`);
  w(r.texto);
}

writeFileSync(`D:/Projetos/Kolo Família/bancada4a2${SEM_LICENCA ? "-sem" : ""}.txt`, out.join("\n"), "utf8");
console.log("pronto");
