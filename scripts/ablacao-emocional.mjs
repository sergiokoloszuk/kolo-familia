/**
 * ABLAÇÃO A–E · EMOCIONAL.
 *
 * Responde a pergunta que decide se vale escrever mais 42 registros:
 *
 *   "A resposta melhorou porque o NOSSO conhecimento chegou ao modelo, ou
 *    porque o modelo sozinho escreve bonito?"
 *
 * Cinco condições sobre exatamente o mesmo relato:
 *
 *   A · modelo sozinho
 *   B · + Perfil
 *   C · + Perfil + BASE 2
 *   D · + Perfil + BASE 2 + BASE 3
 *   E · + Perfil + BASE 2 + BASE 3 + licença generativa explícita
 *
 * O E é a pergunta do Sérgio, e é a mais afiada das cinco: **se D e E saírem
 * iguais, o modelo já faz a síntese sozinho e a licença é ruído. Se E for
 * claramente melhor, "criatividade com lastro" precisa virar arquitetura.**
 *
 * NÃO toca em produção: nenhuma família, nenhum WhatsApp, nenhum dado real. O
 * Perfil é sintético e está escrito aqui embaixo.
 *
 *   node scripts/ablacao-emocional.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { BASE2 } from "../apps/web/src/lib/conducao/base2-conteudo.ts";

const env = Object.fromEntries(
  readFileSync("apps/web/.env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

// ── PERFIL SINTÉTICO ──────────────────────────────────────────────────────
// Campos reais de `emocional` e `interesses`, preenchidos à mão. Nenhuma
// criança real foi usada.
const PERFIL = `PERFIL DA CRIANÇA (o que já sabemos)
Nome: Téo · 6 anos · menino
Diagnóstico: TEA nível 1

EMOCIONAL
- Gatilhos: quando precisa parar algo que está gostando; quando erra alguma coisa
- Sinais de que vem vindo: fica mais rápido, fala mais alto, começa a andar de um lado pro outro
- Como se manifesta: grita, joga o que está na mão, às vezes bate
- O que ajuda a passar: ficar perto sem falar muito; luz baixa
- O que NÃO ajuda / piora: explicar na hora, perguntar por quê, aumentar o tom
- Depois: fica muito cansado e quer colo

INTERESSES
- Trens e metrô. Sabe as estações da linha azul de cor.
- Gosta de desenhar mapas

ROTINA
- Como lida com a rotina: precisa saber o que vem depois
- Rotinas-âncora: leitura antes de dormir`;

const CASOS = [
  {
    id: "1-agressao",
    relato: "Meu filho bate na irmã quando é contrariado. Ontem ela pegou o brinquedo dele e ele partiu pra cima.",
  },
  {
    id: "2-sobrecarga",
    relato: "Ele explode por qualquer coisa no fim da tarde, principalmente depois da escola. Hoje foi porque a meia estava do lado errado.",
  },
  {
    id: "3-sinais",
    relato: "Quando eu percebo já é tarde, ele já está no auge e não adianta falar nada.",
  },
  {
    id: "4-insuficiente",
    relato: "Ele tem tido umas crises.",
  },
];

// ── BASE 2 · seções de investigação de emocional ──────────────────────────
const base2 = BASE2.filter((s) => s.tema === "emocional" && s.estado === "investigacao")
  .slice(0, 4)
  .map((s) => `### ${s.titulo}\n${s.conteudo}`)
  .join("\n\n");

// ── BASE 3 · busca real, com os rascunhos incluídos ───────────────────────
const H = {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
};
const todas = await (
  await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/boas_praticas?select=*`, {
    headers: { ...H, Range: "0-9999" },
  })
).json();

const { ordenarPorAderencia, PISO_ADERENCIA } = await import(
  "../apps/web/src/lib/conhecimento/aderencia.ts"
);

function base3De(relato) {
  const eleg = todas.filter(
    (b) =>
      (b.skills_relacionadas ?? []).includes("emocional") &&
      (b.status === "ativo" || b.status === "rascunho") &&
      (b.faixa_etaria_min == null || 6 >= b.faixa_etaria_min) &&
      (b.faixa_etaria_max == null || 6 <= b.faixa_etaria_max),
  );
  const res = ordenarPorAderencia(eleg, relato);
  const top = res.itens
    .filter((b) => (res.aderencias.get(b.id)?.pontos ?? 0) >= PISO_ADERENCIA)
    .slice(0, 3);
  return {
    texto: top
      .map((b) => `### ${b.titulo}\nQUANDO USAR: ${b.quando_usar}\n${b.versao_conversa}`)
      .join("\n\n"),
    ids: top.map((b) => ({ titulo: b.titulo, pontos: res.aderencias.get(b.id).pontos })),
  };
}

// ── as cinco condições ────────────────────────────────────────────────────
const NUCLEO = `Você é a Ayla, da Kolo Família. Conversa por escrito com a mãe ou o pai de uma criança atípica.
Responda como quem conversa, não como quem escreve relatório. Sem diagnóstico. Sem prometer resultado.
Pode usar emoji com parcimônia e *negrito* como âncora. Uma pergunta por vez, quando for perguntar.`;

const LICENCA = `
IMPORTANTE — VOCÊ É UMA IA, NÃO UM CATÁLOGO.
O material acima é repertório e princípio, não resposta pronta. RACIOCINE sobre ele e crie a melhor
intervenção para ESTA criança e ESTA família. Você pode combinar duas práticas, simplificar, adaptar,
transformar orientação em brincadeira, criar uma frase nova, dar um nome memorável a uma atividade,
mudar materiais e criar etapas — desde que respeite o Perfil, os limites e a segurança.
Use o Perfil para CRIAR, não só para evitar repetir pergunta: se a criança gosta de trens, a atividade
é sobre trens. Interesse é ponte para a experiência, nunca prêmio por obediência.
Você pode criar a FORMA. Não invente como fato: mecanismo cerebral, evidência, diagnóstico, causa,
eficácia garantida ou característica da criança que não foi informada.
Dose: uma leitura curta do que parece estar acontecendo, uma orientação, e um ou dois recursos. Não
despeje tudo o que sabe.`;

function montar(cond, caso, b3) {
  const p = [NUCLEO];
  if (cond >= 1) p.push(PERFIL);
  if (cond >= 2) p.push(`COMO COMPREENDER ESTE TEMA (material interno — não repita para a família):\n${base2}`);
  if (cond >= 3 && b3.texto) p.push(`REPERTÓRIO DISPONÍVEL (material interno):\n${b3.texto}`);
  if (cond >= 4) p.push(LICENCA);
  return p.join("\n\n---\n\n");
}

async function chamar(sistema, relato) {
  const t0 = Date.now();
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 900,
      system: sistema,
      messages: [{ role: "user", content: relato }],
    }),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  const j = await r.json();
  return {
    texto: j.content.map((c) => c.text ?? "").join(""),
    ms: Date.now() - t0,
    tokensEntrada: j.usage.input_tokens,
    tokensSaida: j.usage.output_tokens,
  };
}

const COND = ["A · modelo sozinho", "B · + Perfil", "C · + BASE 2", "D · + BASE 3", "E · + licença generativa"];
const out = [];
const w = (s) => out.push(s);

for (const caso of CASOS) {
  const b3 = base3De(caso.relato);
  w(`\n\n${"█".repeat(78)}\nCASO ${caso.id}\n"${caso.relato}"`);
  w(`\nBASE 3 recuperada (${b3.ids.length}): ${b3.ids.map((x) => `${x.pontos}pts ${x.titulo.slice(0, 44)}`).join(" | ") || "nada acima do piso"}`);

  for (let c = 0; c < 5; c++) {
    const sistema = montar(c, caso, b3);
    const r = await chamar(sistema, caso.relato);
    w(`\n${"─".repeat(78)}\n${COND[c]}   ${r.ms}ms · entrada ${r.tokensEntrada}tok · saída ${r.tokensSaida}tok · ${r.texto.length} chars\n`);
    w(r.texto);
  }
}

writeFileSync("D:/Projetos/Kolo Família/ablacao.txt", out.join("\n"), "utf8");
console.log(`pronto — ${CASOS.length} casos × 5 condições`);
