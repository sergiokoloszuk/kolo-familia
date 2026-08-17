import { describe, it, expect, vi, beforeEach } from "vitest";
import { BancoMemoria } from "./__harness/banco-memoria";

/**
 * A ROTINA É CONSTRUÍDA **COM** A FAMÍLIA — 17/08/2026.
 *
 * ═══ O CASO QUE PAGOU POR ESTE ARQUIVO ═══
 *
 * Manu, 17/08/2026, produção. A mãe escreveu: "hoje ela tem que tomar uma
 * vacina, uma coisa meio chata, dolorida, e eu queria mostrar pra ela uma
 * sequência visual que ajude ela, sabe? O QUE VOCÊ SUGERE?"
 *
 * Vinte e dois segundos depois havia um quadro no banco, com quatro etapas que
 * a Ayla inventou — incluindo "Escolher a recompensa combinada", uma barganha
 * que ninguém combinou. A mãe então disse "Vamos tomar sorvete depois", e a
 * frase virou o **tema visual dos cartões**: os desenhos foram gerados no tema
 * `"Vamos tomar sorvete depois"`. O tema que ela realmente escolheu ("Tema
 * aventureiro") chegou 7 segundos depois e nunca foi aplicado.
 *
 * Três defeitos, e este arquivo prende os três:
 *
 *   1. GERAR CEDO DEMAIS — a proposta do condutor era descartada quando a
 *      prontidão dizia "suficiente" (`mensagem = ""`), e a regra CONFIRMAR OU
 *      MONTAR, escrita no contrato desde 08/08, nunca chegava à família.
 *   2. SEGUNDA PORTA — `acao === "montar"` do modelo autorizava a geração
 *      sozinho, por cima de uma prontidão que dizia "falta".
 *   3. TEMA COMENDO A SEQUÊNCIA — qualquer mensagem curta virava tema enquanto
 *      uma rotina esperava tema, inclusive aceites e correções.
 *
 * ═══ O QUE ESTE ARQUIVO NÃO É ═══
 *
 * Não é teste de texto de contrato (isso é `rotina-confirmacao.test.ts`). Aqui
 * se exercita `conduzirRotina` de verdade, com banco em memória, e se olha o
 * ESTADO: o que foi gravado, o que chegou ao gerador, o que não foi criado.
 */

// ── O gerador é o duplo: interessa o que ele RECEBE, não o que ele compõe ────
const chamadasGerador: Array<Record<string, unknown>> = [];
vi.mock("@/lib/ludico/rotina-servico", () => ({
  gerarRotina: async (_s: unknown, p: Record<string, unknown>) => {
    chamadasGerador.push(p);
    // Honra a sequência acordada quando ela vem — é exatamente o que o gerador
    // real faz com `propostaAtual`, e é o que este arquivo precisa observar.
    const proposta = p.propostaAtual as
      | Array<{ tarefas: Array<{ texto: string; hora: string | null }> }>
      | null
      | undefined;
    const tarefas = proposta?.[0]?.tarefas?.length
      ? proposta[0].tarefas
      : [{ texto: "Etapa inventada pelo gerador", hora: null }];
    return {
      desfecho: "gerou" as const,
      rotinas: [{ nome: "Hora da vacina", dia_semana: null, tarefas }],
      tema: null,
    };
  },
}));

vi.mock("./ponte", () => ({ gerarMagicLink: async () => "https://link.teste/x" }));
vi.mock("./whatsappSender", () => ({
  enviarDocumento: async () => ({ messageId: "m1" }),
  enviarTexto: async () => ({ messageId: "m1", raw: {} }),
}));

// ── O modelo é o duplo: cada cenário DIZ o que a prontidão e o condutor fazem ─
type Cenario = {
  prontidao: "suficiente" | "falta" | "nao_e_rotina" | "limite_atuacao";
  tamanho?: "orientacao" | "mini" | "rotina";
  acao: "montar" | "perguntar" | "responder" | "sair";
  mensagem?: string;
  proposta?: Array<{ texto: string; hora?: string }>;
};
let cenario: Cenario;

