import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolverMembroAlvo, conflitoDeIdentidade, generoApontado } from "./membro-alvo";

/**
 * DE QUEM É ESTE PEDIDO — os 13 casos, a partir de um erro real.
 *
 * 03/08/2026: a mãe escreveu "a gente vai levar ELA no médico". A regex só
 * procurava nome próprio, não achou nada, e a cadeia caiu no `membroConversa`
 * — que trazia o irmão da conversa anterior. O modelo entendeu "ela" e escreveu
 * a resposta inteira sobre a menina; o `membro_atipico_id` que foi pro banco
 * era o do menino. A rotina da consulta médica dela ficou salva nele.
 */

const MARIO = { id: "m-1", nome: "Mario", genero: "masculino" as const };
const MANU = { id: "m-2", nome: "Manu", genero: "feminino" as const };
const LIA = { id: "m-3", nome: "Lia", genero: "feminino" as const };
const DOIS = [MARIO, MANU];

const alvo = (texto: string, membros = DOIS, ctx: string | null = null) =>
  resolverMembroAlvo({ texto, membros, membroContexto: ctx });

describe("1-2. nome explícito manda", () => {
  it("'rotina para Mario' → Mario", () => {
    const r = alvo("quero uma rotina para Mario");
    expect(r).toMatchObject({ tipo: "resolvido", membroId: "m-1", motivo: "nome" });
  });

  it("'rotina para Manu' → Manu", () => {
    const r = alvo("quero uma rotina para a Manu");
    expect(r).toMatchObject({ tipo: "resolvido", membroId: "m-2", motivo: "nome" });
  });

  it("nome vence o contexto anterior — referência atual não perde pra assunto velho", () => {
    const r = alvo("agora quero uma pra Manu", DOIS, "m-1");
    expect(r).toMatchObject({ tipo: "resolvido", membroId: "m-2", motivo: "nome" });
  });
});

describe("3-4. relação resolve por gênero", () => {
  it("'para meu filho' → Mario", () => {
    expect(alvo("quero uma rotina para meu filho")).toMatchObject({
      tipo: "resolvido",
      membroId: "m-1",
      motivo: "genero",
    });
  });

  it("'para minha filha' → Manu", () => {
    expect(alvo("quero uma rotina para minha filha")).toMatchObject({
      tipo: "resolvido",
      membroId: "m-2",
      motivo: "genero",
    });
  });
});

describe("5-6. pronome resolve quando é sobre a criança", () => {
  it("o caso real: 'vamos levar ela no médico' → Manu", () => {
    const r = alvo(
      "Amanhã vai ser um dia bem importante porque a gente vai levar ela no médico",
      DOIS,
      "m-1", // o contexto trazia o Mario — e é isso que o pronome tem que vencer
    );
    expect(r).toMatchObject({ tipo: "resolvido", membroId: "m-2", motivo: "genero" });
  });

  it("'uma rotina pra ele' → Mario", () => {
    expect(alvo("quero uma rotina pra ele")).toMatchObject({
      tipo: "resolvido",
      membroId: "m-1",
    });
  });

  it("'pra ela' → Manu", () => {
    expect(alvo("quero uma rotina pra ela")).toMatchObject({ tipo: "resolvido", membroId: "m-2" });
  });

  it("pronome solto, longe de pessoa, NÃO decide", () => {
    // "a escola, ela é ótima" não fala da criança. Melhor não resolver do que
    // resolver errado.
    expect(generoApontado("a escola nova, ela é ótima")).toBeNull();
  });
});

describe("7. troca explícita de criança no meio da conversa", () => {
  it("contexto Mario + 'agora é para minha filha' → Manu", () => {
    const r = alvo("agora quero uma para minha filha", DOIS, "m-1");
    expect(r).toMatchObject({ tipo: "resolvido", membroId: "m-2", motivo: "genero" });
  });
});

describe("8. duas filhas — relação não distingue", () => {
  it("'minha filha' com duas meninas → AMBÍGUO, e não escolhe", () => {
    const r = resolverMembroAlvo({ texto: "quero uma rotina para minha filha", membros: [MANU, LIA] });
    expect(r.tipo).toBe("ambiguo");
    if (r.tipo === "ambiguo") {
      expect(r.motivo).toBe("genero");
      expect(r.candidatos.map((c) => c.id).sort()).toEqual(["m-2", "m-3"]);
    }
  });
});

