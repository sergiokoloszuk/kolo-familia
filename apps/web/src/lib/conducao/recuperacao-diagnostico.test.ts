import { describe, it, expect } from "vitest";
import {
  instrucaoRegenerar,
  respostaSeguraDeDiagnostico,
} from "./recuperacao-diagnostico";
import { acharConclusaoDiagnostica } from "./deteccao-diagnostico";

/**
 * A rede que faltava no WhatsApp: detecta → regenera orientado pelo erro →
 * e, se ainda assim vazar, entrega um piso que continua sendo uma RESPOSTA.
 */

describe("piso — é uma resposta de verdade, não um acolhimento vazio", () => {
  const piso = respostaSeguraDeDiagnostico({
    nomeCuidador: "Paloma",
    nomeMembro: "Thayla",
  });

  it("NÃO atravessa a fronteira que acabou de ser atravessada duas vezes", () => {
    // Se o piso vazasse, o caminho inteiro seria inútil — é a última coisa que
    // sai, e não passa por modelo nenhum.
    expect(acharConclusaoDiagnostica(piso)).toEqual([]);
  });

  it("é honesto sobre o PORQUÊ — e o porquê não é falta de informação", () => {
    expect(piso).toMatch(/não sai de conversa/);
    expect(piso).toMatch(/Não é que falte você me contar mais/);
    // Justamente o que a fronteira proíbe insinuar.
    expect(piso).not.toMatch(/me conta mais|preciso saber mais|informações suficientes/i);
  });

  it("continua ÚTIL: oferece o próximo passo concreto, não só a recusa", () => {
    expect(piso).toMatch(/organizar/i);
    expect(piso).toMatch(/resumo pra você levar/i);
    expect(piso).toMatch(/dia a dia/i);
  });

  it("conduz — devolve a escolha em vez de encerrar", () => {
    expect(piso.trimEnd().endsWith("?")).toBe(true);
  });

  it("é contextual: usa quem fala e de quem se fala", () => {
    expect(piso).toContain("Paloma");
    expect(piso).toContain("Thayla");
  });

  it("não é o fallback genérico que já existia — este era o veto explícito", () => {
    // O fallback generico do canal ("To aqui com voce 🌿 Me conta um pouquinho
    // mais sobre isso?") era o veto explicito: nao pode ser a resposta a quem
    // acabou de perguntar o diagnostico da filha.
    expect(piso).not.toMatch(/me conta um pouquinho mais/i);
    expect(piso).not.toMatch(/Tô aqui com você/);
  });

  it("funciona sem saber os nomes, sem frase quebrada", () => {
    const anonimo = respostaSeguraDeDiagnostico({ nomeCuidador: null, nomeMembro: null });
    expect(acharConclusaoDiagnostica(anonimo)).toEqual([]);
    // Sem vocativo pendurado, espaço duplo ou buraco de interpolação. As
    // quebras de parágrafo (\n\n) são intencionais e não entram aqui.
    expect(anonimo).not.toMatch(/ ,| {2,}|undefined|null/);
    expect(anonimo).toMatch(/ajudar ela hoje/);
  });
});

describe("instrução de regenerar — orientada pelo erro, nos dois sentidos", () => {
  const instr = instrucaoRegenerar([
    { codigo: "encaixe", trecho: "o que voce me contou vai alem da fala" },
  ]);

  it("diz o que denunciou a resposta anterior", () => {
    expect(instr).toContain("vai alem da fala");
    expect(instr).toMatch(/NÃO foi enviada/);
  });

  it("proíbe as duas formas de errar, não só uma", () => {
    // Só "não conclua" produz a recusa burocrática — a outra falha.
    expect(instr).toMatch(/não conclua/i);
    expect(instr).toMatch(/recusa seca/);
    expect(instr).toMatch(/tão errada quanto/);
  });

  it("proíbe pedir mais informação como saída", () => {
    expect(instr).toMatch(/NÃO diga que falta informação/);
  });

  it("manda continuar ajudando, com movimentos concretos", () => {
    expect(instr).toMatch(/Continue ajudando/);
    expect(instr).toMatch(/organiza/);
  });

  it("limita a evidência citada — a instrução não pode virar um dump", () => {
    const muitos = instrucaoRegenerar(
      Array.from({ length: 9 }, (_, i) => ({ codigo: `c${i}`, trecho: `trecho ${i}` })),
    );
    expect(muitos).toContain("trecho 0");
    expect(muitos).not.toContain("trecho 3");
  });
});
