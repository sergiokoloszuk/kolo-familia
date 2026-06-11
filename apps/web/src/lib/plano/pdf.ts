import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * Renderiza um plano (título + seções markdown) em PDF — pra entregar no
 * WhatsApp como documento. pdf-lib é JS puro (sem fontes externas), seguro no
 * serverless. Fonte Helvetica (WinAnsi) cobre acentos do português.
 */

type Secao = { tipo: string; titulo: string; conteudo_markdown: string };

const LABEL: Record<string, string> = {
  entender: "Entendendo",
  crencas: "Crenças",
  diferente: "O que fazer diferente",
  rotina: "Rotina",
  brincadeiras: "Brincadeiras",
  atividades: "Atividades",
  historia_social: "Histórias sociais",
  frases: "Frases prontas",
  observar: "O que observar",
};

const ROXO = rgb(0.29, 0.16, 0.5);
const TEXTO = rgb(0.13, 0.12, 0.15);
const CINZA = rgb(0.45, 0.43, 0.48);

/** Mantém só o que a fonte WinAnsi (Latin-1) encoda — troca o resto. */
function sanitizar(s: string): string {
  return (s ?? "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    .replace(/[–—]/g, "-")
    .replace(/•/g, "-")
    .replace(/[^\x00-\xFF]/g, "");
}

/** Tira o markdown leve, deixando texto limpo por linha (com bullets viram "• "). */
function linhasDoMarkdown(md: string): Array<{ texto: string; bullet: boolean }> {
  const out: Array<{ texto: string; bullet: boolean }> = [];
  for (const bruto of (md ?? "").replace(/\r\n/g, "\n").split("\n")) {
    let t = bruto.trim();
    if (!t) {
      out.push({ texto: "", bullet: false });
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) continue; // divisor
    let bullet = false;
    if (/^([-*•])\s+/.test(t)) {
      bullet = true;
      t = t.replace(/^([-*•])\s+/, "");
    } else if (/^\d+\.\s+/.test(t)) {
      t = t.replace(/^(\d+)\.\s+/, "$1. ");
    }
    t = t.replace(/^#{1,6}\s+/, ""); // título markdown → texto
    t = t.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1"); // bold/itálico
    t = t.replace(/`([^`]+)`/g, "$1");
    t = t.replace(/^>\s?/, "");
    out.push({ texto: t, bullet });
  }
  return out;
}

export async function planoParaPdf(params: {
  titulo: string;
  nome?: string | null;
  secoes: Secao[];
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const A4 = { w: 595.28, h: 841.89 };
  const margem = 50;
  const larguraUtil = A4.w - margem * 2;

  let page = doc.addPage([A4.w, A4.h]);
  let y = A4.h - margem;

  function novaPaginaSePreciso(altura: number) {
    if (y - altura < margem) {
      page = doc.addPage([A4.w, A4.h]);
      y = A4.h - margem;
    }
  }

  function quebrar(texto: string, tamanho: number, f: typeof font, largura: number): string[] {
    const palavras = sanitizar(texto).split(/\s+/);
    const linhas: string[] = [];
    let atual = "";
    for (const p of palavras) {
      const tentativa = atual ? `${atual} ${p}` : p;
      if (f.widthOfTextAtSize(tentativa, tamanho) > largura && atual) {
        linhas.push(atual);
        atual = p;
      } else {
        atual = tentativa;
      }
    }
    if (atual) linhas.push(atual);
    return linhas.length ? linhas : [""];
  }

  function escrever(
    texto: string,
    opts: { f: typeof font; tamanho: number; cor: typeof TEXTO; recuo?: number; espacoDepois?: number },
  ) {
    const recuo = opts.recuo ?? 0;
    const lineH = opts.tamanho * 1.4;
    for (const linha of quebrar(texto, opts.tamanho, opts.f, larguraUtil - recuo)) {
      novaPaginaSePreciso(lineH);
      page.drawText(linha, {
        x: margem + recuo,
        y: y - opts.tamanho,
        size: opts.tamanho,
        font: opts.f,
        color: opts.cor,
      });
      y -= lineH;
    }
    if (opts.espacoDepois) y -= opts.espacoDepois;
  }

  // Cabeçalho
  escrever(params.titulo || "Plano", { f: bold, tamanho: 20, cor: ROXO, espacoDepois: 4 });
  if (params.nome) {
    escrever(`Plano para ${params.nome}`, { f: font, tamanho: 11, cor: CINZA, espacoDepois: 10 });
  } else {
    y -= 6;
  }

  // Seções
  for (const s of params.secoes) {
    if (s.tipo === "__erro__") continue;
    const titulo = s.titulo?.trim() || LABEL[s.tipo] || "Seção";
    novaPaginaSePreciso(40);
    y -= 10;
    escrever(titulo, { f: bold, tamanho: 14, cor: ROXO, espacoDepois: 4 });
    for (const { texto, bullet } of linhasDoMarkdown(s.conteudo_markdown)) {
      if (!texto) {
        y -= 6;
        continue;
      }
      if (bullet) {
        novaPaginaSePreciso(15);
        page.drawText("•", { x: margem, y: y - 11, size: 11, font, color: ROXO });
        escrever(texto, { f: font, tamanho: 11, cor: TEXTO, recuo: 14 });
      } else {
        escrever(texto, { f: font, tamanho: 11, cor: TEXTO });
      }
    }
  }

  // Rodapé na última página
  escrever("Kolo Família — apoio, não substitui profissionais de saúde.", {
    f: font,
    tamanho: 8,
    cor: CINZA,
    espacoDepois: 0,
  });

  return doc.save();
}
