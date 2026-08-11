import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ehFalaSubstantiva,
  enquadrarObjetivo,
  objetivoDaConversa,
  type TurnoConversa,
} from "./objetivo";

/**
 * OS DEZ GOLDEN CASES DO OBJETIVO — Fatia 2 de PEND-027 (11/08/2026).
 *
 * A pergunta que cada um responde é sempre a mesma: **QUAL habilidade ou
 * situação esta família decidiu trabalhar AGORA?**
 *
 * Antes, o Plano da web nascia de `papel === "user"` concatenado e cortado em
 * 1.800 caracteres, sem hierarquia nenhuma. Estes testes são determinísticos de
 * propósito — a regra é de código, não de modelo, e dá para ler e saber o que
 * sai.
 */

const fam = (texto: string): TurnoConversa => ({ de: "familia", texto });
const ayla = (texto: string, ofereceuPlano = false): TurnoConversa => ({
  de: "ayla",
  texto,
  ofereceuPlano,
});
const alvo = (turnos: TurnoConversa[]) => objetivoDaConversa(turnos)!;

describe("A · refinamento construído na conversa", () => {
  it("o Plano usa 'iniciar conversa com outras crianças', não 'comunicação'", () => {
    const o = alvo([
      fam("Quero melhorar a comunicação dela."),
      ayla("Ela fala bem em casa? Como é com crianças que ela não conhece?"),
      fam("Em casa fala super bem. Com outras crianças ela trava pra começar."),
    ]);
    expect(o.objetivo).toContain("trava pra começar");
    expect(o.origem).toBe("familia");
    // O tema amplo continua disponível como contexto — só não é o alvo.
    expect(o.contexto.some((t) => t.texto.includes("melhorar a comunicação"))).toBe(true);
  });
});

describe("B · o Plano não nasce de 'não obedece'", () => {
  it("usa o entendimento construído, não a queixa inicial", () => {
    const o = alvo([
      fam("Ela não faz o que eu peço."),
      ayla("Ela entende o pedido? Chega a começar?"),
      fam("Entende e começa, mas larga no meio quando é tarefa longa."),
    ]);
    expect(o.objetivo).toContain("larga no meio");
    expect(o.objetivo).not.toContain("não faz o que eu peço");
  });
});

describe("C · várias frentes, a família escolhe uma", () => {
  it("o Plano fica na escolhida", () => {
    const o = alvo([
      fam("Tem a comunicação, o sono, a alimentação e a escola. É tudo junto."),
      ayla("Por qual você quer começar?"),
      fam("Vamos começar pela comunicação dela no mercado."),
    ]);
    expect(o.objetivo).toContain("mercado");
  });
});

describe("D · hipótese da Ayla corrigida pela família", () => {
  it("MORDE: o Plano usa B, não A", () => {
    const o = alvo([
      fam("Ele chora na hora da lição."),
      ayla("Pode ser que a tarefa esteja difícil demais pra ele."),
      fam("Não, difícil não é — ele faz. Ele chora quando precisa parar de brincar pra começar."),
    ]);
    expect(o.objetivo).toContain("parar de brincar");
    // A hipótese rejeitada não pode ser o alvo.
    expect(o.objetivo).not.toContain("difícil demais");
  });
});

describe("E · a família muda de direção no meio", () => {
  it("vale o objetivo vigente, não o primeiro", () => {
    const o = alvo([
      fam("Queria trabalhar o foco dele na lição."),
      ayla("Entendi. Como costuma ser a lição?"),
      fam("Na verdade deixa o foco pra depois. O que me preocupa agora é ele se vestir sozinho."),
    ]);
    expect(o.objetivo).toContain("vestir sozinho");
    expect(o.objetivo).not.toContain("foco dele na lição");
  });
});

