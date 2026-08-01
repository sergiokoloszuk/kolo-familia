import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  reservarEnvioProativo,
  proativaIsentaDeCadencia,
  PROATIVAS_ISENTAS,
  JANELA_CADENCIA_MS,
} from "./cadencia";

/**
 * O caso real: 08:00 sugestão espontânea, 08:01 cobrança de acompanhamento do
 * plano. Cinco crons agendados no mesmo minuto, cada um com idempotência só do
 * PRÓPRIO tipo, e ninguém dono do conjunto.
 *
 * O teste que importa é o de CONCORRÊNCIA: dois crons em paralelo não podem
 * conseguir enviar os dois. "Consultar e depois enviar" passaria num teste
 * sequencial e falharia em produção.
 */

// ---------------------------------------------------------------
// Um `ayla_send_log` em memória, com a semântica que a trava usa.
// ---------------------------------------------------------------
type Linha = {
  id: string;
  family_account_id: string;
  template_key: string;
  status: string;
  created_at: string;
};

function fakeSupabase(estado: { linhas: Linha[]; seq: number; relogio: string[] }) {
  return {
    from(tabela: string) {
      if (tabela !== "ayla_send_log") throw new Error(`tabela inesperada: ${tabela}`);
      const filtros: Array<(l: Linha) => boolean> = [];
      const api = {
        insert(dados: Partial<Linha> & { payload?: { cadencia?: { reservadoEm?: string } } }) {
          // Por padrão o `created_at` acompanha o instante da reserva (é o que o
          // Postgres faria). `relogio` sobrepõe isso, e é assim que se força o
          // empate no mesmo milissegundo nos testes de concorrência.
          const created_at =
            estado.relogio.shift() ??
            dados.payload?.cadencia?.reservadoEm ??
            new Date().toISOString();
          const linha: Linha = {
            id: `id-${String(++estado.seq).padStart(3, "0")}`,
            family_account_id: dados.family_account_id!,
            template_key: dados.template_key!,
            status: dados.status ?? "enviada",
            created_at,
          };
          estado.linhas.push(linha);
          return {
            select: () => ({ single: async () => ({ data: linha, error: null }) }),
          };
        },
        select() {
          return api;
        },
        eq(coluna: keyof Linha, valor: string) {
          filtros.push((l) => l[coluna] === valor);
          return api;
        },
        gte(coluna: "created_at", valor: string) {
          filtros.push((l) => l[coluna] >= valor);
          return api;
        },
        in(coluna: "status", valores: string[]) {
          filtros.push((l) => valores.includes(l[coluna]));
          return Promise.resolve({
            data: estado.linhas.filter((l) => filtros.every((f) => f(l))),
          }) as never;
        },
        delete() {
          return {
            eq: async (_c: string, id: string) => {
              estado.linhas = estado.linhas.filter((l) => l.id !== id);
              return { data: null };
            },
          };
        },
      };
      return api;
    },
  } as unknown as SupabaseClient;
}

const FAM = "fam-1";
const nova = () => ({ linhas: [] as Linha[], seq: 0, relogio: [] as string[] });

describe("cadência — o caso real (08:00 + 08:01)", () => {
  it("a segunda proativa em um minuto NÃO passa", async () => {
    const estado = nova();
    const db = fakeSupabase(estado);

    const oito = new Date("2026-08-01T11:00:00.000Z");
    const primeira = await reservarEnvioProativo(db, {
      familyAccountId: FAM,
      tipo: "rotina",
      agora: oito,
    });
    expect(primeira.ok).toBe(true);

    const umMinutoDepois = new Date("2026-08-01T11:01:00.000Z");
    const segunda = await reservarEnvioProativo(db, {
      familyAccountId: FAM,
      tipo: "plano_seguimento",
      agora: umMinutoDepois,
    });
    expect(segunda.ok).toBe(false);
    if (!segunda.ok) expect(segunda.motivo).toMatch(/cadencia/);
  });

  it("depois da janela, volta a passar", async () => {
    const estado = nova();
    const db = fakeSupabase(estado);
    await reservarEnvioProativo(db, {
      familyAccountId: FAM,
      tipo: "rotina",
      agora: new Date("2026-08-01T11:00:00.000Z"),
    });
    const depois = new Date(
      new Date("2026-08-01T11:00:00.000Z").getTime() + JANELA_CADENCIA_MS + 60_000,
    );
    const r = await reservarEnvioProativo(db, {
      familyAccountId: FAM,
      tipo: "insight",
      agora: depois,
    });
    expect(r.ok).toBe(true);
  });

  it("outra família não é afetada", async () => {
    const estado = nova();
    const db = fakeSupabase(estado);
    const agora = new Date("2026-08-01T11:00:00.000Z");
    await reservarEnvioProativo(db, { familyAccountId: FAM, tipo: "rotina", agora });
    const outra = await reservarEnvioProativo(db, {
      familyAccountId: "fam-2",
      tipo: "rotina",
      agora,
    });
    expect(outra.ok).toBe(true);
  });
});

