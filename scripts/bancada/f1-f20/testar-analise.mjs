/**
 * TESTE DA ANÁLISE — o instrumento antes da medição, parte 2.
 *
 *     node scripts/bancada/f1-f20/testar-analise.mjs
 *
 * ⚠️ POR QUE ISTO EXISTE. A tabela "Feature — sequestro do turno" pareava A com
 * B por `.find()` em caso + mensagem. `.find()` devolve o PRIMEIRO que casa —
 * a execução 1 — e as quatro linhas do relatório mostravam quatro vezes o mesmo
 * valor de B. `regressao-karina — "Consegue trazer?"` saiu como B agindo em 4
 * de 4 quando o bruto dizia 3 de 4: o relatório fabricava consistência a partir
 * de variação, exatamente o erro que a bancada existe para não cometer.
 *
 * Sem rede e sem custo. Sai com código 1 se qualquer regra falhar.
 */

import { porExec, classificar, paresDeFeature, resumoFeature, comOrdinal, agiriaNaFeature, PONTOS_DE_SEQUESTRO } from "./analise.mjs";

let falhas = 0;
const igual = (nome, obtido, esperado) => {
  const a = JSON.stringify(obtido), b = JSON.stringify(esperado);
  if (a === b) return console.log(`  ok   ${nome}`);
  falhas++;
  console.log(`  FALHA ${nome}\n         esperado ${b}\n         obtido   ${a}`);
};

/** Turno mínimo, só com o que a análise lê. */
const t = (caso, braco, execucao, mensagem, featureAgiria, esperaFeature = false, vereditos = {}) =>
  ({ caso, braco, execucao, mensagem, featureAgiria, esperaFeature, vereditos });

// ── 1. O DEFEITO ORIGINAL, RECONSTITUÍDO ────────────────────────────────────
// O dado real de 06/09: A nunca agiu, B agiu em 3 das 4 execuções (a 3 não).
console.log("\n1. execuções diferentes não colapsam na execução 1");
const karina = [];
for (const e of [1, 2, 3, 4]) {
  karina.push(t("regressao-karina", "A", e, "E agora?", false));
  karina.push(t("regressao-karina", "A", e, "Consegue trazer?", false));
  karina.push(t("regressao-karina", "B", e, "E agora?", false));
  karina.push(t("regressao-karina", "B", e, "Consegue trazer?", e !== 3));
}
const paresK = paresDeFeature(karina).filter((p) => p.mensagem === "Consegue trazer?");
igual("B por execução preserva a variação", paresK.map((p) => p.bAgiria), [true, true, false, true]);
igual("as execuções vêm rotuladas", paresK.map((p) => p.execucao), [1, 2, 3, 4]);
igual("A por execução", paresK.map((p) => p.aAgiria), [false, false, false, false]);

// O pareamento antigo, para provar que a diferença é real e não cosmética.
const antigo = karina
  .filter((x) => x.esperaFeature !== null && x.braco === "A" && x.mensagem === "Consegue trazer?")
  .map((x) => karina.find((y) => y.caso === x.caso && y.mensagem === x.mensagem && y.braco === "B")?.featureAgiria);
igual("o pareamento antigo colapsava (regressão prendida)", antigo, [true, true, true, true]);
if (JSON.stringify(antigo) === JSON.stringify(paresK.map((p) => p.bAgiria))) {
  falhas++;
  console.log("  FALHA o teste não distingue o método novo do antigo — não prova nada");
}

// ── 2. MESMA FRASE DUAS VEZES NO MESMO CASO ─────────────────────────────────
// Casar por texto colapsaria os dois turnos; o par é (caso, execução, posição).
console.log("\n2. frase repetida dentro do mesmo caso não colapsa");
const repetido = [
  t("eco", "A", 1, "Sim", false), t("eco", "A", 1, "Sim", false),
  t("eco", "B", 1, "Sim", true), t("eco", "B", 1, "Sim", false),
];
igual("ordinal separa os dois turnos", comOrdinal(repetido).map((x) => x.ordinal), [0, 1, 0, 1]);
igual("cada posição pega o seu par", paresDeFeature(repetido).map((p) => p.bAgiria), [true, false]);

// ── 3. EXECUÇÃO SEM PAR NÃO HERDA DE OUTRA ──────────────────────────────────
console.log("\n3. execução sem par vira ausência, não herança");
const torto = [
  t("x", "A", 1, "m", false), t("x", "A", 2, "m", false),
  t("x", "B", 1, "m", true),
];
igual("exec 2 sem B fica null", paresDeFeature(torto).map((p) => p.bAgiria), [true, null]);
igual("erro de B em exec sem par é null", paresDeFeature(torto).map((p) => p.bErrou), [true, null]);

