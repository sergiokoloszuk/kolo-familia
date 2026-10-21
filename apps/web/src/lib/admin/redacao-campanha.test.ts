import { describe, expect, it } from "vitest";
import {
  montarPedidoRedacaoCampanha,
  validarSugestaoCampanha,
} from "./redacao-campanha";

describe("redação assistida de campanha", () => {
  it("inclui objetivo, rascunho e ajuste sem decidir pelo Admin", () => {
    const pedido = montarPedidoRedacaoCampanha({
      objetivo: "Convidar para o programa sobre respiração amanhã às 9h30",
      textoAtual: "Venha ouvir o programa.",
      ajuste: "Dê mais respiro ao texto.",
    });
    expect(pedido).toContain("programa sobre respiração");
    expect(pedido).toContain("Venha ouvir o programa.");
    expect(pedido).toContain("Dê mais respiro");
  });

  it("converte títulos e negrito para o formato que será enviado", () => {
    const texto = validarSugestaoCampanha("## Amanhã na rádio\n\nAcompanhe **às 9h30**.", {
      objetivo: "Programa amanhã às 9h30 na rádio",
    });
    expect(texto).toBe("*Amanhã na rádio*\n\nAcompanhe *às 9h30*.");
  });

  it("rejeita link criado pela IA", () => {
    expect(() => validarSugestaoCampanha("Veja nosso programa em https://exemplo.com/novo", {
      objetivo: "Convide para o programa na rádio",
    })).toThrow("link não informado");
  });

  it("permite link que Karina forneceu", () => {
    const url = "https://www.instagram.com/kolo.inclusao/";
    expect(validarSugestaoCampanha(`Acompanhe a Kolo por aqui: ${url}`, {
      objetivo: `Convide para acompanhar a Kolo em ${url}`,
    })).toContain(url);
  });
});
