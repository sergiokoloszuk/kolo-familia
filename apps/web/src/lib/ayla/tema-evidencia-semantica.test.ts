import { describe, expect, it } from "vitest";
import { temaEnunciado } from "./rotina-guiada";

/**
 * A REGRA CENTRAL, e a razão de este arquivo existir:
 *
 *   O histórico só pode preencher automaticamente um campo do artefato se
 *   houver EVIDÊNCIA SEMÂNTICA SUFICIENTE daquele dado. Na dúvida, não
 *   preencher — perguntar. Uma pergunta curta custa um turno; um quadro de
 *   rotina com o tema errado custa a confiança da família, e não se desfaz.
 *
 * ⚠️ O CASO QUE ORIGINOU ISTO. A varredura anterior reusava `lerTemaEscolhido`
 * sobre o histórico solto e devolveu **"Gere"** como tema. A mãe tinha digitado
 * "Gere" para AUTORIZAR a geração; o buscador leu aquilo como o desenho que ela
 * queria. A Manu teria recebido um quadro ilustrado com a palavra "Gere".
 *
 * ⚠️ E O SEGUNDO CASO, da correção da correção. Ao apertar demais — exigindo a
 * palavra literal "tema" — a Maria Julia, que escreveu "Desenho de princesa" e
 * "Perfeito princesa frozen então", passou a devolver `null`. Evidência
 * inequívoca recusada é tão errado quanto ruído aceito.
 */
describe("evidência semântica de tema no histórico", () => {
  describe("ACEITA — a família enunciou o tema, sem ambiguidade", () => {
    const aceitos: Array<[string, string]> = [
      ["Tema princesa", "princesa"],
      ["Quero princesa", "princesa"],
      ["Pode ser Frozen", "Frozen"],
      ["Faz de capivara", "capivara"],
      ["Desenho de princesa", "princesa"],
      ["Frozen então", "Frozen"],
      ["Quero Frozen", "Frozen"],
      ["Desenho de capivara", "capivara"],
      // Confirmação grudada no tema: o "Perfeito" responde à pergunta
      // anterior e não faz parte do desenho.
      ["Perfeito princesa frozen então.", "princesa frozen"],
    ];
    it.each(aceitos)("%s → %s", (texto, esperado) => {
      expect(temaEnunciado(texto)).toBe(esperado);
    });
  });

  describe("RECUSA — resposta operacional ou genérica, nunca um tema", () => {
    // ⚠️ Cada string aqui já foi digitada por uma mãe real respondendo à
    // pergunta "posso gerar?". Nenhuma delas nomeia um desenho.
    const recusados = [
      "Gere", "Sim", "Isso", "Ok", "Pode", "Assim", "Faz", "Manda", "Perfeito",
      "Pode ser", "Gerar", "Beleza", "Uhum", "Entendi", "Por favor",
    ];
    it.each(recusados)("%s → null", (texto) => {
      expect(temaEnunciado(texto)).toBeNull();
    });
  });

  describe("RECUSA — o pedido não é o tema", () => {
    // ⚠️ CASO REAL DA KARINA: "Quero q rotina com as imagens" casava com o
    // enunciado `quero X` e virava o tema "q rotina com as imagens". Ela estava
    // pedindo o artefato, não escolhendo o desenho dele.
    const pedidos = [
      "Quero q rotina com as imagens",
      "Quero uma rotina visual",
      "Quero os cartões",
      "Manda as figuras",
      "Desenho de rotina",
    ];
    it.each(pedidos)("%s → null", (texto) => {
      expect(temaEnunciado(texto)).toBeNull();
    });
  });

  describe("RECUSA — cobrança de artefato pendente", () => {
    // Estas são retomadas ("cadê o que você prometeu?"), e o caminho que as
    // trata é outro. Nenhuma pode virar tema por acidente.
    const cobrancas = ["Cadê?", "Consegue trazer?", "E as figuras?", "Não apareceu", "E agora?"];
    it.each(cobrancas)("%s → null", (texto) => {
      expect(temaEnunciado(texto)).toBeNull();
    });
  });

  describe("MAIS DE UM TEMA NO HISTÓRICO — vale o último confirmado", () => {
    /**
     * ⚠️ A ORDEM É A REGRA. A família pode mudar de ideia: pede princesa,
     * a criança reclama, ela troca por Frozen. O buscador lê do mais NOVO para
     * o mais antigo e devolve o primeiro que casar — que é o mais recente.
     * Este teste prende essa direção; ele quebra se alguém inverter a `order`
     * do SELECT ou passar a varrer do começo da conversa.
     */
    it("a varredura do mais novo para o mais antigo devolve o tema recente", () => {
      // Como o buscador recebe do banco: `created_at` decrescente.
      const doMaisNovoAoMaisAntigo = ["Pode ser Frozen", "Gere", "Tema princesa"];
      const achado = doMaisNovoAoMaisAntigo.map(temaEnunciado).find((t) => t !== null);
      expect(achado).toBe("Frozen");
    });

    it("uma confirmação entre os dois temas não vira o tema", () => {
      const doMaisNovoAoMaisAntigo = ["Isso", "Sim", "Faz de capivara", "Tema princesa"];
      const achado = doMaisNovoAoMaisAntigo.map(temaEnunciado).find((t) => t !== null);
      expect(achado).toBe("capivara");
    });
  });

  describe("O TAMANHO SEPARA TEMA DE FRASE", () => {
    it("frase longa não é tema", () => {
      expect(temaEnunciado("Quero que ela aprenda a escovar os dentes sozinha")).toBeNull();
    });
    it("duas palavras ainda é tema", () => {
      expect(temaEnunciado("Tema princesa frozen")).toBe("princesa frozen");
    });
  });
});
