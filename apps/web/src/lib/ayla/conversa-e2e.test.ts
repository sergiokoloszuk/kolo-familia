import { beforeEach, describe, expect, it, vi } from "vitest";
import { estadoDoTurno, inboundDe, montarMundo, type Mundo } from "./__harness/cenario";
import { clienteFalso, type Registro } from "./__harness/modelo";

const registros: Registro[] = [];
const roteiro: {
  prontidaoRotina?: "suficiente" | "orientacao" | "falta";
  /** As skills que o classificador deve rotear — ver `Roteiro` em __harness/modelo. */
  skills?: readonly string[];
} = {};

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
  gerarConversacional: async (p: unknown) => {
    // ⚠️ O PAYLOAD INTEIRO, não dois campos escolhidos a dedo. A primeira versão
    // capturava só `system` e `mensagem`, e por isso "o perfil não chegou ao
    // modelo" — o bloco estava lá, num campo que eu não estava olhando.
    mundoRef.atual?.chamadas.push({
      quem: "conversa",
      prompt: JSON.stringify(p),
      mensagem: "",
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
  getAylaAnthropicClient: () =>
    clienteFalso(
      {
        alvo: mundoRef.alvo,
        prontidaoRotina: roteiro.prontidaoRotina,
        // Sem repassar isto, `roteiro.skills` seria escrito pelos cenários e
        // ignorado pelo duplo — os testes de lente passariam medindo o nada.
        skills: roteiro.skills,
      },
      registros,
    ),
}));

/**
 * ⚠️ O GERADOR DA ROTINA É SUBSTITUÍDO, e isto delimita o que os cenários
 * provam. `gerarRotina` monta o próprio cliente Anthropic e morre com
 * "ANTHROPIC_API_KEY não configurada" — foi o que fez o cenário C terminar em
 * `resposta_registro` e quase virar "defeito de produto" no relatório anterior.
 *
 * O duplo devolve uma sequência fixa. Portanto: o ROTEAMENTO até o gerador e a
 * PERSISTÊNCIA depois dele ficam provados; a QUALIDADE do quadro, não.
 */
