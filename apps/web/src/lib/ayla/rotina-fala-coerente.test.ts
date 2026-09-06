import { describe, expect, it } from "vitest";
import { falaCoerenteComEstado, podeAfirmarConclusao } from "./rotina-fala-coerente";

/**
 * ⚠️ O CASO QUE ORIGINOU ESTE ARQUIVO. A Ayla disse à Karina "Pronto! A rotina
 * da Manu está montada" com `cards_status='aguardando'` — nada encomendado,
 * nada gerado, nada para abrir. A mãe foi olhar e não havia rotina nenhuma.
 *
 * A regra que estes testes prendem: A FALA DEPENDE DO ESTADO REAL, e "pronto"
 * exige duas provas, não uma — o estado E o artefato recuperável.
 */

const AFIRMACAO = "Pronto! A rotina da Manu está montada 🌿 Dá uma olhada lá.";

describe("o estado autoriza afirmar conclusão?", () => {
  it("aguardando → não", () => expect(podeAfirmarConclusao("aguardando", true)).toBe(false));
  it("gerando → não", () => expect(podeAfirmarConclusao("gerando", true)).toBe(false));
  it("erro → não", () => expect(podeAfirmarConclusao("erro", true)).toBe(false));
  it("pronto COM artefato → sim", () => expect(podeAfirmarConclusao("pronto", true)).toBe(true));
  it("pronto SEM artefato → não", () => {
    // ⚠️ A METADE ESQUECIDA. O gerador marcou sucesso e nenhuma imagem vingou.
    // Afirmar entrega aqui é o mesmo erro, com outra origem.
    expect(podeAfirmarConclusao("pronto", false)).toBe(false);
  });
});

describe("aguardando → nunca afirma pronto/montei/enviei", () => {
  const r = falaCoerenteComEstado({ texto: AFIRMACAO, estado: "aguardando", temArtefatoVerificavel: false });
  it("retira a afirmação", () => {
    expect(r.corrigida).toBe(true);
    expect(r.texto).not.toMatch(/Pronto!/);
    expect(r.texto).not.toMatch(/está montada/);
  });
  it("põe uma ressalva verdadeira no lugar, e não cala", () => {
    expect(r.texto.length).toBeGreaterThan(10);
    expect(r.texto).toMatch(/tema/i);
  });
  it.each(["Montei a rotina dela.", "Já enviei os cartões.", "Aqui está a rotina!", "Criei o quadro.", "Ficou pronta."])(
    "%s não sobrevive",
    (fala) => {
      const x = falaCoerenteComEstado({ texto: fala, estado: "aguardando", temArtefatoVerificavel: false });
      expect(x.corrigida).toBe(true);
    },
  );
});

describe("gerando → nunca afirma pronto", () => {
  const r = falaCoerenteComEstado({ texto: AFIRMACAO, estado: "gerando", temArtefatoVerificavel: false });
  it("retira e troca pela verdade do estado", () => {
    expect(r.corrigida).toBe(true);
    expect(r.texto).not.toMatch(/Pronto!/);
    expect(r.texto).toMatch(/comecei a preparar/i);
  });
});

describe("erro → nunca afirma pronto, e não some", () => {
  const r = falaCoerenteComEstado({ texto: AFIRMACAO, estado: "erro", temArtefatoVerificavel: false });
  it("assume a falha em vez de prometer", () => {
    expect(r.corrigida).toBe(true);
    expect(r.texto).toMatch(/não ficaram prontos|tentar de novo/i);
  });
});

describe("pronto + artefato → pode afirmar, e o texto sai intacto", () => {
  it("não mexe em nada", () => {
    const r = falaCoerenteComEstado({ texto: AFIRMACAO, estado: "pronto", temArtefatoVerificavel: true });
    expect(r.corrigida).toBe(false);
    expect(r.texto).toBe(AFIRMACAO);
  });
});

describe("pronto SEM artefato → não afirma entrega", () => {
  it("recua para uma frase que não promete o que não abre", () => {
    const r = falaCoerenteComEstado({ texto: AFIRMACAO, estado: "pronto", temArtefatoVerificavel: false });
    expect(r.corrigida).toBe(true);
    expect(r.texto).not.toMatch(/Pronto!/);
  });
});

describe("o que ele NÃO pode estragar", () => {
  it("promessa futura não é afirmação de conclusão", () => {
    // ⚠️ FALSO POSITIVO QUE CUSTARIA CARO. "conforme ficarem prontos" é a frase
    // honesta do estado `gerando`. Se o portão a apagasse, ele destruiria
    // justamente a fala correta que queremos que sobre.
    const fala = "Já comecei a preparar os cartões; eles vão aparecendo conforme ficarem prontos 🌿";
    const r = falaCoerenteComEstado({ texto: fala, estado: "gerando", temArtefatoVerificavel: false });
    expect(r.corrigida).toBe(false);
    expect(r.texto).toBe(fala);
  });

  it("acolhimento e pergunta atravessam intactos", () => {
    const fala =
      "Entendo o quanto a manhã de vocês está pesada. Pronto! A rotina está montada. Qual tema a Manu gosta mais?";
    const r = falaCoerenteComEstado({ texto: fala, estado: "aguardando", temArtefatoVerificavel: false });
    expect(r.texto).toMatch(/Entendo o quanto a manhã/);
    expect(r.texto).toMatch(/Qual tema a Manu gosta mais\?/);
    expect(r.texto).not.toMatch(/está montada/);
  });

  it("estado 'nenhum' não é assunto do portão — ninguém pediu cartão", () => {
    const fala = "Pronto! Organizei a sequência do dia com você.";
    const r = falaCoerenteComEstado({ texto: fala, estado: "nenhum", temArtefatoVerificavel: false });
    expect(r.corrigida).toBe(false);
    expect(r.texto).toBe(fala);
  });

  it("nunca devolve vazio, mesmo quando a fala inteira era a promessa", () => {
    const r = falaCoerenteComEstado({ texto: "Pronto!", estado: "aguardando", temArtefatoVerificavel: false });
    expect(r.texto.trim().length).toBeGreaterThan(0);
  });
});
