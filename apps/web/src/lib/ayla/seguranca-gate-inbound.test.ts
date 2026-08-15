import { beforeEach, describe, expect, it, vi } from "vitest";
import { inboundDe, montarMundo, type Mundo } from "./__harness/cenario";
import { clienteFalso, type Registro } from "./__harness/modelo";

/**
 * O TURNO INTEIRO, DE VERDADE — PEND-071, 15/08/2026.
 *
 * ⚠️ ESTE ARQUIVO NASCEU DE UMA SABOTAGEM QUE NÃO MORDEU. A primeira leva de
 * testes da correção olhava o TEXTO do orquestrador (ordem das linhas, ausência
 * de chamadas proibidas). Desligar o ramo inteiro com `if (false && ...)`
 * deixou os 12 verdes: asserção sobre código-fonte prova estrutura, nunca
 * comportamento.
 *
 * Aqui a família tem o trial VENCIDO de verdade, a mensagem entra pelo webhook
 * de verdade, e o que se mede é o que ela RECEBE.
 */

const registros: Registro[] = [];
const mundoRef: { atual: Mundo | null; alvo: string | null } = { atual: null, alvo: null };

vi.mock("./whatsappSender", () => ({
  enviarTexto: async (p: { phoneE164: string; texto: string }) => {
    mundoRef.atual?.enviadas.push({ para: p.phoneE164, texto: p.texto });
    return { ok: true, messageId: "z" };
  },
  enviarImagem: async () => ({ ok: true, messageId: "i" }),
  enviarDocumento: async () => ({ ok: true, messageId: "d" }),
  parseZapiWebhook: () => null,
}));

vi.mock("@/lib/ia/provider", () => ({
  MODELO_CONVERSA: { anthropic: "claude-sonnet-4-6", openai: "gpt-5.6-luna" },
  providerConversacionalParaFamilia: () => "anthropic",
  gerarConversacional: async () => {
    mundoRef.atual?.chamadas.push({ quem: "conversa", prompt: "", mensagem: "", notas: [] });
    return {
      texto: "[resposta conversacional]",
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      tokensIn: 10,
      tokensOut: 5,
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
    quantidade: 1,
  }),
  descartarTurnoPendente: async () => {},
}));

vi.mock("@/lib/ai/prompts", () => ({ getSystemPrompt: async (_k: string, f: string) => f }));

const { processInbound } = await import("./orchestrator");

/** A mesma família, com o teste VENCIDO — que é o estado do caso. */
function mundoComTrialVencido(): Mundo {
  const m = montarMundo({ nomeMae: "Juliana", criancas: [{ nome: "Daniel", nascimento: "2018-05-10" }] });
  const acesso = m.db.linhas("subscription_accesses")[0] as Record<string, unknown>;
  acesso.status = "trialing";
  acesso.trial_ends_at = "2026-08-01T00:00:00.000Z"; // venceu há duas semanas
  // Consentimento: sem isto o turno para antes, por outro motivo.
  m.db.semear("ayla_preferences", [
    {
      family_account_id: m.familyId,
      consentimento_em: "2026-07-01T00:00:00.000Z",
      desativada: false,
      pausada_ate: null,
    },
  ]);
  mundoRef.atual = m;
  return m;
}

const ultima = (m: Mundo) => m.enviadas[m.enviadas.length - 1]?.texto ?? "";

beforeEach(() => {
  registros.length = 0;
  mundoRef.atual = null;
});

