/**
 * PROVA REAL DO CORE PROFISSIONAL — Daniel, dois turnos, modelo pago.
 *
 * ⚠️ NÃO RODA EM `npm test`. O `describe.skipIf` abaixo desliga o arquivo
 * inteiro sem a variável `PROVA_REAL`. Uma chamada paga não pode entrar numa
 * suíte que roda dezenas de vezes por dia — e um arquivo que "só custa quando
 * alguém lembra de não rodar" é um arquivo que vai custar.
 *
 *   npx vitest run src/lib/ayla/prova-core-real.test.ts    → 2 testes pulados
 *   PROVA_REAL=1 npx vitest run src/lib/ayla/prova-core-real.test.ts
 *
 * O resultado sai em JSON no stdout (marcador `##PROVA##`) e em
 * `PROVA_SAIDA`, para que a comparação ANTES × DEPOIS seja feita sobre arquivo,
 * não sobre memória de quem leu o terminal.
 *
 * O que é real e o que é fixado está escrito em `__harness/prova-real.ts`.
 */

import { writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { montarMundo, inboundDe, type Mundo } from "./__harness/cenario";
import {
  ACERVO_PROVA,
  SKILLS_PROVA,
  bpsNoPrompt,
  carregarEnvLocal,
  medirTexto,
  type CapturaConversa,
} from "./__harness/prova-real";

carregarEnvLocal(process.cwd());

const LIGADO = Boolean(process.env.PROVA_REAL);

const mundoRef: { atual: Mundo | null; alvo: string | null } = { atual: null, alvo: null };
const capturas: CapturaConversa[] = [];
/** Toda chamada de modelo do turno — conversacional E auxiliar. */
const chamadasIA: string[] = [];

// ── O QUE FICA FIXO: parser, intenção, prontidão ─────────────────────────
/**
 * ⚠️ O CLASSIFICADOR DE INTENÇÃO PRECISA DEVOLVER SKILL DE VERDADE.
 *
 * `conversa-e2e.test.ts` devolve "{}" aqui, e por isso `skills: []` por
 * construção — o repertório nunca é buscado e a armadilha da BP 0-1 ano jamais
 * é exercida. Como esta prova existe para medir o Core COM e SEM acervo, a
 * skill vai fixada em `sensorial`, e é o recuperador REAL que decide o que
 * passa pelo filtro de idade.
 */
function respostaAuxiliar(system: string, user: string): string {
  const s = `${system}\n${user}`;
  if (/membro_atipico_id/.test(s)) {
    return JSON.stringify({
      membro_atipico_id: mundoRef.alvo,
      confianca_identificacao: 95,
      conquista: null,
      desafio: "leva objetos não comestíveis à boca",
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
  // O contrato de UMA LINHA do classificador de intenção (`intent.ts`).
  if (/intencao\|tema/.test(s)) {
    return process.env.PROVA_SEM_SKILL ? "outro|sensorial|-|-" : "outro|sensorial|-|sensorial";
  }
  if (/desfecho/.test(s)) {
    return JSON.stringify({ desfecho: "nao_e_rotina", motivo: "prova" });
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

vi.mock("./anthropic", () => {
  const responderE = (args: { system?: unknown; messages?: unknown }) => {
    const system = typeof args.system === "string" ? args.system : JSON.stringify(args.system);
    const user = JSON.stringify(args.messages);
    chamadasIA.push("auxiliar");
    return {
      content: [{ type: "text" as const, text: respostaAuxiliar(system, user) }],
      usage: { input_tokens: 0, output_tokens: 0 },
    };
  };
  return {
    AYLA_MODEL: "claude-haiku-4-5",
    AYLA_MODEL_FALLBACK: "claude-sonnet-4-6",
    getAylaAnthropicClient: () => ({
      messages: {
        create: async (a: { system?: unknown; messages?: unknown }) => responderE(a),
        stream: (a: { system?: unknown; messages?: unknown }) => ({
          finalMessage: async () => responderE(a),
        }),
      },
    }),
  };
});

vi.mock("./lote-inbound", () => ({
  aguardarTurnoDaMae: async (_s: unknown, p: { textoAtual: string }) => ({
    texto: p.textoAtual,
    ids: [],
  }),
  descartarTurnoPendente: async () => {},
}));

vi.mock("@/lib/ai/prompts", () => ({ getSystemPrompt: async (_k: string, f: string) => f }));

// ── O QUE FICA REAL: o produtor conversacional ───────────────────────────
/**
 * Passa-adiante em cima do módulo VERDADEIRO (`importActual`). Não substitui a
 * chamada — mede-a. Sem isto não há como registrar system, tokens e latência do
 * que de fato foi para a API.
 */
vi.mock("@/lib/ia/provider", async (original) => {
  const real = (await original()) as Record<string, unknown>;
  const gerar = real.gerarConversacional as (p: unknown) => Promise<CapturaConversa>;
  return {
    ...real,
    gerarConversacional: async (p: {
      system: string;
      messages: Array<{ content: unknown }>;
    }) => {
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

const { processInbound } = await import("./orchestrator");

/** Daniel, 6 anos — o caso da missão, com o perfil escrito onde o código lê. */
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
  m.db.semear("specialist_prompt_templates", SKILLS_PROVA.map((s) => ({ ...s })));
  m.db.semear("boas_praticas", ACERVO_PROVA.map((b) => ({ ...b })));
  return m;
}

async function turno(m: Mundo, texto: string) {
  mundoRef.atual = m;
  mundoRef.alvo = Object.values(m.membros)[0] ?? null;
  const antesEnviadas = m.enviadas.length;
  const antesCapturas = capturas.length;
  const antesIA = chamadasIA.length;

  const r = await processInbound(m.db.cliente(), inboundDe(m, texto));

  // ── AS GUARDAS ANTI-TESTE-VAZIO ────────────────────────────────────────
  // Sem elas, um turno abortado no portão de assinatura produziria "0 perguntas
  // e 0 jargão" e passaria verde tendo medido o nada.
  const saida = m.db.linhas("ayla_messages").filter((x) => x.direcao === "outbound");
  const tipo = (saida[saida.length - 1]?.tipo as string | undefined) ?? null;
  expect(r.tratada, "o turno NÃO foi tratado — o fluxo abortou antes de decidir").toBe(true);
  expect(m.enviadas.length, "o turno não respondeu nada — teste vazio").toBeGreaterThan(
    antesEnviadas,
  );
  expect(tipo, "o portão de assinatura respondeu no lugar do fluxo").not.toBe("assinatura_nudge");
  expect(
    capturas.length,
    "o produtor conversacional não foi chamado — não há o que medir",
  ).toBeGreaterThan(antesCapturas);

  const c = capturas[capturas.length - 1];
  const resposta = m.enviadas
    .slice(antesEnviadas)
    .map((e) => e.texto)
    .join("\n");
  return {
    mensagem: texto,
    resposta,
    respostaModelo: c.texto,
    ...medirTexto(resposta),
    provider: c.provider,
    model: c.model,
    tokensIn: c.tokensIn,
    tokensOut: c.tokensOut,
    cacheRead: c.cacheRead,
    msModelo: c.ms,
    chamadasIA: chamadasIA.length - antesIA,
    chamadasConversa: capturas.length - antesCapturas,
    bps: bpsNoPrompt(c.user, ACERVO_PROVA),
    temRepertorio: /<repertorio_kolo>/.test(c.user),
    perfilNoPrompt: /busca muito input oral/.test(c.user),
    systemChars: c.system.length,
    userChars: c.user.length,
  };
}

describe.skipIf(!LIGADO)("PROVA REAL · Daniel, dois turnos, modelo pago", () => {
  it(
    "turno 1 e turno 2, na mesma conversa",
    async () => {
      const m = familiaDaniel();
      const t1 = await turno(
        m,
        "ele esta colocando muita coisa na boca, planta, bonecos, papel, plastico",
      );
      const t2 = await turno(m, "fica ansioso. o que devo fazer?");

      const saida = {
        rotulo: process.env.PROVA_ROTULO ?? "sem-rotulo",
        quando: new Date().toISOString(),
        turnos: [t1, t2],
        systemDoTurno1: capturas[0]?.system ?? "",
      };
      const destino = process.env.PROVA_SAIDA;
      if (destino) writeFileSync(destino, JSON.stringify(saida, null, 2), "utf8");
      console.log(`##PROVA##${JSON.stringify(saida)}`);

      // ── A TRAVA P0 ───────────────────────────────────────────────────────
      // A BP 0-1 ano está semeada, ativa e na skill certa. A única coisa entre
      // ela e o Daniel de 6 anos é `idadeElegivel`. Se ela aparecer no prompt,
      // a prova morre aqui — não vira ressalva de relatório.
      for (const t of [t1, t2]) {
        expect(t.bps, "TRAVA P0: a BP 0-1 ano chegou ao modelo").not.toContain("47014d89");
        expect(
          capturas.map((c) => c.user).join("\n"),
          "TRAVA P0: o texto da BP 0-1 ano chegou ao modelo",
        ).not.toContain("é assim que o bebê aprende textura");
      }
    },
    180_000,
  );

  it(
    "sem skill roteada: o repertório fica vazio e a Ayla responde assim mesmo",
    async () => {
      process.env.PROVA_SEM_SKILL = "1";
      try {
        const m = familiaDaniel();
        const t = await turno(
          m,
          "ele esta colocando muita coisa na boca, planta, bonecos, papel, plastico",
        );
        expect(t.temRepertorio, "sem skill não pode haver bloco de repertório").toBe(false);
        expect(t.bps).toEqual([]);
        const destino = process.env.PROVA_SAIDA_SEM_SKILL;
        const saida = { rotulo: process.env.PROVA_ROTULO ?? "sem-rotulo", turno: t };
        if (destino) writeFileSync(destino, JSON.stringify(saida, null, 2), "utf8");
        console.log(`##PROVA_SEM_SKILL##${JSON.stringify(saida)}`);
        expect(t.palavras, "resposta vazia sem repertório — o Core não vale por si").toBeGreaterThan(
          20,
        );
      } finally {
        delete process.env.PROVA_SEM_SKILL;
      }
    },
    180_000,
  );
});
