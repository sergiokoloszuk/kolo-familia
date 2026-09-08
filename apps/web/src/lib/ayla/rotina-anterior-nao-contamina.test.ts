import { describe, expect, it } from "vitest";
import {
  blocoRotinaAnterior,
  familiaDitouSequencia,
  pediuRotinaExplicitamente,
  perguntaDeTema,
  temaEnunciado,
} from "./rotina-guiada";

/**
 * O INCIDENTE DE 08/09/2026, 08:53 — MANU, O BARCO E A ORDEM TROCADA.
 *
 * ⚠️ ESTE É O SEGUNDO LUGAR DE ONDE O BARCO SAÍA. O Gate A (95941d9) tirou o
 * passeio de barco de `categorias_extras.transicoes` e provou contra os 177
 * perfis de produção: zero vazamentos. Sete minutos depois do deploy, a mãe
 * pediu uma rotina e recebeu o barco de novo.
 *
 * A origem era outra: `carregarOQueJaSabemos` injeta as TRÊS últimas rotinas
 * com suas tarefas, e a rotina de 07/09 ("Dia de shopping e passeio") continha
 * o barco inteiro. O prompt do condutor dizia **"use como base"**.
 *
 * ⚠️ E A MOLDURA CERTA JÁ EXISTIA NO MESMO ARQUIVO. `avaliarProntidaoParaRotina`
 * recebia "NÃO é a sequência de agora", escrito depois de um incidente de
 * 04/08/2026 com ESTA MESMA CRIANÇA. O condutor nunca soube. Dois donos para o
 * mesmo dado — por isso a correção é uma função só, usada pelos dois sítios.
 */

/** A rotina de 07/09 da Manu, como está no banco de produção. */
const ROTINA_07_09 =
  "Dia de shopping e passeio: Brincadeira → Banho → Almoço → Preparar para o passeio de barco (colocar sapato, pegar pertences) → Ir até o barco → Entrar no barco com calma → Passeio de barco → Shopping";

/** A mensagem real da mãe, 08/09/2026 08:53:19. */
const PEDIDO_MANU = `Quero montar uma rotina visual para Manu
Brincar
Tomar banho
Almoçar
Ir ao shopping`;

describe("incidente Manu 08/09 — a rotina de ontem não entra na de hoje", () => {
  it("REGRESSÃO: com a sequência ditada, a rotina anterior NÃO entra no prompt", () => {
    const bloco = blocoRotinaAnterior(ROTINA_07_09, PEDIDO_MANU);
    expect(bloco).toBe("");
    expect(bloco.toLowerCase()).not.toContain("barco");
  });

  it("REGRESSÃO: nem a palavra barco, nem a ordem Banho→Almoço de ontem chegam", () => {
    const bloco = blocoRotinaAnterior(ROTINA_07_09, PEDIDO_MANU);
    expect(bloco.toLowerCase()).not.toContain("barco");
    expect(bloco).not.toContain("Banho → Almoço");
    expect(bloco).not.toContain("Shopping");
  });

  it("o 'use como base' não existe mais em lugar nenhum", () => {
    const semPedido = blocoRotinaAnterior(ROTINA_07_09, "e a rotina dela, como ficou?");
    expect(semPedido).not.toContain("use como base");
    expect(semPedido).toContain("NÃO é a sequência de agora");
    expect(semPedido).toContain("NÃO empresta etapa nenhuma");
  });

  it("MARIO/SUDOKU — mesma proteção para a sequência de 7 passos", () => {
    const pedido = `Quero uma sequencia visual para o Mario
Acordar
Estudar
Almoçar
Meditar
Fono
Jantar
Dormir`;
    const anterior = "Tarde do Mario: Estudar → Respiração antes do sudoku → Sudoku → Fono";
    expect(blocoRotinaAnterior(anterior, pedido)).toBe("");
  });
});

describe("quando a rotina anterior AINDA é contexto legítimo", () => {
  it("pergunta sobre a rotina existente continua recebendo o contexto", () => {
    const bloco = blocoRotinaAnterior(ROTINA_07_09, "como ficou a rotina da Manu mesmo?");
    expect(bloco).toContain("Dia de shopping e passeio");
    expect(bloco).toContain("serve pra conhecer a criança");
  });

  it("pedido sem sequência ditada mantém o contexto, emoldurado", () => {
    const bloco = blocoRotinaAnterior(ROTINA_07_09, "queria organizar a tarde dela");
    expect(bloco).toContain("Dia de shopping e passeio");
    expect(bloco).toContain("NÃO conta como sequência informada");
  });

  it("sem rotina anterior, bloco vazio — sem cabeçalho fantasma", () => {
    expect(blocoRotinaAnterior("", PEDIDO_MANU)).toBe("");
    expect(blocoRotinaAnterior("   ", null)).toBe("");
  });
});

