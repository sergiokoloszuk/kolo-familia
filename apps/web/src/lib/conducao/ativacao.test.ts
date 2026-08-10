import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { nucleoConducao } from "./diretrizes";
import { formasDeEntrega } from "./formas";
import { templateBoasVindasComDesafio } from "@/lib/ayla/messageTemplates";

/**
 * ATIVAÇÃO — a mãe não precisa saber usar a Kolo.
 *
 * Famílias novas entram e não sabem o que pedir: não conhecem Plano, Rotina,
 * História nem Relatório, e recebem perguntas abertas demais.
 *
 * A regra do "estou perdida" JÁ existia no núcleo e estava quase certa —
 * organizar 3-4 pontos e conduzir, sem devolver menu. O que faltava: dizer de
 * onde os pontos saem quando a família é nova (do cadastro), fechar com uma
 * recomendação em vez de uma escolha, e cobrir "não sei nem o que te pedir".
 */

const NUCLEO = nucleoConducao();

describe("caminhos de começo — sem virar menu de funcionalidades", () => {
  it("a regra de PARAR de investigar continua de pé", () => {
    expect(NUCLEO).toMatch(/PARE de investigar quando a família pedir direção/);
    expect(NUCLEO).toMatch(/estou perdida\/confusa/);
  });

  it("os pontos saem do cadastro quando a família é nova", () => {
    expect(NUCLEO).toMatch(/DE ONDE SAEM OS 3-4 PONTOS/);
    expect(NUCLEO).toMatch(/do que ela MARCOU NO CADASTRO, quando ela é nova/);
  });

  it("nomeados pela vida dela, nunca pelo nome do recurso", () => {
    expect(NUCLEO).toMatch(/nunca pelo nome do recurso/);
    expect(NUCLEO).toMatch(/Plano, Rotina, História e Relatório são COMO você ajuda/);
  });

  it("não inventa prioridade pra parecer que conhece a criança", () => {
    expect(NUCLEO).toMatch(/Só cite o que está mesmo salvo/);
    expect(NUCLEO).toMatch(/inventar prioridade pra parecer que conhece a criança/);
  });

  /**
   * ⚠️ ESTE TESTE MUDOU EM 06/08/2026, e a mudança é de produto.
   *
   * Antes ele exigia a proibição categórica do menu ("Não jogue a decisão de
   * volta como menu de opções"). Essa regra convivia, três linhas acima, com
   * outra que MANDA organizar em 3-4 pontos — e a contradição produzia os dois
   * modos de falha: a Ayla escolhendo calada pela mãe, ou perguntando sem
   * organizar nada.
   *
   * A proibição não sumiu: virou uma DISTINÇÃO. Menu que substitui a resposta
   * continua errado; menu que organiza um problema grande é o comportamento
   * desejado, e é literalmente o exemplo que o Sérgio deu como experiência boa.
   */
  it("distingue o menu que organiza do menu que foge", () => {
    expect(NUCLEO).toMatch(/OFERECER CAMINHOS NÃO É JOGAR A DECISÃO DE VOLTA/);
    // o modo de falha continua nomeado
    expect(NUCLEO).toMatch(/RUIM é o menu que substitui a resposta/);
    expect(NUCLEO).toMatch(/quando você podia simplesmente responder/);
    // e o comportamento desejado ficou explícito
    expect(NUCLEO).toMatch(/BOM é o menu que ORGANIZA/);
    expect(NUCLEO).toMatch(/Qual está pesando mais agora/);
    expect(NUCLEO).toMatch(/recomendar por onde começar deixando ela trocar/);
  });

  it("pergunta é ferramenta, não ritual", () => {
    expect(NUCLEO).toMatch(/PERGUNTA É FERRAMENTA, NÃO RITUAL/);
    expect(NUCLEO).toMatch(/terminar sem pergunta é frequentemente o certo/);
  });

  it("ajuda antes de investigação infinita", () => {
    expect(NUCLEO).toMatch(/HAVENDO INFORMAÇÃO PARA UM PRIMEIRO PASSO SEGURO, DÊ O PRIMEIRO PASSO/);
    expect(NUCLEO).toMatch(/não colete porque mais informação seria interessante/);
  });

  it("acolhimento não é obrigação de abertura", () => {
    expect(NUCLEO).toMatch(/NÃO PRECISO ACOLHER ANTES DE TODA RESPOSTA/);
    expect(NUCLEO).toMatch(/Parágrafo de acolhimento que não acrescenta nada é enrolação/);
  });

  it('responde "o que você faz?" por problema, não por funcionalidade', () => {
    expect(NUCLEO).toMatch(/não sei nem o que posso te pedir/);
    expect(NUCLEO).toMatch(/responda por PROBLEMA/);
    expect(NUCLEO).toMatch(/Nunca com uma lista de funcionalidades/);
    expect(NUCLEO).toMatch(/termine já ajudando em uma delas/);
  });

  it("a forma existe no repertório — e é entrega, não conversa solta", () => {
    const bloco = formasDeEntrega({ canal: "whatsapp" });
    // O rótulo "Por onde eu começaria" saiu em 10/08/2026 — era um dos três
    // que viravam gabarito. O que este teste guarda é a FORMA de organizar
    // várias frentes, que continua existindo como tipo de ajuda.
    expect(bloco).toMatch(/comparar caminhos/);
  });

  it("vive no núcleo, que é compartilhado — não é uma segunda Ayla", () => {
    const PROMPT = readFileSync(resolve(__dirname, "../ia/prompt.ts"), "utf8");
    const RESP = readFileSync(resolve(__dirname, "../ayla/responder.ts"), "utf8");
    expect(PROMPT).toMatch(/nucleoConducao\(\)/);
    expect(RESP).toMatch(/nucleoConducao\(\)/);
  });
});

