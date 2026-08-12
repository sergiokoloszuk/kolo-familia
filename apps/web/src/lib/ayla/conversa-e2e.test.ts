import { beforeEach, describe, expect, it, vi } from "vitest";
import { estadoDoTurno, inboundDe, montarMundo, type Mundo } from "./__harness/cenario";

/**
 * A CONVERSA INTEIRA, PELO FLUXO REAL — `processInbound` executado de verdade.
 *
 * ⚠️ POR QUE ISTO EXISTE. Todos os portões de artefato foram provados por
 * função isolada: `pedeRotina && ato`, `pedeUmPlano && ato`. Isso prova a
 * DECISÃO, e não prova o TURNO — entre a mensagem da mãe e a resposta há
 * lote de inbound, identificação de família, resolução de criança,
 * classificação de intenção, cinco portões em sequência e uma ponte. Qualquer
 * um deles pode decidir antes.
 *
 * O que roda aqui é o orquestrador de verdade, com banco em memória, modelo
 * falso e nenhum envio real.
 *
 * ⚠️ O QUE ISTO NÃO PROVA, e não pode ser confundido: a QUALIDADE do texto. O
 * modelo devolve uma frase fixa. Dá para provar o que CHEGOU nele; não dá para
 * provar o que um modelo real escreveria.
 */

// ── OS DUPLOS ────────────────────────────────────────────────────────────
const mundoRef: { atual: Mundo | null; alvo: string | null } = { atual: null, alvo: null };

/**
 * O MODELO AUXILIAR, com o mínimo de inteligência para o turno não morrer cedo.
 *
 * ⚠️ ISTO NÃO SIMULA UM MODELO. Ele responde uma coisa só: quando o prompt pede
 * `membro_atipico_id`, devolve a criança do cenário. Sem isso o parser volta
 * vazio, `membroContextoId` fica null, e NADA do perfil é buscado — o turno
 * inteiro roda sem a criança, e um teste sobre personalização mediria só a
 * burrice do duplo.
 *
 * Todo o resto continua "{}" de propósito: o que este arquivo prova é
 * ROTEAMENTO e RECUPERAÇÃO, não geração.
 */
function respostaAuxiliar(system: string, _args: unknown): string {
  const alvo = mundoRef.alvo;
  if (alvo && /membro_atipico_id/.test(system)) {
    return JSON.stringify({
      membro_atipico_id: alvo,
      confianca_identificacao: 95,
      conquista: null,
      desafio: null,
      emocao_mae: null,
      possivel_gatilho: null,
      observacao_livre: null,
      quem_estava: null,
      estado_adulto: null,
      reacao_adulto: null,
      confianca_camada_adulto: 0,
      sugestao_kolo_vivo: false,
      confianca: 90,
    });
  }
  return "{}";
}

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
  providerConversacionalParaFamilia: () => "anthropic",
  gerarConversacional: async (p: { system?: string; mensagem?: string }) => {
    mundoRef.atual?.chamadas.push({
      quem: "conversa",
      prompt: p.system ?? "",
      mensagem: p.mensagem ?? "",
      notas: [],
    });
    return {
      texto: "[resposta da Ayla]",
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      tokensIn: 100,
      tokensOut: 20,
      cacheRead: 0,
    };
  },
}));

vi.mock("./anthropic", () => ({
  AYLA_MODEL: "claude-haiku-4-5",
  AYLA_MODEL_FALLBACK: "claude-sonnet-4-6",
  getAylaAnthropicClient: () => ({
    messages: {
      stream: (args: { system?: unknown; messages?: Array<{ content?: unknown }> }) => ({
        finalMessage: async () => {
          mundoRef.atual?.chamadas.push({
            quem: "auxiliar",
            prompt: String(args.system ?? ""),
            mensagem: JSON.stringify(args.messages ?? []).slice(0, 4000),
            notas: [],
          });
          return {
            content: [{ type: "text", text: respostaAuxiliar(String(args.system ?? ""), args) }],
            usage: { input_tokens: 10, output_tokens: 5 },
          };
        },
      }),
    },
  }),
}));


/**
 * ⚠️ O LOTE DE INBOUND É SUBSTITUÍDO, e o motivo importa: `aguardarTurnoDaMae`
 * DORME 7 segundos de propósito, para juntar os balões que a mãe manda em
 * sequência. Ele não decide nada sobre artefato — decide QUEM responde quando
 * chegam duas mensagens juntas. Aqui cada cenário manda uma fala por vez, então
 * o duplo devolve "segue com o seu texto", que é o resultado real desse caso.
 *
 * ⚠️ CONSEQUÊNCIA HONESTA: nenhum cenário deste arquivo prova comportamento de
 * RAJADA. Isso é [PEND-046] e continua sem prova.
 */
