import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { montarMundo, inboundDe, type Mundo } from "./__harness/cenario";
import { clienteFalso, type Registro } from "./__harness/modelo";

/**
 * O APRENDIZADO PÓS-RESPOSTA É AGUARDADO — PEND-198.
 *
 * ⚠️ O DEFEITO, MEDIDO EM PRODUÇÃO (01/09 a 11/09/2026): 311 respostas do
 * caminho experimental, **209 execuções** do bloco de aprendizado. Cobertura de
 * **67,2%** — um em cada três relatos da família não virava conhecimento
 * nenhum, em silêncio. A taxa oscilava de 33% a 80% por dia, que é assinatura
 * de perda por runtime e não de regra de negócio.
 *
 * ⚠️ A CAUSA: o bloco era disparado com `void (async () => {…})()`. O
 * `processInbound` inteiro roda dentro do `after()` do webhook, e o `after()`
 * aguarda a PRÓPRIA callback — que aguarda o `processInbound`. Uma promise
 * solta fica FORA dessa cadeia, e a lambda podia congelar com o aprendizado no
 * meio.
 *
 * ⚠️ O QUE ESTE ARQUIVO PROVA E OS OUTROS NÃO PROVAVAM. Os 19 testes de
 * `persistencia-pos-resposta` leem o ARQUIVO e provam ordem por posição de
 * texto. `persistencia-caminho-real` roda o turno de verdade — mas com
 * `await new Promise(r => setTimeout(r, 50))` depois de `processInbound`, e
 * **esse sleep era o sintoma**: ele existia justamente para dar tempo à promise
 * solta. Aqui NÃO HÁ SLEEP NENHUM. Se a promise voltar a ficar solta, estes
 * testes ficam vermelhos — é essa a mordida.
 */

const registros: Registro[] = [];
const mundoRef: { atual: Mundo | null; alvo: string | null; parser?: Record<string, unknown> } = {
  atual: null,
  alvo: null,
};
/** Ordem real dos acontecimentos, num relógio só. */
const linhaDoTempo: string[] = [];
/** Liga a falha do parser para UMA chamada. */
const parserFalha = { valor: false };
/**
 * Os eventos que o turno publicou.
 *
 * ⚠️ POR QUE INTERCEPTAR `logEvent`. No arnês, a persistência dele usa
 * `createServiceRoleClient()` — um cliente real, que sem URL falha e cai no
 * `log_persist_failed`. Ou seja: `eventos_app` do banco em memória NÃO recebe
 * nada, e uma asserção sobre ele passaria por vazio em vez de por verdade.
 */
const eventos: Array<{ kind: string; payload?: Record<string, unknown> }> = [];

vi.mock("@/lib/log", () => ({
  logEvent: async (e: { kind: string; payload?: Record<string, unknown> }) => {
    eventos.push(e);
  },
  logServerError: async () => {},
}));

vi.mock("./whatsappSender", () => ({
  enviarTexto: async (p: { phoneE164: string; texto: string }) => {
    linhaDoTempo.push("envio");
    mundoRef.atual?.enviadas.push({ texto: p.texto, para: p.phoneE164 });
    return { messageId: `msg-${mundoRef.atual?.enviadas.length}`, raw: {} };
  },
  enviarDocumento: async () => ({ messageId: "doc", raw: {} }),
  enviarImagem: async () => ({ messageId: "img", raw: {} }),
  sendVideoGuia: async () => ({ messageId: "vid", raw: {} }),
}));

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

/** O parser é a PRIMEIRA coisa do bloco pós-resposta — é o marco de entrada. */
vi.mock("./parser", async (orig) => {
  const real = (await orig()) as Record<string, unknown>;
  const parseReal = real.parseInbound as (...a: unknown[]) => Promise<unknown>;
  return {
    ...real,
    parseInbound: async (...args: unknown[]) => {
      linhaDoTempo.push("aprendizado_inicio");
      if (parserFalha.valor) {
        parserFalha.valor = false;
        linhaDoTempo.push("aprendizado_erro");
        throw new Error("parser fora do ar");
      }
      const r = await parseReal(...args);
      linhaDoTempo.push("aprendizado_fim");
      return r;
    },
  };
});

const { processInbound } = await import("./orchestrator");

function familia(telefone = "+5541999990021") {
  const m = montarMundo({
    nomeMae: "Carla",
    telefone,
    criancas: [{ nome: "Manu", nascimento: "2020-04-10", genero: "feminino" }],
  });
  mundoRef.atual = m;
  return m;
}

const ENV = process.env.AYLA_EXPERIMENTAL_FAMILY_IDS;
beforeEach(() => {
  registros.length = 0;
  linhaDoTempo.length = 0;
  eventos.length = 0;
  parserFalha.valor = false;
});
afterEach(() => {
  if (ENV === undefined) delete process.env.AYLA_EXPERIMENTAL_FAMILY_IDS;
  else process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = ENV;
  delete process.env.KOLO_EXTRATOR_SOMBRA;
});

const passouPeloExperimental = (m: Mundo) =>
  m.db.linhas("ayla_send_log").some((l) => {
    const p = l.payload as { meta?: { ayla_path?: string } } | null;
    return p?.meta?.ayla_path === "experimental";
  });

