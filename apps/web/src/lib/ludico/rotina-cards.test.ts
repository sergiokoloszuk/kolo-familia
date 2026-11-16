import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { gerarEConfirmarCardsRotina, statusSeguroDosCards } from "./rotina-cards";

type TarefaFake = {
  id: string;
  rotina_id: string;
  imagem_url: string | null;
  nome_tematico?: string;
  cena?: string;
};

type EstadoFake = {
  rotina: {
    id: string;
    family_account_id: string;
    cards_status: string;
    historia?: string;
    mascote_url?: string;
  };
  tarefas: TarefaFake[];
  falhaEscritaId?: string;
  falhaLeitura?: boolean;
  falhaConclusao?: boolean;
};

function supabaseFake(estado: EstadoFake): SupabaseClient {
  function executarAtualizacao(
    tabela: string,
    valores: Record<string, unknown>,
    filtros: Record<string, unknown>,
  ) {
    if (tabela === "rotina_tarefas") {
      if (filtros.id === estado.falhaEscritaId) {
        return { data: null, error: new Error("escrita recusada") };
      }
      const tarefa = estado.tarefas.find(
        (item) =>
          item.id === filtros.id &&
          (!filtros.rotina_id || item.rotina_id === filtros.rotina_id),
      );
      if (tarefa) Object.assign(tarefa, valores);
      return { data: tarefa ?? null, error: null };
    }

    if (estado.falhaConclusao) {
      return { data: null, error: new Error("conclusão recusada") };
    }
    const confere =
      estado.rotina.id === filtros.id &&
      estado.rotina.family_account_id === filtros.family_account_id &&
      estado.rotina.cards_status === filtros.cards_status;
    if (confere) Object.assign(estado.rotina, valores);
    return { data: confere ? { id: estado.rotina.id } : null, error: null };
  }

  function consultaAtualizacao(tabela: string, valores: Record<string, unknown>) {
    const filtros: Record<string, unknown> = {};
    const query = {
      eq(campo: string, valor: unknown) {
        filtros[campo] = valor;
        return query;
      },
      select() {
        return query;
      },
      maybeSingle() {
        return Promise.resolve(executarAtualizacao(tabela, valores, filtros));
      },
      then<TResult1 = unknown, TResult2 = never>(
        resolve?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
        reject?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
      ) {
        return Promise.resolve(executarAtualizacao(tabela, valores, filtros)).then(
          resolve,
          reject,
        );
      },
    };
    return query;
  }

  function consultaLeitura(tabela: string) {
    const filtros: Record<string, unknown> = {};
    const query = {
      eq(campo: string, valor: unknown) {
        filtros[campo] = valor;
        return query;
      },
      then<TResult1 = unknown, TResult2 = never>(
        resolve?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
        reject?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
      ) {
        const resposta = estado.falhaLeitura
          ? { data: null, error: new Error("leitura recusada") }
          : {
              data:
                tabela === "rotina_tarefas"
                  ? estado.tarefas
                      .filter((item) => item.rotina_id === filtros.rotina_id)
                      .map(({ id, imagem_url }) => ({ id, imagem_url }))
                  : [],
              error: null,
            };
        return Promise.resolve(resposta).then(resolve, reject);
      },
    };
    return query;
  }

  return {
    from(tabela: string) {
      return {
        update(valores: Record<string, unknown>) {
          return consultaAtualizacao(tabela, valores);
        },
        select() {
          return consultaLeitura(tabela);
        },
      };
    },
  } as unknown as SupabaseClient;
}

function cenario(overrides: Partial<EstadoFake> = {}) {
  const estado: EstadoFake = {
    rotina: {
      id: "rotina-1",
      family_account_id: "familia-1",
      cards_status: "gerando",
    },
    tarefas: [
      { id: "tarefa-1", rotina_id: "rotina-1", imagem_url: null },
      { id: "tarefa-2", rotina_id: "rotina-1", imagem_url: null },
    ],
    ...overrides,
  };
  const runtime = {
    gerarRoteiro: vi.fn(async () => ({
      mascote: "um mascote",
      historia: "uma história",
      cards: [
        { atividade: "Escovar os dentes", nome_tematico: "Primeiro", cena: "Cena 1" },
        { atividade: "Vestir a roupa", nome_tematico: "Segundo", cena: "Cena 2" },
      ],
    })),
    ilustrar: vi.fn(async () => ({
      mascoteUrl: "mascote.png",
      imagens: ["card-1.png", "card-2.png"] as Array<string | null>,
    })),
  };
  const params = {
    rotinaId: "rotina-1",
    familyAccountId: "familia-1",
    tema: "espaço",
    atividades: ["Escovar os dentes", "Vestir a roupa"],
    idade: 7,
    nomeRotina: "Rotina da manhã",
    usarAvatar: false,
    tarefaIds: ["tarefa-1", "tarefa-2"],
  };
  return { estado, runtime, params };
}