vi.mock("./anthropic", () => ({
  AYLA_MODEL: "modelo-leve",
  AYLA_MODEL_FALLBACK: "modelo-condutor",
  getAylaAnthropicClient: () => ({
    messages: {
      create: async (args: { system?: string }) => {
        const s = String(args.system ?? "");
        // A PRONTIDÃO se reconhece pelo próprio contrato dela.
        if (/Você decide se a Ayla já pode MONTAR/.test(s)) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  desfecho: cenario.prontidao,
                  tamanho: cenario.tamanho ?? "rotina",
                  visual: true,
                  reusaHistorico: false,
                  pergunta: cenario.prontidao === "falta" ? "como costuma ser?" : null,
                  motivo: "cenário de teste",
                }),
              },
            ],
            usage: { input_tokens: 1, output_tokens: 1 },
          };
        }
        // O CONDUTOR devolve pela ferramenta, como em produção.
        return {
          content: [
            {
              type: "tool_use",
              name: "conduzir_rotina",
              input: {
                acao: cenario.acao,
                mensagem: cenario.mensagem ?? "Certo.",
                recorrente: false,
                ...(cenario.proposta
                  ? { proposta: cenario.proposta.map((e) => ({ texto: e.texto, hora: e.hora })) }
                  : {}),
              },
            },
          ],
          usage: { input_tokens: 1, output_tokens: 1 },
        };
      },
    },
  }),
}));

const {
  conduzirRotina,
  lerTemaEscolhido,
  ehAceitePuro,
  lerRespostaAProposta,
  propostaPendente,
} = await import("./rotina-guiada");

const FAM = "fam-1";
const MEMBRO = "membro-1";
let db: BancoMemoria;

function semearFamilia() {
  db = new BancoMemoria();
  db.semear("family_accounts", [{ id: FAM, whatsapp_e164: "+5511900000000" }]);
  db.semear("family_profiles", [{ family_account_id: FAM, nome_mae: "Karina" }]);
  db.semear("membros_atipicos", [
    {
      id: MEMBRO,
      family_account_id: FAM,
      ativo: true,
      nome: "Manu",
      data_nascimento: "2020-01-10",
    },
  ]);
}

/** Grava a proposta como o orquestrador grava: tipo + metadata.proposta. */
function semearProposta(etapas: string[], quando = new Date().toISOString()) {
  db.semear("ayla_messages", [
    {
      family_account_id: FAM,
      membro_atipico_id: MEMBRO,
      direcao: "outbound",
      tipo: "rotina_proposta",
      texto: "Eu faria assim:",
      metadata: { proposta: etapas.map((texto) => ({ texto, hora: null })) },
      created_at: quando,
    },
  ]);
}

beforeEach(() => {
  chamadasGerador.length = 0;
  semearFamilia();
  cenario = { prontidao: "suficiente", acao: "montar" };
});

const conduzir = (texto: string) =>
  conduzirRotina(db.cliente() as never, {
    familyId: FAM,
    membroAtipicoId: MEMBRO,
    contexto: texto,
    phoneE164: "+5511900000000",
  });

const rotinasCriadas = () => db.linhas("rotinas").length;

// ═══════════════════════════════════════════════════════════════════════════
describe("1 · a família ditou a sequência → monta direto, sem burocracia", () => {
  it("MORDE: não vira interrogatório nem proposta desnecessária", async () => {
    cenario = { prontidao: "suficiente", acao: "montar", mensagem: "Montei aqui 🌿" };
    const r = await conduzir(
      "Quero uma rotina: acordar, banheiro, vestir, café e escola.",
    );
    expect(r?.pronto, "a sequência era dela e mesmo assim não montou").toBe(true);
    expect(chamadasGerador.length).toBe(1);
    expect(r?.proposta, "não devia propor: a sequência já era dela").toBeUndefined();
    expect(rotinasCriadas()).toBe(1);
  });
});

