import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CORE = readFileSync(
  resolve(process.cwd(), "../../docs/documentos-ayla/core-v12-CANDIDATO.md"),
  "utf8",
);

describe("Core v12 — conversa curta, completa e segura", () => {
  it("troca teaser por ajuda completa no primeiro turno", () => {
    expect(CORE).toContain("Entregue agora a menor ajuda completa");
    expect(CORE).toContain("entregue-a inteira no mesmo turno");
    expect(CORE).toContain("Não ofereça um menu dessas formas");
    expect(CORE).not.toContain("Não entregue o passo a passo completo nessa primeira resposta");
    expect(CORE).not.toContain("A profundidade aumenta conforme a família demonstra interesse");
  });

  it("escolhe uma forma e sabe trabalhar três momentos", () => {
    expect(CORE).toContain("escolha **uma** forma de ajudar");
    expect(CORE).toContain("**agora:**");
    expect(CORE).toContain("**depois:**");
    expect(CORE).toContain("**antes da próxima vez:**");
  });

  it("não transforma participação apoiada em meta automática de retirada", () => {
    expect(CORE).toContain("Participar com apoio é participação");
    expect(CORE).toContain("Não transforme “precisou de ajuda” em fracasso");
    expect(CORE).toMatch(/nem\s+proponha retirar apoio automaticamente/);
    expect(CORE).toContain("preserve o apoio atual");
    expect(CORE).toContain("“bateu” não prova que ficou brava");
  });

  it("preserva a parte segura e útil do material da Pós", () => {
    expect(CORE).toContain("Ecolalia pode ter função comunicativa ou regulatória");
    expect(CORE).toContain("Nunca exija contato visual");
    expect(CORE).toContain("grande inconsistência na produção das mesmas palavras");
    expect(CORE).toContain("Hipersensibilidade:");
    expect(CORE).toContain("Roncos crônicos, pausas respiratórias");
    expect(CORE).toContain("Constipação persistente");
  });

  it("fica menor para não comprar qualidade com mais contexto", () => {
    expect(CORE.length).toBeLessThan(25_000);
  });
});
