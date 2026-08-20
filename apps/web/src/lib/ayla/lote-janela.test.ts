import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { BancoMemoria } from "./__harness/banco-memoria";
import { aguardarTurnoDaMae } from "./lote-inbound";

/**
 * A JANELA DO LOTE — exercitada com RELÓGIO, não com string.
 *
 * ⚠️ POR QUE ESTE ARQUIVO É ESPECIAL. Todos os outros testes MOCKAM
 * `aguardarTurnoDaMae` inteiro, porque ela dorme de propósito e ninguém quer
 * pagar isso em cada suíte. O efeito colateral é que a janela — o maior
 * componente isolado da latência do WhatsApp — só roda aqui.
 *
 * ⚠️ RELÓGIO FALSO NA MAIORIA. Com a janela em 10s, exercitar tudo no relógio
 * real custaria mais de um minuto de suíte. O tempo falso prova o
 * COMPORTAMENTO (quem agrupa com quem, quem cede a vez); um único teste de
 * relógio real prova que a espera existe de verdade e tem a ordem de grandeza
 * certa. Os dois são necessários: só o falso não pegaria a janela sumindo.
 */

const FONTE = readFileSync(path.join(__dirname, "lote-inbound.ts"), "utf8");

const BASE = new Date("2026-08-19T20:25:00.000Z");

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

/**
 * Roda o lote com o relógio parado em `agora` e deixa a janela passar.
 *
 * `avancarMs` maior que a janela é de propósito: dá folga para os `await` do
 * banco duplo resolverem depois do timer. Menor que a janela seria um teste
 * que mede o caminho de erro.
 */
