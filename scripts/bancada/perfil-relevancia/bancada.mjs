/**
 * BANCADA — RECUPERAÇÃO DE PERFIL POR RELEVÂNCIA (determinística, sem LLM).
 *
 * NÃO É CÓDIGO DE PRODUTO. Nada aqui é importado pelo app. Existe para medir,
 * ANTES de implementar, se uma heurística lexical consegue substituir o
 * "3 mais recentes" sem perder o domínio que a mãe acabou de citar.
 *
 * Três estratégias, mesmas mensagens, mesmo perfil:
 *   A · top-3 por recência ......... o que está no ar hoje
 *   B · relevância lexical pura .... rótulo + frase + o TEXTO já guardado
 *   C · B + sinônimos + orçamento .. a proposta
 *
 * ⚠️ O TEXTO DO DOMÍNIO É VOCABULÁRIO. "Resiste a entrar na sala" casa com
 * "não quer entrar na escola" pela palavra "entrar" — sem lista nenhuma. É o
 * sinal mais barato que existe, e é o que B mede.
 */

/** Rótulo e frase saem de `lib/conducao/temas.ts` — copiados, não importados. */
const TEMAS = {
  sono: { rotulo: "Sono", frase: "o sono" },
  escola: { rotulo: "Escola", frase: "a escola" },
  nutricional: { rotulo: "Alimentação", frase: "a alimentação" },
  emocional: { rotulo: "Regulação emocional", frase: "as emoções e as crises" },
  comunicacao: { rotulo: "Comunicação", frase: "a comunicação" },
  sensorial: { rotulo: "Sensorial", frase: "a parte sensorial" },
  foco: { rotulo: "Foco", frase: "o foco" },
  socializacao: { rotulo: "Socialização", frase: "a socialização" },
  rotina: { rotulo: "Rotina", frase: "a rotina e as transições" },
  motor: { rotulo: "Motor", frase: "a parte motora" },
  autonomia: { rotulo: "Autonomia", frase: "a autonomia" },
};

/**
 * SINÔNIMOS — o custo honesto da proposta C.
 * Conteúdo estático que alguém escreve e mantém. Curto de propósito: cada
 * palavra a mais é uma chance a mais de puxar o domínio errado.
 */
const SINONIMOS = {
  sono: ["dormir", "durmo", "cama", "madrugada", "soneca", "acordar", "apagar", "noite", "sono"],
  escola: ["aula", "professora", "sala", "colégio", "creche", "escolinha", "turma", "recreio"],
  nutricional: ["comer", "comida", "almoço", "jantar", "prato", "textura", "seletiv"],
  emocional: ["crise", "birra", "chora", "explode", "frustra", "raiva", "descontrol"],
  comunicacao: ["fala", "falar", "palavra", "frase", "aponta", "gesto", "pedir"],
  sensorial: ["barulho", "ruído", "som", "toque", "etiqueta", "roupa", "luz", "cheiro", "textura"],
  foco: ["concentra", "atenção", "distrai", "termina"],
  socializacao: ["amigo", "brincar junto", "colega", "outras crianças", "sozinho"],
  rotina: ["transição", "mudança", "sair", "chegar", "horário", "trocar de"],
  motor: ["pedalar", "correr", "escada", "equilíbrio", "cair"],
  autonomia: ["sozinho", "vestir", "roupa", "banho", "escovar", "desfralde", "fralda"],
};

/** O perfil da bancada: 8 domínios com texto e datas conhecidas. */
const PERFIL = {
  sono: { texto: "Acorda 2x por noite e demora a voltar a dormir", em: "2026-08-14" },
  emocional: { texto: "Chora quando muda a rotina sem aviso", em: "2026-08-13" },
  nutricional: { texto: "Só aceita alimentos secos e crocantes", em: "2026-08-12" },
  comunicacao: { texto: "Fala frases de 3 a 4 palavras", em: "2026-08-10" },
  foco: { texto: "Mantém atenção 5 minutos em tarefa dirigida", em: "2026-08-05" },
  socializacao: { texto: "Brinca ao lado, ainda não brinca junto", em: "2026-08-04" },
  sensorial: { texto: "Cobre os ouvidos com barulho alto", em: "2026-08-03" },
  escola: { texto: "Resiste a entrar na sala nas segundas", em: "2026-08-01" },
};

// ⚠️ A lista de parada roda DEPOIS da normalização — por isso "nao", e não
// "não". A primeira versão desta bancada deixou "não" acentuado aqui e o
// `socializacao` virou falso positivo em quatro casos, por casar com o "não"
// do texto dele. O defeito era da bancada, não da estratégia.
const PARE = new Set("a o e de da do que com na no em um uma os as para pra por ele ela muito toda todo todos hora esta que nao sim mais meu minha seu sua tem quando disseram sobre".split(/\s+/));

function palavras(t) {
  return (t ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !PARE.has(w));
}

/** Raiz curta — aproxima "chora"/"chorando", "fala"/"falando". */
// ⚠️ QUATRO, não cinco. Com cinco, "dorme" e "dormir" viram raizes diferentes
// ("dorme"/"dormi") e a bancada perdia o sono numa frase que dizia "dorme".
// Quatro casa dorm-, com-, chor-. Menos que isso comeca a colidir.
const raiz = (w) => w.slice(0, 4);

