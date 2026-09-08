import { describe, expect, it } from "vitest";
import { blocoDeTransicoes, pontoDificilAtual } from "./rotina-guiada";

/**
 * GATE A · A2 — SEMÂNTICA TEMPORAL DE `categorias_extras.transicoes`.
 *
 * ⚠️ O QUE ESTES TESTES PRENDEM, e por que eles existem. Em 08/09/2026 provei
 * que o barco da Manu e o sudoku do Mario NÃO vinham do retrato geral do perfil
 * (`desafiosAtuais` descarta arrays, e `transicoes` é um array). Vinham daqui:
 * o prompt da Rotina recebia "TRANSIÇÕES JÁ CONHECIDAS (use proativamente)"
 * seguido de `passeio de barco → rotina visual para antecipar os passos`.
 *
 * O modelo não inventou nada. Ele obedeceu.
 *
 * ⚠️ A REGRA DE PRODUTO que estes testes verificam: a **estratégia** é
 * reutilizável; o **contexto** em que ela foi aprendida, não. E a prova de que
 * `barco = 0` não pode depender de o modelo obedecer a uma ressalva — depende
 * de a palavra "barco" não estar no prompt.
 *
 * ⚠️ OS DADOS SÃO OS REAIS. `passeio de barco` está em `perfil_vivo_membro` da
 * Manu (`0eedfdae`) e `sudoku - frustração com puzzle complexo` no do Mario
 * (`7da80c3a`), ambos sem `atualizado_em` e sem `tipo` — como as 47 entradas
 * medidas em 13 perfis no dia deste commit.
 */

const HOJE = new Date("2026-09-08T12:00:00Z");
const diasAtras = (n: number) => new Date(HOJE.getTime() - n * 86400_000).toISOString();

describe("Gate A · transições: episódio histórico não vira fato atual", () => {
  it("MANU/BARCO — o passeio de barco não chega ao prompt", () => {
    const bloco = blocoDeTransicoes(
      [
        {
          momento: "passeio de barco",
          estrategia: "rotina visual para antecipar os passos e reduzir o medo",
          funcionou: null,
          merece_plano: false,
        },
        {
          momento: "arrumação do quarto",
          estrategia: "instrução visual por passos + modelo físico",
          funcionou: null,
          merece_plano: false,
        },
      ],
      HOJE,
    );

    expect(bloco.toLowerCase()).not.toContain("barco");
    expect(bloco.toLowerCase()).not.toContain("passeio");
    // O aprendizado sobrevive: é ele que personaliza sem inventar.
    expect(bloco).toContain("rotina visual para antecipar os passos");
  });

  it("MARIO/SUDOKU — o sudoku não chega ao prompt", () => {
    const bloco = blocoDeTransicoes(
      [
        { momento: "sudoku - frustração com puzzle complexo", estrategia: null, funcionou: null },
        { momento: "frustracao_com_puzzle_complexo_sudoku", estrategia: null, funcionou: null },
        {
          momento: "transicoes_abruptas_roupa_entrega_presente",
          estrategia: "avisar antes da troca",
          funcionou: null,
        },
      ],
      HOJE,
    );

    expect(bloco.toLowerCase()).not.toContain("sudoku");
    expect(bloco.toLowerCase()).not.toContain("puzzle");
    expect(bloco).toContain("avisar antes da troca");
  });

  it("a estratégia é reutilizável SEM transportar o contexto antigo", () => {
    const bloco = blocoDeTransicoes(
      [{ momento: "consulta no dentista em julho", estrategia: "antecipação visual", funcionou: true }],
      HOJE,
    );

    expect(bloco).toContain("antecipação visual");
    expect(bloco.toLowerCase()).not.toContain("dentista");
    expect(bloco.toLowerCase()).not.toContain("julho");
  });

  it("o bloco diz explicitamente que a estratégia NÃO é o que acontece hoje", () => {
    const bloco = blocoDeTransicoes([{ momento: "viagem", estrategia: "combinar antes" }], HOJE);
    expect(bloco).toMatch(/NÃO são o que está acontecendo hoje/);
    expect(bloco).toMatch(/NÃO viram etapa/);
  });
});

