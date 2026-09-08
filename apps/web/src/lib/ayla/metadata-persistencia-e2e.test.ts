import { beforeEach, describe, expect, it, vi } from "vitest";
import { inboundDe, montarMundo, type Mundo } from "./__harness/cenario";
import { clienteFalso, type Registro } from "./__harness/modelo";

/**
 * PEND-182 — A ÂNCORA SOBREVIVE AO `insert`? (08/09/2026)
 *
 * ⚠️ POR QUE ESTE ARQUIVO EXISTE, e por que os testes que já havia não bastavam.
 * `clarificacao-retoma.test.ts` provava que `metadataMensagem` era PASSADO à
 * função. Passou verde o mês inteiro. O que ninguém provava era que o campo
 * SOBREVIVIA à escrita — e não sobrevivia: os dois `insert` de `ayla_messages`
 * espalhavam o `metadata` do chamador ao lado do `metadata` de
 * `registroDeEnvio`, e chave repetida em objeto literal não funde. A última
 * vencia; a outra sumia inteira, sem erro e sem log.
 *
 * Medido em produção no mesmo dia, por leitura: das 3 mensagens
 * `rotina_proposta` enviadas, ZERO tinham `proposta`; das 54
 * `clarificacao_identificacao`, ZERO tinham `pedido`.
 *
 * ⚠️ ENTÃO A RÉGUA AQUI É OUTRA: nenhum teste deste arquivo pode olhar o
 * código-fonte nem o argumento de uma chamada. Todos leem a LINHA GRAVADA e,
 * quando dá, o CONSUMIDOR lendo aquela linha de volta. É a única forma de
 * provar sobrevivência.
 */

// ── OS DUPLOS ────────────────────────────────────────────────────────────
const registros: Registro[] = [];
const mundoRef: { atual: Mundo | null; alvo: string | null } = { atual: null, alvo: null };
const roteiro: {
  fala: string;
  prontidaoRotina?: "suficiente" | "falta" | "orientacao" | "nao_e_rotina";
  acaoRotina?: "montar" | "perguntar" | "responder" | "sair";
} = { fala: "[resposta da Ayla]" };

vi.mock("@/lib/log", () => ({ logEvent: async () => {}, logServerError: async () => {} }));

vi.mock("./whatsappSender", () => ({
  enviarTexto: async (p: { phoneE164: string; texto: string }) => {
    mundoRef.atual?.enviadas.push({ para: p.phoneE164, texto: p.texto });
    return { ok: true, messageId: `zaap-out-${mundoRef.atual?.enviadas.length}` };
  },
  enviarImagem: async () => ({ ok: true, messageId: "img" }),
  enviarDocumento: async () => ({ ok: true, messageId: "doc" }),
}));

vi.mock("@/lib/ia/provider", () => ({
  MODELO_CONVERSA: { anthropic: "claude-sonnet-4-6", openai: "gpt-5.6-luna" },
  providerConversacionalParaFamilia: () => "openai",
  gerarConversacional: async (p: { system?: string }) => {
    const decisor = /"skills"/.test(String(p.system ?? ""));
    mundoRef.atual?.chamadas.push({ quem: decisor ? "decisor" : "conversa", prompt: "", mensagem: "", notas: [] });
    return {
      texto: decisor
        ? JSON.stringify({
            intencao: "outro",
            tema: null,
            aceite: null,
            skills: [],
            pedido_explicito: false,
            continuacao: true,
            necessidade_conhecimento: "nenhum",
            tema_conhecimento: null,
          })
        : roteiro.fala,
      provider: "openai",
      model: "gpt-5.6-luna",
      tokensIn: 10,
      tokensOut: 5,
      cacheRead: 0,
    };
  },
}));

vi.mock("./anthropic", () => ({
  AYLA_MODEL: "claude-haiku-4-5",
  AYLA_MODEL_FALLBACK: "claude-sonnet-4-6",
  getAylaAnthropicClient: () =>
    clienteFalso(
      {
        alvo: mundoRef.alvo,
        ...(roteiro.prontidaoRotina ? { prontidaoRotina: roteiro.prontidaoRotina } : {}),
        ...(roteiro.acaoRotina ? { acaoRotina: roteiro.acaoRotina } : {}),
      },
      registros,
    ),
}));

vi.mock("./lote-inbound", () => ({
  aguardarTurnoDaMae: async (_s: unknown, p: { textoAtual: string }) => ({ texto: p.textoAtual, ids: [] }),
  descartarTurnoPendente: async () => {},
}));

vi.mock("@/lib/ai/prompts", () => ({ getSystemPrompt: async (_k: string, f: string) => f }));