describe("2 · a Ayla inferiu a sequência → propõe e NÃO gera", () => {
  it("MORDE: o caso da vacina não cria artefato no primeiro turno", async () => {
    cenario = {
      prontidao: "suficiente",
      acao: "perguntar",
      mensagem: "Entendi — dá pra deixar isso mais previsível pra ela.",
      proposta: [
        { texto: "Chegar ao posto" },
        { texto: "Esperar a nossa vez" },
        { texto: "Preparar o braço" },
        { texto: "Tomar a vacina" },
        { texto: "Terminou" },
      ],
    };
    const r = await conduzir(
      "Hoje ela vai tomar uma vacina, é uma coisa meio chata e dolorida, e eu queria mostrar uma sequência visual que ajude. O que você sugere?",
    );

    expect(r?.pronto, "GEROU antes de a mãe poder participar").toBe(false);
    expect(chamadasGerador.length, "o gerador foi chamado sem aceite").toBe(0);
    expect(rotinasCriadas(), "criou rotina no banco antes da confirmação").toBe(0);

    // A proposta chega à família E volta estruturada pra ser persistida.
    expect(r?.proposta?.map((e) => e.texto)).toEqual([
      "Chegar ao posto",
      "Esperar a nossa vez",
      "Preparar o braço",
      "Tomar a vacina",
      "Terminou",
    ]);
    expect(r?.mensagem).toContain("1. Chegar ao posto");
    expect(r?.mensagem).toContain("4. Tomar a vacina");
    expect(r?.mensagem, "não abriu espaço real pra corrigir").toMatch(/mudaria alguma parte|\?/);
  });

  it("MORDE: a proposta descartada não volta — a fala do condutor sobrevive", async () => {
    cenario = {
      prontidao: "suficiente",
      acao: "perguntar",
      mensagem: "Pensei numa sequência curta pra isso.",
      proposta: [{ texto: "Guardar o tablet" }, { texto: "Banho" }],
    };
    const r = await conduzir("ele trava na hora do banho todo dia");
    // Era exatamente isto que `mensagem = ""` matava.
    expect(r?.mensagem).toContain("Pensei numa sequência curta");
  });
});

describe("3 · a mãe responde à proposta", () => {
  it('MORDE: "sim" gera a sequência proposta — e NÃO vira tema', async () => {
    semearProposta(["Chegar ao posto", "Tomar a vacina", "Terminou"]);
    cenario = { prontidao: "falta", acao: "montar", mensagem: "Combinado 🌿" };

    const r = await conduzir("sim");
    expect(r?.pronto).toBe(true);
    expect(chamadasGerador.length).toBe(1);

    // A sequência ACORDADA chegou ao gerador — não uma recomposta do zero.
    const proposta = chamadasGerador[0]!.propostaAtual as Array<{
      tarefas: Array<{ texto: string }>;
    }>;
    expect(proposta[0]!.tarefas.map((t) => t.texto)).toEqual([
      "Chegar ao posto",
      "Tomar a vacina",
      "Terminou",
    ]);
  });

  it('MORDE: "depois sorvete" entra na SEQUÊNCIA, nunca como tema', async () => {
    semearProposta(["Chegar ao posto", "Tomar a vacina", "Terminou"]);
    cenario = { prontidao: "falta", acao: "montar", mensagem: "Anotei o sorvete 🍦" };

    const r = await conduzir("Vamos tomar sorvete depois");
    expect(r?.pronto, "a correção da mãe não produziu artefato").toBe(true);

    // Nenhuma rotina foi marcada com esse texto como TEMA — o defeito da Manu.
    for (const rot of db.linhas("rotinas")) {
      expect(String(rot.tema ?? ""), "a frase da sequência virou TEMA de novo").not.toMatch(
        /sorvete/i,
      );
    }
    // E o condutor recebeu a instrução de tratar aquilo como etapa.
    expect(chamadasGerador.length).toBe(1);
  });

  it("MORDE: uma etapa alterada chega ao artefato", async () => {
    semearProposta(["Guardar o tablet", "Banho", "Jantar"]);
    cenario = { prontidao: "falta", acao: "montar", mensagem: "Troquei a ordem." };
    const r = await conduzir("troca banho por jantar");
    expect(r?.pronto).toBe(true);
    expect(chamadasGerador[0]!.propostaAtual).toBeTruthy();
  });

  it("MORDE: com proposta na mesa, o portão do TEMA não roda", async () => {
    // Uma rotina esperando tema E uma proposta pendente ao mesmo tempo: é a
    // colisão exata do caso Manu. A sequência tem precedência.
    db.semear("rotinas", [
      {
        id: "rot-antiga",
        family_account_id: FAM,
        membro_atipico_id: MEMBRO,
        nome: "Hora da vacina",
        cards_status: "aguardando",
        updated_at: new Date().toISOString(),
        tema: null,
      },
    ]);
    semearProposta(["Chegar ao posto", "Tomar a vacina"]);
    cenario = { prontidao: "falta", acao: "montar", mensagem: "ok" };

    await conduzir("Vamos tomar sorvete depois");
    const antiga = db.linhas("rotinas").find((r) => r.id === "rot-antiga");
    expect(antiga?.tema, "o tema foi aplicado com a frase da sequência").toBeFalsy();
  });
});

