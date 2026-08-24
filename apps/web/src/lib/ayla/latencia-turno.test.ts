import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { BancoMemoria } from "./__harness/banco-memoria";
import { montarMundo, inboundDe, type Mundo } from "./__harness/cenario";
import { clienteFalso, type Registro } from "./__harness/modelo";

/**
 * O TURNO LÊ O HISTÓRICO UMA VEZ — 13/08/2026, PEND-064.
 *
 * ⚠️ O QUE ESTA FRENTE ATACOU. MEDIDO em produção: 27 idas ao banco antes da
 * primeira bolha, a ~400 ms cada (a consulta é trivial — o custo é rede entre
 * a Vercel e o Supabase self-hosted). O banco custava MAIS que o modelo.
 *
 * Três mudanças, todas ao redor da inteligência, nenhuma dentro dela:
 *   1. o histórico das 9 últimas falas era lido TRÊS VEZES por turno;
 *   2. preferências, oferta de fim de semana e rotina pendente iam em fila;
 *   3. contexto, último check-in e histórico do parser iam em fila.
 *
 * MEDIDO com 400 ms injetados por consulta: 9,27 s → 7,52 s até a primeira
 * bolha. Prompt, modelo, Boas Práticas e portões INTOCADOS.
 *
 * ⚠️ ESTE ARQUIVO EXISTE PARA A SEGUNDA PARTE DA CONTA: economia só vale se o
 * modelo receber a MESMA coisa, e se nenhuma família enxergar a outra.
 */

const registros: Registro[] = [];
const mundoRef: { atual: Mundo | null; alvo: string | null } = { atual: null, alvo: null };
/** Toda consulta que o turno faz, com a tabela. */
const consultas: string[] = [];
/** O histórico que chegou a cada consumidor. */
const recebido: Record<string, unknown> = {};

vi.mock("./whatsappSender", () => ({
  enviarTexto: async (p: { phoneE164: string; texto: string }) => {
    mundoRef.atual?.enviadas.push({ para: p.phoneE164, texto: p.texto });
    return { ok: true, messageId: "z" };
  },
  enviarImagem: async () => ({ ok: true, messageId: "i" }),
  enviarDocumento: async () => ({ ok: true, messageId: "d" }),
  parseZapiWebhook: () => null,
}));
vi.mock("@/lib/ia/provider", () => ({
  MODELO_CONVERSA: { anthropic: "claude-sonnet-4-6", openai: "gpt-5.6-luna" },
  providerConversacionalParaFamilia: () => "anthropic",
  gerarConversacional: async (p: unknown) => {
    recebido.promptPrincipal = JSON.stringify(p);
    return { texto: "[resposta]", provider: "anthropic", model: "s", tokensIn: 0, tokensOut: 0, cacheRead: 0 };
  },
}));
vi.mock("./anthropic", () => ({
  AYLA_MODEL: "claude-haiku-4-5",
  AYLA_MODEL_FALLBACK: "claude-sonnet-4-6",
  getAylaAnthropicClient: () => clienteFalso({ alvo: mundoRef.alvo }, registros),
}));
vi.mock("./lote-inbound", () => ({
  aguardarTurnoDaMae: async (_s: unknown, p: { textoAtual: string }) => ({ texto: p.textoAtual, quantidade: 1 }),
  descartarTurnoPendente: async () => {},
}));
vi.mock("@/lib/ai/prompts", () => ({ getSystemPrompt: async (_k: string, f: string) => f }));

const { processInbound } = await import("./orchestrator");

/** Registra a tabela de cada consulta E o `family_account_id` filtrado. */
function espiar(db: BancoMemoria) {
  const orig = db.from.bind(db);
  (db as unknown as { from: unknown }).from = (t: string) => {
    const c = orig(t);
    const then = c.then.bind(c);
    (c as unknown as { then: unknown }).then = (ok: never, err: never) => {
      const f = (c as unknown as { filtros: Array<{ col: string; val: unknown }> }).filtros ?? [];
      const fam = f.find((x) => x.col === "family_account_id")?.val;
      const modo = (c as unknown as { modo: string }).modo;
      const porId = f.some((x) => x.col === "zaap_message_id" || x.col === "id");
      consultas.push(`${modo}:${t}${fam ? "@" + String(fam).slice(0, 8) : porId ? "@porId" : ""}`);
      return then(ok, err);
    };
    return c;
  };
  return db;
}

function familia(nomeMae: string, crianca: string, telefone: string) {
  const m = montarMundo({ telefone, nomeMae, criancas: [{ nome: crianca, nascimento: "2016-03-19", genero: "masculino" }] });
  return m;
}