describe("a primeira mensagem não pede que a mãe saiba pedir", () => {
  const intro = templateBoasVindasComDesafio({
    nomeMae: "Clara",
    nomeMembro: "Gustavo",
    genero: "masculino",
    desafios: ["comunicacao", "foco", "social"],
  });

  it("diz, com todas as letras, que ela não precisa saber o que pedir", () => {
    expect(intro).toMatch(/Você não precisa saber o que pedir/);
  });

  it("mostra que já conhece a criança pelo cadastro", () => {
    expect(intro).toMatch(/Pelo que você contou quando entrou/);
  });

  it("NÃO nomeia nenhuma ferramenta", () => {
    expect(intro).not.toMatch(/plano estratégico|rotina visual|relatório|história social/i);
  });

  it("continua oferecendo áudio e prometendo a primeira ideia prática", () => {
    expect(intro).toContain("*áudio*");
    expect(intro).toMatch(/primeira ideia prática/);
  });

  it("ainda cita os desafios reais — e só eles", () => {
    expect(intro).toContain("a comunicação");
    expect(intro).toContain("o foco");
  });
});

describe("o que a ativação NÃO pode ter quebrado", () => {
  const ORCH = readFileSync(resolve(__dirname, "../ayla/orchestrator.ts"), "utf8");
  const RESP = readFileSync(resolve(__dirname, "../ayla/responder.ts"), "utf8");

  it("pedido específico não passa por caminho nenhum — vai direto", () => {
    // Rotina, plano e organização continuam roteados antes de qualquer conversa.
    expect(ORCH).toMatch(/intent === "rotina_criar"/);
    expect(ORCH).toMatch(/intent === "organizacao"/);
    expect(ORCH).toMatch(/forcar: querPlano/);
  });

  it("o aceite curto continua resolvido pelo turno anterior", () => {
    expect(RESP).toMatch(/ELA ESTÁ ACEITANDO O QUE VOCÊ OFERECEU/);
  });

  it("a segurança continua com prioridade absoluta", () => {
    expect(ORCH).toMatch(/!seguranca\.aberta &&/);
    expect(RESP).toMatch(/notaDeSeguranca/);
  });

  it("nada de estado novo, tabela nova ou roteador novo", () => {
    // Um único condutor de rotina, uma única ponte de plano.
    expect(ORCH.match(/const r = await conduzirRotina\(/g)?.length).toBe(1);
    expect(ORCH.match(/const nudge = await montarPonteWhatsApp\(/g)?.length).toBe(1);
  });
});
