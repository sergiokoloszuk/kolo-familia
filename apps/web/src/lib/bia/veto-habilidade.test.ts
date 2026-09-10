import { describe, expect, it } from "vitest";
import { filtrarDuro, normalizarContexto, selecionar, type ChunkParaPontuar, type ContextoBia } from "./pontuacao";
import { BIA_HABILIDADES, habilidadesImplicadas } from "./tipos";

/**
 * O VETO POR HABILIDADE JÁ PROVADA — PEND-196.
 *
 * ⚠️ O DEFEITO É MEDIDO, não hipotético. Na bancada de 45 chunks, 10/09/2026:
 * um adolescente de 15 anos que "fala muito bem e escreve redação sozinho"
 * recebeu `pos-a-03-escada` — a escada de pré-requisitos PRÉ-VERBAIS — com
 * score 88. No turno real do Mario (9 anos, conversa bem), 2 dos 5 chunks do
 * bloco pressupunham linguagem ausente.
 *
 * ⚠️ A METADE MAIS IMPORTANTE DESTE ARQUIVO É A QUE PROVA QUE O VETO NÃO
 * DISPARA. Vetar demais apaga conhecimento de quem mais precisa dele — a
 * criança não-verbal —, e esse erro é silencioso: ninguém percebe o que não
 * chegou. Por isso: ausência de prova não é prova de ausência, e habilidade
 * sem relação declarada não veta nada.
 */

let seq = 0;
function chunk(over: Partial<ChunkParaPontuar> = {}): ChunkParaPontuar {
  seq += 1;
  return {
    id: `v${seq}`,
    nucleo: "comunicacao",
    secao: null,
    titulo: null,
    tipo_conhecimento: "regra_operacional",
    faixa_etaria_min_meses: null,
    faixa_etaria_max_meses: null,
    faixa_rotulo: null,
    situacoes_relacionadas: [],
    diagnosticos_relacionados: [],
    nucleos_relacionados: [],
    habilidades_relacionadas: [],
    pressupoe_ausencia_de: [],
    nivel_de_cautela: "baixo",
    muda_conduta: null,
    texto_original: "conteúdo de apoio",
    revisao_pendente: false,
    ordem: 0,
    ...over,
  };
}

const ctx = (over: Partial<ContextoBia> = {}) =>
  normalizarContexto({ idadeAnos: 9, perfil: "TEA", dominio: "comunicacao", ...over });

/** O chunk da escada, como ele está no corpus versionado. */
const escada = () =>
  chunk({ id: "escada", pressupoe_ausencia_de: ["fala_funcional", "frases", "conversa_reciproca"] });

describe("A · o Perfil prova linguagem funcional", () => {
  it("veta o chunk que pressupõe ausência de fala", () => {
    expect(filtrarDuro(escada(), ctx({ habilidadesProvadas: ["conversa_reciproca"] }))).toBe(
      "habilidade_ja_provada",
    );
  });

  it("o motivo do descarte é explícito — não some no ranking", () => {
    const motivo = filtrarDuro(escada(), ctx({ habilidadesProvadas: ["fala_funcional"] }));
    expect(motivo).toBe("habilidade_ja_provada");
  });

  it("é VETO, não penalidade: o chunk não aparece nem no fim da lista", () => {
    const outro = chunk({ id: "outro" });
    const r = selecionar([escada(), outro], { idadeAnos: 15, dominio: "comunicacao", habilidadesProvadas: ["conversa_reciproca"] }, { limite: 10 });
    expect(r.map((x) => x.chunk.id)).toEqual(["outro"]);
  });

  it("a cadeia de pré-requisitos é transitiva: provar conversa prova atenção social", () => {
    const preVerbal = chunk({ id: "pre", pressupoe_ausencia_de: ["atencao_social"] });
    expect(filtrarDuro(preVerbal, ctx({ habilidadesProvadas: ["conversa_reciproca"] }))).toBe(
      "habilidade_ja_provada",
    );
  });
});