describe("familiaDitouSequencia — conservador na direção certa", () => {
  it("reconhece a lista real da Manu", () => {
    expect(familiaDitouSequencia(PEDIDO_MANU)).toBe(true);
  });

  it("não confunde conversa com lista", () => {
    expect(familiaDitouSequencia("Banho é uma luta aqui em casa, todo dia")).toBe(false);
    expect(familiaDitouSequencia("quero uma rotina visual pra Manu")).toBe(false);
    expect(familiaDitouSequencia(null)).toBe(false);
    expect(familiaDitouSequencia("")).toBe(false);
  });

  it("três itens é o piso — duas linhas não bastam", () => {
    expect(familiaDitouSequencia("Rotina da Manu\nBanho\nJantar")).toBe(false);
    expect(familiaDitouSequencia("Rotina da Manu\nBanho\nJantar\nDormir")).toBe(true);
  });

  it("linhas longas ou perguntas não contam como etapa", () => {
    const texto = `Quero uma rotina
Ela sempre chora muito quando precisa parar de brincar e isso me deixa sem saber o que fazer
Como faço nessa hora?
E se ela não quiser?`;
    expect(familiaDitouSequencia(texto)).toBe(false);
  });
});

describe("a pergunta do tema é explícita — cartoes-visuais-v2 §10", () => {
  it("duas sugestões numeradas, mais outro tema, mais SEM TEMA", () => {
    const p = perguntaDeTema("Manu", ["contos e princesas", "dinossauros"]);
    expect(p).toContain("1️⃣");
    expect(p).toContain("2️⃣");
    expect(p).toContain("contos e princesas");
    expect(p).toContain("dinossauros");
    expect(p).toContain("sem tema");
    expect(p).toContain("só o número");
  });

  it("sem interesse registrado, convida sem inventar preferência", () => {
    const p = perguntaDeTema("Manu", []);
    expect(p).not.toContain("1️⃣");
    expect(p).toContain("sem tema");
    expect(p).toContain("Manu");
  });

  it("REGRESSÃO: o texto de 08/09 não volta — uma sugestão colada, sem saída", () => {
    const p = perguntaDeTema("Manu", ["contos e princesas"]);
    expect(p).not.toContain("ou qualquer outro que Manu esteja gostando agora.");
    expect(p).toContain("sem tema");
  });
});

/**
 * O SEGUNDO INCIDENTE DO MESMO DIA — 08/09/2026, 09:13.
 *
 * ⚠️ A mãe refez o teste: "Quero montar uma sequencia visual / Para Manu /
 * Brincar, tomar banho, almoçar, ir ao shopping". O texto do WhatsApp saiu
 * limpo — a correção das 09:00 funcionou, nenhuma menção a barco na fala. Mas:
 * a Ayla NÃO perguntou o tema, mandou o link na hora, e as IMAGENS vieram
 * cheias de barco.
 *
 * ⚠️ RECONSTRUÍDO: a mensagem nunca chegou a criar rotina. Havia a rotina de
 * 08:53 (`aa52a529`, com as nove etapas do barco) esperando tema. O ramo do
 * tema capturou a mensagem inteira, `lerTemaEscolhido` extraiu **"sequencia
 * visual"** como nome do desenho, e a geração disparou sobre o artefato ERRADO.
 *
 * Três buracos numa cadeia só:
 *   1. `pediuRotinaExplicitamente` só conhecia "rotina visual" — o produto
 *      (cartoes-visuais-v2 §1) admite os três nomes;
 *   2. `familiaDitouSequencia` só via lista em linhas, não em vírgulas;
 *   3. o ramo do tema não perguntava se a mensagem era um pedido novo.
 */
describe("incidente Manu 09:13 — pedido novo não é resposta de tema", () => {
  const PEDIDO_0913 = `Quero montar uma sequencia visual
Para Manu
Brincar, tomar banho, almoçar,  ir ao shopping`;

  it("REGRESSÃO: 'sequência visual' é reconhecida como pedido do artefato", () => {
    expect(pediuRotinaExplicitamente(PEDIDO_0913)).toBe(true);
  });

  it("os três nomes do artefato valem — cartoes-visuais-v2 §1", () => {
    expect(pediuRotinaExplicitamente("quero uma rotina visual")).toBe(true);
    expect(pediuRotinaExplicitamente("quero uma sequencia visual")).toBe(true);
    expect(pediuRotinaExplicitamente("quero uma sequência visual")).toBe(true);
    expect(pediuRotinaExplicitamente("me faz uns cartões visuais")).toBe(true);
  });

  it("REGRESSÃO: lista em UMA linha, separada por vírgula, é sequência ditada", () => {
    expect(familiaDitouSequencia(PEDIDO_0913)).toBe(true);
    expect(familiaDitouSequencia("Brincar, tomar banho, almoçar, ir ao shopping")).toBe(true);
    expect(familiaDitouSequencia("acordar → escola → almoço → dormir")).toBe(true);
  });

  it("vírgula em desabafo NÃO vira sequência", () => {
    expect(familiaDitouSequencia("ele grita, chora e se joga no chão toda vez que eu falo não")).toBe(
      false,
    );
    expect(familiaDitouSequencia("tá difícil, muito difícil mesmo")).toBe(false);
  });

  it("o nome do artefato nunca pode virar o tema do desenho", () => {
    expect(temaEnunciado("Quero montar uma sequencia visual")).toBeNull();
    expect(temaEnunciado("quero uma rotina visual")).toBeNull();
    expect(temaEnunciado("quero cartões visuais")).toBeNull();
  });

  it("mas um tema de verdade continua sendo lido", () => {
    expect(temaEnunciado("quero dinossauros")).toBe("dinossauros");
    expect(temaEnunciado("tema: princesas")).toBe("princesas");
  });
});
