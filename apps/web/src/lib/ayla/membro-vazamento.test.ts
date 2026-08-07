import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * VAZAMENTO DE INFORMAÇÃO ENTRE IRMÃOS — o bug mais grave da conversa real de
 * 07/08/2026.
 *
 * A mãe contou que o MARIO presta mais atenção com algo nas mãos. Depois
 * escreveu "A Manu começa a lição mas 5 min depois já quer fazer outra coisa".
 * A Ayla respondeu sobre a Manu dizendo:
 *
 *   "Como ela já mostrou que se concentra melhor quando as mãos estão ocupadas…"
 *
 * Quem tinha mostrado isso era o irmão.
 *
 * A CAUSA NÃO ERA O MODELO — eram duas omissões de dado, ambas verificáveis:
 *
 *   1. `carregarHistorico` selecionava `direcao, texto` e mais nada. O
 *      histórico chegava ao prompt como um fluxo único, sem dono, com
 *      `nomeMembro` = Manu. Tudo que a mãe tinha dito virava informação sobre a
 *      criança da vez.
 *   2. O inbound nem gravava `membro_atipico_id` — a coluna existia em
 *      `ayla_messages` desde a 0001 e ficava nula em toda mensagem da mãe.
 *
 * Estes testes travam as duas pontas. Se alguém "simplificar" o SELECT ou
 * remover a atribuição, o vazamento volta em silêncio — e em silêncio é como
 * ele chegou numa família real.
 */

const ORCH = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");
const RESP = readFileSync(resolve(__dirname, "responder.ts"), "utf8");

describe("o histórico sabe de quem é cada fala", () => {
  it("o SELECT traz membro_atipico_id", () => {
    expect(ORCH).toMatch(/\.select\("direcao, texto, created_at, membro_atipico_id"\)/);
  });

  it("o turno de OUTRA criança é marcado, e o do membro em foco não", () => {
    // Marcar o membro da vez em toda linha viraria ruído e ensinaria o modelo
    // a repetir o nome. Só o que é de outro filho leva etiqueta.
    expect(ORCH).toMatch(/id && membroFocoId && id !== membroFocoId/);
  });

  it("o inbound recebe o membro assim que ele é resolvido", () => {
    // Ele é gravado antes (a trava de idempotência vem primeiro), então a
    // atribuição é um UPDATE logo depois da resolução.
    expect(ORCH).toMatch(/\.update\(\{ membro_atipico_id: membroContextoId \}\)/);
    expect(ORCH).toMatch(/\.eq\("zaap_message_id", inbound\.messageId\)/);
  });

  it("o caminho principal passa foco e nomes para o histórico", () => {
    expect(ORCH).toMatch(
      /carregarHistorico\(supabase, family\.id, inbound\.texto, membroContextoId, nomePorMembro\)/,
    );
  });
});

describe("o prompt separa os irmãos", () => {
  it("a fala de outra criança sai etiquetada com o nome dela", () => {
    expect(RESP).toMatch(/\(sobre \$\{h\.sobre\}\)/);
  });

  it("a regra só aparece quando há OUTRO membro na conversa", () => {
    // Sem irmão na janela, nenhuma linha extra entra no prompt — a regra não
    // pode virar peso fixo em toda conversa de filho único.
    expect(RESP).toMatch(/const temOutroMembro = params\.historico\.some\(\(h\) => h\.sobre\)/);
    expect(RESP).toMatch(/temOutroMembro\s*\?/);
  });

  it("a regra proíbe transferir característica entre irmãos, com todas as letras", () => {
    expect(RESP).toMatch(/não transfira característica, preferência nem estratégia de um irmão para o outro/);
    expect(RESP).toMatch(/NÃO é fato sobre/);
  });
});

// ============================================================
// A MONTAGEM, exercitada de verdade
// ============================================================

/** Reproduz a marcação de `carregarHistorico` sem ir ao banco. */
function marcar(
  linhas: Array<{ de: "mae" | "ayla"; texto: string; membro: string | null }>,
  foco: string | null,
  nomes: Map<string, string>,
) {
  return linhas.map((l) => {
    const sobre = l.membro && foco && l.membro !== foco ? nomes.get(l.membro) : undefined;
    return { de: l.de, texto: l.texto, ...(sobre ? { sobre } : {}) };
  });
}

const NOMES = new Map([
  ["m1", "Mario"],
  ["m2", "Manu"],
]);

describe("os 8 casos de troca de membro", () => {
  const falaMario = { de: "mae" as const, texto: "Ele presta mais atenção com algo nas mãos.", membro: "m1" };
  const falaManu = { de: "mae" as const, texto: "Ela começa a lição e levanta em 5 min.", membro: "m2" };

  it("A. Mario → informação → Manu → nova pergunta", () => {
    const h = marcar([falaMario, falaManu], "m2", NOMES);
    expect(h[0].sobre).toBe("Mario"); // a informação do irmão fica etiquetada
    expect(h[1].sobre).toBeUndefined(); // a da Manu, não
  });

  it("B. Manu → informação → Mario → nova pergunta", () => {
    const h = marcar([falaManu, falaMario], "m1", NOMES);
    expect(h[0].sobre).toBe("Manu");
    expect(h[1].sobre).toBeUndefined();
  });

  it("C/D. 'agora Manu' e 'Mario agora' — quem manda é o membro resolvido", () => {
    // A frase que troca o membro é resolvida antes, por `membroPorNome`. Aqui
    // o que importa é que a etiqueta acompanha o foco, seja qual for.
    expect(marcar([falaMario], "m2", NOMES)[0].sobre).toBe("Mario");
    expect(marcar([falaManu], "m1", NOMES)[0].sobre).toBe("Manu");
  });

  it("E. troca de membro e resposta curta 'sim' — o histórico continua etiquetado", () => {
    const h = marcar(
      [falaMario, { de: "ayla", texto: "Quer que eu organize isso?", membro: "m1" }, { de: "mae", texto: "sim", membro: "m2" }],
      "m2",
      NOMES,
    );
    expect(h[0].sobre).toBe("Mario");
    expect(h[1].sobre).toBe("Mario");
    expect(h[2].sobre).toBeUndefined();
  });

  it("F. dois irmãos na mesma janela — cada linha guarda o seu dono", () => {
    const h = marcar([falaMario, falaManu, falaMario], "m2", NOMES);
    expect(h.map((x) => x.sobre)).toEqual(["Mario", undefined, "Mario"]);
  });

  it("G. mensagem sem membro resolvido não inventa dono", () => {
    // Foco nulo (família com vários filhos e mensagem ambígua): nada é
    // etiquetado, e nada é atribuído a ninguém.
    const h = marcar([falaMario, falaManu], null, NOMES);
    expect(h.every((x) => x.sobre === undefined)).toBe(true);
  });

  it("H. voltar ao membro anterior inverte as etiquetas", () => {
    const linhas = [falaMario, falaManu];
    expect(marcar(linhas, "m1", NOMES).map((x) => x.sobre)).toEqual([undefined, "Manu"]);
    expect(marcar(linhas, "m2", NOMES).map((x) => x.sobre)).toEqual(["Mario", undefined]);
  });

  it("membro desconhecido no mapa não gera etiqueta quebrada", () => {
    const h = marcar([{ de: "mae", texto: "x", membro: "m9" }], "m2", NOMES);
    expect(h[0].sobre).toBeUndefined();
  });
});