describe("portão único dos cartões da rotina", () => {
  it("transforma geração abandonada e pronto incompleto em erro recuperável", () => {
    const agora = new Date("2026-11-16T18:10:00.000Z").getTime();
    expect(
      statusSeguroDosCards({
        status: "gerando",
        updatedAt: "2026-11-16T18:00:00.000Z",
        imagens: [null],
        agoraMs: agora,
      }),
    ).toBe("erro");
    expect(
      statusSeguroDosCards({
        status: "pronto",
        updatedAt: "2026-11-16T18:09:00.000Z",
        imagens: ["card-1.png", null],
        agoraMs: agora,
      }),
    ).toBe("erro");
    expect(
      statusSeguroDosCards({
        status: "pronto",
        updatedAt: "2026-11-16T18:09:00.000Z",
        imagens: ["card-1.png", "card-2.png"],
        agoraMs: agora,
      }),
    ).toBe("pronto");
  });

  it("só declara pronto depois de gravar e reler todos os cartões", async () => {
    const { estado, runtime, params } = cenario();

    await gerarEConfirmarCardsRotina(supabaseFake(estado), params, runtime);

    expect(estado.tarefas.map((tarefa) => tarefa.imagem_url)).toEqual([
      "card-1.png",
      "card-2.png",
    ]);
    expect(estado.rotina).toMatchObject({
      cards_status: "pronto",
      historia: "uma história",
      mascote_url: "mascote.png",
    });
  });

  it("rejeita sucesso parcial quando o ilustrador devolve imagem nula", async () => {
    const { estado, runtime, params } = cenario();
    runtime.ilustrar.mockResolvedValueOnce({
      mascoteUrl: "mascote.png",
      imagens: ["card-1.png", null],
    });

    await expect(
      gerarEConfirmarCardsRotina(supabaseFake(estado), params, runtime),
    ).rejects.toThrow("cartões incompletos: 1/2");
    expect(estado.rotina.cards_status).toBe("gerando");
    expect(estado.tarefas.every((tarefa) => tarefa.imagem_url === null)).toBe(true);
  });

  it("não declara pronto quando uma escrita de cartão falha", async () => {
    const { estado, runtime, params } = cenario({ falhaEscritaId: "tarefa-2" });

    await expect(
      gerarEConfirmarCardsRotina(supabaseFake(estado), params, runtime),
    ).rejects.toThrow("falha ao salvar imagem de cartão");
    expect(estado.rotina.cards_status).toBe("gerando");
  });

  it("não declara pronto quando a releitura não comprova o resultado", async () => {
    const { estado, runtime, params } = cenario({ falhaLeitura: true });

    await expect(
      gerarEConfirmarCardsRotina(supabaseFake(estado), params, runtime),
    ).rejects.toThrow("cartões salvos incompletos");
    expect(estado.rotina.cards_status).toBe("gerando");
  });

  it("propaga a falha da escrita final em vez de simular sucesso", async () => {
    const { estado, runtime, params } = cenario({ falhaConclusao: true });

    await expect(
      gerarEConfirmarCardsRotina(supabaseFake(estado), params, runtime),
    ).rejects.toThrow("falha ao confirmar cartões da rotina");
    expect(estado.rotina.cards_status).toBe("gerando");
  });

  it("não confirma uma geração cujo estado deixou de ser gerando", async () => {
    const { estado, runtime, params } = cenario();
    estado.rotina.cards_status = "erro";

    await expect(
      gerarEConfirmarCardsRotina(supabaseFake(estado), params, runtime),
    ).rejects.toThrow("falha ao confirmar cartões da rotina");
    expect(estado.rotina.cards_status).toBe("erro");
  });
});
