import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  checarLimiteDeCriancas,
  MSG_LIMITE_CRIANCAS,
  LIMITE_CRIANCAS_NAO_ADMIN,
} from "./limite-criancas";

/**
 * UMA CRIANÇA POR FAMÍLIA (não-admin) — regra de produto de 08/08/2026.
 *
 * A regra existia como intenção desde o plano de segmentação e nunca tinha sido
 * construída: duas famílias não-admin já tinham duas crianças, cadastradas sem
 * nenhum obstáculo.
 */

/**
 * Supabase de mentira, só com o que a regra usa. A cadeia inteira é "awaitable"
 * (tem `then`), porque é assim que o cliente real funciona: `select().eq().eq()`
 * só resolve quando alguém dá await no fim.
 */
function fakeDb(opts: { membrosAtivos: number; userId?: string | null; adminAtivo?: boolean }) {
  const from = (tabela: string) => {
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.eq = () => chain;
    chain.maybeSingle = () =>
      Promise.resolve({
        data:
          tabela === "family_accounts"
            ? opts.userId === null
              ? null
              : { user_id: opts.userId ?? "u1" }
            : opts.adminAtivo === undefined
              ? null
              : { ativo: opts.adminAtivo },
      });
    chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve({ count: opts.membrosAtivos }).then(res, rej);
    return chain;
  };
  return { from } as never;
}

describe("limite de crianças", () => {
  it("o limite para não-admin é 1", () => {
    expect(LIMITE_CRIANCAS_NAO_ADMIN).toBe(1);
  });

  it("não-admin SEM criança pode cadastrar a primeira", async () => {
    const r = await checarLimiteDeCriancas(fakeDb({ membrosAtivos: 0, adminAtivo: undefined }), {
      familyId: "f1",
      novos: 1,
    });
    expect(r.ok).toBe(true);
  });

  it("não-admin COM uma criança é BLOQUEADO na segunda", async () => {
    const r = await checarLimiteDeCriancas(fakeDb({ membrosAtivos: 1, adminAtivo: undefined }), {
      familyId: "f1",
      novos: 1,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.mensagem).toBe(MSG_LIMITE_CRIANCAS);
  });

  it("não-admin é bloqueado ao mandar DUAS de uma vez (o formulário manda array)", async () => {
    const r = await checarLimiteDeCriancas(fakeDb({ membrosAtivos: 0, adminAtivo: undefined }), {
      familyId: "f1",
      novos: 2,
    });
    expect(r.ok).toBe(false);
  });

  it("ADMIN cria a segunda normalmente", async () => {
    const r = await checarLimiteDeCriancas(fakeDb({ membrosAtivos: 1, adminAtivo: true }), {
      familyId: "f1",
      novos: 1,
    });
    expect(r.ok).toBe(true);
  });

  it("admin DESATIVADO não vale como admin", async () => {
    const r = await checarLimiteDeCriancas(fakeDb({ membrosAtivos: 1, adminAtivo: false }), {
      familyId: "f1",
      novos: 1,
    });
    expect(r.ok).toBe(false);
  });

  it("família sem user_id não vira admin por acidente", async () => {
    const r = await checarLimiteDeCriancas(fakeDb({ membrosAtivos: 1, userId: null }), {
      familyId: "f1",
      novos: 1,
    });
    expect(r.ok).toBe(false);
  });

  it("quem JÁ tem duas não é afetado — a trava só olha criação nova", async () => {
    // Nenhuma criação pedida: passa direto, sem nem consultar o banco.
    const r = await checarLimiteDeCriancas(fakeDb({ membrosAtivos: 2 }), { familyId: "f1", novos: 0 });
    expect(r.ok).toBe(true);
  });
});

/**
 * A trava tem que estar em TODO caminho de criação — e no servidor. Se alguém
 * abrir uma rota nova de cadastro, este teste é o que avisa.
 */
describe("cobertura dos caminhos de criação", () => {
  const ONB = readFileSync(new URL("../../app/onboarding/actions.ts", import.meta.url), "utf8");
  const CONV = readFileSync(new URL("../onboarding/salvar-conversacional.ts", import.meta.url), "utf8");
  const TESTE = readFileSync(new URL("../../app/admin/teste/actions.ts", import.meta.url), "utf8");

  it("onboarding clássico checa ANTES do insert", () => {
    expect(ONB).toMatch(/checarLimiteDeCriancas\(supabase, \{[\s\S]{0,80}familyId: family\.id/);
    expect(ONB.indexOf("checarLimiteDeCriancas")).toBeLessThan(
      ONB.indexOf('.from("membros_atipicos")\n      .insert'),
    );
  });

  it("onboarding conversacional checa antes do insert", () => {
    expect(CONV).toMatch(/checarLimiteDeCriancas\(admin, \{ familyId, novos: 1 \}\)/);
  });

  it("a fixture de teste com 2 irmãos continua existindo, e é gateada por admin", () => {
    // É a única forma de testar isolamento entre irmãos. Fica isenta DE PROPÓSITO,
    // e a isenção só vale porque a rota inteira exige admin.
    expect(TESTE).toMatch(/requireAdmin\(\)/);
    expect(TESTE).toMatch(/nome: "Lucas"[\s\S]{0,200}nome: "Sofia"/);
  });

  it("a regra lê admin do BANCO, não da sessão — vale pra qualquer chamador", () => {
    const SRC = readFileSync(new URL("./limite-criancas.ts", import.meta.url), "utf8");
    expect(SRC).toMatch(/from\("controle_acessos"\)/);
    expect(SRC).not.toMatch(/ehAdmin\(\)|requireAdmin\(\)|cookies\(\)/);
  });

  it("conta só membro ATIVO", () => {
    const SRC = readFileSync(new URL("./limite-criancas.ts", import.meta.url), "utf8");
    expect(SRC).toMatch(/\.eq\("ativo", true\)/);
  });
});
