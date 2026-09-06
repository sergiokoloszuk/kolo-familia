import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { abreFluxoDeArtefato, atoSobreArtefato } from "@/lib/conducao/ato-artefato";
import { pedeEditarRotina, pedeRotina, pediuRotinaExplicitamente } from "./rotina-guiada";
import { classificarFeedbackRotina } from "./rotina-feedback";

/**
 * AUTORIDADE SOBRE O ARTEFATO ROTINA — falar sobre ≠ pedir para criar.
 *
 * ⚠️ O CASO REAL (Ana/Geovanna, 11/08/2026). A mãe escreveu "Quando é preciso
 * mudar a rotina de repente ela sente" — uma descrição do que acontece com a
 * filha. O radical `precis` casou em `pedeRotina`, o fluxo do artefato abriu, e
 * a conversa terminou com "Não achei uma rotina pra ajustar 🌿" no meio de um
 * assunto sobre escola.
 *
 * MEDIDO contra as funções reais antes desta fatia: **5 de 6 usos conceituais**
 * de "rotina" abriam alguma porta do artefato.
 *
 * A correção NÃO alarga nem troca as listas de verbos: `pedeRotina` e
 * `pediuRotinaExplicitamente` continuam como PISO (a rotina precisa ser
 * mencionada), e o ATO decide se aquilo é pedido. A composição só pode
 * ESTREITAR o portão.
 */

const ORCH = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");

/** O portão real, reproduzido: piso de menção + ato que abre fluxo. */
const abreRotina = (t: string) =>
  (pedeRotina(t) || pediuRotinaExplicitamente(t)) && abreFluxoDeArtefato(atoSobreArtefato(t));

describe("o pedido legítimo continua criando", () => {
  it("1. MORDE: pedidos reais abrem o fluxo", () => {
    for (const t of [
      "Quero montar uma rotina visual para a manhã.",
      "quero monta uma rotina",
      "pode criar uma rotina pra manhã?",
      "me ajuda a organizar a rotina dela?",
      "quero mudar a rotina de terça",
      "faz a rotina da tarde pra mim",
    ]) {
      expect(abreRotina(t), `"${t}" foi BLOQUEADO`).toBe(true);
    }
  });
});

describe("falar sobre a vida da criança NÃO cria artefato", () => {
  it("2. MORDE: os usos conceituais do caso Ana/Geovanna", () => {
    for (const t of [
      "Quando é preciso mudar a rotina de repente ela sente", // ✗ ANTES: abria
      "Ela sofre quando muda a rotina.",
      "Ela não aceita quando muda a rotina",
      "A professora mudou a rotina da sala",
      "A rotina está ótima mas ela não quer ir",              // ✗ ANTES: abria
      "preciso entender por que a rotina nova pesa pra ela",  // ✗ ANTES: abria
      "Ela sabe toda a rotina e mesmo assim trava",
      "qdo muda rotina ela fica mal",
    ]) {
      expect(abreRotina(t), `"${t}" ABRIU o artefato`).toBe(false);
    }
  });

  it("3. MORDE: recusa explícita nunca cria", () => {
    for (const t of ["n quero rotina agora", "não quero rotina agora", "agora não quero montar rotina"]) {
      expect(atoSobreArtefato(t), `"${t}"`).toBe("recusar");
      expect(abreRotina(t), `"${t}" ABRIU o artefato`).toBe(false);
    }
  });

  it("4. MORDE: conversar sobre uma rotina existente não cria outra", () => {
    for (const t of ["a rotina q vc fez ficou boa", "me explica essa rotina", "essa rotina n fez sentido"]) {
      expect(abreRotina(t), `"${t}" ABRIU o artefato`).toBe(false);
    }
  });

  it("5. MORDE: reenviar não é criar", () => {
    // Gerar uma rotina nova quando a mãe pediu a que já existe é trabalho
    // jogado fora e um artefato a mais para ela administrar.
    expect(atoSobreArtefato("manda a rotina de novo")).toBe("reenviar");
    expect(abreRotina("manda a rotina de novo")).toBe(false);
  });

  it("6. editar abre o fluxo — é alteração, não conversa", () => {
    expect(atoSobreArtefato("quero mudar a rotina de terça")).toBe("editar");
    expect(abreRotina("quero mudar a rotina de terça")).toBe(true);
  });
});

