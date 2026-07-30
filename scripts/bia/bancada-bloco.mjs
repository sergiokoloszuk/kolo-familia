#!/usr/bin/env node
/**
 * BANCADA DO BLOCO — o caminho INTEIRO da integração, do contexto ao texto que
 * entra no prompt.
 *
 * A `consultar.mjs` mostra a RECUPERAÇÃO (o que o retriever traz e por quê).
 * Esta mostra o que sobra DEPOIS das cotas, do orçamento e das instruções — que
 * é o que a Ayla realmente lê. É a diferença entre "recuperou 12" e "entraram 4,
 * custando 1.5k caracteres".
 *
 * ⚠️ LIMITE HONESTO: corre contra o corpus JSON, não contra o Postgres. A
 * migração 0071 não foi aplicada (não há ambiente seguro — ver
 * `docs/bia-aplicacao-0071.md`). O que ISTO prova: cotas, orçamento, conflito,
 * inferência de domínio, tamanho e forma do bloco. O que NÃO prova: que o SQL
 * roda, que o índice GIN é usado e qual a latência real do banco.
 *
 * Zero lógica duplicada: transpila e importa os MESMOS módulos do app
 * (`bloco.ts`, `conflitos.ts`, `contexto-ayla.ts`). Só o I/O é substituído —
 * `@/lib/log` vira um coletor em memória e `./retriever` lê do corpus.
 *
 * USO
 *   node scripts/bia/bancada-bloco.mjs --corpus bia.json
 *   node scripts/bia/bancada-bloco.mjs --corpus bia.json --completo
 */

import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const AQUI = dirname(fileURLToPath(import.meta.url));
const LIB = resolve(AQUI, "../../apps/web/src/lib/bia");

const args = (() => {
  const out = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const k = argv[i].slice(2);
    const v = argv[i + 1];
    if (v && !v.startsWith("--")) (out[k] = v), i++;
    else out[k] = true;
  }
  return out;
})();

if (!args.corpus) {
  console.error("Falta --corpus bia.json");
  process.exit(1);
}

const corpus = JSON.parse(readFileSync(String(args.corpus), "utf8")).map((c) => ({
  ...c,
  id: c.hash,
}));

// ============================================================
// Ponte TS → ESM, com o I/O substituído
// ============================================================

const require = createRequire(import.meta.url);
const ts = require("typescript");
const dir = mkdtempSync(join(tmpdir(), "bia-bloco-"));

