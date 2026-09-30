import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  pedeListaDeRotinas,
  pedeTrazerRotinaExistente,
} from "./rotina-guiada";

const GUIADA = readFileSync(new URL("./rotina-guiada.ts", import.meta.url), "utf8");
const ORQUESTRADOR = readFileSync(new URL("./orchestrator.ts", import.meta.url), "utf8");

describe("reencontro de sequências no WhatsApp", () => {
  it("entende a pergunta natural sobre o que já foi criado", () => {
    expect(pedeListaDeRotinas("Quais rotinas já criamos?")).toBe(true);
    expect(pedeListaDeRotinas("O que já temos de cartões?")).toBe(true);
    expect(pedeListaDeRotinas("Como foi o mercado hoje?")).toBe(false);
  });

  it("entende que a mãe quer trazer uma sequência pelo assunto", () => {
    expect(pedeTrazerRotinaExistente("Traz a fila no mercado")).toBe(true);
    expect(pedeTrazerRotinaExistente("Me mostra a sequência do dentista")).toBe(true);
    expect(pedeTrazerRotinaExistente("Quero criar cartões para o banho")).toBe(false);
  });

  it("lê somente as rotinas daquela família e daquela criança", () => {
    const inicio = GUIADA.indexOf("async function rotinasDaCrianca");
    const fim = GUIADA.indexOf("/** Lista títulos reconhecíveis", inicio);
    const leitura = GUIADA.slice(inicio, fim);
    expect(leitura).toContain('.eq("family_account_id", familyId)');
    expect(leitura).toContain('.eq("membro_atipico_id", membroId)');
  });

  it("reabre o artefato existente por link, sem criar ou gerar outro", () => {
    const inicio = GUIADA.indexOf("export async function trazerRotinaExistente");
    const fim = GUIADA.indexOf("export async function lerFeedbackDaRotina", inicio);
    const entrega = GUIADA.slice(inicio, fim);
    expect(entrega).toContain("gerarMagicLink");
    expect(entrega).not.toContain("gerarRotina(");
    expect(entrega).not.toContain("dispararGeracao(");
  });

  it("roteia a retomada antes da leitura de rotina por dia", () => {
    expect(ORQUESTRADOR.indexOf("3c-rotina-reencontro")).toBeLessThan(
      ORQUESTRADOR.indexOf("3c-rotina-ver"),
    );
    expect(ORQUESTRADOR).toContain("listarRotinasDaCrianca");
    expect(ORQUESTRADOR).toContain("trazerRotinaExistente");
  });
});
