import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { acessoLiberado, ehStaffPorUserId, familiasDeStaff } from "./acesso";

/**
 * OS CINCO PORTÕES PRECISAM RESPONDER A MESMA COISA — incidente da Rosangela,
 * 10/08/2026.
 *
 * A pergunta "esta família pode usar o produto?" estava escrita em cinco
 * lugares. Três isentavam staff, dois não. Os três que isentavam decidem se a
 * Ayla ATENDE quem procurou; os dois que não isentavam decidem se ela PROCURA
 * alguém. Uma operadora com `controle_acessos.ativo` e trial vencido era
 * atendida sempre e procurada nunca — a proativa parou no dia exato do
 * vencimento e nada acusou. Ela só descobriu porque sentiu falta.
 *
 * Estes testes guardam as duas metades: o COMPORTAMENTO da regra (com um
 * cliente falso, em memória) e o CAMINHO (que os cinco portões usam a fonte
 * única).
 */

const src = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

/** Cliente falso: responde o que o teste mandar, sem rede e sem banco. */
function fakeSupabase(dados: {
  familias?: Array<{ id: string; user_id: string | null }>;
  staff?: Array<{ user_id: string; ativo: boolean }>;
  subs?: Array<Record<string, unknown>>;
}) {
  return {
    from(tabela: string) {
      const linhas =
        tabela === "family_accounts"
          ? (dados.familias ?? [])
          : tabela === "controle_acessos"
            ? (dados.staff ?? [])
            : (dados.subs ?? []);
      let filtradas = [...linhas] as Array<Record<string, unknown>>;
      const q = {
        select: () => q,
        eq: (col: string, val: unknown) => {
          filtradas = filtradas.filter((l) => l[col] === val);
          return q;
        },
        in: (col: string, vals: unknown[]) => {
          filtradas = filtradas.filter((l) => vals.includes(l[col]));
          return q;
        },
        maybeSingle: async () => ({ data: filtradas[0] ?? null }),
        then: (res: (v: { data: unknown[] }) => unknown) => res({ data: filtradas }),
      };
      return q;
    },
  } as never;
}

const FAM_STAFF = "11111111-1111-1111-1111-111111111111";
const FAM_COMUM = "22222222-2222-2222-2222-222222222222";
const U_STAFF = "aaaa0000-0000-0000-0000-000000000001";
const U_COMUM = "bbbb0000-0000-0000-0000-000000000002";

const VENCIDO = {
  status: "trialing",
  trial_ends_at: new Date(Date.now() - 10 * 864e5).toISOString(),
  cortesia: false,
  cortesia_ate: null,
  pagamento_falhou_em: null,
};

const base = {
  familias: [
    { id: FAM_STAFF, user_id: U_STAFF },
    { id: FAM_COMUM, user_id: U_COMUM },
  ],
  staff: [{ user_id: U_STAFF, ativo: true }],
  subs: [
    { family_account_id: FAM_STAFF, ...VENCIDO },
    { family_account_id: FAM_COMUM, ...VENCIDO },
  ],
};

describe("o caso da Rosangela, em memória", () => {
  it("1. staff com trial VENCIDO tem acesso", async () => {
    // É o caso exato: operadora, trial vencido há 10 dias, sem cortesia.
    expect(await acessoLiberado(fakeSupabase(base), FAM_STAFF)).toBe(true);
  });

  it("2. MORDE: família comum com trial vencido continua bloqueada", async () => {
    // O conserto não pode virar acesso grátis para quem não é da equipe.
    expect(await acessoLiberado(fakeSupabase(base), FAM_COMUM)).toBe(false);
  });

  it("3. staff DESATIVADO não vale — `ativo` é o que manda", async () => {
    const dados = { ...base, staff: [{ user_id: U_STAFF, ativo: false }] };
    expect(await acessoLiberado(fakeSupabase(dados), FAM_STAFF)).toBe(false);
  });

  it("4. FAIL CLOSED: sem assinatura e sem staff, ninguém entra", async () => {
    const dados = { familias: base.familias, staff: [], subs: [] };
    expect(await acessoLiberado(fakeSupabase(dados), FAM_COMUM)).toBe(false);
    expect(await acessoLiberado(fakeSupabase(dados), FAM_STAFF)).toBe(false);
  });

  it("5. família sem user_id não quebra nem libera", async () => {
    const dados = { ...base, familias: [{ id: FAM_COMUM, user_id: null }] };
    expect(await acessoLiberado(fakeSupabase(dados), FAM_COMUM)).toBe(false);
    expect(await ehStaffPorUserId(fakeSupabase(dados), null)).toBe(false);
    expect(await ehStaffPorUserId(fakeSupabase(dados), undefined)).toBe(false);
  });

  it("6. trial VÁLIDO libera sem precisar ser staff", async () => {
    const valido = {
      family_account_id: FAM_COMUM,
      status: "trialing",
      trial_ends_at: new Date(Date.now() + 3 * 864e5).toISOString(),
      cortesia: false,
      cortesia_ate: null,
      pagamento_falhou_em: null,
    };
    const dados = { ...base, staff: [], subs: [valido] };
    expect(await acessoLiberado(fakeSupabase(dados), FAM_COMUM)).toBe(true);
  });
});

