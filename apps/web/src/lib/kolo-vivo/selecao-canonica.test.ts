import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { lerSecoesMembro, PERFIL_MEMBRO_SELECT } from "./leitura";
import { MEMBRO_CAMPOS_TODOS, MEMBRO_CAMPOS_TOPLEVEL } from "./campos";

/**
 * UMA SELEÇÃO CANÔNICA DE COLUNAS.
 *
 * Catorze lugares repetiam à mão a lista de colunas do perfil, e a duplicação
 * já tinha produzido dois defeitos reais: o relatório para escola/terapeuta e a
 * ficha do CRM pediam só as 5 colunas dedicadas e nem carregavam
 * `categorias_extras` — eram cegos para 15 dos 20 domínios.
 *
 * Estes testes provam o COMPORTAMENTO (dado antes invisível chega ao
 * consumidor), não a presença textual da constante.
 */

const TOPLEVEL: readonly string[] = MEMBRO_CAMPOS_TOPLEVEL;

/** Uma linha de `perfil_vivo_membro` como o banco devolve. */
function linhaDoBanco(valores: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = { categorias_extras: {} };
  const extras = row.categorias_extras as Record<string, unknown>;
  for (const [campo, v] of Object.entries(valores)) {
    (TOPLEVEL.includes(campo) ? row : extras)[campo] = v;
  }
  return row;
}

/**
 * O que o Postgres devolveria para uma dada string de `select`. Simula a
 * projeção: coluna não pedida simplesmente não vem — que é exatamente como os
 * 15 domínios sumiam.
 */
function projetar(select: string, linha: Record<string, unknown>): Record<string, unknown> {
  const colunas = select.split(",").map((c) => c.trim());
  const out: Record<string, unknown> = {};
  for (const c of colunas) if (c in linha) out[c] = linha[c];
  return out;
}

const PERFIL_COMPLETO = linhaDoBanco({
  essencial: { texto: "gosta de rotina previsível" },
  como_e: { interesses: ["trem", "dinossauro"] },
  corpo_rotina: { texto: "acorda cedo" },
  desafios_regulacao: { texto: "desregula com barulho" },
  sensorial: { texto: "foge de secador" },
  aprendizado: { texto: "aprende vendo antes de fazer; não generaliza sozinho" },
  escola: { texto: "professora nova em julho, sem adaptação" },
  comunicacao: { texto: "frases de 3 palavras" },
  autonomia: { texto: "come sozinho, ainda não se veste" },
  emocional: { texto: "chora quando muda o combinado" },
  gostos: { texto: "adora água" },
  saude_geral: { texto: "acompanhamento com neuropediatra" },
});

