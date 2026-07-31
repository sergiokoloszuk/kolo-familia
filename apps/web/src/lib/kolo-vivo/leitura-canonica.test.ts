import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { carregarSecoesMembro, lerSecoesMembro, resumoRotulado } from "./leitura";
import { MEMBRO_CAMPOS_TODOS, MEMBRO_CAMPO_LABEL } from "./campos";
import { derivarTemasDoPerfil } from "@/lib/ayla/mensagemEspontanea";

/**
 * UMA FONTE CANÔNICA DE DOMÍNIOS.
 *
 * `leitura.test.ts` prova que o leitor lê os 20. Estes testes provam a outra
 * metade, que é a que apodrece: que ninguém montou uma lista PARALELA em algum
 * canal, e que o prompt não anuncia conhecer o que não carregou.
 */

const LEITURA_TOPLEVEL = ["essencial", "como_e", "corpo_rotina", "desafios_regulacao", "sensorial"];

/** Monta uma linha de `perfil_vivo_membro` com os domínios pedidos. */
function perfil(valores: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = { categorias_extras: {} };
  const extras = row.categorias_extras as Record<string, unknown>;
  for (const [campo, v] of Object.entries(valores)) {
    (LEITURA_TOPLEVEL.includes(campo) ? row : extras)[campo] = v;
  }
  return row;
}

describe("os 20 domínios canônicos chegam ao contexto", () => {
  it("aprendizado e escola — os que motivaram a auditoria — mudam o que a Ayla tem", () => {
    // Caso realista: a mãe diz "ele não liga os pontos" (aprendizado) e "a
    // escola não dá suporte" (escola). Os dois eram invisíveis no WhatsApp.
    const semNada = resumoRotulado(lerSecoesMembro(perfil({})));
    const comOsDois = resumoRotulado(
      lerSecoesMembro(
        perfil({
          aprendizado: { texto: "aprende vendo antes de fazer; não generaliza sozinho" },
          escola: { texto: "professora nova em julho, sem adaptação" },
        }),
      ),
    );

    expect(semNada).toBe("");
    expect(comOsDois).toContain("não generaliza sozinho");
    expect(comOsDois).toContain("professora nova em julho");
    // O conteúdo disponível MUDOU — é o que importa, não a redação da resposta.
    expect(comOsDois.length).toBeGreaterThan(semNada.length);
  });

  it("os seis que estavam cegos aparecem no bloco do prompt", () => {
    const secoes = lerSecoesMembro(
      perfil({
        aprendizado: { texto: "a1" },
        escola: { texto: "e1" },
        saude_geral: { texto: "s1" },
        imitacao: { texto: "i1" },
        tela_midia: { texto: "t1" },
        gostos: { texto: "g1" },
      }),
    );
    const bloco = resumoRotulado(secoes);
    for (const campo of ["aprendizado", "escola", "saude_geral", "imitacao", "tela_midia", "gostos"]) {
      expect(bloco, `${campo} não chegou ao prompt`).toContain(MEMBRO_CAMPO_LABEL[campo]);
    }
  });

  it("domínio vazio não vira linha fantasma", () => {
    const bloco = resumoRotulado(
      lerSecoesMembro(
        perfil({
          sono: { texto: "dorme bem" },
          // Campo TOCADO mas sem texto — é o estado que enganava as lacunas.
          escola: { texto: "   ", atualizado_em: "2026-07-31T10:00:00Z" },
          foco: {},
        }),
      ),
    );
    expect(bloco).toBe("Sono: dorme bem");
    expect(bloco).not.toContain("Escola");
    expect(bloco).not.toContain("Foco");
  });

  it("perfil vazio devolve string vazia, sem seção nem rótulo solto", () => {
    expect(resumoRotulado(lerSecoesMembro(null))).toBe("");
    expect(resumoRotulado(lerSecoesMembro({}))).toBe("");
    expect(resumoRotulado(lerSecoesMembro(perfil({})))).toBe("");
  });
});

