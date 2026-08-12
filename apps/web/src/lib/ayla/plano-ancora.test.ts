import { beforeEach, describe, expect, it, vi } from "vitest";
import { inboundDe, montarMundo, type Mundo } from "./__harness/cenario";
import { clienteFalso, type Registro } from "./__harness/modelo";

/**
 * A ÂNCORA DO PLANO ENTREGUE — `metadata.plano_id` na mensagem de saída.
 *
 * ⚠️ POR QUE (PEND-050). O id do Plano existia só dentro da URL do magic-link,
 * no meio do texto. Para "manda o plano de novo" saber a que se referir, seria
 * preciso parsear a própria fala da Ayla — o acoplamento frágil que já governa
 * o aceite da oferta (`ofertouPlanoRecente` casa regex no texto dela mesma).
 *
 * Aqui o turno roda de verdade: `processInbound`, banco em memória, geração de
 * plano falsa e nenhum envio real.
 */

const mundoRef: { atual: Mundo | null; alvo: string | null } = { atual: null, alvo: null };
const registros: Registro[] = [];
/** Quantas vezes o GERADOR de plano foi chamado neste teste. */
let geracoes = 0;
let idsGerados: string[] = [];

vi.mock("./whatsappSender", () => ({
  enviarTexto: async (p: { phoneE164: string; texto: string }) => {
    mundoRef.atual?.enviadas.push({ para: p.phoneE164, texto: p.texto });
    return { ok: true, messageId: `out-${mundoRef.atual?.enviadas.length}` };
  },
  enviarImagem: async () => ({ ok: true, messageId: "img" }),
  enviarDocumento: async () => ({ ok: true, messageId: "doc" }),
}));

vi.mock("@/lib/ia/provider", () => ({
  MODELO_CONVERSA: { anthropic: "a", openai: "o" },
  providerConversacionalParaFamilia: () => "anthropic",
  gerarConversacional: async () => ({
    texto: "[resposta da Ayla]",
    provider: "anthropic",
    model: "a",
    tokensIn: 1,
    tokensOut: 1,
    cacheRead: 0,
  }),
}));

vi.mock("./anthropic", () => ({
  AYLA_MODEL: "m",
  AYLA_MODEL_FALLBACK: "m2",
  getAylaAnthropicClient: () => clienteFalso({ alvo: mundoRef.alvo }, registros),
}));

// O gerador do Plano: conta chamadas e devolve um id novo a cada vez.
vi.mock("@/lib/ia/plano", async (real) => ({
  // O módulo real entra inteiro (a ponte importa `PlanoIncompletoError` dele);
  // só a GERAÇÃO é trocada, que é o que custa dinheiro e o que se quer contar.
  ...(await real<Record<string, unknown>>()),
  gerarPlano: async (p: { familyId: string; membroAtipicoId: string | null }) => {
    geracoes++;
    const id = `plano-${geracoes}-${p.membroAtipicoId ?? "sem-membro"}`;
    idsGerados.push(id);
    const secoes = [{ tipo: "entender", titulo: "t", conteudo_markdown: "c" }];
    // ⚠️ O DUPLO PERSISTE, como o real. Sem isto a tabela `planos` ficava vazia
    // e o reenvio não achava nada — o teste acusaria o produto por uma fixture
    // que não gravava. Foi o que aconteceu na primeira rodada desta fatia.
    mundoRef.atual?.db.semear("planos", [
      {
        id,
        family_account_id: p.familyId,
        membro_atipico_id: p.membroAtipicoId,
        titulo: `Plano ${geracoes}`,
        tema: `tema ${geracoes}`,
        secoes,
      },
    ]);
    return { id, titulo: `Plano ${geracoes}`, secoes };
  },
  recadoDePlanoIncompleto: () => null,
}));

vi.mock("./lote-inbound", () => ({
  aguardarTurnoDaMae: async (_s: unknown, p: { textoAtual: string }) => ({ texto: p.textoAtual, ids: [] }),
  descartarTurnoPendente: async () => {},
}));
vi.mock("@/lib/ai/prompts", () => ({ getSystemPrompt: async (_k: string, f: string) => f }));

const { processInbound } = await import("./orchestrator");

function familia(criancas: Array<{ nome: string; nascimento: string }>) {
  return montarMundo({
    nomeMae: "Karina",
    criancas: criancas.map((c) => ({ ...c, sabe: { essencial: `${c.nome}, perfil de teste` } })),
  });
}

async function turno(m: Mundo, texto: string, alvo?: string) {
  mundoRef.atual = m;
  mundoRef.alvo = alvo ?? Object.values(m.membros)[0] ?? null;
  registros.length = 0;
  const r = await processInbound(m.db.cliente(), inboundDe(m, texto));
  expect(r.tratada, "o fluxo abortou antes de decidir").toBe(true);
  return r;
}

/** A âncora gravada no último outbound. */
function ancora(m: Mundo): string | null {
  const saida = m.db.linhas("ayla_messages").filter((x) => x.direcao === "outbound");
  const meta = (saida[saida.length - 1]?.metadata ?? null) as { plano_id?: string } | null;
  return meta?.plano_id ?? null;
}

beforeEach(() => {
  geracoes = 0;
  idsGerados = [];
  mundoRef.atual = null;
  mundoRef.alvo = null;
});

