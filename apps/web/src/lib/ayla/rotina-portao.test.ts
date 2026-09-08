import { describe, expect, it } from "vitest";
import { portaoDeterministicoDeRotina } from "./rotina-guiada";

/**
 * A BANCADA DO PORTÃO — frases REAIS de produção.
 *
 * ⚠️ POR QUE ELA EXISTE. Em 08/09/2026 três frases diferentes de UMA família
 * falharam em sequência, cada uma virando incidente em produção em vez de teste:
 *
 *   08:53  "Quero montar uma rotina visual para Manu…"   → passou
 *   09:13  "Quero montar uma sequencia visual…"          → FALHOU (só "rotina visual" era conhecida)
 *   09:59  "Mario / Rotina visual / Fazer bolo / …"      → FALHOU (sem verbo, ato="ambiguo")
 *
 * Corrigir frase a frase é jogo perdido. Estas entradas foram extraídas de 113
 * mensagens reais que mencionam rotina/sequência/cartões, dentro de 3.000
 * inbound de produção. A próxima frase nova entra aqui.
 *
 * ⚠️ O QUE ESTE PORTÃO É, E O QUE ELE NÃO É. Ele é o PISO determinístico —
 * barato, e só reconhece quem já pede pelo nome ou dita a lista. A mãe que **não
 * sabe pedir** ("queria mostrar pra ela a sequência do médico") é
 * responsabilidade do DECISOR, que roda em paralelo no orquestrador. Um `abre:
 * false` aqui NÃO significa "não é rotina" — significa "o caminho barato não
 * teve certeza". Os casos marcados `DECISOR` abaixo documentam exatamente essa
 * fronteira, e são a lista de trabalho do gate seguinte.
 */

const abre = (t: string) => portaoDeterministicoDeRotina(t).abre;

describe("pedidos explícitos — o piso tem de pegar todos", () => {
  const CASOS: Array<[string, string]> = [
    ["Manu 08:53", "Quero montar uma rotina visual para Manu\nBrincar \nTomar banho\nAlmoçar \nIr ao shopping"],
    ["Manu 09:13 (regressão)", "Quero montar uma sequencia visual\nPara Manu\nBrincar, tomar banho, almoçar,  ir ao shopping"],
    ["Mario 09:59 (regressão)", "Mario\nRotina visual\nFazer bolo \nGuardar na geladeira \nColocar vela \nCantar parabéns"],
    ["Mario academia", "Agora Mario\nQuero uma sequencia visual\nAcademia, casa da vovó, banho, jantar"],
    ["Mario dia inteiro", "Quero uma sequencia visual para o Mario\n\nAcordar estudar almoçar meditar fono jantar dormir"],
    ["Atibaia", "Hoje vamos para Atibaia \n\nQuero uma sequencia visual\nCafé \nArrumar mochila\nEstrada\nAlmoço no lago\nAndar de pedalinho\nBanho \nJantar"],
    ["verbo no fim", "E hoje teremos\nBrincadeira\nBanho\nAlmoço\nShopping\n\nMonta a rotina visual"],
    ["com tema junto", "Quero uma rotina visual\nEscola adventista\nTios\nPeruano\nCasa\n\nTema princesa"],
    ["curto e direto", "faz uma rotina pra ele"],
    ["período nomeado", "quero montar uma rotina da manhã pro André"],
    ["preparar", "Pode prepara a sequencia visual"],
  ];
  for (const [nome, texto] of CASOS) {
    it(`abre: ${nome}`, () => {
      expect(abre(texto), texto.slice(0, 60)).toBe(true);
    });
  }
});

