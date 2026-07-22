import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * PDF da rotina pra imprimir e colar na parede — cada passo com uma caixinha
 * pra a criança marcar à mão (o "já passou" no papel). pdf-lib é JS puro, seguro
 * no serverless. Helvetica (WinAnsi) cobre acentos do português.
 */

const ROXO = rgb(0.29, 0.16, 0.5);
const TEXTO = rgb(0.13, 0.12, 0.15);
const CINZA = rgb(0.45, 0.43, 0.48);

// Cor por TIPO de atividade — pra a agenda ficar colorida e legível num olhar.
const TIPOS: Record<string, { label: string; cor: ReturnType<typeof rgb> }> = {
  escola: { label: "Escola", cor: rgb(0.2, 0.45, 0.8) },
  estudo: { label: "Estudo", cor: rgb(0.45, 0.16, 0.7) },
  esporte: { label: "Esporte", cor: rgb(0.16, 0.55, 0.35) },
  terapia: { label: "Terapia", cor: rgb(0.86, 0.5, 0.1) },
  autocuidado: { label: "Autocuidado", cor: rgb(0.82, 0.3, 0.55) },
  refeicao: { label: "Refeicao", cor: rgb(0.8, 0.6, 0.05) },
  livre: { label: "Livre / tela", cor: rgb(0.4, 0.45, 0.55) },
  outro: { label: "Outro", cor: rgb(0.55, 0.53, 0.58) },
};

/** Adivinha o tipo da atividade pelo texto (pra colorir). Best-effort. */
function categorizar(texto: string): string {
  const t = (texto ?? "").toLowerCase();
  if (/escola|aula|col[eé]gio|creche/.test(t)) return "escola";
  if (/estud|tarefa|pomodoro|li[çc][aã]o|dever|prova|revis/.test(t)) return "estudo";
  if (/v[oô]lei|futebol|esporte|nata[çc]|nadar|dan[çc]a|teclado|m[uú]sica|piano|treino|corr/.test(t)) return "esporte";
  if (/terapia|fono|psico|acompanhamento|consulta/.test(t)) return "terapia";
  if (/skincare|banho|acordar|dormir|higiene|escovar|vestir|autocuidado|soneca|descans/.test(t)) return "autocuidado";
  if (/caf[eé]|almo[çc]o|jantar|lanche|comer|refei[çc]|merenda/.test(t)) return "refeicao";
  if (/celular|tela|\blivre\b|\btv\b|v[ií]deo|game|jogar|relax|folga|youtube|dorama|k-?pop/.test(t)) return "livre";
  return "outro";
}

