import { describe, it, expect } from "vitest";
import { montarContextoBase, desafiosAtuais, TETO_CONTEXTO_BASE } from "./experimental-contexto";

/**
 * O QUE ESTÁ SALVO E CABE NO CONTEXTO NÃO É DESCARTADO — PEND-089, correção do corte.
 *
 * ═══ O CASO ROSANGELA (17/08/2026, produção) ═══
 *
 * Ela perguntou: *"quais são os alimentos que ele gosta?"*. O perfil tinha,
 * salvo desde 07/08, `nutricional`:
 *
 *     Aceita bem / preferidos: banana; maçã; melancia; mamão
 *
 * A Ayla respondeu: **"até agora não tenho registrado quais alimentos o Matheo
 * gosta. Sei apenas que ele se interessa por bichinhos e música."**
 *
 * PROVEI POR EXECUÇÃO, reconstruindo o bloco com o perfil real: "banana" não
 * estava no prompt. Alimentação era o domínio mais ANTIGO entre cinco
 * preenchidos, ficou em 5º na ordenação por recência, e o `limite = 3` a
 * cortou antes de o prompt existir. O modelo respondeu com fidelidade perfeita
 * ao que recebeu — "bichinhos e música" era literalmente a linha `Interesses
 * atuais` do bloco.
 *
 * MEDI na base: 131 domínios descartados em 31 de 77 perfis; em alimentação,
 * 16 de 28 perfis (57%) estavam fora do contexto.
 */

/** O perfil real da criança da Rosangela, como estava no banco em 17/08/2026. */
const PERFIL_ROSANGELA = {
  como_e: { interesses: ["bichinhos", "música"] },
  categorias_extras: {
    comunicacao: {
      texto: "Como se comunica: Fala frases",
      atualizado_em: "2026-08-17T19:17:19.013Z",
    },
    rotina: {
      texto: "O que ajuda nas transições: opções pré-filtradas de roupa adequadas ao clima",
      atualizado_em: "2026-08-12T18:37:50.848Z",
    },
    foco: { texto: "Como é o foco: Dispersa fácil", atualizado_em: "2026-08-11T13:22:10.804Z" },
    socializacao: {
      texto: "Divide e espera a vez: Custa",
      atualizado_em: "2026-08-11T13:16:49.781Z",
    },
    nutricional: {
      texto: "Aceita bem / preferidos: banana; maçã; melancia; mamão",
      atualizado_em: "2026-08-07T18:02:08.852Z",
    },
  },
} as never;

const montarRosangela = () =>
  montarContextoBase({
    nomeResponsavel: "Rosangela",
    membro: {
      nome: "Matheo",
      data_nascimento: "2022-02-26",
      diagnosticos_formais: null,
      genero: null,
    },
    perfilVivo: PERFIL_ROSANGELA,
  });

describe("caso Rosangela — a alimentação chega ao modelo", () => {
  it("1. MORDE: os quatro alimentos estão no bloco", () => {
    const { bloco } = montarRosangela();
    for (const alimento of ["banana", "maçã", "melancia", "mamão"]) {
      expect(bloco, `"${alimento}" não chegou ao contexto`).toContain(alimento);
    }
  });

  it("2. a pergunta dela passa a ser respondível só com o perfil", () => {
    const { bloco } = montarRosangela();
    expect(bloco).toContain("Aceita bem / preferidos");
  });

  it("3. MORDE: os domínios recentes continuam chegando — nada foi trocado", () => {
    const { bloco } = montarRosangela();
    expect(bloco).toContain("Fala frases"); // 17/08, o mais recente
    expect(bloco).toContain("Dispersa fácil"); // 11/08
    expect(bloco).toContain("roupa adequadas ao clima"); // 12/08
    expect(bloco).toContain("Divide e espera a vez"); // 11/08 — era o 4º, cortado antes
  });

  it("4. a ordem continua por recência: o mais novo antes do mais velho", () => {
    const { bloco } = montarRosangela();
    expect(bloco.indexOf("Fala frases")).toBeLessThan(bloco.indexOf("banana"));
  });

  it("5. o bloco continua dentro do teto", () => {
    const { bloco } = montarRosangela();
    expect(bloco.length).toBeLessThanOrEqual(TETO_CONTEXTO_BASE);
  });
});