describe("F · aceite curto NÃO é objetivo", () => {
  it("MORDE: 'sim' recupera a oferta que a Ayla fez", () => {
    const o = alvo([
      fam("Ela some quando tem gente."),
      ayla("Quer um Plano pra ela iniciar pequenas conversas no mercado?", true),
      fam("sim"),
    ]);
    expect(o.origem).toBe("oferta_da_ayla");
    expect(o.objetivo).toContain("iniciar pequenas conversas no mercado");
    expect(o.objetivo).not.toBe("sim");
  });

  it("vários aceites, em várias formas, nenhum vira objetivo", () => {
    for (const aceite of ["sim", "quero", "pode ser", "vamos", "isso", "ok", "2", "a segunda"]) {
      const o = alvo([
        fam("Ele não come nada além de arroz."),
        ayla("Quer um Plano pra ampliar o repertório dele com calma?", true),
        fam(aceite),
      ]);
      expect(o.objetivo, `aceite "${aceite}"`).toContain("ampliar o repertório");
    }
  });

  it("aceite SEM oferta anterior cai na última fala substantiva da família", () => {
    const o = alvo([
      fam("Ele acorda três vezes por noite e me chama."),
      ayla("Entendi. E depois que ele volta a dormir, a noite segue bem?"),
      fam("ok"),
    ]);
    expect(o.origem).toBe("familia");
    expect(o.objetivo).toContain("acorda três vezes");
  });

  it("MORDE: pedido de plano SEM assunto não é objetivo", () => {
    const o = alvo([
      fam("Ele briga com a irmã toda tarde."),
      ayla("Me conta como costuma começar."),
      fam("me monta um plano"),
    ]);
    expect(o.objetivo).toContain("briga com a irmã");
  });

  it("mas pedido de plano COM assunto é objetivo", () => {
    expect(ehFalaSubstantiva("me monta um plano pra ela dormir sozinha")).toBe(true);
    expect(ehFalaSubstantiva("me monta um plano")).toBe(false);
    expect(ehFalaSubstantiva("quero um plano")).toBe(false);
  });
});

describe("I · hipótese não confirmada nunca vira objetivo", () => {
  it("MORDE: fala da Ayla sem aceite da família é só contexto", () => {
    const o = alvo([
      fam("Ela chora no parque."),
      ayla("Pode ser sobrecarga sensorial — barulho, gente, movimento."),
      fam("Ela chora quando as outras crianças chegam perto pra brincar."),
    ]);
    expect(o.origem).toBe("familia");
    expect(o.objetivo).not.toContain("sobrecarga sensorial");
  });

  it("MORDE: oferta da Ayla só vale se a família aceitou LOGO depois", () => {
    // Oferta antiga + conversa depois + aceite no fim: a oferta não é o alvo,
    // porque o "sim" não se refere a ela.
    const o = alvo([
      ayla("Quer um Plano pra rotina da manhã?", true),
      fam("Depois a gente vê isso."),
      ayla("Combinado. E o que está mais difícil hoje?"),
      fam("A hora de dormir. Ele levanta cinco vezes."),
      ayla("Entendi."),
      fam("sim"),
    ]);
    expect(o.objetivo).toContain("levanta cinco vezes");
    expect(o.objetivo).not.toContain("rotina da manhã");
  });
});

describe("J · refinamento não se perde só por ter vindo da Ayla", () => {
  it("a oferta aceita carrega a formulação precisa", () => {
    const o = alvo([
      fam("Não sei explicar. Ela é meio travada com gente."),
      ayla("Quer que eu monte um Plano pra ela iniciar e sustentar pequenas interações com outras crianças?", true),
      fam("isso mesmo"),
    ]);
    expect(o.objetivo).toContain("iniciar e sustentar pequenas interações");
  });
});

describe("G · conversa longa não decapita o objetivo", () => {
  it("MORDE: o alvo fica íntegro mesmo com 6.000 caracteres de contexto", () => {
    const encheu = Array.from({ length: 20 }, (_, i) =>
      i % 2 === 0
        ? fam(`Coisa antiga número ${i}. `.repeat(12))
        : ayla(`Resposta antiga número ${i}. `.repeat(12)),
    );
    const o = alvo([...encheu, fam("O que eu quero agora é que ela peça ajuda em vez de chorar.")]);
    const texto = enquadrarObjetivo(o);
    expect(texto).toContain("peça ajuda em vez de chorar");
    expect(texto.indexOf("peça ajuda")).toBeLessThan(200); // vem no topo, não no fim
    // e o contexto foi cortado pelo começo, não pelo fim
    expect(texto).not.toContain("Coisa antiga número 0");
    expect(texto.length).toBeLessThan(2600);
  });
});

