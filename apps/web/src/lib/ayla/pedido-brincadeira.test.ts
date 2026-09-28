import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BLOCO_PEDIDO_BRINCADEIRA, pedidoExplicitoDeBrincadeira } from "./pedido-brincadeira";

describe("pedido explícito de brincadeira", () => {
  it("reconhece a fala interna da Manu e sinônimos de pedido", () => {
    expect(pedidoExplicitoDeBrincadeira("Quero uma ideia de brincadeira para ajudar a Manu com o mercado.")).toBe(true);
    expect(pedidoExplicitoDeBrincadeira("Pode me sugerir um jogo para fazermos juntos?")).toBe(true);
    expect(pedidoExplicitoDeBrincadeira("Me dê uma atividade lúdica para hoje.")).toBe(true);
  });
  it("não captura relato de brincar, manejo ou pedido de história", () => {
    expect(pedidoExplicitoDeBrincadeira("Ela brincou no mercado ontem.")).toBe(false);
    expect(pedidoExplicitoDeBrincadeira("Como lidar com o barulho no mercado?")).toBe(false);
    expect(pedidoExplicitoDeBrincadeira("Quero uma história sobre um passeio.")).toBe(false);
  });
  it("instrui uma experiência lúdica, sem treino sensorial automático", () => {
    expect(BLOCO_PEDIDO_BRINCADEIRA).toContain("divertida mesmo sem o objetivo");
    expect(BLOCO_PEDIDO_BRINCADEIRA).toContain("TRÊS opções de jogo");
    expect(BLOCO_PEDIDO_BRINCADEIRA).toContain("MECÂNICAS diferentes entre si");
    expect(BLOCO_PEDIDO_BRINCADEIRA).toContain("três blocos com • ou emoji + título curto em negrito");
    expect(BLOCO_PEDIDO_BRINCADEIRA).toContain("as três opções devem poder acontecer ali");
    expect(BLOCO_PEDIDO_BRINCADEIRA).toContain("Em TODAS as três opções");
    expect(BLOCO_PEDIDO_BRINCADEIRA).toContain("nenhum dos três blocos pode ficar sem essa ligação concreta");
    expect(BLOCO_PEDIDO_BRINCADEIRA).toContain("não deve ser o truque repetido nas três opções");
    expect(BLOCO_PEDIDO_BRINCADEIRA).toContain("uma FALA EXATA de abertura do adulto");
    expect(BLOCO_PEDIDO_BRINCADEIRA).toContain("o que o adulto faz em seguida");
    expect(BLOCO_PEDIDO_BRINCADEIRA).toContain("NÃO omita os turnos concretos");
    expect(BLOCO_PEDIDO_BRINCADEIRA).toContain("NÃO reproduza nem simule esse estímulo");
    expect(BLOCO_PEDIDO_BRINCADEIRA).toContain("O objetivo técnico fica por trás");
  });
  it("não gera link nem metadado de história quando o conteúdo não é história", () => {
    const src = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");
    expect(src).toContain("respostaPareceHistoria(exp.texto)");
    expect(src).toContain("const linkHistoriaPromise = historiaEntregue");
    expect(src).toContain("if (resp.enviada && historiaEntregue && entregaHistoria)");
  });
});
