import { describe, it, expect } from "vitest";
import {
  classificarInteresses,
  etiquetaDaFala,
  JANELA_CONVERSA_MAX_DIAS,
} from "./memoria-temporal";

/**
 * MEMÓRIA É CONTEXTO, NÃO PAUTA — 19/11/2026.
 *
 * O caso que originou: álbum de figurinhas da Copa, seis meses depois, ainda
 * oferecido como gancho ("mais uma figurinha e depois banho"). Reproduzido na
 * bancada `memoria-respostas`, juiz 2/5.
 */
const AGORA = new Date("2026-11-19T22:00:00.000Z");
const dias = (n: number) => new Date(AGORA.getTime() - n * 86_400_000).toISOString();

describe("classificarInteresses", () => {
  it("B · interesse de 6 meses atrás, sem menção recente, NÃO é atual", () => {
    const r = classificarInteresses({
      interesses: ["álbum de figurinhas da Copa", "Futebol"],
      mencoes: [{ texto: "O Theo só fala do álbum de figurinhas da Copa", created_at: dias(186) }],
      membroId: "theo",
      perfilCriadoEm: dias(185),
      agora: AGORA,
    });
    expect(r.recentes).toEqual([]);
    expect(r.semConfirmacao).toEqual(["álbum de figurinhas da Copa", "Futebol"]);
  });

  it("I · caso legítimo: a família falou do interesse esta semana — continua valendo", () => {
    const r = classificarInteresses({
      interesses: ["Dinossauro", "Lego"],
      mencoes: [{ texto: "Agora ele só quer saber de dinossauros", created_at: dias(5) }],
      membroId: "davi",
      perfilCriadoEm: dias(300),
      agora: AGORA,
    });
    expect(r.recentes).toEqual(["Dinossauro"]);
    expect(r.semConfirmacao).toEqual(["Lego"]);
  });

  it("I · perfil criado há menos de 90 dias (onboarding recente) vale inteiro", () => {
    const r = classificarInteresses({
      interesses: ["Cozinha", "Massinha"],
      mencoes: [],
      membroId: "manu",
      perfilCriadoEm: dias(20),
      agora: AGORA,
    });
    expect(r.recentes).toEqual(["Cozinha", "Massinha"]);
  });

  it("I · preferências editadas há menos de 90 dias valem inteiras", () => {
    const r = classificarInteresses({
      interesses: ["Cinema"],
      mencoes: [],
      membroId: "x",
      perfilCriadoEm: dias(400),
      preferenciasAtualizadasEm: dias(10),
      agora: AGORA,
    });
    expect(r.recentes).toEqual(["Cinema"]);
  });

  it("fala de abandono não confirma ('esqueceu a Patrulha Canina')", () => {
    const r = classificarInteresses({
      interesses: ["Patrulha Canina", "dinossauros"],
      mencoes: [
        { texto: "Agora a mania dele é dinossauro, esqueceu a Patrulha Canina.", created_at: dias(4) },
        { texto: "Ele pediu um livro de dinossauro", created_at: dias(3) },
      ],
      membroId: "davi",
      perfilCriadoEm: dias(200),
      agora: AGORA,
    });
    expect(r.recentes).toEqual(["dinossauros"]);
    expect(r.semConfirmacao).toEqual(["Patrulha Canina"]);
  });

  it("fala sobre o IRMÃO não confirma o gosto desta criança", () => {
    const r = classificarInteresses({
      interesses: ["Futebol"],
      mencoes: [{ texto: "O Tomás jogou futebol hoje", created_at: dias(2), membro_atipico_id: "tomas" }],
      membroId: "joana",
      perfilCriadoEm: dias(200),
      agora: AGORA,
    });
    expect(r.recentes).toEqual([]);
  });

  it("palavra curta ou vazia não casa por acidente", () => {
    const r = classificarInteresses({
      interesses: ["Carros de corrida"],
      mencoes: [{ texto: "Hoje de manhã foi difícil", created_at: dias(1) }],
      membroId: "x",
      perfilCriadoEm: dias(200),
      agora: AGORA,
    });
    expect(r.recentes).toEqual([]);
  });

  it("sem data nenhuma, nada é promovido a atual", () => {
    const r = classificarInteresses({ interesses: ["Lego"], mencoes: [], membroId: "x", agora: AGORA });
    expect(r.recentes).toEqual([]);
  });
});

describe("etiquetaDaFala", () => {
  it("até 72 h entra sem etiqueta", () => {
    expect(etiquetaDaFala(dias(0.5), AGORA)).toBe("");
    expect(etiquetaDaFala(dias(2.9), AGORA)).toBe("");
  });
  it("de 3 a 30 dias entra datada", () => {
    expect(etiquetaDaFala(dias(5), AGORA)).toBe("[há 5 dias]");
    expect(etiquetaDaFala(dias(JANELA_CONVERSA_MAX_DIAS), AGORA)).toBe(`[há ${JANELA_CONVERSA_MAX_DIAS} dias]`);
  });
  it("mais de 30 dias, ou sem data, não entra", () => {
    expect(etiquetaDaFala(dias(186), AGORA)).toBeNull();
    expect(etiquetaDaFala(null, AGORA)).toBeNull();
    expect(etiquetaDaFala("lixo", AGORA)).toBeNull();
  });
});
