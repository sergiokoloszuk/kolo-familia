import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recomendacao, type ResumoSemana } from "./revisao";

/**
 * As quatro decisões e o que elas fazem com o fato.
 *
 * O que importa aqui não é "o botão chamou a função" — é o ESTADO que sobra no
 * banco. A prova ponta a ponta contra Postgres está em
 * `scripts/db/validar-revisao.mjs`; estes testes travam as regras.
 */

const logEvent = vi.fn<(e: unknown) => Promise<void>>(async () => {});
vi.mock("@/lib/log", () => ({ logEvent: (e: unknown) => logEvent(e) }));

const { decidirCaso } = await import("./revisao");

/** Supabase falso que registra o `update` e simula a trava de idempotência. */
function bancoFalso(estadoInicial: Record<string, unknown> | null) {
  let linha = estadoInicial ? { ...estadoInicial } : null;
  const updates: Record<string, unknown>[] = [];

  const client = {
    from: () => {
      const filtros: Record<string, unknown> = {};
      let patch: Record<string, unknown> | null = null;
      const api: Record<string, unknown> = {
        select: () => api,
        update: (p: Record<string, unknown>) => {
          patch = p;
          return api;
        },
        eq: () => api,
        is: (col: string) => {
          filtros[col] = null;
          return api;
        },
        maybeSingle: async () => ({ data: linha, error: null }),
        then: (resolve: (v: unknown) => unknown) => {
          // `update(...).is("quarentena_resolvido_em", null)` só afeta a linha
          // se ela ainda estiver pendente — é a trava de clique duplo.
          if (patch) {
            const pendente = linha && linha.quarentena_resolvido_em == null;
            if (!pendente) return resolve({ data: [], error: null });
            updates.push(patch);
            linha = { ...linha, ...patch };
            return resolve({ data: [{ id: "f1" }], error: null });
          }
          return resolve({ data: [], error: null });
        },
      };
      return api;
    },
  } as unknown as SupabaseClient;

  return { client, updates, atual: () => linha };
}

const PENDENTE = {
  id: "f1",
  family_account_id: "fam",
  status: "quarentena",
  quarentena_resolvido_em: null,
  quarentena_resolucao: null,
  membro_atipico_id: "pedro",
};

beforeEach(() => logEvent.mockClear());

describe("APROVAR", () => {
  it("torna o fato ativo e registra quem e quando", async () => {
    const b = bancoFalso(PENDENTE);
    const r = await decidirCaso(b.client, {
      fatoId: "f1",
      decisao: "aprovar",
      revisorId: "karina",
    });
    expect(r).toEqual({ ok: true, jaResolvido: false });

    const p = b.updates[0];
    expect(p.status).toBe("ativo");
    expect(p.quarentena_resolucao).toBe("liberado");
    expect(p.quarentena_resolvido_por).toBe("karina");
    expect(p.quarentena_resolvido_em).toBeTruthy();
    expect(p.relacao_origem).toBe("revisao_humana");
  });
});

describe("PERFIL ERRADO", () => {
  it("invalida, registra o motivo e NÃO troca o membro", async () => {
    const b = bancoFalso(PENDENTE);
    await decidirCaso(b.client, {
      fatoId: "f1",
      decisao: "pessoa_errada",
      revisorId: "karina",
    });

    const p = b.updates[0];
    expect(p.status).toBe("invalidado");
    expect(p.relacao_motivo).toBe("pessoa_errada");
    // A regra que não pode quebrar: reatribuir reescreveria história.
    expect(p).not.toHaveProperty("membro_atipico_id");
    expect(b.atual()?.membro_atipico_id).toBe("pedro");
  });

  it("sobe para warn — é a métrica que decide se a coleta continua", async () => {
    const b = bancoFalso(PENDENTE);
    await decidirCaso(b.client, { fatoId: "f1", decisao: "pessoa_errada", revisorId: "k" });
    const evt = logEvent.mock.calls.at(-1)![0] as { severity: string };
    expect(evt.severity).toBe("warn");
  });
});

describe("DESCARTAR", () => {
  it("invalida com motivo próprio, distinto de perfil errado", async () => {
    const b = bancoFalso(PENDENTE);
    await decidirCaso(b.client, { fatoId: "f1", decisao: "descartar", revisorId: "k" });
    expect(b.updates[0].status).toBe("invalidado");
    expect(b.updates[0].relacao_motivo).toBe("descartado");
  });
});

