import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buscarConhecimentosBIA, montarConsultaTexto } from "./retriever";
import type { ChunkParaPontuar } from "./pontuacao";

/**
 * Testes do SERVIÇO (a camada de I/O). O julgamento é testado em
 * pontuacao.test.ts; aqui interessa só o que o serviço faz com o banco:
 *  - os filtros que vão para o SQL (idade, ativo, revisão);
 *  - a soma das duas consultas (estruturada + textual) sem duplicar;
 *  - a degradação silenciosa.
 *
 * Sem banco de verdade: um Supabase falso que registra as chamadas.
 */

type Chamada = { metodo: string; args: unknown[] };

/**
 * Construtor de consulta falso. Todo método encadeável devolve `this` e o
 * objeto é "thenable", que é como o supabase-js se comporta — a consulta só
 * executa quando alguém dá await.
 */
function builderFalso(data: unknown[], registro: Chamada[]) {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "or", "in", "textSearch", "limit", "gte", "lte"]) {
    b[m] = (...args: unknown[]) => {
      registro.push({ metodo: m, args });
      return b;
    };
  }
  b.then = (resolve: (v: { data: unknown[] }) => unknown) => resolve({ data });
  return b;
}

/** `respostas` é consumido na ordem das consultas disparadas. */
function supabaseFalso(respostas: unknown[][], registro: Chamada[] = []) {
  let i = 0;
  const client = {
    from: (tabela: string) => {
      registro.push({ metodo: "from", args: [tabela] });
      return builderFalso(respostas[i++] ?? [], registro);
    },
  } as unknown as SupabaseClient;
  return { client, registro };
}

let seq = 0;
function linha(over: Partial<ChunkParaPontuar> = {}): ChunkParaPontuar {
  seq += 1;
  return {
    id: `r${seq}`,
    nucleo: "sono",
    secao: "TEMA 6 · Os Despertares Noturnos",
    titulo: "TEMA 6 · Os Despertares Noturnos",
    tipo_conhecimento: "estrategia",
    faixa_etaria_min_meses: null,
    faixa_etaria_max_meses: null,
    faixa_rotulo: null,
    situacoes_relacionadas: ["sono"],
    diagnosticos_relacionados: [],
    nivel_de_cautela: "baixo",
    muda_conduta: null,
    texto_original:
      "Mantenha a interação mínima durante o despertar: voz baixa, pouca luz, poucos estímulos.",
    revisao_pendente: false,
    ordem: seq,
    ...over,
  };
}

const ctx = {
  idadeAnos: 5,
  perfil: "TEA",
  dominio: "sono",
  contexto: "sono",
  dificuldade: "acorda de madrugada e não volta a dormir",
  textoDaConversa: "ela acorda toda madrugada",
};