describe("a resposta vem primeiro, o aprendizado depois — e é esperado", () => {
  it("0. o turno passa pelo caminho NOVO — senão tudo abaixo mede o Legacy", async () => {
    const mundo = familia();
    process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = mundo.familyId;
    await processInbound(mundo.db.cliente(), inboundDe(mundo, "A Manu explodiu de novo hoje."));
    expect(passouPeloExperimental(mundo)).toBe(true);
  }, 30000);

  it("1. o ENVIO acontece antes do início do aprendizado", async () => {
    const mundo = familia("+5541999990022");
    process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = mundo.familyId;
    await processInbound(mundo.db.cliente(), inboundDe(mundo, "A Manu explodiu de novo hoje."));
    expect(linhaDoTempo).toContain("envio");
    expect(linhaDoTempo).toContain("aprendizado_inicio");
    expect(linhaDoTempo.indexOf("envio")).toBeLessThan(linhaDoTempo.indexOf("aprendizado_inicio"));
  }, 30000);

  it("2. `processInbound` NÃO resolve com o aprendizado pendente — SEM sleep", async () => {
    // ⚠️ ESTA É A MORDIDA. Nenhum `setTimeout` aqui: se a promise voltar a ser
    // `void`, o `aprendizado_fim` ainda não estará na linha do tempo quando o
    // `await` abaixo terminar, e o teste fica vermelho.
    const mundo = familia("+5541999990023");
    process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = mundo.familyId;
    await processInbound(mundo.db.cliente(), inboundDe(mundo, "A Manu explodiu de novo hoje."));
    expect(linhaDoTempo).toContain("aprendizado_fim");
    expect(linhaDoTempo.at(-1)).toBe("aprendizado_fim");
  }, 30000);

  it("3. a família recebeu a resposta MESMO quando o aprendizado falha", async () => {
    const mundo = familia("+5541999990024");
    process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = mundo.familyId;
    parserFalha.valor = true;
    const r = await processInbound(
      mundo.db.cliente(),
      inboundDe(mundo, "A Manu explodiu de novo hoje."),
    );
    expect(r.tratada).toBe(true);
    expect(mundo.enviadas.length).toBeGreaterThan(0);
    expect(linhaDoTempo).toContain("aprendizado_erro");
    // A falha não relançou: o envio permanece, e o turno não virou erro.
    expect(linhaDoTempo.indexOf("envio")).toBeLessThan(linhaDoTempo.indexOf("aprendizado_erro"));
  }, 30000);

  it("4. a falha do aprendizado deixa rastro PERSISTIDO com o turno", async () => {
    const mundo = familia("+5541999990025");
    process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = mundo.familyId;
    parserFalha.valor = true;
    await processInbound(mundo.db.cliente(), inboundDe(mundo, "A Manu explodiu de novo hoje."));
    const falha = eventos.find((e) => e.kind === "aprendizado_pos_resposta_falhou");
    expect(falha, "a perda de aprendizado ficou invisível").toBeTruthy();
    expect(String(falha!.payload?.turno ?? "")).toMatch(/^tn_/);
  }, 30000);

  it("5. dois turnos seguidos não se misturam — cada um tem o próprio turno", async () => {
    const mundo = familia("+5541999990026");
    process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = mundo.familyId;
    await processInbound(mundo.db.cliente(), inboundDe(mundo, "A Manu explodiu de novo hoje."));
    await processInbound(mundo.db.cliente(), inboundDe(mundo, "Hoje ela dormiu mal."));
    const turnos = eventos
      .filter((e) => e.kind === "turno_externo")
      .map((e) => String(e.payload?.turno ?? ""));
    expect(turnos.length, "os dois turnos precisam ter publicado rastro").toBe(2);
    expect(new Set(turnos).size, "dois turnos com o mesmo id").toBe(2);
    for (const t of turnos) expect(t).toMatch(/^tn_/);
    // E o aprendizado rodou nos DOIS, sem sleep.
    expect(linhaDoTempo.filter((x) => x === "aprendizado_fim").length).toBe(2);
  }, 30000);
});

describe("a sombra, dentro do bloco aguardado", () => {
  it("6. turno SEM fato roda o extrator e pode legitimamente devolver zero", async () => {
    // "Hoje foi um dia difícil, estou exausta" — o caso que a microprova de
    // 11/09 não conseguiu medir, porque o bloco não chegou a rodar.
    const mundo = familia("+5541999990027");
    process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = mundo.familyId;
    process.env.KOLO_EXTRATOR_SOMBRA = "1";
    await processInbound(
      mundo.db.cliente(),
      inboundDe(mundo, "Hoje foi um dia difícil. Estou exausta"),
    );
    // O bloco rodou até o fim — é isso que dá à sombra a chance de medir zero.
    expect(linhaDoTempo).toContain("aprendizado_fim");
    // E zero fato é resultado legítimo: nada aqui exige incorporação.
    const sug = (mundo.db.linhas("sugestao_perfil_vivos") ?? []) as unknown[];
    expect(Array.isArray(sug)).toBe(true);
  }, 30000);

  it("7. a sombra continua sem escrever no Perfil — o bloco aguardado não mudou isso", async () => {
    const mundo = familia("+5541999990028");
    process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = mundo.familyId;
    process.env.KOLO_EXTRATOR_SOMBRA = "1";
    const antes = (mundo.db.linhas("perfil_vivo_membro") ?? []).length;
    await processInbound(
      mundo.db.cliente(),
      inboundDe(mundo, "Hoje foi um dia difícil. Estou exausta"),
    );
    const daSombra = eventos.filter(
      (e) => e.kind === "extrator_sombra" || e.kind === "extrator_sombra_falhou",
    );
    // Se a sombra rodou, ela publicou evento — e nunca uma escrita de perfil.
    for (const e of daSombra) {
      expect(JSON.stringify(e.payload)).not.toContain("texto_aplicado");
      expect(String(e.payload?.turno ?? "")).toMatch(/^tn_/);
    }
    expect((mundo.db.linhas("perfil_vivo_membro") ?? []).length).toBeGreaterThanOrEqual(antes);
  }, 30000);
});
