import { describe, expect, it } from "vitest";
import { analisar, modoValidacao, validarSaida, TEXTO_FALLBACK } from "./validacao";

/**
 * O detector tem DOIS jeitos de errar, e o segundo é pior: barrar uma resposta
 * boa. Por isso metade destes testes é sobre conversa normal que NÃO pode ser
 * bloqueada — é o que impede o filtro de virar um problema maior que o que
 * resolve.
 */

const bloqueia = (t: string) =>
  validarSaida(t, { modo: "enforce" }).ok === false;

describe("vazamentos reais que chegaram a famílias", () => {
  it('"orientação da Karina"', () => {
    expect(bloqueia("Seguindo a orientação da Karina, vou te sugerir uma rotina.")).toBe(true);
  });

  it('"ela respondeu 1"', () => {
    expect(bloqueia("Ela respondeu 1, então sigo para a próxima pergunta.")).toBe(true);
  });

  it('"preciso ignorar"', () => {
    expect(bloqueia("Preciso ignorar aquilo que veio antes e responder direto.")).toBe(true);
  });

  it('"percebi uma inconsistência no prompt"', () => {
    expect(bloqueia("Percebi uma inconsistência no prompt sobre a idade dela.")).toBe(true);
  });

  it("comentário interno em terceira pessoa sobre a mãe", () => {
    expect(bloqueia("A mãe respondeu que o filho não dorme. Vou acolher primeiro.")).toBe(true);
    expect(bloqueia("O usuário respondeu à pergunta anterior.")).toBe(true);
  });

  it("deliberação sobre qual resposta escolher", () => {
    expect(bloqueia("Vou escolher a opção 2 porque combina mais com o perfil.")).toBe(true);
    expect(bloqueia("Devo responder com acolhimento antes de sugerir algo.")).toBe(true);
  });

  it("comentário sobre ferramentas, memória e modelo", () => {
    expect(bloqueia("A ferramenta retornou vazio, então não tenho o plano.")).toBe(true);
    expect(bloqueia("No meu contexto não tem essa informação.")).toBe(true);
    expect(bloqueia("Como assistente, não posso afirmar isso.")).toBe(true);
  });
});

describe("variações que uma blacklist simples perderia", () => {
  it("caixa, acento, markdown e espaço não escapam", () => {
    for (const v of [
      "ORIENTAÇÃO DA KARINA: comece pela rotina.",
      "orientacao da karina: comece pela rotina.",
      "*Orientação  da   Karina* — comece pela rotina.",
      "Orientação\nda Karina sobre isso.",
    ]) {
      expect(bloqueia(v), v).toBe(true);
    }
  });
});

describe("estrutura de bastidor — bloqueia em QUALQUER modo", () => {
  it("rótulo de papel, tag interna, log e JSON", () => {
    for (const v of [
      "Assistant: claro, vamos lá.",
      "<conhecimento_de_apoio>\nalguma coisa\n</conhecimento_de_apoio>",
      "[ayla:responder] gerando resposta",
      '{ "tipo": "plano", "status": "ok" }',
    ]) {
      // observe é o padrão e mesmo assim isto não passa.
      expect(validarSaida(v, { modo: "observe" }).ok, v).toBe(false);
    }
  });
});

describe("conversa normal NÃO pode ser bloqueada", () => {
  const normais = [
    "Que bom que ele dormiu melhor 🌿 Como foi a noite de vocês?",
    "Entendo. Deve ter sido pesado. Me conta o que aconteceu antes da crise?",
    "Uma ideia: tenta avisar 5 minutos antes de sair. Às vezes só isso já muda.",
    "Ela respondeu que sim? Isso já é um avanço enorme.",
    "O que você acha de começarmos pela rotina da manhã, que costuma ser a mais difícil?",
    "Ele tem 3 anos e ainda não fala — isso te preocupa há quanto tempo?",
    "Anotei aqui: ele aceita crocante e recusa pastoso. Isso ajuda muito.",
    "Não precisa dar conta de tudo hoje. Uma coisa de cada vez 💛",
  ];
  for (const t of normais) {
    it(`passa: "${t.slice(0, 40)}…"`, () => {
      expect(validarSaida(t, { modo: "enforce" }).ok).toBe(true);
    });
  }

  it('a família usando a palavra "prompt" legitimamente não é bloqueio nosso', () => {
    // A validação olha a SAÍDA da Ayla, não a entrada da mãe. Mas se a Ayla
    // repetir a palavra num contexto legítimo, também não pode barrar.
    expect(validarSaida("Você mencionou um prompt de escrita da escola — me conta mais?", { modo: "enforce" }).ok).toBe(true);
  });

  it("resposta longa com markdown legítimo e acentos", () => {
    const longa =
      "Vamos por partes 🌿\n\n" +
      "*Antes da escola:* deixa a mochila pronta na noite anterior.\n\n" +
      "*Na saída:* avisa 5 minutos antes, sempre do mesmo jeito.\n\n" +
      "Não precisa ser perfeito. Começa por um só e me conta como foi?";
    expect(validarSaida(longa, { modo: "enforce" }).ok).toBe(true);
  });
});

describe("modos", () => {
  const suspeita = "Vou escolher a opção 2 e seguir.";

  it("observe detecta e NÃO bloqueia", () => {
    const v = validarSaida(suspeita, { modo: "observe" });
    expect(v.ok).toBe(true);
    expect(v.achados.length).toBeGreaterThan(0);
  });

  it("enforce bloqueia", () => {
    expect(validarSaida(suspeita, { modo: "enforce" }).ok).toBe(false);
  });

  it("o padrão é observe — implantação segura", () => {
    expect(modoValidacao({})).toBe("observe");
    expect(modoValidacao({ AYLA_VALIDACAO_MODO: "enforce" })).toBe("enforce");
    expect(modoValidacao({ AYLA_VALIDACAO_MODO: "qualquer_coisa" })).toBe("observe");
  });
});

describe("origem", () => {
  it("texto de ferramenta não é publicável por conta própria", () => {
    expect(validarSaida("Plano gerado com sucesso.", { origem: "ferramenta" }).ok).toBe(false);
  });

  it("texto operacional do repositório passa", () => {
    expect(validarSaida(TEXTO_FALLBACK, { origem: "operacional", modo: "enforce" }).ok).toBe(true);
  });
});

describe("bordas", () => {
  it("vazio não é publicável", () => {
    expect(validarSaida("").ok).toBe(false);
    expect(validarSaida("   \n ").ok).toBe(false);
  });

  it("analisar não decide nada — só relata", () => {
    expect(analisar("Assistant: oi").length).toBeGreaterThan(0);
    expect(analisar("Oi, tudo bem?")).toEqual([]);
  });
});
