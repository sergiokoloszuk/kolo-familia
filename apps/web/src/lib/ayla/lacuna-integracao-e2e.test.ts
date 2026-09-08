import { beforeAll, describe, expect, it, vi } from "vitest";
import { inboundDe, montarMundo, type Mundo } from "./__harness/cenario";
import { clienteFalso, type Registro } from "./__harness/modelo";

/**
 * GATE B PELO CAMINHO VIVO — `processInbound` de verdade, cinco turnos.
 *
 * ⚠️ POR QUE ISTO EXISTE, e o que ele prova a mais que `lacuna-decisiva.test.ts`.
 * Aquele arquivo prova o MECANISMO: dado um perfil, um tema e um histórico,
 * qual campo vale a pergunta. Prova a função. Não prova o TURNO — entre a
 * mensagem da mãe e a lacuna gravada há resolução de criança, leitura de
 * perfil, decisor de turno, montagem de prompt, resposta do modelo,
 * `deveGravarLacuna` e uma escrita em `ayla_messages.metadata`. Qualquer um
 * desses elos pode partir com a função inteira correta.
 *
 * A regra da missão: não mockar justamente as camadas que se quer provar.
 * Então ficam REAIS `escolherLacunaDecisiva`, `jaRespondidas`,
 * `perfilConsultavelDaLinha`, `blocoDaLacuna`, `deveGravarLacuna`, a montagem
 * do prompt, a persistência do `metadata` e o rastro `lacuna_decisao`.
 *
 * Ficam falsos, como em `conversa-e2e.test.ts`, apenas os que custam rede ou
 * dinheiro: o WhatsApp, o provedor do modelo e o lote de inbound.
 *
 * ⚠️ O QUE ISTO NÃO PROVA: que um modelo real perguntaria o que a lacuna
 * sugere. A fala vem roteirizada — de propósito, porque a variável que este
 * arquivo mede é a DECISÃO, e a fala é justamente o que precisa ficar fixo
 * para a decisão poder ser lida.
 */

// ── OS DUPLOS ────────────────────────────────────────────────────────────
const registros: Registro[] = [];
const mundoRef: { atual: Mundo | null; alvo: string | null } = { atual: null, alvo: null };

/** O que o cenário manda a Ayla FALAR e o decisor de turno DECIDIR. */
const roteiro: { fala: string; skills: string[] } = { fala: "", skills: [] };

/** Todo evento que o turno emitiu — é daqui que sai o rastro do decisor. */
const eventos: Array<{ kind: string; message?: string; payload?: Record<string, unknown> }> = [];

/** Toda tabela tocada no turno — a prova de que o perfil é lido UMA vez. */
const acessos: string[] = [];

vi.mock("@/lib/log", () => ({
  logEvent: async (e: { kind: string; message?: string; payload?: Record<string, unknown> }) => {
    eventos.push(e);
  },
  logServerError: async () => {},
}));

vi.mock("./whatsappSender", () => ({
  enviarTexto: async (p: { phoneE164: string; texto: string }) => {
    mundoRef.atual?.enviadas.push({ para: p.phoneE164, texto: p.texto });
    return { ok: true, messageId: `zaap-out-${mundoRef.atual?.enviadas.length}` };
  },
  enviarImagem: async () => ({ ok: true, messageId: "img" }),
  enviarDocumento: async () => ({ ok: true, messageId: "doc" }),
}));

/**
 * ⚠️ UM MOCK, DOIS CHAMADORES. `decidirTurno` e a conversa passam os dois por
 * `gerarConversacional` — o mesmo provedor, de propósito (ver o comentário em
 * `decisao-do-turno.ts`). Distinguir pelo CONTRATO no system é a mesma
 * disciplina do `__harness/modelo.ts`: quando o contrato mudar, o duplo para de
 * reconhecer e o teste QUEBRA, em vez de passar verde respondendo bobagem.
 */
vi.mock("@/lib/ia/provider", () => ({
  MODELO_CONVERSA: { anthropic: "claude-sonnet-4-6", openai: "gpt-5.6-luna" },
  providerConversacionalParaFamilia: () => "openai",
  gerarConversacional: async (p: { system?: string; messages?: unknown }) => {
    const system = String(p.system ?? "");
    const decisor = /"skills"/.test(system);
    mundoRef.atual?.chamadas.push({
      quem: decisor ? "decisor" : "conversa",
      prompt: JSON.stringify(p),
      mensagem: "",
      notas: [],
    });
    const texto = decisor
      ? JSON.stringify({
          intencao: "outro",
          tema: "emocional",
          aceite: null,
          skills: roteiro.skills,
          pedido_explicito: false,
          continuacao: true,
          necessidade_conhecimento: "nenhum",
          tema_conhecimento: null,
        })
      : roteiro.fala;
    return {
      texto,
      provider: "openai",
      model: "gpt-5.6-luna",
      tokensIn: 100,
      tokensOut: 20,
      cacheRead: 0,
    };
  },
}));

