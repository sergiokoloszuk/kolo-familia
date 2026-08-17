import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  montarMundo,
  inboundDe,
  passouPeloExperimental,
  type Mundo,
} from "./__harness/cenario";
import { clienteFalso, type Registro } from "./__harness/modelo";

/**
 * O PERFIL DA FAMÍLIA CHEGA AO MODELO — provado pelo turno, não pelo commit.
 *
 * ⚠️ POR QUE ESTE ARQUIVO NASCEU (PEND-072, 15/08/2026). O commit `42a66e2`
 * afirma "o perfil da FAMILIA chega ao caminho novo". A auditoria procurou a
 * prova e **não existia nenhuma**: `lerPerfilFamilia` e `blocoDaFamilia` não
 * eram citados por nenhum teste do repositório. Presença de código não é prova
 * de execução — e uma leitura acessória que falha em silêncio é exatamente o
 * tipo de coisa que morre sem ninguém notar.
 *
 * Aqui a linha é semeada em `perfil_vivo_familia`, o turno roda inteiro, e a
 * asserção é sobre o SYSTEM que chegou ao produtor.
 */

const registros: Registro[] = [];
const mundoRef: { atual: Mundo | null; alvo: string | null } = { atual: null, alvo: null };
/** Todo system que o produtor recebeu neste turno — a prova de injeção. */
const systems: string[] = [];

vi.mock("./whatsappSender", () => ({
  enviarTexto: async (p: { phoneE164: string; texto: string }) => {
    mundoRef.atual?.enviadas.push({ texto: p.texto, para: p.phoneE164 });
    return { messageId: "m", raw: {} };
  },
  enviarDocumento: async () => ({ messageId: "doc", raw: {} }),
  enviarImagem: async () => ({ messageId: "img", raw: {} }),
  sendVideoGuia: async () => ({ messageId: "vid", raw: {} }),
  parseZapiWebhook: () => null,
}));

vi.mock("@/lib/ia/provider", () => ({
  MODELO_CONVERSA: { anthropic: "claude-sonnet-4-6", openai: "gpt-5.6-luna" },
  providerConversacionalParaFamilia: () => "openai",
  gerarConversacional: async (p: { system?: string }) => {
    systems.push(String(p.system ?? ""));
    return {
      texto: "[resposta da Ayla experimental]",
      provider: "openai",
      model: "gpt-5.6-luna",
      tokensIn: 100,
      tokensOut: 20,
      cacheRead: 0,
      cacheWrite: 0,
      ms: 1,
    };
  },
}));

vi.mock("./anthropic", async (orig) => {
  const real = (await orig()) as Record<string, unknown>;
  return { ...real, getAylaAnthropicClient: () => clienteFalso({ alvo: mundoRef.alvo }, registros) };
});

const { processInbound } = await import("./orchestrator");

const ENV = process.env.AYLA_EXPERIMENTAL_FAMILY_IDS;
beforeEach(() => {
  registros.length = 0;
  systems.length = 0;
});
afterEach(() => {
  if (ENV === undefined) delete process.env.AYLA_EXPERIMENTAL_FAMILY_IDS;
  else process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = ENV;
});

function familia() {
  return montarMundo({
    nomeMae: "Renata",
    telefone: "+5541999990044",
    criancas: [{ nome: "Bento", nascimento: "2017-08-02", genero: "masculino" }],
  });
}

/** A casa, do jeito que o onboarding grava: jsonb por seção. */
function semearCasa(mundo: Mundo, extra?: Record<string, unknown>) {
  mundo.db.semear("perfil_vivo_familia", [
    {
      family_account_id: mundo.familyId,
      composicao: { texto: "mãe, pai e dois filhos, moram os quatro juntos" },
      rotina: { texto: "a mãe trabalha fora até as 18h e a avó busca na escola" },
      recursos: { texto: "terapia ocupacional uma vez por semana" },
      dinamica: { texto: "o pai viaja a trabalho a cada quinze dias" },
      categorias_extras: {},
      ...(extra ?? {}),
    },
  ]);
}

async function turno(mundo: Mundo, texto: string) {
  mundoRef.atual = mundo;
  mundoRef.alvo = mundo.membros["Bento"];
  process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = mundo.familyId;
  await processInbound(mundo.db.cliente(), inboundDe(mundo, texto));
  await new Promise((r) => setTimeout(r, 50));
}

describe("A CASA CHEGA AO MODELO", () => {
  it("0. o turno roda pelo motor novo", async () => {
    const mundo = familia();
    semearCasa(mundo);
    await turno(mundo, "Oi, tudo bem?");
    expect(passouPeloExperimental(mundo), "o turno caiu para o Legacy").toBe(true);
  }, 30000);

  it("1. o bloco da família entra no system, com o conteúdo real da linha", async () => {
    const mundo = familia();
    semearCasa(mundo);
    await turno(mundo, "O Bento tá difícil na hora de sair de casa");

    const sys = systems.join("\n");
    expect(sys, "o bloco da casa não chegou ao modelo").toContain("<a_familia>");
    // Não basta a etiqueta: o conteúdo tem que estar lá. Uma tag vazia passaria
    // por uma asserção de tag e não levaria informação nenhuma.
    expect(sys).toContain("a avó busca na escola");
    expect(sys).toContain("terapia ocupacional");
  }, 30000);

  it("2. sem linha de família, o bloco não aparece — e o turno não quebra", async () => {
    const mundo = familia();
    await turno(mundo, "O Bento tá difícil na hora de sair de casa");

    expect(systems.join("\n"), "bloco vazio foi injetado à toa").not.toContain("<a_familia>");
    expect(mundo.enviadas.length, "a família ficou sem resposta").toBeGreaterThan(0);
  }, 30000);

  it("3. placeholder não vira fato da casa", async () => {
    const mundo = familia();
    // O filtro `pareceInformacao` existe por causa do caso real do André
    // ("btbrtbtbtb"). Se ele parasse de valer para a casa, a Ayla trataria
    // "aaaa" como composição familiar.
    semearCasa(mundo, { composicao: { texto: "aaaa" }, rotina: { texto: "não sei" } });
    await turno(mundo, "O Bento tá difícil na hora de sair de casa");

    const sys = systems.join("\n");
    expect(sys).not.toContain("aaaa");
    expect(sys).not.toMatch(/quem mora na casa: não sei/i);
  }, 30000);

  it("4. a casa de uma família não vaza para outra", async () => {
    const a = familia();
    semearCasa(a);
    const b = familia();

    // O turno é da família B, que não tem casa cadastrada.
    await turno(b, "O Bento tá difícil na hora de sair de casa");
    const sys = systems.join("\n");
    expect(sys, "a casa da família A apareceu no turno da B").not.toContain(
      "a avó busca na escola",
    );
  }, 30000);
});
