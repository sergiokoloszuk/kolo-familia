import { describe, it, expect } from "vitest";
import { rotuloDoSujeito, montarContextoBase } from "./experimental-contexto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * O CASO SAMARA — 05/09/2026.
 *
 * ⚠️ O prompt oficial serializava **"Criança: Samara, 37 anos"**. A pessoa
 * acompanhada tem 37 anos, `papel_outro = "Eu Mesmo"` e diagnóstico de
 * depressão, ansiedade e síndrome do pânico. O modelo recebeu um sujeito
 * semanticamente falso e respondeu coerente com ele.
 *
 * ⚠️ OS CORTES SÃO OS QUE O PRODUTO JÁ TINHA: 12 é `ehCrianca` em
 * `mensagemEspontanea.ts`; 18 é a fronteira do acervo de Boas Práticas.
 */
describe("o sujeito que o GPT recebe", () => {
  it("S1. MORDE: 37 anos não é criança", () => {
    expect(rotuloDoSujeito(37)).not.toMatch(/Criança/);
    expect(rotuloDoSujeito(37)).toMatch(/adulta/);
  });

  it("S2. MORDE: os cortes existentes são respeitados", () => {
    expect(rotuloDoSujeito(3)).toBe("Criança");
    expect(rotuloDoSujeito(12)).toBe("Criança");
    expect(rotuloDoSujeito(13)).toBe("Adolescente");
    expect(rotuloDoSujeito(18)).toBe("Adolescente");
    expect(rotuloDoSujeito(19)).toMatch(/adulta/);
  });

  /** ⚠️ Sem idade, inventar faixa seria repetir o erro na outra direção. */
  it("S3. MORDE: sem data de nascimento, o rótulo é neutro", () => {
    expect(rotuloDoSujeito(null)).toBe("Pessoa acompanhada");
  });

  it("S4. MORDE: o bloco real da Samara deixa de dizer 'Criança'", () => {
    const { bloco } = montarContextoBase({
      nomeResponsavel: "Samara",
      membro: {
        nome: "Samara",
        data_nascimento: "1989-02-17",
        diagnosticos_formais: ["Depresao Anciedade síndrome do pânico"],
        genero: "feminino",
      },
      perfilVivo: null,
      skills: [],
    });
    expect(bloco).not.toMatch(/Criança: Samara/);
    expect(bloco).toMatch(/Samara, 3[0-9] anos/);
  });

  /** ⚠️ E a criança de verdade continua sendo chamada de criança. */
  it("S5. MORDE: nenhuma regressão para criança e adolescente", () => {
    for (const [nasc, esperado] of [["2020-03-01", "Criança"], ["2010-01-01", "Adolescente"]] as const) {
      const { bloco } = montarContextoBase({
        nomeResponsavel: "Ana",
        membro: { nome: "Théo", data_nascimento: nasc, diagnosticos_formais: [], genero: "masculino" },
        perfilVivo: null,
        skills: [],
      });
      expect(bloco).toMatch(new RegExp(`${esperado}: Théo`));
    }
  });

  /**
   * ⚠️ E A PORTA DE ENTRADA FECHA. O campo pede grau de parentesco e validava
   * só dois caracteres — "Eu Mesmo" passou.
   */
  it("S6. MORDE: autorreferência não é grau de parentesco", () => {
    const SRC = readFileSync(resolve(__dirname, "../../app/onboarding/actions.ts"), "utf8");
    const m = SRC.match(/const AUTORREFERENCIA = (\/.+\/[a-z]*);/);
    expect(m, "AUTORREFERENCIA sumiu do onboarding").toBeTruthy();
    const re = new RegExp(m![1].slice(1, m![1].lastIndexOf("/")), "i");
    for (const t of ["Eu Mesmo", "eu mesma", "EU", "mim", "própria"]) {
      expect(re.test(t), `"${t}" deveria ser recusado`).toBe(true);
    }
    for (const t of ["madrasta", "tio", "avó", "responsável legal", "padrasto"]) {
      expect(re.test(t), `"${t}" é parentesco válido`).toBe(false);
    }
    expect(SRC).toMatch(/A Kolo acompanha uma criança ou jovem/);
  });
});