// ── 4. A GUARDA DA AMOSTRA ÚNICA ────────────────────────────────────────────
console.log("\n4. uma execução não prova consistência");
igual("n=1 nunca é regressão", classificar([2], [3]), "amostra unica - inconclusivo");
igual("n=1 nunca é melhoria", classificar([3], [2]), "amostra unica - inconclusivo");
igual("n=1 nem empatado vira veredito", classificar([2], [2]), "amostra unica - inconclusivo");
igual("sem dados", classificar([], []), "sem dados");
igual("n=2 com sinal repetido é regressão", classificar([1, 1], [2, 3]), "regressao consistente");
igual("n=2 com sinal repetido ao contrário é melhoria", classificar([2, 3], [1, 1]), "melhoria consistente");
igual("n=4 idêntico é equivalente", classificar([0, 0, 0, 0], [0, 0, 0, 0]), "equivalente");
igual("sinal que troca é variabilidade", classificar([1, 2], [2, 1]), "inconclusivo por variabilidade");

// ── 5. ORDEM DAS EXECUÇÕES COM DOIS DÍGITOS ─────────────────────────────────
// ⚠️ `.sort()` sem comparador ordena como TEXTO: 1, 10, 2, 3… Com 10 execuções
// — que é o que a bateria direcionada vai rodar — isso embaralharia os pares e
// compararia a execução 10 de A contra a 2 de B.
console.log("\n5. dez execuções pareiam na ordem numérica");
const dez = [];
for (let e = 1; e <= 10; e++) {
  dez.push(t("d", "A", e, "m", false, false, { F1: { veredito: e === 10 ? "fail" : "pass" } }));
  dez.push(t("d", "B", e, "m", false, false, { F1: { veredito: "pass" } }));
}
igual("porExec na ordem 1..10", porExec(dez, "A", "F1"), [0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
igual("execuções pareadas em ordem", paresDeFeature(dez).map((p) => p.execucao), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

// ── 6. RESUMO POR TURNO ─────────────────────────────────────────────────────
console.log("\n6. resumo agrega sem perder a execução");
const r = resumoFeature(karina).find((x) => x.mensagem === "Consegue trazer?");
igual("B agiu por exec", r.bAgiuPorExec, [true, true, false, true]);
igual("erros de A", r.aErros, 0);
igual("erros de B", r.bErros, 3);
igual("n", r.n, 4);
igual("classificação pareada", r.classificacao, "inconclusivo por variabilidade");

// ── 7. TURNO OBSERVADO NÃO VIRA VEREDITO ────────────────────────────────────
console.log("\n7. turno só observado é medido, não cobrado");
const obs = [
  { caso: "o", braco: "A", execucao: 1, mensagem: "Pode", featureAgiria: false, observarDecisao: true, vereditos: {} },
  { caso: "o", braco: "B", execucao: 1, mensagem: "Pode", featureAgiria: true, observarDecisao: true, vereditos: {} },
  { caso: "o", braco: "A", execucao: 2, mensagem: "Pode", featureAgiria: false, observarDecisao: true, vereditos: {} },
  { caso: "o", braco: "B", execucao: 2, mensagem: "Pode", featureAgiria: true, observarDecisao: true, vereditos: {} },
];
const po = paresDeFeature(obs);
igual("entra na medição mesmo sem esperaFeature", po.length, 2);
igual("não recebe gabarito", po.map((p) => p.esperado), [null, null]);
igual("não acusa erro em ninguém", po.map((p) => [p.aErrou, p.bErrou]), [[null, null], [null, null]]);
igual("mas registra a divergência A↔B", po.map((p) => p.divergem), [true, true]);
const ro = resumoFeature(obs)[0];
igual("não é classificado como regressão", ro.classificacao, "observacao - sem gabarito");
igual("divergências contadas", ro.divergencias, 2);

// E o turno COM gabarito continua sendo cobrado normalmente.
const ro2 = resumoFeature(karina).find((x) => x.mensagem === "Consegue trazer?");
igual("turno com gabarito segue classificado", ro2.classificacao, "inconclusivo por variabilidade");
igual("divergências também contadas nele", ro2.divergencias, 3);

// ── 8. O QUE A FAMÍLIA SENTIRIA ≠ O BOOLEANO ────────────────────────────────
console.log("\n8. agiriaNaFeature exige intenção NO ponto de sequestro");
const dec = (intencao, pedidoExplicito) => ({ decisao: { intencao, pedidoExplicito } });
igual("outro + pedido explícito NÃO toma o turno", agiriaNaFeature(dec("outro", true)), false);
igual("rotina_criar + pedido explícito toma", agiriaNaFeature(dec("rotina_criar", true)), true);
igual("rotina_criar SEM pedido explícito não toma", agiriaNaFeature(dec("rotina_criar", false)), false);
igual("plano + pedido explícito toma", agiriaNaFeature(dec("plano", true)), true);
igual("os cinco pontos e nada além", PONTOS_DE_SEQUESTRO.length, 5);
igual("turno ausente não estoura", agiriaNaFeature(null), false);

console.log(falhas ? `\n${falhas} FALHA(S) — a análise não pode ser usada assim.\n` : "\nTodos os casos passaram.\n");
process.exit(falhas ? 1 : 0);
