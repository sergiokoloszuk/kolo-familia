import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { membroCampoStorage, MEMBRO_CAMPOS_EXTRAS } from "@/lib/kolo-vivo/campos";
import { TEMAS } from "@/lib/conducao/temas";

/**
 * PEND-053 · ONDE O APRENDIZADO LONGITUDINAL QUEBRA — provado elo a elo.
 *
 * A pergunta de produto: a mãe descobre com a Ayla que "quando eu mostro
 * primeiro e falo depois, ele entende muito melhor". Isso chega ao próximo
 * turno, ou morre naquela conversa?
 *
 * São CINCO elos, e a suíte precisa dizer qual quebra — "não funciona" não é
 * diagnóstico:
 *
 *   1. RECONHECER  — o parser vê que ali há um fato arquivável
 *   2. ENDEREÇAR   — o parser escolhe em QUE campo do perfil aquilo mora
 *   3. GRAVAR      — a auto-incorporação escreve no perfil
 *   4. RECUPERAR   — o campo volta no resumo do próximo turno
 *   5. REUSAR      — o modelo usa
 *
 * ⚠️ O ACHADO: quebra no elo 2, e só nele. O campo EXISTE (`aprendizado`), a
 * gravação funcionaria, e a recuperação já foi provada. O que falta é o parser
 * SABER que o campo existe: a lista de domínios válidos dele é manual e tem
 * NOVE entradas, de vinte.
 *
 * É a mesma classe de defeito que já foi corrigida do outro lado: o leitor
 * (`carregarKoloVivoResumo`) tinha "9 das 15 chaves" e foi trocado por TEMAS
 * como fonte única. O ESCRITOR continuou com a lista manual.
 *
 * Este arquivo NÃO corrige — a missão pediu investigação. Ele congela o
 * diagnóstico para que a correção, quando vier, tenha contra o que ser medida,
 * e para que o teste vire verde sozinho no dia em que a lista for completada.
 */

const PARSER = readFileSync(path.join(__dirname, "parser.ts"), "utf8");

/** Os domínios que o parser do WhatsApp aceita hoje, lidos do próprio prompt. */
function dominiosDoParser(): string[] {
  const bloco = /# Domínios do Perfil[\s\S]*?(?=\n# )/.exec(PARSER)?.[0] ?? "";
  expect(bloco, "não achei o bloco de domínios no parser — o teste cegou").not.toBe("");
  return [...bloco.matchAll(/^- ([a-z_]+) —/gm)].map((m) => m[1]);
}

describe("PEND-053 · elo 2 (endereçar) é onde quebra", () => {
  it("o campo de destino EXISTE no perfil — o problema não é falta de lugar", () => {
    expect(MEMBRO_CAMPOS_EXTRAS).toContain("aprendizado");
    // `membroCampoStorage` é quem decide se a auto-incorporação sabe gravar.
    // Não-nulo aqui significa: se o parser dissesse "aprendizado", gravaria.
    expect(membroCampoStorage("aprendizado")).not.toBeNull();
  });

  it("o campo VOLTA ao prompt no turno seguinte — o elo 4 está inteiro", () => {
    // `carregarKoloVivoResumo` varre TEMAS com storage "extras". Se
    // `aprendizado` está lá, o que for gravado volta sozinho.
    const t = TEMAS.find((x) => x.chave === "aprendizado");
    expect(t, "aprendizado não é tema — não voltaria no resumo").toBeTruthy();
    expect(t?.storage).toBe("extras");
  });

  /**
   * ⚠️ ESTE É O TESTE QUE DOCUMENTA A QUEBRA, e ele passa HOJE por afirmar a
   * ausência. No dia em que alguém completar a lista do parser, ele falha — e
   * é assim que se descobre que a PEND-053 pode ser baixada.
   */
  it("QUEBRA AQUI: o parser não pode escolher `aprendizado` — ele não está na lista", () => {
    const dominios = dominiosDoParser();
    expect(dominios.length, "a lista do parser sumiu — o teste cegou").toBeGreaterThan(5);
    expect(
      dominios,
      "o parser JÁ pode endereçar `aprendizado` — a PEND-053 pode ser reavaliada e este teste, removido",
    ).not.toContain("aprendizado");
  });

  it("e não é só `aprendizado`: o escritor conhece menos da metade dos domínios", () => {
    const dominios = dominiosDoParser();
    const ausentes = MEMBRO_CAMPOS_EXTRAS.filter((c) => !dominios.includes(c));
    // Medido em 12/08/2026: o parser aceita 9 domínios; `categorias_extras`
    // tem 15, e o perfil inteiro tem 20 campos. Tudo o que a mãe contar sobre
    // autonomia, imitação, escola, telas, saúde ou gostos não tem endereço —
    // cai em "essencial" (que polui a identidade da criança) ou em campo
    // desconhecido, que vira linha `pendente` em `sugestao_perfil_vivos` e
    // espera revisão manual que ninguém faz.
    expect(ausentes.length, `ausentes: ${ausentes.join(",")}`).toBeGreaterThan(0);
    expect(ausentes).toContain("aprendizado");
    expect(ausentes).toContain("autonomia");
  });

  it("campo fora da lista NÃO chega ao perfil — vai para a fila pendente", () => {
    // O caminho real: `membroCampoStorage(campo)` null → insert em
    // `sugestao_perfil_vivos` com status "pendente". Nunca toca
    // `perfil_vivo_membro`, então nunca volta ao prompt.
    expect(membroCampoStorage("forma_de_interacao")).toBeNull();
    expect(PARSER.includes("campo_kolo_vivo_sugerido")).toBe(true);
  });
});