const { processInbound, enviarEPersistir, ofertaDePlanoPendente } = await import("./orchestrator");
const { propostaPendente } = await import("./rotina-guiada");

type Linha = Record<string, unknown>;

function mundoCom(criancas: Parameters<typeof montarMundo>[0]["criancas"]) {
  return montarMundo({ nomeMae: "Ana", criancas });
}

const MANU = { nome: "Manu", nascimento: "2019-04-02", genero: "feminino" };
const MARIO = { nome: "Mario", nascimento: "2017-09-15", genero: "masculino" };

/**
 * ⚠️ O RELÓGIO EXPLÍCITO. `BancoMemoria` carimba `created_at` no instante do
 * insert, e duas escritas seguidas caem no MESMO milissegundo: a ordenação por
 * `created_at` desc fica empatada e o "último" vira sorteio. Dois testes deste
 * arquivo falharam por isso antes de o produto ter culpa nenhuma. Quem depende
 * de ordem carimba a ordem.
 */
// ⚠️ CINCO MINUTOS ATRÁS, não uma hora: a janela da oferta de Plano é de 30
// minutos. Carimbar longe demais reprovava a oferta legítima por VELHICE e não
// pelo que o teste queria medir — falso vermelho é tão ruim quanto falso verde.
let relogio = Date.now() - 5 * 60 * 1000;
const proximoInstante = () => new Date((relogio += 1000)).toISOString();

/** As mensagens de saída GRAVADAS — a linha, não o argumento. */
function saidas(m: Mundo): Linha[] {
  return (m.db.linhas("ayla_messages") as Linha[]).filter((x) => x.direcao === "outbound");
}

beforeEach(() => {
  mundoRef.atual = null;
  mundoRef.alvo = null;
  roteiro.fala = "[resposta da Ayla]";
  delete roteiro.prontidaoRotina;
  delete roteiro.acaoRotina;
  registros.length = 0;
});

// ═══════════════════════════════════════════════════════════════════════
// 1 · A ESCRITA — as duas chaves convivem na linha gravada
// ═══════════════════════════════════════════════════════════════════════

