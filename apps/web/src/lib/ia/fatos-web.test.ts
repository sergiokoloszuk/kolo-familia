import { describe, it, expect } from "vitest";
import { buildSystemTextConversa } from "./prompt";
import { FATOS_COMERCIAIS, FATOS_COMERCIAIS_SEM_TRIAL } from "@/lib/billing/fatos-comerciais";
import type { SkillRow } from "./router";

/**
 * PEND-257 · o chat da web recebe o MESMO fato comercial do WhatsApp.
 *
 * Até 27/11/2026 o system da web fixava `FATOS_COMERCIAIS` ("o teste grátis é
 * de 7 dias"), e depois da virada a Ayla do app contradiria a jornada sem teste.
 */

const SKILL = {
  id: "s1",
  name: "alimentacao",
  display_name: "Alimentação e seletividade",
  identity_prompt: "Você entende de seletividade alimentar.",
  ativo: true,
} as unknown as SkillRow;

describe("fato comercial no system da web", () => {
  it("sem nada informado, é o de hoje — byte a byte", () => {
    const s = buildSystemTextConversa([SKILL], "duvida", null);
    expect(s).toContain(`# ${FATOS_COMERCIAIS}`);
    expect(s).toBe(buildSystemTextConversa([SKILL], "duvida", null, FATOS_COMERCIAIS));
  });

  it("MORDE: com a virada, some o 'teste grátis é de 7 dias'", () => {
    const s = buildSystemTextConversa([SKILL], "duvida", null, FATOS_COMERCIAIS_SEM_TRIAL);
    expect(s).toContain(`# ${FATOS_COMERCIAIS_SEM_TRIAL}`);
    expect(s).not.toContain("o teste grátis é de");
    expect(s).toContain("Nunca prometa nem ofereça dias grátis");
  });
});
