import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  inboundsComSubstancia,
  temaEcoaFalaCurta,
  ultimaFalaEhConfirmacao,
} from "./prontidao-plano";

/**
 * OS INCIDENTES DE 05/09/2026 — quatro famílias reais, uma classe de erro.
 *
 * ⚠️ NENHUM DESTES É HIPOTÉTICO. Os temas abaixo estão na tabela `planos` de
 * produção, e cada família recebeu "Montei um plano estratégico com atividades
 * sobre isso — mandei em PDF aqui em cima 👆".
 *
 * MEDI a dimensão antes de corrigir: 51 de 195 planos (26%) nasceram até dez
 * minutos depois de uma resposta de até três palavras, em 32 famílias.
 */
describe("gate do plano — os quatro casos indefensáveis", () => {
  /** Vanessa, 04/09: 6 proativas da Ayla, 1 aviso de Trial, e a mãe disse "Ok". */
  it("P1. MORDE: seis falas da Ayla e um 'Ok' não são conversa", () => {
    const historico = [
      { direcao: "outbound", texto: "Vanessa, qual é o desafio que tá pegando mais agora?" },
      { direcao: "outbound", texto: "faltam 3 dias pro fim do seu período grátis." },
      { direcao: "inbound", texto: "Ok" },
    ];
    expect(inboundsComSubstancia(historico)).toBe(0);
    expect(ultimaFalaEhConfirmacao("Ok")).toBe(true);
  });

  /** Lucila, 03/09: plano nasceu depois de "Verdade". */
  it("P2. MORDE: confirmação pura nunca dispara o caminho automático", () => {
    for (const t of ["Ok", "ok", "Sim", "não", "Verdade", "Tudo", "isso", "1", "3", "1 e 3", "uhum"]) {
      expect(ultimaFalaEhConfirmacao(t), `"${t}" deveria ser confirmação`).toBe(true);
    }
  });

  /** ⚠️ E o contrário: conteúdo curto NÃO pode ser tratado como confirmação. */
  it("P3. MORDE: fala curta com conteúdo continua valendo", () => {
    for (const t of ["Aponta e leva", "mais na escola", "Ele toma da minha mão", "grita e chora"]) {
      expect(ultimaFalaEhConfirmacao(t), `"${t}" é conteúdo, não aceite`).toBe(false);
    }
    expect(inboundsComSubstancia([{ direcao: "inbound", texto: "Aponta e leva" }])).toBe(1);
  });

  /** Os temas que nasceram da própria palavra da mãe. */
  it("P4. MORDE: o tema não pode ecoar a palavra curta da família", () => {
    expect(temaEcoaFalaCurta("Responder 'ok' com clareza", "Ok")).toBe(true);
    expect(temaEcoaFalaCurta("Dizer 'ok' e seguir instruções", "Ok")).toBe(true);
    // Numa fala longa, repetir uma palavra dela é personalização — não é eco.
    expect(temaEcoaFalaCurta("Transição da escola para casa", "ele chora quando volta da escola")).toBe(false);
  });

  /**
   * ⚠️ "Jackson tem 9 anos" É UM PLANO REAL. O turno em que a família informa
   * quem é a criança virou tema de plano estratégico.
   */
  it("P5. MORDE: identidade da criança não é desafio", () => {
    const SRC = readFileSync(resolve(__dirname, "prontidao-plano.ts"), "utf8");
    const m = SRC.match(/const TEMA_SO_IDENTIDADE =\s*(\/.+\/[a-z]*)/);
    expect(m, "TEMA_SO_IDENTIDADE sumiu").toBeTruthy();
    const re = new RegExp(m![1].slice(1, m![1].lastIndexOf("/")), "iu");
    for (const t of ["Jackson tem 9 anos", "Lucas, 5 anos", "Maria tem 3 anos"]) {
      expect(re.test(t), `"${t}" é identidade`).toBe(true);
    }
    for (const t of ["Esperar a vez sem gritar", "Transição da escola para casa"]) {
      expect(re.test(t), `"${t}" é desafio legítimo`).toBe(false);
    }
  });
});

/**
 * CLAIRE/MARIA, 03/09 — o classificador sequestrou o turno.
 *
 * ⚠️ PROVEI PELOS LOGS: `api_calls` registrou `classificar_intencao` às
 * 20:06:45 e a resposta saiu às 20:06:46, sem nenhum `ayla_experimental`. O GPT
 * nunca viu "Nós 2, lição e rotina" — a feature Rotina respondeu por ele
 * "Não achei uma rotina pra ajustar 🌿" no meio de uma investigação boa.
 */
describe("classificador é sugestão, não autoridade", () => {
  it("C1. MORDE: rotina_editar exige o piso determinístico de menção", () => {
    const ORCH = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");
    expect(ORCH).toMatch(/intencaoDeRotinaComPiso\s*=/);
    expect(ORCH).toMatch(/intent === "rotina_editar" &&/);
    expect(ORCH).toMatch(/pedeRotina\(inbound\.texto\) \|\| pediuRotinaExplicitamente\(inbound\.texto\)/);
    // E o gatilho antigo, sozinho, não pode ter voltado.
    expect(ORCH).not.toMatch(/\(intent === "rotina_editar" \|\| pedidoDeEditarRotina/);
  });
});
