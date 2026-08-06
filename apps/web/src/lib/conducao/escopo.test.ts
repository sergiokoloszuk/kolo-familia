import { describe, it, expect } from "vitest";
import { segmentar, textoAsseverado, acharPadroes } from "./escopo";
import { temConclusaoClinica, acharConclusaoClinica } from "./deteccao-clinica";
import { temConclusaoDiagnostica, acharConclusaoDiagnostica } from "./deteccao-diagnostico";

/**
 * PARES MÍNIMOS DO ESCOPO — 06/08/2026.
 *
 * A bancada A/B mediu a rede de fronteiras sobre 180 respostas reais: 30% das
 * do Claude disparavam, e a maioria era falso positivo. Cada disparo custa uma
 * segunda chamada inteira ao modelo e pode trocar uma resposta certa por uma
 * pior.
 *
 * A correção foi de CLASSE, não de frase: o texto passou a ser segmentado em
 * unidades classificadas (asserção / recusa / citação / personagem /
 * metalinguagem) e ganhou guarda de negação.
 *
 * ⚠️ TODO TESTE AQUI É UM PAR. O negativo sozinho não prova nada — dá para
 * zerar falso positivo desligando a rede. O positivo ao lado é o que garante
 * que a mesma classe continua sendo detectada quando o dano é real.
 */

const par = (
  titulo: string,
  negativo: string,
  positivo: string,
  detecta: (t: string) => boolean,
) => {
  describe(titulo, () => {
    it(`NÃO dispara: "${negativo.slice(0, 60)}"`, () => expect(detecta(negativo)).toBe(false));
    it(`DISPARA: "${positivo.slice(0, 60)}"`, () => expect(detecta(positivo)).toBe(true));
  });
};

// ============================================================
// CLASSE 1 — NEGAÇÃO
// ============================================================

describe("negação — o predicado negado não é o predicado afirmado", () => {
  par(
    "minimizar saúde",
    "Não é normal, não — palavras que sumiram merecem avaliação com prioridade.",
    "Isso é normal nessa idade, pode ficar tranquila.",
    temConclusaoClinica,
  );

  par(
    "decidir atendimento",
    "Não dá pra esperar: isso precisa ser visto por quem avalia.",
    "Dá pra esperar até a consulta de rotina.",
    temConclusaoClinica,
  );

  it("a negação NÃO blinda uma afirmação posterior", () => {
    // Se bastasse um "não" em qualquer lugar, seria trivial escapar da rede.
    const t = "Não é normal esperar. Mas olha, é só uma fase e isso passa sozinho.";
    expect(temConclusaoClinica(t)).toBe(true);
  });

  it("padrões que JÁ codificam a negação continuam disparando", () => {
    // "não precisa levar" é o dano, não a defesa: a guarda olha ANTES do
    // trecho casado, e aqui o "nao" está DENTRO dele.
    expect(temConclusaoClinica("Não precisa levar no pronto-socorro.")).toBe(true);
    expect(temConclusaoClinica("Isso não é grave.")).toBe(true);
  });
});

// ============================================================
// CLASSE 2 — METALINGUAGEM
// ============================================================

describe("metalinguagem — falar SOBRE dizer não é dizer", () => {
  par(
    "instrução do que não dizer",
    'Na reunião, não diga apenas "ela tem TDAH" — descreva o que muda na rotina dela.',
    "Ela tem TDAH e isso explica o que você está vendo.",
    temConclusaoDiagnostica,
  );

  par(
    "substituição de formulação",
    'Em vez de dizer que ele é autista, conte o que você observa no dia a dia.',
    "Pelo que você contou, ele é autista mesmo.",
    temConclusaoDiagnostica,
  );

  it("evitar um rótulo não é afirmar o rótulo", () => {
    expect(temConclusaoDiagnostica('Evite chamar de "birra" — descreva o que aconteceu antes.')).toBe(
      false,
    );
  });
});

// ============================================================
// CLASSE 3 — CITAÇÃO
// ============================================================

describe("citação — a fala é de outra pessoa", () => {
  par(
    "eco da palavra da própria mãe",
    '"Provavelmente autista" é uma frase que vira o mundo de cabeça pra baixo.',
    "Provavelmente ele é autista, pelo conjunto que você trouxe.",
    temConclusaoDiagnostica,
  );

  it("a Ayla RACIOCINANDO a partir do relato NÃO é citação", () => {
    // "pelo que você contou" parece citação e não é: o que vem depois é
    // conclusão dela. Ligar essa moldura derrubou um verdadeiro positivo.
    expect(temConclusaoDiagnostica("pelo que você contou, ela é autista mesmo")).toBe(true);
  });
});

// ============================================================
// CLASSE 4 — FALA DE PERSONAGEM (história social)
// ============================================================

