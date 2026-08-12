import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { montarSystem, separarCampos } from "./intent";

/**
 * O BASELINE DO CLASSIFICADOR, congelado ANTES de o Plano entrar nele.
 *
 * ⚠️ POR QUE ISTO VEM PRIMEIRO. `classificarIntencao` é dono COMPARTILHADO: os
 * quatro portões da Rotina (`rotina_criar`, `rotina_ver`, `rotina_editar`,
 * `organizacao`) leem a intenção que sai daqui, e a frente da Rotina acabou de
 * ser publicada. Acrescentar um quinto campo para o Plano é aditivo por
 * intenção — e "por intenção" não é prova.
 *
 * Estes testes existem para que, se a inclusão do vínculo mexer em `intencao`,
 * `tema`, `aceite` ou `skills`, isso apareça como REGRESSÃO e não como
 * surpresa em produção.
 */

const PERMITIDAS = ["sono", "alimentacao", "comunicacao"];

describe("FASE 0 · baseline dos quatro campos", () => {
  it("MORDE: quatro campos continuam saindo iguais", () => {
    const r = separarCampos("plano|sono|-|sono", PERMITIDAS);
    expect(r.intencao).toBe("plano");
    expect(r.tema).toBe("sono");
    expect(r.aceite).toBe("-");
    expect(r.skills).toEqual(["sono"]);
  });

  it("MORDE: três campos (modelo antigo) continuam funcionando", () => {
    const r = separarCampos("rotina_criar|manha|-", PERMITIDAS);
    expect(r.intencao).toBe("rotina_criar");
    expect(r.tema).toBe("manha");
    expect(r.skills).toEqual([]);
  });

  it("MORDE: a skill escorregada para o 3º campo continua sendo recuperada", () => {
    // Comportamento existente, e não é detalhe: sem ele o turno perde a skill
    // e o repertório não chega.
    const r = separarCampos("plano|sono|sono", PERMITIDAS);
    expect(r.skills).toEqual(["sono"]);
    expect(r.aceite).toBe("");
  });

  it("MORDE: saída malformada não vira intenção inventada", () => {
    expect(separarCampos("", PERMITIDAS).intencao).toBe("");
    expect(separarCampos("lixo sem pipe", PERMITIDAS).intencao).toBe("lixo sem pipe");
    expect(separarCampos("lixo sem pipe", PERMITIDAS).skills).toEqual([]);
  });

  it("MORDE: skill inventada pelo modelo é descartada", () => {
    expect(separarCampos("plano|x|-|skill_que_nao_existe", PERMITIDAS).skills).toEqual([]);
  });
});

describe("FASE 0 · os quatro portões da Rotina, intocados", () => {
  const ORCH = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");

  it("MORDE: os quatro continuam lendo a intenção, e nada mais", () => {
    // Se o vínculo do Plano virar autoridade em qualquer um deles, isto quebra.
    expect(ORCH).toMatch(/intent === "rotina_criar"/);
    expect(ORCH).toMatch(/intent === "rotina_ver"/);
    expect(ORCH).toMatch(/intent === "rotina_editar"/);
    expect(ORCH).toMatch(/intent === "organizacao"/);
  });

  it("MORDE: nenhum portão da Rotina consulta o vínculo do Plano", () => {
    // O vínculo responde UMA pergunta — "isto responde à pergunta pendente do
    // Plano?" — e não pode virar sinal de roteamento de artefato nenhum.
    const trecho = ORCH.slice(ORCH.indexOf("const pedidoDeRotina ="), ORCH.indexOf("// 3c. Plano"));
    expect(trecho).not.toMatch(/vinculo/i);
  });
});

describe("FASE 2 · o quinto campo, aditivo e tolerante", () => {
  it("MORDE: os quatro primeiros NÃO mudam quando o quinto chega", () => {
    // A prova de que é aditivo: mesma linha, com e sem o vínculo.
    const sem = separarCampos("plano|sono|-|sono", PERMITIDAS);
    const com = separarCampos("plano|sono|-|sono|responde", PERMITIDAS);
    expect(com.intencao).toBe(sem.intencao);
    expect(com.tema).toBe(sem.tema);
    expect(com.aceite).toBe(sem.aceite);
    expect(com.skills).toEqual(sem.skills);
    expect(com.vinculo).toBe("responde");
  });

  it("MORDE: os cinco vínculos passam inteiros", () => {
    for (const v of ["responde", "continua", "mudou_assunto", "cancela", "nao_sei"] as const) {
      expect(separarCampos(`plano|x|-|sono|${v}`, PERMITIDAS).vinculo).toBe(v);
    }
  });

  it("MORDE: ausência, modelo antigo e lixo caem em `nao_sei`", () => {
    // ⚠️ E `nao_sei` NUNCA captura. Um modelo que ainda não conhece o campo, ou
    // que devolveu qualquer coisa, não pode fazer o Plano pendente engolir o
    // turno — o modo de falha mais caro seria atribuir a fala à criança errada.
    expect(separarCampos("plano|x|-|sono", PERMITIDAS).vinculo).toBe("nao_sei");
    expect(separarCampos("plano|x|-", PERMITIDAS).vinculo).toBe("nao_sei");
    expect(separarCampos("plano|x|-|sono|talvez", PERMITIDAS).vinculo).toBe("nao_sei");
    expect(separarCampos("plano|x|-|sono|RESPONDE ", PERMITIDAS).vinculo).toBe("responde");
    expect(separarCampos("", PERMITIDAS).vinculo).toBe("nao_sei");
  });

  it("MORDE: o vínculo não rouba a skill escorregada", () => {
    const r = separarCampos("plano|sono|sono", PERMITIDAS);
    expect(r.skills).toEqual(["sono"]);
    expect(r.vinculo).toBe("nao_sei");
  });
});