beforeEach(() => {
  consultas.length = 0;
  registros.length = 0;
  for (const k of Object.keys(recebido)) delete recebido[k];
});

describe("o histórico é lido UMA vez por turno", () => {
  it("MORDE: a consulta das 9 últimas falas não se repete", async () => {
    const mundo = familia("Juliana", "Daniel", "+5541999990001");
    mundoRef.atual = mundo;
    mundoRef.alvo = mundo.membros["Daniel"];
    espiar(mundo.db);
    await processInbound(mundo.db.cliente(), inboundDe(mundo, "Ele fica muito bravo quando perde um jogo."));

    const ORCH = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");
    // A prova ESTRUTURAL: existe um leitor único e ele é preguiçoso.
    expect(ORCH).toMatch(/async function lerHistoricoBruto\(/);
    expect(ORCH).toMatch(/historicoBrutoPromise \?\?= lerHistoricoBruto\(supabase, family\.id\)/);
    // E os três consumidores passam o resultado adiante, em vez de reler.
    expect(ORCH).toMatch(/ultimasFalas\(supabase, family\.id, inbound\.texto, await historicoDoTurno\(\)\)/);
    expect(ORCH).toMatch(/carregarHistorico\(supabase, family\.id, inbound\.texto, null, undefined, bruto\)/);
    expect(ORCH).toMatch(/await historicoDoTurno\(\),\s*\),/);
  });

  it("MORDE: o total de consultas caiu, e nenhuma tabela nova apareceu", async () => {
    const mundo = familia("Juliana", "Daniel", "+5541999990001");
    mundoRef.atual = mundo;
    mundoRef.alvo = mundo.membros["Daniel"];
    espiar(mundo.db);
    await processInbound(mundo.db.cliente(), inboundDe(mundo, "Ele fica muito bravo quando perde um jogo."));
    // 27 → 25 antes da primeira bolha; aqui contamos o turno inteiro, então o
    // que este teste trava é o TETO: se alguém reintroduzir a releitura, sobe.
    const mensagens = consultas.filter((c) => c.startsWith("ayla_messages")).length;
    expect(mensagens, `consultas em ayla_messages: ${mensagens}`).toBeLessThanOrEqual(14);
  });
});

describe("EQUIVALÊNCIA — o modelo recebe a mesma coisa", () => {
  it("MORDE: o perfil da criança chega ao prompt principal", async () => {
    const mundo = montarMundo({
      nomeMae: "Juliana",
      criancas: [{ nome: "Daniel", nascimento: "2016-03-19", genero: "masculino", sabe: { essencial: "Daniel adora dinossauros" } }],
    });
    mundoRef.atual = mundo;
    mundoRef.alvo = mundo.membros["Daniel"];
    await processInbound(mundo.db.cliente(), inboundDe(mundo, "Ele fica muito bravo quando perde um jogo."));
    expect(String(recebido.promptPrincipal ?? ""), "o perfil sumiu do prompt").toContain("dinossauros");
  });

  it("MORDE: a fala anterior da conversa chega ao prompt", async () => {
    const mundo = familia("Juliana", "Daniel", "+5541999990001");
    mundoRef.atual = mundo;
    mundoRef.alvo = mundo.membros["Daniel"];
    mundo.db.semear("ayla_messages", [
      {
        family_account_id: mundo.familyId,
        direcao: "inbound",
        texto: "a escola reclamou do Daniel ontem",
        created_at: new Date(Date.now() - 60_000).toISOString(),
      },
    ]);
    await processInbound(mundo.db.cliente(), inboundDe(mundo, "Ele fica muito bravo quando perde um jogo."));
    expect(String(recebido.promptPrincipal ?? ""), "o histórico sumiu do prompt").toContain(
      "a escola reclamou",
    );
  });
});

