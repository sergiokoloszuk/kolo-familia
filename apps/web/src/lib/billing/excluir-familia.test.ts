import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * OS ARQUIVOS DA CRIANÇA — E A FRONTEIRA ENTRE FAMÍLIAS.
 *
 * Até 20/08/2026 a cascata do banco apagava tudo, e **o bucket sobrevivia**:
 * PDFs de plano, cartões de rotina, desenhos e avatares ficavam lá depois da
 * conta sumir. "Conta e registros são excluídos" era falso.
 *
 * Ao consertar isso, o risco inverteu — remoção em massa por prefixo é a
 * operação mais fácil de errar do sistema. O teste 4 é o que segura a porta:
 * se um dia a listagem devolver caminho de outra família, a função aborta em
 * vez de apagar.
 */

const logEventMock = vi.fn();
const logServerErrorMock = vi.fn();
vi.mock("@/lib/log", () => ({
  logEvent: (...a: unknown[]) => logEventMock(...a),
  logServerError: (...a: unknown[]) => logServerErrorMock(...a),
}));
vi.mock("@/lib/stripe/client", () => ({
  getStripeClient: () => ({ subscriptions: { cancel: vi.fn().mockResolvedValue({}) } }),
}));

const { removerArquivosDaFamilia, excluirFamilia } = await import("./excluir-familia");

const FAM_A = "aaaaaaaa-1111-2222-3333-444444444444";
const FAM_B = "bbbbbbbb-5555-6666-7777-888888888888";

/**
 * Storage falso com estrutura de pastas real: `list` NÃO é recursivo e devolve
 * pasta sem `id` — igual ao Supabase. Sem isso o teste passaria numa
 * implementação que só olha o primeiro nível.
 */
function storageFake(arquivos: string[], opts: { paginaCheia?: boolean } = {}) {
  const removidos: string[] = [];
  const PAGINA = 100;
  return {
    removidos,
    from() {
      return {
        list(prefixo: string, { limit = PAGINA, offset = 0 } = {}) {
          const base = prefixo ? `${prefixo}/` : "";
          const filhos = new Map<string, boolean>(); // nome → éArquivo
          for (const a of arquivos) {
            if (!a.startsWith(base)) continue;
            const resto = a.slice(base.length);
            if (!resto) continue;
            const barra = resto.indexOf("/");
            if (barra === -1) filhos.set(resto, true);
            else filhos.set(resto.slice(0, barra), false);
          }
          const itens = [...filhos.entries()].map(([name, ehArquivo]) => ({
            name,
            id: ehArquivo ? `id-${name}` : null,
          }));
          const pagina = itens.slice(offset, offset + limit);
          void opts;
          return Promise.resolve({ data: pagina, error: null });
        },
        remove(caminhos: string[]) {
          removidos.push(...caminhos);
          return Promise.resolve({ data: caminhos, error: null });
        },
      };
    },
  };
}

function adminFake(storage: ReturnType<typeof storageFake>) {
  return { storage } as unknown as Parameters<typeof removerArquivosDaFamilia>[0];
}

beforeEach(() => {
  logEventMock.mockReset();
  logServerErrorMock.mockReset();
});