describe("Gate A · transições: padrão ≠ episódio", () => {
  it("padrão RECENTE mantém o momento — é reutilizável de verdade", () => {
    const bloco = blocoDeTransicoes(
      [
        {
          momento: "sair do celular para a lição",
          estrategia: "aviso de 10 minutos",
          tipo: "padrao",
          atualizado_em: diasAtras(5),
        },
      ],
      HOJE,
    );

    expect(bloco).toContain("sair do celular para a lição");
    expect(bloco).toMatch(/MOMENTOS DIFÍCEIS QUE SE REPETEM/);
  });

  it("EPISÓDIO recente também perde o momento — recência não promove episódio", () => {
    const bloco = blocoDeTransicoes(
      [
        {
          momento: "passeio de barco",
          estrategia: "antecipação visual",
          tipo: "episodio",
          atualizado_em: diasAtras(1),
        },
      ],
      HOJE,
    );

    expect(bloco.toLowerCase()).not.toContain("barco");
    expect(bloco).toContain("antecipação visual");
  });

  it("padrão VELHO (> 60 dias) deixa de ser oferecido como coisa de agora", () => {
    const bloco = blocoDeTransicoes(
      [
        {
          momento: "recusa de mamadeira",
          estrategia: "trocar a temperatura",
          tipo: "padrao",
          atualizado_em: diasAtras(120),
        },
      ],
      HOJE,
    );

    expect(bloco.toLowerCase()).not.toContain("mamadeira");
    expect(bloco).toContain("trocar a temperatura");
  });

  it("a fronteira é 60 dias — 59 é atual, 61 não é", () => {
    const faz = (dias: number) =>
      blocoDeTransicoes(
        [{ momento: "hora de dormir", estrategia: "música", tipo: "padrao", atualizado_em: diasAtras(dias) }],
        HOJE,
      );
    expect(faz(59)).toContain("hora de dormir");
    expect(faz(61).toLowerCase()).not.toContain("hora de dormir");
  });
});

describe("Gate A · transições: legado é tratado conservadoramente", () => {
  it("SEM DATA e SEM TIPO nunca é promovido a padrão atual", () => {
    // As 47 entradas reais da base são exatamente assim.
    const bloco = blocoDeTransicoes(
      [{ momento: "escovar dentes", estrategia: "música depois", funcionou: null }],
      HOJE,
    );

    expect(bloco.toLowerCase()).not.toContain("escovar dentes");
    expect(bloco).toContain("música depois");
    expect(bloco).not.toMatch(/MOMENTOS DIFÍCEIS QUE SE REPETEM/);
  });

  it("tipo 'padrao' SEM data não basta — data ausente é legado", () => {
    const bloco = blocoDeTransicoes([{ momento: "banho", estrategia: "brinquedo", tipo: "padrao" }], HOJE);
    expect(bloco.toLowerCase()).not.toContain("banho");
  });

  it("data corrompida não vira atual por acidente", () => {
    const bloco = blocoDeTransicoes(
      [{ momento: "banho", estrategia: "brinquedo", tipo: "padrao", atualizado_em: "não é data" }],
      HOJE,
    );
    expect(bloco.toLowerCase()).not.toContain("banho");
    expect(bloco).toContain("brinquedo");
  });
});

describe("Gate A · transições: o que NÃO pode ser bloqueado demais", () => {
  it("o que não funcionou continua chegando, marcado como já tentado", () => {
    const bloco = blocoDeTransicoes(
      [{ momento: "sair de casa", estrategia: "contagem regressiva", funcionou: false }],
      HOJE,
    );

    expect(bloco).toContain("contagem regressiva");
    expect(bloco).toMatch(/não funcionou/);
  });

  it("perfil sem transição nenhuma devolve vazio — sem bloco fantasma", () => {
    expect(blocoDeTransicoes([], HOJE)).toBe("");
  });

  it("entrada sem estratégia e sem tipo não deixa resíduo no prompt", () => {
    const bloco = blocoDeTransicoes([{ momento: "sudoku", estrategia: null }], HOJE);
    expect(bloco).toBe("");
  });

  it("não repete a mesma estratégia aprendida em situações diferentes", () => {
    const bloco = blocoDeTransicoes(
      [
        { momento: "barco", estrategia: "antecipação visual" },
        { momento: "dentista", estrategia: "antecipação visual" },
        { momento: "escola", estrategia: "antecipação visual" },
      ],
      HOJE,
    );
    expect(bloco.match(/antecipação visual/g)).toHaveLength(1);
  });

  it("padrão atual e estratégia histórica convivem no mesmo bloco", () => {
    const bloco = blocoDeTransicoes(
      [
        { momento: "início da lição", estrategia: "timer", tipo: "padrao", atualizado_em: diasAtras(3) },
        { momento: "passeio de barco", estrategia: "antecipação visual", tipo: "episodio" },
      ],
      HOJE,
    );

    expect(bloco).toContain("início da lição");
    expect(bloco).toContain("antecipação visual");
    expect(bloco.toLowerCase()).not.toContain("barco");
  });
});

