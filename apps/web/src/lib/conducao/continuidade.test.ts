import { describe, it, expect } from "vitest";
import { blocoDeContinuidade, perguntaAberta } from "./continuidade";

/**
 * OS QUATRO REPLAYS — cada um é um incidente de produção de 05/09/2026.
 *
 * ⚠️ O BLOCO NÃO DECIDE NADA. Ele diz ao GPT o que o histórico em prosa não
 * deixava ver. Estes testes provam o CONTEÚDO do bloco, não a resposta — a
 * interpretação continua sendo do modelo.
 */
describe("continuidade — os quatro replays", () => {
  /**
   * VANESSA. Respondeu "Ok" a um aviso de fim de teste. Virou um plano chamado
   * "Responder 'ok' com clareza".
   */
  it("R1. Vanessa: 'Ok' sem pergunta aberta é cortesia, não assunto", () => {
    const b = blocoDeContinuidade({
      ultimaAyla: "Vanessa, faltam 3 dias pro fim do seu período grátis. Quis te avisar com antecedência.",
      mensagem: "Ok",
    });
    expect(b).toMatch(/aceite de cortesia/);
    expect(b).toMatch(/não gere material por causa dele/);
  });

  /**
   * LUCILA. A pergunta era "consegue apontar ou mostrar o que quer?" — SEM
   * opções. Ela respondeu "3", e a Ayla casou com uma lista de dois turnos
   * antes, concluindo "ele também não consegue apontar".
   */
  it("R2. Lucila: número sem lista NÃO pode casar com menu anterior", () => {
    const b = blocoDeContinuidade({
      ultimaAyla: "Quando ele não é entendido, consegue apontar ou mostrar o que quer?",
      mensagem: "3",
    });
    expect(b).toMatch(/NÃO ofereceu opções numeradas/);
    expect(b).toMatch(/NÃO case esse número com nenhuma lista de turnos anteriores/);
  });

  /** ⚠️ E quando a lista É da pergunta atual, o número resolve certo. */
  it("R3. Lucila ao contrário: com lista na pergunta, o número é ligado a ela", () => {
    const b = blocoDeContinuidade({
      ultimaAyla:
        "O que ele costuma fazer? 1. pedir ajuda; 2. tentar sozinho; 3. ficar frustrado, chorar ou desistir",
      mensagem: "3",
    });
    expect(b).toMatch(/ficar frustrado, chorar ou desistir/);
    expect(b).toMatch(/não a nenhuma lista anterior/);
  });

  /**
   * SAMARA. Respondeu "Tudo" a uma pergunta sobre desafios da criança e recebeu
   * desescalada de briga e rastreio de violência — herdados de outro dia.
   */
  it("R4. Samara: 'Tudo' responde à pergunta acima, e a nada mais", () => {
    const b = blocoDeContinuidade({
      ultimaAyla: "Qual desafio tá pegando mais agora com a Samara? Sono ruim, dificuldade em alguma rotina?",
      mensagem: "Tudo",
    });
    expect(b).toMatch(/responde à pergunta acima, e a nada mais/);
    expect(b).toMatch(/Não recupere um assunto de outro turno/);
  });

  /**
   * CLAIRE. "Nós 2, lição e rotina" tem conteúdo — não é resposta curta. O
   * bloco não nasce, e o turno segue normal para o GPT.
   */
  it("R5. Claire: resposta COM conteúdo não gera bloco nenhum", () => {
    expect(
      blocoDeContinuidade({
        ultimaAyla: "Isso acontece mais na lição de casa ou na rotina da manhã?",
        mensagem: "Nós 2 , lição e rotina",
      }),
    ).toBe("");
  });

  it("R6. MORDE: no caso comum o bloco é vazio — não custa token à toa", () => {
    for (const m of ["ele grita quando eu falo não", "me ajuda com a hora de dormir"]) {
      expect(blocoDeContinuidade({ ultimaAyla: "Como posso ajudar?", mensagem: m })).toBe("");
    }
  });

  it("R7. perguntaAberta extrai pergunta e opções", () => {
    const r = perguntaAberta("Entendi. O que pesa mais? 1. sono; 2. escola; 3. rotina");
    expect(r.pergunta).toMatch(/O que pesa mais\?/);
    expect(r.opcoes.map((o) => o.numero)).toEqual([1, 2, 3]);
    expect(r.opcoes[1].texto).toBe("escola");
  });
});
