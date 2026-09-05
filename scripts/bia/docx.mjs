/**
 * Leitor de .docx — ZERO DEPENDÊNCIAS.
 *
 * Por que existe: o PDF da BIA passa de 600 páginas e não pode ser lido como
 * anexo; e o ambiente aqui não tem poppler (`pdftoppm` não existe), então
 * extrair texto do PDF não é opção. O .docx, por outro lado, é só um ZIP com
 * XML dentro — e o Node já traz o `inflateRawSync`. Vinte linhas de parser de
 * ZIP resolvem sem instalar nada, o que evita mexer no package.json de um
 * projeto que já teve conflito de versão (Zod 3/4) resolvido a fórceps.
 *
 * O .docx é também a fonte que a própria especificação do importer nomeia
 * ("ler o arquivo .docx"), então não é atalho: é o formato canônico de entrada.
 *
 * Uso:
 *   import { lerDocx } from "./docx.mjs";
 *   const texto = lerDocx("C:/.../BIA.docx");
 */

import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

const SIG_EOCD = 0x06054b50; // fim do diretório central
const SIG_CEN = 0x02014b50; // entrada do diretório central
const SIG_LOC = 0x04034b50; // cabeçalho local do arquivo

/**
 * Extrai UMA entrada de um ZIP, pelo nome exato.
 *
 * Vamos pelo DIRETÓRIO CENTRAL (e não varrendo cabeçalhos locais) porque com
 * data descriptor o tamanho no cabeçalho local vem zerado — o diretório central
 * é a única fonte confiável de tamanho.
 */
function extrairDoZip(buf, nomeAlvo) {
  // O EOCD fica no fim, mas pode ter até 64KB de comentário depois dele.
  let eocd = -1;
  const minimo = Math.max(0, buf.length - 66_000);
  for (let i = buf.length - 22; i >= minimo; i--) {
    if (buf.readUInt32LE(i) === SIG_EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("não parece um .docx (ZIP sem EOCD)");

  const totalEntradas = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16); // offset do diretório central

  for (let n = 0; n < totalEntradas; n++) {
    if (buf.readUInt32LE(p) !== SIG_CEN) break;

    const metodo = buf.readUInt16LE(p + 10);
    const tamComprimido = buf.readUInt32LE(p + 20);
    const lenNome = buf.readUInt16LE(p + 28);
    const lenExtra = buf.readUInt16LE(p + 30);
    const lenComentario = buf.readUInt16LE(p + 32);
    const offsetLocal = buf.readUInt32LE(p + 42);
    const nome = buf.toString("utf8", p + 46, p + 46 + lenNome);

    if (nome === nomeAlvo) {
      if (buf.readUInt32LE(offsetLocal) !== SIG_LOC) {
        throw new Error(`cabeçalho local inválido para ${nome}`);
      }
      // O cabeçalho LOCAL tem seus próprios tamanhos de nome/extra, que podem
      // diferir dos do diretório central. É deles que sai o início dos dados.
      const lenNomeLocal = buf.readUInt16LE(offsetLocal + 26);
      const lenExtraLocal = buf.readUInt16LE(offsetLocal + 28);
      const inicio = offsetLocal + 30 + lenNomeLocal + lenExtraLocal;
      const dados = buf.subarray(inicio, inicio + tamComprimido);
      if (metodo === 0) return dados; // armazenado sem compressão
      if (metodo === 8) return inflateRawSync(dados); // deflate
      throw new Error(`método de compressão ${metodo} não suportado`);
    }

    p += 46 + lenNome + lenExtra + lenComentario;
  }

  throw new Error(`entrada "${nomeAlvo}" não encontrada no .docx`);
}

/** Entidades XML que aparecem de fato em documento do Word. */
function decodificarEntidades(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&"); // por último, senão desfaz os de cima
}

/**
 * `word/document.xml` → texto puro, uma linha por parágrafo.
 *
 * Não é um parser de XML de verdade — e não precisa ser. O que importa aqui é
 * (a) `<w:p>` vira quebra de linha, (b) `<w:t>` carrega o texto, (c) `<w:tab/>`
 * e `<w:br/>` viram espaço em branco. Estilo, cor e numeração são ruído para o
 * nosso propósito.
 *
 * O que se PERDE (consciente): o nível de heading. O Word guarda isso em
 * `<w:pStyle w:val="Heading1"/>`, e ler isso exigiria um parser de verdade. O
 * chunker compensa reconhecendo os títulos pelo próprio texto ("Núcleo 5 - ..."),
 * que na BIA é consistente. Se um dia isso não bastar, é aqui que se melhora.
 */
function xmlParaTexto(xml) {
  return (
    xml
      // Cada parágrafo termina em quebra de linha.
      .replace(/<\/w:p>/g, "\n")
      // Tabulação e quebra de linha forçada viram espaço.
      .replace(/<w:tab\b[^>]*\/?>/g, " ")
      .replace(/<w:br\b[^>]*\/?>/g, "\n")
      // Só o conteúdo dos <w:t> interessa.
      .replace(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g, "$1")
      // Fora o resto das tags.
      .replace(/<[^>]+>/g, "")
  );
}

/** Caracteres que a conversão do documento deixou para trás. */
function limpar(texto) {
  return decodificarEntidades(texto)
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ") // espaço não-quebrável
    .replace(/[\u200b-\u200d\ufeff]/g, "") // zero-width
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n") // no máximo uma linha em branco
    .trim();
}

/** Caminho do .docx → texto puro. */
export function lerDocx(caminho) {
  const buf = readFileSync(caminho);
  const xml = extrairDoZip(buf, "word/document.xml").toString("utf8");
  return limpar(xmlParaTexto(xml));
}
