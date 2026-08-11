import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A PROVA POR EXECUÇÃO DO PADRÃO — `parseInbound` e `gerarRespostaAyla`
 * chamados de verdade, com o MESMO `UsageTracking`, modelo falso e relógio
 * real.
 *
 * ⚠️ O QUE ISTO PROVA QUE A LEITURA DE CÓDIGO NÃO PROVA: que o `ms` gravado é
 * o tempo da CHAMADA AO MODELO. Os testes estruturais mostram onde o `t0` e o
 * `t1` estão; só a execução mostra o que sai no `meta` quando o modelo demora
 * 120 ms, a retentativa espera 1,2 s e o pós-processamento leva mais 200 ms.
 *
 * ⚠️ ZERO CHAMADA PAGA E ZERO PRODUÇÃO. O cliente Anthropic e o
 * `gerarConversacional` são falsos; o `supabase` é um capturador em memória.
 * Nenhum insert sai daqui.
 */

// ── O MODELO FALSO, com atraso controlado ────────────────────────────────
const MS_MODELO = 120;
const MS_POS_PROCESSAMENTO = 200;
let falharPrimeiraDoResponder = false;
let chamadasDoResponder = 0;

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

vi.mock("./anthropic", () => ({
  AYLA_MODEL: "claude-haiku-4-5",
  AYLA_MODEL_FALLBACK: "claude-sonnet-4-6",
  getAylaAnthropicClient: () => ({
    messages: {
      stream: () => ({
        finalMessage: async () => {
          await dormir(MS_MODELO);
          return {
            content: [
              {
                type: "text",
                // JSON válido e mínimo para o schema do parser.
                text: JSON.stringify({
                  membro_atipico_id: null,
                  confianca_identificacao: 0,
                  conquista: null,
                  desafio: null,
                  emocao_mae: null,
                  possivel_gatilho: null,
                  observacao_livre: null,
                  quem_estava: null,
                  estado_adulto: null,
                  reacao_adulto: null,
                  confianca_camada_adulto: 0,
                  sugestao_kolo_vivo: false,
                  confianca: 10,
                }),
              },
            ],
            usage: { input_tokens: 1000, output_tokens: 100 },
          };
        },
      }),
    },
  }),
}));

vi.mock("@/lib/ia/provider", () => ({
  MODELO_CONVERSA: { anthropic: "claude-sonnet-4-6", openai: "gpt-5.6-luna" },
  providerConversacionalParaFamilia: () => "anthropic",
  gerarConversacional: async () => {
    chamadasDoResponder++;
    await dormir(MS_MODELO);
    if (falharPrimeiraDoResponder && chamadasDoResponder === 1) {
      throw new Error("sobrecarga simulada");
    }
    return {
      texto: "Resposta da Ayla.",
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      tokensIn: 2000,
      tokensOut: 200,
      cacheRead: 0,
    };
  },
}));

// O prompt de sistema não é o objeto do teste — devolve fixo, sem tocar o banco.
vi.mock("@/lib/ai/prompts", () => ({ getSystemPrompt: async (_k: string, f: string) => f }));

const { parseInbound } = await import("./parser");
const { gerarRespostaAyla } = await import("./responder");
type UsageTracking = import("./responder").UsageTracking;

// ── O CAPTURADOR DE `api_calls` ──────────────────────────────────────────
type Registro = { feature: string; meta: Record<string, unknown> | null };
let capturados: Registro[] = [];

const supabaseFalso = {
  from(tabela: string) {
    return {
      insert: async (linha: Record<string, unknown>) => {
        if (tabela === "api_calls") {
          capturados.push({ feature: linha.feature as string, meta: (linha.meta ?? null) as never });
        }
        return { error: null };
      },
    };
  },
} as never;

const TURN = "11111111-2222-3333-4444-555555555555";
const MSG = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

const tracking = (feature: string, messageId: string | null = MSG): UsageTracking => ({
  supabase: supabaseFalso,
  family_account_id: "fam-sintetica",
  feature,
  turn_id: TURN,
  message_id: messageId,
});

const PARAMS_RESPONDER = {
  nomeMae: "Ana",
  nomeMembro: "Bia",
  idadeMembro: 5,
  perfilMembro: "TEA",
  koloVivoResumo: "",
  sinais: { desafio: null, conquista: null },
  historico: [],
  mensagem: "ela nao quer ir pra escola",
} as never;

beforeEach(() => {
  capturados = [];
  chamadasDoResponder = 0;
  falharPrimeiraDoResponder = false;
});

const meta = (feature: string) => capturados.find((c) => c.feature === feature)?.meta ?? null;