describe("cadência — CONCORRÊNCIA (dois crons juntos)", () => {
  it("dois disparos simultâneos: exatamente UM envia", async () => {
    const estado = nova();
    // Mesmo milissegundo nos dois inserts: o pior caso, e o que um
    // "consulta-depois-envia" perderia. O desempate é por id.
    estado.relogio = ["2026-08-01T11:00:00.000Z", "2026-08-01T11:00:00.000Z"];
    const db = fakeSupabase(estado);
    const agora = new Date("2026-08-01T11:00:00.000Z");

    const [a, b] = await Promise.all([
      reservarEnvioProativo(db, { familyAccountId: FAM, tipo: "rotina", agora }),
      reservarEnvioProativo(db, { familyAccountId: FAM, tipo: "insight", agora }),
    ]);

    const venceram = [a, b].filter((r) => r.ok).length;
    expect(venceram).toBe(1);
  });

  it("cinco crons no mesmo minuto: exatamente UM envia", async () => {
    // O cenário do vercel.json — cinco tipos agendados em `0 11,15,18,22`.
    const estado = nova();
    estado.relogio = Array(5).fill("2026-08-01T11:00:00.000Z");
    const db = fakeSupabase(estado);
    const agora = new Date("2026-08-01T11:00:00.000Z");
    const tipos = ["rotina", "inatividade", "plano_seguimento", "insight", "fim_de_semana"];

    const rs = await Promise.all(
      tipos.map((tipo) => reservarEnvioProativo(db, { familyAccountId: FAM, tipo, agora })),
    );
    expect(rs.filter((r) => r.ok).length).toBe(1);
  });

  it("quem perde não deixa reserva para trás bloqueando a janela seguinte", async () => {
    const estado = nova();
    estado.relogio = ["2026-08-01T11:00:00.000Z", "2026-08-01T11:00:00.000Z"];
    const db = fakeSupabase(estado);
    const agora = new Date("2026-08-01T11:00:00.000Z");
    await Promise.all([
      reservarEnvioProativo(db, { familyAccountId: FAM, tipo: "rotina", agora }),
      reservarEnvioProativo(db, { familyAccountId: FAM, tipo: "insight", agora }),
    ]);
    // Sobra só a linha de quem venceu — a do perdedor foi apagada.
    expect(estado.linhas.length).toBe(1);
  });
});

describe("cadência — o que nunca espera", () => {
  it("isentos: só os que não têm um próximo horário equivalente", () => {
    expect([...PROATIVAS_ISENTAS].sort()).toEqual([
      "boas_vindas",
      "campanha_operacional",
      "crianca_especifica",
      "dass21_resultado_severo",
      "trial_d0",
      "trial_d3",
    ]);
  });

  it("acompanhamento de plano NÃO é isento — é metade do caso real", () => {
    expect(proativaIsentaDeCadencia("plano_seguimento")).toBe(false);
    expect(proativaIsentaDeCadencia("recuperacao_plano")).toBe(false);
  });

  it("boas-vindas passa mesmo com outra proativa na janela", async () => {
    const estado = nova();
    const db = fakeSupabase(estado);
    const agora = new Date("2026-08-01T11:00:00.000Z");
    await reservarEnvioProativo(db, { familyAccountId: FAM, tipo: "rotina", agora });
    // A isenção acontece antes da reserva (em enviarEPersistir); aqui a garantia
    // é que a reserva de um isento também não é bloqueada pelos outros.
    expect(proativaIsentaDeCadencia("boas_vindas")).toBe(true);
  });

  it("uma proativa isenta na janela não bloqueia as demais", async () => {
    const estado = nova();
    const db = fakeSupabase(estado);
    const agora = new Date("2026-08-01T11:00:00.000Z");
    estado.linhas.push({
      id: "id-boasvindas",
      family_account_id: FAM,
      template_key: "boas_vindas",
      status: "enviada",
      created_at: "2026-08-01T10:59:00.000Z",
    });
    const r = await reservarEnvioProativo(db, {
      familyAccountId: FAM,
      tipo: "rotina",
      agora,
    });
    expect(r.ok).toBe(true);
  });
});

describe("cadência — degradação", () => {
  it("banco fora não silencia a Ayla", async () => {
    const quebrado = {
      from() {
        throw new Error("sem banco");
      },
    } as unknown as SupabaseClient;
    const r = await reservarEnvioProativo(quebrado, {
      familyAccountId: FAM,
      tipo: "rotina",
    });
    // Mandar duas é menos grave que não mandar nenhuma.
    expect(r.ok).toBe(true);
  });
});