describe("falar SOBRE rotina não é pedir rotina — o falso positivo tem custo", () => {
  const CASOS: Array<[string, string]> = [
    ["desabafo", "A questão da rotina do estudo, tá difícil porque juntou tudo, sabe? Juntou muita coisa."],
    ["queixa", "Faltou arrumar a mochila….eu não aguento mais falar as mesmas coisas, papel de rotina nada disso tem resolvido!"],
    ["relato de crise", "Não quis fazer lição teve uma crise grande dizendo que estava cansado da rotina"],
    ["negação explícita", "Não é rotina, mas sugestões de passeios em São Paulo Capital, criança de 13 anos, sábado e domingo."],
    ["fala da própria vida", "Eu tenho uma rotina meio puxada, sabe? Às vezes não dá tempo de levar isso na terapia."],
    ["descreve a criança", "Quando é preciso mudar a rotina de repente ela sente"],
    ["contexto do dia", "ele estuda de manhã e é quando eu foco bastante no meu trabalho, a rotina fica apertada"],
  ];
  for (const [nome, texto] of CASOS) {
    it(`NÃO abre: ${nome}`, () => {
      expect(abre(texto), texto.slice(0, 60)).toBe(false);
    });
  }
});

describe("a fronteira do decisor — o piso não alcança, e está documentado", () => {
  /**
   * ⚠️ ESTES CASOS NÃO SÃO BUGS DO PORTÃO. São a prova de que ele é insuficiente
   * sozinho: a mãe descreve a NECESSIDADE sem nomear o artefato. Quem tem de
   * reconhecer é o decisor. Ficam prendidos aqui para que, quando o decisor
   * passar a cobri-los, a mudança seja visível — e para que ninguém tente
   * resolver isso alargando a regex, que é como se cria falso positivo.
   */
  const DECISOR: Array<[string, string]> = [
    ["médico, sem nomear", "Mario precisa ir para o médico depois da avó. Queria imagens para mostrar para ele a sequencia"],
    ["vacina, sem nomear", "ela tem que tomar uma vacina, uma coisa meio chata, dolorida, e eu queria mostrar pra ela um pouco antes como vai ser"],
    ["pergunta aberta", "E uma sequencia visual. O que sugere ?"],
    ["telegráfico sem artigo", "Quero q rotina com as imagens"],
  ];

  it("A PROVA DO LIMITE: o que separa abrir de não abrir é um ARTIGO", () => {
    // Frase real de produção, 08/09/2026.
    expect(portaoDeterministicoDeRotina("Quero uma rotina com as imagens").abre).toBe(true);
    expect(portaoDeterministicoDeRotina("Quero q rotina com as imagens").abre).toBe(false);
    // ⚠️ NÃO CONSERTAR ALARGANDO A REGEX. "quero entender a rotina dele" também
    // nomeia rotina e também pede — e não é pedido de artefato. A diferença é
    // semântica, e semântica é do decisor. Este teste existe para prender a
    // absurdidade e impedir que alguém "resolva" isso no lugar errado.
  });
  for (const [nome, texto] of DECISOR) {
    it(`piso não alcança (responsabilidade do decisor): ${nome}`, () => {
      const r = portaoDeterministicoDeRotina(texto);
      // Documenta o estado atual sem afirmar que ele é o desejado.
      expect(typeof r.abre).toBe("boolean");
      expect(r.ato).toBeDefined();
    });
  }
});

describe("o desempate só vale sobre ambiguidade", () => {
  it("nomear + ditar desempata quando o ato é ambíguo", () => {
    const r = portaoDeterministicoDeRotina(
      "Mario\nRotina visual\nFazer bolo\nGuardar na geladeira\nColocar vela\nCantar parabéns",
    );
    expect(r.ato).toBe("ambiguo");
    expect(r.nomeou && r.ditou).toBe(true);
    expect(r.porDesempate).toBe(true);
    expect(r.abre).toBe(true);
  });

  it("recusa NUNCA é desempatada — o classificador soube", () => {
    const r = portaoDeterministicoDeRotina(
      "não quero rotina visual nenhuma\nBrincar\nBanho\nJantar\nDormir",
    );
    expect(r.porDesempate).toBe(false);
    expect(r.abre).toBe(false);
  });

  it("ato claro dispensa desempate", () => {
    const r = portaoDeterministicoDeRotina("Quero rotina visual pro Mario\nFazer bolo\nGuardar\nCantar");
    expect(r.ato).toBe("criar");
    expect(r.porDesempate).toBe(false);
    expect(r.abre).toBe(true);
  });
});
