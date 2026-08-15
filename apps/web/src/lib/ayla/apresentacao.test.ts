import { describe, it, expect } from "vitest";
import {
  paraWhatsApp,
  sintaxeCruaWhatsApp,
  sintaxeCruaWeb,
} from "./apresentacao";
import { dividirEmBolhas } from "./bolhas";

/**
 * O QUE ESTES TESTES PROVAM.
 *
 * `paraWhatsApp` é uma função que vai rodar no caminho de TODA mensagem que
 * TODA família recebe. O risco dela não é falhar — é funcionar quase certo:
 * comer uma palavra, quebrar uma URL, mudar um número, estragar um emoji.
 *
 * Por isso a maior parte do arquivo não testa o que ela converte. Testa o que
 * ela NÃO PODE tocar. E o bloco de sabotagem existe para provar que os testes
 * mordem: cada um deles falha se a garantia correspondente for removida.
 */

describe("CONVERTE — o que o WhatsApp não renderiza vira o que ele renderiza", () => {
  it("negrito markdown vira negrito do WhatsApp", () => {
    expect(paraWhatsApp("Tente **antes do banho**.")).toBe("Tente *antes do banho*.");
  });

  it("título vira negrito de um asterisco", () => {
    expect(paraWhatsApp("## O que fazer agora\n\nTire o prato.")).toBe(
      "*O que fazer agora*\n\nTire o prato.",
    );
  });

  it("título de qualquer nível", () => {
    expect(paraWhatsApp("# Um")).toBe("*Um*");
    expect(paraWhatsApp("###### Seis")).toBe("*Seis*");
  });

  it("citação perde a seta e mantém o que era citado", () => {
    expect(paraWhatsApp("> Ele não come nada verde.")).toBe("Ele não come nada verde.");
  });

  it("divisor some sem levar o conteúdo junto", () => {
    expect(paraWhatsApp("Antes.\n\n---\n\nDepois.")).toBe("Antes.\n\nDepois.");
  });

  it("bullet com asterisco vira • — o caso perigoso", () => {
    // Sem esta troca, os dois `*` de abertura casariam entre si e o WhatsApp
    // emboldaria "arroz\n" inteiro, atravessando os itens.
    expect(paraWhatsApp("* arroz\n* feijão")).toBe("• arroz\n• feijão");
  });

  it("negrito sublinhado e triplo também", () => {
    expect(paraWhatsApp("__assim__ e ***assim***")).toBe("*assim* e *assim*");
  });

  it("código inline perde a crase e mantém a palavra", () => {
    expect(paraWhatsApp("Use `agora`.")).toBe("Use agora.");
  });
});

describe("NÃO TOCA — as seis garantias que você pediu", () => {
  it("1. não remove conteúdo — toda palavra sobrevive", () => {
    const entrada =
      "## Rotina da tarde\n\nTire o prato **antes** do banho.\n\n---\n\n> Ela chora sempre.\n\n* arroz\n* feijão";
    const palavras = (t: string) => t.match(/\p{L}+/gu) ?? [];
    expect(palavras(paraWhatsApp(entrada))).toEqual(palavras(entrada));
  });

  it("2. não altera URLs — nem com _ nem com ~ nem com ponto final colado", () => {
    const t = "Veja https://kolo.com.br/a_b_c?x=1&y=2#topo e https://x.com/a~b.";
    expect(paraWhatsApp(t)).toBe(t);
  });

  it("2b. URL não é confundida com divisor nem com título", () => {
    const t = "https://kolo.com.br/#/rotina";
    expect(paraWhatsApp(t)).toBe(t);
  });

  it("3. não estraga emojis — inclusive os compostos por ZWJ e tom de pele", () => {
    const t = "Boa! 👩🏽‍🍳 Vamos tentar 👍🏼 hoje 🎉";
    expect(paraWhatsApp(t)).toBe(t);
    expect([...paraWhatsApp(t)]).toEqual([...t]);
  });

  it("4. não altera números — horas, valores, idades, decimais", () => {
    const t = "Às 18h30, por 15 minutos, R$ 54,90, ele tem 4 anos e 2,5 kg.";
    expect(paraWhatsApp(t)).toBe(t);
  });

  it("5. não altera frases — prosa sem marcação sai idêntica", () => {
    const t =
      "Entendo. Isso costuma acontecer quando a transição chega sem aviso, e não é falha sua.";
    expect(paraWhatsApp(t)).toBe(t);
  });

  it("6. não interfere em formatação que JÁ está correta no WhatsApp", () => {
    const t = "*negrito* e _itálico_ e ~tachado~ e - lista";
    expect(paraWhatsApp(t)).toBe(t);
  });

  it("6b. `_itálico_` é nativo do canal — sai intacto e NÃO é acusado de cru", () => {
    const t = "Ela ficou _bem_ mais tranquila.";
    expect(paraWhatsApp(t)).toBe(t);
    expect(sintaxeCruaWhatsApp(t)).toEqual([]);
  });

  it("6c. `- lista` não vira `•` — o canal já a renderiza", () => {
    expect(paraWhatsApp("- arroz\n- feijão")).toBe("- arroz\n- feijão");
  });

  it("hashtag não é título — falta o espaço obrigatório", () => {
    expect(paraWhatsApp("#TEAmãe segue firme")).toBe("#TEAmãe segue firme");
  });

  it("texto que já está limpo é ponto fixo — aplicar duas vezes não muda nada", () => {
    const t = paraWhatsApp("## Título\n\nTexto **forte** aqui.\n\n* um\n* dois");
    expect(paraWhatsApp(t)).toBe(t);
  });
});

