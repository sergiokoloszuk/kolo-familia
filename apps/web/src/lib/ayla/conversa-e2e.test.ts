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
        extras: {
          desafios_onboarding: ["transições", "hora de dormir"],
          // ⚠️ `gostos` ESTÁ AQUI PARA PROVAR UMA AUSÊNCIA QUE ERA REAL. Até
          // 12/08/2026 este domínio — hiperfocos, filmes, brincadeiras, o que
          // NÃO gosta — nunca chegava ao produtor conversacional em canal
          // nenhum: o laço do WhatsApp varria TEMAS (que são desafios) e
          // `gostos` não é desafio; a lista da web simplesmente não o tinha.
          // Medido pelo fluxo real: 19 dos 20 domínios chegavam, e o ausente
          // era sempre este.
          gostos: "adora dinossauros e água; detesta massinha",
        },
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

  /**
   * S2 — a regra de orientar × perguntar, e o freio da repergunta.
   *
   * ⚠️ MUDOU EM 12/08/2026, e a mudança foi de PRODUTO, não de teste. A versão
   * anterior guardava a string "AJUDE PRIMEIRO." — uma regra rígida de ajudar
   * antes de perguntar. Ela custou caro na observação com modelo real: "ele não
   * quer entrar na escola" recebeu 28 palavras e duas perguntas, sem nenhuma
   * ajuda, porque a Ayla não tinha como saber que ali perguntar ERA o certo (a
   * causa muda tudo: separação, transição, sobrecarga, medo, algo que
   * aconteceu). A regra virou os seis passos, e a trava real deixou de ser
   * "ajude antes" e passou a ser "confira o que já sabemos antes de perguntar".
   * O teste guarda a trava nova.
   */
  it("S2 · a regra de orientar × perguntar e o freio da repergunta chegam ao modelo", async () => {
    const m = familiaAnaEGeovanna();
    await turno(m, "ela tá colocando tudo na boca, papel, planta, plástico");
    const s = systemQueChegou(m);
    expect(s, "a regra de orientar × perguntar sumiu").toContain("ORIENTAR OU PERGUNTAR");
    expect(s, "o passo 1 sumiu — ela volta a perguntar sem ler o que já sabemos").toContain(
      "Leia primeiro TUDO que já sabemos",
    );
    expect(s, "o critério da pergunta sumiu — pergunta vira ritual").toContain(
      "MUDARIA materialmente a orientação",
    );
    expect(s, "o freio da repergunta sumiu — ela volta a pedir nome/idade/diagnóstico").toContain(
      "nem fazer a família repetir o que ela já contou: nome, idade, diagnóstico",
    );
    // E a proporção, que é o que impede a conversa de virar um Plano em miniatura.
    expect(s, "a regra de proporção sumiu").toContain("PROPORÇÃO NÃO É BREVIDADE");
    expect(s, "a conversa voltou a poder virar um plano em miniatura").toContain(
      "A CONVERSA NÃO É O PLANO",
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

  /**
   * ⚠️ O PERFIL CHEGA INTEIRO, INDEPENDENTEMENTE DA LENTE — é o que sustenta a
   * regra de que a lente é ponto de partida e não caixa. De nada adiantaria
   * mandar a Ayla integrar outros domínios se só o domínio da lente chegasse.
   *
   * Auditado por execução em 12/08/2026 nos sete cenários (sensorial,
   * emocional, comunicação, autonomia, rotina, foco e SEM skill): 19 dos 20
   * domínios chegavam em todos, sem nenhuma filtragem por lente ou tema. O
   * vigésimo — `gostos` — não chegava em nenhum, e é o que o teste abaixo
   * passa a guardar.
   */
  it("com lente sensorial, o perfil INTEIRO chega — inclusive gostos e domínios de outros temas", async () => {
    roteiro.skills = ["sensorial"];
    const m = familiaComCatalogo();
    await turno(m, "ela tá colocando tudo na boca, papel, planta, plástico");
    const p = systemMaisTurno(m);
    // O domínio da lente.
    expect(p).toContain("não tolera barulho alto");
    // Domínios de OUTROS temas, que a lente não cobre.
    expect(p, "o corpo/rotina não chegou").toContain("acorda 6h30");
    expect(p, "o essencial não chegou").toContain("autista");
    // E os interesses — a ausência que esta fatia corrigiu.
    expect(p, "GOSTOS não chegou: o interesse não pode virar veículo").toContain(
      "adora dinossauros e água",
    );
    expect(p, "o rótulo do bloco de gostos sumiu").toContain("Gostos e interesses");
  });

  it("sem lente nenhuma, o perfil inteiro continua chegando", async () => {
    roteiro.skills = undefined;
    const m = familiaComCatalogo();
    await turno(m, "ela tá colocando tudo na boca, papel, planta, plástico");
    const p = systemMaisTurno(m);
    expect(p).not.toContain("lente_profissional");
    // Sem skill não há lente — mas a criança inteira continua na mão da Ayla.
    expect(p, "sem lente o perfil encolheu").toContain("adora dinossauros e água");
    expect(p).toContain("não tolera barulho alto");
  });

  /**
   * M1 · AS CONQUISTAS CHEGAM AO WHATSAPP (13/08/2026).
   *
   * ⚠️ A ASSIMETRIA QUE ISTO FECHA. `diarios.conquista` era escrito a cada
   * turno pelo parser desde sempre. A WEB já lia e já injetava
   * (`<diario_recente>` em `ia/prompt.ts`); o WhatsApp SÓ ESCREVIA — gravava e
   * nunca lia de volta. O único outro consumidor era o relatório.
   *
   * Era a assimetria mais cara do produto: é exatamente o que fazia o app
   * anterior parecer que conhecia a criança ("vi nos registros que ela já foi
   * sozinha ao mercado").
   */
  it("M1 · o que a criança já conquistou chega ao produtor", async () => {
    const m = familiaComCatalogo();
    m.db.semear("diarios", [
      {
        family_account_id: m.familyId,
        membro_atipico_id: Object.values(m.membros)[0],
        data: new Date().toISOString().slice(0, 10),
        origem: "ayla",
        conquista: "foi sozinha até a padaria da esquina",
        desafio: null,
      },
    ]);
    await turno(m, "ela tá difícil na hora de sair de casa");
    const p = systemMaisTurno(m);
    expect(p, "a conquista não chegou — a ponte de capacidade não existe").toContain(
      "foi sozinha até a padaria",
    );
    expect(p).toContain("ja_conquistou");
    // ⚠️ A INSTRUÇÃO DE USO VIAJA COLADA. Conquista solta no prompt vira
    // parabéns fora de hora, que é o vício do app anterior.
    expect(p, "sumiu o freio contra virar elogio").toContain("EVIDÊNCIA DE CAPACIDADE, não elogio");
  });

  it("M1 · sem conquista gravada, nenhum bloco aparece", async () => {
    const m = familiaComCatalogo();
    await turno(m, "ela tá difícil na hora de sair de casa");
    expect(systemMaisTurno(m)).not.toContain("ja_conquistou");
  });

  /**
   * ⚠️ RECORTE POR MEMBRO. Numa lista de capacidades, atribuir a conquista do
   * irmão à criança em foco é pior do que não ter lista nenhuma — a mãe lê que
   * a Ayla não sabe de quem está falando.
   */
  it("M1 · a conquista do IRMÃO não entra no turno desta criança", async () => {
    const m = montarMundo({
      nomeMae: "Ana",
      criancas: [
        { nome: "Geovanna", nascimento: "2020-03-10", sabe: { essencial: "Geovanna, 6 anos" } },
        { nome: "Mario", nascimento: "2018-01-05", sabe: { essencial: "Mario, 8 anos" } },
      ],
    });
    m.db.semear("diarios", [
      {
        family_account_id: m.familyId,
        membro_atipico_id: m.membros.Mario,
        data: new Date().toISOString().slice(0, 10),
        origem: "ayla",
        conquista: "MARIO andou de bicicleta sem rodinhas",
      },
    ]);
    await turno(m, "a Geovanna tá difícil na hora de sair de casa", m.membros.Geovanna);
    expect(
      systemMaisTurno(m),
      "vazou a conquista do irmão para o turno da Geovanna",
    ).not.toContain("MARIO andou de bicicleta");
  });

  it("M1 · o fechamento da investigação chega ao modelo", async () => {
    const m = familiaComCatalogo();
    await turno(m, "ela brigou com uma amiga na escola semana passada");
    const s = systemMaisTurno(m);
    expect(s, "o fechamento da investigação sumiu — a conversa não converge").toContain(
      "FECHE A INVESTIGAÇÃO QUANDO ELA CONVERGIR",
    );
    expect(s, "sumiu a devolução do mérito à mãe").toContain("DEVOLVENDO O MÉRITO A ELA");
    expect(s, "sumiu o freio contra ler a mente da criança").toContain(
      "CONECTAR NÃO É LER A MENTE DA CRIANÇA",
    );
    // A segunda porta e a regra do avesso, que é o que impede o tique.
    expect(s, "sumiu a tradução de comportamento").toContain("A SEGUNDA PORTA: TRADUZIR COMPORTAMENTO");
    expect(s, "sumiu a regra do avesso — a lista vira tique").toContain("QUANDO NÃO LISTAR");
  });

  /**
   * M3 · O QUE A COMPARAÇÃO COM O APP ANTERIOR ENSINOU (13/08/2026).
   *
   * A conversa dele sobre a mesma briga produziu um plano inteiro de contenção
   * de AGRESSÃO — "bate", "quer bater", "sua filha é agressiva" — a partir de
   * uma mãe que só tinha dito "brigou". Nada foi relatado; tudo foi suposto. E
   * o plano tratou o problema errado enquanto ensinava aquela mãe a enxergar na
   * filha algo que ela não tinha visto.
   *
   * As outras três regras vêm do que faltou na NOSSA resposta, medida: ela
   * trabalhou a entrada e deixou a criança sem saída pra próxima vez.
   */
  it("M3 · as quatro regras novas chegam ao modelo", async () => {
    const m = familiaComCatalogo();
    await turno(m, "ela brigou com uma amiga na escola semana passada");
    const s = systemMaisTurno(m);
    expect(s, "sumiu o freio contra inventar o comportamento").toContain(
      "NÃO INVENTE O COMPORTAMENTO",
    );
    // ⚠️ Sem aspas no trecho: o payload é `JSON.stringify`, e `"Brigou"` chega
    // escapado como `\"Brigou\"`. Casar com aspas falha por motivo errado.
    expect(s, "sumiu o exemplo que dá o tamanho do dano").toContain(
      "não é bater — no Brasil quase sempre quer dizer discussão",
    );
    expect(s, "sumiu o alvo na habilidade — volta a tratar só o sintoma").toContain(
      "PROCURE A HABILIDADE POR TRÁS DA CENA",
    );
    expect(s, "sumiu a distinção cena × habilidade — a saída não transfere").toContain(
      "NOMEIE A HABILIDADE NO NÍVEL QUE TRANSFERE",
    );
    expect(s, "sumiu a separação agora × aprendizado").toContain("AGORA × APRENDIZADO");
    expect(s, "sumiu o freio contra virar tudo em déficit").toContain("NÃO PRESUMA DÉFICIT");
    expect(s, "sumiu a porta de esclarecer a palavra").toContain(
      "A TERCEIRA PORTA: ESCLARECER A PALAVRA",
    );
    expect(s, "sumiu o repertório — sobra conduta pra mãe executar").toContain(
      "REPERTÓRIO NÃO É CONDUTA",
    );
    expect(s, "sumiu o freio contra inventar a história da mãe").toContain(
      "NÃO INVENTE A HISTÓRIA DA MÃE",
    );
    expect(s, "sumiu o motivo colado à pergunta").toContain("DIGA POR QUE ESTÁ PERGUNTANDO");
  });

  /**
   * ⚠️ A ENTREGA MADURA É DA WEB, E SÓ DELA. No WhatsApp são dois balões sem
   * markdown: blocos titulados ali viram parede. Se este teste cair, a exceção
   * vazou de canal — e o vazamento é silencioso, porque o texto é plausível.
   */
  it("M3 · a entrega madura NÃO vaza para o WhatsApp", async () => {
    const m = familiaComCatalogo();
    await turno(m, "ela tá difícil na hora de sair de casa, não sei mais o que fazer");
    expect(systemMaisTurno(m)).not.toContain("QUANDO A CONVERSA JÁ AMADURECEU");
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
