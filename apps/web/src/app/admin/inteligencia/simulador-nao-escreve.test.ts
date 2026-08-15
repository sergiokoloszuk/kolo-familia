import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * O SIMULADOR NÃO ESCREVE — nem documento, nem conversa.
 *
 * ⚠️ POR QUE ISTO EXISTE. Até 15/08/2026 esta tela salvava, publicava e
 * restaurava versões, enquanto `/admin/documentos` fazia o mesmo com outra
 * convenção de status (`rascunho` aqui, `arquivado` lá). O resultado foi um
 * `core v3` gravado por engano, com a estrutura Markdown destruída, sem
 * ninguém saber de qual tela tinha vindo.
 *
 * A separação agora é regra:
 *   documento = conteúdo (/admin/documentos)
 *   simulador = teste (aqui)
 *   ativação = ação explícita, e só lá.
 *
 * ⚠️ ASSERÇÃO SOBRE CÓDIGO-FONTE PROVA ESTRUTURA, NÃO COMPORTAMENTO — e aqui
 * é o que se quer: a garantia é a AUSÊNCIA de um caminho de escrita. O
 * comportamento (o simulador não envia WhatsApp nem grava conversa) já é
 * provado em `core-editavel.test.ts` e nos testes do experimental.
 */

const SRC = readFileSync(resolve(__dirname, "actions.ts"), "utf8");

/** O código sem comentários — a pergunta é o que ele CHAMA, não o que cita. */
const codigo = SRC.split("\n")
  .filter((l) => {
    const t = l.trim();
    return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
  })
  .join("\n");

describe("o simulador não tem caminho de escrita", () => {
  it("MORDE: nenhuma escrita em ayla_documentos", () => {
    for (const op of [".insert(", ".update(", ".upsert(", ".delete("]) {
      expect(codigo, `o simulador voltou a escrever (${op})`).not.toContain(op);
    }
  });

  it("MORDE: nenhuma ação de salvar/publicar/restaurar é exportada", () => {
    for (const proibida of [
      "salvarRascunho",
      "publicarRascunho",
      "descartarRascunho",
      "restaurarVersao",
      "salvarNovaVersao",
      "ativarVersao",
    ]) {
      expect(codigo, `"${proibida}" reapareceu no simulador`).not.toContain(proibida);
    }
  });

  it("MORDE: continua atrás de requireAdmin", () => {
    expect(codigo).toContain("requireAdmin()");
    // Toda função exportada precisa passar pelo gate.
    const exportadas = [...codigo.matchAll(/export async function (\w+)/g)].map((m) => m[1]);
    expect(exportadas.length).toBeGreaterThan(0);
    for (const fn of exportadas) {
      const i = codigo.indexOf(`export async function ${fn}`);
      const corpo = codigo.slice(i, codigo.indexOf("\n}", i));
      expect(corpo, `"${fn}" não chama requireAdmin`).toContain("requireAdmin()");
    }
  });

  it("MORDE: o custo do teste continua separado do custo das famílias", () => {
    expect(codigo, "o simulador deixou de se declarar").toContain('origem: "simulador"');
  });

  it("a tela aponta para onde se escreve, em vez de escrever", () => {
    const PAGE = readFileSync(resolve(__dirname, "page.tsx"), "utf8");
    expect(PAGE).toContain("/admin/documentos");
    expect(PAGE).toMatch(/não edita e não ativa/i);
  });
});
