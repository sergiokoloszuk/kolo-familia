/**
 * BANCADA DO SINAL — `necessidade_conhecimento` serve como portão? 14/09/2026.
 *
 * ⚠️ MEDIDA SEPARADA DA RECUPERAÇÃO, DE PROPÓSITO. `rodar.mts` mede o
 * recuperador COM o sinal perfeito; aqui se mede o sinal sozinho. Se os dois
 * rodassem juntos, um resultado ruim não diria qual metade quebrou — e a
 * missão pede explicitamente "se o sinal for inadequado, corrija-o com prova
 * antes de conectar a recuperação".
 *
 * ⚠️ CHAMA O CLASSIFICADOR REAL — `decidirTurno`, o mesmo de produção, mesmo
 * modelo, mesmo prompt, mesmo esquema. Não é uma reimplementação: uma cópia do
 * prompt divergiria do original na primeira edição e mediria outra coisa.
 *
 * NÃO ESCREVE NADA. Sem banco, sem WhatsApp, sem alteração de estado — só a
 * chamada ao modelo e a comparação com o rótulo do caso.
 *
 *   cd apps/web && npx tsx ../../scripts/bancada/pos-integral/sinal.mts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CASOS } from "./casos.mjs";

// env antes de qualquer import que leia process.env na carga
const ENV = resolve(process.cwd(), ".env.local");
for (const linha of readFileSync(ENV, "utf8").split(/\r?\n/)) {
  const m = linha.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY ausente em apps/web/.env.local");
  process.exit(1);
}

const { decidirTurno } = await import("../../../apps/web/src/lib/conducao/decisao-do-turno");

/**
 * ⚠️ DOIS VOCABULÁRIOS, E ELES NÃO SÃO O MESMO — bug que esta bancada teve na
 * primeira rodada e que escondeu o achado inteiro.
 *
 * O caso rotula `fonte_esperada: "pos"`; o decisor devolve
 * `"pos_neurodesenvolvimento"`. A primeira versão comparou os dois com o mesmo
 * Set, e todo caso `pos` caiu como "não devia abrir" — o relatório imprimiu
 * "casos que deviam abrir: 3" quando eram 12, e "falso negativo: 2" quando eram
 * 10. Um harness errado não devolve erro: devolve um número tranquilizador.
 */
const ABRE_A_POS = new Set(["pos_neurodesenvolvimento", "combinacao"]);
/** Rótulo do caso → valor que o decisor usaria para a mesma ideia. */
const ROTULO_PARA_SINAL: Record<string, string> = {
  pos: "pos_neurodesenvolvimento",
  combinacao: "combinacao",
  boas_praticas: "boas_praticas",
  nenhum: "nenhum",
};

type Linha = {
  id: string;
  esperado: string;
  obtido: string;
  tema: string | null;
  /** ⚠️ CASO I do §12: a correção não pode quebrar o que já funcionava. */
  intencao: string;
  pedido: boolean;
  natureza: string | null;
  abriuCerto: boolean;
  exato: boolean;
  ms: number;
};

const linhas: Linha[] = [];

for (const caso of CASOS) {
  const t0 = Date.now();
  let obtido = "(erro)";
  let tema: string | null = null;
  let intencao = "?";
  let pedido = false;
  let natureza: string | null = null;
  try {
    const d = await decidirTurno({
      texto: caso.relato,
      // Turno isolado: sem estado, sem fala anterior. É o cenário mais duro
      // para o classificador e o mais honesto para medir o sinal sozinho.
      blocoEstado: "<estado></estado>",
      catalogoSkills: [],
      catalogoDisponivel: true,
    });
    obtido = d.necessidadeConhecimento;
    tema = d.temaConhecimento;
    intencao = d.intencao;
    pedido = d.pedidoExplicito;
    natureza = d.naturezaEmocional;
  } catch (e) {
    obtido = `(erro: ${e instanceof Error ? e.message.slice(0, 40) : "?"})`;
  }
  const ms = Date.now() - t0;
  const esperadoNoVocabulario = ROTULO_PARA_SINAL[caso.fonte_esperada];
  const deviaAbrir = ABRE_A_POS.has(esperadoNoVocabulario);
  const abriu = ABRE_A_POS.has(obtido);
  linhas.push({
    id: caso.id,
    esperado: caso.fonte_esperada,
    obtido,
    tema,
    intencao,
    pedido,
    natureza,
    abriuCerto: deviaAbrir === abriu,
    exato: obtido === esperadoNoVocabulario,
    ms,
  });
  process.stdout.write(".");
}
console.log("\n");

