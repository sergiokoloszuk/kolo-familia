import { describe, it, expect, vi } from "vitest";
import { BancoMemoria } from "./__harness/banco-memoria";
import {
  montarContextoBase,
  desafiosDoOnboarding,
  comunicacaoAtual,
  desafiosAtuais,
  interessesAtuais,
} from "./experimental-contexto";

/**
 * O QUE A FAMÍLIA JÁ CONTOU CHEGA À AYLA — 15/08/2026.
 *
 * ⚠️ AS DUAS REGRESSÕES QUE ESTE ARQUIVO PRENDE, ambas provadas por execução
 * antes de existir correção:
 *
 *   1. A mãe marca três desafios no cadastro. A boas-vindas os cita de volta
 *      ("o que mais tem pesado é sono, comunicação e escola"). Ela responde — e
 *      o experimental recebia `<o_que_ainda_nao_sei>desafios atuais</...>`,
 *      porque `desafios_onboarding` não está em `ROTULO_DOMINIO` e as chaves de
 *      domínio nascem com `{texto:""}`. MEDI: 370 chaves vazias contra 122
 *      preenchidas, em 124 perfis de produção.
 *
 *   2. Comunicação era lida do top-level `desafios_regulacao`; o schema híbrido
 *      guarda em `categorias_extras.comunicacao`. Com o domínio preenchido, o
 *      MESMO prompt afirmava saber e não saber a mesma coisa.
 *
 * ⚠️ POR QUE O TESTE OLHA O BLOCO, E NÃO A FUNÇÃO. Uma função pode devolver a
 * lista certa e o bloco continuar declarando lacuna — foi exatamente essa a
 * forma da regressão 2. O que vale é o texto que chega ao modelo.
 */

const MEM = "m1";

/** O perfil como o onboarding CONVERSACIONAL grava — o único no ar hoje. */
function perfilRecemCadastrado() {
  return {
    como_e: { interesses: ["dinossauros", "água"] },
    essencial: {},
    categorias_extras: {
      desafios_onboarding: ["sono", "comunicacao", "escola"],
      sono: { texto: "" },
      comunicacao: { texto: "" },
      escola: { texto: "" },
      preferencias: { temas: ["dinossauros", "água"] },
    },
  } as never;
}

const membro = {
  id: MEM,
  nome: "Daniel",
  data_nascimento: "2018-05-10",
  diagnosticos_formais: ["TEA", "Hipótese: TDAH"],
} as never;

function bloco(pv: unknown) {
  return montarContextoBase({ nomeResponsavel: "Juliana", membro, perfilVivo: pv as never });
}

describe("REGRESSÃO 1 — os desafios do cadastro", () => {
  it("MORDE: com o cadastro completo, os três desafios CHEGAM ao modelo", async () => {
    const r = bloco(perfilRecemCadastrado());
    for (const d of ["sono", "comunicação", "escola"]) {
      expect(r.bloco, `o desafio "${d}" não chegou`).toContain(d);
    }
  });

  it("MORDE: e 'desafios atuais' NÃO é mais declarado como lacuna", async () => {
    // Esta é a linha que fazia a Ayla perguntar de novo: o Core manda perguntar
    // o que está em `<o_que_ainda_nao_sei>`.
    const r = bloco(perfilRecemCadastrado());
    expect(r.lacunas, "a Ayla vai perguntar o que a família já respondeu").not.toContain(
      "desafios atuais",
    );
  });

  it("o detalhe é distinguido da marcação — chip de cadastro não vira relato", () => {
    const r = bloco(perfilRecemCadastrado());
    expect(r.bloco).toContain("ainda sem detalhe");
  });

  it("MORDE: quando há detalhe, ele vence e o desafio não aparece duas vezes", () => {
    const pv = perfilRecemCadastrado() as unknown as {
      categorias_extras: Record<string, unknown>;
    };
    pv.categorias_extras.sono = { texto: "Acorda 3x por noite", atualizado_em: "2026-08-10" };
    const r = bloco(pv);
    expect(r.bloco).toContain("sono: Acorda 3x por noite");
    // "sono" detalhado não pode reaparecer na lista dos sem detalhe.
    const linhaSemDetalhe = r.bloco
      .split("\n")
      .find((l) => l.startsWith("Desafios que a família marcou"));
    expect(linhaSemDetalhe, "o sono detalhado voltou como 'sem detalhe'").not.toContain("sono");
    expect(linhaSemDetalhe).toContain("comunicação");
  });

  it("família sem nenhum desafio continua declarando a lacuna", () => {
    // CASO LEGÍTIMO QUE NÃO PODE SER SUPRIMIDO: quem não respondeu ainda
    // precisa ser perguntado. Corrigir demais é o outro jeito de errar.
    const r = bloco({ como_e: {}, essencial: {}, categorias_extras: {} });
    expect(r.lacunas).toContain("desafios atuais");
  });

  it("domínio desconhecido não some — vai a própria chave", () => {
    const r = desafiosDoOnboarding({
      categorias_extras: { desafios_onboarding: ["sono", "dominio_novo_2027"] },
    } as never);
    expect(r).toEqual(["sono", "dominio_novo_2027"]);
  });

  it("lista repetida ou suja não polui o bloco", () => {
    expect(
      desafiosDoOnboarding({
        categorias_extras: { desafios_onboarding: ["sono", "sono", "", "  "] },
      } as never),
    ).toEqual(["sono"]);
    expect(desafiosDoOnboarding({ categorias_extras: { desafios_onboarding: "sono" } } as never)).toEqual([]);
    expect(desafiosDoOnboarding(null)).toEqual([]);
  });
});