vi.mock("@/lib/ludico/rotina-servico", () => ({
  gerarRotina: async () => ({
    desfecho: "gerou",
    rotinas: [
      {
        nome: "Manhã da Geovanna",
        dia_semana: null,
        // ⚠️ SEM `hora`, e isso não é detalhe: `validarRotina` BARRA a
        // publicação com `horario_sem_base` quando o quadro traz um horário que
        // a família nunca disse. Minha primeira versão inventou 06:30/07:00, o
        // validador barrou — e por um instante isso pareceu "a rotina não
        // persiste". Era o validador fazendo exatamente o que existe para fazer.
        tarefas: [
          { texto: "Acordar com luz baixa", hora: null, ordem: 1 },
          { texto: "Trocar de roupa (sem etiqueta)", hora: null, ordem: 2 },
          { texto: "Café da manhã", hora: null, ordem: 3 },
          { texto: "Sair para a escola", hora: null, ordem: 4 },
        ],
      },
    ],
    fala: "Montei a manhã dela aqui 🌿",
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
  registros.length = 0;
  const antes = mundo.enviadas.length;
  const r = await processInbound(mundo.db.cliente(), inboundDe(mundo, texto));
  const e = { ...estadoDoTurno(mundo), respondeuNesteTurno: mundo.enviadas.length > antes };
  expect(r.tratada, `o turno NÃO foi tratado — o fluxo abortou antes de decidir`).toBe(true);
  expect(e.respondeuNesteTurno, `o turno não respondeu nada — teste vazio`).toBe(true);
  // ⚠️ E O PORTÃO DE ASSINATURA NÃO PODE TER RESPONDIDO POR TODOS. Na primeira
  // rodada deste arquivo, quatro cenários passaram assim: `assinatura_nudge`,
  // zero chamadas de modelo, zero artefatos — verde por não ter acontecido nada.
  expect(e.tipo, `o portão de assinatura respondeu no lugar do fluxo`).not.toBe("assinatura_nudge");
  // ⚠️ QUALQUER modelo conta — auxiliar (parser/intenção/prontidão) ou
  // conversacional. A primeira versão só contava o conversacional, e o caminho
  // da ROTINA não passa por ele: a guarda reprovava o cenário que mais importa.
  expect(
    registros.length + m.chamadas.length,
    `o turno não chamou modelo nenhum — não chegou a decidir`,
  ).toBeGreaterThan(0);
  return e;
}

beforeEach(() => {
  mundoRef.atual = null;
  mundoRef.alvo = null;
  // ⚠️ O ROTEIRO É GLOBAL DO ARQUIVO e não era zerado. Um cenário que roteia
  // `sensorial` deixaria a skill ligada para todos os testes seguintes, e um
  // teste de AUSÊNCIA passaria (ou falharia) pela ordem de execução. Zerar aqui
  // é o que mantém cada cenário dizendo só o que ele mesmo montou.
  roteiro.prontidaoRotina = undefined;
  roteiro.skills = undefined;
});

describe("A · a família só relata dificuldade com rotina", () => {
  /**
   * ⚠️ A PRONTIDÃO VAI FORÇADA EM "suficiente", e sem isso este cenário NÃO
   * PROTEGE NADA. Medido por sabotagem (11/08/2026): com a prontidão no padrão,
   * reverter o portão de criar ao piso puro — o defeito Ana/Geovanna inteiro —
   * mantinha o teste VERDE. O portão abria, e o modelo, um passo adiante,
   * devolvia "orientação" e não publicava quadro nenhum. O teste media o
   * modelo, não o portão.
   *
   * Com "suficiente", um portão aberto indevidamente PUBLICA uma rotina — e aí
   * o zero abaixo passa a significar alguma coisa.
   */
  it("não cria artefato nenhum", async () => {
    roteiro.prontidaoRotina = "suficiente";
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
    roteiro.prontidaoRotina = "suficiente"; // ver a nota do cenário A
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
  it("entra no fluxo da Rotina e PERSISTE o quadro", async () => {
    roteiro.prontidaoRotina = "suficiente";
    const m = familiaAnaEGeovanna();
    const r = await turno(m, "me ajuda a montar uma rotina para a manhã dela?");
    expect(r.rotinasCriadas, "o pedido explícito não produziu rotina").toBeGreaterThan(0);
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
  it("o perfil da criança entra no que é enviado — não só existe no banco", async () => {
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

describe("PARTE 10 · a base de conhecimento chega ao turno?", () => {
  /**
   * ⚠️ CORREÇÃO DE UMA AFIRMAÇÃO MINHA (11/08/2026). Eu registrei "a base não
   * chega ao WhatsApp" como achado de produto medido aqui. **Não é.**
   *
   * `turnoClassificado.skills` sai do QUARTO campo do classificador de intenção
   * (`intent.ts`), e o duplo deste arquivo devolve "{}" para essa chamada —
   * então `skills: []` por CONSTRUÇÃO, e `motivoVazio` sai `sem_skill` sem que
   * o produto tenha decidido nada. O harness não pode provar isto.
   *
   * A medição real de repertório vazio no WhatsApp vem da auditoria de produção
   * anterior (turnos reais), e continua valendo. Esta aqui, não.
   *
   * O que este teste trava, então, é só o CONTRATO: sem skill roteada não há
   * bloco de repertório. É pouco — e é o que dá para provar sem um duplo que
   * classifique intenção de verdade.
   */
  it("o contrato: sem skill roteada, não há bloco de repertório", async () => {
    const m = familiaAnaEGeovanna();
    await turno(m, "ela tá difícil na hora de dormir, não sei mais o que fazer");
    const tudo = m.chamadas.map((c) => c.prompt).join("\n");
    // Com `skills: []` (imposto pelo duplo do classificador), o recuperador não
    // monta bloco nenhum. As três leituras possíveis continuam distintas —
    // acervo inexistente · recuperação que não roda · recuperação que roda e
    // não acha — e ESTE teste não distingue nenhuma delas.
    expect(tudo).not.toContain("repertorio_kolo");
  });
});

describe("PARTE 17 · uma pergunta pendente captura a conversa seguinte?", () => {
  /**
   * ⚠️ NÃO CONSEGUI PROVAR PELO FLUXO REAL, e o limite é do harness.
   *
   * Para deixar uma pergunta pendente (`tipo="rotina_conversa"`) o condutor
   * precisa FAZER a pergunta, e isso exige um duplo de modelo que escreva a
   * fala do condutor — o meu devolve "{}" e o fluxo cai na conversa comum
   * (medido: com `prontidao="falta"` e com `"orientacao"`, os dois terminam em
   * `resposta_registro`).
   *
   * O que sustenta a [PEND-049] NÃO é este teste: é a medição por execução de
   * `rotinaConversaPendente` (1 h → abre · respondida → fecha · **40 h sem
   * resposta → abre** · 47h59 → abre · 49 h → fecha). Esta ficha continua
   * apoiada naquela prova, e não nesta, que fica registrada como o que é.
   */
  it.skip("MEDIDO: com pergunta de rotina em aberto, o assunto novo entra pelo fluxo da Rotina", async () => {
    // "falta" = a Ayla ainda precisa de informação e PERGUNTA, deixando o
    // estado aberto. Com "orientacao" o condutor devolve null de propósito (a
    // menor ajuda cabe na conversa comum) e nada fica pendente — medido.
    roteiro.prontidaoRotina = "falta";
    const m = familiaAnaEGeovanna();

    // Turno 1: a Ayla faz uma pergunta de rotina e fica esperando.
    const t1 = await turno(m, "me ajuda a montar uma rotina para a manhã dela?");
    expect(t1.tipo, "o cenário não conseguiu deixar uma pergunta pendente").toBe("rotina_conversa");

    // ⚠️ E AGORA A MÃE MUDA DE ASSUNTO — sem responder a pergunta.
    // `rotinaConversaPendente` só fecha quando existe um inbound DEPOIS da
    // pergunta. O inbound do turno 1 é anterior a ela; então, no turno 2, o
    // estado ainda está aberto e `rotinaConversa` entra no portão ANTES do ato.
    const t2 = await turno(m, "esquece isso, a escola ligou hoje, ele mordeu um colega");

    // O que segura o estrago é o modelo, um passo adiante: com a prontidão
    // devolvendo algo diferente de "suficiente", nenhum quadro é publicado.
    expect(t2.rotinasCriadas, "a mudança de assunto produziu uma rotina").toBe(0);
    // Mas a conversa nova FOI conduzida pelo fluxo da Rotina, e isso está
    // medido — é o objeto da PEND-049.
    expect(t2.tipo).toBe("rotina_conversa");
  });
});

/**
 * CORE PROFISSIONAL · A FIAÇÃO, não a função (12/08/2026).
 *
 * ⚠️ POR QUE ESTE BLOCO NÃO ESTÁ EM `conducao/*.test.ts`. Lá eu provaria que
 * `nucleoConducao()` devolve uma string com o texto dentro — o que é teste da
 * FUNÇÃO. A lição desta frente é que três sabotagens já passaram verdes assim:
 * a função certa existia e ninguém provava que alguém a CHAMAVA com os dados
 * certos.
 *
 * O que se lê aqui é o `system` que chegou a `gerarConversacional` depois de
 * `processInbound` inteiro — lote de inbound, família, criança, intenção, cinco
 * portões. Se alguém remover `CORE_PROFISSIONAL` de `nucleoConducao()`, ou
 * remover `nucleoConducao()` da montagem do `responder.ts`, ESTE teste cai. O
 * teste de `nucleoConducao().length` sozinho não cairia no segundo caso.
 */
describe("CORE PROFISSIONAL · chega ao produtor pelo fluxo real", () => {
  /** O `system` que de fato foi para o produtor conversacional neste turno. */
  function systemQueChegou(m: Mundo): string {
    const conversa = m.chamadas.filter((c) => c.quem === "conversa");
    expect(conversa.length, "o produtor conversacional não foi chamado").toBeGreaterThan(0);
    const p = JSON.parse(conversa[conversa.length - 1].prompt) as { system?: string };
    // ⚠️ Guarda anti-teste-vazio: `system` ausente faria todo `toContain`
    // abaixo falhar por motivo errado, e `not.toContain` passar por motivo
    // nenhum. Sem esta linha, um payload sem `system` daria verde nos negativos.
    expect(typeof p.system, "o payload do produtor não trouxe `system`").toBe("string");
    return p.system as string;
  }

  /**
   * S1 — a diretriz inteira. Uma frase de cada PARÁGRAFO que carrega peso, e
   * não uma só: removendo o bloco todo qualquer uma bastaria, mas quem poda um
   * parágrafo "que parecia redundante" precisa ser pego também.
   */
  it("S1 · a diretriz de raciocínio profissional chega ao modelo", async () => {
    const m = familiaAnaEGeovanna();
    await turno(m, "ela tá colocando tudo na boca, papel, planta, plástico");
    const s = systemQueChegou(m);
    expect(s, "o bloco de raciocínio sumiu da fiação").toContain(
      "# Como você raciocina (por dentro, antes de escrever)",
    );
    expect(s, "a lista de disciplinas sumiu").toContain("processamento sensorial");
    expect(s, "o freio do jargão sumiu — ela volta a citar disciplina").toContain(
      "ISSO É FONTE DE RACIOCÍNIO, NUNCA PAUTA DA RESPOSTA",
    );
    expect(s, "o procedimento silencioso sumiu").toContain("PERCORRA POR DENTRO");
    expect(s, "a independência do acervo sumiu").toContain(
      "O ACERVO SOMA, NÃO SUBSTITUI VOCÊ",
    );
  });

  /** S2 — ajude primeiro / no máximo uma pergunta / não repergunte o que já sabe. */
  it("S2 · o 'ajude primeiro' e o freio da repergunta chegam ao modelo", async () => {
    const m = familiaAnaEGeovanna();
    await turno(m, "ela tá colocando tudo na boca, papel, planta, plástico");
    const s = systemQueChegou(m);
    expect(s, "'AJUDE PRIMEIRO' sumiu — a Ayla volta ao interrogatório").toContain(
      "AJUDE PRIMEIRO.",
    );
    expect(s, "o limite de UMA pergunta sumiu").toContain("UMA pergunta útil");
    expect(s, "o freio da repergunta sumiu — ela volta a pedir nome/idade/diagnóstico").toContain(
      "NUNCA pergunte de novo o que você já tem: nome, idade, diagnóstico",
    );
  });

  /** S3 — fato × hipótese × causa, e a segurança antes da explicação. */
  it("S3 · a separação fato × hipótese e a segurança primeiro chegam ao modelo", async () => {
    const m = familiaAnaEGeovanna();
    await turno(m, "ela tá colocando tudo na boca, papel, planta, plástico");
    const s = systemQueChegou(m);
    expect(s, "a separação fato × hipótese sumiu — volta a declarar causa").toContain(
      "FATO ≠ HIPÓTESE ≠ CAUSA",
    );
    expect(s, "a regra de não fechar causa no 1º turno sumiu").toContain(
      "NÃO feche em causa no primeiro turno",
    );
    expect(s, "a segurança-antes-da-compreensão sumiu — o caso Daniel volta").toContain(
      "SEGURANÇA PRÁTICA VEM ANTES DA COMPREENSÃO",
    );
    expect(s, "a lista de risco concreto sumiu").toContain("levar à boca o que não é comida");
  });

  /** A fronteira jurídica, que entrou na mesma fatia. */
  it("a fronteira jurídica chega — e não juridica a escola", async () => {
    const m = familiaAnaEGeovanna();
    await turno(m, "a escola disse que não tem obrigação de dar mediadora pra ela");
    const s = systemQueChegou(m);
    expect(s, "a fronteira jurídica sumiu").toContain("# Fronteira jurídica");
    expect(s, "o freio contra inventar lei sumiu").toContain("NUNCA inventa lei");
    expect(s, "a proteção do território escolar sumiu").toContain(
      "NÃO TRANSFORME ESCOLA EM CASO JURÍDICO",
    );
  });
});

/**
 * REGRESSÃO ESSENCIAL da fatia do Core — só o que a missão pediu proteger, e
 * só o que este harness CONSEGUE provar.
 *
 * ⚠️ O QUE ESTES TESTES NÃO PROVAM: a qualidade do texto. O duplo devolve
 * "[resposta da Ayla]". O que eles protegem é o ROTEAMENTO — que a mudança de
 * núcleo não passou a produzir artefato onde antes havia conversa. Um núcleo
 * que ensina a "ajudar primeiro" é exatamente o tipo de mudança que poderia
 * empurrar um relato comum para dentro de um fluxo de entrega.
 */
/**
 * LENTES PROFISSIONAIS · A FIAÇÃO (12/08/2026).
 *
 * ⚠️ A PRESENÇA SÓ SE PROVA COM O DUPLO ROTEANDO. Até aqui o duplo devolvia
 * "{}" para a chamada de intenção, e `parseSkills` traduz isso em `[]` — então
 * repertório e lente ficavam vazios POR CONSTRUÇÃO. Um teste de presença
 * escrito sem `roteiro.skills` mediria o duplo, não o produto: foi assim que
 * três sabotagens desta frente passaram verdes.
 *
 * Por isso o cenário abaixo semeia `specialist_prompt_templates` (o catálogo
 * contra o qual `parseSkills` valida) e DIZ, por escrito, qual skill roteou.
 */
describe("LENTES · a lente do turno chega ao produtor pelo fluxo real", () => {
  // O catálogo já vem de `montarMundo` (ver o comentário lá: o cache de módulo
  // de `carregarCatalogoSkills` obriga TODO cenário a tê-lo). Semear de novo
  // aqui duplicaria as linhas sem provar nada a mais.
  const familiaComCatalogo = familiaAnaEGeovanna;

  function systemMaisTurno(m: Mundo): string {
    const conversa = m.chamadas.filter((c) => c.quem === "conversa");
    expect(conversa.length, "o produtor conversacional não foi chamado").toBeGreaterThan(0);
    // O payload INTEIRO: a lente vai no conteúdo do TURNO, não no `system`
    // (o system é cacheado). Olhar só `system` faria o teste falhar por
    // motivo errado — e um `not.toContain` passar por motivo nenhum.
    return conversa[conversa.length - 1].prompt;
  }

  it("skill roteada → a lente correspondente chega", async () => {
    roteiro.skills = ["sensorial"];
    const m = familiaComCatalogo();
    await turno(m, "ela tá colocando tudo na boca, papel, planta, plástico");
    const p = systemMaisTurno(m);
    expect(p, "a lente não chegou ao produtor").toContain("lente_profissional");
    expect(p, "chegou a lente errada").toContain("SENSORIAL.");
    expect(p, "a lente não reafirmou o núcleo").toContain("hipótese nunca vira causa");
  });

  it("duas skills → no máximo duas lentes, na ordem do roteamento", async () => {
    roteiro.skills = ["sensorial", "emocional", "sono"];
    const m = familiaComCatalogo();
    await turno(m, "ela tá colocando tudo na boca e chora muito à noite");
    const p = systemMaisTurno(m);
    expect(p).toContain("SENSORIAL.");
    expect(p).toContain("EMOCIONAL E RELAÇÃO.");
    expect(p, "entrou uma terceira lente no turno real").not.toContain("SONO. OLHE:");
  });

  /**
   * ⚠️ O TESTE QUE MAIS IMPORTA DESTA FATIA. A regra de produto é que a lente
   * NÃO É PORTÃO: sem skill, o turno tem que continuar exatamente como antes,
   * com o Core respondendo sozinho. Se algum dia a ausência de lente passar a
   * emudecer o turno, é aqui que aparece.
   */
  it("sem skill → nenhuma lente, e o turno responde do mesmo jeito", async () => {
    roteiro.skills = undefined;
    const m = familiaComCatalogo();
    const r = await turno(m, "ela tá colocando tudo na boca, papel, planta, plástico");
    const p = systemMaisTurno(m);
    expect(p, "apareceu lente sem skill roteada").not.toContain("lente_profissional");
    // O Core continua chegando inteiro — é ele que responde neste turno.
    expect(p).toContain("Como você raciocina (por dentro, antes de escrever)");
    // E o turno respondeu: as guardas de `turno()` já cobrem, esta é explícita.
    expect(r.ultimoTexto, "sem lente o turno emudeceu").toBeTruthy();
  });

  it("skill fora da taxonomia → sem lente, e sem quebrar o turno", async () => {
    roteiro.skills = ["skill_que_nao_existe"];
    const m = familiaComCatalogo();
    const r = await turno(m, "ela tá colocando tudo na boca, papel, planta, plástico");
    expect(systemMaisTurno(m)).not.toContain("lente_profissional");
    expect(r.ultimoTexto).toBeTruthy();
  });

  it("a lente NÃO cria artefato — não é portão e não tem autoridade", async () => {
    roteiro.skills = ["sensorial"];
    roteiro.prontidaoRotina = "suficiente";
    const m = familiaComCatalogo();
    const r = await turno(m, "ela tá colocando tudo na boca, papel, planta, plástico");
    expect(r.rotinasCriadas, "a lente abriu o fluxo da rotina").toBe(0);
    expect(r.planosCriados, "a lente abriu o fluxo do plano").toBe(0);
  });
});

describe("REGRESSÃO · o Core não transformou conversa em artefato", () => {
  it("F · 'ele rasga papel' continua conversa — sem rotina e sem plano", async () => {
    roteiro.prontidaoRotina = "suficiente";
    const m = familiaAnaEGeovanna();
    const r = await turno(m, "ele rasga papel o tempo todo, não sei o que fazer");
    expect(r.rotinasCriadas, "um relato comum virou rotina").toBe(0);
    expect(r.planosCriados, "um relato comum virou plano").toBe(0);
  });

  it("A · relato de dificuldade com segurança continua conversa", async () => {
    roteiro.prontidaoRotina = "suficiente";
    const m = familiaAnaEGeovanna();
    const r = await turno(m, "ela tá colocando tudo na boca, papel, planta, plástico");
    // A regra nova manda PROTEGER primeiro. Proteger é FALA, não artefato: se
    // "segurança" passar a abrir um fluxo de entrega, é aqui que aparece.
    expect(r.rotinasCriadas, "o gatilho de segurança abriu o fluxo da rotina").toBe(0);
    expect(r.planosCriados, "o gatilho de segurança abriu o fluxo do plano").toBe(0);
  });

  it("E · falar SOBRE o PDF não gera PDF nem plano", async () => {
    const m = familiaAnaEGeovanna();
    const r = await turno(m, "aquele PDF que você mandou ficou muito bom, obrigada");
    expect(r.planosCriados, "elogiar o PDF gerou outro plano").toBe(0);
    expect(r.rotinasCriadas, "elogiar o PDF gerou uma rotina").toBe(0);
  });

  it("assunto jurídico da escola continua conversa — não vira artefato", async () => {
    const m = familiaAnaEGeovanna();
    const r = await turno(m, "a escola disse que não tem obrigação de dar mediadora pra ela");
    expect(r.planosCriados, "a conversa sobre a escola gerou plano").toBe(0);
    expect(r.rotinasCriadas, "a conversa sobre a escola gerou rotina").toBe(0);
  });
});