vi.mock("./anthropic", () => ({
  AYLA_MODEL: "claude-haiku-4-5",
  AYLA_MODEL_FALLBACK: "claude-sonnet-4-6",
  getAylaAnthropicClient: () => clienteFalso({ alvo: mundoRef.alvo }, registros),
}));

vi.mock("./lote-inbound", () => ({
  aguardarTurnoDaMae: async (_s: unknown, p: { textoAtual: string }) => ({
    texto: p.textoAtual,
    ids: [],
  }),
  descartarTurnoPendente: async () => {},
}));

vi.mock("@/lib/ai/prompts", () => ({ getSystemPrompt: async (_k: string, f: string) => f }));

const { processInbound } = await import("./orchestrator");

// ── O MUNDO ──────────────────────────────────────────────────────────────

/**
 * ⚠️ O CATÁLOGO PRECISA EXISTIR NO BANCO. `decidirTurno` filtra as skills por
 * `permitidas`, montado de `specialist_prompt_templates` com `ativo=true`. Sem
 * semear, o decisor devolve `skills: []`, o tema não é identificado, e TODO
 * turno cai em NO_ASK — um arquivo inteiro verde provando o nada.
 */
function mundoCom(criancas: Parameters<typeof montarMundo>[0]["criancas"]) {
  const m = montarMundo({ nomeMae: "Ana", criancas });
  m.db.semear("specialist_prompt_templates", [
    { name: "emocional", routing_keywords: ["grito", "birra", "desregula"], ativo: true },
    { name: "comunicacao", routing_keywords: ["fala", "palavras", "gestos"], ativo: true },
    { name: "sono", routing_keywords: ["dormir", "noite"], ativo: true },
  ]);
  return m;
}

/** A Manu do perfil VAZIO — o caso em que a lacuna decisiva tem o que fazer. */
const MANU = { nome: "Manu", nascimento: "2019-04-02", genero: "feminino" };
const MARIO = { nome: "Mario", nascimento: "2017-09-15", genero: "masculino" };

/** O cliente instrumentado: conta quem foi lido, sem alterar o que é lido. */
function clienteContado(m: Mundo) {
  const db = m.db;
  return { from: (t: string) => (acessos.push(t), db.from(t)) } as never;
}

type Linha = Record<string, unknown>;

/** Base do relógio dos turnos — recente, para caber nas janelas do produto. */
const BASE_DO_RELOGIO = Date.now() - 5 * 60 * 1000;