describe("a seleção canônica traz o perfil inteiro", () => {
  it("a lista antiga perdia 15 domínios; a canônica não perde nenhum", () => {
    const ANTIGA = "essencial, como_e, corpo_rotina, desafios_regulacao, sensorial";

    const comAntiga = lerSecoesMembro(projetar(ANTIGA, PERFIL_COMPLETO));
    const comCanonica = lerSecoesMembro(projetar(PERFIL_MEMBRO_SELECT, PERFIL_COMPLETO));

    // O defeito, reproduzido: aprendizado e escola simplesmente não existiam.
    expect(comAntiga.aprendizado).toBeUndefined();
    expect(comAntiga.escola).toBeUndefined();

    expect(comCanonica.aprendizado).toContain("não generaliza sozinho");
    expect(comCanonica.escola).toContain("professora nova em julho");
    expect(Object.keys(comCanonica).length).toBeGreaterThan(Object.keys(comAntiga).length);
  });

  it("os domínios que a escola precisa chegam", () => {
    const secoes = lerSecoesMembro(projetar(PERFIL_MEMBRO_SELECT, PERFIL_COMPLETO));
    for (const campo of ["aprendizado", "escola", "comunicacao", "sensorial", "autonomia", "emocional", "gostos"]) {
      expect(secoes[campo], `${campo} não chegou`).toBeTruthy();
    }
  });

  it("as 5 colunas dedicadas continuam funcionando", () => {
    const secoes = lerSecoesMembro(projetar(PERFIL_MEMBRO_SELECT, PERFIL_COMPLETO));
    for (const campo of MEMBRO_CAMPOS_TOPLEVEL) {
      expect(secoes[campo], `${campo} regrediu`).toBeTruthy();
    }
    // E o que veio do onboarding também — `extractTexto` lia só `.texto`.
    expect(secoes.como_e).toBe("trem, dinossauro");
  });

  it("a seleção canônica cobre todos os domínios de campos.ts", () => {
    // Se alguém acrescentar um domínio `extras` em campos.ts, ele já vem por
    // `categorias_extras`; se acrescentar uma COLUNA dedicada, este teste
    // quebra e aponta o único lugar a editar: PERFIL_MEMBRO_SELECT.
    const colunas = PERFIL_MEMBRO_SELECT.split(",").map((c) => c.trim());
    for (const campo of MEMBRO_CAMPOS_TOPLEVEL) {
      expect(colunas, `coluna ${campo} fora da seleção canônica`).toContain(campo);
    }
    expect(colunas).toContain("categorias_extras");
    const extras = MEMBRO_CAMPOS_TODOS.filter((c) => !TOPLEVEL.includes(c));
    expect(extras.length).toBeGreaterThan(0);
  });

  it("perfil vazio continua seguro", () => {
    expect(lerSecoesMembro(projetar(PERFIL_MEMBRO_SELECT, linhaDoBanco({})))).toEqual({});
    expect(lerSecoesMembro(null)).toEqual({});
  });

  it("um membro não recebe o conteúdo do outro", () => {
    const pedro = lerSecoesMembro(linhaDoBanco({ escola: { texto: "turma do Pedro" } }));
    const alice = lerSecoesMembro(linhaDoBanco({ escola: { texto: "turma da Alice" } }));
    expect(pedro.escola).toBe("turma do Pedro");
    expect(alice.escola).toBe("turma da Alice");
    expect(JSON.stringify(pedro)).not.toContain("Alice");
  });
});

describe("consultas que pedem colunas próprias continuam pedindo", () => {
  const fonte = (rel: string) => readFileSync(resolve(__dirname, "..", "..", rel), "utf8");

  it("o dashboard continua trazendo family_account_id e completude_pct", () => {
    const src = fonte("lib/analytics/dashboard.ts");
    expect(src).toContain("family_account_id, completude_pct, ${PERFIL_MEMBRO_SELECT}");
  });

  it("a tela do Kolo Vivo continua trazendo membro_atipico_id", () => {
    const src = fonte("app/(app)/kolo-vivo/page.tsx");
    expect(src).toContain("membro_atipico_id, ${PERFIL_MEMBRO_SELECT}");
  });

  it("nenhum consumidor do perfil enumera as colunas à mão", () => {
    // Exceções conhecidas: `skill-suggestion.ts` e `seed-prompts-data.ts`, que
    // não consultam nada — descrevem `kolo_vivo_fields` num prompt de autoria
    // de skill, e a lista de lá inclui chaves que nem são colunas do perfil.
    const consumidores = [
      "lib/relatorio/data.ts",
      "lib/relatorio/gerar.ts",
      "lib/analytics/ficha.ts",
      "lib/analytics/dashboard.ts",
      "lib/ayla/orchestrator.ts",
      "lib/ayla/mensagemEspontanea.ts",
      "lib/kolo-vivo/aplicar.ts",
      "lib/kolo-vivo/aplicar-whatsapp.ts",
      "lib/kolo-vivo/incorporar.ts",
      "app/(app)/conversar/actions.ts",
      "app/(app)/historias/actions.ts",
      "app/(app)/kolo-vivo/actions.ts",
      "app/(app)/kolo-vivo/page.tsx",
    ];
    for (const rel of consumidores) {
      const src = fonte(rel);
      expect(
        /essencial,\s*como_e,\s*corpo_rotina/.test(src),
        `${rel} voltou a enumerar as colunas — use PERFIL_MEMBRO_SELECT`,
      ).toBe(false);
      expect(src, `${rel} não usa a seleção canônica`).toContain("PERFIL_MEMBRO_SELECT");
    }
  });
});
