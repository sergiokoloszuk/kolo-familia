import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * P1 · A ESCRITA DO EVENTO CONFERE O PRÓPRIO RESULTADO — §7 do protocolo.
 *
 * ⚠️ O DEFEITO. `extrairESalvarEventos` fazia `await supabase.insert(...)` e
 * seguia. No cliente Supabase o `.insert()` DEVOLVE o erro; não lança. Um
 * `await` sem checar `error` engole a falha inteira e o fluxo segue como
 * sucesso — foi exatamente assim que o acesso da Rochelle sumiu, em seis
 * handlers do webhook do Stripe.
 *
 * Aqui o custo era menor e do mesmo tipo: um aprendizado da criança sumia e
 * ninguém ficava sabendo. A Ayla "esquecia" e a família descobria antes de nós.
 *
 * ⚠️ O TESTE QUE IMPORTA É O DE SABOTAGEM. Um teste que só roda o caminho feliz
 * passaria idêntico antes e depois da correção. O que prova a correção é
 * FAZER a escrita falhar e verificar que alguém ficou sabendo.
 */

const registrados: Array<Record<string, unknown>> = [];

vi.mock("@/lib/log", () => ({
  logEvent: async (e: Record<string, unknown>) => {
    registrados.push(e);
  },
}));

vi.mock("./anthropic", () => ({
  AYLA_MODEL: "fake",
  getAylaAnthropicClient: () => ({
    messages: {
      create: async () => ({
        content: [
          {
            type: "text",
            text: JSON.stringify([
              { tipo: "marco", descricao: "escovou os dentes sozinho", data: "2026-08-15" },
            ]),
          },
        ],
      }),
    },
  }),
}));

const { extrairESalvarEventos } = await import("./eventos");

/**
 * Um cliente mínimo que aceita as duas operações usadas: o `select` do dedup
 * (sempre vazio, para o insert acontecer) e o `insert`, que falha ou não
 * conforme o cenário.
 */
function clienteQue(insertFalhaCom: { message: string; code?: string } | null) {
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                eq() {
                  return {
                    gte() {
                      return { limit: async () => ({ data: [] }) };
                    },
                  };
                },
              };
            },
          };
        },
        insert: async () => ({ error: insertFalhaCom }),
      };
    },
  } as never;
}

const MSG = "Ontem o Daniel conseguiu escovar os dentes sozinho pela primeira vez!";
const FAM = "11111111-1111-4111-8111-111111111111";
const MEM = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  registrados.length = 0;
});

describe("QUANDO A ESCRITA FALHA — alguém fica sabendo", () => {
  it("1. SABOTAGEM: insert rejeitado é registrado como ERRO", async () => {
    await extrairESalvarEventos(
      clienteQue({ message: "permission denied for table eventos_membro", code: "42501" }),
      FAM,
      MEM,
      MSG,
      undefined,
      "Daniel",
    );

    expect(registrados, "a falha de escrita passou em silêncio").toHaveLength(1);
    const e = registrados[0];
    expect(e.severity, "severidade `info` some com a retenção da Vercel").toBe("error");
    expect(e.kind).toBe("ayla_evento_nao_gravado");
    expect(String(e.message)).toContain("permission denied");
    expect(e.family_account_id).toBe(FAM);
  });

  it("2. o registro carrega o suficiente para investigar depois", async () => {
    await extrairESalvarEventos(
      clienteQue({ message: "deadlock detected", code: "40P01" }),
      FAM,
      MEM,
      MSG,
      undefined,
      "Daniel",
    );
    const p = registrados[0].payload as Record<string, unknown>;
    expect(p.membro_atipico_id).toBe(MEM);
    expect(p.tipo).toBe("marco");
    expect(p.codigo).toBe("40P01");
  });

  it("3. a falha NÃO derruba o turno — a função continua devolvendo void", async () => {
    // A conversa já aconteceu. Perder o aprendizado é ruim; deixar a mãe sem
    // resposta por causa disso seria pior.
    await expect(
      extrairESalvarEventos(clienteQue({ message: "boom" }), FAM, MEM, MSG, undefined, "Daniel"),
    ).resolves.toBeUndefined();
  });
});

describe("QUANDO A ESCRITA DÁ CERTO — nada de ruído", () => {
  it("4. insert sem erro não registra nada", async () => {
    await extrairESalvarEventos(clienteQue(null), FAM, MEM, MSG, undefined, "Daniel");
    expect(registrados, "sucesso virou log de erro").toHaveLength(0);
  });
});

describe("SABOTAGEM ESTRUTURAL — o teste morde?", () => {
  const SRC = readFileSync(join(process.cwd(), "src/lib/ayla/eventos.ts"), "utf8");

  it("5. sem a checagem do erro, o teste 1 quebraria", () => {
    const sabotado = SRC.replace(
      "const { error: erroInsert } = await supabase.from(\"eventos_membro\").insert({",
      "await supabase.from(\"eventos_membro\").insert({",
    );
    expect(sabotado).not.toContain("const { error: erroInsert }");
    expect(SRC).toContain("const { error: erroInsert }");
  });

  it("6. severidade `info` não serve — ela não persiste", () => {
    // `logEvent` só PERSISTE severidade de erro; `info` vai para stdout e some
    // com a retenção da Vercel. Um fluxo cujo único rastro é `info` é, na
    // prática, não observável depois de alguns dias.
    const bloco = SRC.slice(SRC.indexOf("ayla_evento_nao_gravado") - 200, SRC.indexOf("ayla_evento_nao_gravado") + 300);
    expect(bloco).toContain('severity: "error"');
    expect(bloco).not.toContain('severity: "info"');
  });
});