/**
 * A SEXTA PORTA — 08/09/2026 11:16, e a mais bem escondida do dia.
 *
 * ⚠️ `pontoDificilDoTurno` lia `transicoesConhecidas[0]?.momento` — o índice
 * ZERO do array CRU do perfil. Para o Mario, isso é
 * "sudoku - frustração com puzzle complexo". O valor virava instrução literal
 * ao gerador ("o que mais trava no dia: … quebre em passos menores, com uma
 * etapa de preparação antes dele") e produzia a rotina de sudoku — com a etapa
 * de preparação e tudo, exatamente como pedido.
 *
 * O Gate A sanitizou a RENDERIZAÇÃO (`blocoDeTransicoes`) e deixou o ARRAY.
 * Cinco correções fecharam portas do texto; esta é do dado.
 */
describe("Gate A · o ponto difícil não sai de episódio antigo", () => {
  const HOJE2 = new Date("2026-09-08T12:00:00Z");
  const dias = (n: number) => new Date(HOJE2.getTime() - n * 86400_000).toISOString();

  /** O perfil real do Mario, na ordem em que está gravado. */
  const MARIO = [
    { momento: "sudoku - frustração com puzzle complexo", estrategia: null },
    { momento: "frustracao_com_puzzle_complexo_sudoku", estrategia: null },
    { momento: "transicoes_abruptas_roupa_entrega_presente", estrategia: "avisar antes" },
  ];

  it("REGRESSÃO: com sequência ditada, o perfil não impõe ponto difícil", () => {
    expect(pontoDificilAtual(null, MARIO, true, HOJE2)).toBeNull();
  });

  it("REGRESSÃO: sem tipo e sem data, episódio antigo nunca vira ponto difícil", () => {
    expect(pontoDificilAtual(null, MARIO, false, HOJE2)).toBeNull();
  });

  it("o que a conversa revelou AGORA manda sempre", () => {
    expect(pontoDificilAtual("guardar na geladeira", MARIO, true, HOJE2)).toBe("guardar na geladeira");
    expect(pontoDificilAtual("guardar na geladeira", MARIO, false, HOJE2)).toBe("guardar na geladeira");
  });

  it("padrão RECENTE do perfil vale quando a família não ditou", () => {
    const perfil = [{ momento: "sair do celular", estrategia: "aviso de 10 min", tipo: "padrao" as const, atualizado_em: dias(3) }];
    expect(pontoDificilAtual(null, perfil, false, HOJE2)).toBe("sair do celular");
  });

  it("padrão VELHO não vale", () => {
    const perfil = [{ momento: "sair do celular", estrategia: null, tipo: "padrao" as const, atualizado_em: dias(120) }];
    expect(pontoDificilAtual(null, perfil, false, HOJE2)).toBeNull();
  });

  it("episódio RECENTE também não vale — recência não promove episódio", () => {
    const perfil = [{ momento: "passeio de barco", estrategia: null, tipo: "episodio" as const, atualizado_em: dias(1) }];
    expect(pontoDificilAtual(null, perfil, false, HOJE2)).toBeNull();
  });

  it("perfil vazio não quebra", () => {
    expect(pontoDificilAtual(null, [], false, HOJE2)).toBeNull();
    expect(pontoDificilAtual("", [], true, HOJE2)).toBeNull();
  });
});
