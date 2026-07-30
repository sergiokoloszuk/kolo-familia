import { describe, expect, it } from "vitest";
import { decidirMovimento } from "./prontidao-plano";

/**
 * Estes testes travam as regras que a auditoria de 30/07/2026 quebrou. Cada
 * `it` aqui é um jeito real de a conversa terminar sem entrega — se algum
 * deles voltar a passar "conversar", a feature regrediu de novo.
 */

const base = {
  score: 0,
  tema: "associar causa e efeito no dia a dia",
  pergunta: "é mais sequência, causa e efeito, ou relacionar figuras?",
  faltando: ["tipo de associação"],
  pedidoExplicito: false,
  emLoop: false,
};

describe("decidirMovimento", () => {
  it("entrega quando a rubrica fecha o corte", () => {
    const d = decidirMovimento({ ...base, score: 6 });
    expect(d.acao).toBe("gerar");
  });

  it("o caso da Manu: pedido sem a palavra 'plano' nunca vira só conversa", () => {
    // "Ela não está ligando pontos e queria exercitar isso com ela."
    // habilidade (2) + objetivo (2) = 4: não fecha o corte, mas é pedido.
    const d = decidirMovimento({ ...base, score: 4, pedidoExplicito: true });
    expect(d.acao).toBe("perguntar");
    expect(d.pergunta).toBeTruthy();
  });

  it("pedido explícito com material completo entrega na hora", () => {
    const d = decidirMovimento({ ...base, score: 5, pedidoExplicito: true });
    expect(d.acao).toBe("gerar");
  });

  it("fechador: duas respostas seguidas terminando em pergunta forçam a entrega", () => {
    const d = decidirMovimento({ ...base, score: 3, emLoop: true });
    expect(d.acao).toBe("gerar");
    expect(d.fechador).toBe(true);
  });

  it("o fechador não inventa entrega quando não há material nenhum", () => {
    const d = decidirMovimento({ ...base, score: 1, emLoop: true });
    expect(d.acao).toBe("conversar");
  });

  it("sem tema não entrega — plano sem foco é o genérico que não queremos", () => {
    const d = decidirMovimento({ ...base, score: 8, tema: null, pedidoExplicito: true });
    expect(d.acao).toBe("conversar");
  });

  it("desabafo sem pedido segue conversa", () => {
    const d = decidirMovimento({ ...base, score: 2 });
    expect(d.acao).toBe("conversar");
  });
});
