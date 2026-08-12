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

describe.skipIf(!process.env.PROVA_REAL)("INTERAÇÃO DE QUALIDADE · conversas reais", () => {
  it("dez casos + contrafactual", async () => {
    const R: unknown[] = [];

    // A — escola, dois turnos na MESMA conversa.
    const mA = familia();
    R.push(await turno(mA, "Ele não quer entrar na escola.", "A1 escola"));
    R.push(await turno(mA, "Quando a professora vem buscar ele entra. Quando sou eu que deixo ele começa a chorar ainda no carro.", "A2 escola+dado"));

    // B — comando. Perfil já traz hiperfoco em carrinhos e transição lenta.
    R.push(await turno(familia({ como_e: "compreende frases simples; demora muito para mudar de atividade" }), "Eu chamo várias vezes e ele não vem.", "B comando"));

    // C — repetição, com a evidência de que responde melhor VENDO.
    R.push(await turno(familia({}, { aprendizado: "entende muito melhor quando VÊ a sequência; falar mais alto não ajuda" }), "Tenho que repetir tudo dez vezes.", "C visual"));

    // D — o clichê do apoio visual tem que cair: aqui o que funciona é demonstrar.
    R.push(await turno(familia({}, { aprendizado: "fica irritado com cartões e imagens; responde bem quando o adulto DEMONSTRA e faz junto" }), "Ele fica irritado quando mostro os cartões.", "D demonstra"));

    // E — desregulação e carga verbal.
    R.push(await turno(familia(), "Quando ele fica bravo eu tento explicar tudo, mas parece que piora.", "E desregulacao"));

    // F — crença: "para me desafiar".
    R.push(await turno(familia(), "Ele faz isso só para me desafiar.", "F crenca"));

    // G — crença de futuro.
    R.push(await turno(familia(), "Às vezes acho que ele nunca vai conseguir ser independente.", "G futuro"));

    // H — transição.
    R.push(await turno(familia(), "Quando muda o combinado ele se desorganiza completamente.", "H transicao"));

    // I — história + interesses reais disponíveis.
    R.push(await turno(familia(), "Ele não consegue prestar atenção quando eu leio uma história.", "I historia"));

    // J — Daniel, dois turnos.
    const mJ = familia({ sensorial: "busca muito input oral e de textura; não gosta de barulho alto" });
    R.push(await turno(mJ, "Ele está colocando planta, bonecos, papel e plástico na boca.", "J1 boca"));
    R.push(await turno(mJ, "Ele fica ansioso.", "J2 ansioso"));

    // ── CONTRAFACTUAL ──────────────────────────────────────────────────────
    // Mesma fala, três perfis. Se as três respostas servirem para qualquer
    // criança, a personalização é decorativa.
    const FALA = "Tenho que repetir tudo dez vezes.";
    R.push(await turno(familia({}, { aprendizado: "entende muito melhor quando VÊ a sequência; falar mais alto não ajuda" }), FALA, "CF1 com-imagens"));
    R.push(await turno(familia({}, { aprendizado: "fica irritado com cartões e imagens; responde bem quando o adulto DEMONSTRA e faz junto" }), FALA, "CF2 com-demonstracao"));
    R.push(await turno(familia({}, {}), FALA, "CF3 sem-dado"));

    const FALA2 = "Eu chamo várias vezes e ele não vem.";
    R.push(await turno(familia({ como_e: "compreende frases simples; demora muito para mudar de atividade" }, { gostos: "hiperfoco em carrinhos" }), FALA2, "CF4 com-hiperfoco"));
    R.push(await turno(familia({ como_e: "compreende frases simples" }, {}), FALA2, "CF5 sem-hiperfoco"));

    const destino = process.env.PROVA_SAIDA;
    if (destino) writeFileSync(destino, JSON.stringify({ quando: new Date().toISOString(), casos: R }, null, 2), "utf8");
    expect(R.length).toBe(17);
  }, 1_500_000);
});
