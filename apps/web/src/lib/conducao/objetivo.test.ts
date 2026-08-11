import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ehDispensa,
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
    // ⚠️ ESTA ASSERÇÃO MUDOU EM 11/08/2026, e não foi para ficar verde.
    //
    // Ela dizia `objetivo === "trava pra começar"`. Sob o contrato de três
    // níveis (PEND-035), isso é REFINAMENTO DESCRITIVO: informação nova que
    // torna o objetivo mais específico **sem substituí-lo**. Aceitar que uma
    // descrição vire o alvo é exatamente a regra que fez "quando anda já
    // começa a correr" sequestrar o plano da leitura.
    //
    // O refinamento não se perde: vira `barreiras`, chega ao Plano rotulado, e
    // pode virar `focoAtual` quando a Ayla propuser o recorte e a família
    // confirmar (Fatia 4). Até lá, `focoAtual` é null — e isso é correto, não
    // uma lacuna.
    expect(o.objetivo).toContain("melhorar a comunicação");
    expect(o.origem).toBe("familia");
    expect(o.focoAtual).toBeNull();
    expect(o.barreiras.some((b) => b.includes("trava pra começar"))).toBe(true);
    // E o refinamento chega ao gerador, rotulado como o que é.
    expect(enquadrarObjetivo(o)).toContain("trava pra começar");
  });
});