describe("buscarConhecimentosBIA", () => {
  it("filtra ativo e revisão pendente no SQL", async () => {
    const { client, registro } = supabaseFalso([[linha()], [linha()]]);
    await buscarConhecimentosBIA(client, ctx);

    const eqs = registro.filter((c) => c.metodo === "eq").map((c) => c.args);
    expect(eqs).toContainEqual(["ativo", true]);
    expect(eqs).toContainEqual(["revisao_pendente", false]);
  });

  it("manda a faixa etária para o SQL, em meses, tolerando faixa aberta", async () => {
    const { client, registro } = supabaseFalso([[linha()], [linha()]]);
    await buscarConhecimentosBIA(client, { ...ctx, idadeAnos: 5 });

    const ors = registro.filter((c) => c.metodo === "or").map((c) => String(c.args[0]));
    // 5 anos = 60 meses.
    expect(ors.some((o) => o.includes("faixa_etaria_min_meses.lte.60"))).toBe(true);
    expect(ors.some((o) => o.includes("faixa_etaria_max_meses.gte.60"))).toBe(true);
    // Faixa aberta (null) tem que continuar servindo.
    expect(ors.every((o) => o.includes("is.null"))).toBe(true);
  });

  it("sem idade, não filtra faixa etária", async () => {
    const { client, registro } = supabaseFalso([[linha()], [linha()]]);
    await buscarConhecimentosBIA(client, { ...ctx, idadeAnos: null });
    const ors = registro.filter((c) => c.metodo === "or");
    expect(ors).toHaveLength(0);
  });

  it("dispara DUAS consultas — a estruturada e a textual", async () => {
    const { client, registro } = supabaseFalso([[linha()], [linha()]]);
    await buscarConhecimentosBIA(client, ctx);

    expect(registro.filter((c) => c.metodo === "from")).toHaveLength(2);
    expect(registro.some((c) => c.metodo === "in")).toBe(true);
    expect(registro.some((c) => c.metodo === "textSearch")).toBe(true);
  });

  it("usa o dicionário português na busca textual", async () => {
    const { client, registro } = supabaseFalso([[linha()], [linha()]]);
    await buscarConhecimentosBIA(client, ctx);
    const ts = registro.find((c) => c.metodo === "textSearch");
    expect(ts?.args[2]).toEqual({ config: "portuguese", type: "websearch" });
  });

  it("soma os dois conjuntos sem duplicar o mesmo chunk", async () => {
    const a = linha({ id: "mesmo" });
    const b = linha({ id: "outro" });
    // O mesmo chunk aparece nas duas consultas.
    const { client } = supabaseFalso([
      [a, b],
      [a],
    ]);
    const saida = await buscarConhecimentosBIA(client, ctx);
    const ids = saida.map((r) => r.chunk.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("mesmo");
  });

  it("só a consulta textual quando não há domínio", async () => {
    const { client, registro } = supabaseFalso([[linha()]]);
    await buscarConhecimentosBIA(client, { ...ctx, dominio: null });
    expect(registro.filter((c) => c.metodo === "from")).toHaveLength(1);
    expect(registro.some((c) => c.metodo === "textSearch")).toBe(true);
  });

  it("sem domínio E sem texto, não consulta nada — devolver 'os primeiros N' seria ruído", async () => {
    const { client, registro } = supabaseFalso([[linha()]]);
    const saida = await buscarConhecimentosBIA(client, { idadeAnos: 5 });
    expect(registro.filter((c) => c.metodo === "from")).toHaveLength(0);
    expect(saida).toEqual([]);
  });

  it("degrada em silêncio: falha do banco devolve lista vazia, nunca lança", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const client = {
      from: () => {
        throw new Error("conexão caiu");
      },
    } as unknown as SupabaseClient;

    await expect(buscarConhecimentosBIA(client, ctx)).resolves.toEqual([]);
    expect(aviso).toHaveBeenCalled();
    aviso.mockRestore();
  });

  it("tolera arrays nulos vindos do Postgres", async () => {
    const cru = {
      ...linha(),
      situacoes_relacionadas: null,
      diagnosticos_relacionados: null,
    } as unknown as ChunkParaPontuar;
    const { client } = supabaseFalso([[cru], []]);
    await expect(buscarConhecimentosBIA(client, ctx)).resolves.toBeInstanceOf(Array);
  });

  it("cada resultado devolvido carrega os motivos", async () => {
    const { client } = supabaseFalso([[linha()], []]);
    const saida = await buscarConhecimentosBIA(client, ctx);
    expect(saida.length).toBeGreaterThan(0);
    expect(saida[0].motivos.length).toBeGreaterThan(0);
    expect(saida[0].explicacao).toBeTruthy();
  });
});

describe("montarConsultaTexto", () => {
  it("limpa stopwords e monta uma consulta OR", () => {
    const q = montarConsultaTexto({ textoDaConversa: "ela não dorme e acorda muito de madrugada" });
    expect(q).toContain("dorme");
    expect(q).toContain("madrugada");
    expect(q).toContain(" or ");
    // Stopwords ficam de fora.
    expect(q).not.toContain("muito");
  });

  it("devolve null quando não há termo útil", () => {
    expect(montarConsultaTexto({ textoDaConversa: "e o a de" })).toBeNull();
    expect(montarConsultaTexto({})).toBeNull();
  });

  it("limita o número de termos — a conversa inteira casaria com tudo", () => {
    const texto = Array.from({ length: 60 }, (_, i) => `palavra${i}`).join(" ");
    const q = montarConsultaTexto({ textoDaConversa: texto });
    expect(q!.split(" or ")).toHaveLength(12);
  });
});