describe("o enquadramento — objetivo em destaque, resto subordinado", () => {
  it("diz explicitamente que o contexto NÃO é o objetivo", () => {
    const texto = enquadrarObjetivo(
      alvo([fam("Ele não dorme sozinho."), ayla("Há quanto tempo?"), fam("Desde sempre.")]),
    );
    expect(texto).toMatch(/O OBJETIVO DESTE PLANO é este, e só ele/);
    expect(texto).toMatch(/A conversa abaixo é CONTEXTO/);
    expect(texto).toMatch(/não amplie o plano para outros temas/);
    expect(texto).toMatch(/hipótese que ela não confirmou/);
  });

  it("sem contexto, entrega só o objetivo — sem cabeçalho vazio", () => {
    const texto = enquadrarObjetivo(alvo([fam("Ele não dorme sozinho.")]));
    expect(texto).toMatch(/O OBJETIVO DESTE PLANO/);
    expect(texto).not.toMatch(/A conversa abaixo/);
  });

  it("conversa sem nenhuma fala da família não produz objetivo", () => {
    expect(objetivoDaConversa([ayla("Oi!")])).toBeNull();
    expect(objetivoDaConversa([])).toBeNull();
  });
});

describe("H · os dois canais compartilham a SEMÂNTICA, não a seleção", () => {
  const src = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

  /** O corpo de UMA função, para o teste não casar com features vizinhas. */
  const corpo = (arquivo: string, nome: string) => {
    const t = src(arquivo);
    const i = t.indexOf(`export async function ${nome}`);
    expect(i, `${nome} sumiu de ${arquivo}`).toBeGreaterThan(-1);
    const j = t.indexOf("\nexport ", i + 10);
    return t.slice(i, j > i ? j : t.length);
  };

  it("MORDE: criar o Plano usa o helper e não volta a concatenar `papel === user`", () => {
    const fn = corpo("../app/(app)/conversar/actions.ts", "criarPlanoDaConversa");
    expect(fn).toMatch(/objetivoDaConversa\(turnos\)/);
    expect(fn).toMatch(/enquadrarObjetivo\(alvo\)/);
    // A forma antiga, que perdia o refinamento e o aceite.
    expect(fn).not.toMatch(/filter\(\(m\) => m\.papel === "user"\)/);
  });

  it("MORDE: AJUSTAR o Plano parte do MESMO objetivo que o gerou", () => {
    // Se o ajuste reconstruísse o desafio de outro jeito, pedir uma correção
    // faria o tema do plano mudar sozinho — a mãe pede "deixa mais simples" e
    // recebe um plano sobre outra coisa.
    const fn = corpo("../app/(app)/planos/actions.ts", "ajustarPlano");
    expect(fn).toMatch(/objetivoDaConversa\(turnos\)/);
    expect(fn).toMatch(/enquadrarObjetivo\(alvo\)/);
    expect(fn).not.toMatch(/filter\(\(m\) => m\.papel === "user"\)/);
  });

  it("o botão de APOIO continua como estava — é outra feature", () => {
    // `pedirApoioNaConversa` são os 7 botões, não o Plano. Mexer nele aqui
    // seria ampliar a fatia; fica registrado que a diferença é deliberada.
    const fn = corpo("../app/(app)/conversar/actions.ts", "pedirApoioNaConversa");
    expect(fn).toMatch(/filter\(\(m\) => m\.papel === "user"\)/);
  });

  it("o WhatsApp mantém a SELEÇÃO dele — janela e isolamento por irmão", () => {
    // Regras diferentes para realidades diferentes: a web tem `conversa_id`, o
    // WhatsApp tem uma linha do tempo contínua e mais de uma criança nela.
    const ponte = src("ayla/ponte.ts");
    expect(ponte).toMatch(/semOutrosMembros/);
    expect(ponte).toMatch(/45 \* 60 \* 1000/);
  });

  it("MORDE: nenhum extrator por modelo nasceu nesta fatia", () => {
    // A regra é determinística de propósito — uma chamada de modelo seria uma
    // segunda fonte de verdade e mais uma chance de inventar objetivo.
    const obj = src("conducao/objetivo.ts");
    expect(obj).not.toMatch(/anthropic|openai|gerarConversacional|messages\.create/i);
  });
});
