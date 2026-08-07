import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { citaAPessoa, CRITERIO_ALVO_KOLO } from "./escopo-kolo";
import { pedeUmPlano } from "@/lib/ia/pedido-plano";

/**
 * CONTEXTO × ALVO KOLO — a palavra "plano" deixa de bastar.
 *
 * ⚠️ O BURACO, provado no código antes de existir esta regra:
 *   1. `pedeUmPlano` só vê "plano" + um verbo de pedido. "Quero um plano de
 *      aposentadoria" → true.
 *   2. Pedido explícito entra na ponte com `forcar`, e `forcar` PULA o gate de
 *      suficiência inteiro (`if (!forcar)`).
 *   Resultado: sairia um Plano Kolo sobre previdência, em PDF, com link.
 *
 * A correção NÃO é uma lista de assuntos proibidos. O mesmo assunto está
 * dentro ou fora conforme o alvo:
 *
 *   "Vou me separar do meu marido"        → fora
 *   "Como explico a separação pro Pedro?" → DENTRO
 *
 * Uma denylist erraria justamente o segundo — a hora em que a família mais
 * precisa. A pergunta é "o pedido é sobre a pessoa acompanhada?".
 */

const ORCH = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");
const RESP = readFileSync(resolve(__dirname, "responder.ts"), "utf8");
const PONTE = readFileSync(resolve(__dirname, "ponte.ts"), "utf8");

