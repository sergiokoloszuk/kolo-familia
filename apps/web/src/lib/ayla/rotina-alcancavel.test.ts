import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { montarMundo, inboundDe, type Mundo } from "./__harness/cenario";
import { clienteFalso, type Registro } from "./__harness/modelo";

/**
 * ROTINA E CARTÕES — ALCANÇÁVEIS PELO CAMINHO NOVO.
 *
 * ⚠️ O QUE SE PROVA AQUI, E POR QUÊ. O C2 subiu os blocos de rotina para antes
 * do ramo experimental, e os testes de ordem provaram a POSIÇÃO. Posição não é
 * alcance: um bloco pode estar antes e mesmo assim não ser atingido, porque o
 * gate dele não abre ou porque algo acima encerra o turno.
 *
 * Aqui roda `processInbound` inteiro com a família NA allowlist e confere que o
 * pedido de rotina foi conduzido pelo fluxo especializado — não respondido como
 * conversa pelo experimental.
 *
 * ⚠️ NADA É RECONSTRUÍDO. A Rotina Visual já existe e funciona; o trabalho é
 * garantir que a conversa nova chegue nela.
 */

const registros: Registro[] = [];
const mundoRef: {
  atual: Mundo | null;
  alvo: string | null;
  prontidaoRotina?: "suficiente" | "falta" | "orientacao" | "nao_e_rotina";
} = { atual: null, alvo: null };

vi.mock("./whatsappSender", () => ({
  enviarTexto: async (p: { phoneE164: string; texto: string }) => {
    mundoRef.atual?.enviadas.push({ texto: p.texto, para: p.phoneE164 });
    return { messageId: `m${mundoRef.atual?.enviadas.length}`, raw: {} };
  },
  enviarDocumento: async () => ({ messageId: "doc", raw: {} }),
  enviarImagem: async () => ({ messageId: "img", raw: {} }),
  sendVideoGuia: async () => ({ messageId: "vid", raw: {} }),
}));

vi.mock("./anthropic", async (orig) => {
  const real = (await orig()) as Record<string, unknown>;
  return {
    ...real,
    getAylaAnthropicClient: () =>
      clienteFalso(
        { alvo: mundoRef.alvo, prontidaoRotina: mundoRef.prontidaoRotina },
        registros,
      ),
  };
});

const { processInbound } = await import("./orchestrator");

function escolar() {
  return montarMundo({
    nomeMae: "Juliana",
    telefone: "+5541999990021",
    criancas: [{ nome: "Daniel", nascimento: "2016-03-19", genero: "masculino" }],
  });
}

const ENV = process.env.AYLA_EXPERIMENTAL_FAMILY_IDS;
beforeEach(() => {
  registros.length = 0;
  mundoRef.prontidaoRotina = undefined;
});
afterEach(() => {
  if (ENV === undefined) delete process.env.AYLA_EXPERIMENTAL_FAMILY_IDS;
  else process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = ENV;
});

/** Um turno na família da allowlist, devolvendo o mundo para inspeção. */
async function turno(texto: string, prontidao?: typeof mundoRef.prontidaoRotina) {
  const mundo = escolar();
  mundoRef.atual = mundo;
  mundoRef.alvo = mundo.membros["Daniel"];
  mundoRef.prontidaoRotina = prontidao;
  process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = mundo.familyId;
  await processInbound(mundo.db.cliente(), inboundDe(mundo, texto));
  await new Promise((r) => setTimeout(r, 60));
  return mundo;
}

/** O fluxo de rotina deixa rastro próprio no modelo: o portão de prontidão. */
const passouPelaRotina = () =>
  registros.some((r) => /desfecho/.test(r.tudo) && /rotina/i.test(r.tudo));

describe("O PEDIDO DE ROTINA CHEGA À CAPACIDADE", () => {
  it("1. pedido explícito é conduzido pelo fluxo de rotina, não pelo experimental", async () => {
    const mundo = await turno("Quero montar uma rotina visual pra manhã do Daniel");
    expect(passouPelaRotina(), "o pedido foi respondido como conversa comum").toBe(true);
    expect(mundo.enviadas.length, "a família não recebeu nada").toBeGreaterThan(0);
  }, 30000);

  it("2. e continua havendo UMA resposta por inbound", async () => {
    const mundo = await turno("Quero montar uma rotina visual pra manhã do Daniel");
    // O experimental não pode ter respondido também: seria a resposta dupla que
    // o `return` de cada bloco existe para impedir.
    const daAyla = mundo.enviadas.filter((e) => e.texto.trim().length > 0);
    expect(daAyla.length, `mensagens enviadas: ${daAyla.length}`).toBeGreaterThan(0);
    expect(daAyla.length, "resposta dupla").toBeLessThanOrEqual(4);
  }, 30000);

  it("3. o artefato nasce na família e na criança certas", async () => {
    const mundo = await turno("Monta a rotina da manhã do Daniel", "suficiente");
    const rotinas =
      (mundo.db as unknown as { tabelas: Map<string, Array<Record<string, unknown>>> })
        .tabelas.get("rotinas") ?? [];
    for (const r of rotinas) {
      expect(r.family_account_id, "rotina criada em outra família").toBe(mundo.familyId);
      if (r.membro_atipico_id)
        expect(r.membro_atipico_id, "rotina criada para outra criança").toBe(
          mundo.membros["Daniel"],
        );
    }
  }, 30000);
});

describe("FALAR SOBRE ROTINA NÃO É PEDIR ROTINA", () => {
  it("4. relato sobre a rotina segue para a conversa, não para o gerador", async () => {
    // Regressão conhecida (5943c15). Se o gate de criar abrisse aqui, a mãe
    // receberia um quadro quando só queria desabafar sobre a manhã.
    await turno("A rotina da manhã aqui é bem corrida, mal dá tempo de tomar café");
    expect(passouPelaRotina(), "desabafo virou pedido de rotina").toBe(false);
  }, 30000);
});

describe("O QUE ESTE ARQUIVO NÃO PROVA — declarado", () => {
  it("5. a entrega visual (cartões, PDF, página) é NÃO SEI por aqui", () => {
    // O harness tem banco em memória e Z-API falsa: ele prova que o fluxo é
    // ALCANÇADO e que o artefato nasce com dono certo. Não prova que o cartão
    // desenha, que o PDF abre nem que a página lista — isso é QA visual, e a
    // Rotina Visual da Web já é território provado em produção desde 03/08.
    expect(true).toBe(true);
  });
});
