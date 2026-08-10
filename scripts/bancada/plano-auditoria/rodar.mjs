/**
 * AUDITORIA DO PLANO — personalização real e conflito perfil × boa prática.
 *
 * ⚠️ SEGURANÇA: nada de banco. `assemblePrompt` é função pura — recebe o `ctx`
 * já montado — então dá pra exercitar o caminho EXATO de uma seção de plano
 * (`respondAsOutputType` → `callClaude` → `assemblePrompt` com modo
 * `output_type`) com perfis 100% fictícios, sem tocar em família real, sem
 * INSERT, sem UPDATE e sem gerar PDF. O único efeito colateral é custo de API.
 *
 * O que ISTO prova e o que NÃO prova: prova o que o modelo faz com o contexto
 * que o plano de verdade entrega. NÃO prova o que uma família real receberia,
 * porque o `ctx` real vem do banco.
 *
 *   node scripts/bancada/plano-auditoria/rodar.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(AQUI, "../../../apps/web");

for (const l of readFileSync(resolve(WEB, ".env.local"), "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const { registerHooks } = await import("node:module");
registerHooks({
  resolve(esp, ctx, next) {
    if (esp.startsWith("@/"))
      return next(new URL(`../../../apps/web/src/${esp.slice(2)}.ts`, import.meta.url).href, ctx);
    if (esp.startsWith(".") && !/\.[a-z]+$/.test(esp)) {
      try {
        return next(`${esp}.ts`, ctx);
      } catch {
        /* não era .ts */
      }
    }
    if (esp === "next/headers" || esp === "next/cache")
      return {
        url: "data:text/javascript,export const cookies=()=>{throw 0};export const headers=()=>{throw 0};export const revalidatePath=()=>{};export const revalidateTag=()=>{};",
        shortCircuit: true,
      };
    return next(esp, ctx);
  },
});
const mod = (p) => import(new URL(`../../../apps/web/src/${p}`, import.meta.url).href);

const { assemblePrompt } = await mod("lib/ia/prompt.ts");
const { MODELS } = await mod("lib/ia/anthropic.ts");