describe("um membro não vê o perfil do outro", () => {
  it("a leitura filtra por membro_atipico_id", async () => {
    const perfis: Record<string, Record<string, unknown>> = {
      pedro: perfil({ escola: { texto: "escola do Pedro" } }),
      alice: perfil({ escola: { texto: "escola da Alice" } }),
    };
    let filtrado: string | null = null;
    const supabase = {
      from: () => {
        const api: Record<string, unknown> = {
          select: () => api,
          eq: (_col: string, v: string) => {
            filtrado = v;
            return api;
          },
          maybeSingle: async () => ({ data: perfis[filtrado ?? ""] ?? null, error: null }),
        };
        return api;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const doPedro = await carregarSecoesMembro(supabase, "pedro");
    expect(doPedro.escola).toBe("escola do Pedro");
    expect(JSON.stringify(doPedro)).not.toContain("Alice");

    const daAlice = await carregarSecoesMembro(supabase, "alice");
    expect(daAlice.escola).toBe("escola da Alice");
    expect(JSON.stringify(daAlice)).not.toContain("Pedro");
  });

  it("sem membro em foco, não devolve o perfil de ninguém", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nunca = { from: () => { throw new Error("não deveria consultar"); } } as any;
    expect(await carregarSecoesMembro(nunca, null)).toEqual({});
  });
});

describe("nenhuma lista paralela de domínios sobrou nos canais", () => {
  const fonte = (rel: string) => readFileSync(resolve(__dirname, "..", "..", rel), "utf8");

  it("o orquestrador do WhatsApp não enumera domínios à mão", () => {
    const src = fonte("lib/ayla/orchestrator.ts");
    // A assinatura de uma lista paralela: os nomes das colunas dedicadas
    // repetidos fora do `PERFIL_MEMBRO_SELECT` da fonte canônica.
    const listas = src.match(/essencial,\s*como_e,\s*corpo_rotina/g) ?? [];
    expect(
      listas.length,
      "voltou a existir lista de domínios no orchestrator — use PERFIL_MEMBRO_SELECT",
    ).toBe(0);
    expect(src).toContain("MEMBRO_CAMPOS_TODOS");
  });

  it("adicionar domínio em campos.ts basta — o resumo o inclui sozinho", () => {
    // Nenhum canal decide QUAIS domínios existem: quem decide é campos.ts.
    // Se alguém acrescentar um domínio lá, ele passa por aqui sem editar
    // mais nada — é o que este teste trava.
    const todos = Object.fromEntries(MEMBRO_CAMPOS_TODOS.map((c) => [c, `conteúdo de ${c}`]));
    const bloco = resumoRotulado(todos);
    expect(bloco.split("\n")).toHaveLength(MEMBRO_CAMPOS_TODOS.length);
    for (const campo of MEMBRO_CAMPOS_TODOS) {
      expect(bloco, `${campo} ficou de fora`).toContain(`conteúdo de ${campo}`);
    }
  });
});

describe("o prompt não afirma conhecer o que não carregou", () => {
  it("campo só com metadado não conta como preenchido em lugar nenhum", () => {
    // Este era o resíduo do achado nº 1: as LACUNAS diziam "JÁ TEM: Escola"
    // (porque o jsonb não estava vazio) enquanto a leitura omitia o domínio.
    // A Ayla era instruída a não re-perguntar sobre algo que nunca recebeu.
    const row = perfil({ escola: { atualizado_em: "2026-07-31T10:00:00Z", texto: "" } });
    const secoes = lerSecoesMembro(row);

    expect(secoes.escola).toBeUndefined();
    expect(resumoRotulado(secoes)).not.toContain("Escola");
    // E a mesma leitura é a que decide "já tem" — ver carregarLacunasKoloVivo.
    expect(Object.keys(secoes)).toHaveLength(0);
  });

  it("o que a leitura enxerga é exatamente o que vira 'já tem'", () => {
    const row = perfil({
      sono: { texto: "dorme bem" },
      escola: { atualizado_em: "2026-07-31T10:00:00Z" },
      como_e: { interesses: ["dinossauros"] },
    });
    const secoes = lerSecoesMembro(row);
    const preenchidos = MEMBRO_CAMPOS_TODOS.filter((c) => secoes[c]);

    // Onboarding conta (interesses), metadado não conta (escola).
    expect(preenchidos.sort()).toEqual(["como_e", "sono"]);
  });
});

describe("a mensagem espontânea usa a mesma fonte", () => {
  it("enxerga domínio de coluna dedicada — sensorial era invisível", () => {
    // `sensorial` é coluna dedicada, e a espontânea procurava em
    // `categorias_extras`: nunca podia virar tema, por mais que a mãe contasse.
    const { temasComInfo } = derivarTemasDoPerfil(perfil({ sensorial: { texto: "foge de barulho" } }));
    expect(temasComInfo.map((t) => t.dominio)).toContain("sensorial");
  });

  it("enxerga os seis que estavam cegos", () => {
    const { temasComInfo } = derivarTemasDoPerfil(
      perfil({
        aprendizado: { texto: "a" },
        escola: { texto: "e" },
        saude_geral: { texto: "s" },
        imitacao: { texto: "i" },
        tela_midia: { texto: "t" },
        gostos: { texto: "g" },
      }),
    );
    expect(temasComInfo.map((t) => t.dominio).sort()).toEqual(
      ["aprendizado", "escola", "gostos", "imitacao", "saude_geral", "tela_midia"].sort(),
    );
  });

  it("o que veio do cadastro fecha a lacuna — não pergunta de novo", () => {
    // A mãe contou os interesses no onboarding. A espontânea lia só `.texto` e
    // mandava, do nada, "me conta uma coisa do jeito de ser dele que você ama".
    const { gapsAbertos } = derivarTemasDoPerfil(perfil({ como_e: { interesses: ["trem", "água"] } }));
    expect(gapsAbertos.map((g) => g.campo)).not.toContain("como_e");
  });

  it("perfil vazio mantém todos os gaps abertos e nenhum tema", () => {
    const r = derivarTemasDoPerfil(null);
    expect(r.temasComInfo).toEqual([]);
    expect(r.gapsAbertos.length).toBeGreaterThan(0);
    expect(r.temasSemInfo.length).toBeGreaterThan(0);
  });

  it("todo domínio canônico tem rótulo conversacional", () => {
    const todos = Object.fromEntries(MEMBRO_CAMPOS_TODOS.map((c) => [c, { texto: "x" }]));
    const { temasComInfo } = derivarTemasDoPerfil(perfil(todos));
    expect(temasComInfo).toHaveLength(MEMBRO_CAMPOS_TODOS.length);
    for (const t of temasComInfo) {
      expect(t.label, `${t.dominio} sem rótulo`).toBeTruthy();
      // Minúscula: o rótulo entra no meio de uma frase de WhatsApp.
      expect(t.label[0], `${t.dominio}: rótulo capitalizado`).toBe(t.label[0].toLowerCase());
    }
  });
});