describe("CONVIVE COM AS BOLHAS — a função roda antes de dividirEmBolhas", () => {
  it("o divisor removido não cria bolha vazia", () => {
    const bolhas = dividirEmBolhas(paraWhatsApp("Um.\n\n---\n\nDois."));
    expect(bolhas).toEqual(["Um.", "Dois."]);
  });

  it("o título convertido continua grudando no bloco que ele intitula", () => {
    // `ehSoTitulo` reconhece `*Assim*`. Se a conversão produzisse `**Assim**`
    // com dois asteriscos, ela ainda casaria — mas o canal mostraria os dois.
    const bolhas = dividirEmBolhas(paraWhatsApp("## Agora\n\nTire o prato.\n\nDepois observe."));
    expect(bolhas).toEqual(["*Agora*\nTire o prato.", "Depois observe."]);
  });
});

describe("DETECTOR — acusa o que fica cru NAQUELE canal, não Markdown em geral", () => {
  it("WhatsApp acusa **, ##, >, ---, __, ` e tabela", () => {
    const s = (t: string) => sintaxeCruaWhatsApp(t).map((x) => x.sintaxe);
    expect(s("**x**")[0]).toContain("**");
    expect(s("## x")[0]).toContain("##");
    expect(s("> x")[0]).toContain(">");
    expect(s("---")[0]).toContain("---");
    expect(s("__x__")[0]).toContain("__");
    expect(s("`x`")[0]).toContain("`");
    expect(s("| a | b |")[0]).toContain("|");
  });

  it("WhatsApp NÃO acusa o que o canal renderiza nativamente", () => {
    expect(sintaxeCruaWhatsApp("*negrito* _itálico_ ~tachado~ - lista 1. um")).toEqual([]);
  });

  it("depois de paraWhatsApp, o detector fica vazio — é a prova do ciclo", () => {
    const sujo = "## Título\n\nTente **isso** e `aquilo`.\n\n---\n\n> citado\n\n* um";
    expect(sintaxeCruaWhatsApp(sujo).length).toBeGreaterThan(0);
    expect(sintaxeCruaWhatsApp(paraWhatsApp(sujo))).toEqual([]);
  });

  it("Web acusa só o que RespostaMarkdown não cobre", () => {
    const s = (t: string) => sintaxeCruaWeb(t).map((x) => x.sintaxe);
    expect(s("_itálico_")[0]).toContain("_");
    expect(s("~~tachado~~")[0]).toContain("~~");
    expect(s("| a | b |")[0]).toContain("|");
    expect(s("- [ ] tarefa")[0]).toContain("[ ]");
    expect(s("**quebra\nde linha**")[0]).toContain("quebra de linha");
  });

  it("Web NÃO acusa o que o renderizador cobre", () => {
    expect(sintaxeCruaWeb("## Título\n\n**forte** e *leve* e `cod`\n\n> cita\n\n- um\n\n1. dois")).toEqual([]);
  });

  it("Web não confunde underline de URL com itálico", () => {
    expect(sintaxeCruaWeb("https://kolo.com.br/a_b_c")).toEqual([]);
  });

  it("o detector nunca altera o texto que examina", () => {
    const t = "## x **y** _z_";
    const copia = t;
    sintaxeCruaWhatsApp(t);
    sintaxeCruaWeb(t);
    expect(t).toBe(copia);
  });
});

