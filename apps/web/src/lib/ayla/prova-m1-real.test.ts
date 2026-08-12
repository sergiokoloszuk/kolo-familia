/**
 * INTERAÇÃO DE QUALIDADE — dez casos com modelo real, mais o contrafactual.
 *
 * ⚠️ O CONTRAFACTUAL É O QUE IMPORTA AQUI. Provar que a resposta é boa não
 * prova personalização: uma resposta boa pode ser boa para qualquer criança.
 * O que prova é a MESMA fala com perfis DIFERENTES produzindo orientações
 * diferentes — e a mesma fala SEM o dado individualizante produzindo outra.
 * Nome da criança no texto não conta.
 *
 * Roteamento e parser são REAIS (é o produto que escolhe a lente). Desligado
 * sem PROVA_REAL.
 */

import { writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { montarMundo, inboundDe, type Mundo, type PerfilSintetico } from "./__harness/cenario";
import { carregarEnvLocal, medirTexto, type CapturaConversa } from "./__harness/prova-real";

carregarEnvLocal(process.cwd());

const mundoRef: { atual: Mundo | null } = { atual: null };
const capturas: CapturaConversa[] = [];
const chamadasIA: string[] = [];

vi.mock("./whatsappSender", () => ({
  enviarTexto: async (p: { phoneE164: string; texto: string }) => {
    mundoRef.atual?.enviadas.push({ para: p.phoneE164, texto: p.texto });
    return { ok: true, messageId: "x" };
  },
  enviarImagem: async () => ({ ok: true, messageId: "img" }),
  enviarDocumento: async () => ({ ok: true, messageId: "doc" }),
}));
vi.mock("./lote-inbound", () => ({
  aguardarTurnoDaMae: async (_s: unknown, p: { textoAtual: string }) => ({ texto: p.textoAtual, ids: [] }),
  descartarTurnoPendente: async () => {},
}));
vi.mock("@/lib/ai/prompts", () => ({ getSystemPrompt: async (_k: string, f: string) => f }));
vi.mock("@/lib/ludico/rotina-servico", () => ({
  gerarRotina: async () => ({ desfecho: "nao_gerou", rotinas: [], fala: null }),
}));
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
        system: p.system, user: JSON.stringify(p.messages), texto: r.texto,
        provider: r.provider, model: r.model, tokensIn: r.tokensIn,
        tokensOut: r.tokensOut, cacheRead: r.cacheRead ?? 0, ms: Date.now() - t0,
      });
      return r;
    },
  };
});
vi.mock("./anthropic", async (original) => {
  const real = (await original()) as Record<string, unknown>;
  const obter = real.getAylaAnthropicClient as () => {
    messages: { create: (a: unknown) => Promise<unknown>; stream: (a: unknown) => { finalMessage: () => Promise<unknown> } };
  };
  return {
    ...real,
    getAylaAnthropicClient: () => {
      const c = obter();
      return {
        messages: {
          create: async (a: unknown) => { chamadasIA.push("aux"); return c.messages.create(a); },
          stream: (a: unknown) => { chamadasIA.push("aux"); return c.messages.stream(a); },
        },
      };
    },
  };
});

const { processInbound } = await import("./orchestrator");

/** O perfil-base do Pedro; cada caso sobrescreve só o que precisa. */
function familia(over: Partial<PerfilSintetico["sabe"] & Record<string, unknown>> = {}, extras: Record<string, unknown> = {}) {
  return montarMundo({
    nomeMae: "Juliana",
    criancas: [
      {
        nome: "Pedro",
        nascimento: "2020-02-10",
        genero: "masculino",
        sabe: {
          essencial: "Pedro, 6 anos, autista (laudo); mora com a mãe e o irmão mais velho",
          como_e: "observador, cauteloso; compreende frases simples",
          corpo_rotina: "escola de manhã; fica mais agitado no fim da tarde",
          sensorial: "não gosta de barulho alto",
          ...over,
        },
        extras: { gostos: "hiperfoco em carrinhos; adora água", ...extras },
      },
    ],
  });
}