function sanitizar(s: string): string {
  return (s ?? "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    .replace(/[–—]/g, "-")
    .replace(/•/g, "-")
    .replace(/[^\x00-\xFF]/g, "");
}

export async function rotinaParaPdf(params: {
  titulo: string;
  nome?: string | null;
  tema?: string | null;
  dias: Array<{ nome: string; tarefas: Array<{ texto: string; hora: string | null }> }>;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const A4 = { w: 595.28, h: 841.89 };
  const margem = 50;
  const larguraUtil = A4.w - margem * 2;
  let page = doc.addPage([A4.w, A4.h]);
  let y = A4.h - margem;

  function novaPaginaSePreciso(h: number) {
    if (y - h < margem) {
      page = doc.addPage([A4.w, A4.h]);
      y = A4.h - margem;
    }
  }

  function quebrar(texto: string, tamanho: number, largura: number): string[] {
    const palavras = sanitizar(texto).split(/\s+/);
    const linhas: string[] = [];
    let atual = "";
    for (const p of palavras) {
      const tentativa = atual ? `${atual} ${p}` : p;
      if (font.widthOfTextAtSize(tentativa, tamanho) > largura && atual) {
        linhas.push(atual);
        atual = p;
      } else {
        atual = tentativa;
      }
    }
    if (atual) linhas.push(atual);
    return linhas.length ? linhas : [""];
  }

  // ── Cabeçalho: faixa colorida + título + subtítulo ──
  page.drawRectangle({ x: margem, y: y - 6, width: larguraUtil, height: 4, color: rgb(1, 0.73, 0) });
  page.drawText(sanitizar(params.titulo || "Rotina"), { x: margem, y: y - 30, size: 21, font: bold, color: ROXO });
  y -= 42;
  const sub = [params.nome ? sanitizar(params.nome) : "", params.tema ? `Tema: ${sanitizar(params.tema)}` : ""]
    .filter(Boolean)
    .join("   ·   ");
  if (sub) {
    page.drawText(sub, { x: margem, y: y - 11, size: 11, font, color: CINZA });
    y -= 20;
  }

  // ── Legenda: só os tipos que aparecem na rotina ──
  const presentes = new Set<string>();
  for (const d of params.dias) for (const t of d.tarefas) presentes.add(categorizar(t.texto));
  const legenda = Object.keys(TIPOS).filter((k) => presentes.has(k));
  if (legenda.length) {
    let lx = margem;
    novaPaginaSePreciso(20);
    for (const k of legenda) {
      const { label, cor } = TIPOS[k];
      const w = 14 + font.widthOfTextAtSize(label, 9) + 14;
      if (lx + w > margem + larguraUtil) {
        lx = margem;
        y -= 16;
      }
      page.drawEllipse({ x: lx + 4, y: y - 7, xScale: 3.4, yScale: 3.4, color: cor });
      page.drawText(label, { x: lx + 12, y: y - 10, size: 9, font, color: TEXTO });
      lx += w;
    }
    y -= 22;
  }

  // ── Dias ──
  for (const d of params.dias) {
    if (!d.tarefas.length) continue;
    novaPaginaSePreciso(48);
    y -= 6;
    page.drawText(sanitizar(d.nome), { x: margem, y: y - 14, size: 14, font: bold, color: ROXO });
    y -= 18;
    page.drawRectangle({ x: margem, y: y, width: larguraUtil, height: 0.8, color: rgb(0.88, 0.85, 0.92) });
    y -= 8;

    for (const t of d.tarefas) {
      const { cor } = TIPOS[categorizar(t.texto)];
      const horaW = 34;
      const textoX = margem + 20 + horaW + 14;
      const linhas = quebrar(t.texto, 11, margem + larguraUtil - textoX);
      novaPaginaSePreciso(linhas.length * 14 + 6);

      // caixinha pra marcar à mão
      page.drawRectangle({ x: margem, y: y - 12, width: 11, height: 11, borderColor: CINZA, borderWidth: 1 });
      // horário
      if (t.hora) {
        page.drawText(sanitizar(t.hora), { x: margem + 20, y: y - 11, size: 10, font: bold, color: CINZA });
      }
      // bolinha do tipo
      page.drawEllipse({ x: margem + 20 + horaW + 4, y: y - 7, xScale: 3.4, yScale: 3.4, color: cor });
      // atividade
      linhas.forEach((ln, i) => {
        page.drawText(ln, { x: textoX, y: y - 11, size: 11, font, color: TEXTO });
        if (i < linhas.length - 1) y -= 14;
      });
      y -= 17;
    }
    y -= 6;
  }

  novaPaginaSePreciso(24);
  page.drawText(sanitizar("Kolo Familia - rotina visual. Marque cada passo ao concluir."), {
    x: margem,
    y: y - 8,
    size: 8,
    font,
    color: CINZA,
  });

  return doc.save();
}

// ---------- PDF dos CARTÕES ILUSTRADOS pra recortar (varalzinho) ----------

function envolver(
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  size: number,
  texto: string,
  largura: number,
): string[] {
  const palavras = sanitizar(texto).split(/\s+/);
  const linhas: string[] = [];
  let atual = "";
  for (const p of palavras) {
    const t = atual ? `${atual} ${p}` : p;
    if (font.widthOfTextAtSize(t, size) > largura && atual) {
      linhas.push(atual);
      atual = p;
    } else atual = t;
  }
  if (atual) linhas.push(atual);
  return linhas.length ? linhas : [""];
}

/**
 * PDF com as imagens JÁ GERADAS dos cartões, em grade de recorte (borda
 * tracejada). A mãe recorta, pendura num varalzinho na ordem, e a criança VIRA
 * o cartão ao concluir (esconde a imagem) — vê o que já passou e o que falta.
 * Só cartões com imagem entram.
 */
export async function cartoesParaPdf(params: {
  titulo: string;
  cartoes: Array<{ titulo: string; bytes: Uint8Array }>;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const A4 = { w: 595.28, h: 841.89 };
  const margem = 36;

  let page = doc.addPage([A4.w, A4.h]);
  let y = A4.h - margem;

  page.drawText(sanitizar(params.titulo || "Cartões pra recortar"), {
    x: margem,
    y: y - 18,
    size: 18,
    font: bold,
    color: ROXO,
  });
  y -= 26;
  const instr =
    "Recorte os cartoes e pendure num varalzinho, na ordem. Conforme cada etapa acontece, VIRE o cartao (esconde a imagem) - assim fica claro o que ja passou e qual e a proxima.";
  for (const ln of envolver(font, 10, instr, A4.w - margem * 2)) {
    page.drawText(ln, { x: margem, y: y - 10, size: 10, font, color: CINZA });
    y -= 14;
  }
  y -= 10;

  const cols = 2;
  const gap = 18;
  const cardW = (A4.w - margem * 2 - gap) / cols;
  const imgSize = cardW - 22;
  const cardH = imgSize + 42;
  let col = 0;

  function bordaTracejada(x: number, yTop: number, w: number, h: number) {
    const dash = [4, 3];
    const c = CINZA;
    const yb = yTop - h;
    page.drawLine({ start: { x, y: yTop }, end: { x: x + w, y: yTop }, thickness: 0.7, color: c, dashArray: dash });
    page.drawLine({ start: { x, y: yb }, end: { x: x + w, y: yb }, thickness: 0.7, color: c, dashArray: dash });
    page.drawLine({ start: { x, y: yTop }, end: { x, y: yb }, thickness: 0.7, color: c, dashArray: dash });
    page.drawLine({ start: { x: x + w, y: yTop }, end: { x: x + w, y: yb }, thickness: 0.7, color: c, dashArray: dash });
  }

  for (const c of params.cartoes) {
    if (y - cardH < margem) {
      page = doc.addPage([A4.w, A4.h]);
      y = A4.h - margem;
      col = 0;
    }
    const x = margem + col * (cardW + gap);
    bordaTracejada(x, y, cardW, cardH);
    try {
      const img = c.bytes[0] === 0x89 ? await doc.embedPng(c.bytes) : await doc.embedJpg(c.bytes);
      page.drawImage(img, { x: x + (cardW - imgSize) / 2, y: y - 11 - imgSize, width: imgSize, height: imgSize });
    } catch {
      /* imagem inválida — pula */
    }
    let ty = y - 11 - imgSize - 14;
    for (const ln of envolver(bold, 11, c.titulo, cardW - 16).slice(0, 2)) {
      const w = bold.widthOfTextAtSize(ln, 11);
      page.drawText(ln, { x: x + (cardW - w) / 2, y: ty, size: 11, font: bold, color: TEXTO });
      ty -= 13;
    }
    col++;
    if (col >= cols) {
      col = 0;
      y -= cardH + gap;
    }
  }

  return doc.save();
}
