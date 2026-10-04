#!/usr/bin/env node

/**
 * Índice de PENDENCIAS.md: a ficha é a fonte; o painel é derivado.
 * --check não escreve nada e é usado pelo CI. --write altera só a região
 * delimitada do índice, para revisão humana antes do commit.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const abertas = new URL("../docs/PENDENCIAS.md", import.meta.url);
const arquivo = new URL("../docs/PENDENCIAS-ARQUIVO.md", import.meta.url);
export const INICIO = "<!-- PENDENCIAS-INDEX:START -->";
export const FIM = "<!-- PENDENCIAS-INDEX:END -->";

const limpar = (texto) => texto.replace(/\*\*/g, "").replace(/`/g, "").replace(/\s+/g, " ").trim();
const celula = (texto) => limpar(texto).replace(/\|/g, "\\|");

export function extrairFichas(texto, origem = "PENDENCIAS.md") {
  const cabecalhos = [...texto.matchAll(/^### PEND-(\d{3})(?:\s+·[^\r\n]*)?\s*$/gm)];
  const vistos = new Set();
  return cabecalhos.map((cabecalho, indice) => {
    const id = cabecalho[1];
    if (vistos.has(id)) throw new Error(`${origem}: PEND-${id} duplicada`);
    vistos.add(id);
    const corpo = texto.slice(cabecalho.index, cabecalhos[indice + 1]?.index);
    const titulo = corpo.match(/^### PEND-\d{3}(?:\s+·\s*([^\r\n]+))?\s*\r?\n(?:\r?\n)?(?:\*\*([^\r\n]+)\*\*)?/m);
    const nome = limpar(titulo?.[1] || titulo?.[2] || "");
    if (!nome) throw new Error(`${origem}: PEND-${id} sem título`);
    const prioridade = corpo.match(/Prioridade:\s*\*\*([^*]+)\*\*/i)?.[1] ?? "—";
    const estado = corpo.match(/(?:Estado|STATUS):\s*\*\*([^*]+)\*\*/i)?.[1];
    if (origem === "PENDENCIAS.md" && !estado) {
      throw new Error(`${origem}: PEND-${id} sem Estado/STATUS explícito`);
    }
    return { id, titulo: nome, prioridade: limpar(prioridade), estado: limpar(estado ?? "") };
  });
}

export function gerarIndice(fichas) {
  const ordenadas = [...fichas].sort((a, b) => Number(a.id) - Number(b.id));
  return [
    INICIO,
    `Índice completo gerado de ${ordenadas.length} fichas neste arquivo. A ficha é a fonte do estado; não edite as linhas abaixo à mão. Para atualizar: \`node scripts/pendencias-index.mjs --write\`.`,
    "",
    "| ID | Pendência | Prioridade | Estado da ficha |",
    "|---|---|---|---|",
    ...ordenadas.map((f) => `| [PEND-${f.id}](#pend-${f.id}) | ${celula(f.titulo)} | ${celula(f.prioridade)} | ${celula(f.estado)} |`),
    FIM,
  ].join("\n");
}

export function migrarPainelLegado(texto, fichas) {
  const inicio = texto.indexOf("## Painel");
  const fim = texto.indexOf("## Blocos e dependências");
  if (inicio < 0 || fim <= inicio || texto.includes(INICIO)) {
    throw new Error("Painel legado não encontrado uma única vez; nenhuma alteração feita");
  }
  const novo = [
    "## Painel",
    "",
    "O índice abaixo é gerado das fichas, que são a única fonte de prioridade e",
    "estado. Ficha nova ou alterada exige regeneração no mesmo commit; o CI",
    "rejeita divergência ou ID duplicado. O índice inclui fichas legadas já",
    "encerradas que aguardam migração para o arquivo (PEND-103).",
    "",
    "A ordem estratégica da frente de inteligência decidida em 18/08/2026 foi:",
    "PEND-092 → 017 → 098 → 093 → 094 → 095 → 039 → 042 → 097 → 099 →",
    "100 → 022 → 101 → 102 → 096. Ela registra dependências de desenho, não",
    "substitui a prioridade atual de segurança nem a análise de produção.",
    "",
    gerarIndice(fichas),
    "",
    "---",
    "",
    "",
  ].join("\n");
  const eol = texto.includes("\r\n") ? "\r\n" : "\n";
  return texto.slice(0, inicio) + novo.replace(/\n/g, eol) + texto.slice(fim);
}

export function validarRegistro(texto, textoArquivo) {
  const fichas = extrairFichas(texto);
  const arquivadas = extrairFichas(textoArquivo, "PENDENCIAS-ARQUIVO.md");
  const arquivoIds = new Set(arquivadas.map((f) => f.id));
  const repetidas = fichas.filter((f) => arquivoIds.has(f.id)).map((f) => f.id);
  if (repetidas.length) throw new Error(`ID presente em aberto e arquivo: ${repetidas.map((id) => `PEND-${id}`).join(", ")}`);
  const inicio = texto.indexOf(INICIO);
  const fim = texto.indexOf(FIM);
  if (inicio < 0 || fim < inicio || texto.indexOf(INICIO, inicio + 1) >= 0 || texto.indexOf(FIM, fim + 1) >= 0) {
    throw new Error("Marcadores do índice ausentes, duplicados ou fora de ordem");
  }
  const atual = texto.slice(inicio, fim + FIM.length).replace(/\r\n/g, "\n");
  const esperado = gerarIndice(fichas);
  return { fichas, atual, esperado, inicio, fim: fim + FIM.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const modo = process.argv[2] ?? "--check";
  if (!["--check", "--write", "--bootstrap"].includes(modo)) {
    console.error("Uso: node scripts/pendencias-index.mjs [--check|--write|--bootstrap]");
    process.exitCode = 2;
  } else {
    try {
      const texto = readFileSync(abertas, "utf8");
      const textoArquivo = readFileSync(arquivo, "utf8");
      if (modo === "--bootstrap") {
        const fichas = extrairFichas(texto);
        const arquivadas = new Set(extrairFichas(textoArquivo, "PENDENCIAS-ARQUIVO.md").map((f) => f.id));
        const duplicada = fichas.find((f) => arquivadas.has(f.id));
        if (duplicada) throw new Error(`PEND-${duplicada.id} presente em aberto e arquivo`);
        writeFileSync(abertas, migrarPainelLegado(texto, fichas), "utf8");
        console.log(`PENDENCIAS: painel legado substituído por índice de ${fichas.length} fichas.`);
        process.exit(0);
      }
      const { fichas, atual, esperado, inicio, fim } = validarRegistro(texto, textoArquivo);
      if (modo === "--check") {
        if (atual !== esperado) throw new Error("Índice divergente das fichas. Rode --write, revise o diff e inclua ambos no mesmo commit.");
      } else if (atual !== esperado) {
        const eol = texto.includes("\r\n") ? "\r\n" : "\n";
        writeFileSync(abertas, texto.slice(0, inicio) + esperado.replace(/\n/g, eol) + texto.slice(fim), "utf8");
      }
      console.log(`PENDENCIAS: ${fichas.length} fichas, IDs únicos e índice sincronizado (${modo}).`);
    } catch (erro) {
      console.error(`PENDENCIAS: ${erro.message}`);
      process.exitCode = 1;
    }
  }
}
