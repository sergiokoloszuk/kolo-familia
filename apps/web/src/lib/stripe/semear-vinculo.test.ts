import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O STRIPE É A AUTORIDADE — a passada que fecha "pagou e ficou sem acesso"
 * para quem paga pela PRIMEIRA vez. 27/08/2026.
 *
 * ⚠️ O DEFEITO. A reconciliação varria `subscription_accesses` filtrando por
 * `stripe_customer_id`/`stripe_subscription_id` — dois campos que **só o
 * webhook escreve**. Quem nunca pagou antes não tem nenhum dos dois, então uma
 * primeira assinatura com webhook falho ficava invisível para a única rede que
 * existia para salvá-la. MEDI em 27/08: 2 de 237 linhas tinham vínculo.
 */

const SRC = readFileSync(join(process.cwd(), "src/lib/stripe/reconciliacao.ts"), "utf8");

vi.mock("./client", () => ({
  getStripeClient: () => ({
    subscriptions: {
      list: async () => ({
        data: [
          { id: "sub_paga", status: "active", customer: "cus_1", metadata: { family_account_id: "fam-sem-vinculo" } },
          { id: "sub_ok", status: "active", customer: "cus_2", metadata: { family_account_id: "fam-ja-liberada" } },
          { id: "sub_orfa", status: "active", customer: "cus_3", metadata: {} },
          { id: "sub_incompleta", status: "incomplete", customer: "cus_4", metadata: { family_account_id: "fam-comprando" } },
        ],
      }),
    },
  }),
}));

const eventos: Record<string, unknown>[] = [];
vi.mock("@/lib/log", () => ({
  logEvent: async (e: Record<string, unknown>) => { eventos.push(e); },
}));

/** Banco falso: uma família sem acesso e sem vínculo, outra já liberada. */
function banco() {
  const linhas: Record<string, Record<string, unknown>> = {
    "fam-sem-vinculo": { family_account_id: "fam-sem-vinculo", status: "trialing", trial_ends_at: "2020-01-01T00:00:00Z", cortesia: false, cortesia_ate: null, pagamento_falhou_em: null, stripe_customer_id: null, stripe_subscription_id: null },
    "fam-ja-liberada": { family_account_id: "fam-ja-liberada", status: "active", trial_ends_at: null, cortesia: false, cortesia_ate: null, pagamento_falhou_em: null, stripe_customer_id: "cus_2", stripe_subscription_id: "sub_ok" },
    "fam-comprando": { family_account_id: "fam-comprando", status: "trialing", trial_ends_at: "2020-01-01T00:00:00Z", cortesia: false, cortesia_ate: null, pagamento_falhou_em: null, stripe_customer_id: null, stripe_subscription_id: null },
  };
  return {
    linhas,
    from() {
      return {
        select() {
          return { eq(_c: string, id: string) { return { maybeSingle: async () => ({ data: linhas[id] ?? null, error: null }) }; } };
        },
        update(patch: Record<string, unknown>) {
          return { eq: async (_c: string, id: string) => { if (linhas[id]) Object.assign(linhas[id], patch); return { error: null }; } };
        },
      };
    },
  };
}

afterEach(() => { eventos.length = 0; });

describe("a passada Stripe → Kolo", () => {
  it("1. MORDE: semeia o vínculo de quem pagou e a Kolo não conhecia", async () => {
    const { semearVinculosDoStripe } = await import("./reconciliacao");
    const b = banco();
    const r = await semearVinculosDoStripe(b as never);
    expect(r.semeadas).toBe(1);
    expect(b.linhas["fam-sem-vinculo"].stripe_subscription_id).toBe("sub_paga");
    expect(b.linhas["fam-sem-vinculo"].stripe_customer_id).toBe("cus_1");
  });

  it("2. MORDE: NÃO decide acesso — só semeia o vínculo", async () => {
    // Quem concede continua sendo `sincronizarAssinaturaDoStripe`, que divide a
    // regra de autoridade com o webhook. Duas políticas sempre divergem.
    const { semearVinculosDoStripe } = await import("./reconciliacao");
    const b = banco();
    await semearVinculosDoStripe(b as never);
    expect(b.linhas["fam-sem-vinculo"].status).toBe("trialing");
  });

  it("3. MORDE: `incomplete` não semeia — chega em todo checkout", async () => {
    const { semearVinculosDoStripe } = await import("./reconciliacao");
    const b = banco();
    const r = await semearVinculosDoStripe(b as never);
    // As três `active` (paga, já liberada, órfã) entram; a `incomplete` não.
    expect(r.examinadas).toBe(3);
    expect(b.linhas["fam-comprando"].stripe_subscription_id).toBeNull();
  });

  it("4. não toca em quem já tem acesso", async () => {
    const { semearVinculosDoStripe } = await import("./reconciliacao");
    const b = banco();
    const antes = { ...b.linhas["fam-ja-liberada"] };
    await semearVinculosDoStripe(b as never);
    expect(b.linhas["fam-ja-liberada"]).toEqual(antes);
  });

  it("5. MORDE: assinatura sem metadata vira ALERTA, não correção", async () => {
    // Inventar um dono para um pagamento órfão é pior que não corrigir.
    const { semearVinculosDoStripe } = await import("./reconciliacao");
    const r = await semearVinculosDoStripe(banco() as never);
    expect(r.semMetadata).toBe(1);
    const alerta = eventos.find((e) => (e.payload as Record<string, unknown>)?.resultado === "sem_metadata");
    expect(alerta).toBeTruthy();
    expect(alerta?.severity).toBe("error");
  });

  it("6. MORDE: falha do Stripe não derruba a reconciliação", async () => {
    // Uma proteção nova não pode quebrar a proteção que já existia.
    vi.resetModules();
    vi.doMock("./client", () => ({ getStripeClient: () => { throw new Error("stripe fora do ar"); } }));
    const { semearVinculosDoStripe } = await import("./reconciliacao");
    const r = await semearVinculosDoStripe(banco() as never);
    expect(r.semeadas).toBe(0);
    vi.doUnmock("./client");
    vi.resetModules();
  });

  it("7. MORDE: a passada é CHAMADA, e antes dos filtros da varredura", () => {
    // ⚠️ Este teste já nasceu fraco uma vez: procurava só o NOME
    // `semearVinculosDoStripe`, e o nome aparece no comentário logo acima da
    // chamada. Removi a chamada e o teste passou. Agora ele casa com a
    // CHAMADA (`await semear…(admin)`), com o comentário removido antes —
    // senão a prova de mutação é falsa.
    const i = SRC.indexOf("export async function reconciliarDivergencias");
    const corpo = SRC.slice(i, i + 1600).replace(/\/\/[^\n]*/g, "");
    const chamada = /await\s+semearVinculosDoStripe\s*\(\s*admin\s*\)/;
    expect(corpo).toMatch(chamada);
    expect(corpo.search(chamada)).toBeLessThan(corpo.indexOf("stripe_customer_id.not.is.null"));
  });
});
