import { describe, expect, it } from "vitest";
import { fetchReportData } from "./data";
import { PERFIL_MEMBRO_SELECT } from "@/lib/kolo-vivo/leitura";

/**
 * O RELATÓRIO PARA ESCOLA E TERAPEUTA.
 *
 * Até 31/07 esta camada pedia ao banco só as 5 colunas dedicadas e nem
 * carregava `categorias_extras`: o documento que a mãe leva para a reunião da
 * escola era cego para `aprendizado` e `escola` — as duas coisas que a reunião
 * mais precisa —, tendo a informação no banco.
 *
 * Nada aqui testa redação nem layout. Testa que o dado CHEGA.
 */

type Linha = Record<string, unknown>;

/** Supabase falso: devolve por tabela e registra o `select` de cada consulta. */
function bancoFalso(porTabela: Record<string, Linha | Linha[] | null>) {
  const selects: Record<string, string> = {};
  const client = {
    from: (tabela: string) => {
      const api: Record<string, unknown> = {
        select: (cols: string) => {
          selects[tabela] = cols;
          return api;
        },
        eq: () => api,
        gte: () => api,
        order: () => api,
        limit: async () => ({ data: porTabela[tabela] ?? [], error: null }),
        in: async () => ({ data: porTabela[tabela] ?? [], error: null }),
        maybeSingle: async () => ({ data: porTabela[tabela] ?? null, error: null }),
        single: async () => ({ data: porTabela[tabela] ?? null, error: null }),
        then: (r: (v: unknown) => unknown) => r({ data: porTabela[tabela] ?? [], error: null }),
      };
      return api;
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { client: client as any, selects };
}

const MEMBRO = {
  nome: "Pedro",
  data_nascimento: "2019-04-02",
  perfil: "TEA",
  diagnosticos_formais: null,
  family_account_id: "fam-1",
};

const PERFIL = {
  essencial: { texto: "gosta de rotina previsível" },
  como_e: { interesses: ["trem", "dinossauro"] },
  corpo_rotina: { texto: "acorda cedo" },
  desafios_regulacao: { texto: "desregula com barulho" },
  sensorial: { texto: "foge de secador" },
  categorias_extras: {
    aprendizado: { texto: "aprende vendo antes de fazer; não generaliza sozinho" },
    escola: { texto: "professora nova em julho, sem adaptação" },
    comunicacao: { texto: "frases de três palavras" },
    autonomia: { texto: "come sozinho" },
    emocional: { texto: "chora quando muda o combinado" },
    gostos: { texto: "adora água" },
    saude_geral: { texto: "acompanhamento com neuropediatra" },
  },
};

const opcoes = (destinatario: "escola" | "terapeuta") => ({
  membroAtipicoId: "m-1",
  destinatario,
  janelaMeses: 3 as const,
  includeCamadaB: false,
  includeDass21: false,
});

async function relatorio(destinatario: "escola" | "terapeuta", perfil: Linha | null = PERFIL) {
  const b = bancoFalso({
    membros_atipicos: MEMBRO,
    perfil_vivo_membro: perfil,
    perfil_vivo_familia: null,
    diarios: [],
    mensagens_skill: [],
  });
  const data = await fetchReportData(b.client, opcoes(destinatario));
  return { data, selects: b.selects };
}

describe("o relatório carrega o perfil inteiro", () => {
  it("pede ao banco a seleção canônica, com categorias_extras", async () => {
    const { selects } = await relatorio("escola");
    expect(selects.perfil_vivo_membro).toBe(PERFIL_MEMBRO_SELECT);
    expect(selects.perfil_vivo_membro).toContain("categorias_extras");
  });

  it("aprendizado e escola ficam disponíveis — era o defeito", async () => {
    const { data } = await relatorio("escola");
    expect(data?.koloVivo.dominios.aprendizado).toContain("não generaliza sozinho");
    expect(data?.koloVivo.dominios.escola).toContain("professora nova em julho");
  });

  it("os domínios vindos de categorias_extras chegam", async () => {
    const { data } = await relatorio("escola");
    for (const campo of ["comunicacao", "autonomia", "emocional", "gostos"]) {
      expect(data?.koloVivo.dominios[campo], `${campo} não chegou`).toBeTruthy();
    }
  });

  it("as 5 colunas dedicadas continuam preenchidas, sem mudar de nome", async () => {
    const { data } = await relatorio("escola");
    expect(data?.koloVivo.essencial).toBe("gosta de rotina previsível");
    expect(data?.koloVivo.corpo_rotina).toBe("acorda cedo");
    expect(data?.koloVivo.desafios_regulacao).toBe("desregula com barulho");
    expect(data?.koloVivo.sensorial).toBe("foge de secador");
    // Onboarding: `extractTexto` lia só `.texto` e perdia os interesses.
    expect(data?.koloVivo.como_e).toBe("trem, dinossauro");
  });

  it("perfil vazio continua seguro — nada de undefined vazando", async () => {
    const { data } = await relatorio("escola", null);
    expect(data).not.toBeNull();
    expect(data?.koloVivo.dominios).toEqual({});
    expect(data?.koloVivo.essencial).toBe("");
    expect(data?.koloVivo.sensorial).toBe("");
  });
});

describe("saúde não vai para a escola", () => {
  it("a escola NÃO recebe saude_geral", async () => {
    const { data } = await relatorio("escola");
    // Corrigir a seleção de colunas não pode mandar histórico clínico da
    // criança para uma reunião escolar como efeito colateral.
    expect(data?.koloVivo.dominios.saude_geral).toBeUndefined();
    expect(JSON.stringify(data?.koloVivo)).not.toContain("neuropediatra");
  });

  it("o terapeuta recebe", async () => {
    const { data } = await relatorio("terapeuta");
    expect(data?.koloVivo.dominios.saude_geral).toContain("neuropediatra");
  });

  it("o resto do perfil chega igual nos dois destinos", async () => {
    const escola = (await relatorio("escola")).data;
    const terapeuta = (await relatorio("terapeuta")).data;
    for (const campo of ["aprendizado", "escola", "comunicacao", "gostos"]) {
      expect(escola?.koloVivo.dominios[campo]).toBe(terapeuta?.koloVivo.dominios[campo]);
    }
  });
});
