import { describe, expect, it } from "vitest";
import { CONTRATO_ROTINA } from "./rotina-guiada";

/**
 * D-R1 (SPEC da Rotina, 08/08/2026) — CONFIRMAÇÃO SELETIVA.
 *
 * O contrato tem que provar OS DOIS LADOS, e é por isso que os testes vêm em
 * pares: um lado sozinho é fácil de satisfazer destruindo o outro. Confirmar
 * sempre passa em "não monta sem confirmar" e reprova a mãe que já deu tudo;
 * nunca confirmar passa em "não pergunta à toa" e monta em cima de suposição.
 *
 * Limite conhecido: isto prende o TEXTO do contrato, não o comportamento do
 * modelo diante dele. A prova comportamental é a bancada, registrada como
 * validação pendente na PEND-004.
 */

describe("A · a mãe ditou a sequência → NÃO ganha pergunta extra", () => {
  it("1. o contrato manda MONTAR quando as etapas são as dela", () => {
    expect(CONTRATO_ROTINA).toMatch(/ELA DITOU A SEQUÊNCIA/);
    expect(CONTRATO_ROTINA).toMatch(/MONTE, sem pedir confirmação/i);
  });

  it("2. e diz POR QUE — confirmar ali é devolver a lista que ela escreveu", () => {
    expect(CONTRATO_ROTINA).toMatch(/mesma lista que ela acabou de escrever/i);
  });

  it("3. o exemplo do caso C está lá, com a sequência ditada", () => {
    expect(CONTRATO_ROTINA).toMatch(/Mario chega, jantar, Mario vai embora, dormir/i);
  });

  it("4. a única parada permitida é INCONSISTÊNCIA REAL — e é sobre ela, não sobre a lista", () => {
    expect(CONTRATO_ROTINA).toMatch(/INCONSISTÊNCIA REAL/);
    expect(CONTRATO_ROTINA).toMatch(/pergunte sobre a inconsistência, não sobre a lista inteira/i);
  });

  it("5. propor horário que ela não deu NÃO conta como inferir a sequência", () => {
    // Sem isto, a regra viraria "toda rotina precisa de confirmação", porque
    // quase toda rotina tem algum horário proposto.
    expect(CONTRATO_ROTINA).toMatch(/propor horário dentro da sequência dela não é inferir a sequência/i);
  });
});

describe("B · a Ayla inferiu → NÃO pode montar em silêncio", () => {
  it("6. o contrato manda devolver a proposta e perguntar", () => {
    expect(CONTRATO_ROTINA).toMatch(/VOCÊ INFERIU, ACRESCENTOU OU REORGANIZOU/);
    expect(CONTRATO_ROTINA).toMatch(/devolva "perguntar" com a proposta/i);
  });

  it("7. os quatro modos de inferir estão nomeados", () => {
    for (const modo of [
      /encaixou uma etapa que ela não citou/i,
      /mudou a ordem/i,
      /quebrou uma etapa em duas/i,
      /completou o começo ou o fim/i,
    ]) {
      expect(CONTRATO_ROTINA, `falta o modo ${modo}`).toMatch(modo);
    }
  });

  it("8. a proposta é escrita, curta e com UMA pergunta", () => {
    expect(CONTRATO_ROTINA).toMatch(/curta, numerada, e uma pergunta só/i);
  });

  it("9. um 'sim' curto libera a montagem", () => {
    expect(CONTRATO_ROTINA).toMatch(/"sim", "pode ser", "isso mesmo" libera a montagem/i);
  });

  it("10. correção da mãe entra e a rotina é montada com ela", () => {
    expect(CONTRATO_ROTINA).toMatch(/uma correção entra e você monta com ela/i);
  });
});

describe("os dois lados juntos — nenhum pode engolir o outro", () => {
  it("11. MORDE o lado A: a regra antiga não pode voltar como incondicional", () => {
    // "MONTE — não peça confirmação antes", solta, revoga o lado B inteiro.
    expect(CONTRATO_ROTINA).not.toMatch(/MONTE — não peça confirmação antes/);
  });

  it("12. MORDE o lado B: não pode virar 'confirme sempre'", () => {
    expect(CONTRATO_ROTINA).toMatch(/Não é confirmar sempre, nem nunca/i);
    expect(CONTRATO_ROTINA).toMatch(/O que se confirma é O QUE É SEU/i);
  });

  it("13. a confirmação não vira mais uma rodada de perguntas", () => {
    expect(CONTRATO_ROTINA).toMatch(/NÃO transforme a confirmação em mais uma rodada de perguntas/i);
    expect(CONTRATO_ROTINA).toMatch(/É UMA mensagem/);
  });

  it("14. o critério é DE QUEM É A SEQUÊNCIA — não o tamanho nem o número de turnos", () => {
    expect(CONTRATO_ROTINA).toMatch(/Depende de QUEM escreveu a sequência/i);
    expect(CONTRATO_ROTINA).toMatch(/as etapas que vão pro quadro são as que ELA deu, ou você é que completou/i);
  });
});

describe("o que a mudança NÃO pode ter derrubado", () => {
  it("15. quem pede rotina continua recebendo rotina, não plano", () => {
    expect(CONTRATO_ROTINA).toMatch(/NUNCA chame a rotina de "plano estratégico"/);
  });

  it("16. a menor ajuda que resolve continua sendo o princípio", () => {
    expect(CONTRATO_ROTINA).toMatch(/a MENOR que resolve/);
    expect(CONTRATO_ROTINA).toMatch(/Quem decide o tamanho é o porteiro/);
  });

  it("17. montar continua sendo no passado, nunca no futuro", () => {
    expect(CONTRATO_ROTINA).toMatch(/NUNCA escreva "vou montar", "vou gerar"/);
  });

  it("18. duas crianças: o tema continua não sendo assunto da Ayla", () => {
    expect(CONTRATO_ROTINA).toMatch(/TEMA dos cartões NÃO é assunto seu/);
  });
});
