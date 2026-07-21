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