describe("B · o Plano não nasce de 'não obedece'", () => {
  it("usa o entendimento construído, não a queixa inicial", () => {
    const o = alvo([
      fam("Ela não faz o que eu peço."),
      ayla("Ela entende o pedido? Chega a começar?"),
      fam("Entende e começa, mas larga no meio quando é tarefa longa."),
    ]);
    // Mesma mudança de contrato do caso A: "larga no meio quando é tarefa
    // longa" descreve, não decide. A queixa inicial continua sendo o objetivo
    // — e o entendimento construído chega como barreira, que é o que ele é.
    expect(o.objetivo).toContain("não faz o que eu peço");
    expect(o.focoAtual).toBeNull();
    expect(o.barreiras.some((b) => b.includes("larga no meio"))).toBe(true);
    expect(enquadrarObjetivo(o)).toContain("larga no meio");
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
    // A correção da mãe CORRIGE A COMPREENSÃO do problema; ela não declara uma
    // nova intenção. Sob o contrato de três níveis ela é pista de alto valor —
    // e continua sendo o que mais informa a estratégia.
    expect(o.objetivo).toContain("chora na hora da lição");
    expect(o.barreiras.some((b) => b.includes("parar de brincar"))).toBe(true);
    // A hipótese rejeitada não pode ser o alvo — isto continua valendo.
    expect(o.objetivo).not.toContain("difícil demais");
    expect(enquadrarObjetivo(o)).toContain("parar de brincar");
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

describe("PEND-035 · o contrato de três níveis — raiz, foco e barreiras", () => {
  const fam = (texto: string) => ({ de: "familia" as const, texto });
  const ayla = (texto: string, ofereceuPlano = false) => ({ de: "ayla" as const, texto, ofereceuPlano });
  const alvo2 = (t: TurnoConversa[]) => objetivoDaConversa(t)!;

  it("MANU · a barreira mais recente NÃO vira o objetivo", () => {
    /**
     * ⚠️ O CASO REAL (11/08/2026). Plano de produção saiu com o título
     * "Controlar a velocidade ao andar" para uma mãe que queria LER uma
     * história. Bancada: `OBJETIVO_PRESERVADO: NAO`, `útil 1/5`.
     */
    const o = alvo2([
      fam("O foco dela é só para jogos"),
      ayla("O foco aparece nos jogos porque eles têm objetivo claro e retorno rápido."),
      fam("Mas eu quero ler e ela nao fica sentada"),
      ayla("Teste ler um trecho curto enquanto ela pode ficar em pé ou andar perto."),
      fam("Quando anda, ja comeca correr"),
    ]);
    expect(o.objetivo).toContain("quero ler");
    expect(o.objetivo).not.toContain("correr");
    expect(o.focoAtual).toBeNull();
    // As três descrições viram barreiras — nenhuma se perde.
    expect(o.barreiras).toHaveLength(2);
    expect(o.barreiras.some((b) => b.includes("comeca correr"))).toBe(true);
    expect(o.barreiras.some((b) => b.includes("só para jogos"))).toBe(true);

    const texto = enquadrarObjetivo(o);
    expect(texto.indexOf("quero ler")).toBeLessThan(120);
    expect(texto).toContain("O QUE JÁ SE SABE SOBRE A DIFICULDADE");
    expect(texto).toContain("comeca correr");
    // E o gerador é avisado do que NÃO fazer com uma barreira.
    expect(texto).toContain("ela NÃO é o objetivo");
  });

  it("TANGENTE · descrição recente e fora do assunto não vira foco nem objetivo", () => {
    // O risco que derrubou a proposta "última descritiva = foco": a última
    // coisa que a mãe descreve pode não ter nada a ver com o alvo.
    const o = alvo2([
      fam("Quero que ela consiga dormir sozinha"),
      ayla("Como é a hora de dormir hoje?"),
      fam("Ah, e hoje ela derrubou o suco na mochila da escola"),
    ]);
    expect(o.objetivo).toContain("dormir sozinha");
    expect(o.focoAtual).toBeNull();
  });

  it("MUDANÇA REAL · a família decide trabalhar outra coisa, e isso vence", () => {
    const o = alvo2([
      fam("Quero conseguir ler uma história com ela"),
      ayla("Boa. Como é hoje o momento da leitura?"),
      fam("Ela não senta"),
      fam("Vamos deixar a leitura para depois, quero trabalhar ela se vestir sozinha primeiro"),
    ]);
    expect(o.objetivo).toContain("vestir sozinha");
    expect(o.objetivo).not.toContain("ler uma história");
    // A leitura vira pano de fundo, não some.
    expect(o.contexto.some((t) => t.texto.includes("ler uma história"))).toBe(true);
  });

  it("PRIORIDADE · o refinamento POR DECISÃO estreita o objetivo, e deve vencer", () => {
    const o = alvo2([
      fam("Quero melhorar a comunicação dela"),
      ayla("Me conta como ela se comunica hoje?"),
      fam("O que mais me preocupa é que ela trava para começar conversa com outras crianças"),
    ]);
    expect(o.objetivo).toContain("trava para começar conversa");
  });

  it("DISPENSA · recusa e negação não viram objetivo nem barreira", () => {
    const o = alvo2([
      fam("Quero ajudar ela a se acalmar na hora do banho"),
      ayla("Pode ser a temperatura da água ou o barulho do chuveiro."),
      fam("nao, isso nao acontece com ela"),
    ]);
    expect(o.objetivo).toContain("se acalmar na hora do banho");
    expect(o.barreiras).toHaveLength(0);
  });

  it("MORDE: 'Não durmo desde que ele nasceu' é RELATO, não dispensa", () => {
    // A armadilha do regex: um `^não` genérico engoliria um dos melhores
    // objetivos que uma mãe pode escrever.
    expect(ehDispensa("Não durmo desde que ele nasceu")).toBe(false);
    expect(ehDispensa("não come nada além de arroz")).toBe(false);
    expect(ehDispensa("nao, isso nao acontece")).toBe(true);
    expect(ehDispensa("Depois a gente vê isso.")).toBe(true);
  });

  it("CONVERSA LONGA · nem objetivo nem barreira recente somem no corte", () => {
    const encheu = Array.from({ length: 30 }, (_, i) =>
      fam(`Coisa antiga número ${i} com bastante texto para gastar orçamento do contexto`),
    );
    const o = alvo2([
      fam("Quero que ela escove os dentes sem briga"),
      ...encheu,
      fam("Ontem ela jogou a escova no chão"),
    ]);
    expect(o.objetivo).toContain("escove os dentes");
    const texto = enquadrarObjetivo(o);
    expect(texto.indexOf("escove os dentes")).toBeLessThan(120);
    expect(texto).toContain("jogou a escova no chão");   // a barreira recente entra
    expect(texto).not.toContain("Coisa antiga número 0"); // a antiga, não
  });

  it("O CONTRATO É ADITIVO — quem já consumia continua funcionando", () => {
    const o = alvo2([fam("Quero trabalhar o foco dela")]);
    expect(o.objetivo).toBe("Quero trabalhar o foco dela");
    expect(o.origem).toBe("familia");
    expect(Array.isArray(o.contexto)).toBe(true);
    // E os campos novos existem, com o padrão certo.
    expect(o.focoAtual).toBeNull();
    expect(o.barreiras).toEqual([]);
  });
});
