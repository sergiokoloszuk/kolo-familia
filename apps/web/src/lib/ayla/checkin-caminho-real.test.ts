import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { montarMundo, inboundDe, passouPeloExperimental, type Mundo } from "./__harness/cenario";
import { clienteFalso, type Registro } from "./__harness/modelo";

/**
 * PEND-077 · O CHECK-IN DIÁRIO, PROVADO PELO `processInbound` REAL.
 *
 * A migração 0078 (índice único em família+criança+dia) já está aplicada em
 * produção. Antes dela `ayla_daily_checkins` tinha ZERO linhas na história
 * inteira do produto: o `onConflict` de três colunas não tinha constraint que
 * casasse, o Postgres devolvia 42P10, o PostgREST devolvia 400 — e a escrita
 * não conferia o próprio resultado, então o fluxo seguia como sucesso.
 *
 * ⚠️ ESTE ARQUIVO SÓ EXISTE PORQUE O ARNÊS FOI CORRIGIDO ANTES. O duplo de
 * banco ignorava o upsert que MESCLA e caía num insert puro — dois registros no
 * mesmo dia viravam duas linhas e o teste passava verde. Ele não conseguia
 * reprovar exatamente a duplicação que a 0078 existe para impedir.
 *
 * PEND-072 continua valendo: todo teste que afirma comportamento do caminho
 * novo passa por `passouPeloExperimental`.
 */

const registros: Registro[] = [];
const mundoRef: { atual: Mundo | null; alvo: string | null; parser?: Record<string, unknown> } = {
  atual: null,
  alvo: null,
};

vi.mock("./whatsappSender", () => ({
  enviarTexto: async (p: { phoneE164: string; texto: string }) => {
    mundoRef.atual?.enviadas.push({ texto: p.texto, para: p.phoneE164 });
    return { messageId: `msg-${mundoRef.atual?.enviadas.length}`, raw: {} };
  },
  enviarDocumento: async () => ({ messageId: "doc", raw: {} }),
  enviarImagem: async () => ({ messageId: "img", raw: {} }),
  sendVideoGuia: async () => ({ messageId: "vid", raw: {} }),
}));

// Sem este duplo, `gerarConversacional` falha por falta de chave, o ramo novo
// devolve null e o turno cai para o Legacy — verde pelo motor errado.
vi.mock("@/lib/ia/provider", () => ({
  MODELO_CONVERSA: { anthropic: "claude-sonnet-4-6", openai: "gpt-5.6-luna" },
  providerConversacionalParaFamilia: () => "openai",
  gerarConversacional: async () => ({
    texto: "[resposta da Ayla experimental]",
    provider: "openai",
    model: "gpt-5.6-luna",
    tokensIn: 100,
    tokensOut: 20,
    cacheRead: 0,
    cacheWrite: 0,
    ms: 1,
  }),
}));

vi.mock("./anthropic", async (orig) => {
  const real = (await orig()) as Record<string, unknown>;
  return {
    ...real,
    getAylaAnthropicClient: () =>
      clienteFalso({ alvo: mundoRef.alvo, parser: mundoRef.parser }, registros),
  };
});

const { processInbound } = await import("./orchestrator");

const ENV = process.env.AYLA_EXPERIMENTAL_FAMILY_IDS;
beforeEach(() => {
  registros.length = 0;
  mundoRef.parser = undefined;
});
afterEach(() => {
  vi.useRealTimers();
  if (ENV === undefined) delete process.env.AYLA_EXPERIMENTAL_FAMILY_IDS;
  else process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = ENV;
});

function familia(nome: string, tel: string, crianca: string, nasc: string) {
  return montarMundo({
    nomeMae: nome,
    telefone: tel,
    criancas: [{ nome: crianca, nascimento: nasc, genero: "feminino" }],
  });
}

/** As linhas de check-in DESTA família. */
function checkins(mundo: Mundo): Array<Record<string, unknown>> {
  return mundo.db
    .linhas("ayla_daily_checkins")
    .filter((l) => l.family_account_id === mundo.familyId);
}

