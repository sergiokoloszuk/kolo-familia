import { describe, it, expect } from "vitest";
import { buildSystemTextConversa } from "./prompt";
import type { SkillRow } from "./router";

/**
 * UMA REGRA DE FORMATAÇÃO POR CANAL — provada no SYSTEM FINAL.
 *
 * ⚠️ POR QUE ESTES TESTES EXISTEM (09/08/2026). A auditoria mediu 12 respostas
 * de produção, contou zero `##` e concluiu "as respostas saem em blocos
 * uniformes de prosa". Era falso: havia 2 a 4 títulos em cada uma, em negrito.
 * O que existia de verdade era um CONFLITO — `formas.ts` mandava "título curto
 * em negrito" e a seção de Formatação de `prompt.ts` mandava `## título`, no
 * mesmo system, e o modelo obedecia o primeiro (0 `##` em 10 rodadas, GPT e
 * Claude).
 *
 * Daí a forma destes testes: eles montam o system COMPLETO e provam que não
 * existem duas instruções concorrentes sobre o mesmo elemento. Testar as
 * constantes isoladas era exatamente o que deixava o conflito passar — cada uma
 * estava certa sozinha.
 *
 * E eles NÃO exigem que o modelo emita `##`. Isso é comportamento, varia por
 * rodada, e um teste que o exigisse estaria medindo o modelo, não o produto. O
 * que se prova aqui é a AUTORIZAÇÃO: quando houver bloco real, existe uma
 * sintaxe só para representá-lo.
 */

const SKILL = {
  id: "s1",
  name: "alimentacao",
  display_name: "Alimentação e seletividade",
  identity_prompt: "Você entende de seletividade alimentar.",
  ativo: true,
} as unknown as SkillRow;

const sys = (intencao?: "desafio" | "duvida" | "desabafo" | "crise") =>
  buildSystemTextConversa([SKILL], intencao, "nutricional");

describe("CASO B · desafio — `##` é o título, e é o ÚNICO", () => {
  const s = sys("desafio");

  it("1. autoriza `## ` como título de bloco", () => {
    expect(s).toContain("`## título`");
    expect(s).toContain("## Assim");
  });

  it("2. NÃO existe instrução concorrente mandando título em negrito", () => {
    // A frase exata que competia, e a sintaxe que ela prescrevia.
    expect(s).not.toContain("título curto em negrito");
    expect(s).not.toContain("**Assim**");
  });

  it("3. negrito é declarado âncora, e explicitamente NÃO título", () => {
    expect(s).toMatch(/Negrito é âncora DENTRO do texto, nunca título de seção/);
  });

  it("4. o repertório de formas continua vivo — a correção é de sintaxe, não de conteúdo", () => {
    expect(s).toContain("O que eu faria primeiro");
    expect(s).toContain("O que você pode dizer");
    expect(s).toMatch(/nunca use todos/);
  });
});

describe("CASO C e D · lista e frase pronta", () => {
  const s = sys("desafio");

  it("5. lista autorizada quando forem passos ou opções paralelas", () => {
    expect(s).toMatch(/Lista quando forem passos ou opções paralelas/);
    expect(s).toContain("listas com `- `");
  });

  it("6. frase pronta em blockquote — e SEM a sintaxe concorrente de itálico", () => {
    expect(s).toContain("citação com `> `");
    expect(s).toMatch(/A frase pronta pro adulto usar merece destaque/);
    // O `# Como responder` mandava a frase pronta em itálico enquanto a
    // Formatação mandava em `> `. Na entrega, quem manda é a Formatação.
    expect(s).not.toContain("em itálico");
  });
});

describe("CASO A e E · o que NÃO muda", () => {
  it("7. desafio não obriga estrutura — um tipo de ajuda só volta a ser prosa", () => {
    const s = sys("desafio");
    expect(s).toMatch(/escreva em texto corrido e não use título nenhum/);
    expect(s).toMatch(/A estrutura nasce do raciocínio, não de um gabarito/);
  });

  it("8. crise segue curta, direta e sem estrutura", () => {
    const s = sys("crise");
    expect(s).toMatch(/Aqui a resposta é TEXTO CORRIDO/);
    expect(s).toMatch(/NÃO despeje um plano nem uma lista de soluções agora/);
    expect(s).not.toContain("`## título`");
    expect(s).not.toContain("## Assim");
  });

  it("9. dúvida e desabafo NÃO mudaram — inclusive a frase pronta em itálico", () => {
    for (const i of ["duvida", "desabafo"] as const) {
      const s = sys(i);
      expect(s, i).toMatch(/Aqui a resposta é TEXTO CORRIDO/);
      expect(s, i).toContain("em itálico");
      expect(s, i).not.toContain("## Assim");
      // `formasDeEntrega` não é injetado fora da entrega — título em cima de
      // desabafo é frieza, e essa decisão é anterior a esta correção.
      expect(s, i).not.toContain("Como ORGANIZAR esta resposta");
    }
  });
});

describe("SABOTAGEM · o conflito não pode voltar por outro caminho", () => {
  it("10. em NENHUMA intenção o system pede título em negrito e `##` ao mesmo tempo", () => {
    for (const i of ["desafio", "duvida", "desabafo", "crise", undefined] as const) {
      const s = sys(i);
      const pedeNegritoComoTitulo =
        /título curto em negrito|\*\*Assim\*\*|negrito como título/.test(s);
      const pedeHeading = s.includes("`## título`") || s.includes("## Assim");
      expect(pedeNegritoComoTitulo && pedeHeading, String(i)).toBe(false);
    }
  });
});
