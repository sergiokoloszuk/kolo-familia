import XLSX from "xlsx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from "node:fs";

/**
 * Gera o catálogo de brincadeiras e atividades a partir do acervo curado
 * (368 boas práticas), organizado por FAIXA ETÁRIA e por TEMA.
 *
 * Script de uso único — a fonte da verdade continua sendo o XLSX / a tabela
 * `boas_praticas`. Este PDF é uma VISTA do acervo, não uma cópia paralela.
 */

const XLSX_PATH = "data/import/Kolo_Familia_Boas_Praticas_FASE3_AJUSTADO (1).xlsx";
const OUT = "docs/Kolo_Brincadeiras_e_Atividades.pdf";

const wb = XLSX.readFile(XLSX_PATH);
const all = [
  ...XLSX.utils.sheet_to_json(wb.Sheets["BPs por skill"], { defval: "" }),
  ...XLSX.utils.sheet_to_json(wb.Sheets["BPs transversais"], { defval: "" }),
];

// ---------- normalização de texto (WinAnsi não aceita emoji/aspas curvas) ----------
function limpar(s) {
  return String(s ?? "")
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—―]/g, "-")
    .replace(/…/g, "...")
    .replace(/[   ]/g, " ")
    .replace(/→/g, "->")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    // tudo fora de Latin-1 sai (emoji, setas exóticas, caixas)
    .replace(/[^\x09\x0A\x20-\x7E¡-ÿ]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

const FAIXAS = [
  { key: "0-1", label: "0 a 12 meses - bebes", match: (f) => /0-12 m/.test(f) },
  { key: "1-3", label: "1 a 3 anos - primeira infancia", match: (f) => /1-3/.test(f) },
  { key: "4-6", label: "4 a 6 anos - pre-escolar", match: (f) => /4-6/.test(f) },
  { key: "7-12", label: "7 a 12 anos - idade escolar", match: (f) => /7-12/.test(f) },
  { key: "13-18", label: "13 a 18 anos - adolescencia", match: (f) => /13-18/.test(f) },
];

function faixaDe(r) {
  const f = String(r["Faixa etária"] ?? "");
  for (const x of FAIXAS) if (x.match(f)) return x.key;
  return "?";
}

const PLAY = /brincar|brincadeir|brinquedo|jogo|jogar|l[úu]dic|faz de conta/i;
const ehBrincadeira = (r) =>
  PLAY.test([r["Orientação"], r["Quando usar"], r["Versão curta"], r["Atividades"]].join(" "));

// ---------- montagem do PDF ----------
const doc = await PDFDocument.create();
const reg = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);
const italic = await doc.embedFont(StandardFonts.HelveticaOblique);

const A4 = [595.28, 841.89];
const M = { top: 56, bottom: 56, left: 52, right: 52 };
const LARG = A4[0] - M.left - M.right;

const VERDE = rgb(0.15, 0.35, 0.28);
const CINZA = rgb(0.42, 0.42, 0.42);
const PRETO = rgb(0.13, 0.13, 0.13);
const LINHA = rgb(0.85, 0.85, 0.85);

let page = null;
let y = 0;
let nPag = 0;

function novaPagina() {
  page = doc.addPage(A4);
  nPag += 1;
  y = A4[1] - M.top;
  // rodapé
  const rod = `Kolo Familia - Brincadeiras e Atividades   |   ${nPag}`;
  page.drawText(rod, {
    x: M.left,
    y: M.bottom - 24,
    size: 7.5,
    font: reg,
    color: rgb(0.62, 0.62, 0.62),
  });
}

function espaco(n) {
  if (y - n < M.bottom) novaPagina();
  else y -= n;
}

function quebrar(texto, font, size, largura) {
  const linhas = [];
  for (const paragrafo of texto.split("\n")) {
    const palavras = paragrafo.split(" ").filter(Boolean);
    if (palavras.length === 0) { linhas.push(""); continue; }
    let atual = "";
    for (const p of palavras) {
      const teste = atual ? `${atual} ${p}` : p;
      if (font.widthOfTextAtSize(teste, size) <= largura) atual = teste;
      else { if (atual) linhas.push(atual); atual = p; }
    }
    if (atual) linhas.push(atual);
  }
  return linhas;
}

