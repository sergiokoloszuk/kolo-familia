import { describe, expect, it } from "vitest";
import { carregarFichaFamilia } from "./ficha";
import { PERFIL_MEMBRO_SELECT } from "@/lib/kolo-vivo/leitura";

/**
 * A FICHA DO CRM.
 *
 * Mesmo defeito do relatório: pedia ao banco só as 5 colunas dedicadas e tinha
 * o seu próprio mapa de rótulos, então mostrava 5 dos 20 domínios — quem olhava
 * a ficha via um perfil quase vazio de uma família que tinha contado muito.
 *
 * Não testa layout nem métrica do CRM: testa que o dado chega.
 */

type Linha = Record<string, unknown>;

function bancoFalso(porTabela: Record<string, Linha | Linha[] | null>) {
  const selects: Record<string, string> = {};
  const client = {
    from: (tabela: string) => {
      const dado = porTabela[tabela] ?? [];
      const api: Record<string, unknown> = {
        select: (cols: string) => {
          selects[tabela] = cols;
          return api;
        },
        eq: () => api,
        in: () => api,
        gte: () => api,
        order: () => api,
        limit: () => api,
        maybeSingle: async () => ({ data: Array.isArray(dado) ? (dado[0] ?? null) : dado, error: null }),
        single: async () => ({ data: Array.isArray(dado) ? (dado[0] ?? null) : dado, error: null }),
        then: (r: (v: unknown) => unknown) => r({ data: dado, error: null }),
      };
      return api;
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { client: client as any, selects };
}

const PERFIL_COM_TUDO = {
  membro_atipico_id: "m-1",
  essencial: { texto: "gosta de rotina previsível" },
  como_e: { interesses: ["trem"] },
  sensorial: { texto: "foge de secador" },
  categorias_extras: {
    aprendizado: { texto: "aprende vendo antes de fazer" },
    escola: { texto: "professora nova em julho" },
    comunicacao: { texto: "frases de três palavras" },
    sono: { texto: "acorda de madrugada" },
    gostos: { texto: "adora água" },
  },
};

async function ficha(perfis: Linha[] | null = [PERFIL_COM_TUDO]) {
  const b = bancoFalso({
    profiles: [{ como_chamar: "Ana", nome_mae: "Ana" }],
    membros_atipicos: [{ id: "m-1", nome: "Pedro", perfil: "TEA", data_nascimento: "2019-04-02" }],
    perfil_vivo_membro: perfis,
  });
  return { f: await carregarFichaFamilia(b.client, "fam-1"), selects: b.selects };
}

describe("a ficha enxerga os 20 domínios", () => {
  it("pede a seleção canônica, com categorias_extras", async () => {
    const { selects } = await ficha();
    expect(selects.perfil_vivo_membro).toBe(PERFIL_MEMBRO_SELECT);
  });

  it("os domínios que estavam invisíveis aparecem", async () => {
    const { f } = await ficha();
    const porCampo = Object.fromEntries(f.koloVivo.conteudo.map((c) => [c.campo, c.texto]));
    expect(porCampo["Aprendizado"]).toContain("aprende vendo");
    expect(porCampo["Escola"]).toContain("professora nova");
    expect(porCampo["Comunicação"]).toBeTruthy();
    expect(porCampo["Sono"]).toBeTruthy();
    expect(porCampo["Gostos e interesses"]).toBeTruthy();
  });

  it("as 5 colunas dedicadas continuam aparecendo", async () => {
    const { f } = await ficha();
    expect(f.koloVivo.campos).toContain("O essencial");
    expect(f.koloVivo.campos).toContain("Sensorial");
    // Onboarding conta: antes só `.texto` era lido.
    expect(f.koloVivo.campos).toContain("Como é / interesses");
  });

  it("perfil vazio continua seguro", async () => {
    const { f } = await ficha([]);
    expect(f.koloVivo.campos).toEqual([]);
    expect(f.koloVivo.conteudo).toEqual([]);
  });

  it("domínio sem texto não vira linha vazia", async () => {
    const { f } = await ficha([
      { membro_atipico_id: "m-1", categorias_extras: { sono: { atualizado_em: "2026-07-31" } } },
    ]);
    expect(f.koloVivo.conteudo).toEqual([]);
  });
});
