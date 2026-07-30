import { describe, it, expect } from "vitest";
import { PERGUNTA_DE_PRECO } from "./responder";

/**
 * O gatilho de preço tem que ser certeiro nos dois sentidos: se falha, a mãe
 * fica sem resposta (foi o caso do Pietro, 29/07 — perguntou o valor e a Ayla
 * mandou pra um "suporte" inexistente); se dispara à toa, a Ayla joga link de
 * preço no meio de uma conversa sobre a criança.
 */
describe("PERGUNTA_DE_PRECO", () => {
  const pega = [
    "Qual valor?", // o caso real
    "qual o valor",
    "Quanto custa?",
    "quanto fica por mês",
    "tem desconto?",
    "não consigo nenhum cupom de desconto pra assinar?",
    "como faço pra assinar",
    "qual o preço do app",
    "isso é grátis?",
    "vou ter que pagar depois?",
    "quero saber os valores do plano",
    "a mensalidade é quanto",
    "quando começa a cobrança?",
  ];
  for (const t of pega) {
    it(`pega: "${t}"`, () => expect(PERGUNTA_DE_PRECO.test(t)).toBe(true));
  }

  const ignora = [
    // vocabulário normal da Kolo — nenhum destes é sobre dinheiro
    "ele adora os cartões da rotina",
    "posso imprimir o cartão do banho?",
    "ela não enxerga o valor dela como mãe",
    "isso não tem valor nenhum pra ele",
    "vale a pena insistir na fono?",
    "o quanto ele se esforça pra falar",
    "quanto tempo antes eu aviso ele?",
    "o plano que você montou ajudou demais",
    "quero um plano sobre o sono",
  ];
  for (const t of ignora) {
    it(`ignora: "${t}"`, () => expect(PERGUNTA_DE_PRECO.test(t)).toBe(false));
  }
});