/** Um turno inteiro, e a leitura do que ele DECIDIU e do que ele GRAVOU. */
async function turno(
  m: Mundo,
  texto: string,
  opcoes: { fala: string; skills?: string[]; alvo?: string },
) {
  mundoRef.atual = m;
  mundoRef.alvo = opcoes.alvo ?? Object.values(m.membros)[0] ?? null;
  roteiro.fala = opcoes.fala;
  roteiro.skills = opcoes.skills ?? ["emocional"];
  registros.length = 0;
  eventos.length = 0;
  acessos.length = 0;
  m.chamadas.length = 0;
  const antes = m.enviadas.length;

  const r = await processInbound(clienteContado(m), inboundDe(m, texto));

  /**
   * ⚠️ O RELÓGIO EXPLÍCITO, e o teste que o exigiu.
   *
   * `BancoMemoria` carimba `created_at` no instante do insert, e as duas
   * mensagens de um turno caem no MESMO milissegundo. `jaRespondidas` pareia
   * uma pergunta com a resposta que vem DEPOIS dela, e o caminho vivo ordena
   * por `created_at`: com empate, "depois" vira sorteio. O teste da correção
   * passava sozinho e falhava na suíte completa — instabilidade, não defeito.
   *
   * ⚠️ E NÃO É MASCARAR. Em produção o Postgres carimba com microssegundos e
   * os dois lados de um turno ficam segundos apart; o empate é artefato do
   * duplo. O que fica provado é a dependência REAL: se um dia a ordem das
   * falas chegar embaralhada ao decisor, a continuidade quebra em silêncio.
   */
  const msgs = m.db.linhas("ayla_messages") as Linha[];
  msgs.forEach((linha, i) => {
    linha.created_at = new Date(BASE_DO_RELOGIO + i * 1000).toISOString();
  });

  // ⚠️ AS GUARDAS QUE IMPEDEM O TESTE VAZIO — a mesma disciplina do
  // `conversa-e2e.test.ts`. Um fluxo que aborta no primeiro `return` também
  // grava zero lacunas, e passaria verde dizendo nada.
  expect(r.tratada, "o turno NÃO foi tratado — o fluxo abortou antes de decidir").toBe(true);
  expect(m.enviadas.length, "o turno não respondeu nada — teste vazio").toBeGreaterThan(antes);

  const saida = (m.db.linhas("ayla_messages") as Linha[]).filter((x) => x.direcao === "outbound");
  const ultima = saida[saida.length - 1] ?? null;
  const rastro = eventos.find((e) => e.kind === "lacuna_decisao")?.payload ?? null;
  const promptConversa = m.chamadas.find((c) => c.quem === "conversa")?.prompt ?? "";

  return {
    enviado: m.enviadas[m.enviadas.length - 1]?.texto ?? null,
    /**
     * O caminho que respondeu — sem isto, "experimental" é só o nome do teste.
     *
     * ⚠️ A MARCA VIVE EM `ayla_send_log.payload.meta.ayla_path`, e não em
     * `ayla_messages`. Minha primeira versão leu o lugar errado e o teste
     * acusou `null` enquanto o log do próprio turno dizia "experimental" — a
     * mesma armadilha que `passouPeloExperimental` existe para fechar: o que
     * prova o caminho é o que se leria no banco de produção.
     */
    caminho:
      ((
        (m.db.linhas("ayla_send_log") as Linha[]).at(-1)?.payload ?? null
      ) as { meta?: { ayla_path?: string } } | null)?.meta?.ayla_path ?? null,
    /** A DECISÃO, lida do rastro que produção também teria. */
    rastro: rastro as {
      decisao?: string;
      escolhida?: string | null;
      candidatas?: string[];
      ja_respondidas?: string[];
      corrigidas?: string[];
      perguntou_de_fato?: boolean;
      membro_atipico_id?: string | null;
    } | null,
    /** O que FOI GRAVADO — a memória que o turno seguinte vai ler. */
    gravada: ((ultima?.metadata ?? null) as { lacuna?: string } | null)?.lacuna ?? null,
    /** A lacuna chegou ao prompt do modelo? */
    noPrompt: /<lacuna_decisiva>/.test(promptConversa),
    /** Quantas vezes o perfil foi lido neste turno. */
    leiturasDePerfil: acessos.filter((t) => t === "perfil_vivo_membro").length,
    /** O orçamento do turno, se o rastro externo saiu. */
    orcamento: eventos.find((e) => e.kind === "turno_externo")?.payload ?? null,
  };
}

const COM_PERGUNTA =
  "Antes de mudar a abordagem, vale reparar no que vem logo antes. O que costuma acontecer nesse momento?";
const SEM_PERGUNTA =
  "Nessa hora, o que ajuda e reduzir a exigencia: menos palavras, um aviso curto antes da troca, e a mao disponivel.";

beforeAll(() => {
  process.env.AYLA_EXPERIMENTAL_TODAS = "true";
});