for (const nome of ["tipos", "pontuacao", "bloco", "conflitos", "desabafo", "contexto-ayla"]) {
  const js = ts.transpileModule(readFileSync(join(LIB, `${nome}.ts`), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  writeFileSync(
    join(dir, `${nome}.mjs`),
    js
      .replace(/from\s+"\.\/([a-z-]+)"/g, 'from "./$1.mjs"')
      .replace(/from\s+"@\/lib\/log"/g, 'from "./_log.mjs"')
      // A flag é lida do ambiente; aqui ela está sempre ligada, senão não há o
      // que observar. O teste de que DESLIGADA não consulta nada vive em
      // `contexto-ayla.test.ts`.
      .replace(/from\s+"\.\/flag\.mjs"/g, 'from "./_flag.mjs"'),
    "utf8",
  );
}

writeFileSync(
  join(dir, "_flag.mjs"),
  "export const BIA_FLAG_ENV='BIA_PROMPT_ENABLED';export function biaHabilitadaNoPrompt(){return true}\n",
  "utf8",
);
writeFileSync(
  join(dir, "_log.mjs"),
  "export const eventos=[];export async function logEvent(e){eventos.push(e)}\n",
  "utf8",
);
// O retriever real fala com o Postgres. Aqui ele lê do corpus — mas tem de
// reproduzir o CORTE DE CANDIDATOS que o SQL faz, senão a bancada mente: sem
// isso ele pontua os 1120 chunks e devolve alguma coisa até para "oi, tudo
// bem?", o que a consulta de verdade nunca faria (sem núcleo e sem termo útil,
// `buscarCandidatos` não dispara consulta nenhuma e devolve []).
//
// São as duas consultas do retriever, que se SOMAM:
//   (a) estruturada — chunks dos núcleos do domínio;
//   (b) textual — chunks que contêm ao menos um termo da consulta.
// A seleção e os filtros duros continuam sendo os do app.
writeFileSync(
  join(dir, "retriever.mjs"),
  `import { selecionar, termos } from "./pontuacao.mjs";
import { BIA_NUCLEOS, BIA_NUCLEO_PARA_DOMINIOS } from "./tipos.mjs";

export const CORPUS = [];

export function montarConsultaTexto(ctx) {
  const bruto = [ctx.dificuldade, ctx.objetivo, ctx.textoDaConversa].filter(Boolean).join(" ");
  const lista = [...termos(bruto)].slice(0, 12);
  return lista.length ? lista : null;
}

export async function buscarConhecimentosBIA(_s, ctx, opcoes = {}) {
  const d = (ctx.dominio ?? "").trim().toLowerCase();
  const nucleos = d ? BIA_NUCLEOS.filter((n) => BIA_NUCLEO_PARA_DOMINIOS[n].includes(d)) : [];
  const lista = montarConsultaTexto(ctx);

  const porId = new Map();
  if (nucleos.length) {
    for (const c of CORPUS) if (nucleos.includes(c.nucleo)) porId.set(c.id, c);
  }
  if (lista) {
    // Aproximação do full-text: presença de radical no texto. Basta um termo,
    // como no \`websearch_to_tsquery\` com OR.
    for (const c of CORPUS) {
      const t = (c.texto_original + " " + (c.titulo ?? "")).toLowerCase();
      if (lista.some((termo) => t.includes(termo.slice(0, Math.max(4, termo.length - 2))))) {
        porId.set(c.id, c);
      }
    }
  }
  if (porId.size === 0) return [];
  return selecionar([...porId.values()], ctx, opcoes);
}\n`,
  "utf8",
);

const url = (n) => pathToFileURL(join(dir, `${n}.mjs`)).href;
const retriever = await import(url("retriever"));
retriever.CORPUS.push(...corpus);
const { carregarBlocoBia, inferirDominio } = await import(url("contexto-ayla"));
const { tokensAprox } = await import(url("bloco"));
const { eventos } = await import(url("_log"));

// ============================================================
// Consultas reais
// ============================================================

/**
 * Dez conversas do produto. Cinco delas exercitam um risco específico e estão
 * marcadas — são as que interessam se alguém mexer nos pesos.
 */
const CONSULTAS = [
  {
    nome: "WhatsApp · puxa a mão do adulto",
    canal: "whatsapp",
    contexto: {
      idadeAnos: 3,
      perfil: "TEA",
      dificuldade: "não fala e puxa a minha mão",
      textoDaConversa: "ele pega minha mão, me puxa até o armário e não olha pro meu rosto",
    },
  },
  {
    nome: "WhatsApp · despertares noturnos",
    canal: "whatsapp",
    contexto: {
      idadeAnos: 5,
      perfil: "TEA",
      textoDaConversa: "ela acorda toda madrugada e demora horas pra dormir de novo",
    },
  },
  {
    nome: "Web · seletividade alimentar por textura",
    canal: "web",
    contexto: {
      idadeAnos: 6,
      perfil: "TEA",
      dominio: "nutricional",
      dificuldade: "só come alimentos crocantes",
      objetivo: "quero ampliar o que ele aceita",
    },
  },
  {
    nome: "WhatsApp · REGRESSÃO (segurança precisa vencer)",
    risco: true,
    canal: "whatsapp",
    contexto: {
      idadeAnos: 4,
      perfil: "TEA",
      textoDaConversa: "ele falava algumas palavras e parou, perdeu o que já tinha",
    },
  },
  {
    nome: "Web · adolescente e autonomia (nada infantil pode voltar)",
    canal: "web",
    contexto: {
      idadeAnos: 15,
      perfil: "TEA",
      dominio: "autonomia",
      textoDaConversa: "ele já é adolescente e ainda preciso lembrar de tudo, banho, escovar",
    },
  },
  {
    nome: "WhatsApp · crise na transição de sair de casa",
    canal: "whatsapp",
    contexto: {
      idadeAnos: 7,
      textoDaConversa: "na hora de sair de casa ele trava e começa a chorar",
    },
  },
  {
    nome: "WhatsApp · CONFLITO com Boa Prática (contato visual)",
    canal: "whatsapp",
    boasPraticas: [
      "Estabeleça contato visual antes de dar a instrução e observe se ele mantém o olhar.",
    ],
    contexto: {
      idadeAnos: 4,
      perfil: "TEA",
      textoDaConversa: "ele nunca olha na minha cara quando eu falo com ele",
    },
  },
  {
    nome: "Web · desabafo puro (não deveria puxar receita)",
    canal: "web",
    contexto: { idadeAnos: 6, textoDaConversa: "hoje eu não aguento mais, tô exausta" },
  },
  {
    nome: "WhatsApp · saudação (recuperação deve vir VAZIA)",
    canal: "whatsapp",
    contexto: { idadeAnos: 5, textoDaConversa: "oi Ayla, tudo bem?" },
  },
  {
    nome: "Web · barulho e sobrecarga sensorial",
    canal: "web",
    contexto: {
      idadeAnos: 8,
      perfil: "TEA",
      dominio: "sensorial",
      dificuldade: "tapa os ouvidos com barulho",
      textoDaConversa: "no mercado ele tapa o ouvido e quer sair correndo",
    },
  },
];

// ============================================================
// Execução
// ============================================================

const C = { r: "\x1b[0m", b: "\x1b[1m", d: "\x1b[2m", v: "\x1b[32m", a: "\x1b[33m", c: "\x1b[36m" };
const completo = Boolean(args.completo);
const resumo = [];

console.log(`Corpus: ${corpus.length} chunks\n`);

for (const q of CONSULTAS) {
  console.log("─".repeat(78));
  console.log(`${C.b}${q.nome}${C.r}`);
  console.log(`${C.d}canal=${q.canal}  ${JSON.stringify(q.contexto)}${C.r}`);

  const antes = eventos.length;
  const t0 = Date.now();
  const bloco = await carregarBlocoBia({
    supabase: {},
    canal: q.canal,
    familyId: "bancada",
    contexto: q.contexto,
    textosBoasPraticas: q.boasPraticas ?? [],
  });
  const ms = Date.now() - t0;
  const evt = eventos[antes]?.payload ?? {};

  const dominio = q.contexto.dominio ?? inferirDominio(
    [q.contexto.dificuldade, q.contexto.textoDaConversa, q.contexto.objetivo]
      .filter(Boolean)
      .join(" "),
  );

  if (!bloco) {
    console.log(`  ${C.a}(bloco vazio — nada entra no prompt)${C.r}`);
    console.log(`  ${C.d}domínio inferido: ${dominio ?? "nenhum"} · recuperados: ${evt.recuperados ?? 0}${C.r}\n`);
    resumo.push({ nome: q.nome, dominio, usados: 0, chars: 0, tokens: 0, ms, conflito: false });
    continue;
  }

  console.log(
    `  ${C.c}domínio${C.r} ${dominio ?? "nenhum"}  ·  ` +
      `recuperados ${evt.recuperados}  →  ${C.v}usados ${evt.usados}${C.r}  ·  ` +
      `${bloco.length} chars ≈ ${tokensAprox(bloco.length)} tokens` +
      (evt.conflito ? `  ·  ${C.a}CONFLITO: ${evt.conflito_temas.join(", ")}${C.r}` : ""),
  );
  for (const ch of evt.chunks ?? []) {
    console.log(
      `    ${C.d}·${C.r} ${ch.tipo} ${C.v}${ch.score}${C.r} ${C.d}${ch.motivos.join(", ")}${C.r}`,
    );
  }
  if (completo) console.log(`\n${bloco}\n`);

  resumo.push({
    nome: q.nome,
    dominio,
    usados: evt.usados,
    chars: bloco.length,
    tokens: tokensAprox(bloco.length),
    ms,
    conflito: Boolean(evt.conflito),
  });
}

console.log("─".repeat(78));
console.log(`${C.b}\nIMPACTO NO PROMPT (BIA ligada × desligada)${C.r}`);
console.log(`${C.d}Desligada, todos estes valores são 0 — a função retorna antes de qualquer I/O.${C.r}\n`);
const comBloco = resumo.filter((r) => r.chars > 0);
const soma = (f) => comBloco.reduce((a, r) => a + f(r), 0);
console.table(
  resumo.map((r) => ({
    consulta: r.nome.slice(0, 44),
    dominio: r.dominio ?? "—",
    chunks: r.usados,
    chars: r.chars,
    tokens: r.tokens,
    conflito: r.conflito ? "sim" : "",
  })),
);
console.log(
  `${comBloco.length}/${resumo.length} consultas geraram bloco · ` +
    `média ${Math.round(soma((r) => r.chars) / (comBloco.length || 1))} chars ` +
    `(~${Math.round(soma((r) => r.tokens) / (comBloco.length || 1))} tokens) · ` +
    `máximo ${Math.max(0, ...resumo.map((r) => r.tokens))} tokens\n`,
);
