import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { FORMATO_WHATSAPP, notaDeProporcao } from "./formas";
import { naturezaDoTurno } from "./fronteiras-forma";

/**
 * R4a · A RESPOSTA NASCE PROPORCIONAL — 26/08/2026.
 *
 * Prevenção, não guardrail: nada aqui regenera nem corta. O que muda é o que o
 * modelo lê ANTES de escrever.
 *
 * ⚠️ O QUE ESTES TESTES PROTEGEM não é o tamanho — é o que NÃO pode ser
 * sacrificado por ele. A auditoria de 18 pares reais mediu utilidade 4,1 e
 * segurança 4,6; o risco desta mudança é justamente derrubar esses dois para
 * ganhar caracteres. Por isso metade das asserções é sobre preservação.
 */
const FORMAS = fs.readFileSync(path.join(__dirname, "formas.ts"), "utf8");
const OFICIAL = fs.readFileSync(
  path.join(__dirname, "..", "ayla", "experimental.ts"),
  "utf8",
);

describe("o princípio entra por onde as famílias de fato recebem", () => {
  it("1. o princípio central está em FORMATO_WHATSAPP, que é INCONDICIONAL", () => {
    expect(FORMATO_WHATSAPP).toMatch(/A MENOR RESPOSTA QUE REALMENTE AJUDA VENCE/);
    expect(FORMATO_WHATSAPP).toMatch(/Entregue primeiro o essencial/);
  });

  it("2. MORDE: não foi parar atrás do gate quebrado", () => {
    // `pedeEntregaEstruturada` devolve false em 100% dos turnos do Oficial (a
    // taxonomia de intenção daqui não tem "desafio"). Qualquer regra colocada
    // atrás dele é inerte — foi o que aconteceu com PEND-144 itens 5 e 6.
    const i = OFICIAL.indexOf("const formato = [");
    const j = OFICIAL.indexOf("];", i);
    const bloco = OFICIAL.slice(i, j);
    // FORMATO_WHATSAPP e a proporção entram ANTES do spread condicional.
    const iFormato = bloco.indexOf("FORMATO_WHATSAPP");
    const iProporcao = bloco.indexOf("proporcao");
    const iGate = bloco.indexOf("...(entrega");
    expect(iFormato).toBeGreaterThanOrEqual(0);
    expect(iProporcao).toBeGreaterThanOrEqual(0);
    expect(iGate).toBeGreaterThan(iProporcao);
  });

  it("3. a proporção é CALCULADA pelo código, não deduzida pelo modelo", () => {
    expect(OFICIAL).toMatch(/notaDeProporcao\(\s*naturezaDoTurno\(params\.mensagem/);
  });
});

describe("PROPORÇÃO — cada natureza recebe a instrução certa", () => {
  it("4. cumprimento pede resposta curta e proíbe abrir assunto", () => {
    const n = notaDeProporcao("simples");
    expect(n).toMatch(/cumprimento|resposta curta/i);
    expect(n).toMatch(/sem abrir assunto novo/i);
    expect(n).toMatch(/350/);
  });

  it("5. continuação manda seguir de onde pararam, sem reexplicar", () => {
    const n = notaDeProporcao("continuacao");
    expect(n).toMatch(/Não recomece nem reexplique/i);
    expect(n).toMatch(/500/);
  });

  it("6. situação concreta pede orientação breve e aplicável hoje", () => {
    const n = notaDeProporcao("orientacao");
    expect(n).toMatch(/aplicável hoje/i);
    expect(n).toMatch(/700/);
  });

  it("7. MORDE: pedido técnico NÃO pede brevidade — encurtar ali é errar", () => {
    const n = notaDeProporcao("tecnico");
    expect(n).toMatch(/NÃO encurte/);
    expect(n).toMatch(/Responder raso aqui é pior/);
    // E não carrega número nenhum: o tamanho segue o pedido.
    expect(n).not.toMatch(/\d{3}/);
  });

  it("8. as quatro naturezas produzem notas DIFERENTES", () => {
    const notas = (["simples", "continuacao", "orientacao", "tecnico"] as const).map(
      notaDeProporcao,
    );
    expect(new Set(notas).size).toBe(4);
  });
});

describe("NÃO-REGRESSÃO — o que o encurtamento não pode levar junto", () => {
  it("9. o formato nomeia, item a item, o que NUNCA se corta", () => {
    for (const obrigatorio of [
      /orientação principal/i,
      /ressalva de segurança/i,
      /específico DESTA criança/,
      /frase pronta/i,
      /o que observar/i,
    ]) {
      expect(FORMATO_WHATSAPP).toMatch(obrigatorio);
    }
  });

  it("10. e nomeia o que PODE ser cortado — senão 'corte' vira 'corte qualquer coisa'", () => {
    expect(FORMATO_WHATSAPP).toMatch(/repetição do que ela acabou de contar/i);
    expect(FORMATO_WHATSAPP).toMatch(/explicação que ninguém pediu/i);
  });

  it("11. MORDE: saiu a frase que EMPURRAVA tamanho", () => {
    // A versão anterior mandava "uma pergunta prática merece 3-5 opções
    // concretas" — instrução de inflar, dentro do bloco de disciplina de canal.
    expect(FORMATO_WHATSAPP).not.toMatch(/3-5 opções concretas/);
  });

  it("12. MORDE: as regras antigas do canal continuam todas lá", () => {
    // "sem markdown" virou a lista do que o canal não converte (05/09/2026).
    expect(FORMATO_WHATSAPP).toMatch(/sem títulos \(##\)/);
    expect(FORMATO_WHATSAPP).toMatch(/No máximo UMA pergunta por vez/);
    expect(FORMATO_WHATSAPP).toMatch(/Não dê moldura clínica/);
    expect(FORMATO_WHATSAPP).toMatch(/Não prometa artefato/);
    expect(FORMATO_WHATSAPP).toMatch(/ROTINA VISUAL e PLANO completo/);
  });

  it("13. MORDE: R4a não introduziu chamada de modelo nem consulta", () => {
    const i = OFICIAL.indexOf("const proporcao = notaDeProporcao(");
    const bloco = OFICIAL.slice(i, i + 400);
    expect(bloco).not.toMatch(/await |supabase\.from|gerarConversacional/);
  });
});

describe("as fixtures reais caem na natureza certa", () => {
  const casos: Array<[string, boolean, string]> = [
    ["Oi boa tarde", false, "simples"],
    ["Sim conversa", true, "continuacao"],
    ["Já era segunda vez", true, "continuacao"],
    ["Ontem ele ficou furioso dentro de casa, quebrou os brinquedos dele e bateu a bola na perna da minha vizinha.", true, "orientacao"],
    ["tem alguma lei que embasa a redução de carga horária dele?", true, "tecnico"],
    ["A luta com o sono e desde dela pequena", false, "orientacao"],
  ];
  for (const [msg, ja, esperado] of casos) {
    it(`14. "${msg.slice(0, 40)}…" → ${esperado}`, () => {
      expect(naturezaDoTurno(msg, ja)).toBe(esperado);
    });
  }
});
