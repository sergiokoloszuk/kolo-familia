import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { montarMundo } from "./__harness/cenario";
import { esquecerCacheDeDocumentos } from "./documentos";

const systems: string[] = [];
vi.mock("@/lib/ia/provider", () => ({
  MODELO_CONVERSA: { openai: "modelo-teste" },
  gerarConversacional: async (p: { system: string }) => {
    systems.push(p.system);
    return { texto: JSON.stringify({ fala: "Podemos explorar juntas esta área.", campo_investigado: null,
      aprofundamentos: ["aprofundar_lidar", "aprofundar_brincar"] }),
      provider: "openai", model: "modelo-teste", tokensIn: 1, tokensOut: 1, cacheRead: 0, cacheWrite: 0, ms: 1 };
  },
}));
vi.mock("@/lib/billing/logar", () => ({ logarUsoApi: async () => {} }));
vi.mock("@/lib/log", () => ({ logEvent: async () => {} }));
import { responderExperimental } from "./experimental";

const anterior = process.env.AYLA_QUALIDADE_RESPOSTA_V2;
beforeEach(() => { systems.length = 0; esquecerCacheDeDocumentos(); process.env.AYLA_QUALIDADE_RESPOSTA_V2 = "on"; });
afterEach(() => { if (anterior == null) delete process.env.AYLA_QUALIDADE_RESPOSTA_V2; else process.env.AYLA_QUALIDADE_RESPOSTA_V2 = anterior; });

async function rodar(mensagem: string, intencao = "outro") {
  const inicio = systems.length;
  const mundo = montarMundo({ nomeMae: "Ana", criancas: [{ nome: "Isabela", nascimento: "2007-12-25", genero: "feminino",
    extras: { foco: "Mantém atenção quando está engajada; às vezes se distrai." } }] });
  const r = await responderExperimental(mundo.db.cliente(), { familyId: mundo.familyId,
    membroPreferidoId: mundo.membros.Isabela, mensagem, origem: "simulador",
    turnoClassificado: { intencao, tema: "foco", aceite: null, skills: ["foco"], skillsAvaliadas: true } });
  expect(r).not.toBeNull();
  return { system: systems[inicio], resposta: r! };
}

describe("abertura temática no produtor oficial, sem envio", () => {
  it("preserva texto livre conhecido e remove a ordem concorrente de investigar lacuna", async () => {
    const r = await rodar("Quero explorar Atenção e Concentração.");
    expect(r.system).toContain("Mantém atenção quando está engajada");
    expect(r.system).toContain("<abertura_de_area>");
    expect(r.system).toContain("quatro caminhos em bullets");
    expect(r.system).not.toContain("<lacuna_decisiva>");
    expect(r.resposta.decisaoLacuna).toBeNull();
    expect(r.resposta.miniInvestigacao?.acao).toBe("NAO_USAR");
  });
  it("caso concreto continua no mecanismo de lacunas, sem nota de apresentação", async () => {
    const r = await rodar("Não consegue começar a tarefa, como ajudo?");
    expect(r.system).not.toContain("<abertura_de_area>");
    expect(r.resposta.decisaoLacuna).not.toBeNull();
  });
  it("candidata oferece na fala e impede segunda oferta legada mesmo com envelope indevido", async () => {
    const r = await rodar("Como ajudo a começar a tarefa?");
    expect(r.system).toContain('"aprofundamentos" — devolva []');
    expect(r.system).not.toContain('Nunca altere "fala" para anunciar menu');
    expect(r.resposta.aprofundamentos).toEqual([]);
    process.env.AYLA_QUALIDADE_RESPOSTA_V2 = "off";
    const publicado = await rodar("Como ajudo a começar a tarefa?");
    expect(publicado.system).toContain('Nunca altere "fala" para anunciar menu');
    expect(publicado.resposta.aprofundamentos).toEqual(["aprofundar_lidar", "aprofundar_brincar"]);
  });
  it("flag off conserva o contrato publicado da brincadeira, sem o novo roteiro", async () => {
    process.env.AYLA_QUALIDADE_RESPOSTA_V2 = "off";
    const publicado = await rodar("Quero uma brincadeira agora.");
    expect(publicado.system).toContain("um único bloco executável");
    expect(publicado.system).not.toContain("Apresente um nome criativo real em negrito");
    process.env.AYLA_QUALIDADE_RESPOSTA_V2 = "on";
    const candidata = await rodar("Quero uma brincadeira agora.");
    expect(candidata.system).toContain("Apresente um nome criativo real em negrito");
    expect(candidata.system).not.toContain("um único bloco executável");
  });
  it("flag off e crise preservam o caminho anterior", async () => {
    process.env.AYLA_QUALIDADE_RESPOSTA_V2 = "off";
    expect((await rodar("Quero explorar Atenção e Concentração.")).system).not.toContain("<abertura_de_area>");
    process.env.AYLA_QUALIDADE_RESPOSTA_V2 = "on";
    expect((await rodar("Quero explorar Atenção e Concentração.", "crise")).system).not.toContain("<abertura_de_area>");
  });
});
