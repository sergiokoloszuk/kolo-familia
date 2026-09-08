import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { pendenciaDeRotina, VALIDADE_MS, type ResultadoPendencia } from "./rotina-pendencia";

/** Açúcar: o valor quando há pendência, senão `null`. */
const val = (r: ResultadoPendencia) => (r.estado === "sim" ? r.valor : null);

/**
 * GATE A · O DONO ÚNICO DE "HÁ ROTINA PENDENTE?".
 *
 * ⚠️ Antes deste módulo a pergunta tinha cinco donos, quatro janelas (48 h, 6 h,
 * nenhuma, 7 dias) e dois escopos. Estes testes prendem a semântica única — e,
 * principalmente, as duas invariantes que a ausência dela quebrou em produção:
 * pendência de um filho não governa conversa sobre o outro, e pendência que o
 * sistema já não resolve não governa conversa nenhuma.
 */

const AGORA = new Date("2026-09-08T12:00:00Z");
const hAtras = (h: number) => new Date(AGORA.getTime() - h * 3_600_000).toISOString();

type Linha = {
  id: string;
  nome: string | null;
  tema: string | null;
  membro_atipico_id: string | null;
  updated_at: string | null;
  created_at: string | null;
  cards_status: string;
  family_account_id: string;
};

/** Um Supabase de mentira que respeita os filtros que a consulta aplica. */
function bancoCom(linhas: Linha[]): SupabaseClient {
  const builder = (filtros: Array<[string, unknown]>) => ({
    eq(col: string, val: unknown) {
      return builder([...filtros, [col, val]]);
    },
    order() {
      return builder(filtros);
    },
    limit() {
      const data = linhas
        .filter((l) => filtros.every(([c, v]) => (l as unknown as Record<string, unknown>)[c] === v))
        .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
      return Promise.resolve({ data, error: null });
    },
  });
  return {
    from: () => ({ select: () => builder([]) }),
  } as unknown as SupabaseClient;
}

const FAM = "fam-1";
const MANU = "membro-manu";
const MARIO = "membro-mario";

const rotina = (over: Partial<Linha> = {}): Linha => ({
  id: "rot-1",
  nome: "Tarde no shopping",
  tema: null,
  membro_atipico_id: MANU,
  updated_at: hAtras(1),
  created_at: hAtras(1),
  cards_status: "aguardando",
  family_account_id: FAM,
  ...over,
});

describe("a invariante do isolamento entre irmãos", () => {
  it("pendência da MESMA criança, ainda válida, é encontrada", async () => {
    const p = await pendenciaDeRotina(bancoCom([rotina()]), {
      familyId: FAM,
      membroId: MANU,
      finalidade: "mostrar_ao_modelo",
      agora: AGORA,
    });
    expect(val(p)?.id).toBe("rot-1");
    expect(val(p)?.falta).toBe("tema");
  });

  it("pendência de OUTRO filho é ignorada — jamais governa", async () => {
    const p = await pendenciaDeRotina(bancoCom([rotina({ membro_atipico_id: MARIO })]), {
      familyId: FAM,
      membroId: MANU,
      finalidade: "mostrar_ao_modelo",
      agora: AGORA,
    });
    expect(val(p)).toBeNull();
  });

  it("sem membro, finalidade conversacional não devolve nada", async () => {
    for (const finalidade of ["capturar_tema", "mostrar_ao_modelo"] as const) {
      const p = await pendenciaDeRotina(bancoCom([rotina()]), {
        familyId: FAM,
        membroId: null,
        finalidade,
        agora: AGORA,
      });
      expect(val(p), finalidade).toBeNull();
    }
  });

  it("reconciliar varre sem membro — ali o dono é o artefato, não a conversa", async () => {
    const p = await pendenciaDeRotina(bancoCom([rotina({ membro_atipico_id: MARIO })]), {
      familyId: FAM,
      finalidade: "reconciliar",
      agora: AGORA,
    });
    expect(val(p)?.id).toBe("rot-1");
  });
});

describe("a validade por finalidade — cada número tem origem", () => {
  it("capturar tema vale 6 h: 5 h sim, 7 h não", async () => {
    const em = (h: number) =>
      pendenciaDeRotina(bancoCom([rotina({ updated_at: hAtras(h) })]), {
        familyId: FAM,
        membroId: MANU,
        finalidade: "capturar_tema",
        agora: AGORA,
      });
    expect(val(await em(5))).not.toBeNull();
    expect(val(await em(7))).toBeNull();
  });

  it("mostrar ao modelo vale 7 dias — o mesmo ponto em que o sistema desiste", async () => {
    const em = (h: number) =>
      pendenciaDeRotina(bancoCom([rotina({ updated_at: hAtras(h) })]), {
        familyId: FAM,
        membroId: MANU,
        finalidade: "mostrar_ao_modelo",
        agora: AGORA,
      });
    expect(val(await em(24))).not.toBeNull();
    expect(val(await em(6 * 24))).not.toBeNull();
    expect(val(await em(8 * 24))).toBeNull();
  });

  it("REGRESSÃO: a rotina de 18 dias não governa mais a conversa", async () => {
    // Caso real: `f0c052a4`, presa em `aguardando` desde 21/08, além do teto do
    // reconciliador, aparecendo como pendência de agora em toda conversa.
    const p = await pendenciaDeRotina(bancoCom([rotina({ updated_at: hAtras(18 * 24) })]), {
      familyId: FAM,
      membroId: MANU,
      finalidade: "mostrar_ao_modelo",
      agora: AGORA,
    });
    expect(val(p)).toBeNull();
  });

  it("vencer NÃO é apagar — a política só tira autoridade sobre a conversa", () => {
    // Prende a intenção: nada neste módulo escreve.
    expect(VALIDADE_MS.capturar_tema).toBeLessThan(VALIDADE_MS.mostrar_ao_modelo);
    expect(VALIDADE_MS.mostrar_ao_modelo).toBe(VALIDADE_MS.reconciliar);
  });
});

