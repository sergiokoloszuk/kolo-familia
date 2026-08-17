import { describe, it, expect } from "vitest";
import { montarContextoBase, interessesAtuais } from "./experimental-contexto";

/**
 * O QUE A CRIANÇA É — e o caso real que pagou por este arquivo.
 *
 * 17/08/2026, conversa real da Karina. Ela escreveu que a filha não come e que
 * "não aceita nada". Perguntou em seguida: **"O que você sabe que ela aceita
 * já?"**. A Ayla respondeu *"você ainda não me disse quais alimentos
 * específicos a Manu aceita"*.
 *
 * Só que o perfil da Manu tinha, em `como_e.texto`:
 *
 *     "Adora uva passa.
 *      Fica triste quando a barata é morta — demonstra sensibilidade/empatia."
 *
 * A informação existia, a coluna `como_e` ERA buscada no banco, e mesmo assim
 * não chegava ao modelo: `interessesAtuais` extrai só `como_e.interesses` — o
 * array de temas — e o `texto` era descartado na montagem do contexto.
 *
 * É o §15 do protocolo na forma mais cara: disponível, recuperada, NÃO
 * injetada. Para a mãe, o efeito é a Ayla perguntar o que a Kolo já sabia.
 *
 * ⚠️ Estes testes medem o BLOCO que vai para o `system`, não a consulta ao
 * banco. Provar que a coluna foi lida não prova que o conteúdo chegou.
 */

const PERFIL_DA_MANU = {
  como_e: {
    texto:
      "Adora uva passa.\nFica triste quando a barata é morta — demonstra sensibilidade/empatia após o susto.",
    interesses: ["Cozinha", "Dinossauro", "Cinema"],
    atualizado_em: "2026-05-24T01:04:19.908Z",
  },
  sensorial: {
    texto: "Cobre os ouvidos com barulhos altos. Não gosta de abraço. Adora roupa macia.",
  },
} as never;

const MEMBRO = {
  nome: "Manu",
  data_nascimento: "2020-03-01",
  diagnosticos_formais: [],
};

function blocoDaManu() {
  return montarContextoBase({
    nomeResponsavel: "Karina",
    membro: MEMBRO,
    perfilVivo: PERFIL_DA_MANU,
  }).bloco;
}

describe("O TEXTO DE `como_e` CHEGA AO CONTEXTO", () => {
  it("um fato concreto já registrado aparece no bloco que vai ao modelo", () => {
    // ⚠️ ESTE É O TESTE QUE FALHA ANTES DA CORREÇÃO. "Adora uva passa" estava
    // no banco e não chegava ao prompt — foi o que produziu a resposta errada.
    expect(blocoDaManu()).toContain("uva passa");
  });

  it("e não é só a primeira frase: o resto do retrato também entra", () => {
    // `como_e` é o campo "quem é essa criança". Cortar na primeira frase aqui
    // jogaria fora justamente a parte que descreve o jeito dela.
    expect(blocoDaManu()).toContain("sensibilidade");
  });

  it("os interesses CONTINUAM entrando — a correção não troca uma coisa pela outra", () => {
    const b = blocoDaManu();
    expect(b).toContain("Cozinha");
    expect(b).toContain("Dinossauro");
    expect(interessesAtuais(PERFIL_DA_MANU)).toEqual(["Cozinha", "Dinossauro", "Cinema"]);
  });

  it("perfil sem `como_e.texto` não inventa linha nem quebra", () => {
    const bloco = montarContextoBase({
      nomeResponsavel: "Karina",
      membro: MEMBRO,
      perfilVivo: { como_e: { interesses: ["Cozinha"] } } as never,
    }).bloco;
    expect(bloco).toContain("Manu");
    expect(bloco).toContain("Cozinha");
    expect(bloco.toLowerCase()).not.toContain("undefined");
    expect(bloco.toLowerCase()).not.toContain("null");
  });

  it("`como_e` ausente por completo não quebra", () => {
    const bloco = montarContextoBase({
      nomeResponsavel: "Karina",
      membro: MEMBRO,
      perfilVivo: {} as never,
    }).bloco;
    expect(bloco).toContain("Manu");
  });

  it("placeholder no texto não vira retrato", () => {
    // `pareceInformacao` já filtra vazio/placeholder; aqui só se garante que a
    // linha nova respeita esse filtro em vez de despejar qualquer string.
    const bloco = montarContextoBase({
      nomeResponsavel: "Karina",
      membro: MEMBRO,
      perfilVivo: { como_e: { texto: "   " } } as never,
    }).bloco;
    expect(bloco).not.toMatch(/Como (ela|ele) é:\s*$/m);
  });
});
