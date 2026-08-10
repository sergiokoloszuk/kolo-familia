/**
 * O CASO LUCAS, com o Perfil REAL e o formato REAL.
 *
 * Três condições sobre o mesmo relato:
 *   A · sem Perfil            — controle
 *   B · com Perfil, sem âncora — o que roda hoje no WhatsApp
 *   C · com Perfil e âncora    — a correção que já existe e não está no ar
 *
 * O Perfil vem de `montarKoloVivoResumo`, no formato exato que o WhatsApp
 * recebe — não um perfil sintético bem-comportado.
 *
 *   npx tsx scripts/lucas-ancora.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { ANCORA_PERFIL } from "../apps/web/src/lib/conducao/composicao.ts";

const env = Object.fromEntries(
  readFileSync("apps/web/.env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

/** VERBATIM do que `montarKoloVivoResumo` devolveu para o Lucas. */
const PERFIL_REAL = `[criança/como_e] personagens; Telas
[criança/comunicacao] Conversa e argumentação: Tem dificuldade de narrar uma história, contar o que aconteceu e manter uma conversa. Começa e fala algo muito específico (o detalhe que ficou na cabeça), mas não desenvolve — não constrói o contexto para o interlocutor.
Entende o contexto: Dificuldade em compreender intenções, inferências, linguagem figurada (metáforas, ironia, duplo sentido) e flexibilidade de tópicos`;

const RELATO = `Como ajudo meu filho a desenvolver nisso ?
O que ainda falta

Ele precisa avançar em:
* conversação;
* manutenção de tópicos;
* organização discursiva;
* resolução de problemas comunicativos;
* compreensão de intenções;
* inferências;
* linguagem não literal;
* humor;
* metáforas;
* duplo sentido;
* ironia.

Ou seja: Lucas já está conversando. Agora precisa aprender a conversar com mais profundidade, flexibilidade e compreensão social.`;

const NUCLEO = `Você é a Ayla, da Kolo Família. Conversa por WhatsApp com a mãe de uma criança atípica.
Sem diagnóstico, sem promessa de resultado. Hipóteses, não causas afirmadas.
Texto de WhatsApp: sem markdown, sem listas com traço. Pra destacar, *um asterisco só*, com parcimônia.
Escreve como quem conversa. Quando for perguntar, uma pergunta por vez.
A criança se chama Lucas Antônio, tem 8 anos. A mãe se chama Sanábia.`;

const CONDS = [
  ["A · sem Perfil (controle)", (n) => n],
  ["B · com Perfil, SEM âncora (o que roda hoje)", (n) => `${n}\n\n<kolo_vivo>\n${PERFIL_REAL}\n</kolo_vivo>`],
  ["C · com Perfil E âncora (a correção)", (n) => `${n}\n\n<kolo_vivo>\n${ANCORA_PERFIL}\n\n${PERFIL_REAL}\n</kolo_vivo>`],
];

/** O que uma boa resposta deveria usar — cada um está NO PERFIL. */
const MARCADORES = [
  ["começa pelo detalhe / não dá contexto", /detalhe|contexto pro?a? (interlocutor|quem)|come[çc]a pelo|n[ãa]o constr[óo]i o contexto|sem contexto/i],
  ["ironia/figurado já conhecido", /voc[êe] (j[áa] )?(me )?contou|pelo que (voc[êe]|j[áa])|a gente j[áa] sabe|voc[êe] j[áa] tinha dito/i],
  ["interesse: personagens", /personagen/i],
  ["interesse: telas", /\btela/i],
];

async function chamar(sistema) {
  const t0 = Date.now();
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1000,
      system: sistema,
      messages: [{ role: "user", content: RELATO }],
    }),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  const j = await r.json();
  return { texto: j.content.map((c) => c.text ?? "").join(""), ms: Date.now() - t0 };
}

const out = [];
const w = (s) => out.push(s);
const N = 3;

for (const [rot, montar] of CONDS) {
  const sistema = montar(NUCLEO);
  w(`\n${"█".repeat(78)}\n${rot}\n`);
  const placar = MARCADORES.map(() => 0);
  for (let i = 0; i < N; i++) {
    const r = await chamar(sistema);
    const achados = MARCADORES.map(([n, re], k) => {
      const hit = re.test(r.texto);
      if (hit) placar[k]++;
      return hit ? n : null;
    }).filter(Boolean);
    w(`  rodada ${i + 1}: ${r.ms}ms · ${r.texto.length}ch · usou: ${achados.join(" + ") || "NADA DO PERFIL"}`);
    if (i === 0) w(`\n${r.texto.split("\n").map((l) => "    │ " + l).join("\n")}\n`);
  }
  w(`  ── placar em ${N} rodadas:`);
  MARCADORES.forEach(([n], k) => w(`     ${placar[k]}/${N}  ${n}`));
}

writeFileSync("D:/Projetos/Kolo Família/lucas.txt", out.join("\n"), "utf8");
console.log("pronto");
