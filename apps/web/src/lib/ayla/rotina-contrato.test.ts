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
 * FONTE ÚNICA DA VERDADE (08/08/2026).
 *
 * O condutor escrevia a lista de etapas na própria fala, de cabeça, ANTES de
 * `gerarRotina` compor o quadro. Duas composições independentes do mesmo
 * pedido: em 07/08 a mãe leu 12 etapas e a criança recebeu 9, com a visita à
 * pessoa nova — o motivo do pedido — colapsada num cartão genérico.
 *
 * O gerador é a autoridade desde a consolidação de 03/08 (`rotina-servico.ts`).
 * O que sai agora é a SEGUNDA composição, que nunca teve autoridade nenhuma.
 */
describe("uma composição só", () => {
  it("o condutor NÃO tem campo de rotinas na ferramenta", () => {
    const schema = GUIADA.slice(
      GUIADA.indexOf("const FERRAMENTA_CONDUTOR"),
      GUIADA.indexOf("type BlocoResposta"),
    );
    expect(schema).not.toMatch(/rotinas: \{/);
    expect(schema).toMatch(/NÃO existe campo `rotinas` aqui/);
    // `transicoes` FICA: é lido e vira aprendizado no perfil.
    expect(schema).toMatch(/transicoes: \{/);
  });

  it("nada lê `parsed.rotinas` — o campo morto não volta", () => {
    // Só CÓDIGO: o comentário que explica por que o campo saiu cita o nome.
    const semComentarios = GUIADA.split("\n")
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join("\n");
    expect(semComentarios).not.toMatch(/parsed\??\.rotinas/);
  });

  it("o contrato PROÍBE narrar a sequência na fala", () => {
    expect(GUIADA).toMatch(/NÃO escreva a sequência na sua "mensagem"/);
    expect(GUIADA).not.toMatch(/Sua "mensagem" mostra a rotina no texto/);
  });

  it("a sequência da fala é lida do BANCO, não do modelo", () => {
    expect(GUIADA).toMatch(/async function sequenciaDoQuadro/);
    expect(GUIADA).toMatch(/from\("rotina_tarefas"\)[\s\S]{0,120}\.in\("rotina_id", ids\)/);
    expect(GUIADA).toMatch(/const sequencia = await sequenciaDoQuadro\(supabase, ids\)/);
    expect(GUIADA).toMatch(/\$\{fechamento\}\$\{quadro\}/);
  });

  it("se a leitura falhar, a fala sai SEM lista — nunca com uma inventada", () => {
    const fn = GUIADA.slice(
      GUIADA.indexOf("async function sequenciaDoQuadro"),
      GUIADA.indexOf("/** Rotinas criadas com cartões pedidos"),
    );
    expect(fn).toMatch(/console\.error/);
    expect(fn).toMatch(/return "";/);
  });

  it("a regra de nomear o dia vive no gerador, que é quem compõe", () => {
    const CORE = readFileSync(new URL("../ludico/rotina-ia-core.ts", import.meta.url), "utf8");
    expect(CORE).toMatch(/O NOME DIZ O QUE ACONTECE NAQUELE DIA/);
    // E o contrato do condutor não descreve mais o formato do dado.
    expect(GUIADA).not.toMatch(/rotinas: \[\{"nome"/);
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

  /**
   * Conversa real de 07/08/2026 (Manu, "Boneca de pano"): o turno que pedia o
   * tema saiu com TRÊS chamadas à ação coladas — escolha um tema, abra o link,
   * peça o PDF — e o link levava a uma rotina em `aguardando`, sem cartão
   * nenhum pra ver. Neste turno a Ayla tem um objetivo só.
   */
  it("no turno que pede o tema não sai link nem oferta de PDF", () => {
    expect(GUIADA).toMatch(/const link = faltaTema \? null : await gerarMagicLink/);
    expect(GUIADA).toMatch(/const dica = faltaTema\s*\n?\s*\? ""/);
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
