/**
 * A ANÁLISE DA BANCADA — funções puras, separadas de quem faz as chamadas.
 *
 * ⚠️ POR QUE ISTO SAIU DE `rodar.mjs`. Enquanto o cálculo morava dentro do
 * script que carrega o app, lê `.env.local` e fala com dois provedores, ele era
 * INTESTÁVEL: importar o módulo era rodar a bateria. E instrumento que não se
 * testa mede o que ele mesmo inventa — foi o que aconteceu duas vezes seguidas
 * nesta frente (F11 punindo o nome da criança, e o delta não pareado).
 *
 * Aqui não há rede, nem disco, nem estado global. Entra o array de turnos,
 * sai número. `testar-analise.mjs` prende cada regra abaixo.
 */

/** Fails de um critério, uma contagem por execução, na ordem das execuções. */
export const porExec = (turnos, braco, id) => {
  const execs = [...new Set(turnos.filter((t) => t.braco === braco).map((t) => t.execucao))].sort((x, y) => x - y);
  return execs.map((e) =>
    turnos.filter((t) => t.braco === braco && t.execucao === e && t.vereditos?.[id]?.veredito === "fail").length,
  );
};

export const media = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
export const amplitude = (xs) => (xs.length ? Math.max(...xs) - Math.min(...xs) : 0);

/**
 * O TESTE PAREADO. Só é regressão quando o sinal se repete em TODAS as
 * execuções — a variação dentro de um braço já foi maior que a diferença entre
 * os braços (F10: 3 numa execução e 7 na outra, contra um delta A→B de 3).
 */
export function classificar(a, b) {
  const n = Math.min(a.length, b.length);
  if (n === 0) return "sem dados";
  // ⚠️ UMA EXECUÇÃO NÃO PROVA CONSISTÊNCIA. Com n=1 o teste pareado passa
  // trivialmente — "todos os pares têm o mesmo sinal" é verdade para um par só.
  // Foi o que marcou `mudanca-de-assunto` (2 contra 3) como regressão
  // consistente numa amostra única, que é exatamente a conclusão que esta
  // bancada existe para não deixar tirar.
  if (n < 2) return "amostra unica - inconclusivo";
  const pares = Array.from({ length: n }, (_, i) => b[i] - a[i]);
  if (pares.every((d) => d === 0)) return "equivalente";
  if (pares.every((d) => d > 0)) return "regressao consistente";
  if (pares.every((d) => d < 0)) return "melhoria consistente";
  return "inconclusivo por variabilidade";
}

/**
 * A POSIÇÃO DO TURNO DENTRO DA SUA CONVERSA. É ela que pareia A com B, não o
 * texto da mensagem: um caso pode repetir a mesma frase em dois turnos, e aí
 * casar por texto voltaria a colapsar linhas diferentes na mesma.
 */
export function comOrdinal(turnos) {
  const contador = new Map();
  return turnos.map((t) => {
    const chave = `${t.caso}|${t.braco}|${t.execucao}`;
    const i = contador.get(chave) ?? 0;
    contador.set(chave, i + 1);
    return { ...t, ordinal: i };
  });
}

/**
 * OS PARES A↔B DA DECISÃO DE AGIR.
 *
 * ⚠️ O DEFEITO QUE ISTO CORRIGE. A tabela usava `.find()` por caso + mensagem,
 * que devolve SEMPRE o primeiro turno de B que casa — a execução 1. Com quatro
 * execuções, as quatro linhas do relatório mostravam quatro vezes o mesmo valor
 * de B. `regressao-karina — "Consegue trazer?"` apareceu como B agindo em 4 de
 * 4 quando o dado bruto dizia 3 de 4: o relatório inventava consistência onde
 * havia variação, que é o oposto do que esta bancada existe para fazer.
 *
 * Agora o par é (caso, execução, ordinal do turno). Execução sem par do outro
 * lado fica com `null` e é contada como ausente, nunca herdada de outra.
 */
export function paresDeFeature(turnos) {
  const todos = comOrdinal(turnos);
  const chave = (t) => `${t.caso}|${t.execucao}|${t.ordinal}`;
  const ladoB = new Map(todos.filter((t) => t.braco === "B").map((t) => [chave(t), t]));
  // ⚠️ TURNO OBSERVADO ≠ TURNO COBRADO. Alguns turnos entram para MEDIR a
  // divergência A↔B sem carregar expectativa: "Pode", logo depois de a Ayla
  // oferecer o quadro, é aceite explícito ou continuação de conversa? Isso é
  // decisão de produto, não de bancada. Marcá-los com `observarDecisao` põe o
  // número na mesa sem transformar um palpite meu em pass/fail.
  return todos
    .filter((t) => t.braco === "A" && (t.observarDecisao === true || (t.esperaFeature !== null && t.esperaFeature !== undefined)))
    .map((x) => {
      const b = ladoB.get(chave(x)) ?? null;
      return {
        caso: x.caso,
        execucao: x.execucao,
        ordinal: x.ordinal,
        mensagem: x.mensagem,
        esperado: x.observarDecisao === true ? null : x.esperaFeature,
        soObservacao: x.observarDecisao === true,
        aAgiria: x.featureAgiria,
        bAgiria: b ? b.featureAgiria : null,
        aErrou: x.observarDecisao === true ? null : x.featureAgiria !== x.esperaFeature,
        bErrou: x.observarDecisao === true || !b ? null : b.featureAgiria !== x.esperaFeature,
        divergem: b ? x.featureAgiria !== b.featureAgiria : null,
      };
    });
}

/** Um turno (caso + posição), com o que cada braço decidiu em CADA execução. */
export function resumoFeature(turnos) {
  const pares = paresDeFeature(turnos);
  const grupos = new Map();
  for (const p of pares) {
    const k = `${p.caso}|${p.ordinal}`;
    if (!grupos.has(k)) grupos.set(k, { caso: p.caso, ordinal: p.ordinal, mensagem: p.mensagem, esperado: p.esperado, soObservacao: p.soObservacao, execucoes: [] });
    grupos.get(k).execucoes.push(p);
  }
  return [...grupos.values()].map((g) => {
    g.execucoes.sort((x, y) => x.execucao - y.execucao);
    const errosA = g.execucoes.map((p) => (p.aErrou ? 1 : 0));
    const errosB = g.execucoes.map((p) => (p.bErrou ? 1 : 0));
    const divergencias = g.execucoes.filter((p) => p.divergem === true).length;
    return {
      ...g,
      aAgiuPorExec: g.execucoes.map((p) => p.aAgiria),
      bAgiuPorExec: g.execucoes.map((p) => p.bAgiria),
      aErros: errosA.reduce((s, x) => s + x, 0),
      bErros: errosB.reduce((s, x) => s + x, 0),
      n: g.execucoes.length,
      divergencias,
      // Turno só observado não tem gabarito: classificar seria fabricar veredito.
      classificacao: g.soObservacao ? "observacao - sem gabarito" : classificar(errosA, errosB),
    };
  });
}
