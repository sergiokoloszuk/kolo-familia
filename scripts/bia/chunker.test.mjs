import { describe, expect, it } from "vitest";
import { tituloParaClassificar, tipoPorSecao } from "./chunker.mjs";

/**
 * NORMALIZAÇÃO ESTRUTURAL DO TÍTULO.
 *
 * O que se protege aqui é a fronteira entre "elemento editorial" e "conteúdo":
 * tirar de menos deixa a inferência de tipo cega ao travessão; tirar de mais
 * mutila título que tem número de verdade. Os dois erros são silenciosos — o
 * chunk sai classificado errado e ninguém percebe até a Ayla usar.
 */

describe("tituloParaClassificar", () => {
  it("numeração simples com ponto", () => {
    expect(tituloParaClassificar("3. Controle Inibitório")).toBe("Controle Inibitório");
    expect(tituloParaClassificar("12. Dificuldades de Leitura")).toBe("Dificuldades de Leitura");
  });

  it("numeração hierárquica", () => {
    expect(tituloParaClassificar("6.2 Neurônios-Espelho")).toBe("Neurônios-Espelho");
    expect(tituloParaClassificar("1.7.3 Detalhe")).toBe("Detalhe");
  });

  it("hífen, travessão e meia-risca", () => {
    expect(tituloParaClassificar("4.1 - Comunicação Funcional")).toBe("Comunicação Funcional");
    expect(tituloParaClassificar("6.2 — Neurônios-Espelho")).toBe("Neurônios-Espelho");
    expect(tituloParaClassificar("1.7 – Tipos de Imitação")).toBe("Tipos de Imitação");
  });

  it("outras variações Unicode de traço", () => {
    // ― barra horizontal, ‒ traço de figura, − sinal de menos, · ponto médio
    expect(tituloParaClassificar("2.1 ― Assunto")).toBe("Assunto");
    expect(tituloParaClassificar("2.2 ‒ Assunto")).toBe("Assunto");
    expect(tituloParaClassificar("2.3 − Assunto")).toBe("Assunto");
    expect(tituloParaClassificar("2.4 · Assunto")).toBe("Assunto");
  });

  it("espaços múltiplos são colapsados", () => {
    expect(tituloParaClassificar("5.   Iniciação")).toBe("Iniciação");
    expect(tituloParaClassificar("  6.2   —   Neurônios-Espelho  ")).toBe("Neurônios-Espelho");
    expect(tituloParaClassificar("Atenção   Compartilhada")).toBe("Atenção Compartilhada");
  });

  it("título sem numeração passa inteiro", () => {
    expect(tituloParaClassificar("Princípios que Sustentam Tudo")).toBe(
      "Princípios que Sustentam Tudo",
    );
    expect(tituloParaClassificar("TEMA 6 · Os Despertares Noturnos")).toBe(
      "TEMA 6 · Os Despertares Noturnos",
    );
  });

  it("número que é CONTEÚDO não é removido", () => {
    // Sem ponto e sem traço depois do número, não é marca editorial.
    expect(tituloParaClassificar("5 sinais de alerta")).toBe("5 sinais de alerta");
    expect(tituloParaClassificar("3 a 5 anos")).toBe("3 a 5 anos");
    // Número no meio nunca é tocado.
    expect(tituloParaClassificar("2.1 — Os 20 princípios")).toBe("Os 20 princípios");
    expect(tituloParaClassificar("Autonomia aos 12 anos")).toBe("Autonomia aos 12 anos");
  });

  it("não devolve resto vazio: se sobrar quase nada, fica o original", () => {
    expect(tituloParaClassificar("7.")).toBe("7.");
    expect(tituloParaClassificar("3 - a")).toBe("3 - a");
  });

  it("entrada vazia ou ausente não quebra", () => {
    expect(tituloParaClassificar("")).toBe("");
    expect(tituloParaClassificar(null)).toBe("");
    expect(tituloParaClassificar(undefined)).toBe("");
  });

  it("os títulos reais que apareceram na auditoria", () => {
    const reais = [
      ["1.7 — Tipos de Imitação (classificação clínica funcional)", "Tipos de Imitação (classificação clínica funcional)"],
      ["24. Como Descobrir Onde A Aprendizagem Se Rompe", "Como Descobrir Onde A Aprendizagem Se Rompe"],
      ["10.1 Conhecimentos que fortalecem a família", "Conhecimentos que fortalecem a família"],
      ["3.5 — Escola", "Escola"],
      ["6.1 — Aprendizagem Observacional", "Aprendizagem Observacional"],
      ["16. FUNÇÕES EXECUTIVAS \"QUENTES\" E \"FRIAS\"", 'FUNÇÕES EXECUTIVAS "QUENTES" E "FRIAS"'],
      ["21. A CRIANÇA CONSEGUE NO HIPERFOCO, MAS NÃO NA TAREFA", "A CRIANÇA CONSEGUE NO HIPERFOCO, MAS NÃO NA TAREFA"],
      ["8.5 — \"Ele está me ignorando.\"", '"Ele está me ignorando."'],
    ];
    for (const [entrada, esperado] of reais) {
      expect(tituloParaClassificar(entrada), entrada).toBe(esperado);
    }
  });
});

describe("a normalização serve SÓ à classificação", () => {
  it("não muta a entrada — o título original segue intacto no chunk", () => {
    const original = "6.2 — Neurônios-Espelho";
    const copia = String(original);
    tituloParaClassificar(original);
    expect(original).toBe(copia);
  });

  it("o tipo pode vir da forma normalizada quando o cru não casa", () => {
    // "tipos de" é regra existente; o travessão impedia o casamento.
    expect(tipoPorSecao("1.7 — Tipos de Imitação", null)).toBe("conceito");
  });
});

describe("nenhuma regressão no que já classificava certo", () => {
  /**
   * Cada par abaixo já produzia este tipo ANTES da normalização. Se algum
   * mudar, a normalização passou a atrapalhar em vez de ajudar.
   */
  const jaFuncionavam = [
    ["TEMA 6 · Os Despertares Noturnos", "conceito"],
    ["14. Conhecimento para IA", "regra_operacional"],
    ["Princípios de Ouro", "principio_de_ouro"],
    ["Perguntas Investigativas", "pergunta_investigativa"],
    ["Raciocínio Clínico", "interpretacao"],
    ["Crenças Limitantes", "interpretacao"],
    ["Estratégias Práticas", "estrategia"],
    ["Quando encaminhar", "encaminhamento"],
    ["Sinais de alerta", "sinal_de_alerta"],
    ["Orientação para professores", "orientacao_para_escola"],
    ["Dúvidas frequentes", "explicacao_para_familia"],
    // A subseção que é SÓ faixa etária depende da numeração para casar — é o
    // caso que prova por que o título CRU é tentado antes do normalizado.
    ["4.2 — 3–5 anos", "conceito"],
  ];

  for (const [secao, tipo] of jaFuncionavam) {
    it(`"${secao}" continua ${tipo}`, () => {
      expect(tipoPorSecao(secao, null)).toBe(tipo);
    });
  }

  it("o bloco de princípios continua tendo precedência", () => {
    expect(tipoPorSecao("2. Seletividade não é teimosia", "principios")).toBe("fundamento");
  });

  it("título sem nenhuma regra continua sem tipo — normalizar não inventa", () => {
    expect(tipoPorSecao("6.2 — Neurônios-Espelho", null)).toBeNull();
    expect(tipoPorSecao("3.5 — Escola", null)).toBeNull();
  });
});