/** Um relato que o parser devolve como conquista — é o que gera o registro. */
const RELATO = {
  conquista: "escovou os dentes sozinha",
  observacao_livre: "primeira vez sem ajuda",
  confianca: 95,
};

describe("O CHECK-IN CHEGA AO BANCO — pelo caminho novo", () => {
  it("0. o turno roda pelo EXPERIMENTAL — sem isto tudo abaixo mede o Legacy", async () => {
    const mundo = familia("Carla", "+5541999991101", "Manu", "2022-04-10");
    mundoRef.atual = mundo;
    mundoRef.alvo = mundo.membros["Manu"];
    mundoRef.parser = RELATO;
    process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = mundo.familyId;

    await processInbound(mundo.db.cliente(), inboundDe(mundo, "A Manu escovou os dentes sozinha!"));
    await new Promise((r) => setTimeout(r, 60));

    expect(passouPeloExperimental(mundo), "caiu para o Legacy").toBe(true);
  }, 30000);

  it("1. INSERT: o relato vira uma linha de check-in", async () => {
    const mundo = familia("Carla", "+5541999991102", "Manu", "2022-04-10");
    mundoRef.atual = mundo;
    mundoRef.alvo = mundo.membros["Manu"];
    mundoRef.parser = RELATO;
    process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = mundo.familyId;

    expect(checkins(mundo).length, "a fixture já nasceu com check-in").toBe(0);

    await processInbound(mundo.db.cliente(), inboundDe(mundo, "A Manu escovou os dentes sozinha!"));
    await new Promise((r) => setTimeout(r, 60));

    const linhas = checkins(mundo);
    expect(linhas.length, "nenhum check-in gravado").toBe(1);
    expect(linhas[0].respondeu).toBe(true);
  }, 30000);

  it("2. FAMÍLIA e CRIANÇA corretas na linha gravada", async () => {
    const mundo = familia("Carla", "+5541999991103", "Manu", "2022-04-10");
    mundoRef.atual = mundo;
    mundoRef.alvo = mundo.membros["Manu"];
    mundoRef.parser = RELATO;
    process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = mundo.familyId;

    await processInbound(mundo.db.cliente(), inboundDe(mundo, "A Manu escovou os dentes sozinha!"));
    await new Promise((r) => setTimeout(r, 60));

    const l = checkins(mundo)[0];
    expect(l.family_account_id).toBe(mundo.familyId);
    expect(l.membro_atipico_id).toBe(mundo.membros["Manu"]);
  }, 30000);

  it("3. UPSERT: segundo relato no MESMO dia atualiza, não duplica", async () => {
    // ⚠️ ESTE É O TESTE QUE A 0078 TORNOU POSSÍVEL. Sem o índice único o banco
    // devolvia 400; sem o merge no arnês, o duplo devolvia duas linhas.
    const mundo = familia("Carla", "+5541999991104", "Manu", "2022-04-10");
    mundoRef.atual = mundo;
    mundoRef.alvo = mundo.membros["Manu"];
    process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = mundo.familyId;

    mundoRef.parser = { ...RELATO, conquista: "escovou os dentes sozinha" };
    await processInbound(mundo.db.cliente(), inboundDe(mundo, "Ela escovou os dentes sozinha!"));
    await new Promise((r) => setTimeout(r, 60));
    expect(checkins(mundo).length).toBe(1);

    mundoRef.parser = { ...RELATO, conquista: "e depois se vestiu sozinha" };
    await processInbound(mundo.db.cliente(), inboundDe(mundo, "E depois se vestiu sozinha!"));
    await new Promise((r) => setTimeout(r, 60));

    const linhas = checkins(mundo);
    expect(linhas.length, "o mesmo dia produziu DUAS linhas — o upsert não mesclou").toBe(1);
    // E a mescla precisa ter trazido o conteúdo novo, não mantido o velho.
    expect(String(linhas[0].conquista_extraida)).toContain("vestiu");
  }, 30000);

  it("4. DATA LOCAL: às 21h30 de São Paulo o carimbo é o dia de HOJE, não o de UTC", async () => {
    // 2026-08-17T00:30:00Z  =  16/08 às 21:30 em America/Sao_Paulo.
    // Com UTC o check-in cairia no dia 17 — o dia seguinte, para a família.
    // É exatamente a faixa 21h–23h59 BRT onde os dois calendários divergem.
    // ⚠️ Só o `Date` é falseado. Falsear os timers junto congela o
    // `setTimeout` que o próprio orquestrador usa e o turno nunca termina —
    // medido: o teste estourava em 30s sem nunca gravar nada.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-17T00:30:00.000Z"));

    const mundo = familia("Carla", "+5541999991105", "Manu", "2022-04-10");
    mundoRef.atual = mundo;
    mundoRef.alvo = mundo.membros["Manu"];
    mundoRef.parser = RELATO;
    process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = mundo.familyId;

    await processInbound(mundo.db.cliente(), inboundDe(mundo, "A Manu escovou os dentes sozinha!"));
    await new Promise((r) => setTimeout(r, 60));

    const l = checkins(mundo)[0];
    expect(l, "nenhum check-in gravado no cenário das 21h30").toBeTruthy();
    expect(l.date, "o check-in caiu no dia seguinte — o carimbo está em UTC").toBe("2026-08-16");
  }, 30000);

  it("5. ISOLAMENTO: o check-in de uma família não aparece na outra", async () => {
    const a = familia("Carla", "+5541999991106", "Manu", "2022-04-10");
    const b = familia("Renata", "+5541999991107", "Alice", "2020-11-15");

    mundoRef.atual = a;
    mundoRef.alvo = a.membros["Manu"];
    mundoRef.parser = RELATO;
    process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = `${a.familyId},${b.familyId}`;
    await processInbound(a.db.cliente(), inboundDe(a, "A Manu escovou os dentes sozinha!"));
    await new Promise((r) => setTimeout(r, 60));

    expect(checkins(a).length).toBe(1);
    expect(checkins(b).length, "vazou check-in entre famílias").toBe(0);
    // E nenhuma linha de A carrega criança de B.
    const idsDeB = Object.values(b.membros);
    for (const l of checkins(a)) {
      expect(idsDeB).not.toContain(l.membro_atipico_id);
    }
  }, 30000);
});