describe("remoção dos arquivos da família", () => {
  it("1. remove os arquivos da família, em todos os tipos", async () => {
    const st = storageFake([
      `${FAM_A}/plano/p1.pdf`,
      `${FAM_A}/rotina/r1.pdf`,
      `${FAM_A}/desenho/d1.jpg`,
      `${FAM_A}/avatar/a1.png`,
    ]);
    const r = await removerArquivosDaFamilia(adminFake(st), FAM_A);
    expect(r.erro).toBeNull();
    expect(r.removidos).toBe(4);
    expect(st.removidos.sort()).toEqual(
      [
        `${FAM_A}/avatar/a1.png`,
        `${FAM_A}/desenho/d1.jpg`,
        `${FAM_A}/plano/p1.pdf`,
        `${FAM_A}/rotina/r1.pdf`,
      ].sort(),
    );
  });

  it("2. NUNCA REMOVE ARQUIVO DE OUTRA FAMÍLIA", async () => {
    const st = storageFake([
      `${FAM_A}/plano/p1.pdf`,
      `${FAM_A}/desenho/d1.jpg`,
      `${FAM_B}/plano/p9.pdf`,
      `${FAM_B}/desenho/d9.jpg`,
      `${FAM_B}/avatar/a9.png`,
    ]);
    const r = await removerArquivosDaFamilia(adminFake(st), FAM_A);

    expect(r.removidos).toBe(2);
    // A prova, dita dos dois jeitos: nada da B saiu, e tudo que saiu é da A.
    expect(st.removidos.some((c) => c.includes(FAM_B))).toBe(false);
    expect(st.removidos.every((c) => c.startsWith(`${FAM_A}/`))).toBe(true);
  });

  it("3. desce nas pastas — a convenção tem dois níveis, e list não é recursivo", async () => {
    const st = storageFake([`${FAM_A}/rotina/semana/cartao1.jpg`, `${FAM_A}/plano/p.pdf`]);
    const r = await removerArquivosDaFamilia(adminFake(st), FAM_A);
    expect(r.removidos).toBe(2);
    expect(st.removidos).toContain(`${FAM_A}/rotina/semana/cartao1.jpg`);
  });

  it("4. CINTO DE SEGURANÇA: listagem vazando outra família → ABORTA sem remover nada", async () => {
    // Simula o pior caso: a listagem passa a devolver caminho de fora do
    // prefixo (mudança no Storage, bug, o que for). Nada pode ser apagado.
    const stVazado = {
      removidos: [] as string[],
      from() {
        return {
          list: () =>
            Promise.resolve({
              data: [{ name: "p1.pdf", id: "x" }, { name: `../${FAM_B}/p9.pdf`, id: "y" }],
              error: null,
            }),
          remove(c: string[]) {
            stVazado.removidos.push(...c);
            return Promise.resolve({ data: c, error: null });
          },
        };
      },
    };
    const r = await removerArquivosDaFamilia(
      adminFake(stVazado as unknown as ReturnType<typeof storageFake>),
      FAM_A,
    );
    expect(r.erro).toMatch(/fora do prefixo/);
    expect(r.removidos).toBe(0);
    expect(stVazado.removidos).toEqual([]);
  });

  it("5. família sem arquivo nenhum não é erro", async () => {
    const r = await removerArquivosDaFamilia(adminFake(storageFake([])), FAM_A);
    expect(r).toEqual({ removidos: 0, erro: null });
  });

  it("6. familyId vazio não lista nem remove nada", async () => {
    const st = storageFake([`${FAM_A}/plano/p.pdf`]);
    const r = await removerArquivosDaFamilia(adminFake(st), "");
    expect(r.erro).toMatch(/familyId vazio/);
    expect(st.removidos).toEqual([]);
  });

  it("7. erro do Storage não vira sucesso mudo", async () => {
    const stRuim = {
      from: () => ({
        list: () => Promise.resolve({ data: null, error: { message: "storage fora do ar" } }),
        remove: () => Promise.resolve({ data: null, error: null }),
      }),
    };
    const r = await removerArquivosDaFamilia(
      adminFake(stRuim as unknown as ReturnType<typeof storageFake>),
      FAM_A,
    );
    expect(r.erro).toMatch(/storage fora do ar/);
  });
});

