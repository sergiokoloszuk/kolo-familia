#!/usr/bin/env node
/**
 * BANCADA DE CONSULTA DA BIA — testar a recuperação à mão, antes de integrar.
 *
 * Por que existe: a qualidade de um retriever não se prova por teste unitário.
 * Teste unitário trava as regras; só olhar o resultado de consultas reais diz
 * se o conhecimento que volta é o que a Ayla deveria estar lendo. Esta
 * ferramenta serve para a Karina (e para nós) olhar a saída e dizer "esse
 * terceiro resultado não faz sentido" ANTES de ligar qualquer fio na Ayla.
 *
 * Por que consulta o JSON e não o banco: a migração 0071 ainda não foi
 * aplicada. E, mesmo depois, validar contra o corpus é melhor — não encosta em
 * produção.
 *
 * Como ele usa o MESMO código do app (e não uma cópia): `typescript` já está
 * instalado no repositório, então transpilamos `pontuacao.ts` e `tipos.ts` na
 * hora e importamos o resultado. Nenhuma dependência nova, nenhuma lógica
 * duplicada — se a pontuação mudar, esta ferramenta muda junto.
 *
 * USO
 *   # 1) gere o corpus (uma vez)
 *   node scripts/bia/importar-bia.mjs --arquivo "C:/.../BIA.docx" --versao 2026-07-30 --json bia.json
 *
 *   # 2) consulte
 *   node scripts/bia/consultar.mjs --corpus bia.json \
 *        --dominio comunicacao --idade 4 --perfil TEA \
 *        --texto "ele puxa minha mão até o armário e não olha pra mim"
 *
 *   # ou rode a bateria de cenários de referência
 *   node scripts/bia/consultar.mjs --corpus bia.json --cenarios
 *
 * Opções: --dominio --idade --perfil --contexto --dificuldade --objetivo
 *         --texto --limite --completo
 */

import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const AQUI = dirname(fileURLToPath(import.meta.url));
const LIB = resolve(AQUI, "../../apps/web/src/lib/bia");

// ============================================================
// Ponte TypeScript → ESM, sem dependência nova
// ============================================================

/**
 * Transpila os módulos puros da BIA para um diretório temporário e devolve o
 * módulo já importado. Só apaga os tipos — a checagem de tipos é trabalho do
 * `npm run typecheck`, não desta ferramenta.
 */
