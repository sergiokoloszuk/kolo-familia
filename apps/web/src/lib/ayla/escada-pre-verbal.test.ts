import { describe, expect, it } from "vitest";
import { perfilConsultavelDaLinha } from "@/lib/kolo-vivo/consultar";
import { escolherLacunaDecisiva, degrauProvadoPeloPerfil } from "./lacuna-decisiva";

/**
 * A ESCADA SE SOBE POR INTEIRO — PEND-192.
 *
 * ⚠️ O DEFEITO QUE ORIGINOU ESTE ARQUIVO é real e foi medido na linha de
 * produção de 10/09/2026: para uma criança que "lê e escreve com autonomia" e
 * "identifica contradições lógicas em argumentos dos adultos", o Gate B decidiu
 * que a pergunta decisiva era **contato visual** — degrau 1 da escada
 * pré-verbal. A guarda que existia só lia de baixo para cima.
 *
 * ⚠️ E O QUE ESTE ARQUIVO PROTEGE, MAIS DO QUE A CORREÇÃO, É O CASO CONTRÁRIO.
 * Para a criança não-verbal, contato visual é a pergunta CERTA. Uma regra cega
 * pelo "degrau acima preenchido" acertaria o primeiro caso e mataria o segundo —
 * por isso metade dos testes aqui mede falso positivo, não verdadeiro positivo.
 */

const L = (partes: string[]) => partes.join("\n");
const comPerfil = (comunicacao: string[], extras: Record<string, unknown> = {}) =>
  perfilConsultavelDaLinha({
    membro_atipico_id: "m1",
    categorias_extras: { comunicacao: { texto: L(comunicacao) }, ...extras },
  }, "m1");

const decidir = (perfil: ReturnType<typeof comPerfil>) =>
  escolherLacunaDecisiva({
    perfil,
    temas: ["comunicacao"],
    relato: "ele nao me conta o que aconteceu na escola",
  });

const chaveDe = (d: ReturnType<typeof decidir>) =>
  d.escolhida ? `${d.escolhida.dominio}.${d.escolhida.campo}` : null;

/** Os três degraus de baixo — os que uma prova de fala funcional dispensa. */
const PRE_VERBAIS = ["comunicacao.contato", "comunicacao.mostra", "comunicacao.iniciativa"];

describe("o perfil prova o pré-requisito", () => {
  /** O caso REAL de produção (família 7c764314), com os valores da linha. */
  const LORENZO = [
    "Como mostra o que quer: expressa preferências e escolhas quando perguntado diretamente",
    "Vocabulário e fala: lê e escreve com autonomia",
    "Conversa e argumentação: identifica contradições lógicas em argumentos dos adultos",
    "Entende o contexto: processa linguagem literal",
  ];

  it("quem lê e escreve não é perguntado sobre contato visual", () => {
    const d = decidir(comPerfil(LORENZO));
    expect(chaveDe(d)).not.toBe("comunicacao.contato");
    expect(PRE_VERBAIS).not.toContain(chaveDe(d));
  });

  it("o descarte fica registrado com motivo próprio — não some do rastro", () => {
    const d = decidir(comPerfil(LORENZO));
    const contato = d.descartadas.find((x) => x.chave === "comunicacao.contato");
    expect(contato?.motivo).toMatch(/pré-requisito provado/i);
  });

  it("argumentar prova o topo da escada, não o degrau de quem argumenta", () => {
    // Só `Conversa e argumentação` preenchido: mesmo assim o pré-requisito está
    // provado, e nenhum degrau pré-verbal sobra como candidato.
    const perfil = comPerfil([
      "Conversa e argumentação: questiona pressupostos dos adultos",
    ]);
    expect(degrauProvadoPeloPerfil(perfil)).toBe(5);
    expect(PRE_VERBAIS).not.toContain(chaveDe(decidir(perfil)));
  });

  it("fala em frases prova até o próprio degrau, e não além dele", () => {
    const perfil = comPerfil(["Como se comunica: Fala frases curtas"]);
    // `forma` é o degrau 4 (índice 3): dispensa os de baixo e nada mais.
    expect(degrauProvadoPeloPerfil(perfil)).toBe(3);
    const d = decidir(perfil);
    expect(PRE_VERBAIS).not.toContain(chaveDe(d));
    // `entende` e `vocabulario` continuam legítimos — estão ACIMA da prova.
    expect(["comunicacao.entende", "comunicacao.vocabulario", "socializacao.com_quem"]).toContain(
      chaveDe(d),
    );
  });
});

describe("o caso que não pode ser suprimido — a criança não-verbal", () => {
  /** O caso real `c7b57ea3`: degrau acima PREENCHIDO, e mesmo assim pré-verbal. */
  const NAO_VERBAL = [
    "Como se comunica: Não-verbal",
    "Como mostra o que quer: pega o objeto que quer; busca pela mão",
    "Mostra o que quer ou espera?: Mostra o que quer",
  ];

  it("degrau acima preenchido NÃO basta: contato visual continua sendo a pergunta", () => {
    const perfil = comPerfil(NAO_VERBAL);
    expect(degrauProvadoPeloPerfil(perfil)).toBe(-1);
    expect(chaveDe(decidir(perfil))).toBe("comunicacao.contato");
  });

  it("o veto vence o positivo — perfil contraditório não prova nada", () => {
    // "frases" casa com a evidência; "não-verbal" derruba a inferência inteira.
    const perfil = comPerfil([
      "Vocabulário e fala: começa a montar frases de duas palavras",
      "Como se comunica: Não-verbal na maior parte do tempo",
    ]);
    expect(degrauProvadoPeloPerfil(perfil)).toBe(-1);
  });

  it("palavras soltas não são fala funcional", () => {
    const perfil = comPerfil([
      "Como se comunica: Fala palavras soltas",
      "Vocabulário e fala: às vezes fala frases erradas ou faltando palavra",
    ]);
    expect(degrauProvadoPeloPerfil(perfil)).toBe(-1);
    expect(chaveDe(decidir(perfil))).toBe("comunicacao.contato");
  });

  it("quem usa CAA não tem o pré-requisito presumido", () => {
    const perfil = comPerfil([
      "Vocabulário e fala: escreve algumas palavras no tablet",
      "Comunicação alternativa (CAA): usa pranchas de figuras",
    ]);
    expect(degrauProvadoPeloPerfil(perfil)).toBe(-1);
  });
});

describe("os limites da regra, por escrito", () => {
  it("perfil sem domínio de comunicação não prova nada e nada muda", () => {
    const perfil = perfilConsultavelDaLinha({ membro_atipico_id: "m1", categorias_extras: {} }, "m1");
    expect(degrauProvadoPeloPerfil(perfil)).toBe(-1);
  });

  it("campo fora da lista fechada não prova, mesmo dizendo o mesmo", () => {
    // `entende` NÃO está entre os campos que provam: compreender não é falar.
    const perfil = comPerfil(["Como demonstra que entende: entende frases longas"]);
    expect(degrauProvadoPeloPerfil(perfil)).toBe(-1);
  });

  it("a prova não vaza para outro domínio — sensorial continua intocado", () => {
    const perfil = comPerfil(["Vocabulário e fala: lê e escreve"], {
      sensorial: { texto: "Perfil sensorial: Hipersensível" },
    });
    const d = escolherLacunaDecisiva({
      perfil,
      temas: ["sensorial"],
      relato: "ela tapa os ouvidos no mercado",
    });
    expect(d.escolhida?.dominio).toBe("sensorial");
  });
});
