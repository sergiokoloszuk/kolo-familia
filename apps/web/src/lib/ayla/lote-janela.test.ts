import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { BancoMemoria } from "./__harness/banco-memoria";
import { aguardarTurnoDaMae } from "./lote-inbound";

/**
 * A JANELA DO LOTE — exercitada com RELÓGIO DE VERDADE.
 *
 * ⚠️ POR QUE NÃO É TESTE DE STRING. Todos os outros arquivos MOCKAM
 * `aguardarTurnoDaMae` inteiro, porque ela dorme de propósito e ninguém quer
 * pagar isso em cada suíte. O efeito colateral é que a janela — o maior
 * componente isolado da latência do WhatsApp — nunca foi exercitada por
 * ninguém. Este arquivo é o único lugar onde ela roda.
 *
 * Os tempos são medidos de verdade, então há folga nas asserções: o que se
 * prova é a ORDEM DE GRANDEZA (3s, não 7s), não o milissegundo.
 */

const FONTE = readFileSync(path.join(__dirname, "lote-inbound.ts"), "utf8");

/** Um banco em memória com a tabela que o lote lê e claima. */
function bancoCom(mensagens: Array<{ id: string; texto: string; criadaEm: Date }>) {
  const db = new BancoMemoria();
  db.semear(
    "ayla_messages",
    mensagens.map((m) => ({
      id: m.id,
      family_account_id: "fam-1",
      direcao: "inbound",
      texto: m.texto,
      created_at: m.criadaEm.toISOString(),
      processada_em: null,
    })),
  );
  return db;
}

describe("a janela do lote — o valor e o efeito", () => {
  /**
   * ⚠️ ESTE TESTE EXISTE PARA IMPEDIR QUE O NÚMERO VOLTE SEM DADO. A janela
   * custa segundos a 100% dos turnos do WhatsApp; subir de novo é uma decisão
   * de produto, não um ajuste. Se alguém mudar, que mude conscientemente e
   * troque este teste junto — com a medição na mão.
   */
  it("a janela é de 3 segundos, e o dado que a sustenta está escrito ao lado", () => {
    expect(FONTE).toMatch(/const JANELA_SILENCIO_MS = 3000;/);
    expect(FONTE, "sumiu a origem do número — vira intuição de novo").toMatch(
      /86,3% dos turnos têm UM balão/,
    );
    expect(FONTE, "sumiu o achado da mediana de 11,2s").toMatch(/11,2 SEGUNDOS/);
    expect(FONTE, "voltou a janela antiga").not.toMatch(/JANELA_SILENCIO_MS = 7000/);
  });

  it("MEDIDO: uma mensagem sozinha espera ~3s, não ~7s", async () => {
    const db = bancoCom([{ id: "m1", texto: "ele não quer ir", criadaEm: new Date() }]);
    const t0 = Date.now();
    const r = await aguardarTurnoDaMae(db.cliente(), {
      familyId: "fam-1",
      textoAtual: "ele não quer ir",
    });
    const ms = Date.now() - t0;
    // Guarda anti-teste-vazio: se a função sair por um caminho de erro, o
    // tempo seria ~0 e o teste passaria dizendo nada.
    expect(r, "o lote não devolveu turno — o teste mediria o caminho de erro").not.toBeNull();
    expect(ms, `esperou ${ms}ms — a janela antiga era 7000`).toBeLessThan(5_000);
    expect(ms, `esperou ${ms}ms — não esperou nada, a janela sumiu`).toBeGreaterThan(2_500);
  }, 20_000);

  /**
   * O comportamento que a janela existe para produzir: dois balões dentro do
   * silêncio viram UM texto. Se isto quebrar, a mãe passa a receber duas
   * respostas para uma frase partida ao meio.
   */
  it("PROVEI: dois balões dentro de 3s continuam sendo agrupados", async () => {
    const agora = new Date();
    const db = bancoCom([
      { id: "m1", texto: "Tem dificuldade de Tomar", criadaEm: new Date(agora.getTime() - 1500) },
      { id: "m2", texto: "De engolir", criadaEm: agora },
    ]);
    const r = await aguardarTurnoDaMae(db.cliente(), {
      familyId: "fam-1",
      textoAtual: "De engolir",
    });
    expect(r).not.toBeNull();
    expect(r!.texto, "os dois balões não foram juntados").toContain("Tem dificuldade de Tomar");
    expect(r!.texto).toContain("De engolir");
  }, 20_000);

  /**
   * ⚠️ NENHUMA MENSAGEM PODE SUMIR. Este é o risco real de mexer na janela: um
   * balão que chega e não entra em lote nenhum, nem gera turno próprio.
   */
  it("PROVEI: nada se perde — as duas mensagens saem claimadas", async () => {
    const agora = new Date();
    const db = bancoCom([
      { id: "m1", texto: "primeira", criadaEm: new Date(agora.getTime() - 1000) },
      { id: "m2", texto: "segunda", criadaEm: agora },
    ]);
    const r = await aguardarTurnoDaMae(db.cliente(), { familyId: "fam-1", textoAtual: "segunda" });
    expect(r).not.toBeNull();
    expect(r!.quantidade, "alguma mensagem ficou fora do lote").toBe(2);
    expect(r!.texto).toContain("primeira");
    expect(r!.texto).toContain("segunda");
  }, 20_000);

  /**
   * A mensagem que chega DEPOIS da janela não pertence a este turno. Com 3s,
   * isso passa a acontecer mais — é o custo medido e aceito (1,96% dos turnos).
   * O que NÃO pode acontecer é ela ser engolida: ela tem que sobrar para o
   * turno seguinte, e é isso que este teste guarda.
   */
  it("PROVEI: mensagem fora da janela NÃO entra neste lote — sobra para o próximo turno", async () => {
    const agora = new Date();
    const db = bancoCom([
      { id: "m1", texto: "antiga, ja respondida", criadaEm: new Date(agora.getTime() - 20 * 60_000) },
      { id: "m2", texto: "a de agora", criadaEm: agora },
    ]);
    const r = await aguardarTurnoDaMae(db.cliente(), { familyId: "fam-1", textoAtual: "a de agora" });
    expect(r).not.toBeNull();
    // 20 minutos atrás está fora da janela de lote (15 min) — não entra.
    expect(r!.texto, "engoliu uma mensagem de 20 minutos atrás").not.toContain("antiga");
  }, 20_000);
});