function pontuar(msg, chave, usarSinonimos) {
  const m = new Set(palavras(msg).map(raiz));
  const t = TEMAS[chave] ?? { rotulo: chave, frase: chave };
  let s = 0;
  const porque = [];
  for (const w of palavras(t.rotulo)) if (m.has(raiz(w))) { s += 3; porque.push(`rótulo:${w}`); }
  for (const w of palavras(t.frase)) if (m.has(raiz(w))) { s += 2; porque.push(`frase:${w}`); }
  for (const w of palavras(PERFIL[chave]?.texto)) if (m.has(raiz(w))) { s += 1; porque.push(`texto:${w}`); }
  if (usarSinonimos) {
    for (const w of SINONIMOS[chave] ?? []) {
      for (const p of palavras(w)) if (m.has(raiz(p))) { s += 3; porque.push(`sin:${w}`); break; }
    }
  }
  return { s, porque: [...new Set(porque)] };
}

const linha = (k) => `- ${TEMAS[k]?.rotulo ?? k}: ${PERFIL[k].texto}`;
const chaves = Object.keys(PERFIL);

function estrategiaA() {
  return [...chaves].sort((a, b) => PERFIL[b].em.localeCompare(PERFIL[a].em)).slice(0, 3);
}
function estrategiaB(msg) {
  return chaves
    .map((k) => ({ k, ...pontuar(msg, k, false) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || PERFIL[b.k].em.localeCompare(PERFIL[a.k].em))
    .map((x) => x.k);
}
const ORCAMENTO = 320;
function estrategiaC(msg) {
  const marcados = chaves
    .map((k) => ({ k, ...pontuar(msg, k, true) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || PERFIL[b.k].em.localeCompare(PERFIL[a.k].em));
  const out = [];
  let chars = 0;
  for (const x of marcados) {
    const c = linha(x.k).length + 1;
    if (chars + c > ORCAMENTO) break;
    out.push(x.k);
    chars += c;
  }
  return { sel: out, marcados, estourou: marcados.length > out.length };
}

const CASOS = [
  ["termo explícito", "me ajuda com o sono", ["sono"]],
  ["sinônimo", "ela não quer ir pra aula", ["escola"]],
  ["coloquial", "está impossível na hora de apagar", ["sono"]],
  ["transversal", "o barulho da sala deixa ela muito agitada", ["escola", "sensorial"]],
  ["não-lexical", "ela arranca a roupa toda hora", ["sensorial"]],
  ["mudança de assunto", "e sobre a comida, ela só quer bolacha", ["nutricional"]],
  ["domínio antigo", "voltou a resistir na segunda de manhã", ["escola"]],
  ["vários possíveis", "ela chora, não come e não dorme direito", ["emocional", "nutricional", "sono"]],
  ["desconhecido", "me ajuda com o desfralde", []],
  ["longa, 2 problemas", "ela tem chorado muito quando mudo a rotina e na escola disseram que ela não entra na sala", ["emocional", "rotina", "escola"]],
];

const acertos = { A: 0, B: 0, C: 0 };
const falsos = { A: 0, B: 0, C: 0 };
let esperadosTotal = 0;

for (const [tipo, msg, esperado] of CASOS) {
  const A = estrategiaA();
  const B = estrategiaB(msg);
  const { sel: C, marcados, estourou } = estrategiaC(msg);
  esperadosTotal += esperado.length;
  for (const [nome, sel] of [["A", A], ["B", B], ["C", C]]) {
    acertos[nome] += esperado.filter((e) => sel.includes(e)).length;
    falsos[nome] += sel.filter((s) => !esperado.includes(s)).length;
  }
  const chars = C.map((k) => linha(k).length + 1).reduce((a, b) => a + b, 0);
  console.log(`\n${"=".repeat(76)}\n[${tipo}] "${msg}"\n  esperado: ${esperado.join(", ") || "(nenhum)"}`);
  console.log(`  A recência : ${A.join(", ")}   ${esperado.every((e) => A.includes(e)) ? "✅" : "❌ perde " + esperado.filter((e) => !A.includes(e)).join(",")}`);
  console.log(`  B lexical  : ${B.join(", ") || "(vazio)"}   ${esperado.length && esperado.every((e) => B.includes(e)) ? "✅" : esperado.length ? "❌" : B.length ? "❌ falso positivo" : "✅"}`);
  console.log(`  C proposta : ${C.join(", ") || "(vazio)"}   ${esperado.length && esperado.every((e) => C.includes(e)) ? "✅" : esperado.length ? "❌" : C.length ? "❌ falso positivo" : "✅"}  [${chars} chars${estourou ? ", cortado pelo orçamento" : ""}]`);
  for (const x of marcados.slice(0, 4)) console.log(`      ${x.k} = ${x.s}  (${x.porque.join(" ") || "—"})`);
}

console.log(`\n${"=".repeat(76)}\nPLACAR (${esperadosTotal} domínios esperados no total)`);
for (const n of ["A", "B", "C"]) {
  console.log(`  ${n}: recuperou ${acertos[n]}/${esperadosTotal}  ·  trouxe ${falsos[n]} domínio(s) não esperado(s)`);
}