// output_types REAIS, lidos do banco (SELECT puro, sem escrita).
const env = process.env;
const H = {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
};
const OTS = await (
  await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/output_types?select=key,label,prompt_template&ativo=eq.true`, {
    headers: H,
  })
).json();
const ot = (k) => OTS.find((o) => o.key === k);

/** A skill que o roteador entregaria para um tema de comunicação. */
const SKILL = {
  name: "comunicacao",
  display_name: "Comunicação",
  objective: "apoiar a comunicação funcional da criança",
  tone: "próximo, prático",
  scope: "comunicação, pedidos, recusa",
  limits: "não diagnostica",
  kolo_vivo_fields: ["essencial", "comunicacao"],
  knowledge_tags: ["comunicacao"],
};

/** Boas práticas SINTÉTICAS — idênticas nos três perfis, de propósito. */
const BPS = [
  {
    titulo: "Ensinar o pedido de ajuda em passos",
    versao_curta: "Modele o pedido curto e responda imediatamente.",
    versao_conversa:
      "Escolha uma situação em que a criança precisa de ajuda e modele o pedido curto ('me ajuda'), respondendo na hora para que o pedido tenha resultado imediato.",
    quando_usar: "quando a criança desiste, chora ou puxa o adulto em vez de pedir",
    erros_comuns: ["esperar a frase completa antes de ajudar"],
    passos_praticos: ["crie a oportunidade", "modele o pedido", "responda imediatamente"],
  },
  {
    titulo: "Brincadeira com dinossauros para ampliar o repertório",
    versao_curta: "Use os dinossauros favoritos para criar trocas comunicativas.",
    versao_conversa:
      "Monte uma caixa de dinossauros e entregue um por vez, criando oportunidades de pedir. O interesse por dinossauros sustenta a atenção por mais tempo.",
    quando_usar: "quando a criança tem interesse restrito forte",
    erros_comuns: ["encher a mesa de brinquedos de uma vez"],
    passos_praticos: ["separe os dinossauros", "entregue um por vez", "espere o pedido"],
  },
];

/** ctx no formato de `ContextoSkillResposta`, sem nada do banco. */
function ctxDe({ nome, idade, perfil, secoes, familia = {} }) {
  return {
    membroFoco: {
      id: "ficticio",
      nome,
      idade,
      perfil,
      genero: null,
      diagnosticoRegistrado: null,
      secoes,
    },
    cuidador: { nome: "Ana", relacao: "mãe", genero: "feminino" },
    membros: [{ nome, idade, genero: null, perfil }],
    familia,
    diariosRecentes: [],
    ultimoCheckin: null,
    boasPraticas: BPS,
    // Fora do piloto de Estratégias, que é o estado do Plano hoje.
    base2: [],
    perfilConsultavel: null,
    historico: [],
  };
}

const OBJETIVO = "Ele não pede ajuda. Quando trava, desiste ou chora. Quero trabalhar isso.";

const PERFIS = [
  {
    id: "A · poucas palavras, puxa pela mão",
    ctx: ctxDe({
      nome: "Téo",
      idade: 5,
      perfil: "TEA",
      secoes: {
        essencial: "Téo, 5 anos. Interesses: carrinhos. Compreende comandos simples de uma etapa.",
        comunicacao:
          "Fala poucas palavras isoladas. Puxa o adulto pela mão para pedir. Compreende comandos simples.",
      },
    }),
  },
  {
    id: "B · verbal, dificuldade é pedir ajuda/recusar",
    ctx: ctxDe({
      nome: "Bento",
      idade: 8,
      perfil: "TDAH",
      secoes: {
        essencial: "Bento, 8 anos. Interesses: desenho e quadrinhos. Fala bastante.",
        comunicacao:
          "Verbal, fala muito e com vocabulário amplo. A dificuldade é pedir ajuda e expressar recusa — trava calado ou explode.",
      },
    }),
  },
  {
    id: "C · imagens/gestos, sensibilidade auditiva, NÃO gosta de carrinhos",
    ctx: ctxDe({
      nome: "Lia",
      idade: 6,
      perfil: "TEA",
      secoes: {
        essencial:
          "Lia, 6 anos. Interesses: água e tecidos macios. NÃO gosta de carrinhos e NÃO gosta de dinossauros.",
        comunicacao: "Usa imagens e gestos. Pouca fala. Sensibilidade auditiva a sons altos.",
      },
    }),
  },
];

async function chamar(system, messages) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODELS.principal,
      max_tokens: 2048,
      // Mesmos parâmetros de `callClaude` — é o caminho que o plano usa.
      thinking: { type: "enabled", budget_tokens: 1024 },
      system,
      messages,
    }),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  const j = await r.json();
  return (j.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

const out = [];
const w = (s) => {
  out.push(s);
  console.log(s);
};

w(`AUDITORIA DO PLANO · seções geradas pelo caminho REAL (assemblePrompt, modo output_type)`);
w(`modelo: ${MODELS.principal} · perfis FICTÍCIOS · sem banco, sem PDF, sem persistência`);
w(`mesmo objetivo nos três: "${OBJETIVO}"\n`);

for (const secao of ["brincadeiras", "atividades"]) {
  const o = ot(secao);
  w(`\n${"█".repeat(78)}\nSEÇÃO "${secao}" — receita do banco (${o.prompt_template.length} caracteres):\n"${o.prompt_template}"\n`);
  for (const p of PERFIS) {
    const { system, messages } = assemblePrompt({
      skills: [SKILL],
      ctx: p.ctx,
      userInput: OBJETIVO,
      modo: { kind: "output_type", outputType: o },
    });
    const texto = await chamar(
      system.map((b) => ({ ...b })),
      messages,
    );
    w(`\n  ┌─ ${p.id}\n${texto.split("\n").map((l) => `  │ ${l}`).join("\n")}\n  └─`);
  }
}

// ── conflito PERFIL × BOA PRÁTICA ──────────────────────────────────────
// A BP sintética #2 manda usar dinossauros. O perfil C diz, com todas as
// letras, que a criança NÃO gosta de dinossauros. Quem ganha?
w(`\n\n${"█".repeat(78)}\nCONFLITO PERFIL × BOA PRÁTICA`);
w(`BP entregue: "Brincadeira com dinossauros para ampliar o repertório"`);
w(`Perfil C diz: "NÃO gosta de carrinhos e NÃO gosta de dinossauros"`);
w(`Sem ANCORA_PERFIL — que só existe no piloto de Estratégias, não no Plano.\n`);
{
  const o = ot("brincadeiras");
  const p = PERFIS[2];
  for (let i = 1; i <= 3; i++) {
    const { system, messages } = assemblePrompt({
      skills: [SKILL],
      ctx: p.ctx,
      userInput: OBJETIVO,
      modo: { kind: "output_type", outputType: o },
    });
    const texto = await chamar(system, messages);
    const citaDino = /dinossauro/i.test(texto);
    const citaCarrinho = /carrinho/i.test(texto);
    w(`  rodada ${i}: dinossauro=${citaDino ? "SIM (contra o perfil)" : "não"} · carrinho=${citaCarrinho ? "SIM (contra o perfil)" : "não"} · ${texto.length}ch`);
    if (i === 1) w(`\n  ┌─ rodada 1\n${texto.split("\n").map((l) => `  │ ${l}`).join("\n")}\n  └─\n`);
  }
}

mkdirSync(resolve(AQUI, "../../../docs/bancada"), { recursive: true });
const destino = resolve(AQUI, "../../../docs/bancada/plano-auditoria-2026-08-10.txt");
writeFileSync(destino, out.join("\n"), "utf8");
console.log(`\npronto → ${destino}`);