describe("ISOLAMENTO — a economia não pode misturar famílias", () => {
  it("MORDE: TODA consulta de histórico é filtrada pela família do turno", async () => {
    const a = familia("Juliana", "Daniel", "+5541999990001");
    // ⚠️ A MESMA INSTÂNCIA DE BANCO. Semear a família B num banco separado
    // não provaria nada: o vazamento que importa acontece quando as duas
    // dividem a mesma tabela, que é o caso em produção.
    const b = familia("Carla", "Bruno", "+5541999990002");
    a.db.semear("ayla_messages", [
      {
        family_account_id: b.familyId,
        direcao: "inbound",
        texto: "SEGREDO DA FAMILIA B",
        created_at: new Date(Date.now() - 60_000).toISOString(),
      },
    ]);
    mundoRef.atual = a;
    mundoRef.alvo = a.membros["Daniel"];
    espiar(a.db);
    await processInbound(a.db.cliente(), inboundDe(a, "Ele fica muito bravo quando perde um jogo."));

    // Só LEITURAS precisam de recorte: escrita carrega o family_account_id no
    // próprio payload, e o `update` do membro mira um zaap_message_id, que é
    // único global.
    const leituras = consultas.filter((c) => c.startsWith("select:ayla_messages"));
    expect(leituras.length).toBeGreaterThan(0);
    for (const c of leituras) {
      expect(c, `consulta sem recorte de família: ${c}`).toContain("@");
      expect(c, `consulta apontando para OUTRA família: ${c}`).toContain(a.familyId.slice(0, 8));
    }
    expect(String(recebido.promptPrincipal ?? ""), "vazou conteúdo da outra família").not.toContain(
      "SEGREDO DA FAMILIA B",
    );
  });

  it("MORDE: dois turnos seguidos de famílias diferentes não compartilham o leitor", async () => {
    // O leitor é `const` DENTRO de processInbound. Se um dia virar módulo-level,
    // este teste cai — e é exatamente esse o erro que ele existe para impedir.
    const a = familia("Juliana", "Daniel", "+5541999990001");
    mundoRef.atual = a;
    mundoRef.alvo = a.membros["Daniel"];
    a.db.semear("ayla_messages", [
      { family_account_id: a.familyId, direcao: "inbound", texto: "MARCA DA FAMILIA A", created_at: new Date(Date.now() - 60_000).toISOString() },
    ]);
    await processInbound(a.db.cliente(), inboundDe(a, "Ele fica bravo quando perde."));
    expect(String(recebido.promptPrincipal ?? "")).toContain("MARCA DA FAMILIA A");

    const b = familia("Carla", "Bruno", "+5541999990002");
    mundoRef.atual = b;
    mundoRef.alvo = b.membros["Bruno"];
    for (const k of Object.keys(recebido)) delete recebido[k];
    await processInbound(b.db.cliente(), inboundDe(b, "Ele fica bravo quando perde."));
    expect(
      String(recebido.promptPrincipal ?? ""),
      "o histórico da família A sobreviveu ao turno e vazou para a B",
    ).not.toContain("MARCA DA FAMILIA A");
  });

  it("MORDE: o leitor é local ao turno, nunca módulo-level", () => {
    const ORCH = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");
    // Declarado DENTRO de processInbound (indentado), não na raiz do módulo.
    expect(ORCH).toMatch(/\n  let historicoBrutoPromise: Promise<LinhaDeHistorico\[\]> \| null = null;/);
    expect(ORCH, "virou estado de módulo — vaza entre famílias").not.toMatch(
      /\nlet historicoBrutoPromise/,
    );
  });
});

describe("as consultas paralelizadas continuam independentes", () => {
  it("MORDE: o trio de abertura vai junto, e os portões seguem em ordem", () => {
    const ORCH = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");
    expect(ORCH).toMatch(/const \[\{ data: pref \}, ofertaFds, rotinaConversa\] = await Promise\.all\(\[/);
    // O portão do bloqueio continua ANTES de tudo o que responde.
    const iPref = ORCH.indexOf("if (pref?.desativada && pref?.consentimento_em)");
    const iLote = ORCH.indexOf("const turno = await aguardarTurnoDaMae");
    expect(iPref).toBeGreaterThan(-1);
    expect(iPref, "o bloqueio da família deixou de vir antes do turno").toBeLessThan(iLote);
  });

  it("MORDE: contexto, check-in e histórico do parser vão juntos", () => {
    const ORCH = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");
    expect(ORCH).toMatch(/const \[ctx, \{ data: ultimoCheckin \}, historicoParser\] = await Promise\.all\(\[/);
    // E o `ctx` nulo continua encerrando o turno.
    // ⚠️ 24/08/2026 (PEND-151): a linha seguinte ao `Promise.all` deixou de ser
    // `return { tratada: true }` — que era a saída MUDA da cadeia. Hoje ela
    // manda um recado honesto. O que este teste guarda continua o mesmo: as três
    // leituras vão juntas, e a checagem do contexto vem logo depois.
    expect(ORCH).toMatch(/\]\);\s*\n[\s\S]{0,1200}if \(!ctx\) \{/);
    expect(ORCH).toMatch(/texto: TEXTO_NAO_CONSEGUI_AGORA/);
  });

  it("NENHUMA ESCRITA foi paralelizada", () => {
    const ORCH = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");
    for (const bloco of ORCH.split("await Promise.all([").slice(1)) {
      const corpo = bloco.slice(0, bloco.indexOf("]);"));
      expect(corpo, `escrita dentro de um Promise.all: ${corpo.slice(0, 80)}`).not.toMatch(
        /\.(insert|upsert|update|delete)\(/,
      );
    }
  });
});