describe("B · criança pré-verbal — nada provado, nada vetado", () => {
  it("sem habilidade superior, a escada continua elegível", () => {
    expect(filtrarDuro(escada(), ctx({ idadeAnos: 6, habilidadesProvadas: ["gestos_intencionais"] }))).toBeNull();
  });

  it("gesto e imitação não implicam fala — a escada permanece", () => {
    const prova = habilidadesImplicadas(["gestos_intencionais", "imitacao"]);
    expect(prova.has("fala_funcional")).toBe(false);
    expect(filtrarDuro(escada(), ctx({ habilidadesProvadas: ["imitacao"] }))).toBeNull();
  });

  it("o caso real da criança que leva pela mão continua recebendo o conteúdo", () => {
    const mao = chunk({ id: "mao", pressupoe_ausencia_de: ["fala_funcional"] });
    expect(filtrarDuro(mao, ctx({ idadeAnos: 6, habilidadesProvadas: ["gestos_intencionais", "atencao_compartilhada"] }))).toBeNull();
  });
});

describe("C · ausência de prova não é prova de ausência", () => {
  it("perfil que não informa nada não veta nada", () => {
    expect(filtrarDuro(escada(), ctx({}))).toBeNull();
    expect(filtrarDuro(escada(), ctx({ habilidadesProvadas: [] }))).toBeNull();
    expect(filtrarDuro(escada(), ctx({ habilidadesProvadas: null }))).toBeNull();
  });

  it("string fora do vocabulário é ignorada em silêncio, e não veta", () => {
    expect(filtrarDuro(escada(), ctx({ habilidadesProvadas: ["fala", "verbal", "linguagem", "conversa"] }))).toBeNull();
  });

  it("o vocabulário é fechado — as quatro palavras soltas não viram habilidade", () => {
    expect(habilidadesImplicadas(["fala", "verbal", "linguagem", "conversa"]).size).toBe(0);
  });
});

describe("D · habilidade sem relação declarada não veta", () => {
  it("provar leitura e escrita NÃO veta conteúdo de fala — quem escreve pode não falar", () => {
    // É o perfil de quem usa CAA por texto. Vetar aqui apagaria justamente
    // quem mais precisa do conteúdo de fala.
    expect(habilidadesImplicadas(["leitura_escrita"]).has("fala_funcional")).toBe(false);
    expect(filtrarDuro(escada(), ctx({ habilidadesProvadas: ["leitura_escrita"] }))).toBeNull();
  });

  it("provar autonomia (fora do vocabulário) não veta comunicação", () => {
    expect(filtrarDuro(escada(), ctx({ habilidadesProvadas: ["autonomia", "desfralde"] }))).toBeNull();
  });

  it("frase ecolálica não é conversa: `frases` não implica `conversa_reciproca`", () => {
    expect(habilidadesImplicadas(["frases"]).has("conversa_reciproca")).toBe(false);
  });

  it("chunk sem `pressupoe_ausencia_de` nunca é vetado, prove-se o que provar", () => {
    const livre = chunk({ id: "livre" });
    for (const h of BIA_HABILIDADES) {
      expect(filtrarDuro(livre, ctx({ habilidadesProvadas: [h] }))).toBeNull();
    }
  });
});

describe("E · o veto vale em multidomínio", () => {
  it("com dois domínios, o incompatível continua saindo", () => {
    const r = selecionar(
      [escada(), chunk({ id: "regulacao", nucleo: "regulacao_emocional" })],
      { idadeAnos: 9, dominios: ["comunicacao", "emocional"], habilidadesProvadas: ["conversa_reciproca"] },
      { limite: 10 },
    );
    expect(r.map((x) => x.chunk.id)).toEqual(["regulacao"]);
  });
});

describe("F · compatibilidade", () => {
  it("chamada antiga, sem `habilidadesProvadas`, não muda de comportamento", () => {
    const antes = selecionar([escada(), chunk({ id: "outro" })], { idadeAnos: 9, dominio: "comunicacao" }, { limite: 10 });
    expect(antes.map((x) => x.chunk.id).sort()).toEqual(["escada", "outro"]);
  });

  it("chunk vindo de linha antiga (sem a coluna) não quebra o filtro", () => {
    const semColuna = { ...chunk({ id: "antigo" }) } as ChunkParaPontuar;
    delete (semColuna as { pressupoe_ausencia_de?: unknown }).pressupoe_ausencia_de;
    expect(filtrarDuro(semColuna, ctx({ habilidadesProvadas: ["conversa_reciproca"] }))).toBeNull();
  });
});