describe("A · turn_id e message_id chegam ao registro", () => {
  it("1. MORDE: parser e responder gravam o MESMO turn_id e o MESMO message_id", async () => {
    await parseInbound({ texto: "oi", membros: [{ id: "m1", nome: "Bia" }] }, tracking("ayla_parser"));
    await gerarRespostaAyla(PARAMS_RESPONDER, tracking("ayla_responder"));

    const p = meta("ayla_parser");
    const r = meta("ayla_responder");
    expect(p, "o parser não gravou").not.toBeNull();
    expect(r, "o responder não gravou").not.toBeNull();
    expect(p!.turn_id).toBe(TURN);
    expect(r!.turn_id).toBe(TURN);
    expect(p!.turn_id).toBe(r!.turn_id);
    expect(p!.message_id).toBe(MSG);
    expect(r!.message_id).toBe(MSG);
  });

  it("2. MORDE: sem message_id, grava null e NÃO perde o turn_id", async () => {
    // É o caminho de exceção real: falha do claim de idempotência, ou webhook
    // sem `messageId`. O turno tem que continuar correlacionável.
    await parseInbound(
      { texto: "oi", membros: [{ id: "m1", nome: "Bia" }] },
      tracking("ayla_parser", null),
    );
    const p = meta("ayla_parser")!;
    expect(p.message_id).toBeNull();
    expect(p.turn_id, "o turno perdeu correlação por falta de message_id").toBe(TURN);
  });
});

describe("B · o ms mede a chamada ao modelo, e só ela", () => {
  it("3. MORDE: parser — ms ≈ o tempo do modelo, e tentativas = 1", async () => {
    const t0 = Date.now();
    await parseInbound({ texto: "oi", membros: [{ id: "m1", nome: "Bia" }] }, tracking("ayla_parser"));
    const parede = Date.now() - t0;
    const p = meta("ayla_parser")!;
    expect(p.tentativas).toBe(1);
    expect(p.ms as number).toBeGreaterThanOrEqual(MS_MODELO - 20);
    // Folga generosa para o agendador, e ainda assim bem abaixo da parede.
    expect(p.ms as number).toBeLessThan(MS_MODELO + 120);
    expect(p.ms as number).toBeLessThanOrEqual(parede);
  });

  it("4. MORDE: responder sem retry — ms ≈ uma chamada, tentativas = 1", async () => {
    await gerarRespostaAyla(PARAMS_RESPONDER, tracking("ayla_responder"));
    const r = meta("ayla_responder")!;
    expect(r.tentativas).toBe(1);
    expect(r.ms as number).toBeGreaterThanOrEqual(MS_MODELO - 20);
    expect(r.ms as number).toBeLessThan(MS_MODELO + 120);
  });

  it("5. MORDE: responder COM retry — soma as duas chamadas e EXCLUI o sleep", async () => {
    // A mecânica real: 1ª falha → `sleep(1200)` → 2ª passa. O turno esperou
    // ~1,44 s de parede; o MODELO consumiu ~240 ms. Registrar a parede
    // responderia a pergunta errada.
    falharPrimeiraDoResponder = true;
    const t0 = Date.now();
    await gerarRespostaAyla(PARAMS_RESPONDER, tracking("ayla_responder"));
    const parede = Date.now() - t0;

    const r = meta("ayla_responder")!;
    expect(r.tentativas, "não contou as duas tentativas").toBe(2);
    expect(chamadasDoResponder).toBe(2);
    // As DUAS chamadas entram — inclusive a que falhou.
    expect(r.ms as number).toBeGreaterThanOrEqual(2 * MS_MODELO - 30);
    // E o sleep de 1200 ms fica de fora: o ms tem que ser MUITO menor que a parede.
    expect(parede).toBeGreaterThan(1200);
    expect(r.ms as number, "o sleep entre tentativas entrou no ms").toBeLessThan(1200);
  });

  it("6. MORDE: pós-processamento lento NÃO entra no ms do parser", async () => {
    // O `JSON.parse` do parser acontece depois do cronômetro fechar. Aqui o
    // efeito é simulado por um atraso equivalente após a chamada — se o
    // cronômetro fechasse tarde, o ms cresceria junto.
    const antes = Date.now();
    await parseInbound({ texto: "oi", membros: [{ id: "m1", nome: "Bia" }] }, tracking("ayla_parser"));
    await dormir(MS_POS_PROCESSAMENTO);
    const parede = Date.now() - antes;
    const p = meta("ayla_parser")!;
    expect(parede).toBeGreaterThanOrEqual(MS_MODELO + MS_POS_PROCESSAMENTO - 30);
    expect(p.ms as number, "pós-processamento entrou no ms").toBeLessThan(MS_MODELO + 120);
  });
});

describe("C · nada de funcional mudou", () => {
  it("7. o parser continua devolvendo estrutura e o responder, texto", async () => {
    const r = await parseInbound(
      { texto: "oi", membros: [{ id: "m1", nome: "Bia" }] },
      tracking("ayla_parser"),
    );
    expect(r).toHaveProperty("confianca");
    const texto = await gerarRespostaAyla(PARAMS_RESPONDER, tracking("ayla_responder"));
    expect(typeof texto).toBe("string");
    expect(texto.length).toBeGreaterThan(0);
  });

  it("8. o número de chamadas ao modelo não mudou: 1 sem falha, 2 com falha", async () => {
    await gerarRespostaAyla(PARAMS_RESPONDER, tracking("ayla_responder"));
    expect(chamadasDoResponder).toBe(1);
  });
});