function escrever(texto, { font = reg, size = 9.5, cor = PRETO, recuo = 0, entre = 3.2 } = {}) {
  const linhas = quebrar(limpar(texto), font, size, LARG - recuo);
  for (const l of linhas) {
    if (y - size < M.bottom) novaPagina();
    page.drawText(l, { x: M.left + recuo, y: y - size, size, font, color: cor });
    y -= size + entre;
  }
}

function regua() {
  if (y - 8 < M.bottom) novaPagina();
  page.drawLine({
    start: { x: M.left, y: y - 4 },
    end: { x: M.left + LARG, y: y - 4 },
    thickness: 0.6,
    color: LINHA,
  });
  y -= 12;
}

// ---------- capa ----------
novaPagina();
y = A4[1] - 200;
escrever("Kolo Familia", { font: bold, size: 26, cor: VERDE, entre: 10 });
escrever("Brincadeiras e Atividades", { font: bold, size: 26, cor: PRETO, entre: 8 });
espaco(10);
escrever("Catalogo completo do acervo, por faixa etaria e por tema", {
  font: italic, size: 12, cor: CINZA, entre: 6,
});
espaco(28);
escrever(
  "Este documento e uma VISTA do acervo curado de boas praticas da plataforma. " +
    "Cada atividade abaixo esta hoje disponivel para a Ayla usar em conversas, planos e materiais. " +
    "A fonte da verdade continua sendo o acervo - este PDF nao substitui nem duplica o conteudo, " +
    "apenas o organiza para leitura humana.",
  { size: 10, cor: PRETO, entre: 4 },
);
espaco(20);
const hoje = new Date().toLocaleDateString("pt-BR");
escrever(`Gerado em ${hoje}  -  ${all.length} praticas no acervo`, { size: 9, cor: CINZA });

// ---------- sumário / números ----------
novaPagina();
escrever("O que tem aqui", { font: bold, size: 16, cor: VERDE, entre: 8 });
espaco(6);

const porFaixa = {};
const porTema = {};
let totalBrinc = 0;
for (const r of all) {
  const f = faixaDe(r);
  const t = String(r["Skill principal"] ?? "-");
  porFaixa[f] = (porFaixa[f] ?? 0) + 1;
  porTema[t] = (porTema[t] ?? 0) + 1;
  if (ehBrincadeira(r)) totalBrinc += 1;
}

escrever(
  `O acervo tem ${all.length} praticas, e todas trazem uma atividade concreta para fazer com a crianca. ` +
    `Destas, ${totalBrinc} sao explicitamente de brincadeira, jogo ou atividade ludica.`,
  { size: 10, entre: 4 },
);
espaco(12);

escrever("Por faixa etaria", { font: bold, size: 11.5, cor: VERDE, entre: 6 });
for (const f of FAIXAS) {
  escrever(`${String(porFaixa[f.key] ?? 0).padStart(3, " ")}   ${f.label}`, { size: 10, recuo: 10, entre: 3 });
}
espaco(12);

escrever("Por tema", { font: bold, size: 11.5, cor: VERDE, entre: 6 });
for (const [t, n] of Object.entries(porTema).sort((a, b) => b[1] - a[1])) {
  escrever(`${String(n).padStart(3, " ")}   ${t}`, { size: 10, recuo: 10, entre: 3 });
}
espaco(16);

escrever("Como ler cada ficha", { font: bold, size: 11.5, cor: VERDE, entre: 6 });
escrever(
  "COMO FAZER - a atividade em si, o que a familia faz com a crianca.\n" +
    "QUANDO USAR - o momento ou a dificuldade em que ela serve.\n" +
    "O QUE EVITAR - o erro mais comum do adulto nessa situacao.\n" +
    "O codigo entre colchetes e o identificador da pratica no acervo.",
  { size: 9.5, recuo: 10, entre: 3 },
);

