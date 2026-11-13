import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * ENDURECIMENTO DA AUDITORIA DE 12/11/2026 — provado por comportamento.
 *
 * Cada bloco exercita o handler ou a função de verdade, com o banco simulado.
 * O banco simulado LANÇA quando é tocado onde não deveria: a prova de que uma
 * recusa acontece ANTES de qualquer consulta.
 */

const banco = vi.hoisted(() => ({
  tocado: 0,
  selectAdmins: { data: [] as unknown[] | null, error: null as null | { message: string } },
  inseriu: 0,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => {
    banco.tocado++;
    return {
      from: () => ({
        select: () => ({ eq: () => ({ limit: async () => banco.selectAdmins }) }),
        insert: async () => {
          banco.inseriu++;
          return { error: null };
        },
      }),
    };
  },
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u-qa" } } }) },
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: (d: string) => {
    throw new Error(`NEXT_REDIRECT:${d}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const cabecalhos = vi.hoisted(() => ({ ua: "" }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "user-agent": cabecalhos.ua }),
}));

const CRON_ORIGINAL = process.env.CRON_SECRET;
beforeEach(() => {
  banco.tocado = 0;
  banco.inseriu = 0;
  banco.selectAdmins = { data: [], error: null };
});
afterEach(() => {
  if (CRON_ORIGINAL === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = CRON_ORIGINAL;
});

function req(url: string, auth?: string) {
  return new NextRequest(url, { headers: auth ? { authorization: auth } : {} });
}

describe("cronAutorizado", () => {
  it("sem CRON_SECRET → sem_segredo, mesmo com header", async () => {
    delete process.env.CRON_SECRET;
    const { cronAutorizado } = await import("./segredo");
    expect(cronAutorizado("Bearer qualquer")).toBe("sem_segredo");
    expect(cronAutorizado(null)).toBe("sem_segredo");
  });
  it("segredo certo → ok; errado, vazio ou sem Bearer → negado", async () => {
    process.env.CRON_SECRET = "s3gredo-de-teste";
    const { cronAutorizado } = await import("./segredo");
    expect(cronAutorizado("Bearer s3gredo-de-teste")).toBe("ok");
    expect(cronAutorizado("Bearer outro")).toBe("negado");
    expect(cronAutorizado("s3gredo-de-teste")).toBe("negado");
    expect(cronAutorizado(null)).toBe("negado");
  });
});

describe("crons recusam antes de tocar no banco", () => {
  it("MORDE: /api/ayla/cron sem CRON_SECRET → 503 (antes: rodava para qualquer um)", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("@/app/api/ayla/cron/route");
    const r = await GET(req("https://kolo.test/api/ayla/cron?tipo=comercial"));
    expect(r.status).toBe(503);
    expect(banco.tocado).toBe(0);
  }, 60_000); // a rota importa o orquestrador inteiro
  it("/api/ayla/cron com segredo errado → 401", async () => {
    process.env.CRON_SECRET = "s3gredo-de-teste";
    const { GET } = await import("@/app/api/ayla/cron/route");
    const r = await GET(req("https://kolo.test/api/ayla/cron?tipo=comercial", "Bearer errado"));
    expect(r.status).toBe(401);
    expect(banco.tocado).toBe(0);
  }, 60_000);
  it("MORDE: /api/admin/uso/snapshot sem CRON_SECRET → 503", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("@/app/api/admin/uso/snapshot/route");
    const r = await GET(req("https://kolo.test/api/admin/uso/snapshot"));
    expect(r.status).toBe(503);
    expect(banco.tocado).toBe(0);
  });
  it("/api/admin/uso/snapshot com segredo errado → 401", async () => {
    process.env.CRON_SECRET = "s3gredo-de-teste";
    const { GET } = await import("@/app/api/admin/uso/snapshot/route");
    const r = await GET(req("https://kolo.test/api/admin/uso/snapshot", "Bearer errado"));
    expect(r.status).toBe(401);
    expect(banco.tocado).toBe(0);
  });
});

describe("bootstrap do primeiro admin", () => {
  it("MORDE: erro na consulta NÃO vira 'não existe admin' — nada é inserido", async () => {
    banco.selectAdmins = { data: null, error: { message: "timeout" } };
    const { bootstrapAdmin } = await import("@/app/admin/setup/actions");
    await expect(bootstrapAdmin()).rejects.toThrow(/verificar os admins/);
    expect(banco.inseriu).toBe(0);
  });
  it("já existe admin → bloqueia, nada é inserido", async () => {
    banco.selectAdmins = { data: [{ user_id: "outro" }], error: null };
    const { bootstrapAdmin } = await import("@/app/admin/setup/actions");
    await expect(bootstrapAdmin()).rejects.toThrow(/Já existe um admin/);
    expect(banco.inseriu).toBe(0);
  });
  it("caso legítimo: nenhum admin e consulta OK → cria e redireciona", async () => {
    const { bootstrapAdmin } = await import("@/app/admin/setup/actions");
    await expect(bootstrapAdmin()).rejects.toThrow("NEXT_REDIRECT:/admin");
    expect(banco.inseriu).toBe(1);
  });
});

describe("link fiscal e robôs de prévia", () => {
  const token = "A".repeat(43);
  it("MORDE: prévia do WhatsApp recebe 404 sem consumir o token", async () => {
    cabecalhos.ua = "WhatsApp/2.24.1 A";
    const { default: Pagina } = await import("@/app/fiscal/notas/[token]/page");
    await expect(Pagina({ params: Promise.resolve({ token }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(banco.tocado).toBe(0);
  });
  it("navegador comum segue para a consulta do token", async () => {
    cabecalhos.ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)";
    const { default: Pagina } = await import("@/app/fiscal/notas/[token]/page");
    await Pagina({ params: Promise.resolve({ token }) }).catch(() => undefined);
    expect(banco.tocado).toBe(1);
  });
  it("a página declara noindex e no-referrer", async () => {
    const { metadata } = await import("@/app/fiscal/notas/[token]/page");
    expect(metadata).toMatchObject({ robots: "noindex, nofollow", referrer: "no-referrer" });
  });
});

describe("fallback da Ayla quando o modelo falha", () => {
  const base = {
    nomeMae: "Mãe QA",
    nomeMembro: "Criança QA",
    historico: [],
    sinais: { conquista: null, desafio: null, emocao_mae: null, temSugestaoKoloVivo: false },
  };
  it("MORDE: mensagem de crise recebe o encaminhamento (188/192), não 'me conta mais'", async () => {
    const { fallbackSimples } = await import("@/lib/ayla/responder");
    const t = fallbackSimples({ ...base, mensagem: "penso em me matar" } as never);
    expect(t).toMatch(/188/);
    expect(t).toMatch(/192/);
    expect(t).not.toMatch(/me conta um pouco mais/);
  });
  it("MORDE: estado de segurança aberto também recebe o encaminhamento", async () => {
    const { fallbackSimples } = await import("@/lib/ayla/responder");
    const t = fallbackSimples({ ...base, mensagem: "oi", notaDeSeguranca: "aberto" } as never);
    expect(t).toMatch(/188/);
  });
  it("caso legítimo: mensagem comum continua com o texto de sempre", async () => {
    const { fallbackSimples } = await import("@/lib/ayla/responder");
    const t = fallbackSimples({ ...base, mensagem: "hoje foi um dia bom" } as never);
    expect(t).toBe("Tô por aqui, Mãe QA — me conta um pouco mais?");
  });
});

describe("cabeçalhos de segurança", () => {
  it("toda rota recebe nosniff, frame DENY e frame-ancestors; X-Powered-By desligado", async () => {
    const { default: config } = await import("../../../next.config");
    expect(config.poweredByHeader).toBe(false);
    const regras = await config.headers!();
    const geral = regras.find((r) => r.source === "/:path*")!;
    const chaves = Object.fromEntries(geral.headers.map((h) => [h.key, h.value]));
    expect(chaves).toMatchObject({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": "frame-ancestors 'none'",
    });
  });
  it("fiscal e /r: no-referrer vem DEPOIS da regra geral (a última vence)", async () => {
    const { default: config } = await import("../../../next.config");
    const regras = await config.headers!();
    const iGeral = regras.findIndex((r) => r.source === "/:path*");
    const iToken = regras.findIndex((r) => r.source === "/:area(fiscal|r)/:path*");
    expect(iToken).toBeGreaterThan(iGeral);
    expect(regras[iToken].headers).toContainEqual({ key: "Referrer-Policy", value: "no-referrer" });
  });
});
