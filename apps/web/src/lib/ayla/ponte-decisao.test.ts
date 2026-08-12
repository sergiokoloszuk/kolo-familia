import { beforeEach, describe, expect, it, vi } from "vitest";
import { BancoMemoria } from "./__harness/banco-memoria";
import type { DecisaoDePlano } from "./plano-decisao";

/**
 * OS DOIS FREIOS SÃO MESMO INDEPENDENTES?
 *
 * ⚠️ POR QUE ESTE ARQUIVO EXISTE. Hoje `pularSuficiencia` e `pularDedup` valem
 * SEMPRE a mesma coisa — a separação é conceitual, e nenhum teste que passe
 * pelo fluxo normal consegue distinguir um do outro. Uma sabotagem trocando um
 * pelo outro na ponte passava VERDE, e passaria mesmo que a separação fosse
 * puro teatro de nomes.
 *
 * A única prova possível é entregar à ponte uma decisão em que os dois DIFEREM
 * — algo que a próxima fatia vai produzir de verdade — e verificar que cada
 * chave governa o seu freio. Se um dia alguém reatar os dois, isto fica
 * vermelho.
 */

let prontidaoChamada = 0;
let geracoes = 0;

vi.mock("./prontidao-plano", () => ({
  avaliarProntidaoParaPlano: async () => {
    prontidaoChamada++;
    return { pronto: false, tema: null, motivo: "cenário" };
  },
  CRITERIO_SUFICIENCIA: "",
}));

vi.mock("@/lib/ia/plano", async (real) => ({
  ...(await real<Record<string, unknown>>()),
  gerarPlano: async () => {
    geracoes++;
    return { id: "p1", titulo: "T", secoes: [] };
  },
}));

vi.mock("./whatsappSender", () => ({
  enviarTexto: async () => ({ ok: true, messageId: "x" }),
  enviarDocumento: async () => ({ ok: true, messageId: "d" }),
}));

const { montarPonteWhatsApp } = await import("./ponte");

const FAM = "fam-1";

/** Uma família com conversa longa e um plano entregue há pouco (dedup ativo). */
function mundo() {
  const db = new BancoMemoria();
  db.semear("family_accounts", [{ id: FAM, whatsapp_e164: "+5541999990001" }]);
  // 10 mensagens da mãe: o freio de profundidade não barra.
  for (let i = 0; i < 10; i++) {
    db.semear("ayla_messages", [{ family_account_id: FAM, direcao: "inbound", texto: `fala ${i}` }]);
  }
  // Um plano entregue há 2h — dentro da janela de dedup de 20h.
  db.semear("ayla_messages", [
    {
      family_account_id: FAM,
      direcao: "outbound",
      texto: "Montei um plano: https://x/auth/wa?t=1",
      enviada_em: new Date(Date.now() - 2 * 3600_000).toISOString(),
    },
  ]);
  return db;
}

const chamar = (db: BancoMemoria, decisao: DecisaoDePlano) =>
  montarPonteWhatsApp(db.cliente(), {
    familyId: FAM,
    membroAtipicoId: "m1",
    mensagem: "ele não quer sair do tablet pra tomar banho, todo dia vira crise",
    temDesafio: true,
    phoneE164: "+5541999990001",
    decisao,
  });

const decisao = (p: Partial<DecisaoDePlano>): DecisaoDePlano => ({
  ato: "criar",
  autoridadeParaCriar: true,
  pularSuficiencia: false,
  pularDedup: false,
  ...p,
});

beforeEach(() => {
  prontidaoChamada = 0;
  geracoes = 0;
});

describe("cada chave governa o SEU freio", () => {
  it("MORDE: pularDedup sozinho fura o dedup e AINDA avalia suficiência", async () => {
    const r = await chamar(mundo(), decisao({ pularDedup: true, pularSuficiencia: false }));
    // Passou do dedup (senão nem chegaria na prontidão)…
    expect(prontidaoChamada, "o dedup barrou apesar de pularDedup").toBe(1);
    // …e a suficiência barrou, porque ela NÃO foi pulada.
    expect(r, "gerou plano com a suficiência dizendo não").toBeNull();
    expect(geracoes).toBe(0);
  });

  it("MORDE: pularSuficiencia sozinho NÃO fura o dedup", async () => {
    const r = await chamar(mundo(), decisao({ pularDedup: false, pularSuficiencia: true }));
    // O dedup barra primeiro; a prontidão nem chega a ser consultada.
    expect(r, "furou o dedup com pularSuficiencia").toBeNull();
    expect(prontidaoChamada, "chegou na suficiência apesar do dedup ter barrado").toBe(0);
    expect(geracoes).toBe(0);
  });

  it("os dois ligados: gera (é o comportamento de hoje no pedido explícito)", async () => {
    await chamar(mundo(), decisao({ pularDedup: true, pularSuficiencia: true }));
    expect(prontidaoChamada, "avaliou suficiência num pedido explícito").toBe(0);
    expect(geracoes, "não gerou com autoridade e os dois freios pulados").toBe(1);
  });
});
