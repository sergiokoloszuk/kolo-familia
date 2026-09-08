import { readFileSync } from "node:fs";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { novoRastro, registrarRastro, etapa, type RastroRotina } from "./rotina-rastro";

const GUIADA = readFileSync(new URL("./rotina-guiada.ts", import.meta.url), "utf8");

const persistidos: Array<Record<string, unknown>> = [];
vi.mock("@/lib/log", () => ({
  logEvent: async (evt: Record<string, unknown>) => {
    persistidos.push(evt);
  },
}));

/**
 * GATE A · PEÇA 1 — A OBSERVABILIDADE DO TURNO DE ROTINA.
 *
 * ⚠️ POR QUE ISTO É TESTADO, e não só escrito. Em 08/09/2026 `conduzirRotina`
 * devolveu `null` num turno real da Karina e a família recebeu uma conversa sem
 * artefato. Existiam dois pontos possíveis para aquele `null` e nenhuma forma de
 * saber qual — a decisão ia para o stdout da Vercel. Telemetria que só existe em
 * log efêmero é telemetria que não existe quando importa.
 *
 * Estes testes prendem o mecanismo: se alguém remover o `finally`, tirar o
 * `persistir`, ou acrescentar um `return null` sem motivo, a suíte acusa.
 */
describe("o rastro cobre TODAS as saídas — inclusive as silenciosas", () => {
  beforeEach(() => {
    persistidos.length = 0;
  });

  it("o flush está num finally, não antes de cada return", () => {
    // Nove saídas nesta função; a que nos cegou seria justamente a esquecida.
    expect(GUIADA).toMatch(/\} finally \{[\s\S]{0,400}?void registrarRastro\(rastro\);/);
  });

  it("os dois return null que nos cegaram agora dizem por quê", () => {
    expect(GUIADA).toMatch(/rastro\.saida = "null_nao_e_rotina"/);
    expect(GUIADA).toMatch(/rastro\.saida = "null_condutor_saiu"/);
    expect(GUIADA).toMatch(/rastro\.motivo = rastro\.prontidao_motivo/);
  });

  it("todo return null de conduzirRotina marca uma saída", () => {
    const fn = GUIADA.slice(
      GUIADA.indexOf("export async function conduzirRotina"),
      GUIADA.indexOf("// ---------- \"Traga a rotina de hoje"),
    );
    // Nenhum `return null;` solto: cada um vem depois de marcar `rastro.saida`.
    const soltos = fn.match(/\n\s+return null;/g) ?? [];
    for (const s of soltos) {
      const i = fn.indexOf(s);
      const antes = fn.slice(Math.max(0, i - 300), i);
      expect(antes, `return null sem rastro.saida em: ...${antes.slice(-120)}`).toMatch(
        /rastro\.saida =/,
      );
    }
  });

  it("o rastro é PERSISTIDO, não só logado", async () => {
    const r = novoRastro("fam-1", 42);
    r.saida = "null_nao_e_rotina";
    await registrarRastro(r);
    expect(persistidos).toHaveLength(1);
    expect(persistidos[0].persistir).toBe(true);
    expect(persistidos[0].kind).toBe("rotina_turno");
  });

  it("saída silenciosa sobe a severidade — ela precisa saltar aos olhos", async () => {
    const r = novoRastro("fam-1", 10);
    r.saida = "null_condutor_saiu";
    await registrarRastro(r);
    expect(persistidos[0].severity).toBe("warn");

    persistidos.length = 0;
    const ok = novoRastro("fam-1", 10);
    ok.saida = "montou";
    await registrarRastro(ok);
    expect(persistidos[0].severity).toBe("info");
  });
});

describe("o rastro não vaza conteúdo de família", () => {
  it("guarda o TAMANHO do pedido, nunca o texto", () => {
    const r = novoRastro("fam-1", 137);
    expect(r.chars_pedido).toBe(137);
    expect(JSON.stringify(r)).not.toContain("texto");
  });

  it("nenhum campo do rastro carrega fala da mãe ou da Ayla", () => {
    const r = novoRastro("fam-1", 10);
    const proibidos = ["mensagem", "fala", "conversa", "contexto", "nome"];
    for (const k of Object.keys(r)) {
      expect(proibidos, `campo suspeito: ${k}`).not.toContain(k);
    }
  });
});

describe("os tempos por etapa", () => {
  it("mede a etapa e soma no rastro", async () => {
    const r = novoRastro("fam-1", 10);
    await etapa(r, "prontidao", async () => {
      await new Promise((res) => setTimeout(res, 12));
      return 1;
    });
    expect(r.ms.prontidao).toBeGreaterThanOrEqual(10);
  });

  it("acumula quando a mesma etapa roda mais de uma vez", async () => {
    const r = novoRastro("fam-1", 10);
    const nada = async () => {
      await new Promise((res) => setTimeout(res, 5));
    };
    await etapa(r, "contexto", nada);
    await etapa(r, "contexto", nada);
    expect(r.ms.contexto).toBeGreaterThanOrEqual(8);
  });

  it("etapa que falha ainda é cronometrada, e o erro SOBE", async () => {
    const r = novoRastro("fam-1", 10);
    await expect(
      etapa(r, "condutor", async () => {
        throw new Error("provider fora");
      }),
    ).rejects.toThrow("provider fora");
    expect(r.ms.condutor).toBeDefined();
  });

  it("o total é calculado no fecho", async () => {
    const r: RastroRotina = novoRastro("fam-1", 10);
    r.ms.contexto = 400;
    r.ms.prontidao = 900;
    r.ms.condutor = 5000;
    r.saida = "montou";
    await registrarRastro(r);
    expect(r.ms.total).toBe(6300);
  });
});

describe("as leituras repetidas de perfil ficam contadas", () => {
  it("o contador existe — e agora conta UMA leitura, não três", () => {
    expect(GUIADA).toMatch(/rastro\.leituras_perfil \+= 1;/);
    // ⚠️ ERAM TRÊS consultas à mesma linha (`carregarInteresses`,
    // `carregarTransicoes`, `carregarOQueJaSabemos`), medidas pelo próprio
    // rastro em 09:46: `leituras_perfil=3`, 879 ms de contexto. Em 08/09/2026
    // viraram uma (`lerPerfilDaRotina`) e duas funções puras sobre a linha.
    expect((GUIADA.match(/rastro\.leituras_perfil \+= 1;/g) ?? []).length).toBe(1);
    expect(GUIADA).toMatch(/lerPerfilDaRotina\(supabase, params\.membroAtipicoId\)/);
    expect(GUIADA).toMatch(/const interesses = carregarInteresses\(perfilDaRotina\);/);
    expect(GUIADA).toMatch(/const transicoesConhecidas = carregarTransicoes\(perfilDaRotina\);/);
  });

  it("as chamadas de modelo do turno ficam contadas", () => {
    expect((GUIADA.match(/rastro\.chamadas_llm \+= 1;/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