describe("O QUE O CAMINHO NOVO AINDA NÃO FAZ COM O CHECK-IN", () => {
  it("6. o caminho novo GRAVA o check-in mas NUNCA o lê de volta", () => {
    // ⚠️ ACHADO, e é por isso que a PEND-077 não fecha inteira (17/08/2026).
    //
    // `persistirRegistro` é chamado dentro do ramo experimental, então a
    // escrita acontece. Mas a única leitura de `ayla_daily_checkins` no
    // orquestrador vive DEPOIS do `return { tratada: true }` do ramo novo —
    // ou seja, pertence só ao Legacy.
    //
    // Consequência: o "último check-in" nunca entra no contexto da Ayla nova.
    // Este teste prende o fato para que ele não seja esquecido, e falha no dia
    // em que alguém ligar a leitura — que é quando ele deve ser reescrito.
    const src = readFileSync(join(process.cwd(), "src/lib/ayla/orchestrator.ts"), "utf8");

    const iRetornoExperimental = src.indexOf("return { tratada: true, familia: family.id, resposta: resp }");
    const iLeitura = src.indexOf('.from("ayla_daily_checkins")\n      .select');
    const iEscrita = src.indexOf('.from("ayla_daily_checkins").upsert(');

    expect(iRetornoExperimental, "âncora do ramo experimental não encontrada").toBeGreaterThan(0);
    expect(iLeitura, "leitura do check-in não encontrada").toBeGreaterThan(0);
    expect(iEscrita, "escrita do check-in não encontrada").toBeGreaterThan(0);

    // A leitura está depois do return do ramo novo → inalcançável para ele.
    expect(iLeitura).toBeGreaterThan(iRetornoExperimental);
  });
});
