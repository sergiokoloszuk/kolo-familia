/**
 * AS DEZ CONVERSAS NATURAIS — modelo real, roteamento real, fluxo real.
 *
 * ⚠️ O QUE MUDA EM RELAÇÃO A `prova-core-real.test.ts`. Lá o classificador de
 * intenção ia FIXADO, porque a pergunta era "o Core mudou a resposta?" e o
 * insumo precisava ser idêntico entre as duas rodadas. Aqui a pergunta é outra
 * — "a mãe fala naturalmente e a Ayla escolhe bem?" —, e fixar a skill
 * responderia por ela. Então o auxiliar é REAL: parser, intenção e prontidão
 * rodam de verdade, e a skill (logo, a lente) é escolhida pelo produto.
 *
 * ⚠️ O QUE ISTO NÃO É: produção. É o mesmo código, o mesmo prompt e o mesmo
 * modelo, com banco em memória e uma família sintética. Serve para julgar a
 * QUALIDADE das respostas e para ver qual lente cada relato acorda — não serve
 * como smoke de deploy, que exige o ambiente publicado e uma pessoa.
 *
 * Continua DESLIGADO sem `PROVA_REAL`.
 *
 *   PROVA_REAL=1 PROVA_SAIDA=... npx vitest run src/lib/ayla/prova-conversas-real.test.ts
 */

import { writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { montarMundo, inboundDe, type Mundo } from "./__harness/cenario";
import {
  ACERVO_PROVA,
  bpsNoPrompt,
  carregarEnvLocal,
  medirTexto,
  type CapturaConversa,
} from "./__harness/prova-real";

carregarEnvLocal(process.cwd());

const mundoRef: { atual: Mundo | null } = { atual: null };
const capturas: CapturaConversa[] = [];
const chamadasIA: string[] = [];

vi.mock("./whatsappSender", () => ({
  enviarTexto: async (p: { phoneE164: string; texto: string }) => {
    mundoRef.atual?.enviadas.push({ para: p.phoneE164, texto: p.texto });
    return { ok: true, messageId: `zaap-out-${mundoRef.atual?.enviadas.length}` };
  },
  enviarImagem: async () => ({ ok: true, messageId: "img" }),
  enviarDocumento: async () => ({ ok: true, messageId: "doc" }),
}));

vi.mock("./lote-inbound", () => ({
  aguardarTurnoDaMae: async (_s: unknown, p: { textoAtual: string }) => ({
    texto: p.textoAtual,
    ids: [],
  }),
  descartarTurnoPendente: async () => {},
}));

vi.mock("@/lib/ai/prompts", () => ({ getSystemPrompt: async (_k: string, f: string) => f }));

/**
 * ⚠️ O GERADOR DA ROTINA CONTINUA SUBSTITUÍDO, e só ele. Não é para poupar
 * chamada: é que ele monta o próprio cliente e PUBLICA um quadro. Um teste de
 * conversa que gera artefato mede outra coisa — e §M da régua pergunta
 * justamente se a Ayla empurrou artefato sem necessidade, o que se lê no
 * ROTEAMENTO até aqui, não no quadro gerado.
 */
vi.mock("@/lib/ludico/rotina-servico", () => ({
  gerarRotina: async () => ({ desfecho: "nao_gerou", rotinas: [], fala: null }),
}));

/** O produtor conversacional é REAL — só instrumentado. */
vi.mock("@/lib/ia/provider", async (original) => {
  const real = (await original()) as Record<string, unknown>;
  const gerar = real.gerarConversacional as (p: unknown) => Promise<CapturaConversa>;
  return {
    ...real,
    gerarConversacional: async (p: { system: string; messages: Array<{ content: unknown }> }) => {
      const t0 = Date.now();
      chamadasIA.push("conversa");
      const r = (await gerar(p)) as unknown as CapturaConversa;
      capturas.push({
        system: p.system,
        user: JSON.stringify(p.messages),
        texto: r.texto,
        provider: r.provider,
        model: r.model,
        tokensIn: r.tokensIn,
        tokensOut: r.tokensOut,
        cacheRead: r.cacheRead ?? 0,
        ms: Date.now() - t0,
      });
      return r;
    },
  };
});

/**
 * O auxiliar (parser · intenção · prontidão) também é REAL — só contado.
 * É ele que escolhe a skill, e portanto a lente. Fixá-lo aqui responderia a
 * pergunta desta prova antes de fazê-la.
 */
vi.mock("./anthropic", async (original) => {
  const real = (await original()) as Record<string, unknown>;
  const obter = real.getAylaAnthropicClient as () => {
    messages: {
      create: (a: unknown) => Promise<unknown>;
      stream: (a: unknown) => { finalMessage: () => Promise<unknown> };
    };
  };
  return {
    ...real,
    getAylaAnthropicClient: () => {
      const c = obter();
      return {
        messages: {
          create: async (a: unknown) => {
            chamadasIA.push("auxiliar");
            return c.messages.create(a);
          },
          stream: (a: unknown) => {
            chamadasIA.push("auxiliar");
            return c.messages.stream(a);
          },
        },
      };
    },
  };
});

const { processInbound } = await import("./orchestrator");

/** Daniel, 6 anos — o mesmo perfil da prova do Core, com acervo semeado. */
function familiaDaniel() {
  const m = montarMundo({
    nomeMae: "Juliana",
    criancas: [
      {
        nome: "Daniel",
        nascimento: "2020-02-10",
        genero: "masculino",
        sabe: {
          essencial: "Daniel, 6 anos, autista (laudo); mora com a mãe e o irmão mais velho",
          sensorial:
            "busca muito input oral e de textura; não gosta de barulho alto; adora coisas que vibram",
          como_e: "gosta muito de dinossauros e de água; fala pouco, usa frases curtas",
          corpo_rotina: "escola de manhã, terapia às terças; fica mais agitado no fim da tarde",
        },
        extras: { desafios_onboarding: ["autorregulação", "comunicação"] },
      },
    ],
  });
  m.db.semear("boas_praticas", ACERVO_PROVA.map((b) => ({ ...b })));
  return m;
}

async function turno(m: Mundo, texto: string) {
  mundoRef.atual = m;
  const antesEnviadas = m.enviadas.length;
  const antesCapturas = capturas.length;
  const antesIA = chamadasIA.length;
  const t0 = Date.now();

  const r = await processInbound(m.db.cliente(), inboundDe(m, texto));

  const msTurno = Date.now() - t0;
  const saida = m.db.linhas("ayla_messages").filter((x) => x.direcao === "outbound");
  const tipo = (saida[saida.length - 1]?.tipo as string | undefined) ?? null;
  expect(r.tratada, `[${texto}] o turno NÃO foi tratado`).toBe(true);
  expect(m.enviadas.length, `[${texto}] o turno não respondeu — teste vazio`).toBeGreaterThan(
    antesEnviadas,
  );
  expect(tipo, `[${texto}] o portão de assinatura respondeu no lugar do fluxo`).not.toBe(
    "assinatura_nudge",
  );
  const resposta = m.enviadas.slice(antesEnviadas).map((e) => e.texto).join("\n");

  /**
   * ⚠️ TURNO SEM PRODUTOR NÃO É FALHA DO ARNÊS — É ACHADO.
   *
   * A primeira rodada abortou aqui, no relato "se eu mudo alguma coisa do que
   * estava combinado ela se desorganiza": o turno FOI tratado e RESPONDEU, mas
   * por outro caminho — nenhuma chamada conversacional. Estourar apaga
   * justamente o dado mais interessante da observação (um relato natural que
   * um portão captura antes da conversa) e joga fora as nove medições
   * anteriores, que já estavam pagas.
   *
   * Então registra-se e segue. As guardas anti-teste-vazio acima continuam
   * valendo: sem resposta, ou com o portão de assinatura respondendo, ainda
   * estoura.
   */
  if (capturas.length === antesCapturas) {
    return {
      mensagem: texto,
      resposta,
      ...medirTexto(resposta),
      tipo,
      semProdutor: true,
      lentes: [] as string[],
      temLente: false,
      bps: [] as string[],
      temRepertorio: false,
      rotinasCriadas: m.db.linhas("rotinas").length,
      planosCriados: m.db.linhas("planos").length,
      model: null,
      tokensIn: 0,
      tokensOut: 0,
      cacheRead: 0,
      msModelo: 0,
      msTurno,
      chamadasIA: chamadasIA.length - antesIA,
      chamadasConversa: 0,
    };
  }

  const c = capturas[capturas.length - 1];
  // A lente que chegou, lida do que FOI ENVIADO ao modelo — não de uma
  // variável interna. Se a injeção mudar de lugar, isto continua medindo certo.
  const lentes = [...c.user.matchAll(/\\n([A-ZÀ-Ú][A-ZÀ-Ú ÇÕÃÉ]+)\. OLHE:/g)].map((x) => x[1].trim());
  return {
    semProdutor: false,
    mensagem: texto,
    resposta,
    ...medirTexto(resposta),
    tipo,
    lentes,
    temLente: /lente_profissional/.test(c.user),
    bps: bpsNoPrompt(c.user, ACERVO_PROVA),
    temRepertorio: /<repertorio_kolo>/.test(c.user),
    rotinasCriadas: m.db.linhas("rotinas").length,
    planosCriados: m.db.linhas("planos").length,
    model: c.model,
    tokensIn: c.tokensIn,
    tokensOut: c.tokensOut,
    cacheRead: c.cacheRead,
    msModelo: c.ms,
    msTurno,
    chamadasIA: chamadasIA.length - antesIA,
    chamadasConversa: capturas.length - antesCapturas,
  };
}

/** As dez falas do §6 — como uma mãe falaria, sem nomear skill nem recurso. */
const NATURAIS = [
  "ele está colocando muita coisa na boca, planta, bonecos, papel, plástico",
  "ele não quer entrar na escola",
  "quando perde fica muito bravo e chora",
  "ele não consegue prestar atenção numa história, levanta e vai embora",
  "ela só quer comer as mesmas coisas",
  "quando tem muito barulho ele tampa o ouvido",
  "ela não brinca com as outras crianças",
  "está difícil fazer ele tomar banho sozinho",
  "ele demora muito para dormir",
  "se eu mudo alguma coisa do que estava combinado ela se desorganiza",
];

describe.skipIf(!process.env.PROVA_REAL)("AS DEZ CONVERSAS + o caso Daniel", () => {
  it(
    "roda tudo e registra o rastro",
    async () => {
      const resultados = [];
      // Cada fala numa família NOVA: uma conversa não pode herdar o contexto da
      // anterior, senão o 8º relato responde ao 7º e o rastro fica ilegível.
      for (const fala of NATURAIS) {
        resultados.push(await turno(familiaDaniel(), fala));
      }

      // O caso Daniel, dois turnos NA MESMA conversa (§14).
      const m = familiaDaniel();
      const d1 = await turno(m, "ele esta colocando muita coisa na boca, planta, bonecos, papel, plastico");
      const d2 = await turno(m, "fica ansioso. o que devo fazer?");

      const saida = { quando: new Date().toISOString(), naturais: resultados, daniel: [d1, d2] };
      const destino = process.env.PROVA_SAIDA;
      if (destino) writeFileSync(destino, JSON.stringify(saida, null, 2), "utf8");

      // TRAVA P0 — a BP de 0-1 ano não pode ter chegado em NENHUM dos turnos.
      const tudo = capturas.map((c) => c.user).join("\n");
      expect(tudo, "TRAVA P0: a BP 0-1 ano chegou ao modelo").not.toContain(
        "é assim que o bebê aprende textura",
      );
      // E nenhuma conversa natural pode ter produzido artefato sozinha.
      for (const r of [...resultados, d1, d2]) {
        expect(r.planosCriados, `[${r.mensagem}] gerou plano sem pedido`).toBe(0);
      }
    },
    900_000,
  );
});
