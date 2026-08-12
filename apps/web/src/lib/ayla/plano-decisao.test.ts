import { describe, expect, it } from "vitest";
import { decidirSobrePlano } from "./plano-decisao";

/**
 * EQUIVALÊNCIA ANTES × DEPOIS — a fatia que separa o `forcar` não pode mudar
 * nada. O `forcar` de antes era, em uma linha:
 *
 *   forcar = (pedeUmPlano(texto) && ato === "criar") || (aceite de oferta)
 *
 * e ele governava, sozinho, o dedup de 20 h e a suficiência. Aqui os quatro
 * campos são conferidos contra essa fórmula, caso a caso.
 */

const forcarAntigo = (d: ReturnType<typeof decidirSobrePlano>) => d.autoridadeParaCriar;

const CASOS: Array<{ texto: string; oferta: boolean; forcar: boolean; nota: string }> = [
  { texto: "faz um plano para melhorar a comunicação do Mário", oferta: false, forcar: true, nota: "pedido explícito" },
  { texto: "preciso de um plano pra ele dormir sozinho", oferta: false, forcar: true, nota: "pedir a coisa" },
  { texto: "sim", oferta: true, forcar: true, nota: "oferta aceita" },
  { texto: "sim", oferta: false, forcar: false, nota: "sim sem oferta" },
  { texto: "por que você colocou isso no plano?", oferta: false, forcar: false, nota: "conversar_sobre" },
  { texto: "não quero outro plano", oferta: false, forcar: false, nota: "recusar" },
  { texto: "manda o plano de novo", oferta: false, forcar: false, nota: "reenviar" },
  { texto: "e o plano?", oferta: false, forcar: false, nota: "ambíguo" },
  { texto: "ela não quis jantar hoje", oferta: false, forcar: false, nota: "conversa comum" },
];

describe("equivalência com o booleano que existia antes", () => {
  it("MORDE: os nove casos dão o mesmo que o `forcar` antigo", () => {
    for (const c of CASOS) {
      const d = decidirSobrePlano({ texto: c.texto, ofertaAceitaAgora: c.oferta });
      expect(forcarAntigo(d), `${c.nota}: "${c.texto}"`).toBe(c.forcar);
      // E o comportamento observável de cada um dos dois freios continua
      // amarrado ao mesmo valor — é isso que faz esta fatia ser sem efeito.
      expect(d.pularSuficiencia, `${c.nota}: suficiência`).toBe(c.forcar);
      expect(d.pularDedup, `${c.nota}: dedup`).toBe(c.forcar);
    }
  });

  it("MORDE: os quatro conceitos existem separados, não como um só campo", () => {
    const d = decidirSobrePlano({ texto: "faz um plano pro Mário", ofertaAceitaAgora: false });
    expect(d.ato).toBe("criar");
    expect(Object.keys(d).sort()).toEqual(
      ["ato", "autoridadeParaCriar", "pularDedup", "pularSuficiencia"].sort(),
    );
  });

  it("o ato é preservado inteiro — não colapsa em booleano", () => {
    expect(decidirSobrePlano({ texto: "manda o plano de novo", ofertaAceitaAgora: false }).ato).toBe("reenviar");
    expect(decidirSobrePlano({ texto: "não quero outro plano", ofertaAceitaAgora: false }).ato).toBe("recusar");
    expect(decidirSobrePlano({ texto: "ajusta aquele plano", ofertaAceitaAgora: false }).ato).toBe("editar");
  });
});
