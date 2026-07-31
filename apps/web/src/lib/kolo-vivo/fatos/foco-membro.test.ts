import { describe, expect, it } from "vitest";
import { resolverMembro } from "./foco-membro";

/**
 * O foco de membro é o último bloqueador conhecido antes do Retrato. O que se
 * prova aqui é que a QUALIDADE do foco virou dado: uma escrita a partir de
 * `membros[0]` deixa de ser indistinguível de uma escrita a partir de seleção
 * explícita.
 */

const familiaComDois = [
  { id: "m-pedro", nome: "Pedro" },
  { id: "m-ana", nome: "Ana" },
];
const familiaComUm = [{ id: "m-pedro", nome: "Pedro" }];

describe("fonte do foco vira confiança", () => {
  it("seleção explícita é alta; primeiro-do-array é baixa", () => {
    expect(
      resolverMembro({ membroId: "m-pedro", fonte: "selecao_explicita", texto: "Aceita brócolis" })
        .confianca,
    ).toBe("alta");
    expect(
      resolverMembro({ membroId: "m-pedro", fonte: "primeiro_da_familia", texto: "Aceita brócolis" })
        .confianca,
    ).toBe("baixa");
  });
});

describe("foco frágil", () => {
  it("primeiro-do-array com DOIS filhos vai para quarentena", () => {
    const r = resolverMembro({
      membroId: "m-pedro",
      fonte: "primeiro_da_familia",
      texto: "Dormiu bem essa noite",
      nomesDaFamilia: familiaComDois,
    });
    expect(r.decisao).toBe("quarentena");
    expect(r.motivo).toBe("foco_fragil");
    expect(r.contraSinais).toContain("foco_por_ordem_do_array_com_varios_membros");
  });

  it("com UM filho só, persiste — não há em quem errar", () => {
    const r = resolverMembro({
      membroId: "m-pedro",
      fonte: "primeiro_da_familia",
      texto: "Dormiu bem essa noite",
      nomesDaFamilia: familiaComUm,
    });
    expect(r.decisao).toBe("persistir");
  });
});

describe("conflito de nome — a conversa mudou de filho", () => {
  it("texto cita OUTRO membro: nunca grava no membro em foco", () => {
    const r = resolverMembro({
      membroId: "m-pedro",
      fonte: "vinculo_da_conversa",
      texto: "A Ana não quis comer hoje",
      nomesDaFamilia: familiaComDois,
    });
    expect(r.decisao).toBe("quarentena");
    expect(r.motivo).toBe("conflito_de_nome");
  });

  it("texto cita o PRÓPRIO membro em foco: reforça e persiste", () => {
    const r = resolverMembro({
      membroId: "m-pedro",
      fonte: "vinculo_da_conversa",
      texto: "O Pedro dormiu bem",
      nomesDaFamilia: familiaComDois,
    });
    expect(r.decisao).toBe("persistir");
    expect(r.sinais).toContain("nome_do_membro_em_foco_no_texto");
  });
});

describe("sujeito manda sobre a estrutura", () => {
  it("cuidadora: rejeita, não quarentena — é conclusivo", () => {
    const r = resolverMembro({
      membroId: "m-pedro",
      fonte: "selecao_explicita",
      texto: "Estou exausta e sem paciência",
      nomesDaFamilia: familiaComUm,
    });
    expect(r.decisao).toBe("rejeitar");
    expect(r.sujeito).toBe("caregiver");
  });

  it("outra pessoa: rejeita", () => {
    const r = resolverMembro({
      membroId: "m-pedro",
      fonte: "selecao_explicita",
      texto: "A professora nova não entende nada",
    });
    expect(r.decisao).toBe("rejeitar");
  });

  it("múltiplas pessoas: quarentena — pode ser valioso, falta saber de quem", () => {
    const r = resolverMembro({
      membroId: "m-pedro",
      fonte: "selecao_explicita",
      texto: "O irmão come de tudo, já ele não",
    });
    expect(r.decisao).toBe("quarentena");
    expect(r.sujeito).toBe("multiple_or_ambiguous");
  });

  it("sem membro: rejeita sempre", () => {
    const r = resolverMembro({ membroId: null, fonte: "desconhecida", texto: "Aceita brócolis" });
    expect(r.decisao).toBe("rejeitar");
    expect(r.motivo).toBe("sem_membro");
  });
});

describe("o caso comum continua passando", () => {
  const legitimos = [
    "Aceita brócolis cozido",
    "Dorme melhor com luz apagada",
    "Não gosta de frutas",
    "Consegue esperar quando usa timer",
  ];
  for (const texto of legitimos) {
    it(`persiste: "${texto}"`, () => {
      const r = resolverMembro({
        membroId: "m-pedro",
        fonte: "selecao_explicita",
        texto,
        nomesDaFamilia: familiaComDois,
      });
      expect(r.decisao).toBe("persistir");
    });
  }
});

describe("toda decisão é explicável", () => {
  it("carrega fonte, confiança, sinais, contra-sinais e motivo", () => {
    const r = resolverMembro({
      membroId: "m-pedro",
      fonte: "primeiro_da_familia",
      texto: "A Ana chorou muito",
      nomesDaFamilia: familiaComDois,
    });
    expect(r.fonte).toBe("primeiro_da_familia");
    expect(r.confianca).toBe("baixa");
    expect(r.sinais.length).toBeGreaterThan(0);
    expect(r.contraSinais.length).toBeGreaterThan(0);
    expect(r.motivo).toBeTruthy();
  });
});