describe("4 · o tema, quando é mesmo o tema", () => {
  it("MORDE: sem proposta pendente, a escolha do tema é aplicada", async () => {
    db.semear("rotinas", [
      {
        id: "rot-1",
        family_account_id: FAM,
        membro_atipico_id: MEMBRO,
        nome: "Hora da vacina",
        cards_status: "aguardando",
        updated_at: new Date().toISOString(),
        tema: null,
      },
    ]);
    const r = await conduzir("Tema aventureiro");
    const rot = db.linhas("rotinas").find((x) => x.id === "rot-1");
    expect(rot?.tema).toBe("aventureiro");
    expect(r?.pronto).toBe(true);
  });
});

describe("5 · a segunda porta fechou", () => {
  it("MORDE: prontidão diz FALTA e o modelo diz MONTAR → não gera", async () => {
    cenario = { prontidao: "falta", acao: "montar", mensagem: "Vou montar!" };
    const r = await conduzir("me ajuda com a rotina dele");
    expect(r?.pronto, "o modelo autorizou a geração sozinho").toBe(false);
    expect(chamadasGerador.length).toBe(0);
    expect(rotinasCriadas()).toBe(0);
  });

  it("MORDE: prontidão FALHA (fallback 'falta') e o modelo insiste → não gera", async () => {
    // O fallback de erro da prontidão é "falta". Antes ele não protegia nada:
    // o modelo passava por cima. Agora protege.
    cenario = { prontidao: "falta", acao: "montar" };
    const r = await conduzir("preciso de rotina");
    expect(chamadasGerador.length).toBe(0);
    expect(r?.pronto).toBe(false);
  });

  it("frase incidental sobre rotina não cria artefato", async () => {
    cenario = { prontidao: "nao_e_rotina", acao: "responder" };
    const r = await conduzir("a rotina aqui está corrida");
    expect(r, "conduziu uma rotina a partir de um comentário").toBeNull();
    expect(rotinasCriadas()).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("6 · REGRESSÃO — vacina → sorvete → aventureiro (caso Manu)", () => {
  it("os três turnos preservam sequência E tema", async () => {
    // ── TURNO 1: a mãe pede uma sugestão ───────────────────────────────────
    cenario = {
      prontidao: "suficiente",
      acao: "perguntar",
      mensagem: "Entendi, dá pra deixar mais previsível.",
      proposta: [
        { texto: "Chegar ao posto" },
        { texto: "Esperar a nossa vez" },
        { texto: "Tomar a vacina" },
        { texto: "Colocar o algodão" },
      ],
    };
    const t1 = await conduzir(
      "Hoje ela vai tomar uma vacina, é uma coisa meio chata e dolorida, e eu queria mostrar uma sequência visual que ajude. O que você sugere?",
    );
    expect(t1?.pronto, "TURNO 1 gerou — a mãe não pôde participar").toBe(false);
    expect(rotinasCriadas(), "TURNO 1 criou artefato").toBe(0);
    expect(t1?.proposta?.length).toBe(4);
    // Nada de barganha inventada.
    expect(JSON.stringify(t1?.proposta)).not.toMatch(/recompensa|pr[êe]mio/i);

    // O orquestrador persistiria assim — é o contrato entre os dois.
    semearProposta(t1!.proposta!.map((e) => e.texto));
    expect(await propostaPendente(db.cliente() as never, FAM)).not.toBeNull();

    // ── TURNO 2: "Vamos tomar sorvete depois" ──────────────────────────────
    cenario = {
      prontidao: "falta", // a prontidão sozinha NÃO autorizaria; a família autoriza
      acao: "montar",
      mensagem: "Boa — fechar com o sorvete ajuda ela a atravessar a parte chata.",
    };
    const t2 = await conduzir("Vamos tomar sorvete depois");
    expect(t2?.pronto, "TURNO 2 não montou depois do aceite da mãe").toBe(true);
    expect(chamadasGerador.length).toBe(1);

    // A sequência que chegou ao gerador é a que a mãe viu.
    const enviada = chamadasGerador[0]!.propostaAtual as Array<{
      tarefas: Array<{ texto: string }>;
    }>;
    expect(enviada[0]!.tarefas.map((t) => t.texto)).toEqual([
      "Chegar ao posto",
      "Esperar a nossa vez",
      "Tomar a vacina",
      "Colocar o algodão",
    ]);
    // E "sorvete" NÃO virou tema de coisa nenhuma.
    for (const rot of db.linhas("rotinas")) {
      expect(String(rot.tema ?? "")).not.toMatch(/sorvete/i);
    }

    // ── TURNO 3: "Tema aventureiro" ────────────────────────────────────────
    // A rotina existe e espera tema; não há mais proposta pendente (a última
    // mensagem de rotina passou a ser a montagem).
    const rotId = db.linhas("rotinas")[0]!.id as string;
    db.semear("ayla_messages", [
      {
        family_account_id: FAM,
        membro_atipico_id: MEMBRO,
        direcao: "outbound",
        tipo: "rotina_conversa",
        texto: "Prontinho — montei a rotina 🌿",
        created_at: new Date(Date.now() + 1000).toISOString(),
      },
    ]);
    db.linhas("rotinas")[0]!.cards_status = "aguardando";
    db.linhas("rotinas")[0]!.updated_at = new Date().toISOString();

    const t3 = await conduzir("Tema aventureiro");
    const rot = db.linhas("rotinas").find((x) => x.id === rotId);
    expect(rot?.tema, "o tema real da mãe se perdeu").toBe("aventureiro");
    expect(t3?.pronto).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("7 · o que é aceite, o que é sequência, o que é tema", () => {
  const ACEITES = ["sim", "isso", "isso mesmo", "pode ser", "perfeito", "ficou bom", "ok"];
  const SEQUENCIA = [
    "Vamos tomar sorvete depois",
    "depois sorvete",
    "não, primeiro o banho",
    "falta o lanche",
    "e no final o sorvete",
  ];
  const TEMAS = ["Tema aventureiro", "aventureiro", "dinossauros", "fundo do mar", "princesas"];

  for (const t of ACEITES) {
    it(`"${t}" é ACEITE e nunca tema`, () => {
      expect(ehAceitePuro(t), `"${t}" deixou de ser aceite`).toBe(true);
      expect(lerTemaEscolhido(t), `"${t}" virou TEMA`).toBeNull();
      expect(lerRespostaAProposta(t)).toBe("aceite");
    });
  }

  for (const t of SEQUENCIA) {
    it(`"${t}" é SEQUÊNCIA e nunca tema`, () => {
      expect(lerTemaEscolhido(t), `"${t}" virou TEMA — é o defeito da Manu`).toBeNull();
      expect(lerRespostaAProposta(t)).toBe("ajuste");
    });
  }

  for (const t of TEMAS) {
    it(`"${t}" continua sendo TEMA`, () => {
      expect(lerTemaEscolhido(t), `"${t}" deixou de ser reconhecido como tema`).toBeTruthy();
    });
  }

  it("MORDE: a frase exata que quebrou em produção", () => {
    expect(lerTemaEscolhido("Vamos tomar sorvete depois")).toBeNull();
  });
});
