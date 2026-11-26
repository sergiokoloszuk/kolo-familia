import { beforeEach, describe, expect, it, vi } from "vitest";
import { iniciarPlanoAction, registrarEventosAction, conversarNoPlanoAction } from "./actions";

const m = vi.hoisted(() => ({ admin: vi.fn(), familia: vi.fn(), ativa: vi.fn(), audit: vi.fn(), iniciar: vi.fn(), membro: vi.fn(), gravar: vi.fn(), ler: vi.fn() }));
vi.mock("@/lib/auth/require-admin", () => ({ requireAdmin: m.admin }));
vi.mock("@/lib/auth/require-user", () => ({ loadFamilyContext: m.familia }));
vi.mock("@/lib/auth/require-active-write", () => ({ requireActiveWrite: m.ativa }));
vi.mock("@/lib/supabase/server", () => ({ createServiceRoleClient: m.audit }));
vi.mock("@/lib/plano-v51/servico", () => ({ iniciarPlano: m.iniciar, membroDoPlano: m.membro }));
vi.mock("@/lib/plano-v51/repositorio", () => ({ gravarEventosPlano: m.gravar, lerPlano: m.ler }));
vi.mock("@/lib/plano-v51/gerador", () => ({ gerarParaPlano: vi.fn() }));
beforeEach(() => { vi.resetAllMocks(); m.admin.mockResolvedValue({}); m.familia.mockResolvedValue({ supabase: {}, family: { id: "familia-da-sessao" } }); m.ativa.mockResolvedValue(undefined); m.audit.mockReturnValue({}); });
describe("Server Actions V5.1 — guardas independentes da interface", () => {
  it.each([iniciarPlanoAction, registrarEventosAction, conversarNoPlanoAction])("recusa sessão sem staff antes de dados/modelo", async executar => {
    m.admin.mockRejectedValue(new Error("negado"));
    const input = { membroId: "72647591-a6c0-44bb-8993-6b38b0801845", mensagens: [], texto: "Olá" };
    await expect(executar(input)).rejects.toThrow(/negado/);
    expect(m.familia).not.toHaveBeenCalled(); expect(m.gravar).not.toHaveBeenCalled(); expect(m.iniciar).not.toHaveBeenCalled(); expect(m.audit).not.toHaveBeenCalled();
  });
  it("usa a família da sessão, ignorando um familyId forjado", async () => {
    await iniciarPlanoAction({ familyId: "outra-familia" });
    expect(m.iniciar.mock.calls[0][2]).toBe("familia-da-sessao");
  });
  it("bloqueia escrita antes de criar cliente privilegiado de telemetria", async () => {
    m.ativa.mockRejectedValue(new Error("assinatura bloqueada"));
    await expect(iniciarPlanoAction({})).rejects.toThrow(/bloqueada/);
    expect(m.audit).not.toHaveBeenCalled(); expect(m.iniciar).not.toHaveBeenCalled();
  });
});
