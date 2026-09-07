/**
 * CONTINUIDADE DA ROTINA — os três defeitos do caso Manu, 07/09/2026.
 *
 * Os três primeiros casos foram escritos pelo Codex em 07/09 e reproduziam o
 * defeito em VERMELHO antes de qualquer correção (`baseline-defeito.log`:
 * 3 falhas de 7). Ficam como estão, de propósito: teste que nasceu vermelho e
 * ninguém reescreveu é a prova de que a correção mudou o comportamento, e não a
 * régua. Os demais foram acrescentados junto com a correção.
 *
 * O caso real: a mãe pediu "Brincadeira, Banho, Almoço, Shopping. Monta a
 * rotina visual". A Ayla montou, ofereceu o tema, ela respondeu "Pode ser" —
 * e a rotina ficou em `aguardando` até o dia seguinte, sem cartões, enquanto a
 * família recebia um Plano no lugar.
 */
import { describe, expect, it } from "vitest";
import { BancoMemoria } from "./__harness/banco-memoria";
import {
  rotinaConversaPendente,
  lerTemaEscolhido,
  ehAceitePuro,
  transicaoPertenceAoPedido,
} from "./rotina-guiada";

describe("continuidade da rotina após a família responder", () => {
  it("não perde a ação depois do primeiro inbound da rajada", async () => {
    const db = new BancoMemoria();
    db.semear("ayla_messages", [
      { family_account_id: "f", membro_atipico_id: "m", direcao: "outbound", tipo: "rotina_conversa", created_at: "2026-09-07T12:55:10Z" },
      { family_account_id: "f", direcao: "inbound", texto: "Pode ser", created_at: "2026-09-07T12:55:34Z" },
      { family_account_id: "f", direcao: "inbound", texto: "Nao tem barco", created_at: "2026-09-07T12:55:35Z" },
    ]);
    expect(await rotinaConversaPendente(db.cliente(), "f", new Date("2026-09-07T12:55:40Z"))).toMatchObject({ membroId: "m" });
  });
  it("uma conclusão posterior fecha a ação anterior", async () => {
    const db = new BancoMemoria();
    db.semear("ayla_messages", [
      { family_account_id: "f", direcao: "outbound", tipo: "rotina_conversa", created_at: "2026-09-07T12:55:10Z" },
      { family_account_id: "f", direcao: "outbound", tipo: "rotina_pronta", created_at: "2026-09-07T12:56:10Z" },
    ]);
    expect(await rotinaConversaPendente(db.cliente(), "f", new Date("2026-09-07T12:57:00Z"))).toBeNull();
  });
  for (const texto of ["sim", "pode", "pode ser", "isso", "ok"]) {
    it(`${texto} isolado não é tema`, () => expect(lerTemaEscolhido(texto)).toBeNull());
  }
});

describe("a fala da Ayla é quem encerra a ação", () => {
  it("uma resposta comum depois da rotina fecha a ação — é o fim legítimo", async () => {
    const db = new BancoMemoria();
    db.semear("ayla_messages", [
      { family_account_id: "f", direcao: "outbound", tipo: "rotina_conversa", created_at: "2026-09-07T12:55:10Z" },
      { family_account_id: "f", direcao: "inbound", texto: "Ok", created_at: "2026-09-07T12:56:07Z" },
      { family_account_id: "f", direcao: "outbound", tipo: "resposta_registro", created_at: "2026-09-07T12:56:25Z" },
    ]);
    expect(await rotinaConversaPendente(db.cliente(), "f", new Date("2026-09-07T12:57:00Z"))).toBeNull();
  });

  it("a proposta também mantém a ação aberta", async () => {
    const db = new BancoMemoria();
    db.semear("ayla_messages", [
      { family_account_id: "f", membro_atipico_id: "m", direcao: "outbound", tipo: "rotina_proposta", created_at: "2026-09-07T12:55:10Z" },
      { family_account_id: "f", direcao: "inbound", texto: "isso", created_at: "2026-09-07T12:55:30Z" },
    ]);
    expect(await rotinaConversaPendente(db.cliente(), "f", new Date("2026-09-07T12:56:00Z"))).toMatchObject({ membroId: "m" });
  });

  it("sem fala nenhuma da Ayla não há ação aberta", async () => {
    const db = new BancoMemoria();
    db.semear("ayla_messages", []);
    expect(await rotinaConversaPendente(db.cliente(), "f", new Date("2026-09-07T12:56:00Z"))).toBeNull();
  });
});

describe("memória não vira etapa do dia — o caso do barco", () => {
  const PEDIDO = "E hoje teremos Brincadeira Banho Almoco Shopping Monta a rotina visual";

  it("transição de julho NÃO entra num pedido que não a menciona", () => {
    expect(transicaoPertenceAoPedido("passeio de barco", PEDIDO)).toBe(false);
  });

  it("as outras transições guardadas da Manu também ficam de fora", () => {
    for (const m of ["arrumação do quarto", "volta da casa da vovó para casa"]) {
      expect(transicaoPertenceAoPedido(m, PEDIDO), m).toBe(false);
    }
  });

  // ⚠️ O CASO I DO §12: medir também o que NÃO pode ser bloqueado. Correção que
  // suprime demais é a mais comum, e aqui ela custaria o acervo inteiro.
  it("transição que a família MENCIONOU continua valendo", () => {
    expect(transicaoPertenceAoPedido("hora do banho", PEDIDO)).toBe(true);
    expect(transicaoPertenceAoPedido("ida ao shopping", PEDIDO)).toBe(true);
    expect(transicaoPertenceAoPedido("passeio de barco", "amanha temos passeio de barco")).toBe(true);
  });

  it("acento e caixa não separam o que é a mesma palavra", () => {
    expect(transicaoPertenceAoPedido("ALMOÇO em família", "vamos ter almoco hoje")).toBe(true);
  });

  it("no escuro, não compõe: sem fala ou sem termo distintivo devolve false", () => {
    expect(transicaoPertenceAoPedido("passeio de barco", "")).toBe(false);
    expect(transicaoPertenceAoPedido("", PEDIDO)).toBe(false);
    expect(transicaoPertenceAoPedido("a hora do dia", PEDIDO)).toBe(false);
  });
});

describe("aceite curto continua não sendo tema, mas passa a ser aceite", () => {
  it("as formas de aceite que apareceram no caso real são reconhecidas", () => {
    for (const t of ["pode", "Pode ser", "ok", "sim", "isso", "pode mandar"]) {
      expect(ehAceitePuro(t), t).toBe(true);
    }
  });

  it("e um tema de verdade não é confundido com aceite", () => {
    for (const t of ["dinossauros", "contos e princesas", "carros"]) {
      expect(ehAceitePuro(t), t).toBe(false);
    }
    expect(lerTemaEscolhido("dinossauros")).toBe("dinossauros");
  });
});
