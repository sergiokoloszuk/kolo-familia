import { describe, expect, it } from "vitest";
import {
  DEFAULT_IMAGE_MODELS,
  deveTentarProximoModelo,
  resolverModelosImagem,
} from "./models";

describe("portão de continuidade dos modelos de imagem", () => {
  it("não deixa o modelo desligado prender o Lúdico", () => {
    expect(resolverModelosImagem({ lista: "gpt-image-1" })).toEqual([
      ...DEFAULT_IMAGE_MODELS,
    ]);
  });

  it("preserva um modelo configurado e mantém fallbacks compatíveis", () => {
    expect(
      resolverModelosImagem({
        lista: "gpt-image-2.5-flare, modelo-interno, gpt-image-2.5-flare",
      }),
    ).toEqual([
      "gpt-image-2.5-flare",
      "modelo-interno",
      "gpt-image-2.5-sunburst",
      "gpt-image-2",
    ]);
  });

  it("avança quando o provider remove ou indisponibiliza um modelo", () => {
    expect(
      deveTentarProximoModelo(
        400,
        JSON.stringify({ error: { message: "The model 'x' does not exist." } }),
      ),
    ).toBe(true);
    expect(deveTentarProximoModelo(429, "rate limit")).toBe(true);
    expect(deveTentarProximoModelo(503, "temporarily unavailable")).toBe(true);
  });

  it("não usa failover para contornar moderação ou erro de contrato", () => {
    expect(
      deveTentarProximoModelo(
        400,
        JSON.stringify({ error: { code: "moderation_blocked" } }),
      ),
    ).toBe(false);
    expect(
      deveTentarProximoModelo(
        400,
        JSON.stringify({ error: { code: "invalid_value", message: "Invalid size" } }),
      ),
    ).toBe(false);
  });
});
