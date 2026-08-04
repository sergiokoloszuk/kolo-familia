import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * O ERRO DE IMAGEM QUE A FAMÍLIA LÊ — 04/08/2026.
 *
 * A mãe clicou em "Vestir avatar" com "Fantasia de super-herói" e viu isto na
 * tela do app:
 *
 *   OpenAI imagem(ref) 400: {"error":{"message":"Your request was rejected by
 *   the safety system…","code":"moderation_blocked","moderation_details":
 *   {"moderation_stage":"output","categories":["other"]}}}
 *
 * Duas coisas erradas. A moderação barrou o RESULTADO — o modelo resolveu
 * "super-herói" desenhando um personagem conhecido. E o JSON cru, em inglês,
 * foi parar na frente de quem não fez nada errado.
 */

const GEN = readFileSync(resolve(__dirname, "generate.ts"), "utf8");
const ACTIONS = readFileSync(
  resolve(__dirname, "../../app/(app)/configuracoes/avatar/[id]/actions.ts"),
  "utf8",
);
const SECAO = readFileSync(
  resolve(__dirname, "../../app/(app)/configuracoes/avatar/secao-membro.tsx"),
  "utf8",
);

describe("o erro cru não chega na tela", () => {
  it("os dois caminhos de geração passam pelo tradutor", () => {
    expect(GEN.match(/throw erroDeImagem\(/g)?.length).toBe(2);
    expect(GEN).not.toMatch(/throw new Error\(`OpenAI imagem/);
  });

  it("moderação vira explicação, e diz que não foi culpa dela", () => {
    expect(GEN).toMatch(/moderation_blocked\|safety system/);
    expect(GEN).toMatch(/não é nada que você tenha feito de errado/);
    expect(GEN).toMatch(/Tente descrever de outro jeito/);
  });

  it("congestionamento e falha genérica também têm fala própria", () => {
    expect(GEN).toMatch(/status === 429 \|\| status >= 500/);
    expect(GEN).toMatch(/está congestionado agora/);
  });

  it("o detalhe técnico continua no log — ninguém perde rastro", () => {
    expect(GEN).toMatch(/console\.warn\(`\[imagem\] \$\{onde\} \$\{status\}/);
  });
});

describe("a fantasia que a moderação barrava", () => {
  it("o prompt pede roupa genérica e original", () => {
    expect(ACTIONS).toMatch(/A roupa deve ser GENÉRICA e ORIGINAL/);
    expect(ACTIONS).toMatch(/nada de personagens de filmes, desenhos, quadrinhos ou jogos/);
  });

  it("o chip que convocava personagem licenciado saiu", () => {
    expect(SECAO).not.toContain("Fantasia de super-herói");
    expect(SECAO).toContain("Capa de herói");
  });
});