async function carregarPontuacao() {
  const require = createRequire(import.meta.url);
  let ts;
  try {
    ts = require("typescript");
  } catch {
    console.error(
      "Não achei o pacote `typescript`. Rode a partir da raiz do repositório " +
        "(ele já é dependência do projeto — nada a instalar).",
    );
    process.exit(1);
  }

  const dir = mkdtempSync(join(tmpdir(), "bia-"));
  for (const nome of ["tipos", "pontuacao"]) {
    const fonte = readFileSync(join(LIB, `${nome}.ts`), "utf8");
    const js = ts.transpileModule(fonte, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    // ESM no Node exige extensão explícita no import relativo.
    writeFileSync(join(dir, `${nome}.mjs`), js.replace(/from\s+"\.\/tipos"/g, 'from "./tipos.mjs"'), "utf8");
  }
  return import(pathToFileURL(join(dir, "pontuacao.mjs")).href);
}

// ============================================================
// Argumentos
// ============================================================

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const chave = a.slice(2);
    const valor = argv[i + 1];
    if (valor && !valor.startsWith("--")) {
      out[chave] = valor;
      i++;
    } else {
      out[chave] = true;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

if (!args.corpus) {
  console.error(
    [
      "Falta o corpus.",
      "",
      "  node scripts/bia/importar-bia.mjs --arquivo BIA.docx --versao 2026-07-30 --json bia.json",
      "  node scripts/bia/consultar.mjs --corpus bia.json --dominio sono --idade 5 --texto '...'",
      "  node scripts/bia/consultar.mjs --corpus bia.json --cenarios",
    ].join("\n"),
  );
  process.exit(1);
}

// ============================================================
// Corpus
// ============================================================

const bruto = JSON.parse(readFileSync(String(args.corpus), "utf8"));

/**
 * O importer não gera `id` (é o banco que gera). Para a pontuação, o `hash`
 * serve como identidade estável — é o mesmo papel.
 */
const corpus = bruto.map((c) => ({ ...c, id: c.hash }));

const ativos = corpus.filter((c) => !c.revisao_pendente);
console.log(
  `Corpus: ${corpus.length} chunks · ${ativos.length} recuperáveis · ` +
    `${corpus.length - ativos.length} em revisão (nunca retornados)\n`,
);

// ============================================================
// Impressão
// ============================================================

const CORES = {
  reset: "\x1b[0m",
  forte: "\x1b[1m",
  fraco: "\x1b[2m",
  verde: "\x1b[32m",
  amarelo: "\x1b[33m",
  vermelho: "\x1b[31m",
  ciano: "\x1b[36m",
};

function imprimirConsulta(ctx) {
  const campos = Object.entries(ctx)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`);
  console.log(`${CORES.forte}▶ ${campos.join("  ")}${CORES.reset}`);
}

function imprimirResultados(resultados, completo) {
  if (resultados.length === 0) {
    console.log(`  ${CORES.amarelo}(nada recuperado)${CORES.reset}\n`);
    return;
  }
  for (const [i, r] of resultados.entries()) {
    const c = r.chunk;
    const faixa = c.faixa_rotulo ? ` · ${c.faixa_rotulo}` : "";
    console.log(
      `\n  ${CORES.forte}${i + 1}.${CORES.reset} ` +
        `${CORES.ciano}[${c.nucleo}]${CORES.reset} ` +
        `${CORES.fraco}${c.tipo_conhecimento}${faixa}${CORES.reset} ` +
        `${CORES.verde}score ${r.score}${CORES.reset}`,
    );
    if (c.secao) console.log(`     ${CORES.fraco}${c.secao}${CORES.reset}`);

    // O ponto desta ferramenta: POR QUE este resultado apareceu.
    for (const m of [...r.motivos].sort((a, b) => b.peso - a.peso)) {
      const cor = m.peso < 0 ? CORES.vermelho : CORES.reset;
      const sinal = m.peso > 0 ? `+${m.peso}` : String(m.peso);
      console.log(`       ${cor}• ${m.descricao} ${CORES.fraco}(${sinal})${CORES.reset}`);
    }

    const texto = c.texto_original.replace(/\s+/g, " ");
    console.log(
      `     ${CORES.fraco}"${completo ? texto : texto.slice(0, 240) + (texto.length > 240 ? "…" : "")}"${CORES.reset}`,
    );
  }
  console.log("");
}

// ============================================================
// Cenários de referência
// ============================================================

/**
 * Consultas que representam conversas reais do produto. Servem para comparar a
 * recuperação depois de qualquer mexida nos pesos — se um cenário passar a
 * devolver outra coisa, foi mudança de comportamento, não ajuste fino.
 */
const CENARIOS = [
  {
    nome: "Comunicação — puxa a mão do adulto (o caso clássico da BIA)",
    ctx: {
      idadeAnos: 3,
      perfil: "TEA",
      dominio: "comunicacao",
      dificuldade: "não fala e puxa a minha mão",
      textoDaConversa: "ele pega minha mão, me puxa até o armário e não olha pro meu rosto",
    },
  },
  {
    nome: "Sono — despertares noturnos",
    ctx: {
      idadeAnos: 5,
      perfil: "TEA",
      dominio: "sono",
      contexto: "sono",
      dificuldade: "acorda de madrugada e não volta a dormir",
      textoDaConversa: "ela acorda toda madrugada e demora horas pra dormir de novo",
    },
  },
  {
    nome: "Alimentação — seletividade por textura",
    ctx: {
      idadeAnos: 6,
      perfil: "TEA",
      dominio: "nutricional",
      contexto: "refeicao",
      dificuldade: "só come alimentos crocantes",
      objetivo: "quero ampliar o que ele aceita",
    },
  },
  {
    nome: "Sinal de risco — regressão (encaminhamento deve subir)",
    ctx: {
      idadeAnos: 4,
      perfil: "TEA",
      dominio: "comunicacao",
      textoDaConversa: "ele falava algumas palavras e parou, perdeu o que já tinha",
    },
  },
  {
    nome: "Adolescente — autonomia (nada infantil pode voltar)",
    ctx: {
      idadeAnos: 15,
      perfil: "TEA",
      dominio: "autonomia",
      dificuldade: "não toma banho sozinho",
      textoDaConversa: "ele já é adolescente e ainda preciso lembrar de tudo",
    },
  },
  {
    nome: "Sem domínio — só o texto da conversa",
    ctx: {
      idadeAnos: 7,
      textoDaConversa: "na hora de sair de casa ele trava e começa a chorar",
    },
  },
];

// ============================================================
// Execução
// ============================================================

const { selecionar } = await carregarPontuacao();
const limite = args.limite ? Number(args.limite) : 6;
const completo = Boolean(args.completo);

if (args.cenarios) {
  for (const cenario of CENARIOS) {
    console.log("─".repeat(78));
    console.log(`${CORES.forte}${cenario.nome}${CORES.reset}`);
    imprimirConsulta(cenario.ctx);
    imprimirResultados(selecionar(corpus, cenario.ctx, { limite }), completo);
  }
  console.log("─".repeat(78));
} else {
  const ctx = {
    idadeAnos: args.idade ? Number(args.idade) : null,
    perfil: typeof args.perfil === "string" ? args.perfil : null,
    dominio: typeof args.dominio === "string" ? args.dominio : null,
    contexto: typeof args.contexto === "string" ? args.contexto : null,
    dificuldade: typeof args.dificuldade === "string" ? args.dificuldade : null,
    objetivo: typeof args.objetivo === "string" ? args.objetivo : null,
    textoDaConversa: typeof args.texto === "string" ? args.texto : null,
  };
  imprimirConsulta(ctx);
  imprimirResultados(selecionar(corpus, ctx, { limite }), completo);
}