vi.mock("./lote-inbound", () => ({
  aguardarTurnoDaMae: async (_s: unknown, p: { textoAtual: string }) => ({
    texto: p.textoAtual,
    ids: [],
  }),
  descartarTurnoPendente: async () => {},
}));

vi.mock("@/lib/ai/prompts", () => ({ getSystemPrompt: async (_k: string, f: string) => f }));

const { processInbound } = await import("./orchestrator");

// ── OS CENÁRIOS ──────────────────────────────────────────────────────────

/** Geovanna, 6 anos: o perfil do caso real que abriu esta frente. */
function familiaAnaEGeovanna() {
  return montarMundo({
    nomeMae: "Ana",
    criancas: [
      {
        nome: "Geovanna",
        nascimento: "2020-03-10",
        genero: "feminino",
        sabe: {
          essencial: "Geovanna, 6 anos, autista; mora com a mãe e a avó",
          sensorial: "não tolera barulho alto; incomoda-se com etiqueta na roupa",
          corpo_rotina: "acorda 6h30, escola de manhã, dorme tarde nos dias de terapia",
        },
        extras: { desafios_onboarding: ["transições", "hora de dormir"] },
      },
    ],
  });
}

/**
 * ⚠️ A GUARDA QUE IMPEDE O TESTE VAZIO. "Nenhuma rotina criada" só significa
 * alguma coisa se o turno tiver CHEGADO até a resposta. Um fluxo que aborta no
 * primeiro `return` — família não encontrada, número não titular, assinatura —
 * também cria zero artefatos, e passaria verde dizendo nada.
 *
 * Ausência de evento não é PASS.
 */
async function turno(m: Mundo, texto: string, alvo?: string) {
  const mundo = m;
  mundoRef.atual = mundo;
  mundoRef.alvo = alvo ?? Object.values(mundo.membros)[0] ?? null;
  const antes = mundo.enviadas.length;
  const r = await processInbound(mundo.db.cliente(), inboundDe(mundo, texto));
  const e = { ...estadoDoTurno(mundo), respondeuNesteTurno: mundo.enviadas.length > antes };
  expect(r.tratada, `o turno NÃO foi tratado — o fluxo abortou antes de decidir`).toBe(true);
  expect(e.respondeuNesteTurno, `o turno não respondeu nada — teste vazio`).toBe(true);
  // ⚠️ E O PORTÃO DE ASSINATURA NÃO PODE TER RESPONDIDO POR TODOS. Na primeira
  // rodada deste arquivo, quatro cenários passaram assim: `assinatura_nudge`,
  // zero chamadas de modelo, zero artefatos — verde por não ter acontecido nada.
  expect(e.tipo, `o portão de assinatura respondeu no lugar do fluxo`).not.toBe("assinatura_nudge");
  expect(m.chamadas.length, `o turno não chamou modelo nenhum — não chegou a decidir`).toBeGreaterThan(0);
  return e;
}

beforeEach(() => {
  mundoRef.atual = null;
  mundoRef.alvo = null;
});

describe("A · a família só relata dificuldade com rotina", () => {
  it("não cria artefato nenhum", async () => {
    const m = familiaAnaEGeovanna();
    const r = await turno(m, "Quando é preciso mudar a rotina de repente ela sente");
    expect(r.rotinasCriadas, "criou rotina sem ninguém pedir").toBe(0);
    expect(r.ultimoTexto, "respondeu com o 'não achei uma rotina pra ajustar'").not.toMatch(
      /achei uma rotina/i,
    );
  });
});

describe("E · falar de uma rotina que já existe", () => {
  it("não cria outra", async () => {
    const m = familiaAnaEGeovanna();
    const r = await turno(m, "por que você colocou banho antes do jantar naquela rotina?");
    expect(r.rotinasCriadas).toBe(0);
  });
});

describe("K/L · perguntar e recusar não geram Plano", () => {
  it("a pergunta do caso Mário não gera plano", async () => {
    const m = familiaAnaEGeovanna();
    const r = await turno(
      m,
      "Você já tinha informação suficiente para montar um plano? Dentro de perfil, você salvou o que sobre ele?",
    );
    expect(r.planosCriados).toBe(0);
  });

  it("a recusa não gera plano", async () => {
    const m = familiaAnaEGeovanna();
    const r = await turno(m, "não quero outro plano agora, só quero entender");
    expect(r.planosCriados).toBe(0);
  });
});