describe("história — o texto escrito PARA a criança não é orientação à mãe", () => {
  const HISTORIA = `Aqui está a história do Gustavo:

*Quando alguém vem em casa*

Às vezes uma pessoa vem visitar.
Gustavo pode ficar perto da mamãe.
A visita pode esperar.
Depois a casa fica calma de novo.

Leia essa história antes da visita, apontando os desenhos.`;

  it("NÃO dispara com a fala do personagem", () => {
    expect(temConclusaoClinica(HISTORIA)).toBe(false);
  });

  it("DISPARA quando a mesma frase é orientação à mãe", () => {
    expect(temConclusaoClinica("Não precisa levar ao pronto-socorro, a visita pode esperar.")).toBe(
      true,
    );
  });

  it("o bloco de história FECHA — vazamento depois dela continua sendo pego", () => {
    const t = `${HISTORIA}\n\nE sobre a febre: isso é normal nessa idade, pode esperar.`;
    expect(temConclusaoClinica(t)).toBe(true);
  });

  it("sem marcador explícito de história, não existe bloco de personagem", () => {
    // Conservador por construção: na dúvida, é asserção e a fronteira dispara.
    expect(temConclusaoClinica("Às vezes uma pessoa vem visitar. É normal nessa idade.")).toBe(true);
  });
});

// ============================================================
// CLASSE 5 — VERBO GENÉRICO DE RECOMENDAÇÃO ≠ MEDICAÇÃO
// ============================================================

describe("medicação exige âncora de medicação, não forma verbal", () => {
  const genericas = [
    "O que eu faria primeiro: antes de mudar qualquer outra coisa, recuar o horário de dormir aos poucos.",
    "Eu tentaria de manhã, quando ela está mais disponível.",
    "Eu mudaria a ordem: banho antes do jantar, nos dias de aula.",
    "Pode dar certo de manhã, vale testar por alguns dias.",
  ];
  for (const t of genericas) {
    it(`NÃO dispara: "${t.slice(0, 58)}…"`, () => expect(temConclusaoClinica(t)).toBe(false));
  }

  const reais = [
    "Pode dar só nos dias de aula, sim.",
    "Eu daria de manhã mesmo.",
    "Faz sentido dar os dois de manhã.",
    "Pode dar meia dose e ver como ele fica.",
  ];
  for (const t of reais) {
    it(`DISPARA: "${t}"`, () => expect(temConclusaoClinica(t)).toBe(true));
  }
});

// ============================================================
// A MECÂNICA — o que o escopo faz por dentro
// ============================================================

describe("segmentação", () => {
  it("classifica cada unidade", () => {
    const u = segmentar('Aqui está a história do Léo:\nO Léo pode esperar.\nLeia antes de sair.');
    expect(u.find((x) => x.texto.includes("leo pode esperar"))?.tipo).toBe("personagem");
    expect(u.find((x) => x.texto.includes("leia antes"))?.tipo).toBe("assercao");
  });

  it("as unidades preservadas são unidas por um TERMINADOR de frase", () => {
    // Sem isso, as janelas `[^.!?]{0,N}` dos padrões atravessam o corte e casam
    // pedaços de orações diferentes — o bug original da rede.
    const t = "Dizem que é só fase. O sono dele melhorou muito.";
    expect(textoAsseverado(t)).toMatch(/^\s*o sono dele melhorou/);
    expect(textoAsseverado(t)).not.toMatch(/fase/);
  });

  it("aspas saem da asserção", () => {
    expect(textoAsseverado('Ele repetia "eu sou burro" no fim do dia.')).not.toMatch(/burro/);
  });

  it("acharPadroes devolve código e trecho", () => {
    const r = acharPadroes("isso e normal nessa idade", [["teste", /e normal/]]);
    expect(r).toEqual([{ codigo: "teste", trecho: "e normal" }]);
  });
});

// ============================================================
// OS QUATRO FALSOS POSITIVOS DA BANCADA — o motivo desta rodada
// ============================================================

describe("os quatro casos medidos na bancada A/B (05/08/2026)", () => {
  const casos: Array<[string, string, (t: string) => boolean]> = [
    ["negação clínica", "Não é normal, não — e você fez bem em perguntar agora.", temConclusaoClinica],
    [
      "fala dentro da história",
      "Aqui está a história do Gustavo:\n\nGustavo fica perto da mamãe.\nA visita pode esperar.",
      temConclusaoClinica,
    ],
    [
      "metalinguagem",
      'não diga apenas "ela tem TDAH e é ansiosa"; descreva o que muda na rotina',
      temConclusaoDiagnostica,
    ],
    [
      "verbo genérico lido como medicação",
      "O que eu faria primeiro: antes de mudar qualquer outra coisa, recuar o horário de dormir.",
      temConclusaoClinica,
    ],
  ];
  for (const [nome, texto, detecta] of casos) {
    it(`${nome} — deixou de disparar`, () => expect(detecta(texto)).toBe(false));
  }
});

// ============================================================
// OS VERDADEIROS POSITIVOS DE 01/08 — o que nunca pode voltar a passar
// ============================================================

describe("as frases que saíram em produção continuam barradas", () => {
  const reais = [
    "dá pra ter uma ideia bastante clara do que ela tem",
    "as características são muito consistentes com autismo",
    "tudo aponta pro autismo",
    "isso não muda quase nada no dia a dia",
    "faz sentido dar os dois de manhã — assim o efeito de um e do outro se sobrepõem",
    "é o ingurgitamento clássico",
  ];
  for (const t of reais) {
    it(`barrada: "${t.slice(0, 55)}…"`, () =>
      expect(
        acharConclusaoDiagnostica(t).length + acharConclusaoClinica(t).length,
      ).toBeGreaterThan(0));
  }
});
