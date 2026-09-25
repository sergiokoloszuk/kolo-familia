import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  BLOCO_PLANO_WHATSAPP_SUSPENSO,
  planosWhatsappLigados,
} from "./plano-disponibilidade";

const ENV_ORIGINAL = process.env.AYLA_PLANOS_WHATSAPP;

afterEach(() => {
  if (ENV_ORIGINAL === undefined) delete process.env.AYLA_PLANOS_WHATSAPP;
  else process.env.AYLA_PLANOS_WHATSAPP = ENV_ORIGINAL;
});

describe("suspensão reversível do Plano no WhatsApp", () => {
  it("preserva o comportamento histórico sem configuração e desliga só por valor explícito", () => {
    delete process.env.AYLA_PLANOS_WHATSAPP;
    expect(planosWhatsappLigados()).toBe(true);

    for (const valor of ["off", "false", "0", " OFF "]) {
      process.env.AYLA_PLANOS_WHATSAPP = valor;
      expect(planosWhatsappLigados()).toBe(false);
    }

    for (const valor of ["on", "true", "1", "sim"]) {
      process.env.AYLA_PLANOS_WHATSAPP = valor;
      expect(planosWhatsappLigados()).toBe(true);
    }
  });

  it("suspende o artefato sem suspender a ajuda", () => {
    expect(BLOCO_PLANO_WHATSAPP_SUSPENSO).toContain("NÃO ofereça, prometa, gere ou envie Plano");
    expect(BLOCO_PLANO_WHATSAPP_SUSPENSO).toContain("responda com a menor orientação útil");
    expect(BLOCO_PLANO_WHATSAPP_SUSPENSO).toContain("Entregue uma ação concreta agora");
    expect(BLOCO_PLANO_WHATSAPP_SUSPENSO).not.toContain("volte depois");
  });

  it("alcança os dois geradores, todas as entregas e a observabilidade", () => {
    const experimental = readFileSync(resolve(__dirname, "experimental.ts"), "utf8");
    const legacy = readFileSync(resolve(__dirname, "responder.ts"), "utf8");
    const ponte = readFileSync(resolve(__dirname, "ponte.ts"), "utf8");
    const orchestrator = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");
    const espontanea = readFileSync(resolve(__dirname, "mensagemEspontanea.ts"), "utf8");
    const health = readFileSync(resolve(__dirname, "../../app/api/health/route.ts"), "utf8");

    expect(experimental).toContain("BLOCO_PLANO_WHATSAPP_SUSPENSO");
    expect(legacy).toContain("BLOCO_PLANO_WHATSAPP_SUSPENSO");
    expect(ponte.match(/if \(!planosWhatsappLigados\(\)\) return null;/g)).toHaveLength(3);
    expect(orchestrator).toMatch(/async function ponteDePlano[\s\S]*if \(!planosWhatsappLigados\(\)\) return null/);
    expect(orchestrator).toMatch(/sendPlanoSeguimento[\s\S]*Planos no WhatsApp estão suspensos/);
    expect(orchestrator).toMatch(/sendRecuperacaoPlano[\s\S]*Planos no WhatsApp estão suspensos/);
    expect(orchestrator).toMatch(/sendOfertaFimDeSemana[\s\S]*Planos no WhatsApp estão suspensos/);
    expect(espontanea).toMatch(/intent === "convite_plano" \|\| intent === "feedback_plano"/);
    expect(health).toContain("ayla_planos_whatsapp: planosWhatsappLigados()");
  });
});