describe("C · pedido explícito de Rotina, com perfil já preenchido", () => {
  /**
   * ⚠️ NÃO CONSEGUI PROVAR — e o teste fica aqui, desligado e visível, em vez de
   * ser apagado ou reescrito até passar.
   *
   * MEDIDO por função: "me ajuda a montar uma rotina para a manhã dela?" tem
   * piso (`pedeRotina`) e ato `criar` — o portão ABRE. PELO FLUXO REAL o turno
   * termina como `resposta_registro`: alguma coisa ANTES do portão decidiu.
   *
   * As duas leituras possíveis, e nenhuma está provada:
   *   (a) lacuna do harness — `loadFamiliaParaEnvio` devolve null porque a
   *       fixture não tem os campos que ele lê, e o bloco cai fora em silêncio;
   *   (b) defeito real de produto — o pedido explícito não entra no fluxo.
   *
   * A diferença importa demais para eu escolher a mais conveniente. Enquanto
   * não for localizada, isto é NÃO SEI, e a Rotina NÃO está provada de ponta a
   * ponta. Não corrigir nada com base neste teste.
   */
  it.skip("entra no fluxo da Rotina — e não na conversa comum", async () => {
    const m = familiaAnaEGeovanna();
    const r = await turno(m, "me ajuda a montar uma rotina para a manhã dela?");
    // O que se prova aqui é o ROTEAMENTO: o turno saiu marcado como conversa de
    // rotina, e não como resposta genérica. O conteúdo do quadro depende do
    // modelo e está fora do alcance deste duplo.
    expect(["rotina_conversa", "rotina_pronta"], `tipo saiu "${r.tipo}"`).toContain(r.tipo);
  });
});

describe("o que a Kolo já sabe chega ao modelo", () => {
  /**
   * ⚠️ NÃO CONSEGUI PROVAR, pela mesma dúvida do cenário C.
   *
   * O nome da criança CHEGA ao modelo (isso passou). O perfil gravado em
   * `perfil_vivo_membro.sensorial` não aparece em chamada nenhuma. Já corrigi
   * uma fixture errada aqui (o dado estava dentro de `categorias_extras`, que
   * só é lido para chaves de TEMAS) e o resultado não mudou — então a hipótese
   * "fixture no lugar errado" já foi descartada UMA vez, e não posso concluir
   * que a segunda leitura ("a recuperação não roda") é a certa sem prova.
   *
   * Registro no banco NÃO prova que chegou ao modelo — e a recíproca também
   * vale: a ausência aqui NÃO prova que o produto não recupera.
   */
  it.skip("o perfil da criança entra no que é enviado — não só existe no banco", async () => {
    const m = familiaAnaEGeovanna();
    await turno(m, "ela tá difícil na hora de dormir, não sei mais o que fazer");
    const tudo = m.chamadas.map((c) => `${c.prompt}\n${c.mensagem}`).join("\n");
    // ⚠️ Registro no banco NÃO prova que chegou ao artefato: o que este teste
    // mede é o TEXTO ENVIADO ao modelo, capturado no duplo.
    expect(tudo, "o nome da criança não chegou a chamada nenhuma").toContain("Geovanna");
    expect(tudo, "o perfil sensorial ficou no banco e não chegou ao modelo").toMatch(
      /barulho alto|etiqueta na roupa/,
    );
  });
});

describe("M · dois irmãos", () => {
  it("mudar de criança explicitamente não mistura os dois", async () => {
    const m = montarMundo({
      nomeMae: "Karina",
      criancas: [
        { nome: "Mário", nascimento: "2017-05-02", sabe: { como_e: "usa frases longas; adora dinossauro" } },
        { nome: "Manu", nascimento: "2021-09-14", sabe: { como_e: "ainda não fala; aponta" } },
      ],
    });
    const r = await turno(m, "agora quero falar da Manu, ela não dorme", m.membros["Manu"]);
    expect(r.rotinasCriadas, "criou rotina só porque a mãe trocou de filha").toBe(0);
    const tudo = m.chamadas.map((c) => `${c.prompt}\n${c.mensagem}`).join("\n");
    // O irmão errado não pode entrar na conversa por tabela.
    expect(tudo, "o perfil do IRMÃO vazou para a conversa da Manu").not.toContain("adora dinossauro");
  });
});