describe("PEND-182 · a âncora e o registro de entrega convivem no banco", () => {
  /**
   * ⚠️ CHAMADA DIRETA A `enviarEPersistir`, e de propósito. Este bloco não mede
   * decisão nenhuma: mede a ESCRITA. Atravessar o orquestrador inteiro para
   * chegar até ela só acrescentaria maneiras de o teste não chegar lá — e é o
   * orquestrador que os blocos 2 e 3 exercitam.
   */
  async function gravar(ancora: Record<string, unknown> | undefined) {
    const m = mundoCom([MANU]);
    mundoRef.atual = m;
    await enviarEPersistir(m.db.cliente(), {
      family_account_id: m.familyId,
      membro_atipico_id: m.membros.Manu,
      phone: m.telefone,
      texto: "uma fala qualquer",
      category: "reativa",
      tipo: "resposta_registro",
      ...(ancora ? { metadataMensagem: ancora } : {}),
    });
    return (saidas(m).at(-1)?.metadata ?? null) as Record<string, unknown> | null;
  }

  it("com âncora: a linha traz a âncora E o registro de entrega", async () => {
    const meta = await gravar({ pedido: "monta a rotina da manhã" });
    expect(meta?.pedido, "a âncora foi apagada pelo registro de entrega").toBe(
      "monta a rotina da manhã",
    );
    expect(meta?.entrega, "o registro de entrega foi apagado pela âncora").toBeTruthy();
  });

  it("sem âncora: o registro de entrega continua igual ao que sempre foi", async () => {
    const meta = await gravar(undefined);
    expect(Object.keys(meta ?? {})).toEqual(["entrega"]);
  });

  it("a âncora NUNCA pode sobrescrever o registro de entrega", async () => {
    // ⚠️ O caso adversário: um chamador que mande a chave reservada. A entrega
    // é auditoria — o que o sistema afirma ter feito — e não pode ser escrita
    // por quem está gravando estado de conversa.
    const meta = await gravar({ entrega: "mentira", pedido: "x" });
    expect((meta?.entrega as { canal?: string } | undefined)?.canal).toBe("z-api");
    expect(meta?.pedido).toBe("x");
  });

  it("cada uma das três âncoras conhecidas sobrevive", async () => {
    // O conjunto FECHADO do que atravessa `metadataMensagem` hoje. Se um dia
    // nascer uma quarta, ela entra aqui — e o autor é obrigado a provar que
    // sobrevive antes de confiar nela.
    for (const [chave, valor] of [
      ["pedido", "monta a rotina"],
      ["proposta", [{ texto: "Acordar", hora: null }]],
      ["plano_id", "plano-123"],
    ] as const) {
      const meta = await gravar({ [chave]: valor });
      expect(meta?.[chave], `${chave} não sobreviveu ao insert`).toEqual(valor);
      expect(meta?.entrega, `${chave} apagou a entrega`).toBeTruthy();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2 · `pedido` — a clarificação de criança, ida e volta
// ═══════════════════════════════════════════════════════════════════════

describe("PEND-182 · mecanismo 1: a resposta da clarificação retoma o pedido", () => {
  /**
   * O caso Karina, 08/08/2026: "monta a rotina" → "Mario ou Manu?" → "Manu" → e
   * o pedido morria ali. A correção daquele dia gravava o pedido no `metadata`
   * — e o `metadata` era apagado na mesma linha. Um ano de comentário
   * explicando um mecanismo que nunca chegou a existir.
   */
  it("dentro da janela: a escolha da criança recupera o pedido original", async () => {
    const m = mundoCom([MANU, MARIO]);
    mundoRef.atual = m;
    mundoRef.alvo = null; // ambíguo de propósito: é o que dispara a clarificação

    await processInbound(m.db.cliente(), inboundDe(m, "monta a rotina da manhã"));

    const clarificacao = saidas(m).find((s) => s.tipo === "clarificacao_identificacao");
    expect(clarificacao, "o turno não chegou a pedir a clarificação").toBeTruthy();
    const meta = (clarificacao?.metadata ?? null) as { pedido?: string; entrega?: unknown } | null;
    expect(meta?.pedido, "o pedido não sobreviveu à escrita").toBe("monta a rotina da manhã");
    expect(meta?.entrega, "a entrega foi apagada pelo pedido").toBeTruthy();
  });

  it("tipo errado não retoma — a guarda do consumidor continua de pé", async () => {
    // ⚠️ A CORREÇÃO NÃO PODE VIRAR CAPTURA. `retomarPedidoAposClarificacao` só
    // age quando a ÚLTIMA fala foi a clarificação; uma resposta curta depois de
    // outra coisa é sobre outra coisa. Provar que a âncora chegou sem provar
    // que a guarda segue fechada seria trocar um defeito por outro.
    const m = mundoCom([MANU, MARIO]);
    mundoRef.atual = m;
    mundoRef.alvo = m.membros.Manu;

    // Uma mensagem comum ENTRE a clarificação e a resposta curta.
    await enviarEPersistir(m.db.cliente(), {
      family_account_id: m.familyId,
      membro_atipico_id: null,
      phone: m.telefone,
      texto: "De quem é este pedido?",
      category: "reativa",
      tipo: "clarificacao_identificacao",
      metadataMensagem: { pedido: "monta a rotina da manhã" },
    });
    saidas(m).at(-1)!.created_at = proximoInstante();
    await enviarEPersistir(m.db.cliente(), {
      family_account_id: m.familyId,
      membro_atipico_id: null,
      phone: m.telefone,
      texto: "qualquer outra coisa",
      category: "reativa",
      tipo: "resposta_registro",
    });
    saidas(m).at(-1)!.created_at = proximoInstante();

    const antes = m.db.linhas("rotinas").length;
    await processInbound(m.db.cliente(), inboundDe(m, "Manu"));
    expect(
      m.db.linhas("rotinas").length,
      "retomou um pedido que não era o último — a guarda de tipo caiu",
    ).toBe(antes);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3 · `proposta` — a sequência que a mãe aprovou
// ═══════════════════════════════════════════════════════════════════════

describe("PEND-182 · mecanismo 2: a proposta aprovada chega ao quadro", () => {
  /** Grava uma proposta como o produto grava — pela escrita real. */
  async function proporSequencia(
    m: Mundo,
    membroId: string | null,
    proposta: unknown,
    quandoISO?: string,
  ) {
    mundoRef.atual = m;
    await enviarEPersistir(m.db.cliente(), {
      family_account_id: m.familyId,
      membro_atipico_id: membroId,
      phone: m.telefone,
      texto: "Que tal assim?",
      category: "reativa",
      tipo: "rotina_proposta",
      ...(proposta ? { metadataMensagem: { proposta } } : {}),
    });
    const linha = saidas(m).at(-1)!;
    linha.created_at = quandoISO ?? proximoInstante();
  }

  const ETAPAS = [
    { texto: "Acordar com luz baixa", hora: null },
    { texto: "Trocar de roupa", hora: null },
  ];

  it("proposta válida: o consumidor recupera EXATAMENTE as etapas propostas", async () => {
    const m = mundoCom([MANU]);
    await proporSequencia(m, m.membros.Manu, ETAPAS);

    const r = await propostaPendente(m.db.cliente(), m.familyId);
    expect(r, "a proposta não sobreviveu — o quadro seria reinventado").toBeTruthy();
    expect(r?.etapas.map((e) => e.texto)).toEqual(ETAPAS.map((e) => e.texto));
    expect(r?.membroId).toBe(m.membros.Manu);
  });

  it("proposta VAZIA não vira proposta", async () => {
    const m = mundoCom([MANU]);
    await proporSequencia(m, m.membros.Manu, []);
    expect(await propostaPendente(m.db.cliente(), m.familyId)).toBeNull();
  });

  it("fora da janela de 48h não retorna", async () => {
    const m = mundoCom([MANU]);
    const velho = new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString();
    await proporSequencia(m, m.membros.Manu, ETAPAS, velho);
    expect(await propostaPendente(m.db.cliente(), m.familyId)).toBeNull();
  });

  it("a proposta ANTIGA não vence a conversa mais recente", async () => {
    // O consumidor lê a ÚLTIMA das três tipagens de rotina. Uma proposta velha
    // atrás de uma conversa nova não pode ressuscitar.
    const m = mundoCom([MANU]);
    await proporSequencia(m, m.membros.Manu, ETAPAS);
    mundoRef.atual = m;
    await enviarEPersistir(m.db.cliente(), {
      family_account_id: m.familyId,
      membro_atipico_id: m.membros.Manu,
      phone: m.telefone,
      texto: "e como foi hoje?",
      category: "reativa",
      tipo: "rotina_conversa",
    });
    saidas(m).at(-1)!.created_at = proximoInstante();
    expect(await propostaPendente(m.db.cliente(), m.familyId)).toBeNull();
  });

  it("a proposta carrega DE QUEM ela é — o irmão não herda", async () => {
    const m = mundoCom([MANU, MARIO]);
    await proporSequencia(m, m.membros.Mario, ETAPAS);
    const r = await propostaPendente(m.db.cliente(), m.familyId);
    expect(r?.membroId, "a proposta do Mario voltaria como se fosse da Manu").toBe(m.membros.Mario);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 4 · `plano_id` — dedup da entrega, sem bloquear entrega legítima
// ═══════════════════════════════════════════════════════════════════════

describe("PEND-182 · mecanismo 3: a entrega do Plano fecha a oferta", () => {
  async function mensagem(
    m: Mundo,
    texto: string,
    tipo: "resposta_registro",
    ancora?: Record<string, unknown>,
    membroId: string | null = null,
  ) {
    mundoRef.atual = m;
    await enviarEPersistir(m.db.cliente(), {
      family_account_id: m.familyId,
      membro_atipico_id: membroId,
      phone: m.telefone,
      texto,
      category: "reativa",
      tipo,
      ...(ancora ? { metadataMensagem: ancora } : {}),
    });
    saidas(m).at(-1)!.created_at = proximoInstante();
  }

  it("depois da ENTREGA, não há oferta pendente — o 'ok' não gera outro Plano", async () => {
    const m = mundoCom([MANU]);
    await mensagem(m, "Quer que eu prepare um plano pra essa semana?", "resposta_registro");
    await mensagem(m, "Preparei o plano. O link está aqui.", "resposta_registro", {
      plano_id: "plano-1",
    });
    expect(
      await ofertaDePlanoPendente(m.db.cliente(), m.familyId, null),
      "a âncora de entrega não fechou a oferta — o 'ok' geraria um Plano duplicado",
    ).toBe(false);
  });

  it("a OFERTA sozinha continua pendente — a correção não bloqueia entrega legítima", async () => {
    const m = mundoCom([MANU]);
    await mensagem(m, "Quer que eu prepare um plano pra essa semana?", "resposta_registro");
    expect(
      await ofertaDePlanoPendente(m.db.cliente(), m.familyId, null),
      "a correção matou a oferta legítima",
    ).toBe(true);
  });

  it("a entrega para o IRMÃO não fecha a oferta desta criança", async () => {
    const m = mundoCom([MANU, MARIO]);
    await mensagem(m, "Quer que eu prepare um plano pra essa semana?", "resposta_registro", undefined, m.membros.Manu);
    await mensagem(m, "Preparei o plano.", "resposta_registro", { plano_id: "p-mario" }, m.membros.Mario);
    expect(await ofertaDePlanoPendente(m.db.cliente(), m.familyId, m.membros.Manu)).toBe(true);
  });
});
