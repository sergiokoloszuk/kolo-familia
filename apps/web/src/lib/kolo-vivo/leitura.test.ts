import { describe, expect, it } from "vitest";
import {
  lerSecoesMembro,
  resumoRotulado,
  textoDoCampo,
  blocoEventos,
  blocoExperimentos,
} from "./leitura";
import { MEMBRO_CAMPOS_TODOS } from "./campos";

/**
 * Estes testes travam o achado nº 1 da auditoria de 30/07/2026: a Ayla do
 * WhatsApp lia 14 dos 20 domínios por causa de uma lista hardcoded, e era
 * informada de que conhecia os outros 6. Se algum domínio voltar a sumir da
 * leitura, o primeiro teste quebra.
 */

describe("lerSecoesMembro", () => {
  it("lê TODOS os 20 domínios — nenhum fica invisível", () => {
    const row: Record<string, unknown> = { categorias_extras: {} };
    const extras = row.categorias_extras as Record<string, unknown>;
    for (const campo of MEMBRO_CAMPOS_TODOS) {
      const alvo = ["essencial", "como_e", "corpo_rotina", "desafios_regulacao", "sensorial"].includes(
        campo,
      )
        ? row
        : extras;
      alvo[campo] = { texto: `valor de ${campo}` };
    }

    const secoes = lerSecoesMembro(row);
    for (const campo of MEMBRO_CAMPOS_TODOS) {
      expect(secoes[campo], `domínio ${campo} não chegou ao prompt`).toBe(`valor de ${campo}`);
    }
  });

  it("os 6 domínios que estavam cegos aparecem", () => {
    const row = {
      categorias_extras: {
        aprendizado: { texto: "aprende vendo antes de fazer" },
        escola: { texto: "professora nova em julho" },
        saude_geral: { texto: "acompanhamento com neuro" },
        imitacao: { texto: "imita gestos" },
        tela_midia: { texto: "2h por dia" },
        gostos: { texto: "dinossauros" },
      },
    };
    const secoes = lerSecoesMembro(row);
    expect(Object.keys(secoes).sort()).toEqual(
      ["aprendizado", "escola", "gostos", "imitacao", "saude_geral", "tela_midia"].sort(),
    );
  });

  it("omite domínio vazio (não polui o prompt)", () => {
    const secoes = lerSecoesMembro({ categorias_extras: { sono: { texto: "" }, foco: {} } });
    expect(secoes).toEqual({});
  });

  it("resumoRotulado usa o rótulo legível", () => {
    const texto = resumoRotulado({ nutricional: "recusa pastoso", escola: "adaptação em curso" });
    expect(texto).toContain("Alimentação: recusa pastoso");
    expect(texto).toContain("Escola: adaptação em curso");
  });
});

describe("textoDoCampo", () => {
  it("lê as formas do onboarding, não só .texto", () => {
    expect(textoDoCampo({ interesses: ["carrinho", "água"] })).toBe("carrinho, água");
    expect(textoDoCampo({ desafios_iniciais: ["sono"] })).toBe("sono");
    expect(textoDoCampo({ conquista_inicial: "dormiu sozinha" })).toBe("dormiu sozinha");
    expect(textoDoCampo({ texto: "a", interesses: ["b"] })).toBe("a · b");
  });

  it("não estoura com valor inesperado", () => {
    expect(textoDoCampo(null)).toBe("");
    expect(textoDoCampo("string solta")).toBe("");
    expect(textoDoCampo(42)).toBe("");
  });
});

describe("blocos de memória datada", () => {
  it("evento vai com a data VISÍVEL e o aviso de passado", () => {
    const b = blocoEventos([{ data: "2026-01-10", tipo: "ferias", descricao: "férias de janeiro" }]);
    expect(b).toContain("2026-01-10");
    expect(b).toContain("já ACONTECEU");
  });

  it("experimento marca o que NÃO funcionou", () => {
    const b = blocoExperimentos([
      { item: "timer visual", resultado: "nao_gostou", data: "2026-07-01" },
      { item: "ponte de textura", resultado: "amou", data: null },
    ]);
    expect(b).toContain("NÃO funcionou");
    expect(b).toContain("amou");
    expect(b).toContain("não proponha de novo");
  });

  it("vazio não gera bloco (nada de seção fantasma no prompt)", () => {
    expect(blocoEventos([])).toBe("");
    expect(blocoExperimentos([])).toBe("");
  });
});