describe("9-10. sem referência nenhuma", () => {
  it("com contexto inequívoco → mantém o contexto", () => {
    const r = alvo("quero organizar a tarde", DOIS, "m-2");
    expect(r).toMatchObject({ tipo: "resolvido", membroId: "m-2", motivo: "contexto" });
  });

  it("SEM contexto e com dois filhos → pergunta, NUNCA o primeiro", () => {
    const r = alvo("quero organizar a tarde", DOIS, null);
    expect(r.tipo).toBe("ambiguo");
    // A regressão que importa: não pode devolver m-1 só por ser o primeiro.
    expect(JSON.stringify(r)).not.toContain('"membroId":"m-1"');
  });
});

describe("11. guarda de consistência", () => {
  it("texto sobre Manu + artefato no Mario → CONFLITO", () => {
    const c = conflitoDeIdentidade({
      texto: "Lição de casa com a Manu. Conversa com a Manu sobre o médico.",
      membroEscolhido: "m-1",
      membros: DOIS,
    });
    expect(c?.id).toBe("m-2");
  });

  it("texto sobre Manu + artefato na Manu → sem conflito", () => {
    expect(
      conflitoDeIdentidade({ texto: "Rotina da Manu", membroEscolhido: "m-2", membros: DOIS }),
    ).toBeNull();
  });

  it("texto sem nome nenhum → sem conflito (não inventa)", () => {
    expect(
      conflitoDeIdentidade({ texto: "acordar, café, escola", membroEscolhido: "m-1", membros: DOIS }),
    ).toBeNull();
  });

  it("texto citando os DOIS → sem conflito claro, não bloqueia", () => {
    expect(
      conflitoDeIdentidade({
        texto: "o Mario e a Manu saem juntos",
        membroEscolhido: "m-1",
        membros: DOIS,
      }),
    ).toBeNull();
  });
});

describe("12. um filho só nunca vira ambiguidade", () => {
  it("sem referência, um membro → resolve", () => {
    expect(resolverMembroAlvo({ texto: "quero uma rotina", membros: [MARIO] })).toMatchObject({
      tipo: "resolvido",
      membroId: "m-1",
      motivo: "unico",
    });
  });

  it("'minha filha' com um filho homem cadastrado → não trava a conversa", () => {
    // Gênero não bate com ninguém: cai nas regras seguintes em vez de barrar.
    // Perfil incompleto ou engano de digitação não pode parar a Ayla.
    expect(resolverMembroAlvo({ texto: "pra minha filha", membros: [MARIO] })).toMatchObject({
      tipo: "resolvido",
      membroId: "m-1",
    });
  });

  it("sem membro nenhum", () => {
    expect(resolverMembroAlvo({ texto: "oi", membros: [] })).toMatchObject({ tipo: "sem_membro" });
  });
});

describe("o orquestrador não chuta mais", () => {
  const ORCH = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");

  it("os fallbacks silenciosos da rotina sumiram", () => {
    // `?? ctxR?.membros[0]?.id` era o que punha o artefato no filho errado
    // quando a resolução falhava.
    expect(ORCH).not.toMatch(/membroMencionado\(inbound\.texto, ctxR\.membros\)/);
    expect(ORCH).toMatch(/alvoDaRotina\(ctxR/);
  });

  it("ambíguo pergunta, reusando a clarificação que já existia", () => {
    expect(ORCH).toMatch(/if \(alvo\.ambiguo\) return await perguntarQualCrianca/);
    expect(ORCH).toMatch(/tipo: "clarificacao_identificacao"/);
  });
});

describe("a guarda vive no ponto compartilhado — app e WhatsApp", () => {
  const SERV = readFileSync(resolve(__dirname, "../ludico/rotina-servico.ts"), "utf8");

  it("o serviço único checa identidade antes de validar e persistir", () => {
    expect(SERV).toMatch(/GUARDA DE IDENTIDADE/);
    expect(SERV).toMatch(/conflitoDeIdentidade\(/);
    expect(SERV).toMatch(/desfecho: "conflito_identidade"/);
  });

  it("a guarda roda ANTES da validação e da persistência", () => {
    expect(SERV.indexOf("GUARDA DE IDENTIDADE")).toBeLessThan(SERV.indexOf("3. VALIDAÇÃO"));
  });
});