async function turno(m: Mundo, texto: string, rotulo: string) {
  mundoRef.atual = m;
  const antesEnv = m.enviadas.length;
  const antesCap = capturas.length;
  const antesIA = chamadasIA.length;
  const r = await processInbound(m.db.cliente(), inboundDe(m, texto));
  expect(r.tratada, `[${rotulo}] não tratado`).toBe(true);
  expect(m.enviadas.length, `[${rotulo}] não respondeu — teste vazio`).toBeGreaterThan(antesEnv);
  const resposta = m.enviadas.slice(antesEnv).map((e) => e.texto).join("\n");
  if (capturas.length === antesCap) {
    return { rotulo, mensagem: texto, resposta, ...medirTexto(resposta), lentes: [] as string[], semProdutor: true, msModelo: 0, chamadasIA: chamadasIA.length - antesIA };
  }
  const c = capturas[capturas.length - 1];
  const lentes = [...c.user.matchAll(/\\n([A-ZÀ-Ú][A-ZÀ-Ú ÇÕÃÉ]+)\. OLHE:/g)].map((x) => x[1].trim());
  return {
    rotulo, mensagem: texto, resposta, ...medirTexto(resposta), lentes, semProdutor: false,
    msModelo: c.ms, tokensOut: c.tokensOut, chamadasIA: chamadasIA.length - antesIA,
  };
}

describe.skipIf(!process.env.PROVA_REAL)("M1 · o arco da conversa", () => {
  it("ancora de 5 turnos + controles", async () => {
    const R: unknown[] = [];

    const m = familia({ sensorial: "sente bastante barulho e lugar cheio", desafios_regulacao: "sente as mudancas de rotina" }, { gostos: "adora cavalos e desenhar" });
    const hoje = (d: number) => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);
    m.db.semear("diarios", [
      { family_account_id: m.familyId, membro_atipico_id: Object.values(m.membros)[0], data: hoje(3), origem: "ayla", conquista: "foi sozinha comprar pao na padaria" },
      { family_account_id: m.familyId, membro_atipico_id: Object.values(m.membros)[0], data: hoje(8), origem: "ayla", conquista: "contou pela primeira vez o que tinha acontecido na aula" },
    ]);
    R.push(await turno(m, "Ela nao quer entrar na escola.", "T1 escola"));
    R.push(await turno(m, "3. E recente. Ela gostava.", "T2 recente"));
    R.push(await turno(m, "Ela brigou com a Marcinha porque nao emprestou o brinquedo.", "T3 pista"));
    R.push(await turno(m, "Ela nao consegue falar sobre isso.", "T4 canal"));
    R.push(await turno(m, "Com bonecos ela conseguiu contar.", "T5 descoberta"));

    R.push(await turno(familia(), "Ele faz birra por qualquer coisa.", "P1 birra"));
    R.push(await turno(familia(), "Ela surtou do nada.", "P2 do-nada"));
    R.push(await turno(familia(), "Ele dormiu bem a semana inteira e hoje acordou feliz.", "N controle-negativo"));

    R.push(await turno(familia({ sensorial: "busca muito input oral" }), "Ele esta colocando planta, papel e plastico na boca.", "C1 boca"));
    R.push(await turno(familia(), "Quando perde, fica bravo e chora.", "C2 perde"));
    R.push(await turno(familia(), "Ele demora muito para dormir.", "C3 sono"));
    R.push(await turno(familia(), "Ela so come as mesmas coisas.", "C4 comida"));
    R.push(await turno(familia(), "Nao sei mais o que fazer, to exausta.", "C5 desabafo"));

    const destino = process.env.PROVA_SAIDA;
    if (destino) writeFileSync(destino, JSON.stringify({ quando: new Date().toISOString(), casos: R }, null, 2), "utf8");
    expect(R.length).toBe(13);
  }, 1_500_000);
});
