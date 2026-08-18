import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  desafiosAtuais,
  montarContextoBase,
  TETO_CONTEXTO_BASE,
  TETO_DOMINIO_PERTINENTE,
  TETO_DOMINIO_PADRAO,
  type LinhaPerfilVivo,
} from "./experimental-contexto";

/**
 * ONDA 2 — MEMÓRIA PERTINENTE, 18/08/2026.
 *
 * ⚠️ O DEFEITO MEDIDO. `primeiraFrase(texto, 140)` descartava 67.464 de 84.738
 * caracteres salvos (79,6%) em 307 textos de domínio — incluindo 55 de 61
 * campos "O que ajuda" e 16 de 19 "Aceita bem / preferidos".
 *
 * ⚠️ E POR QUE NÃO BASTAVA SUBIR O TETO. Com 320 em TODOS os itens e o mesmo
 * teto global, o domínio sobre o qual a mãe pergunta sumia em até 54% dos
 * casos: sobravam 2–3 domínios e a recência decidia quais. O desenho que passa
 * é teto DUPLO — profundidade só onde está o assunto.
 */

/** O caso Matheo, com o texto real de produção (07/08/2026). */
const MATHEO: LinhaPerfilVivo = {
  categorias_extras: {
    nutricional: {
      texto:
        "Aceita bem / preferidos: banana; maçã; melancia; mamão\nTexturas que aceita: exploração sensorial de texturas em frutas; texturas bem amassadas e misturadas em pequena quantidade com frutas já aceitas\nTexturas que rejeita: texturas muito diferentes das frutas conhecidas",
      atualizado_em: "2026-08-07",
    },
    sono: { texto: "Como adormece: gira muito antes de dormir", atualizado_em: "2026-08-18" },
    rotina: { texto: "O que ajuda nas transições: opções pré-filtradas", atualizado_em: "2026-08-12" },
    foco: { texto: "Como é o foco: Dispersa fácil", atualizado_em: "2026-08-11" },
    comunicacao: { texto: "Como se comunica: Fala frases", atualizado_em: "2026-08-17" },
    socializacao: { texto: "Divide e espera a vez: Custa", atualizado_em: "2026-08-11" },
  },
};

const COM_IMITACAO: LinhaPerfilVivo = {
  categorias_extras: {
    imitacao: {
      texto: "Imita?: Às vezes\nO que imita: Tchau, beijo, dança\nAprende imitando?: Sim",
      atualizado_em: "2026-07-09",
    },
    tela_midia: { texto: "Tempo de tela: alto à noite", atualizado_em: "2026-07-09" },
    gostos: { texto: "Gosta de: carrinho", atualizado_em: "2026-07-09" },
  },
};

describe("1. O corte não perde mais por POSIÇÃO", () => {
  it("GOLDEN Matheo: sem skill, a ponte de textura já começa a chegar", () => {
    // `primeiraFrase` cortava na primeira quebra de linha — e "Texturas que
    // aceita" nunca é a primeira linha. Era perda por posição, não por tamanho.
    const linha = desafiosAtuais(MATHEO, 20, []).find((l) => l.startsWith("alimentação"))!;
    expect(linha).toContain("banana");
    expect(linha).toContain("Texturas que aceita");
  });

  it("GOLDEN Matheo: COM a skill, a ponte inteira chega", () => {
    const linha = desafiosAtuais(MATHEO, 20, ["nutricional"]).find((l) =>
      l.startsWith("alimentação"),
    )!;
    expect(linha).toContain("texturas bem amassadas e misturadas");
    expect(linha).toContain("Texturas que rejeita");
  });
});