/** Doze domínios curtos — o perfil mais rico que existe hoje na base. */
function perfilRico(tamanhoDoTexto = 40) {
  const dominios = [
    "sensorial", "nutricional", "comunicacao", "emocional", "foco", "sono",
    "socializacao", "motor", "rotina", "autonomia", "aprendizado", "escola",
  ];
  const extras: Record<string, unknown> = {};
  dominios.forEach((d, i) => {
    extras[d] = {
      texto: `${d.toUpperCase()}-${"x".repeat(Math.max(1, tamanhoDoTexto - d.length - 1))}`,
      // Datas decrescentes: o primeiro da lista é o mais recente.
      atualizado_em: `2026-08-${String(17 - i).padStart(2, "0")}T12:00:00.000Z`,
    };
  });
  return { categorias_extras: extras } as never;
}

describe("perfil com muitos domínios", () => {
  it("6. MORDE: com 12 domínios curtos, TODOS os 12 chegam", () => {
    const { bloco } = montarContextoBase({
      nomeResponsavel: "Ana",
      membro: { nome: "Léo", data_nascimento: "2019-01-01", diagnosticos_formais: null },
      perfilVivo: perfilRico(40),
    });
    for (const d of ["SENSORIAL", "NUTRICIONAL", "ESCOLA", "AUTONOMIA", "MOTOR"]) {
      expect(bloco, `${d} foi descartado mesmo cabendo`).toContain(d);
    }
    expect(bloco.length).toBeLessThanOrEqual(TETO_CONTEXTO_BASE);
  });

  it("7. `desafiosAtuais` deixou de cortar em 3", () => {
    expect(desafiosAtuais(perfilRico(40)).length).toBe(12);
    // O parâmetro continua existindo para quem quiser um recorte explícito.
    expect(desafiosAtuais(perfilRico(40), 3).length).toBe(3);
  });
});

describe("quando NÃO cabe: poda progressiva, sem sumir a seção", () => {
  /** Doze domínios longos: passa do teto de propósito. */
  const enorme = perfilRico(140);

  it("8. MORDE: a seção de desafios NÃO desaparece", () => {
    const { bloco } = montarContextoBase({
      nomeResponsavel: "Ana",
      membro: { nome: "Léo", data_nascimento: "2019-01-01", diagnosticos_formais: null },
      perfilVivo: enorme,
    });
    expect(bloco, "a seção inteira sumiu — era o defeito do `linhas.pop()`").toContain(
      "Desafios atuais:",
    );
    // E sobrou conteúdo de verdade, não só o cabeçalho.
    expect(bloco).toMatch(/Desafios atuais:\n- \w/);
  });

  it("9. poda item a item: entram menos que 12, mas mais que zero", () => {
    const { bloco } = montarContextoBase({
      nomeResponsavel: "Ana",
      membro: { nome: "Léo", data_nascimento: "2019-01-01", diagnosticos_formais: null },
      perfilVivo: enorme,
    });
    const itens = (bloco.match(/^- /gm) ?? []).length;
    expect(itens).toBeGreaterThan(0);
    expect(itens).toBeLessThan(12);
  });

  it("10. o que sobrevive é o MAIS RECENTE — a poda come pelo fim", () => {
    const { bloco } = montarContextoBase({
      nomeResponsavel: "Ana",
      membro: { nome: "Léo", data_nascimento: "2019-01-01", diagnosticos_formais: null },
      perfilVivo: enorme,
    });
    // "sensorial" é o mais recente do fixture; "escola" é o mais antigo.
    expect(bloco).toContain("SENSORIAL");
    expect(bloco).not.toContain("ESCOLA");
  });

  it("11. o teto continua sendo respeitado", () => {
    const { bloco } = montarContextoBase({
      nomeResponsavel: "Ana",
      membro: { nome: "Léo", data_nascimento: "2019-01-01", diagnosticos_formais: null },
      perfilVivo: enorme,
    });
    expect(bloco.length).toBeLessThanOrEqual(TETO_CONTEXTO_BASE);
  });
});

describe("nada de token à toa", () => {
  it("12. domínio sem texto não vira linha", () => {
    const pv = {
      categorias_extras: {
        sono: { texto: "", atualizado_em: "2026-08-17T12:00:00Z" },
        foco: { texto: "   ", atualizado_em: "2026-08-16T12:00:00Z" },
        motor: { texto: "Sobe escada alternando os pés", atualizado_em: "2026-08-15T12:00:00Z" },
      },
    } as never;
    const d = desafiosAtuais(pv);
    expect(d).toHaveLength(1);
    expect(d[0]).toContain("Sobe escada");
  });

  it("13. perfil vazio não cria seção nenhuma", () => {
    const { bloco } = montarContextoBase({
      nomeResponsavel: "Ana",
      membro: { nome: "Léo", data_nascimento: "2019-01-01", diagnosticos_formais: null },
      perfilVivo: { categorias_extras: {} } as never,
    });
    expect(bloco).not.toContain("Desafios atuais:");
  });
});