describe("NÃO SEI DIZER", () => {
  it("continua em quarentena, sem decisão, mas marcado como olhado", async () => {
    const b = bancoFalso(PENDENTE);
    await decidirCaso(b.client, { fatoId: "f1", decisao: "em_duvida", revisorId: "k" });

    const p = b.updates[0];
    expect(p.status).toBe("quarentena");
    // `resolucao` nula = ninguém decidiu; `resolvido_em` preenchido = alguém
    // olhou. É o par que tira da fila diária sem perder o rastro.
    expect(p.quarentena_resolucao).toBeNull();
    expect(p.quarentena_resolvido_em).toBeTruthy();
    expect(p.relacao_motivo).toBe("em_duvida");
  });
});

describe("nenhuma decisão apaga", () => {
  it("todas usam update; nunca delete", async () => {
    for (const d of ["aprovar", "pessoa_errada", "descartar", "em_duvida"] as const) {
      const b = bancoFalso(PENDENTE);
      await decidirCaso(b.client, { fatoId: "f1", decisao: d, revisorId: "k" });
      expect(b.updates).toHaveLength(1);
      expect(b.atual()).not.toBeNull();
    }
  });
});

describe("idempotência", () => {
  it("clique duplo não altera duas vezes", async () => {
    const b = bancoFalso(PENDENTE);
    const p1 = await decidirCaso(b.client, { fatoId: "f1", decisao: "aprovar", revisorId: "k" });
    const p2 = await decidirCaso(b.client, { fatoId: "f1", decisao: "aprovar", revisorId: "k" });
    expect(p1).toEqual({ ok: true, jaResolvido: false });
    expect(p2).toEqual({ ok: true, jaResolvido: true });
    expect(b.updates).toHaveLength(1);
  });

  it("caso já resolvido devolve jaResolvido, não erro", async () => {
    const b = bancoFalso({ ...PENDENTE, quarentena_resolvido_em: "2026-08-01T10:00:00Z" });
    const r = await decidirCaso(b.client, { fatoId: "f1", decisao: "descartar", revisorId: "k" });
    expect(r).toEqual({ ok: true, jaResolvido: true });
    expect(b.updates).toHaveLength(0);
  });

  it("caso inexistente é erro claro", async () => {
    const b = bancoFalso(null);
    const r = await decidirCaso(b.client, { fatoId: "f1", decisao: "aprovar", revisorId: "k" });
    expect(r).toEqual({ ok: false, erro: "caso_nao_encontrado" });
  });
});

describe("telemetria não vaza conteúdo", () => {
  it("registra estado anterior e posterior, nunca a afirmação", async () => {
    const b = bancoFalso({ ...PENDENTE, afirmacao: "SEGREDO CLINICO DA CRIANCA" });
    await decidirCaso(b.client, { fatoId: "f1", decisao: "aprovar", revisorId: "k" });
    const bruto = JSON.stringify(logEvent.mock.calls);
    expect(bruto).not.toContain("SEGREDO CLINICO");
    expect(bruto).toContain("antes");
    expect(bruto).toContain("depois");
  });
});

describe("recomendação do resumo semanal", () => {
  const base: ResumoSemana = {
    total: 100, ativos: 90, quarentena: 10, aprovados: 5,
    descartados: 2, pessoaErrada: 0, emDuvida: 0, falhas: 0,
  };

  it("erro de perfil manda pausar, mesmo com o resto saudável", () => {
    expect(recomendacao({ ...base, pessoaErrada: 1 })).toBe("pausar");
  });

  it("falha de gravação manda pausar", () => {
    expect(recomendacao({ ...base, falhas: 1 })).toBe("pausar");
  });

  it("quarentena acima de 40% manda pausar", () => {
    expect(recomendacao({ ...base, ativos: 50, quarentena: 25 })).toBe("pausar");
  });

  it("entre 15 e 40% é atenção", () => {
    expect(recomendacao({ ...base, ativos: 100, quarentena: 20 })).toBe("atencao");
  });

  it("muitos sem decisão também é atenção", () => {
    expect(recomendacao({ ...base, emDuvida: 4 })).toBe("atencao");
  });

  it("tudo baixo é continuar", () => {
    expect(recomendacao(base)).toBe("continuar");
  });
});
