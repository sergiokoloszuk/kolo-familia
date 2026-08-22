import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { blocoBoasPraticas, type BoaPraticaRecuperada } from "./recuperar";

/**
 * O REPERTÓRIO QUE ESTAVA NO BANCO E NÃO CHEGAVA.
 *
 * ⚠️ MEDIDO EM PRODUÇÃO, 22/08/2026, sobre as 370 boas práticas ativas:
 *
 *   atividades_praticas ... 367 preenchidas — ZERO chegavam (fora do select)
 *   crencas_adulto ........ 367 preenchidas — ZERO chegavam (fora do select)
 *   erros_comuns .......... 367 preenchidas — ZERO chegavam (tipo incompatível)
 *
 * O terceiro é o mais traiçoeiro e o motivo de metade destes testes existir: a
 * coluna ERA selecionada desde 06/08, mas no banco ela é TEXTO e o código a
 * passava por um `lista()` que devolvia `[]` para tudo que não fosse array. O
 * bloco só emite `EVITE:` quando o array tem itens — então nunca emitia.
 *
 * É o padrão que o protocolo chama de "o dedup que não deduplicava": o
 * conserto parecia feito, o nome dizia que estava feito, e o efeito era zero.
 */

const RAIZ = join(process.cwd(), "src");
const FONTE = readFileSync(join(RAIZ, "lib/conhecimento/recuperar.ts"), "utf8");

const bp = (over: Partial<BoaPraticaRecuperada> = {}): BoaPraticaRecuperada => ({
  id: "bp-1",
  titulo: "Aviso prévio de 5 minutos",
  versao_conversa: "Avise 5 minutos antes, com palavras concretas.",
  quando_usar: "Antes de transições difíceis",
  erros_comuns: [],
  passos_praticos: [],
  atividades_praticas: [],
  crenca_adulto: null,
  ...over,
});

describe("as atividades chegam ao modelo", () => {
  it("emite a linha ATIVIDADES quando a BP tem brincadeiras", () => {
    const bloco = blocoBoasPraticas([
      bp({ atividades_praticas: ["Ampulheta na estante", "Música de 5 minutos"] }),
    ]);
    expect(bloco).toContain("ATIVIDADES:");
    expect(bloco).toContain("Ampulheta na estante");
    expect(bloco).toContain("Música de 5 minutos");
  });

  it("não inventa a linha quando não há atividade", () => {
    expect(blocoBoasPraticas([bp()])).not.toContain("ATIVIDADES:");
  });

  it("as atividades vêm DEPOIS dos passos — oferta não precede raciocínio", () => {
    const bloco = blocoBoasPraticas([
      bp({ passos_praticos: ["Avise"], atividades_praticas: ["Ampulheta"] }),
    ]);
    expect(bloco.indexOf("DÁ PRA FAZER:")).toBeLessThan(bloco.indexOf("ATIVIDADES:"));
  });
});

describe("a crença do adulto chega — e vem rotulada para NÃO ser dita", () => {
  it("emite a linha quando existe", () => {
    const bloco = blocoBoasPraticas([
      bp({ crenca_adulto: '"Birra é manipulação." É sobrecarga.' }),
    ]);
    expect(bloco).toContain("CRENÇA A DESFAZER:");
    expect(bloco).toContain("Birra é manipulação");
  });

  it("a instrução proíbe explicitamente acusar a família de pensar assim", () => {
    const bloco = blocoBoasPraticas([bp({ crenca_adulto: "x" })]);
    expect(bloco).toMatch(/NÃO diga isso a ela/);
    expect(bloco).toMatch(/não a acuse de pensar assim/);
  });

  /**
   * ⚠️ Contar, e não `not.toContain`: o rótulo aparece SEMPRE no cabeçalho de
   * instruções ("CRENÇA A DESFAZER é o que o adulto provavelmente pensa…").
   * A primeira versão deste teste falhou por isso — media o bloco inteiro
   * quando o que importa é a entrada da BP.
   */
  const vezes = (t: string, alvo: string) => t.split(alvo).length - 1;

  it("null não vira linha vazia — só o cabeçalho menciona o rótulo", () => {
    // O cabeçalho cita o rótulo entre aspas e SEM dois-pontos; a entrada da BP
    // é a única que emite `CRENÇA A DESFAZER:`. É essa que se conta.
    const semCrenca = blocoBoasPraticas([bp({ crenca_adulto: null })]);
    expect(vezes(semCrenca, "CRENÇA A DESFAZER:")).toBe(0);
    expect(semCrenca).toContain('"CRENÇA A DESFAZER"'); // a instrução continua lá
    const comCrenca = blocoBoasPraticas([bp({ crenca_adulto: "x" })]);
    expect(vezes(comCrenca, "CRENÇA A DESFAZER:")).toBe(1);
  });
});

describe("o defeito do tipo — erros_comuns era texto e virava nada", () => {
  /**
   * `lista` não é exportada. O que importa é o efeito no bloco, e é isso que
   * se mede aqui: uma BP cujo `erros_comuns` chegou como texto separado por
   * ponto-e-vírgula tem que produzir a linha EVITE com os itens separados.
   */
  it("o formato real do acervo (texto com ';') produz EVITE com os itens", () => {
    const bloco = blocoBoasPraticas([
      bp({ erros_comuns: ["Prescrição sem investigação", "moralização"] }),
    ]);
    expect(bloco).toContain("EVITE:");
    expect(bloco).toContain("Prescrição sem investigação");
    expect(bloco).toContain("moralização");
  });

  it("a função de lista aceita string, não só array", () => {
    // Guarda estrutural: se alguém voltar a exigir array, 367 BPs voltam a
    // perder o `erros_comuns` sem nenhum erro aparecer em lugar nenhum.
    const corpo = FONTE.slice(FONTE.indexOf("const lista ="), FONTE.indexOf("const lista =") + 400);
    expect(corpo).toContain('typeof v === "string"');
    expect(corpo).toMatch(/split\(/);
  });
});

describe("guardas de estrutura — o que já custou caro uma vez", () => {
  it("o select traz as duas colunas que faltavam", () => {
    const sel = FONTE.match(/"id, titulo[^"]+"/)?.[0] ?? "";
    expect(sel).toContain("atividades_praticas");
    expect(sel).toContain("crencas_adulto");
    // e não perdeu as que já estavam
    expect(sel).toContain("erros_comuns");
    expect(sel).toContain("passos_praticos");
    expect(sel).toContain("quando_usar");
  });

  it("o tipo devolvido carrega os dois campos", () => {
    const tipo = FONTE.slice(
      FONTE.indexOf("export type BoaPraticaRecuperada"),
      FONTE.indexOf("type Linha"),
    );
    expect(tipo).toContain("atividades_praticas");
    expect(tipo).toContain("crenca_adulto");
  });

  it("o bloco continua proibindo virar seção da resposta", () => {
    const bloco = blocoBoasPraticas([bp({ atividades_praticas: ["x"], crenca_adulto: "y" })]);
    expect(bloco).toMatch(/NUNCA escreva/);
    expect(bloco).toContain("atividades");
    expect(bloco).toContain("crença");
  });

  it("bloco vazio continua vazio — nada de cabeçalho sem conteúdo", () => {
    expect(blocoBoasPraticas([])).toBe("");
  });
});