const p = (s: unknown, n: number) => String(s ?? "—").padEnd(n).slice(0, n);
console.log(p("id", 5) + p("esperado", 16) + p("obtido", 22) + p("porta", 8) + p("tema_conhecimento", 34));
console.log("-".repeat(85));
for (const l of linhas) {
  console.log(
    p(l.id, 5) + p(l.esperado, 16) + p(l.obtido, 22) + p(l.abriuCerto ? "ok" : "ERRO", 8) + p(l.tema, 34),
  );
}

const portaOk = linhas.filter((l) => l.abriuCerto).length;
const exatos = linhas.filter((l) => l.exato).length;
const devia = linhas.filter((l) => ABRE_A_POS.has(ROTULO_PARA_SINAL[l.esperado]));
const abriuSemDever = linhas.filter((l) => !ABRE_A_POS.has(ROTULO_PARA_SINAL[l.esperado]) && ABRE_A_POS.has(l.obtido));
const naoAbriuDevendo = linhas.filter((l) => ABRE_A_POS.has(ROTULO_PARA_SINAL[l.esperado]) && !ABRE_A_POS.has(l.obtido));
const ms = linhas.map((l) => l.ms).sort((a, b) => a - b);

console.log("\n=== PLACAR DO SINAL ===");
console.log(`casos: ${linhas.length}`);
console.log(`PORTA correta (abriu quando devia, fechou quando não devia): ${portaOk}/${linhas.length}`);
console.log(`valor EXATO (bate com o rótulo das 5 categorias): ${exatos}/${linhas.length}`);
console.log(`falso POSITIVO (abriu a pós sem precisar): ${abriuSemDever.length}  ${abriuSemDever.map((l) => l.id).join(",")}`);
console.log(`falso NEGATIVO (precisava da pós e não abriu): ${naoAbriuDevendo.length}  ${naoAbriuDevendo.map((l) => l.id).join(",")}`);
console.log(`casos que deviam abrir: ${devia.length}`);
console.log(`latência: mediana ${ms[Math.floor(ms.length / 2)]}ms · máx ${Math.max(...ms)}ms`);
console.log("\n⚠️ O falso NEGATIVO é o erro barato (a Ayla segue como hoje).");
console.log("   O falso POSITIVO é o caro: fundamento clínico num desabafo.");

/**
 * ⚠️ CASO I DO §12 — O QUE JÁ FUNCIONAVA CONTINUA FUNCIONANDO?
 *
 * A correção mexeu no prompt COMPARTILHADO do decisor. `intencao`,
 * `pedido_explicito` e `natureza_emocional` saem da MESMA chamada e governam
 * features em produção — a Rotina, o Plano e os bloqueadores do convite de
 * Perfil. Medir só o campo que eu quis melhorar é o erro clássico: corrigir o
 * alvo e derrubar o vizinho sem perceber.
 */
console.log("\n=== REGRESSÃO: os outros campos da MESMA chamada ===");
console.log(p("id", 5) + p("intencao", 14) + p("pedido_explicito", 18) + p("natureza_emocional", 20));
console.log("-".repeat(57));
for (const l of linhas) console.log(p(l.id, 5) + p(l.intencao, 14) + p(String(l.pedido), 18) + p(l.natureza, 20));
const intencoes = new Map<string, number>();
for (const l of linhas) intencoes.set(l.intencao, (intencoes.get(l.intencao) ?? 0) + 1);
console.log("\ndistribuição de intencao: " + [...intencoes].map(([k, v]) => `${k}=${v}`).join(" · "));
console.log("pedido_explicito=true: " + linhas.filter((l) => l.pedido).length);
console.log("natureza_emocional=desabafo: " + linhas.filter((l) => l.natureza === "desabafo").length + " (esperado 1 — N1)");
console.log("natureza_emocional=null (fail-safe): " + linhas.filter((l) => l.natureza === null).length + " (esperado 0)");
