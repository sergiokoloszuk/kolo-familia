import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { nomeUsavelCuidador, primeiroNomeConfiavel } from "./crianca-nome";
import { templateBoasVindasComDesafio } from "./messageTemplates";

/**
 * O NOME DE QUEM CUIDA — o campo aceita qualquer coisa, e aceitava calado.
 *
 * Caso real (02/08/2026): uma mãe escreveu a apresentação inteira no campo do
 * nome, e a PRIMEIRA mensagem que ela recebeu começou assim:
 *
 *   "Oi, Meu Nome e Gisela Meu Filgo e Davi Ele e Autista 💛"
 *
 * O detector `motivoNomeNaoNome` já classificava esse texto como "recado" —
 * ele só nunca tinha sido ligado ao campo do cuidador, apenas ao da criança.
 *
 * Os textos abaixo são o caso real com os nomes trocados.
 */

// Mesma FORMA do caso real (frase em 1ª pessoa, 2 nomes, ~50 caracteres).
const RECADO_REAL = "Meu Nome e Renata Meu Filho e Bruno Ele e Autista";

describe("nome do cuidador — o que é nome e o que é recado", () => {
  it("uma apresentação inteira no campo do nome NÃO é nome", () => {
    expect(nomeUsavelCuidador(RECADO_REAL)).toBe(false);
    expect(primeiroNomeConfiavel(RECADO_REAL)).toBe("");
  });

  it("nome simples e nome composto longo continuam valendo", () => {
    expect(primeiroNomeConfiavel("Renata")).toBe("Renata");
    expect(primeiroNomeConfiavel("Renata Fróes Mathias Duarte")).toBe("Renata");
  });

  it("vazio, nulo e só espaço não viram nome", () => {
    for (const v of ["", "   ", null, undefined]) {
      expect(primeiroNomeConfiavel(v)).toBe("");
    }
  });

  it("recado com pontuação de frase também é barrado", () => {
    expect(primeiroNomeConfiavel("Cuido de várias crianças. Sou terapeuta!")).toBe("");
  });

  it("é o MESMO detector do nome da criança — não um paralelo", () => {
    const FONTE = readFileSync(resolve(__dirname, "crianca-nome.ts"), "utf8");
    // Se alguém criar regex própria pra cuidador, os dois divergem com o tempo.
    expect(FONTE).toMatch(/export function nomeUsavelCuidador[\s\S]{0,120}motivoNomeNaoNome\(nome\) === null/);
  });
});

describe("a saudação funciona sem nome", () => {
  const desafios = ["comunicacao", "nutricional", "emocional"];

  it("com recado no campo do nome, saúda sem nome — e NÃO imprime a frase", () => {
    const m = templateBoasVindasComDesafio({
      nomeMae: RECADO_REAL,
      nomeMembro: "Bruno",
      genero: "masculino",
      desafios,
    });
    expect(m).not.toContain("Meu Nome e");
    expect(m).not.toContain("Ele e Autista");
    expect(m.startsWith("Oi! Eu sou a Ayla")).toBe(true);
    // Sem vírgula solta nem espaço duplo onde o nome sairia.
    expect(m).not.toMatch(/Oi,\s*[!💛]/);
  });

  it("NUNCA usa o nome da criança no lugar do nome de quem cuida", () => {
    const m = templateBoasVindasComDesafio({
      nomeMae: RECADO_REAL,
      nomeMembro: "Bruno",
      genero: "masculino",
      desafios,
    });
    expect(m).not.toMatch(/^Oi, Bruno/);
  });

  it("com nome bom, usa o primeiro nome", () => {
    const m = templateBoasVindasComDesafio({
      nomeMae: "Renata Fróes Mathias Duarte",
      nomeMembro: "Bruno",
      genero: "masculino",
      desafios,
    });
    expect(m.startsWith("Oi, Renata! Eu sou a Ayla")).toBe(true);
  });

  it("os dois funis do WhatsApp filtram no mesmo ponto", () => {
    const ORCH = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");
    const ESP = readFileSync(resolve(__dirname, "mensagemEspontanea.ts"), "utf8");
    expect(ORCH).toMatch(/nomeMae: primeiroNomeConfiavel\(profile\?\.como_chamar\) \|\| primeiroNomeConfiavel\(profile\?\.nome_mae\)/);
    expect(ESP).toMatch(/primeiroNomeConfiavel\(profile\?\.como_chamar\)/);
    // A forma antiga, que passava o campo cru, não pode voltar.
    expect(ORCH).not.toMatch(/nomeMae: profile\?\.como_chamar\?\.trim\(\)/);
  });
});

describe("a abertura ensina o que a Ayla faz", () => {
  const m = templateBoasVindasComDesafio({
    nomeMae: "Renata",
    nomeMembro: "Bruno",
    genero: "masculino",
    desafios: ["comunicacao", "nutricional", "emocional"],
  });

  it("a Ayla se apresenta pelo nome", () => {
    expect(m).toContain("Eu sou a Ayla");
  });

  it("diz a que veio, com a criança nomeada", () => {
    expect(m).toContain("te ajudar nos desafios do dia a dia com o Bruno");
  });

  it("devolve os TRÊS desafios que a família marcou", () => {
    expect(m).toContain("a comunicação");
    expect(m).toContain("a alimentação");
    expect(m).toContain("as emoções e as crises");
    expect(m).toContain("Pelo que você contou quando entrou");
  });

  it("explica o território: estratégias, o que fazer/falar, brincadeiras", () => {
    expect(m).toContain("estratégias práticas");
    expect(m).toContain("o que fazer e o que falar");
    expect(m).toContain("brincadeiras e atividades");
    expect(m).toContain("trabalhar essas habilidades");
  });

  it("pergunta por onde começar, convida áudio e promete entrega", () => {
    expect(m).toContain("Por qual você quer começar?");
    expect(m).toContain("*áudio*");
    expect(m).toContain("primeira ideia prática");
  });

  it("não vira catálogo nem promete artefato", () => {
    expect(m).not.toMatch(/relatório|PDF|plano estratégico/i);
  });

  it("com um desafio só, concorda no singular", () => {
    const um = templateBoasVindasComDesafio({
      nomeMae: "Renata",
      nomeMembro: "Lia",
      genero: "feminino",
      desafios: ["sono"],
    });
    expect(um).toContain("tem pesado é o sono");
    expect(um).toContain("com a Lia");
  });

  it("sem nome utilizável da criança, a frase não fica quebrada", () => {
    const semNome = templateBoasVindasComDesafio({
      nomeMae: "Renata",
      nomeMembro: "Cuido de várias crianças. Sou terapeuta!",
      genero: "masculino",
      desafios: ["sono"],
    });
    expect(semNome).not.toContain("Cuido de várias");
    expect(semNome).toContain("nos desafios do dia a dia.");
  });
});