describe("a versão em lote — o cron decide sobre dezenas por ciclo", () => {
  it("7. devolve só as famílias de staff ATIVO", async () => {
    const s = await familiasDeStaff(fakeSupabase(base), [FAM_STAFF, FAM_COMUM]);
    expect(s.has(FAM_STAFF)).toBe(true);
    expect(s.has(FAM_COMUM)).toBe(false);
  });

  it("8. lista vazia não consulta nada", async () => {
    expect((await familiasDeStaff(fakeSupabase(base), [])).size).toBe(0);
  });

  it("9. MORDE: staff inativo não entra no lote", async () => {
    const dados = { ...base, staff: [{ user_id: U_STAFF, ativo: false }] };
    expect((await familiasDeStaff(fakeSupabase(dados), [FAM_STAFF])).size).toBe(0);
  });
});

describe("os cinco portões usam a fonte única", () => {
  it("10. MORDE: os dois que faltavam agora conhecem staff", async () => {
    // São exatamente os dois que decidem se a Ayla PROCURA alguém. Se um deles
    // voltar a chamar `assinaturaLiberada` sozinho, a fresta reabre.
    // ⚠️ NÃO BASTA CHAMAR — tem que USAR o resultado. A primeira versão deste
    // teste só exigia a chamada, e uma sabotagem real (10/08/2026) removeu o
    // `staff.has(id)` do filtro deixando a chamada de pé: o portão voltou a
    // ignorar staff e o teste passou. Chamar e descartar é o modo de falha.
    const cron = src("../app/api/ayla/cron/route.ts");
    expect(cron).toMatch(/familiasDeStaff\(supabase, ids\)/);
    expect(cron).toMatch(/ids\.filter\(\(id\) => staff\.has\(id\) \|\| liberadas\.has\(id\)\)/);

    const rules = src("ayla/rules.ts");
    expect(rules).toMatch(/familiaEhDeStaff\(supabase, ctx\.family_account_id\)/);
    // O `if (!ehStaff)` é o que faz a isenção valer; sem ele a consulta é ornamento.
    expect(rules).toMatch(/if \(!ehStaff\) \{/);
  });

  it("11. MORDE: os três que já isentavam continuam isentando", async () => {
    expect(src("ayla/orchestrator.ts")).toMatch(/acessoLiberado\(supabase, familyId\)/);
    expect(src("auth/require-active-write.ts")).toMatch(/ehStaffPorUserId\(supabase, user\?\.id\)/);
    // O layout do app tem a forma dele (isAdmin/isAnalista já resolvidos ali).
    expect(src("../app/(app)/layout.tsx")).toMatch(/!isAdmin && !isAnalista/);
  });

  it("12. MORDE: a reconciliação do Stripe NÃO pode isentar staff", async () => {
    // Ela pergunta "o Stripe e a Kolo divergem?", não "esta pessoa pode usar?".
    // Isentar staff ali cegaria o mecanismo que precisa enxergar todo mundo.
    const rec = src("stripe/reconciliacao.ts");
    expect(rec).toMatch(/assinaturaLiberada\(/);
    expect(rec).not.toMatch(/acessoLiberado|familiaEhDeStaff|familiasDeStaff/);
  });

  it("13. MORDE: `assinaturaLiberada` continua pura, sem banco", async () => {
    // A regra de assinatura não pode ganhar dependência de IO — é ela que os
    // testes de trial/dunning exercitam sem subir nada.
    const a = src("auth/assinatura.ts");
    expect(a).not.toMatch(/supabase|SupabaseClient|from\(["']/);
  });

  it("14. MORDE: o comercial continua FORA de REQUER_ACESSO", async () => {
    // Isentar staff no engajamento não pode virar convite de assinatura para a
    // equipe. O comercial fica de fora da lista de propósito — é o convite a
    // voltar, e precisa alcançar justamente quem perdeu o acesso.
    const r = src("ayla/rules.ts");
    const i = r.indexOf("const REQUER_ACESSO");
    expect(i).toBeGreaterThan(-1);
    const lista = r.slice(i, r.indexOf("] as const", i));
    expect(lista).not.toMatch(/assinatura_nudge|trial_d3|trial_d0|comercial/);
    expect(lista).toMatch(/"rotina"/);
  });
});
