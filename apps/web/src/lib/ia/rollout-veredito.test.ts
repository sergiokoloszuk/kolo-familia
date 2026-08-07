import { describe, it, expect } from "vitest";
// @ts-expect-error — módulo de bancada em .mjs, fora do build do app.
import { ehConversacional, agruparPorFamilia, veredito } from "../../../../../scripts/bancada/migracao/rollout-veredito.mjs";

/**
 * O VERIFICADOR DE ROLLOUT não pode gritar vazamento por causa de áudio.
 *
 * Em 07/08/2026 eu contei `provider === "openai"` sem olhar a `feature` e
 * anunciei vazamento do GPT. Eram linhas `ayla_audio` no `whisper-1`:
 * transcrição, que sempre foi OpenAI. O alarme falso quase custou um rollback
 * de produção que não era necessário.
 *
 * Vazamento é sobre a CONVERSA. Estes testes fixam essa fronteira.
 */

const AUT = "aaaaaaaa-0000-0000-0000-000000000001";
const AUT2 = "aaaaaaaa-0000-0000-0000-000000000002";
const FORA = "bbbbbbbb-0000-0000-0000-000000000001";
const autorizadas = new Set([AUT, AUT2]);

const chamada = (family_account_id: string, provider: string, feature: string, model = "m") => ({
  family_account_id,
  provider,
  feature,
  model,
  custo_usd: 0.01,
});

describe("o que conta como camada conversacional", () => {
  it("WhatsApp e web contam", () => {
    expect(ehConversacional("ayla_responder")).toBe(true);
    expect(ehConversacional("conversa_web")).toBe(true);
  });

  it("áudio, visão e o resto NÃO contam", () => {
    for (const f of ["ayla_audio", "ayla_visao", "plano_pdf", "onboarding", undefined])
      expect(ehConversacional(f)).toBe(false);
  });
});

describe("os seis casos do verificador", () => {
  it("1. autorizada no GPT conversando = correto, sem vazamento", () => {
    const g = agruparPorFamilia([chamada(AUT, "openai", "ayla_responder")]);
    const v = veredito(g, autorizadas);
    expect(v.vazamentos).toHaveLength(0);
    expect(v.naoChegou).toHaveLength(0);
  });

  it("2. NÃO-autorizada no GPT conversando = VAZAMENTO", () => {
    const g = agruparPorFamilia([chamada(FORA, "openai", "conversa_web")]);
    expect(veredito(g, autorizadas).vazamentos.map(([id]: [string]) => id)).toEqual([FORA]);
  });

  it("3. NÃO-autorizada usando whisper NÃO é vazamento", () => {
    // O caso que gerou o alarme falso: áudio sempre foi OpenAI, pra todo mundo.
    const g = agruparPorFamilia([
      chamada(FORA, "openai", "ayla_audio", "whisper-1"),
      chamada(FORA, "anthropic", "ayla_responder"),
    ]);
    const v = veredito(g, autorizadas);
    expect(v.vazamentos).toHaveLength(0);
    expect(g.get(FORA)?.openai ?? 0).toBe(0); // o whisper nem entra na contagem
  });

  it("4. autorizada recebendo Claude = NÃO CHEGOU (config que não valeu)", () => {
    const g = agruparPorFamilia([chamada(AUT, "anthropic", "ayla_responder")]);
    const v = veredito(g, autorizadas);
    expect(v.naoChegou.map(([id]: [string]) => id)).toEqual([AUT]);
    expect(v.vazamentos).toHaveLength(0);
  });

  it("5. autorizada que não conversou = silêncio, não erro", () => {
    const v = veredito(agruparPorFamilia([]), autorizadas);
    expect(v.vazamentos).toHaveLength(0);
    expect(v.naoChegou).toHaveLength(0);
    expect(v.semDado.sort()).toEqual([AUT, AUT2]);
  });

  it("6. só áudio na janela inteira = veredito limpo e nada provado", () => {
    const g = agruparPorFamilia([
      chamada(AUT, "openai", "ayla_audio", "whisper-1"),
      chamada(FORA, "openai", "ayla_audio", "whisper-1"),
    ]);
    const v = veredito(g, autorizadas);
    expect(v.vazamentos).toHaveLength(0);
    expect(v.semDado).toHaveLength(2); // ninguém conversou de fato
  });
});

describe("a contagem por família", () => {
  it("separa canal e provider, e ignora o que não é conversa", () => {
    const g = agruparPorFamilia([
      chamada(AUT, "openai", "ayla_responder"),
      chamada(AUT, "openai", "conversa_web"),
      chamada(AUT, "openai", "ayla_audio", "whisper-1"),
    ]);
    const f = g.get(AUT);
    expect(f.openai).toBe(2);
    expect([...f.canais].sort()).toEqual(["web", "whatsapp"]);
    expect([...f.modelos]).not.toContain("whisper-1");
  });

  it("família que só usou áudio não aparece no mapa", () => {
    expect(agruparPorFamilia([chamada(FORA, "openai", "ayla_audio")]).size).toBe(0);
  });
});
