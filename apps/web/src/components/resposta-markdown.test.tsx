import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RespostaConversa, RespostaMarkdown } from "./resposta-markdown";

const render = (texto: string) => renderToStaticMarkup(createElement(RespostaMarkdown, { texto }));
const numeros = (html: string) => [...html.matchAll(/aria-hidden="true"[^>]*>(\d+)\./g)].map((m) => Number(m[1]));

describe("listas numeradas da resposta", () => {
  it("continua a sequência quando os passos têm linhas em branco", () => {
    const html = render("1. Separe as peças.\n\n2. Mostre uma etapa.\n\n3. Manu continua.");
    expect(numeros(html)).toEqual([1, 2, 3]);
    expect(html.match(/<ol\b/g)).toHaveLength(1);
  });

  it("preserva o início de uma lista retomada", () => {
    expect(numeros(render("4. Retome daqui.\n\n5. Encerrem juntas."))).toEqual([4, 5]);
  });

  it("mantém listas independentes após subtítulo, parágrafo ou reinício explícito", () => {
    for (const separador of ["### Outra atividade", "Agora outra proposta.", ""]) {
      const html = render(`1. Primeira parte.\n2. Segunda parte.\n\n${separador}\n\n1. Novo começo.\n2. Outra parte.`);
      expect(numeros(html)).toEqual([1, 2, 1, 2]);
      expect(html.match(/<ol\b/g)).toHaveLength(2);
    }
  });

  it("aceita a convenção Markdown de repetir 1 em todos os itens", () => {
    expect(numeros(render("1. Comece.\n\n1. Continue.\n\n1. Termine."))).toEqual([1, 2, 3]);
  });
});

describe("Markdown preservado sem HTML ativo", () => {
  it("usa capitalização natural somente na conversa", () => {
    const texto = "### Um apoio para Manu";
    const conversa = renderToStaticMarkup(createElement(RespostaConversa, { texto }));
    expect(conversa).toContain("normal-case");
    expect(conversa).not.toContain("uppercase");
    expect(conversa).toContain("max-w-[70ch]");
    expect(render(texto)).toContain("uppercase");
  });

  it("reconstitui a resposta completa após cada prefixo transmitido, sem mudar o conteúdo", () => {
    const texto = "### Uma pista\n\n1. **Mostre.**\n\n2. Espere.\n\n> “Você continua.”";
    const apresentar = (texto: string) => renderToStaticMarkup(createElement(RespostaConversa, { texto }));
    const completa = apresentar(texto);
    for (let i = 1; i < texto.length; i++) expect(() => apresentar(texto.slice(0, i))).not.toThrow();
    expect(apresentar(texto)).toBe(completa);
    expect(numeros(completa)).toEqual([1, 2]);
    expect(completa).toContain("<blockquote");
  });

  it("mantém negritos, bullets, fala pronta e parágrafos", () => {
    const html = render('### Um apoio para Manu\n\nUma **pista** por vez.\n\n- Observe.\n- Espere.\n\n> “Eu mostro e você continua.”');
    expect(html).toContain("<strong");
    expect(html).toContain("<ul");
    expect(html).toContain("<blockquote");
    expect(html).toContain("Eu mostro e você continua.");
  });

  it("não executa HTML nem transforma sugestões em botões", () => {
    const html = render('<script>alert(1)</script>\n\n<img src=x onerror=alert(2)>\n\n[Quero tentar]');
    expect(html).not.toMatch(/<(script|img|button)\b/);
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("[Quero tentar]");
  });

  it("não corta textos extensos ou Markdown parcial do streaming", () => {
    const longo = "Uma pista para continuar. ".repeat(800) + "ÚLTIMA FRASE.";
    expect(render(longo)).toContain("ÚLTIMA FRASE.");
    expect(render("Manu pode **continuar")).toContain("Manu pode **continuar");
  });
});