describe("trial vencido + crise", () => {
  it("MORDE: recebe encaminhamento de emergência, NÃO o convite para assinar", async () => {
    const m = mundoComTrialVencido();
    await processInbound(m.db.cliente(), inboundDe(m, "minha filha tentou se matar ontem à noite"));

    expect(m.enviadas.length, "a família não recebeu nada").toBeGreaterThan(0);
    const t = ultima(m);
    expect(t, "não veio o encaminhamento").toContain("188");
    expect(t).toContain("192");
    expect(t.toLowerCase(), "COBROU no meio da crise").not.toMatch(/assinar|período grátis/);
  });

  it("MORDE: a SEGUNDA mensagem de risco também é respondida — o cooldown não silencia", async () => {
    // O pior sintoma do defeito: dentro das 12h do convite, a família não
    // recebia absolutamente nada.
    const m = mundoComTrialVencido();
    await processInbound(m.db.cliente(), inboundDe(m, "ela tentou se matar"));
    const depoisDaPrimeira = m.enviadas.length;
    await processInbound(m.db.cliente(), inboundDe(m, "ela falou de novo em suicídio"));

    expect(m.enviadas.length, "a segunda mensagem de risco caiu no silêncio").toBeGreaterThan(
      depoisDaPrimeira,
    );
    expect(ultima(m)).toContain("188");
  });

  it("MORDE: o estado de segurança ABRE — o turno seguinte não precisa de palavra-chave", async () => {
    const m = mundoComTrialVencido();
    await processInbound(m.db.cliente(), inboundDe(m, "minha filha tentou se matar"));

    const msgs = m.db.linhas("ayla_messages") as Array<Record<string, unknown>>;
    const seguranca = msgs.filter((x) => x.tipo === "seguranca" && x.direcao === "outbound");
    expect(seguranca.length, "não abriu o estado de segurança").toBeGreaterThan(0);

    // Agora uma mensagem SEM termo de risco: continua entrando pelo ramo.
    const antes = m.enviadas.length;
    await processInbound(m.db.cliente(), inboundDe(m, "não sei mais o que fazer"));
    expect(m.enviadas.length, "o estado aberto não segurou o turno seguinte").toBeGreaterThan(antes);
    expect(ultima(m)).toContain("188");
  });

  it("MORDE: NENHUM entregável vaza — a regressão Camile/Gramado continua fechada", async () => {
    const m = mundoComTrialVencido();
    await processInbound(m.db.cliente(), inboundDe(m, "ela tentou se matar, me manda um plano"));

    expect(m.db.linhas("planos").length, "gerou plano para trial vencido").toBe(0);
    expect(m.db.linhas("rotinas").length, "gerou rotina para trial vencido").toBe(0);
    expect(m.chamadas.length, "chamou o modelo conversacional no ramo de segurança").toBe(0);
  });
});

describe("trial vencido SEM crise — o comportamento antigo continua", () => {
  it("MORDE: mensagem comum continua recebendo o convite para assinar", async () => {
    // CASO LEGÍTIMO QUE NÃO PODE SER SUPRIMIDO. Se a correção capturasse tudo,
    // ninguém mais seria convidado a assinar.
    const m = mundoComTrialVencido();
    await processInbound(m.db.cliente(), inboundDe(m, "oi, ele não dorme direito, o que faço?"));

    const t = ultima(m);
    expect(t.toLowerCase(), "o convite sumiu").toMatch(/assinar|período grátis/);
    expect(t, "mandou emergência para quem não está em crise").not.toContain("188");
  });

  it("MORDE: e continua sem vazar entregável", async () => {
    const m = mundoComTrialVencido();
    await processInbound(m.db.cliente(), inboundDe(m, "me monta a rotina visual dele"));
    expect(m.db.linhas("rotinas").length).toBe(0);
    expect(m.db.linhas("planos").length).toBe(0);
  });
});

describe("família COM acesso — nada mudou", () => {
  it("MORDE: o caminho normal não passa pelo ramo de segurança sem acesso", async () => {
    const m = montarMundo({ nomeMae: "Ana", criancas: [{ nome: "Manu", nascimento: "2017-01-01" }] });
    m.db.semear("ayla_preferences", [
      {
        family_account_id: m.familyId,
        consentimento_em: "2026-07-01T00:00:00.000Z",
        desativada: false,
        pausada_ate: null,
      },
    ]);
    mundoRef.atual = m;
    await processInbound(m.db.cliente(), inboundDe(m, "ela tentou se matar ontem"));

    // Com acesso, quem responde é o pipeline conversacional — o texto fixo do
    // ramo sem acesso NÃO pode substituir a condução de segurança completa.
    expect(m.chamadas.length, "a família com acesso caiu no texto fixo").toBeGreaterThan(0);
  });
});
