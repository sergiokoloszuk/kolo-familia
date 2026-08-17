import { describe, it, expect } from "vitest";
import { porGenero, type Membro } from "./experimental-foco";

/**
 * DE QUEM A MÃE ESTÁ FALANDO — quando ela não diz o nome.
 *
 * Caso real, 17/08/2026. A Karina escreveu:
 *
 *   "Ai, minha FILHA não come, eu já não sei mais o que fazer,
 *    ELA não aceita nada."
 *
 * A Ayla respondeu: *"você está falando da Manu ou do Mario?"*.
 *
 * Mario é masculino, Manu é feminina, e `membros_atipicos.genero` existe desde
 * sempre. A escada de `resolverFoco` tinha seis degraus — nome citado, plural,
 * um nome, filho único, última criança de 24h, ambíguo — e **nenhum** olhava
 * gênero. A mensagem caía direto no último e virava pergunta.
 *
 * ⚠️ A CORREÇÃO PRECISA SER CONSERVADORA, e é aqui que ela pode dar errado.
 * Trocar "uma pergunta a mais" por "um fato gravado na criança errada" seria um
 * péssimo negócio — é o que o próprio código já teme: *"escolher no chute é
 * exatamente como uma informação do Mario vira fato sobre a Manu"*. Por isso
 * parentesco explícito é sinal FORTE e pronome solto é sinal FRACO.
 */

const MANU: Membro = { id: "manu", nome: "Manu", genero: "feminino" };
const MARIO: Membro = { id: "mario", nome: "Mario", genero: "masculino" };
const IRMAOS = [MARIO, MANU];

describe("PARENTESCO EXPLÍCITO — sinal forte", () => {
  it("o caso da Karina: 'minha filha não come' resolve na Manu", () => {
    expect(porGenero("Ai, minha filha não come, ela não aceita nada", IRMAOS)?.id).toBe("manu");
  });

  it("'meu filho' resolve no Mario", () => {
    expect(porGenero("meu filho não quer ir para a escola", IRMAOS)?.id).toBe("mario");
  });

  it("'a menina' e 'o menino' também valem", () => {
    expect(porGenero("a menina acordou chorando", IRMAOS)?.id).toBe("manu");
    expect(porGenero("o menino não dormiu", IRMAOS)?.id).toBe("mario");
  });

  it("os DOIS na mesma frase não desambiguam nada", () => {
    expect(porGenero("minha filha e meu filho brigaram", IRMAOS)).toBeNull();
  });
});

describe("MESMO GÊNERO — continua ambíguo, como tem de ser", () => {
  const DUAS = [
    { id: "a", nome: "Alice", genero: "feminino" },
    { id: "b", nome: "Bia", genero: "feminino" },
  ];

  it("duas filhas e 'minha filha' → não escolhe", () => {
    expect(porGenero("minha filha não come", DUAS)).toBeNull();
  });

  it("dois filhos e 'meu filho' → não escolhe", () => {
    const DOIS = [
      { id: "a", nome: "Bento", genero: "masculino" },
      { id: "b", nome: "Caio", genero: "masculino" },
    ];
    expect(porGenero("meu filho não come", DOIS)).toBeNull();
  });

  it("mas 'meu filho' com uma filha e um filho ainda resolve", () => {
    expect(porGenero("meu filho não come", IRMAOS)?.id).toBe("mario");
  });
});

describe("PRONOME SOLTO — sinal fraco, e conservador", () => {
  it("'ela não dorme' resolve quando não há mais ninguém em cena", () => {
    expect(porGenero("ela não dorme direito", IRMAOS)?.id).toBe("manu");
  });

  it("'ele' idem", () => {
    expect(porGenero("ele acordou bem hoje", IRMAOS)?.id).toBe("mario");
  });

  it("NÃO escolhe quando há outra pessoa na frase — a professora", () => {
    // "ela" aqui é a professora, não a criança. Escolher seria gravar fato na
    // criança errada, que é pior que perguntar.
    expect(porGenero("a professora disse que ela não presta atenção", IRMAOS)).toBeNull();
  });

  it("NÃO escolhe com avó, fono, terapeuta, médica, babá", () => {
    for (const p of ["a avó", "a fono", "a terapeuta", "a médica", "a babá"]) {
      expect(porGenero(`${p} falou que ela está diferente`, IRMAOS), p).toBeNull();
    }
  });

  it("'ela' e 'ele' juntos não resolvem", () => {
    expect(porGenero("ela e ele brigaram", IRMAOS)).toBeNull();
  });

  it("texto sem pronome e sem parentesco não resolve", () => {
    expect(porGenero("está difícil hoje", IRMAOS)).toBeNull();
  });
});

describe("GÊNERO AUSENTE OU DESCONHECIDO", () => {
  it("criança sem gênero cadastrado não é escolhida", () => {
    const semGenero = [
      { id: "a", nome: "Alex", genero: null },
      { id: "b", nome: "Sam", genero: null },
    ];
    expect(porGenero("minha filha não come", semGenero)).toBeNull();
  });

  it("só uma das duas tem gênero: resolve se casar, nunca por eliminação", () => {
    const misto = [
      { id: "a", nome: "Alex", genero: null },
      { id: "b", nome: "Manu", genero: "feminino" },
    ];
    expect(porGenero("minha filha não come", misto)?.id).toBe("b");
    // "meu filho" NÃO pode cair no Alex só porque ele é o que sobrou.
    expect(porGenero("meu filho não come", misto)).toBeNull();
  });
});
