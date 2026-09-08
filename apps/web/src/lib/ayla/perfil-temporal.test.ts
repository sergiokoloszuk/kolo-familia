import { describe, expect, it } from "vitest";
import { desafiosAtuais, MARCA_ANTIGO, MARCA_SEM_DATA } from "./experimental-contexto";

/**
 * GATE A · A1 — TEMPORALIDADE DOS DOMÍNIOS DE TEXTO DO PERFIL.
 *
 * ⚠️ MEDIDO em 08/09/2026, nos 177 perfis da base: 355 domínios preenchidos com
 * `atualizado_em` e 33 sem. Distribuição de idade dos datados: mediana 35 dias,
 * p75 42, **p90 61**, máximo 101. Os cortes destes testes saem daí — não de um
 * número redondo.
 *
 * ⚠️ O QUE ESTE GATE **NÃO** RESOLVE, e é importante não confundir: o barco da
 * Manu e o sudoku do Mario NÃO passam por aqui. `desafiosAtuais` só lê domínios
 * cujo valor é `{ texto }`; `categorias_extras.transicoes` é um array e é
 * descartado nesta função. Aquilo é A2, em `transicoes-temporais.test.ts`.
 */

const HOJE = new Date();
const diasAtras = (n: number) => new Date(HOJE.getTime() - n * 86400_000).toISOString();
const perfil = (extras: Record<string, unknown>) =>
  ({ categorias_extras: extras }) as Parameters<typeof desafiosAtuais>[0];

describe("Gate A · perfil: recente, antigo e sem data se distinguem", () => {
  it("domínio recente não recebe marca nenhuma — 87% da base fica limpa", () => {
    const d = desafiosAtuais(perfil({ sono: { texto: "Sono irregular", atualizado_em: diasAtras(10) } }));
    expect(d).toEqual(["sono: Sono irregular"]);
  });

  it("domínio antigo é marcado como informação antiga", () => {
    const d = desafiosAtuais(perfil({ sono: { texto: "Sono irregular", atualizado_em: diasAtras(95) } }));
    expect(d[0]).toContain("Sono irregular");
    expect(d[0]).toContain(MARCA_ANTIGO);
    expect(d[0]).toMatch(/há ~3 meses/);
  });

  it("domínio SEM data é marcado — legado nunca é promovido a atual", () => {
    // 33 domínios reais estão assim; o onboarding grava `{ texto }` sem carimbo.
    const d = desafiosAtuais(perfil({ escola: { texto: "Dificuldade para focar" } }));
    expect(d[0]).toContain(MARCA_SEM_DATA);
  });

  it("a fronteira é 60 dias — p90 do que existe na base", () => {
    const em = (dias: number) =>
      desafiosAtuais(perfil({ foco: { texto: "Foca no que gosta", atualizado_em: diasAtras(dias) } }))[0];
    expect(em(59)).toBe("foco: Foca no que gosta");
    expect(em(61)).toContain(MARCA_ANTIGO);
  });

  it("data corrompida cai em 'sem data', não em 'recente'", () => {
    const d = desafiosAtuais(perfil({ sono: { texto: "Dorme bem", atualizado_em: "ontem" } }));
    expect(d[0]).toContain(MARCA_SEM_DATA);
  });

  it("a marca fala do REGISTRO e não polui o texto do domínio", () => {
    const d = desafiosAtuais(perfil({ sono: { texto: "Sono irregular", atualizado_em: diasAtras(200) } }));
    // O conteúdo continua íntegro e legível antes do colchete.
    expect(d[0].split(" [")[0]).toBe("sono: Sono irregular");
  });
});

describe("Gate A · perfil: o que não pode ser bloqueado nem quebrado", () => {
  it("perfil vazio continua devolvendo lista vazia", () => {
    expect(desafiosAtuais(null)).toEqual([]);
    expect(desafiosAtuais(perfil({}))).toEqual([]);
  });

  it("o array `transicoes` continua fora do retrato — não é domínio de texto", () => {
    const d = desafiosAtuais(
      perfil({
        transicoes: [{ momento: "passeio de barco", estrategia: "antecipação visual" }],
        sono: { texto: "Dorme bem", atualizado_em: diasAtras(3) },
      }),
    );
    expect(d.join(" ").toLowerCase()).not.toContain("barco");
    expect(d).toContain("sono: Dorme bem");
  });

  it("a ordenação por pertinência e recência não mudou", () => {
    const d = desafiosAtuais(
      perfil({
        sono: { texto: "Dorme bem", atualizado_em: diasAtras(1) },
        emocional: { texto: "Desregula com facilidade", atualizado_em: diasAtras(2) },
      }),
      20,
      ["emocional"],
    );
    // A skill do turno vem primeiro, mesmo sendo menos recente.
    expect(d[0]).toBe("emoções: Desregula com facilidade");
    expect(d[1]).toBe("sono: Dorme bem");
  });

  it("informação recente e pertinente continua utilizável, sem ressalva", () => {
    const d = desafiosAtuais(
      perfil({ nutricional: { texto: "Seletividade alta", atualizado_em: diasAtras(5) } }),
      20,
      ["nutricional"],
    );
    expect(d[0]).toBe("alimentação: Seletividade alta");
    expect(d[0]).not.toContain("[");
  });
});