describe("REGRESSÃO 2 — comunicação", () => {
  it("MORDE: lê de categorias_extras.comunicacao", () => {
    const r = bloco({
      como_e: {},
      essencial: {},
      categorias_extras: { comunicacao: { texto: "Fala frases de 3 palavras" } },
    });
    expect(r.bloco).toContain("Comunicação hoje: Fala frases de 3 palavras");
  });

  it("MORDE: NUNCA conhecida e ausente ao mesmo tempo", () => {
    // O defeito exato: o bloco afirmava saber e a lacuna dizia não saber.
    const r = bloco({
      como_e: {},
      essencial: {},
      categorias_extras: { comunicacao: { texto: "Fala frases de 3 palavras" } },
    });
    expect(r.bloco).toContain("Comunicação hoje");
    expect(r.lacunas, "prompt autocontraditório").not.toContain("como a criança se comunica");
  });

  it("MORDE: o fallback legado resgata a família que só tem o campo antigo", () => {
    // MEDI: 1 perfil em produção tem SÓ `desafios_regulacao`. Sem esta linha,
    // essa família perderia a informação.
    expect(
      comunicacaoAtual({
        desafios_regulacao: { texto: "Usa gestos e algumas palavras" },
        categorias_extras: {},
      } as never),
    ).toBe("Usa gestos e algumas palavras");
  });

  it("o campo novo vence o legado quando ambos existem", () => {
    expect(
      comunicacaoAtual({
        desafios_regulacao: { texto: "VELHO" },
        categorias_extras: { comunicacao: { texto: "NOVO" } },
      } as never),
    ).toBe("NOVO");
  });

  it("sem nenhum dos dois, a lacuna continua existindo", () => {
    const r = bloco({ como_e: {}, essencial: {}, categorias_extras: {} });
    expect(r.lacunas).toContain("como a criança se comunica");
  });
});

describe("NÃO REGREDIU — o que já funcionava continua", () => {
  const r = () => bloco(perfilRecemCadastrado());

  it("idade continua calculada da data de nascimento", () => {
    expect(r().bloco).toMatch(/Criança: Daniel, \d+ anos/);
  });

  it("diagnóstico e hipótese continuam chegando", () => {
    expect(r().bloco).toContain("Diagnóstico informado pela família: TEA, Hipótese: TDAH");
  });

  it("interesses continuam chegando, sem duplicar as duas fontes", () => {
    expect(r().bloco).toContain("Interesses atuais: dinossauros, água");
    expect(interessesAtuais(perfilRecemCadastrado())).toEqual(["dinossauros", "água"]);
  });

  it("sensorial continua vindo do top-level", () => {
    const b = bloco({
      como_e: {},
      essencial: {},
      sensorial: { texto: "Incomoda com barulho alto" },
      categorias_extras: {},
    });
    expect(b.bloco).toContain("Sensibilidades: Incomoda com barulho alto");
  });

  it("`desafiosAtuais` segue com o comportamento antigo — não foi alterada", () => {
    expect(
      desafiosAtuais({
        categorias_extras: { sono: { texto: "Acorda 3x", atualizado_em: "2026-08-10" } },
      } as never),
    ).toEqual(["sono: Acorda 3x"]);
  });

  it("responsável ausente continua virando lacuna", () => {
    const b = montarContextoBase({ nomeResponsavel: null, membro, perfilVivo: null });
    expect(b.lacunas).toContain("nome do responsável");
  });
});

void vi;
void BancoMemoria;
