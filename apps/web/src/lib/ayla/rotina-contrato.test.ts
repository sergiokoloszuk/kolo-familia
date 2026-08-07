import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { lerTemaEscolhido } from "./rotina-guiada";

const GUIADA = readFileSync(new URL("./rotina-guiada.ts", import.meta.url), "utf8");
const ROTA = readFileSync(
  new URL("../../app/api/ludico/gerar-rotina/route.ts", import.meta.url),
  "utf8",
);

/**
 * O DEFEITO DE 07/08/2026, travado.
 *
 * O condutor devolveu `acao:"montar"` e tema "princesas"; a fala dela citava a
 * frase que a mãe usaria — "agora vamos ao mercado" — e as aspas não escapadas
 * quebraram o JSON.parse. `extrairJsonRotina` devolvia null em silêncio e os
 * cartões nunca eram disparados. Três de três execuções em produção.
 */
describe("contrato estruturado do condutor", () => {
  it("o turno volta por ferramenta, não por JSON em texto", () => {
    expect(GUIADA).toMatch(/tools: \[FERRAMENTA_CONDUTOR\]/);
    expect(GUIADA).toMatch(/tool_choice: \{ type: "tool", name: FERRAMENTA_CONDUTOR\.name \}/);
  });

  it("a fala é declarada como texto livre — aspas não são problema do modelo", () => {
    expect(GUIADA).toMatch(/NÃO precisam ser escapados/);
    expect(GUIADA).toMatch(/você NUNCA deve escapar nada à mão/);
  });

  it("o contrato não pede mais 'APENAS JSON'", () => {
    expect(GUIADA).not.toMatch(/devolva APENAS JSON/);
  });

  it("cair no parser de texto é ERRO audível, nunca silêncio", () => {
    const fn = GUIADA.slice(
      GUIADA.indexOf("function lerDesfechoDoCondutor"),
      GUIADA.indexOf("* CONDUZ a conversa de rotina"),
    );
    expect(fn).toMatch(/console\.error/);
    expect(fn).toMatch(/DESFECHO PERDIDO/);
  });
});

/**
 * A resposta "princesas" é o gatilho do turno inteiro. Se ela precisasse
 * sobreviver a uma ida ao modelo e a um parser, seria a mesma falha de novo.
 */
describe("gatilho determinístico do tema", () => {
  it("reconhece a escolha crua e as formas educadas", () => {
    expect(lerTemaEscolhido("princesas")).toBe("princesas");
    expect(lerTemaEscolhido("pode ser princesas")).toBe("princesas");
    expect(lerTemaEscolhido("quero no tema de dinossauros")).toBe("dinossauros");
    expect(lerTemaEscolhido("acho que fundo do mar")).toBe("fundo do mar");
    expect(lerTemaEscolhido("Bichinhos.")).toBe("Bichinhos");
  });

  it("NÃO sequestra mensagem que é outra coisa", () => {
    expect(lerTemaEscolhido("muda a etapa do banho pra depois do jantar")).toBeNull();
    expect(lerTemaEscolhido("me manda em pdf")).toBeNull();
    expect(lerTemaEscolhido("qual horário você encaixaria o lanche?")).toBeNull();
    expect(lerTemaEscolhido("não quero cartões")).toBeNull();
    expect(lerTemaEscolhido("")).toBeNull();
    expect(lerTemaEscolhido("hoje foi um dia bem difícil, ela chorou muito na saída da escola")).toBeNull();
  });

  it("aplica o tema e dispara sem passar por modelo", () => {
    const bloco = GUIADA.slice(
      GUIADA.indexOf("GATILHO DETERMINÍSTICO DO TEMA"),
      GUIADA.indexOf("Conversa desta sessão"),
    );
    expect(bloco).toMatch(/lerTemaEscolhido\(params\.contexto\)/);
    expect(bloco).toMatch(/dispararGeracao\(pendente\.id, escolhido\)/);
    // Roda ANTES da chamada ao condutor.
    expect(GUIADA.indexOf("GATILHO DETERMINÍSTICO DO TEMA")).toBeLessThan(
      GUIADA.indexOf("tools: [FERRAMENTA_CONDUTOR]"),
    );
  });
});

/**
 * `tema=null` não pode mais significar abandono silencioso — era isso, e não a
 * pergunta em si, que "segurava a entrega" em 03/08.
 */
describe("estado verdadeiro dos cartões", () => {
  it("cartões pedidos sem tema ficam em 'aguardando', não em 'nenhum'", () => {
    expect(GUIADA).toMatch(/cards_status: "aguardando"/);
    expect(GUIADA).toMatch(/await marcarAguardandoTema\(supabase, ids\)/);
  });

  it("desistir dos cartões limpa o estado — nada fica pendurado", () => {
    expect(GUIADA).toMatch(/recusouTema\(params\.contexto\)/);
  });

  it("a Ayla só diz que começou quando o gerador confirmou", () => {
    expect(GUIADA).toMatch(/const comecou = await dispararGeracao/);
    expect(GUIADA).toMatch(/Os cartões ainda não começaram a ser desenhados/);
  });

  it("o tema é perguntado com no máximo DUAS sugestões, e a escolha é da família", () => {
    expect(GUIADA).toMatch(/QUEM ESCOLHE É A FAMÍLIA/);
    expect(GUIADA).toMatch(/NÃO decida por ela/);
    expect(GUIADA).toMatch(/\.slice\(0, 2\)/);
  });
});

describe("endpoint de geração paga", () => {
  it("é fail-closed: sem segredo no ambiente, ninguém gera", () => {
    expect(ROTA).toMatch(/if \(!secret\) \{/);
    expect(ROTA).not.toMatch(/if \(secret && request\.headers/);
  });

  it("compara em tempo constante e nunca loga o segredo", () => {
    expect(ROTA).toMatch(/timingSafeEqual/);
    expect(ROTA).not.toMatch(/console\.[a-z]+\([^)]*\$\{secret\}/);
  });

  /**
   * `AYLA_WEBHOOK_SECRET` governa o INBOUND da Z-API (fail-open) e o HMAC do
   * cookie de ativação. Reaproveitá-lo aqui faria uma variável mudar três
   * comportamentos de uma vez — e criá-la na Vercel ligaria a exigência de
   * header em toda mensagem que entra, emudecendo a Ayla se o painel não
   * estivesse configurado igual. O desacoplamento fica travado por teste.
   */
  it("usa segredo PRÓPRIO — não o do webhook de entrada", () => {
    expect(ROTA).toMatch(/process\.env\.KOLO_GERACAO_SECRET/);
    expect(ROTA).not.toMatch(/process\.env\.AYLA_WEBHOOK_SECRET/);
    expect(GUIADA).toMatch(/process\.env\.KOLO_GERACAO_SECRET/);
    expect(GUIADA).not.toMatch(/process\.env\.AYLA_WEBHOOK_SECRET/);
  });
});