describe("GATE B · os cinco turnos pelo orquestrador vivo", () => {
  it("T1→T5: a cadeia inteira, e nenhuma pergunta repetida", async () => {
    const m = mundoCom([MANU]);
    const perguntadas: string[] = [];
    const tabela: Array<Record<string, unknown>> = [];

    const passos: Array<{ texto: string; fala: string; skills?: string[] }> = [
      { texto: "Ela grita quando eu desligo o tablet.", fala: COM_PERGUNTA },
      { texto: "Acontece quando eu insisto para ela parar de brincar", fala: COM_PERGUNTA },
      { texto: "Ela fica em silencio e bate o pe antes de gritar", fala: COM_PERGUNTA },
      // ⚠️ O TURNO EM QUE A AYLA NÃO PERGUNTA. É o caso que separa DECISÃO de
      // FALA: o decisor pode escolher uma lacuna e o Core §8 mandar ajudar sem
      // perguntar. Nada pode ser gravado aqui.
      { texto: "O que eu faco nessa hora?", fala: SEM_PERGUNTA },
      {
        texto: "E como ensino ela a falar em vez de gritar?",
        fala: COM_PERGUNTA,
        skills: ["emocional", "comunicacao"],
      },
    ];

    for (let i = 0; i < passos.length; i++) {
      const p = passos[i];
      const r = await turno(m, p.texto, { fala: p.fala, skills: p.skills });
      expect(r.caminho, `T${i + 1} não passou pelo caminho novo`).toBe("experimental");
      if (r.gravada) perguntadas.push(r.gravada);
      tabela.push({
        turno: `T${i + 1}`,
        membro: r.rastro?.membro_atipico_id === m.membros.Manu ? "manu" : "—",
        candidatas: r.rastro?.candidatas?.length ?? 0,
        ja_respondidas: r.rastro?.ja_respondidas?.length ?? 0,
        corrigidas: r.rastro?.corrigidas?.length ?? 0,
        decisao: r.rastro?.decisao ?? null,
        escolhida: r.rastro?.escolhida ?? null,
        no_prompt: r.noPrompt,
        perguntou: r.rastro?.perguntou_de_fato ?? false,
        gravada: r.gravada,
        leituras_perfil: r.leiturasDePerfil,
      });
    }

    console.log("TABELA T1–T5\n" + JSON.stringify(tabela, null, 1));

    // A PROVA DO AFUNILAMENTO: nenhuma pergunta se repete, nem com outra redação
    // — porque a chave é o CAMPO, não o texto.
    expect(new Set(perguntadas).size, `repetiu: ${perguntadas.join(", ")}`).toBe(
      perguntadas.length,
    );
    expect(perguntadas.length, "nenhum turno perguntou — o mecanismo não foi exercitado").toBeGreaterThan(1);
    /**
     * A INCERTEZA RELEVANTE CAI — e a régua NÃO é "perguntou menos a cada turno".
     *
     * ⚠️ MEDIDO: T1→T4 caem 14 → 13 → 12 → 11, uma candidata a menos por
     * resposta da família. T5 SOBE para 14, e isso não é regressão: a mãe muda
     * de assunto ("como ensino ela a falar"), `comunicacao` entra como tema e
     * traz candidatas próprias, legítimas. Exigir monotonia aqui premiaria uma
     * Ayla que ignora o assunto novo para manter uma curva bonita.
     *
     * O que se cobra é o que de fato importa: dentro do MESMO tema a incerteza
     * cai, e o que já foi respondido NUNCA volta a ser desconhecido.
     */
    expect(tabela[3].candidatas as number).toBeLessThan(tabela[0].candidatas as number);
    const fechadas = tabela.map((t) => t.ja_respondidas as number);
    expect(fechadas[fechadas.length - 1]).toBeGreaterThan(0);
    for (let i = 1; i < fechadas.length; i++) {
      expect(fechadas[i], `T${i + 1} esqueceu o que a família já tinha respondido`).toBeGreaterThanOrEqual(
        fechadas[i - 1],
      );
    }
    // DECISÃO ≠ FALA: o turno sem pergunta não gravou nada.
    expect(tabela[3].perguntou, "T4 falou sem perguntar e ainda assim marcou").toBe(false);
    expect(tabela[3].gravada).toBeNull();
    // O perfil é lido UMA vez por turno — a garantia do Gate A, no caminho vivo.
    for (const t of tabela) {
      expect(
        t.leituras_perfil as number,
        `${t.turno} leu o perfil mais de uma vez`,
      ).toBeLessThanOrEqual(1);
    }
  });
});

/**
 * A TRAVA DO DEFEITO QUE ESTE ARQUIVO ENCONTROU — 08/09/2026.
 *
 * A âncora do chamador e o registro de entrega ocupavam a MESMA chave em dois
 * objetos literais, e a última vencia. Não dava erro, não dava log: o `insert`
 * voltava sucesso com o campo errado dentro. O teste morde a CONVIVÊNCIA das
 * duas, porque foi a convivência que faltava — provar só que `lacuna` existe
 * deixaria a porta aberta para alguém reintroduzir o mesmo apagamento na outra
 * direção, como já estava na entrega do Plano.
 */
describe("GATE B · a âncora e o registro de entrega convivem", () => {
  it("a mensagem gravada tem lacuna E entrega — nenhuma apaga a outra", async () => {
    const m = mundoCom([MANU]);
    const r = await turno(m, "Ela grita quando eu desligo o tablet.", { fala: COM_PERGUNTA });
    expect(r.caminho).toBe("experimental");
    const saida = (m.db.linhas("ayla_messages") as Linha[]).filter((x) => x.direcao === "outbound");
    const meta = (saida.at(-1)?.metadata ?? null) as Record<string, unknown> | null;
    expect(meta, "a mensagem saiu sem metadata nenhum").toBeTruthy();
    expect(meta?.lacuna, "a lacuna foi apagada pelo registro de entrega").toBe(r.rastro?.escolhida);
    expect(meta?.entrega, "o registro de entrega foi apagado pela lacuna").toBeTruthy();
  });
});