/**
 * SABOTAGEM — cada caso remove UMA garantia e prova que algum teste acima
 * quebraria. Sem isto, os testes acima poderiam estar passando por sorte.
 */
describe("SABOTAGEM — os testes mordem?", () => {
  it("S1 · sem exigir espaço depois do #, hashtag da mãe viraria título", () => {
    const ingenuo = (t: string) => t.replace(/^\s*#{1,6}\s*(.+)$/gm, "*$1*");
    expect(ingenuo("#TEAmãe segue firme")).toBe("*TEAmãe segue firme*");
    expect(paraWhatsApp("#TEAmãe segue firme")).toBe("#TEAmãe segue firme");
  });

  it("S2 · sem prender o negrito a uma linha, um ** órfão come parágrafos inteiros", () => {
    // O caso que importa é o número ÍMPAR de `**` — o modelo abre e esquece de
    // fechar. Com a regex multilinha, o `**` órfão do 1º parágrafo casa com o
    // do 3º e transforma tudo entre eles numa ênfase só.
    const ingenuo = (t: string) => t.replace(/\*\*([\s\S]+?)\*\*/g, "*$1*");
    const t = "Faça **isso hoje.\n\nEla vai reclamar.\n\nE amanhã **aquilo**.";

    expect(ingenuo(t)).toBe("Faça *isso hoje.\n\nEla vai reclamar.\n\nE amanhã *aquilo**.");
    // Presa à linha, a função converte só o negrito bem formado e deixa o
    // órfão cru — que é o estado de hoje, não uma regressão nova.
    expect(paraWhatsApp(t)).toBe("Faça **isso hoje.\n\nEla vai reclamar.\n\nE amanhã *aquilo*.");
  });

  it("S3 · sem tratar o bullet `*`, a lista vira uma ênfase atravessada", () => {
    const semBullet = (t: string) => t.replace(/\*\*(?!\s)([^*\n]+?)(?<!\s)\*\*/g, "*$1*");
    expect(semBullet("* arroz\n* feijão")).toBe("* arroz\n* feijão"); // fica cru
    expect(paraWhatsApp("* arroz\n* feijão")).toBe("• arroz\n• feijão");
  });

  it("S4 · sem as bordas (?!\\s), `** x **` produziria asterisco solto", () => {
    const semBorda = (t: string) => t.replace(/\*\*([^*\n]+?)\*\*/g, "*$1*");
    expect(semBorda("Isto ** não é negrito ** ok")).toBe("Isto * não é negrito * ok");
    expect(paraWhatsApp("Isto ** não é negrito ** ok")).toBe("Isto ** não é negrito ** ok");
  });

  it("S5 · se o detector do WhatsApp acusasse `_x_`, acusaria formatação válida", () => {
    // A ressalva que a Karina fez: o critério é "fica cru NESTE canal".
    const ingenuo = (t: string) => /_/.test(t);
    expect(ingenuo("Ela ficou _bem_ melhor")).toBe(true);
    expect(sintaxeCruaWhatsApp("Ela ficou _bem_ melhor")).toEqual([]);
  });

  it("S6 · o colapso de linhas brancas é defensivo, e é isso que ele garante", () => {
    // CORREÇÃO DE UMA AFIRMAÇÃO MINHA: eu havia escrito que sem o colapso o
    // divisor removido viraria uma bolha a mais. É FALSO — `dividirEmBolhas`
    // corta em `\n{2,}` e descarta pedaços vazios, então ele já tolera três
    // linhas brancas. Medido: 2 bolhas com e sem colapso.
    const semColapso = (t: string) =>
      t.split("\n").filter((l) => !/^\s*-{3,}\s*$/.test(l)).join("\n").trim();
    expect(dividirEmBolhas(semColapso("Um.\n\n---\n\nDois.")).length).toBe(2);
    expect(dividirEmBolhas(paraWhatsApp("Um.\n\n---\n\nDois.")).length).toBe(2);

    // O que o colapso garante DE VERDADE: o texto que sai nunca tem buraco de
    // três linhas. Importa para a prévia da Web e para o texto salvo, não para
    // a contagem de bolhas.
    expect(semColapso("Um.\n\n---\n\nDois.")).toMatch(/\n{3,}/);
    expect(paraWhatsApp("Um.\n\n---\n\nDois.")).not.toMatch(/\n{3,}/);
  });
});
