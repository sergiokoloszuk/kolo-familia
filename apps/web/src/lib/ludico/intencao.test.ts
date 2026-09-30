import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { criarOuReusarIntencaoLudico } from "./intencao";

const FAMILIA = "11111111-1111-4111-8111-111111111111";
const MEMBRO = "22222222-2222-4222-8222-222222222222";
const MENSAGEM = "33333333-3333-4333-8333-333333333333";
const INTENCAO = "44444444-4444-4444-8444-444444444444";

function consulta(resultado: unknown) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(resultado),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  return chain;
}

describe("intenção lúdica idempotente", () => {
  it("recupera a intenção vencedora quando duas tentativas do mesmo inbound colidem", async () => {
    const inicial = consulta({ data: null, error: null });
    const insercao = {
      insert: vi.fn(),
      select: vi.fn(),
      single: vi.fn().mockResolvedValue({ data: null, error: { code: "23505", message: "unique" } }),
    };
    insercao.insert.mockReturnValue(insercao);
    insercao.select.mockReturnValue(insercao);
    const vencedora = consulta({
      data: {
        id: INTENCAO,
        family_account_id: FAMILIA,
        membro_atipico_id: MEMBRO,
        artefato: "historia",
        etapa: "revisar",
        payload: { descricao: "dentista" },
        avatar_id: null,
      },
      error: null,
    });
    const from = vi.fn()
      .mockReturnValueOnce(inicial)
      .mockReturnValueOnce(insercao)
      .mockReturnValueOnce(vencedora);

    const intencao = await criarOuReusarIntencaoLudico(
      { from } as unknown as SupabaseClient,
      {
        familyId: FAMILIA,
        membroId: MEMBRO,
        artefato: "historia",
        sourceMessageId: MENSAGEM,
      },
    );

    expect(intencao?.id).toBe(INTENCAO);
    expect(insercao.insert).toHaveBeenCalledOnce();
    expect(vencedora.eq).toHaveBeenCalledWith("family_account_id", FAMILIA);
  });
});
