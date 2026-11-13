import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A GUARDA DOS DASHBOARDS, PROVADA POR COMPORTAMENTO — 12/11/2026.
 *
 * Em produção, `/dashboards/crm` respondia sem login com 89 e-mails no HTML:
 * o `redirect` do layout não impede a página (layout e página renderizam em
 * paralelo). Estes testes provam duas coisas: a guarda recusa quem não tem
 * acesso (inclusive quando a consulta falha) e a página do CRM não chega a
 * consultar o banco quando a guarda recusa.
 */

class Redirecionou extends Error {
  constructor(public destino: string) {
    super(`NEXT_REDIRECT:${destino}`);
  }
}

const estado = {
  usuario: null as null | { id: string; email: string | null },
  acesso: { data: null as null | { ativo: boolean }, error: null as null | { message: string } },
  coAcesso: { data: [] as Array<{ id: string }> | null, error: null as null | { message: string } },
};
const carregarRadarCrm = vi.fn(async () => ({ leads: [], porFase: {} }));
const serviceRoleCriado = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Redirecionou(destino);
  },
}));

vi.mock("@/lib/auth/require-user", () => ({
  requireUser: async () => {
    if (!estado.usuario) throw new Redirecionou("/login");
    return {
      user: estado.usuario,
      supabase: {
        from: () => ({
          select: () => ({ eq: () => ({ maybeSingle: async () => estado.acesso }) }),
        }),
      },
    };
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => {
    serviceRoleCriado();
    return {
      from: () => ({
        select: () => ({
          eq: () => ({ or: () => ({ limit: async () => estado.coAcesso }) }),
        }),
      }),
    };
  },
}));

vi.mock("@/lib/crm/radar", () => ({ carregarRadarCrm }));

beforeEach(() => {
  estado.usuario = { id: "00000000-0000-0000-0000-00000000000a", email: "qa@exemplo.test" };
  estado.acesso = { data: null, error: null };
  estado.coAcesso = { data: [], error: null };
  carregarRadarCrm.mockClear();
  serviceRoleCriado.mockClear();
});

describe("requireDashboard", () => {
  it("sem login → /login", async () => {
    estado.usuario = null;
    const { requireDashboard } = await import("./require-dashboard");
    await expect(requireDashboard()).rejects.toMatchObject({ destino: "/login" });
  });

  it("logado sem admin e sem co-acesso → /painel", async () => {
    const { requireDashboard } = await import("./require-dashboard");
    await expect(requireDashboard()).rejects.toMatchObject({ destino: "/painel" });
  });

  it("admin ativo entra", async () => {
    estado.acesso = { data: { ativo: true }, error: null };
    const { requireDashboard } = await import("./require-dashboard");
    await expect(requireDashboard()).resolves.toMatchObject({ isAdmin: true });
  });

  it("co-acesso ativo da equipe de tráfego entra, sem ser admin", async () => {
    estado.coAcesso = { data: [{ id: "x" }], error: null };
    const { requireDashboard } = await import("./require-dashboard");
    await expect(requireDashboard()).resolves.toMatchObject({ isAdmin: false });
  });

  it("MORDE: erro nas consultas fecha o acesso, mesmo com linha devolvida", async () => {
    estado.acesso = { data: { ativo: true }, error: { message: "falha" } };
    estado.coAcesso = { data: [{ id: "x" }], error: { message: "falha" } };
    const { requireDashboard } = await import("./require-dashboard");
    await expect(requireDashboard()).rejects.toMatchObject({ destino: "/painel" });
  });
});

describe("página do CRM sem acesso", () => {
  it("MORDE: não consulta o radar quando a guarda recusa (sem login)", async () => {
    estado.usuario = null;
    const { default: CrmPage } = await import("@/app/(app)/dashboards/crm/page");
    await expect(
      CrmPage({ searchParams: Promise.resolve({}) } as Parameters<typeof CrmPage>[0]),
    ).rejects.toMatchObject({ destino: "/login" });
    expect(carregarRadarCrm).not.toHaveBeenCalled();
  });

  it("MORDE: não consulta o radar quando a guarda recusa (logado sem acesso)", async () => {
    const { default: CrmPage } = await import("@/app/(app)/dashboards/crm/page");
    await expect(
      CrmPage({ searchParams: Promise.resolve({}) } as Parameters<typeof CrmPage>[0]),
    ).rejects.toMatchObject({ destino: "/painel" });
    expect(carregarRadarCrm).not.toHaveBeenCalled();
  });
});