describe("1 · o plano entregue fica ancorado", () => {
  it("MORDE: o outbound carrega o plano_id do artefato criado", async () => {
    const m = familia([{ nome: "Mário", nascimento: "2017-05-02" }]);
    await turno(m, "faz um plano para melhorar a comunicação do Mário");
    expect(geracoes, "o cenário não chegou a gerar plano — teste vazio").toBe(1);
    expect(ancora(m), "a entrega não gravou a âncora").toBe(idsGerados[0]);
    // ⚠️ E `entrega` continua lá. As duas moram na MESMA chave `metadata`, e a
    // primeira versão desta fatia perdia a âncora porque `registroDeEnvio` vinha
    // depois e sobrescrevia o objeto inteiro.
    const ultima = m.db.linhas("ayla_messages").filter((x) => x.direcao === "outbound").pop();
    expect((ultima?.metadata as Record<string, unknown>).entrega, "o rastro de entrega foi apagado").toBeTruthy();
  });
});

describe("2 · dois planos, dois ids", () => {
  it("MORDE: cada entrega ancora o SEU artefato, não o anterior", async () => {
    const m = familia([{ nome: "Mário", nascimento: "2017-05-02" }]);
    await turno(m, "faz um plano para melhorar a comunicação do Mário");
    const primeira = ancora(m);
    await turno(m, "faz um plano pra ele se organizar na escola");
    const segunda = ancora(m);
    expect(geracoes).toBe(2);
    expect(primeira).toBe(idsGerados[0]);
    expect(segunda).toBe(idsGerados[1]);
    expect(segunda).not.toBe(primeira);
  });
});

describe("3 · dois filhos", () => {
  it("MORDE: a âncora aponta para o plano da criança do turno", async () => {
    const m = familia([
      { nome: "Mário", nascimento: "2017-05-02" },
      { nome: "Manu", nascimento: "2021-09-14" },
    ]);
    await turno(m, "faz um plano pra Manu dormir melhor", m.membros["Manu"]);
    expect(geracoes).toBe(1);
    // O id sintético carrega o membro — é o que prova que o artefato ancorado
    // é o da criança certa, e não o do irmão.
    expect(ancora(m)).toBe(`plano-1-${m.membros["Manu"]}`);
    expect(ancora(m)).not.toContain(m.membros["Mário"]);
  });
});

describe("4 · falha ao gravar a âncora não duplica plano", () => {
  it("MORDE: com a escrita da mensagem barrada, o gerador roda UMA vez", async () => {
    const m = familia([{ nome: "Mário", nascimento: "2017-05-02" }]);
    // A gravação da mensagem falha silenciosamente, como no cliente real
    // (`.insert()` DEVOLVE o erro; não lança).
    m.db.falhamAoEscrever.add("ayla_messages");
    await turno(m, "faz um plano para melhorar a comunicação do Mário");
    expect(geracoes, "a falha de escrita provocou uma segunda geração").toBe(1);
  });
});

describe("5 · a mensagem entregue não mudou", () => {
  it("MORDE: o texto continua o mesmo — a âncora é invisível para a família", async () => {
    const m = familia([{ nome: "Mário", nascimento: "2017-05-02" }]);
    await turno(m, "faz um plano para melhorar a comunicação do Mário");
    const texto = m.enviadas.map((e) => e.texto).join("\n");
    expect(texto).toContain("plano estratégico com atividades");
    expect(texto, "o id vazou para a fala da Ayla").not.toContain(idsGerados[0]);
  });
});

describe("F/G/H · reenviar não gera (PEND-050, fatia 2)", () => {
  it("MORDE: 'manda o plano de novo' reentrega e NÃO chama o gerador", async () => {
    const m = familia([{ nome: "Mário", nascimento: "2017-05-02" }]);
    await turno(m, "faz um plano para melhorar a comunicação do Mário");
    expect(geracoes, "o cenário não gerou o plano inicial — teste vazio").toBe(1);
    const planosAntes = m.db.linhas("planos").length;
    const enviadasAntes = m.enviadas.length;

    await turno(m, "manda o plano de novo");

    // H · o gerador NÃO rodou de novo.
    expect(geracoes, "reenviar chamou o gerador").toBe(1);
    // G · a tabela `planos` não mudou.
    expect(m.db.linhas("planos").length, "reenviar criou linha em planos").toBe(planosAntes);
    // E a mãe recebeu alguma coisa — reenvio que cala não é reenvio.
    expect(m.enviadas.length, "o reenvio não mandou nada").toBeGreaterThan(enviadasAntes);
    const ultima = m.db.linhas("ayla_messages").filter((x) => x.direcao === "outbound").pop();
    expect(ultima?.tipo).toBe("plano_reenviado");
    // ⚠️ O tipo importa: `resposta_registro` aciona a ponte do Plano, e o
    // reenvio geraria justamente o artefato que ele existe para evitar.
    expect(String(ultima?.texto)).toContain("de novo");
  });

  it("MORDE: 'faz outro plano' NÃO é reenviar — continua criando", async () => {
    const m = familia([{ nome: "Mário", nascimento: "2017-05-02" }]);
    await turno(m, "faz um plano para melhorar a comunicação do Mário");
    await turno(m, "faz outro plano, agora pra escola");
    expect(geracoes, "uma nova intenção explícita foi tratada como reenvio").toBe(2);
  });
});