describe("só `aguardando` é pendência", () => {
  it("gerando NÃO vira nova pergunta de tema", async () => {
    const p = await pendenciaDeRotina(bancoCom([rotina({ cards_status: "gerando", tema: "Princesa" })]), {
      familyId: FAM,
      membroId: MANU,
      finalidade: "capturar_tema",
      agora: AGORA,
    });
    expect(val(p)).toBeNull();
  });

  it("pronto não continua pendente", async () => {
    const p = await pendenciaDeRotina(bancoCom([rotina({ cards_status: "pronto", tema: "Princesa" })]), {
      familyId: FAM,
      membroId: MANU,
      finalidade: "mostrar_ao_modelo",
      agora: AGORA,
    });
    expect(val(p)).toBeNull();
  });

  it("erro NÃO entra como pendência — não se pede tema a uma rotina que quebrou", async () => {
    const p = await pendenciaDeRotina(bancoCom([rotina({ cards_status: "erro" })]), {
      familyId: FAM,
      membroId: MANU,
      finalidade: "capturar_tema",
      agora: AGORA,
    });
    expect(val(p)).toBeNull();
  });
});

describe("as duas espécies de órfã", () => {
  it("sem tema → falta o DADO", async () => {
    const p = await pendenciaDeRotina(bancoCom([rotina({ tema: null })]), {
      familyId: FAM,
      membroId: MANU,
      finalidade: "capturar_tema",
      agora: AGORA,
    });
    expect(val(p)?.falta).toBe("tema");
  });

  it("com tema e ainda aguardando → falta o ATO", async () => {
    const p = await pendenciaDeRotina(bancoCom([rotina({ tema: "Princesa" })]), {
      familyId: FAM,
      membroId: MANU,
      finalidade: "capturar_tema",
      agora: AGORA,
    });
    expect(val(p)?.falta).toBe("geracao");
  });

  it("a mais recente vence quando há duas da mesma criança", async () => {
    const p = await pendenciaDeRotina(
      bancoCom([
        rotina({ id: "velha", updated_at: hAtras(5) }),
        rotina({ id: "nova", updated_at: hAtras(1) }),
      ]),
      { familyId: FAM, membroId: MANU, finalidade: "capturar_tema", agora: AGORA },
    );
    expect(val(p)?.id).toBe("nova");
  });
});

describe("três estados, não dois", () => {
  it("banco fora do ar é NAO RASTREADO, nunca 'não há'", async () => {
    const quebrado = {
      from: () => ({ select: () => ({ eq() { throw new Error("sem rede"); } }) }),
    } as unknown as SupabaseClient;
    const r = await pendenciaDeRotina(quebrado, {
      familyId: FAM, membroId: MANU, finalidade: "mostrar_ao_modelo",
    });
    expect(r.estado).toBe("nao_rastreado");
  });

  it("família sem pendência é NENHUM — e isso é uma afirmação legítima", async () => {
    const r = await pendenciaDeRotina(bancoCom([]), {
      familyId: FAM, membroId: MANU, finalidade: "mostrar_ao_modelo", agora: AGORA,
    });
    expect(r.estado).toBe("nenhum");
  });

  it("sem criança em foco é NAO RASTREADO — não saber de quem é ≠ não haver", async () => {
    const r = await pendenciaDeRotina(bancoCom([rotina()]), {
      familyId: FAM, membroId: null, finalidade: "mostrar_ao_modelo", agora: AGORA,
    });
    expect(r.estado).toBe("nao_rastreado");
  });

  it("vencida é NENHUM — o sistema sabe que existe e sabe que não governa", async () => {
    const r = await pendenciaDeRotina(bancoCom([rotina({ updated_at: hAtras(18 * 24) })]), {
      familyId: FAM, membroId: MANU, finalidade: "mostrar_ao_modelo", agora: AGORA,
    });
    expect(r.estado).toBe("nenhum");
  });
});

describe("degradação segura", () => {
  it("banco fora do ar não inventa pendência", async () => {
    const quebrado = {
      from: () => ({
        select: () => ({
          eq() {
            throw new Error("sem rede");
          },
        }),
      }),
    } as unknown as SupabaseClient;
    await expect(
      pendenciaDeRotina(quebrado, { familyId: FAM, membroId: MANU, finalidade: "capturar_tema" }),
    ).resolves.toEqual({ estado: "nao_rastreado" });
  });

  it("data corrompida não vira pendência eterna", async () => {
    const p = await pendenciaDeRotina(
      bancoCom([rotina({ updated_at: "ontem", created_at: "ontem" })]),
      { familyId: FAM, membroId: MANU, finalidade: "mostrar_ao_modelo", agora: AGORA },
    );
    expect(val(p)).toBeNull();
  });
});
