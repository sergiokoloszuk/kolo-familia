import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * PDF da rotina pra imprimir e colar na parede — cada passo com uma caixinha
 * pra a criança marcar à mão (o "já passou" no papel). pdf-lib é JS puro, seguro
 * no serverless. Helvetica (WinAnsi) cobre acentos do português.
 */

const ROXO = rgb(0.29, 0.16, 0.5);
const TEXTO = rgb(0.13, 0.12, 0.15);
const CINZA = rgb(0.45, 0.43, 0.48);

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

  // Cabeçalho
  page.drawText(sanitizar(params.titulo || "Rotina"), { x: margem, y: y - 20, size: 20, font: bold, color: ROXO });
  y -= 30;
  const sub = [params.nome ? `Rotina de ${params.nome}` : "", params.tema ? `Tema: ${params.tema}` : ""]
    .filter(Boolean)
    .join("  ·  ");
  if (sub) {
    page.drawText(sanitizar(sub), { x: margem, y: y - 11, size: 11, font, color: CINZA });
    y -= 22;
  } else {
    y -= 8;
  }

  for (const d of params.dias) {
    if (!d.tarefas.length) continue;
    novaPaginaSePreciso(40);
    y -= 8;
    page.drawText(sanitizar(d.nome), { x: margem, y: y - 14, size: 14, font: bold, color: ROXO });
    y -= 22;
    for (const t of d.tarefas) {
      const horaTxt = t.hora ? `${t.hora}  ` : "";
      const linhas = quebrar(`${horaTxt}${t.texto}`, 11, larguraUtil - 20);
      novaPaginaSePreciso(linhas.length * 15 + 4);
      // caixinha pra marcar à mão
      page.drawRectangle({
        x: margem,
        y: y - 12,
        width: 11,
        height: 11,
        borderColor: CINZA,
        borderWidth: 1,
      });
      linhas.forEach((ln, i) => {
        page.drawText(ln, { x: margem + 20, y: y - 11, size: 11, font, color: TEXTO });
        if (i < linhas.length - 1) y -= 15;
      });
      y -= 18;
    }
    y -= 4;
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
