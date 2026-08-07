import { describe, it, expect } from "vitest";
import { dataBrParaIso, dataIsoParaBr, idadeAnos } from "./idade";

/**
 * A CADEIA DA DATA DE NASCIMENTO — 06/08/2026.
 *
 * Nasceu do caso Ezequiel: a mãe informou 26/04/2019 e o banco tinha
 * 2002-04-26 — dia e mês CERTOS, ano errado. A criança de 7 anos aparecia
 * como adulto de 24, e a Ayla passou 11 mensagens discutindo a idade com a
 * família em vez de ajudar.
 *
 * ⚠️ CAUSA NÃO REPRODUZIDA. Estes testes percorrem a cadeia de conversão
 * inteira e ela está CORRETA — não existe caminho aqui que transforme 2019 em
 * 2002. Duas hipóteses foram levantadas e as duas caíram:
 *
 *   1. "a data da mãe vazou pro filho" — testado contra as 89 famílias que têm
 *      `data_nascimento_mae` preenchida: ZERO colisões, e a data da própria
 *      Vitória é 2005-08-06, que não daria 24 anos.
 *   2. "transformação de formato inverteu algo" — `dataBrParaIso` valida o
 *      round-trip (mês e dia têm que voltar iguais), então uma inversão seria
 *      rejeitada, não silenciosamente aceita.
 *
 * O que sobra, sem prova: o valor entrou como "26/04/2002" já no input. A
 * varredura reforça — 1 registro em 2002 entre 91, sem cluster.
 *
 * Estes testes não descobrem a causa. Eles garantem que o CAMINHO NORMAL não
 * pode produzi-la, e é isso que impede a regressão silenciosa.
 */

describe("o caso real — 26/04/2019", () => {
  it("persiste exatamente como 2019-04-26", () => {
    expect(dataBrParaIso("26/04/2019")).toBe("2019-04-26");
  });

  it("2019 NUNCA vira 2002", () => {
    expect(dataBrParaIso("26/04/2019")).not.toContain("2002");
  });

  it("a idade derivada é 7, não 6 nem 24", () => {
    // O modelo disse "6 anos" nesta mesma conversa. Idade é conta de código —
    // e `idadeAnos` usa a data de hoje, então o teste vale até 26/04/2027.
    expect(idadeAnos("2019-04-26")).toBe(7);
  });

  it("a conta não depende de eu saber que dia é hoje", () => {
    // Uma data exatamente 7 anos atrás tem que dar 7, rode quando rodar.
    const h = new Date();
    const iso = new Date(h.getFullYear() - 7, h.getMonth(), h.getDate())
      .toISOString()
      .slice(0, 10);
    expect(idadeAnos(iso)).toBe(7);
  });

  it("ida e volta não perde nada", () => {
    expect(dataIsoParaBr(dataBrParaIso("26/04/2019")!)).toBe("26/04/2019");
  });
});

describe("datas de borda", () => {
  const casos: Array<[string, string | null]> = [
    ["01/01/2020", "2020-01-01"],
    ["31/12/2018", "2018-12-31"],
    ["29/02/2020", "2020-02-29"], // bissexto real
    ["29/02/2019", null], // não bissexto — tem que ser rejeitado
    ["31/04/2019", null], // abril não tem 31
    ["00/04/2019", null],
    ["26/13/2019", null],
  ];
  for (const [br, iso] of casos) {
    it(`${br} → ${iso ?? "rejeitado"}`, () => expect(dataBrParaIso(br)).toBe(iso));
  }
});

describe("formatos que NÃO podem passar silenciosamente", () => {
  // Ano de 2 dígitos é a via clássica pra um século errado. Aqui é rejeitado,
  // e é isso que impede "26/04/02" de virar 2002 sem ninguém perceber.
  const invalidos = ["26/04/02", "26/04/19", "2019-04-26", "26-04-2019", "26/4/2019", "", "  ", "abc"];
  for (const v of invalidos) {
    it(`rejeita ${JSON.stringify(v)}`, () => expect(dataBrParaIso(v)).toBeNull());
  }
});

describe("timezone não pode deslocar o dia", () => {
  it("a conversão ancora ao meio-dia local, não em UTC", () => {
    // Um `new Date("2019-04-26")` puro é UTC e, a oeste de Greenwich, volta
    // como dia 25. A cadeia precisa preservar o 26.
    for (const d of ["01/01/2020", "31/12/2018", "26/04/2019"]) {
      expect(dataIsoParaBr(dataBrParaIso(d)!)).toBe(d);
    }
  });

  /**
   * ACHADO MENOR, registrado e NÃO corrigido.
   *
   * `idadeAnos` recebe só a data de nascimento e usa o "hoje" do sistema — não
   * dá pra injetar uma data de referência. Isso torna a virada do aniversário
   * impossível de testar de forma determinística, e foi o typecheck que expôs:
   * o vitest apaga os tipos e deixou passar uma chamada com 2 argumentos que
   * o TypeScript rejeita.
   *
   * Fica como dívida: uma função de idade testável precisaria aceitar o
   * "agora" como parâmetro opcional. Não mexi porque ela é usada em prompt,
   * plano, rotina e relatório, e trocar a assinatura sem rodar todos esses
   * caminhos é trocar um problema pequeno por um risco desconhecido.
   */
});
