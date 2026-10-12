import { afterEach, describe, expect, it, vi } from "vitest";
import { logEvent } from "./log";

const inserir = vi.hoisted(() => vi.fn());
vi.mock("./supabase/server", () => ({
  createServiceRoleClient: () => ({ from: () => ({ insert: inserir }) }),
}));

describe("persistência do log operacional", () => {
  afterEach(() => {
    inserir.mockReset();
    vi.restoreAllMocks();
  });

  it("denuncia error devolvido pelo Supabase sem interromper o fluxo", async () => {
    inserir.mockResolvedValue({ error: { code: "23505" } });
    vi.spyOn(console, "log").mockImplementation(() => {});
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(logEvent({ kind: "teste_g0", persistir: true })).resolves.toBeUndefined();

    expect(inserir).toHaveBeenCalledOnce();
    expect(erro).toHaveBeenCalledWith(expect.stringContaining('"kind":"log_persist_failed"'));
    expect(erro.mock.calls[0][0]).not.toContain("texto de família");
  });
});
