import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BLOCO_PEDIDO_BRINCADEIRA, auditarBrincadeiras, blocoMecanicasBrincadeira, pedidoExplicitoDeBrincadeira } from "./pedido-brincadeira";

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
    expect(BLOCO_PEDIDO_BRINCADEIRA).toContain("divertido mesmo sem meta");
    expect(BLOCO_PEDIDO_BRINCADEIRA).toContain("exatamente UMA mecânica");
    expect(BLOCO_PEDIDO_BRINCADEIRA).toMatch(/não opções para\s+mostrar/);
    expect(BLOCO_PEDIDO_BRINCADEIRA).toMatch(/uma\s+FALA EXATA para começar/);
    expect(BLOCO_PEDIDO_BRINCADEIRA).toMatch(/como começa a próxima\s+rodada/);
    expect(BLOCO_PEDIDO_BRINCADEIRA).toContain("Não reproduza sensibilidade registrada");
    expect(BLOCO_PEDIDO_BRINCADEIRA).toMatch(/O objetivo técnico fica por\s+trás/);
    expect(BLOCO_PEDIDO_BRINCADEIRA).not.toContain("TRÊS opções de jogo");
  });
  it("seleciona mecânicas distintas no mercado sem trocar Perfil e BPs por roteiro fixo", () => {
    const bloco = blocoMecanicasBrincadeira("Quero brincar com ela no mercado");
    expect(bloco).toContain("durante a ida ao mercado");
    expect(bloco).toContain("Mímica com personagem");
    expect(bloco).toContain("apelido absurdo e seguro");
    expect(bloco).toContain("Nunca finja que algo não comestível é comida");
    expect(bloco).toContain("História de superpoder impossível");
    expect(bloco).toContain("As BPs e o Perfil têm precedência");
    expect(bloco).not.toContain("exposição a sons altos");
  });
  it("não força cenário de mercado em outros pedidos", () => {
    expect(blocoMecanicasBrincadeira("Quero uma brincadeira em casa")).toContain("Transformação ou construção conjunta");
  });
  it("detecta virada genérica sem inspecionar conteúdo pessoal", () => {
    const texto = "• **Poder impossível**\nVocê: 'Qual poder?'\nEla: aponta.\nEntão: conte uma consequência engraçada. Na próxima rodada, ela escolhe outro poder.";
    expect(auditarBrincadeiras(texto)).toEqual({ quantidade: 1, falhas: [{ opcao: 1, codigo: "virada_generica" }] });
  });
  it("aceita uma opção com turnos e consequência específica", () => {
    const texto = "🦖 **Dinossauro de mãos**\nVocê: 'Ele sobe ou se esconde?'\nEla: aponta.\nEntão: esconda-o atrás da mão e faça uma careta. Depois ela comanda a próxima vez.";
    expect(auditarBrincadeiras(texto)).toEqual({ quantidade: 1, falhas: [] });
  });
  it("não reprova fala natural em linha corrida nem título com um asterisco", () => {
    const texto = "🎧 *Crítica musical*\nEscolha uma música. Você: “Que mistério ela guarda?” Ela pode dar uma pista. Então: invente uma acusação engraçada: “Os aliens roubaram o refrão!” Na rodada seguinte, ela apresenta o programa.";
    expect(auditarBrincadeiras(texto)).toEqual({ quantidade: 1, falhas: [] });
  });
  it("detecta uma virada vaga mesmo com turnos e segunda rodada", () => {
    const texto = "• **Dinossauro**\nVocê: “O que ele faz?”\nEla: aponta.\nEntão: encene a escolha dela de modo engraçado. Depois ela escolhe de novo.";
    expect(auditarBrincadeiras(texto)).toEqual({ quantidade: 1, falhas: [{ opcao: 1, codigo: "virada_generica" }] });
  });
  it("não gera link nem metadado de história quando o conteúdo não é história", () => {
    const src = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");
    expect(src).toContain("respostaPareceHistoria(exp.texto)");
    expect(src).toContain("const linkHistoriaPromise = historiaEntregue");
    expect(src).toContain("if (resp.enviada && historiaEntregue && entregaHistoria)");
  });
});
