/**
 * FATIA 2 · move o ROTEADOR ESPECIALIZADO para antes do ramo experimental.
 *
 * ⚠️ POR QUE UM SCRIPT, E NÃO EDIÇÃO À MÃO. São 527 linhas contíguas, sete
 * blocos, dentro de uma função de 4.000 linhas. Mover isso à mão é convite a
 * perder uma chave ou duplicar um bloco — e "bloco duplicado" significa duas
 * mensagens para a mesma mãe. O script recorta e cola por índice e depois
 * PROVA que o conteúdo movido é byte a byte o mesmo.
 *
 * Uso:  node scripts/fatia2-mover-roteador.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const P = "apps/web/src/lib/ayla/orchestrator.ts";
const orig = readFileSync(P, "utf8");
const L = orig.split("\n");
const idx = (s) => L.findIndex((l) => l.includes(s));

const iExpCom = idx("// 3a-EXP. A PORTA AO LADO");
const iCabec = iExpCom - 1; // a linha de ═══ logo acima
const iFds = idx("// 3a. Resposta à oferta de fim de semana");
const iParser = L.findIndex((l, n) => n > iFds && l.trim() === "// 4. Parser IA");

if (iCabec < 0 || iFds < 0 || iParser < 0) throw new Error("âncoras não encontradas");
if (!(iCabec < iFds && iFds < iParser)) throw new Error("ordem das âncoras inesperada");

const antes = L.slice(0, iCabec);
const ramoExp = L.slice(iCabec, iFds); // o ramo experimental inteiro
const regiao = L.slice(iFds, iParser); // os sete blocos, contíguos
const depois = L.slice(iParser);

const NOTA = [
  "  // ══════════════════════════════════════════════════════════════════════",
  "  // ROTEADOR ESPECIALIZADO — subiu para ANTES do experimental (15/08/2026)",
  "  // ══════════════════════════════════════════════════════════════════════",
  "  //",
  "  // ⚠️ FATIA 2 DA OPÇÃO C. Estes sete blocos ficavam DEPOIS do ramo",
  "  // experimental, e o return dele os pulava inteiros. Uma família da",
  "  // allowlist que pedisse a rotina de terça, um Plano ou o roteiro de fim",
  "  // de semana não recebia a capacidade: recebia uma resposta conversacional",
  "  // SOBRE a capacidade. Não é o mesmo produto.",
  "  //",
  "  // ⚠️ ELES NÃO SÃO PÓS-RESPOSTA — SÃO UM ROTEADOR. Cada um termina em",
  "  // return { tratada: true }. Rodá-los DEPOIS do experimental enviaria uma",
  "  // segunda mensagem, que é justamente o defeito que aquele return existe",
  "  // para impedir. Por isso subiram, em vez de serem reexecutados.",
  "  //",
  "  // ⚠️ A ORDEM ENTRE ELES NÃO MUDOU, e ela é significativa: rotina vem antes",
  "  // de plano porque o pedido é mais específico, e escolher-criança vem antes",
  "  // do classificador porque a resposta 'Lucas, 5 anos' não é rotina nem",
  "  // plano. O bloco foi movido inteiro e contíguo, exatamente como estava.",
  "  //",
  "  // ⚠️ NENHUM DELES CUSTA LLM PARA DECIDIR. Os gates são regex sobre o texto",
  "  // ou estado já lido lá em cima, junto das preferências. O parser continua",
  "  // abaixo — e continua sendo o que o experimental existe para evitar.",
  "",
];

const NOTA_EXP = [
  "  // ⚠️ 15/08/2026 · O EXPERIMENTAL DESCEU PARA DEPOIS DO ROTEADOR. Ele deixa",
  "  // de ser a primeira porta e passa a ser o que sempre foi na intenção: quem",
  "  // responde quando NENHUMA intenção especializada casou. As proteções que",
  "  // não podem ser puladas continuam acima dele; as capacidades maduras,",
  "  // agora, também.",
  "",
];

const novo = [...antes, ...NOTA, ...regiao, ...NOTA_EXP, ...ramoExp, ...depois];
writeFileSync(P, novo.join("\n"), "utf8");

// ── PROVAS ────────────────────────────────────────────────────────────────
const notas = new Set([...NOTA, ...NOTA_EXP]);
// Remove exatamente uma ocorrência de cada linha de nota, na ordem em que
// foram inseridas — comparar por Set esconderia duplicata.
const semNotas = [];
let restaNota = [...NOTA, ...NOTA_EXP];
for (const l of novo) {
  const i = restaNota.indexOf(l);
  if (i !== -1 && notas.has(l)) {
    restaNota.splice(i, 1);
    continue;
  }
  semNotas.push(l);
}

// ⚠️ COMPARAR EM ORDEM AQUI SERIA ERRADO — a ordem mudou, e mudar a ordem é o
// objetivo. O que prova um MOVE é: (a) o multiconjunto de linhas é idêntico
// (nada sumiu, nada duplicou) e (b) a região continua contígua e byte a byte
// igual no destino.
const ordenado = (a) => [...a].sort().join("\n");
const iRegiaoNova = novo.findIndex((l) => l.includes("// 3a. Resposta à oferta de fim de semana"));
const regiaoNoDestino = novo.slice(iRegiaoNova, iRegiaoNova + regiao.length);

const ck = [
  ["nada se perdeu (mesma contagem de linhas)", semNotas.length === L.length],
  ["multiconjunto de linhas idêntico — nada sumiu nem duplicou", ordenado(semNotas) === ordenado(L)],
  ["a região chegou inteira e contígua ao destino", regiaoNoDestino.join("\n") === regiao.join("\n")],
  ["a região saiu do lugar antigo (não foi cópia)", novo.filter((l) => l.includes("// 3a. Resposta à oferta de fim de semana")).length === 1],
  ["roteador vem ANTES do experimental", iRegiaoNova < novo.findIndex((l) => l.includes("if (ehFamiliaExperimental(family.id))"))],
  ["parser continua DEPOIS de tudo", novo.findIndex((l) => l.includes("if (ehFamiliaExperimental(family.id))")) < novo.findIndex((l, n) => n > iRegiaoNova && l.trim() === "// 4. Parser IA")],
  ["as notas entraram uma vez cada", restaNota.length === 0],
];
console.log("linhas antes :", L.length);
console.log("linhas depois:", novo.length, `(+${novo.length - L.length})`);
console.log("região movida:", regiao.length, "linhas");
console.log("");
for (const [r, o] of ck) console.log(` ${o ? "OK " : "FALHOU "} ${r}`);
if (ck.some(([, o]) => !o)) process.exit(1);