describe("2. Pertinência decide QUEM aprofunda — e o assunto nunca some", () => {
  it("o domínio da skill vem PRIMEIRO, mesmo sendo o mais antigo", () => {
    // Alimentação é de 07/08, o mais antigo dos seis. Por recência ficaria em
    // último — foi assim que a Rosangela ouviu "não tenho registrado".
    const lista = desafiosAtuais(MATHEO, 20, ["nutricional"]);
    expect(lista[0].startsWith("alimentação")).toBe(true);
  });

  it("sem skill, ninguém aprofunda — o teto é o antigo para todos", () => {
    for (const l of desafiosAtuais(MATHEO, 20, [])) {
      expect(l.length).toBeLessThanOrEqual(TETO_DOMINIO_PADRAO + 20);
    }
  });

  it("com skill, só o pertinente passa do teto padrão", () => {
    const lista = desafiosAtuais(MATHEO, 20, ["nutricional"]);
    const alimentacao = lista.find((l) => l.startsWith("alimentação"))!;
    expect(alimentacao.length).toBeGreaterThan(TETO_DOMINIO_PADRAO);
    expect(alimentacao.length).toBeLessThanOrEqual(TETO_DOMINIO_PERTINENTE + 20);
  });

  it("o vizinho também aprofunda — sono e rotina são o mesmo problema", () => {
    const lista = desafiosAtuais(MATHEO, 20, ["sono"]);
    const i = lista.findIndex((l) => l.startsWith("sono"));
    const j = lista.findIndex((l) => l.startsWith("rotina"));
    expect(i).toBe(0);
    expect(j).toBeGreaterThan(0);
    expect(j).toBeLessThan(4);
  });
});

describe("3. Os três domínios que eram invisíveis", () => {
  it("imitação, telas e gostos passam a ter rótulo", () => {
    const lista = desafiosAtuais(COM_IMITACAO, 20, ["imitacao"]);
    expect(lista.some((l) => l.startsWith("imitação"))).toBe(true);
    expect(lista.some((l) => l.startsWith("telas e mídia"))).toBe(true);
    expect(lista.some((l) => l.startsWith("gostos"))).toBe(true);
  });

  it("imitação é SKILL ATIVA — o roteamento não pode apontar para o vazio", () => {
    const linha = desafiosAtuais(COM_IMITACAO, 20, ["imitacao"]).find((l) =>
      l.startsWith("imitação"),
    )!;
    expect(linha).toContain("Tchau, beijo, dança");
  });
});

describe("4. O teto global continua mandando", () => {
  it("o bloco não estoura 1200, com ou sem skill", () => {
    const membro = { nome: "Matheo", data_nascimento: "2022-02-26", diagnosticos_formais: [] };
    for (const skills of [[], ["nutricional"], ["sono"], ["rotina"]]) {
      const b = montarContextoBase({
        nomeResponsavel: "Rosangela",
        membro,
        perfilVivo: MATHEO,
        skills,
      });
      expect(b.bloco.length).toBeLessThanOrEqual(TETO_CONTEXTO_BASE);
    }
  });
});

// ── 5. O HISTÓRICO VOLTA AO EXTRATOR ──────────────────────────────────────

const ORQ = readFileSync(join(process.cwd(), "src/lib/ayla/orchestrator.ts"), "utf8");

describe("5. O caminho novo deixa de amputar o histórico", () => {
  it("o extrator recebe histórico recortado pelo membro", () => {
    expect(ORQ).toContain("semOutrosMembros(historicoExp, exp.membroId)");
  });

  it("o parser pós-resposta recebe histórico — é ele que vira Perfil Vivo", () => {
    expect(ORQ).toContain("historico: historicoExp,");
  });

  it("MORDE: nenhum dos dois volta a passar `undefined`", () => {
    const i = ORQ.indexOf("const historicoExp = await carregarHistorico");
    expect(i).toBeGreaterThan(0);
    const bloco = ORQ.slice(i, i + 2600);
    expect(bloco).not.toContain("inbound.texto,\n          undefined,");
  });

  it("reusa o histórico já lido no turno — nenhuma consulta nova", () => {
    const i = ORQ.indexOf("const historicoExp = await carregarHistorico");
    expect(ORQ.slice(i, i + 400)).toContain("await historicoDoTurno()");
  });
});
