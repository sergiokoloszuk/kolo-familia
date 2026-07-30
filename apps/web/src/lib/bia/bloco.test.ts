import { describe, expect, it } from "vitest";
import {
  aplicarCotas,
  aplicarOrcamento,
  montarBlocoBia,
  MAX_CHARS_POR_CHUNK,
  MAX_CHARS_TEXTO,
  MAX_CHUNKS,
  tokensAprox,
} from "./bloco";
import type { ResultadoBia } from "./pontuacao";
import type { BiaTipoConhecimento } from "./tipos";

/**
 * Cotas e orçamento — é aqui que mora o risco de estourar o contexto e o risco
 * de a saída virar monótona (seis regras e nenhuma pergunta).
 */

let seq = 0;
function r(
  tipo: BiaTipoConhecimento,
  score = 50,
  texto = "conteúdo de apoio da biblioteca sobre o tema em questão",
): ResultadoBia {
  seq += 1;
  return {
    chunk: {
      id: `x${seq}`,
      nucleo: "comunicacao",
      secao: "seção",
      titulo: "título",
      tipo_conhecimento: tipo,
      faixa_etaria_min_meses: null,
      faixa_etaria_max_meses: null,
      faixa_rotulo: null,
      situacoes_relacionadas: [],
      diagnosticos_relacionados: [],
      nivel_de_cautela: "baixo",
      muda_conduta: null,
      texto_original: texto,
      revisao_pendente: false,
      ordem: seq,
    },
    score,
    motivos: [{ codigo: "tipo", descricao: "tipo", peso: score }],
    explicacao: "tipo",
  };
}

describe("cotas", () => {
  it("respeita o teto por tipo pedido na integração", () => {
    const entrada = [
      r("regra_operacional", 90),
      r("regra_operacional", 89),
      r("regra_operacional", 88), // 3ª regra: excede a cota de 2
      r("interpretacao", 87),
      r("interpretacao", 86), // 2ª interpretação: excede a cota de 1
      r("pergunta_investigativa", 85),
      r("pergunta_investigativa", 84), // 2ª pergunta: excede
      r("estrategia", 83),
      r("conceito", 82),
      r("conceito", 81), // "prático" já cheio (estratégia + conceito = 2)
    ];
    const saida = aplicarCotas(entrada);
    const conta = (t: string) =>
      saida.filter((x) => x.chunk.tipo_conhecimento === t).length;

    expect(conta("regra_operacional")).toBeLessThanOrEqual(2);
    expect(conta("interpretacao")).toBeLessThanOrEqual(1);
    expect(conta("pergunta_investigativa")).toBeLessThanOrEqual(1);
    expect(conta("estrategia") + conta("conceito")).toBeLessThanOrEqual(2);
  });

  it("nunca passa de 5 chunks, mesmo com cotas sobrando", () => {
    const entrada = [
      r("regra_operacional", 99),
      r("regra_operacional", 98),
      r("interpretacao", 97),
      r("pergunta_investigativa", 96),
      r("estrategia", 95),
      r("conceito", 94),
      r("encaminhamento", 93),
    ];
    expect(aplicarCotas(entrada).length).toBeLessThanOrEqual(MAX_CHUNKS);
  });

  it("reserva vaga para conteúdo de segurança", () => {
    // O retriever promove encaminhamento a +60 quando há risco no contexto. Sem
    // cota para ele, o alerta certo seria recuperado e descartado aqui.
    const entrada = [
      r("encaminhamento", 133),
      r("regra_operacional", 90),
      r("regra_operacional", 89),
      r("interpretacao", 88),
      r("estrategia", 87),
      r("conceito", 86),
    ];
    const tipos = aplicarCotas(entrada).map((x) => x.chunk.tipo_conhecimento);
    expect(tipos).toContain("encaminhamento");
  });

  it("descarta tipos sem cota — inclusive os que se aproximam do Core", () => {
    const saida = aplicarCotas([
      r("principio_de_ouro", 99),
      r("fundamento", 98),
      r("explicacao_para_familia", 97),
    ]);
    expect(saida).toHaveLength(0);
  });

  it("preserva a ordem de pontuação dentro da cota", () => {
    const alto = r("regra_operacional", 90);
    const baixo = r("regra_operacional", 10);
    const saida = aplicarCotas([alto, baixo, r("regra_operacional", 5)]);
    expect(saida.map((x) => x.score)).toEqual([90, 10]);
  });
});