describe("o buraco que existia", () => {
  it("`pedeUmPlano` ainda diz sim pra pedidos fora do escopo — e tudo bem", () => {
    // Ele continua sendo só um detector de FORMA. Quem decide escopo é outro.
    expect(pedeUmPlano("Quero um plano de aposentadoria")).toBe(true);
    expect(pedeUmPlano("Quero um plano para as férias")).toBe(true);
  });

  it("a ponte continua pulando a suficiência no pedido explícito", () => {
    // Não mexi nisso: é o que faz "pedido explícito gera direto" funcionar.
    // Por isso a verificação de escopo tinha que vir ANTES.
    expect(PONTE).toMatch(/if \(!forcar\) \{/);
  });
});

describe("onde a verificação entrou, e por quê ali", () => {
  it("roda ANTES de `querPlano`, não dentro da ponte", () => {
    // `querPlano` é o que manda a Ayla dar a resposta curta de "o sistema já
    // está entregando". Barrar só na ponte consertaria o arquivo e deixaria a
    // promessa: ela anunciaria um plano que nunca chega.
    expect(ORCH).toMatch(/const pediuPlanoExplicito = pedeUmPlano\(args\.params\.mensagem\)/);
    expect(ORCH.indexOf("await avaliarAlvoKolo")).toBeLessThan(ORCH.indexOf("const querPlano ="));
  });

  it("sem alvo, não entra em modo plano", () => {
    expect(ORCH).toMatch(/\(pediuPlanoExplicito && escopo\.temAlvo\)/);
  });

  it("o 'sim' curto depois de uma oferta continua valendo", () => {
    // Ali a Ayla já ofereceu, então o escopo já foi julgado antes.
    expect(ORCH).toMatch(/ehAfirmacaoCurta\(args\.params\.mensagem\) &&\s*\n?\s*\(await ofertouPlanoRecente/);
  });

  it("a ponte de volta chega ao prompt, e não é recusa", () => {
    expect(ORCH).toMatch(/args\.params\.ponteDeEscopo = escopo\.temAlvo \? undefined : escopo\.ponte/);
    expect(RESP).toMatch(/ESTE PEDIDO NÃO É DA KOLO/);
    expect(RESP).toMatch(/Acolha em uma linha e vire pro que você faz/);
  });

  it("proíbe prometer material sobre o que não é da Kolo", () => {
    expect(RESP).toMatch(/NÃO pode dizer que vai montar, organizar ou enviar material sobre isso/);
  });

  it("proíbe opinar sobre a parte que não é dela", () => {
    expect(RESP).toMatch(/dinheiro, trabalho, decisão do casal, jurídico/);
  });
});

describe("o atalho barato: citar a pessoa dispensa a chamada", () => {
  it("nome do membro basta", () => {
    expect(citaAPessoa("faz um plano pro Pedro começar a lição", ["Pedro"])).toBe(true);
  });

  it("terceira pessoa e parentesco também", () => {
    for (const t of ["um plano pra ele começar a lição", "plano pra minha filha dormir"])
      expect(citaAPessoa(t, [])).toBe(true);
  });

  it("nome curto demais não conta — casaria com qualquer coisa", () => {
    expect(citaAPessoa("quero um plano de negócios", ["Ana"])).toBe(false);
    expect(citaAPessoa("plano de aposentadoria", ["Jô"])).toBe(false);
  });

  it("pedido sem a pessoa não pega o atalho — vai pra classificação", () => {
    for (const t of [
      "quero um plano de aposentadoria",
      "faça um plano de negócios",
      "quero um plano pras minhas férias",
    ])
      expect(citaAPessoa(t, ["Pedro"])).toBe(false);
  });
});

// ============================================================
// OS DEZ CASOS DE ESCOPO (A–J do briefing)
// ============================================================

describe("o critério cobre os dez casos, nomeando os dois lados", () => {
  const tem = (s: string) => expect(CRITERIO_ALVO_KOLO).toContain(s);

  it("A. lição do filho → tem alvo", () => tem("começar a lição sem eu cobrar"));
  it("B. aposentadoria → não tem", () => tem("plano de aposentadoria"));
  it("C. aposentadoria QUE MUDA a rotina dela → tem", () => tem("vou me aposentar e ela estranha"));
  it("D. férias com hotel e roteiro → não tem", () => tem("destino, hotel, roteiro, orçamento"));
  it("E. férias que quebram a rotina dele → tem", () => tem("nas férias ele sofre com a mudança"));
  it("F. separação do casal → não tem", () => tem("decisão conjugal, jurídica, guarda, pensão"));
  it("G. explicar a separação pro filho → tem", () => tem("como explico a separação"));
  it("J. plano de negócios → não tem", () => tem("plano de negócios"));

  it("a regra de ouro é a da dúvida, e ela é permissiva", () => {
    // Recusar um pedido legítimo custa mais que gerar um plano a mais: a
    // família veio pedir ajuda com o filho.
    expect(CRITERIO_ALVO_KOLO).toMatch(/NA DÚVIDA, considere que TEM alvo/);
    expect(CRITERIO_ALVO_KOLO).toMatch(/ser mandada embora por causa de uma palavra é pior/);
  });

  it("manda separar contexto de alvo, com todas as letras", () => {
    expect(CRITERIO_ALVO_KOLO).toMatch(/SEPARE CONTEXTO DE ALVO/);
    expect(CRITERIO_ALVO_KOLO).toMatch(/atende só a parte que é sua/);
  });

  it("não presume criança", () => {
    expect(CRITERIO_ALVO_KOLO).toMatch(/bebê, criança, adolescente ou adulto/);
  });

  it("quando não há alvo, ainda pede a ponte", () => {
    expect(CRITERIO_ALVO_KOLO).toMatch(/escreva em "ponte" a virada/);
    expect(CRITERIO_ALVO_KOLO).toMatch(/sem opinar sobre a parte que não é sua/);
  });
});

describe("falha aberta", () => {
  it("erro de modelo não bloqueia pedido legítimo", () => {
    // Um timeout não pode virar recusa: o custo de bloquear quem tinha razão é
    // maior que o de gerar um plano a mais.
    const SRC = readFileSync(resolve(__dirname, "escopo-kolo.ts"), "utf8");
    expect(SRC).toMatch(/catch \{\s*\n?\s*return \{ temAlvo: true, ponte: "" \};/);
    expect(SRC).toMatch(/if \(!m\) return \{ temAlvo: true, ponte: "" \};/);
  });

  it("só `temAlvo: false` explícito barra", () => {
    const SRC = readFileSync(resolve(__dirname, "escopo-kolo.ts"), "utf8");
    expect(SRC).toMatch(/const temAlvo = o\.temAlvo !== false;/);
  });
});