async function comRelogioFalso<T>(
  agora: Date,
  fn: () => Promise<T>,
  avancarMs = 15_000,
): Promise<T> {
  vi.useFakeTimers();
  vi.setSystemTime(agora);
  const p = fn();
  await vi.advanceTimersByTimeAsync(avancarMs);
  return p;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("a janela do lote — o valor e a evidência ao lado dele", () => {
  /**
   * ⚠️ ESTE TESTE EXISTE PARA IMPEDIR QUE O NÚMERO VOLTE SEM DADO. A janela
   * custa segundos a 100% dos turnos do WhatsApp; mexer nela é decisão de
   * produto, não ajuste. Quem mudar troca este teste junto — com a medição na
   * mão, escrita ao lado da constante.
   */
  it("a janela é de 10 segundos, e as duas medições que a explicam estão escritas ao lado", () => {
    expect(FONTE).toMatch(/const JANELA_SILENCIO_MS = 10000;/);
    expect(FONTE, "sumiu a medição de 19/08 que sustenta os 10s").toMatch(
      /janela 10s captura 14\/16 \(88%\)/,
    );
    expect(FONTE, "sumiu a separação que corrigiu o denominador").toMatch(
      /31 pares COM resposta no meio/,
    );
    expect(FONTE, "sumiu o histórico da decisão de 13/08").toMatch(/7000 → 3000/);
    expect(FONTE, "sumiu o caso de segurança que decidiu o número").toMatch(/Lia\/Valentina/);
    expect(FONTE, "voltou uma janela antiga").not.toMatch(/JANELA_SILENCIO_MS = (3000|7000);/);
  });

  it("MEDIDO no relógio real: uma mensagem sozinha espera ~10s", async () => {
    const db = bancoCom([{ id: "m1", texto: "ele não quer ir", criadaEm: new Date() }]);
    const t0 = Date.now();
    const r = await aguardarTurnoDaMae(db.cliente(), {
      familyId: "fam-1",
      textoAtual: "ele não quer ir",
    });
    const ms = Date.now() - t0;
    // Guarda anti-teste-vazio: num caminho de erro o tempo seria ~0 e o teste
    // passaria dizendo nada.
    expect(r, "o lote não devolveu turno — o teste mediria o caminho de erro").not.toBeNull();
    expect(ms, `esperou ${ms}ms — a janela sumiu`).toBeGreaterThan(9_000);
    expect(ms, `esperou ${ms}ms — muito além da janela`).toBeLessThan(14_000);
  }, 30_000);
});

describe("os balões que a janela existe para juntar", () => {
  /**
   * TESTE 9 (e 1) — O CASO LIA/VALENTINA, com relógio falso.
   *
   * 19/08, 20:25. Conversa sobre tentativa de agressão da mãe contra a criança.
   * A cuidadora escreveu "Não há tisco" e corrigiu 4,0s depois: "Risco". Com a
   * janela de 3s viraram dois turnos e a Ayla respondeu duas vezes,
   * contraditórias — uma dizendo que NÃO há risco, outra reabrindo o risco e
   * mandando ligar para o 190.
   *
   * O que este teste guarda não é o agrupamento em si: é que o modelo receba
   * a correção de digitação COLADA à frase que ela corrige.
   */
  it("caso Lia: 'Não há tisco' + 4s + 'Risco' produzem UMA resposta, não duas contraditórias", async () => {
    const db = bancoCom([{ id: "m1", texto: "Não  há  tisco", criadaEm: BASE }]);

    vi.useFakeTimers();
    vi.setSystemTime(BASE);

    // O webhook do primeiro balão dispara a sua execução.
    const execA = aguardarTurnoDaMae(db.cliente(), {
      familyId: "fam-1",
      textoAtual: "Não  há  tisco",
    });

    // 4,0s depois — o intervalo REAL medido em produção — chega a correção.
    await vi.advanceTimersByTimeAsync(4_000);
    const t2 = new Date(BASE.getTime() + 4_000);
    db.semear("ayla_messages", [
      {
        id: "m2",
        family_account_id: "fam-1",
        direcao: "inbound",
        texto: "Risco",
        created_at: t2.toISOString(),
        processada_em: null,
      },
    ]);
    const execB = aguardarTurnoDaMae(db.cliente(), { familyId: "fam-1", textoAtual: "Risco" });

    await vi.advanceTimersByTimeAsync(25_000);
    const [a, b] = await Promise.all([execA, execB]);

    // ⚠️ ESTE É O TESTE DE SEGURANÇA. Duas execuções respondendo foi o que
    // produziu, no mesmo minuto, "não há risco" e "há risco? ligue 190".
    const turnos = [a, b].filter((x) => x !== null);
    expect(turnos.length, "duas execuções responderam — é o defeito de 19/08").toBe(1);

    // E a correção de digitação chega COLADA à frase que ela corrige.
    expect(turnos[0]!.quantidade).toBe(2);
    expect(turnos[0]!.texto).toBe("Não  há  tisco\nRisco");
  });

  it("TESTE 2: 'Meu filho não quer ir' + 5s + 'para escola' viram UM turno", async () => {
    const db = bancoCom([
      { id: "m1", texto: "Meu filho não quer ir", criadaEm: new Date(BASE.getTime() - 5_000) },
      { id: "m2", texto: "para escola", criadaEm: BASE },
    ]);
    const r = await comRelogioFalso(BASE, () =>
      aguardarTurnoDaMae(db.cliente(), { familyId: "fam-1", textoAtual: "para escola" }),
    );
    expect(r).not.toBeNull();
    expect(r!.texto).toBe("Meu filho não quer ir\npara escola");
  });

  it("TESTE 3: três balões dentro de 10s viram UM turno", async () => {
    const db = bancoCom([
      { id: "m1", texto: "ela acorda cedo", criadaEm: new Date(BASE.getTime() - 9_000) },
      { id: "m2", texto: "não dorme direito", criadaEm: new Date(BASE.getTime() - 4_000) },
      { id: "m3", texto: "e fica brava", criadaEm: BASE },
    ]);
    const r = await comRelogioFalso(BASE, () =>
      aguardarTurnoDaMae(db.cliente(), { familyId: "fam-1", textoAtual: "e fica brava" }),
    );
    expect(r).not.toBeNull();
    expect(r!.quantidade).toBe(3);
    expect(r!.texto).toBe("ela acorda cedo\nnão dorme direito\ne fica brava");
  });
});

describe("quem responde quando duas execuções disputam o mesmo turno", () => {
  /**
   * TESTE 4 — mensagem nova chegando enquanto a primeira execução espera.
   *
   * É o cenário exato da fragmentação: o webhook dispara um `processInbound`
   * por balão. A execução do balão 1 tem que CEDER, e a do balão 2 responde
   * pelos dois. Duas respostas aqui é o defeito.
   */
  it("TESTE 4: a execução do primeiro balão cede a vez; a do segundo responde pelos dois", async () => {
    const db = bancoCom([{ id: "m1", texto: "primeira", criadaEm: BASE }]);

    vi.useFakeTimers();
    vi.setSystemTime(BASE);

    const execA = aguardarTurnoDaMae(db.cliente(), { familyId: "fam-1", textoAtual: "primeira" });

    // 4 segundos depois chega o segundo balão e dispara a sua própria execução.
    await vi.advanceTimersByTimeAsync(4_000);
    db.semear("ayla_messages", [
      {
        id: "m2",
        family_account_id: "fam-1",
        direcao: "inbound",
        texto: "segunda",
        created_at: new Date(BASE.getTime() + 4_000).toISOString(),
        processada_em: null,
      },
    ]);
    const execB = aguardarTurnoDaMae(db.cliente(), { familyId: "fam-1", textoAtual: "segunda" });

    await vi.advanceTimersByTimeAsync(20_000);
    const [a, b] = await Promise.all([execA, execB]);

    expect(a, "a execução do primeiro balão respondeu — a mãe recebe duas respostas").toBeNull();
    expect(b, "ninguém respondeu — a mãe ficou no silêncio").not.toBeNull();
    expect(b!.quantidade, "o segundo turno não levou os dois balões").toBe(2);
    expect(b!.texto).toBe("primeira\nsegunda");
  });

  /**
   * TESTE 5 — o retry do MESMO webhook.
   *
   * A idempotência de verdade é o índice único em `zaap_message_id`, no insert
   * (orchestrator §2): o segundo insert vira no-op e o fluxo para antes daqui.
   * O que ESTE teste prova é a segunda trava, a do lote: duas execuções
   * simultâneas sobre a MESMA linha — só uma leva o claim, a outra sai calada.
   * Sem isso, um retry que escapasse do índice viraria resposta em duplicata.
   */
  it("TESTE 5: duas execuções sobre a mesma mensagem — só uma claima, a outra sai calada", async () => {
    const db = bancoCom([{ id: "m1", texto: "oi", criadaEm: BASE }]);

    vi.useFakeTimers();
    vi.setSystemTime(BASE);
    const p1 = aguardarTurnoDaMae(db.cliente(), { familyId: "fam-1", textoAtual: "oi" });
    const p2 = aguardarTurnoDaMae(db.cliente(), { familyId: "fam-1", textoAtual: "oi" });
    await vi.advanceTimersByTimeAsync(20_000);
    const r = await Promise.all([p1, p2]);

    const responderam = r.filter((x) => x !== null);
    expect(responderam.length, "as duas execuções responderam ao mesmo webhook").toBe(1);
  });
});

describe("o que a janela NÃO pode engolir", () => {
  /**
   * TESTE 7 — O CASO I, o mais esquecido: quase toda correção que suprime algo
   * suprime demais.
   *
   * A mãe escreve, a Ayla RESPONDE, e 25s depois ela escreve de novo. São dois
   * turnos legítimos e ela tem que receber duas respostas. Na medição de 19/08
   * este caso é a MAIORIA: 31 dos 47 pares de balões consecutivos tinham
   * resposta da Ayla no meio. Engoli-los seria trocar um defeito por um pior.
   */
  it("TESTE 7 (caso I): mensagem já respondida não volta ao lote — o turno novo é dele mesmo", async () => {
    const db = new BancoMemoria();
    db.semear("ayla_messages", [
      {
        id: "m1",
        family_account_id: "fam-1",
        direcao: "inbound",
        texto: "ele não quer ir pra escola",
        created_at: new Date(BASE.getTime() - 40_000).toISOString(),
        // JÁ processada: a Ayla respondeu a esta.
        processada_em: new Date(BASE.getTime() - 30_000).toISOString(),
      },
      {
        id: "m2",
        family_account_id: "fam-1",
        direcao: "inbound",
        texto: "e agora piorou",
        created_at: BASE.toISOString(),
        processada_em: null,
      },
    ]);
    const r = await comRelogioFalso(BASE, () =>
      aguardarTurnoDaMae(db.cliente(), { familyId: "fam-1", textoAtual: "e agora piorou" }),
    );
    expect(r, "o turno novo não saiu — a mãe ficaria sem a segunda resposta").not.toBeNull();
    expect(r!.quantidade).toBe(1);
    expect(r!.texto).toBe("e agora piorou");
    expect(r!.texto, "ressuscitou uma mensagem já respondida").not.toContain("não quer ir");
  });

  /**
   * TESTE 6 — dois balões independentes, separados por tempo suficiente.
   *
   * Sem resposta da Ayla no meio, mas longe demais para serem a mesma frase: a
   * segunda mensagem chega DEPOIS de a primeira já ter sido claimada, então ela
   * abre o seu próprio turno.
   */
  it("TESTE 6: balão que chega depois do claim abre turno próprio", async () => {
    const db = bancoCom([{ id: "m1", texto: "bom dia", criadaEm: BASE }]);

    vi.useFakeTimers();
    vi.setSystemTime(BASE);
    const primeiro = aguardarTurnoDaMae(db.cliente(), { familyId: "fam-1", textoAtual: "bom dia" });
    await vi.advanceTimersByTimeAsync(15_000);
    const r1 = await primeiro;
    expect(r1, "o primeiro turno não saiu").not.toBeNull();
    expect(r1!.quantidade).toBe(1);

    // 30s depois do primeiro, um assunto novo.
    const depois = new Date(BASE.getTime() + 45_000);
    vi.setSystemTime(depois);
    db.semear("ayla_messages", [
      {
        id: "m2",
        family_account_id: "fam-1",
        direcao: "inbound",
        texto: "queria ajuda com o sono",
        created_at: depois.toISOString(),
        processada_em: null,
      },
    ]);
    const segundo = aguardarTurnoDaMae(db.cliente(), {
      familyId: "fam-1",
      textoAtual: "queria ajuda com o sono",
    });
    await vi.advanceTimersByTimeAsync(15_000);
    const r2 = await segundo;

    expect(r2, "o segundo assunto ficou sem resposta").not.toBeNull();
    expect(r2!.quantidade, "o lote reabriu uma mensagem já claimada").toBe(1);
    expect(r2!.texto).toBe("queria ajuda com o sono");
  });

  /**
   * ⚠️ NENHUMA MENSAGEM PODE SUMIR. Este é o risco real de mexer na janela: um
   * balão que chega, não entra em lote nenhum e não gera turno próprio.
   */
  it("nada se perde — as duas mensagens saem claimadas", async () => {
    const db = bancoCom([
      { id: "m1", texto: "primeira", criadaEm: new Date(BASE.getTime() - 2_000) },
      { id: "m2", texto: "segunda", criadaEm: BASE },
    ]);
    const r = await comRelogioFalso(BASE, () =>
      aguardarTurnoDaMae(db.cliente(), { familyId: "fam-1", textoAtual: "segunda" }),
    );
    expect(r).not.toBeNull();
    expect(r!.quantidade, "alguma mensagem ficou fora do lote").toBe(2);
    const pendentes = db.linhas("ayla_messages").filter((l) => l.processada_em === null);
    expect(pendentes, "sobrou mensagem pendente depois do claim").toHaveLength(0);
  });

  it("mensagem antiga demais NÃO entra neste lote", async () => {
    const db = bancoCom([
      {
        id: "m1",
        texto: "antiga, presa por um erro",
        criadaEm: new Date(BASE.getTime() - 20 * 60_000),
      },
      { id: "m2", texto: "a de agora", criadaEm: BASE },
    ]);
    const r = await comRelogioFalso(BASE, () =>
      aguardarTurnoDaMae(db.cliente(), { familyId: "fam-1", textoAtual: "a de agora" }),
    );
    expect(r).not.toBeNull();
    // 20 minutos atrás está fora da janela de lote (15 min) — não entra.
    expect(r!.texto, "trouxe de volta uma mensagem de 20 minutos atrás").not.toContain("antiga");
  });
});

describe("execução órfã — o que acontece quando quem ia responder morre", () => {
  /**
   * TESTE 8 — a pergunta que a janela maior torna mais séria.
   *
   * Se a execução que CEDEU a vez seguiu o seu caminho e a que assumiu morreu
   * (timeout da função, deploy no meio, erro não tratado), as linhas ficam com
   * `processada_em = null`. Este teste prova o comportamento REAL de hoje, sem
   * mudá-lo:
   *
   *   a mensagem NÃO se perde — ela continua pendente e entra no próximo lote;
   *   mas ninguém responde até a família escrever de novo.
   *
   * ⚠️ É uma lacuna conhecida, e a janela de 10s aumenta a exposição de 3s para
   * 10s. Não há varredura que recupere pendente órfã sem mensagem nova. Fica
   * registrado em PEND-058; NÃO se corrige neste PR.
   */
  it("TESTE 8: a mensagem da execução que morreu continua pendente e entra no lote seguinte", async () => {
    const db = bancoCom([{ id: "m1", texto: "socorro", criadaEm: BASE }]);

    // A execução que deveria responder morreu: ninguém claimou nada.
    const pendentesAntes = db.linhas("ayla_messages").filter((l) => l.processada_em === null);
    expect(pendentesAntes, "cenário inválido — a mensagem já estava claimada").toHaveLength(1);

    // A família escreve de novo, 2 minutos depois.
    const depois = new Date(BASE.getTime() + 120_000);
    db.semear("ayla_messages", [
      {
        id: "m2",
        family_account_id: "fam-1",
        direcao: "inbound",
        texto: "vc está aí?",
        created_at: depois.toISOString(),
        processada_em: null,
      },
    ]);
    const r = await comRelogioFalso(depois, () =>
      aguardarTurnoDaMae(db.cliente(), { familyId: "fam-1", textoAtual: "vc está aí?" }),
    );

    expect(r, "a mensagem órfã travou o turno seguinte").not.toBeNull();
    expect(r!.texto, "a mensagem órfã se perdeu de vez").toContain("socorro");
    expect(r!.texto).toContain("vc está aí?");
    // O que este teste NÃO prova, e por isso está escrito: entre a morte da
    // execução e a mensagem nova, a família ficou sem resposta.
  });
});