describe("FASE 1 · a fiação do vínculo no prompt", () => {
  const CATALOGO = [{ name: "sono", routing_keywords: ["sono"] }] as never;
  const PENDENTE = {
    membroAtipicoId: "m1",
    tema: "comunicação com estranhos",
    pergunta: "Ele trava mais para iniciar a conversa ou para responder?",
  };

  it("MORDE: sem Plano pendente, o prompt sai IDÊNTICO ao de antes", () => {
    // A prova de que é aditivo de verdade: nenhum turno paga tokens por um
    // estado que não existe — e a esmagadora maioria dos turnos não tem plano
    // em preparação.
    const semNada = montarSystem(CATALOGO);
    expect(montarSystem(CATALOGO, null)).toBe(semNada);
    expect(montarSystem(CATALOGO, undefined)).toBe(semNada);
    expect(semNada).not.toContain("vinculo");
  });

  it("MORDE: com Plano pendente, entra o campo E a pergunta — e nada além", () => {
    const com = montarSystem(CATALOGO, PENDENTE);
    expect(com).toContain("intencao|tema|aceite|skills|vinculo");
    expect(com).toContain("iniciar a conversa ou para responder");
    expect(com).toContain("comunicação com estranhos");
    // O contexto é MÍNIMO: a pergunta, não o artefato.
    expect(com).not.toContain("membroAtipicoId");
    // ⚠️ Nada do ARTEFATO entra: nem as seções do Plano, nem perfil, nem base.
    // (Não dá para procurar "entender" — é verbo comum, e o prompt base já diz
    // "Entenda a INTENÇÃO". Procuro os nomes que só existem no formato.)
    expect(com).not.toMatch(/crencas|historia_social|conteudo_markdown/);
  });

  it("MORDE: a regra do 'na dúvida' está escrita para o modelo", () => {
    const com = montarSystem(CATALOGO, PENDENTE);
    expect(com).toContain('NA DÚVIDA, "nao_sei"');
    expect(com).toContain("no filho errado");
  });

  it("MORDE: o bloco do vínculo entra no FIM e não corta o de skills", () => {
    const com = montarSystem(CATALOGO, PENDENTE);
    const semPlano = montarSystem(CATALOGO);
    // ⚠️ Não dá para exigir que o prompt antigo seja PREFIXO do novo: a linha do
    // formato muda no meio (`|vinculo`), e é exatamente o que se quer. O que
    // "aditivo" garante é que nada foi REMOVIDO — as regras de skill continuam
    // inteiras — e que o bloco novo fica no fim.
    const regraDeSkill = "Nunca invente nome.";
    expect(semPlano).toContain(regraDeSkill);
    expect(com).toContain(regraDeSkill);
    expect(com.indexOf(regraDeSkill)).toBeLessThan(com.indexOf('O CAMPO "vinculo"'));
    expect(com.trimEnd().endsWith('é "nao_sei".')).toBe(true);
  });

  it("MORDE: pergunta vazia não liga NADA — nem o campo, nem o bloco", () => {
    // Estado sem pergunta não é estado. E não basta o campo sumir do formato:
    // o bloco inteiro tem que sumir, senão o prompt cresce por nada.
    const com = montarSystem(CATALOGO, { ...PENDENTE, pergunta: "   " });
    expect(com).not.toContain("|vinculo");
    expect(com).not.toContain('O CAMPO "vinculo"');
    expect(com).toBe(montarSystem(CATALOGO));
  });

  it("MORDE: `classificarIntencao` repassa o pendente ao prompt", () => {
    // ⚠️ ESTRUTURAL, e pelo mesmo motivo do salto orquestrador→ponte: exercitar
    // isto por execução exigiria o cliente real do classificador. Sem ele,
    // cortar o repasse passava VERDE — o bloco existiria e nunca seria usado.
    const SRC = readFileSync(resolve(__dirname, "intent.ts"), "utf8");
    expect(SRC).toMatch(/system: montarSystem\(catalogo, params\.planoPendente\)/);
  });
});