describe("o portão real do orquestrador", () => {
  it("7. MORDE: o gate compõe piso + ato, e não troca um pelo outro", () => {
    expect(ORCH).toMatch(
      /const pedidoDeRotina =\s*\n\s*\(pedeRotina\(inbound\.texto\) \|\| pediuRotinaExplicitamente\(inbound\.texto\)\) &&\s*\n\s*abreFluxoDeArtefato\(atoSobreArtefato\(inbound\.texto\)\);/,
    );
  });

  it("8. MORDE: `rotinaConversa` NÃO passa pelo ato — é continuação", () => {
    // A família já pediu; o turno é a resposta dela. Exigir o ato de novo
    // mataria a montagem no meio, a cada resposta curta.
    const i = ORCH.indexOf("const pedidoDeRotina =");
    const gate = ORCH.slice(i, i + 900);
    expect(gate).toMatch(/\(rotinaConversa \|\|/);
  });

  it("9. MORDE: `organizacao` continua no gate — não se corrige por inferência", () => {
    // Eu havia tirado. Não há prova de que um turno real classificado como
    // `organizacao` tenha criado artefato indevido — `conhecimento_consultado`
    // não registra intenção. Quando registrar (PEND-040), decide-se com dado.
    const i = ORCH.indexOf("const pedidoDeRotina =");
    expect(ORCH.slice(i, i + 900)).toMatch(/\(intent === "organizacao" && pedidoExplicito\) \|\|/);
  });
});

// ============================================================
// O PORTÃO DE EDITAR — o caminho REAL do caso Ana/Geovanna
// ============================================================

/**
 * ⚠️ A frase "Não achei uma rotina pra ajustar 🌿" nasce em `editarRotina`, e
 * quem abriu a porta foi `pedeEditarRotina` — NÃO o portão de criar. A primeira
 * fatia (ad59254) corrigiu o portão errado para este caso específico.
 *
 * MEDIDO: como gatilho isolado, `pedeEditarRotina` abre para 4 de 6 usos
 * conceituais de "mudar a rotina" e para só 2 dos 8 pedidos legítimos de
 * edição — os outros entram por `intent` ou pelo feedback.
 */
const abreEdicao = (t: string) => pedeEditarRotina(t) && atoSobreArtefato(t) === "editar";

describe("editar rotina", () => {
  it("10. MORDE: o pedido real de edição continua entrando", () => {
    for (const t of ["muda a rotina de hoje", "quero mudar aquela rotina que fizemos"]) {
      expect(abreEdicao(t), `"${t}" foi BLOQUEADO`).toBe(true);
    }
  });

  it("11. MORDE: os quatro usos conceituais que abriam a edição", () => {
    for (const t of [
      "Quando é preciso mudar a rotina de repente ela sente",
      "qdo muda a rotina ela fica mal",
      "ele nao aceita mudar a rotina",
      // Infinitivo inicial é NOME, não imperativo — "mudar é difícil".
      "mudar a rotina dela é sempre difícil",
    ]) {
      expect(pedeEditarRotina(t), `"${t}" nem chega no piso — o caso perdeu a graça`).toBe(true);
      expect(abreEdicao(t), `"${t}" ABRIU a edição`).toBe(false);
    }
  });

  it("12. MORDE: o feedback NÃO passa pelo ato — é edição por necessidade", () => {
    // "já faz sozinho" é `ambiguo` para o classificador, e tem que continuar
    // entrando: quem decide ali é `classificarFeedbackRotina`, não o ato.
    for (const t of ["já faz sozinho", "não funcionou até o jantar"]) {
      expect(atoSobreArtefato(t)).toBe("ambiguo");
      expect(classificarFeedbackRotina(t), `"${t}" deixou de ser feedback`).not.toBeNull();
    }
  });
});