describe("GATE B · a correção da família atravessa o caminho vivo", () => {
  it('"não acontece mais" fecha a lacuna E fica marcada como correção', async () => {
    const m = mundoCom([MANU]);
    await turno(m, "Ela grita quando eu desligo o tablet.", { fala: COM_PERGUNTA });
    // ⚠️ A CORREÇÃO NÃO É SÓ UM FECHAMENTO. Um campo respondido e um campo
    // corrigido têm o mesmo efeito no funil — nenhum dos dois volta a ser
    // perguntado — e significados opostos para quem for auditar depois.
    const r = await turno(m, "Nao, isso nao acontece mais", { fala: COM_PERGUNTA });
    expect(r.rastro?.ja_respondidas, "a correção não fechou a lacuna").toContain(
      "emocional.gatilhos",
    );
    expect(r.rastro?.corrigidas, "a correção não ficou marcada como correção").toContain(
      "emocional.gatilhos",
    );
    expect(r.rastro?.escolhida, "voltou a perguntar o que a família acabou de corrigir").not.toBe(
      "emocional.gatilhos",
    );
  });
});

describe("GATE B · isolamento entre irmãos pelo caminho completo", () => {
  it("o que a mãe respondeu sobre a Manu não fecha lacuna nenhuma do Mario", async () => {
    const m = mundoCom([MANU, MARIO]);
    const manu = m.membros.Manu;
    const mario = m.membros.Mario;

    await turno(m, "A Manu grita quando eu desligo o tablet.", {
      fala: COM_PERGUNTA,
      alvo: manu,
    });
    const daManu = await turno(m, "Acontece quando eu insisto para ela parar de brincar", {
      fala: COM_PERGUNTA,
      alvo: manu,
    });
    expect(daManu.rastro?.ja_respondidas).toContain("emocional.gatilhos");

    // ⚠️ O MESMO HISTÓRICO, OUTRA CRIANÇA. `ayla_messages` é da FAMÍLIA: as
    // falas da Manu estão na mesma tabela e chegam à mesma leitura. O escopo
    // por `membro_atipico_id` é a única coisa entre elas e o Mario.
    const doMario = await turno(m, "O Mario tambem grita, mas em outra hora", {
      fala: COM_PERGUNTA,
      alvo: mario,
    });
    expect(doMario.rastro?.membro_atipico_id).toBe(mario);
    expect(
      doMario.rastro?.ja_respondidas,
      "o Mario herdou o que a mãe respondeu sobre a Manu",
    ).not.toContain("emocional.gatilhos");
    expect(doMario.rastro?.escolhida, "o Mario perdeu a pergunta por causa da Manu").toBe(
      "emocional.gatilhos",
    );
  });
});

describe("GATE B · o custo do mecanismo, no mesmo turno", () => {
  it("nenhuma consulta nova de perfil, no máximo UMA lacuna, e o orçamento sai", async () => {
    const m = mundoCom([MANU]);
    const r = await turno(m, "Ela grita quando eu desligo o tablet.", { fala: COM_PERGUNTA });

    // Uma leitura de perfil — o Gate B não somou nenhuma.
    expect(r.leiturasDePerfil).toBe(1);
    // ZERO OU UMA. A lista do que falta não vai ao prompt; no máximo uma linha vai.
    const promptConversa = m.chamadas.find((c) => c.quem === "conversa")?.prompt ?? "";
    expect((promptConversa.match(/<lacuna_decisiva>/g) ?? []).length).toBeLessThanOrEqual(1);
    // ⚠️ E O RETRATO ANTIGO NÃO PODE TER VOLTADO junto. `<o_que_ainda_nao_sei>`
    // era a lista inteira de campos vazios — exatamente o que o Gate B
    // substituiu. Se ele reaparecer, o prompt voltou a ser um formulário.
    expect(promptConversa).not.toContain("o_que_ainda_nao_sei");

    // O orçamento do turno externo saiu, com o tamanho da ignorância declarado.
    const orc = r.orcamento as { ms?: Record<string, number> } | null;
    expect(orc, "o turno não emitiu orçamento").toBeTruthy();
    expect(orc?.ms).toHaveProperty("nao_medido");
  });
});