describe("orçamento", () => {
  it("corta o chunk individual muito longo, sem partir palavra", () => {
    const gigante = r("estrategia", 90, "palavra ".repeat(500));
    const [saida] = aplicarOrcamento([gigante]);
    const texto = montarBlocoBia([gigante]).texto;
    expect(saida).toBeTruthy();
    expect(texto).toContain("…");
    expect(texto.length).toBeLessThan(MAX_CHARS_POR_CHUNK + 1500);
  });

  it("descarta do fim (menor score) quando o total estoura", () => {
    const grande = (score: number) => r("regra_operacional", score, "x ".repeat(400));
    const saida = aplicarOrcamento([grande(90), grande(80), grande(70), grande(60)]);
    const total = saida.reduce((s, x) => s + x.chunk.texto_original.length, 0);
    expect(saida.length).toBeLessThan(4);
    expect(saida[0].score).toBe(90); // o de maior score sobrevive
    expect(total).toBeGreaterThan(0);
  });

  it("mantém pelo menos um chunk mesmo se ele sozinho estourar o teto", () => {
    const unico = r("estrategia", 90, "y ".repeat(5000));
    expect(aplicarOrcamento([unico])).toHaveLength(1);
  });
});

describe("montagem do bloco", () => {
  it("bloco VAZIO quando não há resultado — nada entra no prompt", () => {
    const b = montarBlocoBia([]);
    expect(b.texto).toBe("");
    expect(b.chars).toBe(0);
    expect(b.usados).toHaveLength(0);
  });

  it("bloco vazio também quando nada passa nas cotas", () => {
    expect(montarBlocoBia([r("principio_de_ouro", 99)]).texto).toBe("");
  });

  it("carrega TODAS as instruções de uso obrigatórias", () => {
    const t = montarBlocoBia([r("estrategia", 50)]).texto;
    expect(t).toContain("HIPÓTESES");
    expect(t).toMatch(/NÃO copie/i);
    expect(t).toMatch(/NUNCA mencione esta fonte/i);
    expect(t).toMatch(/IGNORE o resto/i);
    expect(t).toMatch(/não é uma ordem para perguntar/i);
    expect(t).toMatch(/já foi decidido antes/i);
    expect(t).toMatch(/Core PREVALECEM/i);
  });

  it("acrescenta a regra do mais cauteloso só quando há conflito", () => {
    const sem = montarBlocoBia([r("estrategia", 50)]).texto;
    const com = montarBlocoBia([r("estrategia", 50)], { temConflito: true }).texto;
    expect(sem).not.toMatch(/MAIS CAUTELOSA/);
    expect(com).toMatch(/MAIS CAUTELOSA/);
  });

  it("fica dentro do orçamento de contexto declarado", () => {
    const cheio = [
      r("regra_operacional", 90, "a ".repeat(400)),
      r("regra_operacional", 89, "b ".repeat(400)),
      r("interpretacao", 88, "c ".repeat(400)),
      r("pergunta_investigativa", 87, "d ".repeat(400)),
      r("estrategia", 86, "e ".repeat(400)),
    ];
    const b = montarBlocoBia(cheio);
    // Texto + instruções. O teto de texto é 2000; as instruções somam ~1000.
    expect(b.chars).toBeLessThan(MAX_CHARS_TEXTO + 1400);
    expect(tokensAprox(b.chars)).toBeLessThan(900);
  });

  it("é rotulado como conhecimento de apoio, e não como resposta", () => {
    const t = montarBlocoBia([r("estrategia", 50)]).texto;
    expect(t).toContain("<conhecimento_de_apoio>");
    expect(t).toContain("</conhecimento_de_apoio>");
    expect(t).toMatch(/não é a resposta/i);
  });
});
