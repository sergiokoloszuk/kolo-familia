import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { atoSobreArtefato } from "@/lib/conducao/ato-artefato";
import { pedeArtefatoImprimivel } from "./rotina-pdf-rota";

/**
 * AUTORIDADE DO IMPRIMÍVEL — o caso Juliana/Daniel (11/08/2026, PEND-044).
 *
 * ⚠️ O CASO REAL, e ele é de produção. Primeira conversa da família. A Ayla
 * pediu que a mãe contasse algo do dia a dia; a mãe contou:
 *
 *   "ele esta colocando muita coisa na boca, planta, bonecos, papel, plastico"
 *
 * e recebeu "Ainda não temos uma rotina montada pra eu transformar em PDF 🌿".
 *
 * `PEDE_PDF` casa `\bpapel\b` — a palavra está lá porque "me manda no papel" é
 * pedido legítimo. Uma palavra de vocabulário concedeu autoridade de artefato, e
 * a mãe foi desviada do próprio assunto que a Ayla pediu para ela trazer.
 *
 * ⚠️ OS ATOS AQUI NÃO SÃO OS DE `abreFluxoDeArtefato`: neste artefato
 * `reenviar` É o caso central ("me manda o pdf"), enquanto no Plano ele
 * deliberadamente não abre geração.
 */

const ORCH = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");

/** O portão real, reproduzido: vocabulário + ato. */
const AUTORIZAM = new Set(["criar", "editar", "reenviar"]);
const gate = (t: string) => pedeArtefatoImprimivel(t) && AUTORIZAM.has(atoSobreArtefato(t));

describe("o caso real", () => {
  it("MORDE: detector continua vendo 'papel' — e o ato NÃO autoriza", () => {
    const REAL = "ele esta colocando muita coisa na boca, planta, bonecos, papel, plastico";
    // O detector NÃO foi enfraquecido, e isso é deliberado: o defeito não era
    // ele enxergar demais, era o portão confiar só nele.
    expect(pedeArtefatoImprimivel(REAL), "o detector foi enfraquecido em vez do portão").toBe(true);
    expect(atoSobreArtefato(REAL)).toBe("ambiguo");
    expect(gate(REAL), "o PDF ainda abre no caso real").toBe(false);
  });
});

describe("pedidos legítimos continuam passando", () => {
  it("MORDE: os sete pedidos reais", () => {
    for (const t of [
      "quero o PDF",
      "me manda o PDF",
      "me manda em papel",
      "pode imprimir pra mim?",
      "faz os cartões",
      "transforma essa rotina em cartões",
    ]) {
      expect(gate(t), `"${t}" foi BLOQUEADO`).toBe(true);
    }
  });

  it("'quero essa rotina visual' NÃO é deste portão — e o ato já a autoriza", () => {
    // ⚠️ MEDIDO, e corrige uma expectativa minha: `pedeArtefatoImprimivel` cobre
    // PDF e CARTÕES; a palavra "visual" pertence a `pediuApoioVisual`, que é
    // outro caminho (o do quadro visual da rotina). Esta frase nunca passou por
    // aqui — e o que importa é que o ATO já a reconhece como pedido, então o
    // portão dela não vai precisar de outro contrato.
    expect(pedeArtefatoImprimivel("quero essa rotina visual")).toBe(false);
    expect(atoSobreArtefato("quero essa rotina visual")).toBe("editar");
  });
});

describe("falar sobre, recusar e narrar não produzem", () => {
  it("MORDE: os casos que só mencionam", () => {
    for (const t of [
      "como funciona o PDF da rotina?",
      "o PDF da terapeuta não abre",
      "a escola imprime as atividades",
      "ela rasga papel quando fica nervosa",
      "o cartão visual ajudou",
      "transformar rotina em cartão ajuda mesmo?",
      "não quero PDF",
      "não precisa imprimir",
      "e o PDF?",
    ]) {
      expect(gate(t), `"${t}" ABRIU o imprimível`).toBe(false);
    }
  });
});

describe("o portão real do orquestrador", () => {
  it("MORDE: compõe vocabulário + ato, e os três atos estão escritos", () => {
    expect(ORCH).toMatch(
      /const autorizaImprimivel =\s*\n\s*atoImprimivel === "criar" \|\| atoImprimivel === "editar" \|\| atoImprimivel === "reenviar";/,
    );
    expect(ORCH).toMatch(
      /const pedeImprimivel = pedeArtefatoImprimivel\(inbound\.texto\) && autorizaImprimivel;/,
    );
  });
});