// ---------- corpo: faixa -> tema -> fichas ----------
let seq = 0;
for (const faixa of FAIXAS) {
  const doFaixa = all.filter((r) => faixaDe(r) === faixa.key);
  if (doFaixa.length === 0) continue;

  novaPagina();
  escrever(faixa.label.toUpperCase(), { font: bold, size: 15, cor: VERDE, entre: 6 });
  escrever(`${doFaixa.length} atividades nesta faixa`, { font: italic, size: 9.5, cor: CINZA, entre: 4 });
  // régua grossa marcando a abertura da faixa
  page.drawLine({
    start: { x: M.left, y: y - 2 },
    end: { x: M.left + LARG, y: y - 2 },
    thickness: 2,
    color: VERDE,
  });
  y -= 18;

  const temas = [...new Set(doFaixa.map((r) => String(r["Skill principal"] ?? "-")))].sort();
  for (const tema of temas) {
    const doTema = doFaixa.filter((r) => String(r["Skill principal"] ?? "-") === tema);

    espaco(14);
    if (y < M.bottom + 90) novaPagina();
    escrever(`${tema}  (${doTema.length})`, { font: bold, size: 12, cor: VERDE, entre: 5 });
    regua();

    for (const r of doTema) {
      seq += 1;
      // altura mínima para não deixar título órfão no pé da página
      if (y < M.bottom + 110) novaPagina();

      const titulo = limpar(r["Versão curta"]).replace(/\s+/g, " ").slice(0, 150);
      const marca = ehBrincadeira(r) ? "[brincadeira]  " : "";
      escrever(`${marca}${titulo}`, { font: bold, size: 10, cor: PRETO, entre: 4 });

      const atividade = limpar(r["Atividades"]);
      if (atividade) escrever(`COMO FAZER   ${atividade}`, { size: 9.5, recuo: 12, entre: 3 });

      const quando = limpar(r["Quando usar"]);
      if (quando) escrever(`QUANDO USAR   ${quando}`, { size: 9.5, recuo: 12, cor: CINZA, entre: 3 });

      const erro = limpar(r["Erros comuns"]);
      if (erro) escrever(`O QUE EVITAR   ${erro.slice(0, 320)}`, { size: 9, recuo: 12, cor: CINZA, entre: 3 });

      escrever(`[${limpar(r.ID)}]`, { size: 7.5, recuo: 12, cor: rgb(0.66, 0.66, 0.66), entre: 6 });
    }
  }
}

// ---------- índice final: tema -> faixa ----------
novaPagina();
escrever("Indice por tema", { font: bold, size: 16, cor: VERDE, entre: 8 });
escrever("O mesmo acervo, agora agrupado por tema - para quando a busca comeca pelo assunto.", {
  font: italic, size: 9.5, cor: CINZA, entre: 4,
});
espaco(14);

for (const [tema] of Object.entries(porTema).sort((a, b) => b[1] - a[1])) {
  const doTema = all.filter((r) => String(r["Skill principal"] ?? "-") === tema);
  if (y < M.bottom + 70) novaPagina();
  escrever(`${tema}  (${doTema.length})`, { font: bold, size: 11.5, cor: VERDE, entre: 5 });
  for (const faixa of FAIXAS) {
    const n = doTema.filter((r) => faixaDe(r) === faixa.key);
    if (n.length === 0) continue;
    escrever(`${faixa.label}  -  ${n.length}`, { size: 9.5, recuo: 12, cor: CINZA, entre: 2.5 });
    for (const r of n) {
      escrever(`- ${limpar(r["Versão curta"]).slice(0, 118)}  [${limpar(r.ID)}]`, {
        size: 8.5, recuo: 24, entre: 2.2,
      });
    }
  }
  espaco(8);
}

fs.mkdirSync("docs", { recursive: true });
fs.writeFileSync(OUT, await doc.save());
console.log(`OK -> ${OUT}  (${nPag} paginas, ${seq} fichas, ${totalBrinc} marcadas como brincadeira)`);