/** Banco falso mínimo para exercitar `excluirFamilia` de ponta a ponta. */
function dbFake(over: { deleteErro?: string } = {}) {
  const chamadas: string[] = [];
  const st = storageFake([`${FAM_A}/plano/p.pdf`, `${FAM_B}/plano/outro.pdf`]);
  return {
    chamadas,
    storageFake: st,
    storage: st,
    from(tabela: string) {
      chamadas.push(`from:${tabela}`);
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data:
                  tabela === "subscription_accesses"
                    ? { stripe_subscription_id: "sub_1" }
                    : { whatsapp_e164: "+5511999999999" },
                error: null,
              }),
          }),
        }),
      };
    },
    rpc(nome: string) {
      chamadas.push(`rpc:${nome}`);
      return Promise.resolve({ data: null, error: null });
    },
    auth: {
      admin: {
        getUserById: () => Promise.resolve({ data: { user: { email: "mae@exemplo.com" } } }),
        deleteUser: () => {
          chamadas.push("deleteUser");
          return Promise.resolve({
            error: over.deleteErro ? { message: over.deleteErro } : null,
          });
        },
      },
    },
  };
}

describe("excluirFamilia — a função que as duas portas usam", () => {
  it("8. apaga arquivos ANTES do banco, e marca o teste como usado", async () => {
    const db = dbFake();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await excluirFamilia(db as any, {
      familyId: FAM_A,
      userId: "user-1",
      motivo: "trial",
    });

    expect(r.ok).toBe(true);
    expect(r.arquivosRemovidos).toBe(1);
    // Ordem: sem o family_account_id não há como descobrir o prefixo depois.
    const iRpc = db.chamadas.indexOf("rpc:registrar_teste_usado");
    const iDel = db.chamadas.indexOf("deleteUser");
    expect(iRpc).toBeGreaterThanOrEqual(0);
    expect(iDel).toBeGreaterThan(iRpc);
    expect(db.storageFake.removidos).toEqual([`${FAM_A}/plano/p.pdf`]);
  });

  it("9. a exclusão de UMA família não toca no arquivo da outra", async () => {
    const db = dbFake();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await excluirFamilia(db as any, { familyId: FAM_A, userId: "user-1", motivo: "cancelamento" });
    expect(db.storageFake.removidos.some((c) => c.includes(FAM_B))).toBe(false);
  });

  it("10. registra evento que SOBREVIVE à própria exclusão", async () => {
    const db = dbFake();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await excluirFamilia(db as any, {
      familyId: FAM_A,
      userId: "user-1",
      motivo: "inadimplencia",
      detalhe: { inicio_em: "2026-08-01T00:00:00.000Z" },
    });
    const ev = logEventMock.mock.calls.at(-1)![0] as {
      kind: string;
      severity: string;
      message: string;
    };
    expect(ev.kind).toBe("familia_excluida");
    // `eventos_app.family_account_id` é `on delete set null`: a linha fica.
    // E só severidade de erro/warn é persistida.
    expect(ev.severity).toBe("warn");
    expect(ev.message).toMatch(/\[inadimplencia\]/);
  });

  it("11. FALHA NO BANCO não vira sucesso mudo", async () => {
    const db = dbFake({ deleteErro: "user not found" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await excluirFamilia(db as any, {
      familyId: FAM_A,
      userId: "user-1",
      motivo: "trial",
    });
    expect(r.ok).toBe(false);
    expect(r.erro).toMatch(/user not found/);
    const ev = logEventMock.mock.calls.at(-1)![0] as { kind: string; severity: string };
    expect(ev.kind).toBe("familia_excluida_falhou");
    expect(ev.severity).toBe("error");
  });

  it("12. IDEMPOTENTE: a segunda chamada não quebra nem inventa sucesso", async () => {
    const db = dbFake({ deleteErro: "User not found" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await excluirFamilia(db as any, {
      familyId: FAM_A,
      userId: "user-1",
      motivo: "trial",
    });
    expect(r.ok).toBe(false);
    expect(r.erro).toBeTruthy();
  });

  it("13. o motivo do pedido da família é registrado como exclusão, não como dunning", async () => {
    const db = dbFake();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await excluirFamilia(db as any, {
      familyId: FAM_A,
      userId: "user-1",
      motivo: "pedido_da_familia",
    });
    const ev = logEventMock.mock.calls.at(-1)![0] as { message: string };
    expect(ev.message).toMatch(/\[pedido_da_familia\]/);
  });
});
