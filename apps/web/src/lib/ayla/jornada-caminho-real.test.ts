import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  montarMundo,
  inboundDe,
  passouPeloExperimental,
  type Mundo,
} from "./__harness/cenario";
import { clienteFalso, type Registro } from "./__harness/modelo";
import { TRIAL_DIAS } from "@/lib/billing/fatos-comerciais";

/**
 * A JORNADA D0–D7 PELO TURNO REAL — arquitetura, estado e precedência.
 *
 * ⚠️ O QUE ESTE ARQUIVO PROVA: que o bloco chega ao system do motor NOVO, com o
 * dia certo, com as evidências que existem, e que ele SOME para quem não deve
 * ser conduzido. Toda asserção passa por `passouPeloExperimental` (PEND-072) —
 * um teste de jornada que medisse o Legacy não mediria nada.
 *
 * ⚠️ O QUE ELE NÃO PROVA, e está declarado: se a Ayla OBEDECE ao bloco. O modelo
 * aqui é falso e devolve texto fixo. Qualidade conversacional é julgamento sobre
 * a resposta, e é trabalho da bancada com modelo real.
 */

const registros: Registro[] = [];
const mundoRef: { atual: Mundo | null; alvo: string | null } = { atual: null, alvo: null };
const systems: string[] = [];

vi.mock("./whatsappSender", () => ({
  enviarTexto: async (p: { phoneE164: string; texto: string }) => {
    mundoRef.atual?.enviadas.push({ texto: p.texto, para: p.phoneE164 });
    return { messageId: "m", raw: {} };
  },
  enviarDocumento: async () => ({ messageId: "doc", raw: {} }),
  enviarImagem: async () => ({ messageId: "img", raw: {} }),
  sendVideoGuia: async () => ({ messageId: "vid", raw: {} }),
  parseZapiWebhook: () => null,
}));

vi.mock("@/lib/ia/provider", () => ({
  MODELO_CONVERSA: { anthropic: "claude-sonnet-4-6", openai: "gpt-5.6-luna" },
  providerConversacionalParaFamilia: () => "openai",
  gerarConversacional: async (p: { system?: string }) => {
    systems.push(String(p.system ?? ""));
    return {
      texto: "[resposta da Ayla experimental]",
      provider: "openai",
      model: "gpt-5.6-luna",
      tokensIn: 100,
      tokensOut: 20,
      cacheRead: 0,
      cacheWrite: 0,
      ms: 1,
    };
  },
}));

vi.mock("./anthropic", async (orig) => {
  const real = (await orig()) as Record<string, unknown>;
  return { ...real, getAylaAnthropicClient: () => clienteFalso({ alvo: mundoRef.alvo }, registros) };
});

/**
 * O LOTE, DUBLADO — mesma decisão de `video.test.ts` e `conversa-e2e.test.ts`.
 *
 * ⚠️ POR QUE ISTO PRECISOU ENTRAR EM 19/08. Este arquivo nunca dublou o lote e
 * pagava a janela de silêncio de verdade em cada `processInbound`. Com 3s isso
 * cabia nos 30s de timeout; com a janela em 10s (PEND-058) não cabe mais, e os
 * dois primeiros cenários passaram a estourar o tempo — **por espera, não por
 * comportamento**.
 *
 * Aqui cada fala vem sozinha, então "segue com o seu texto" é exatamente o que
 * o lote real devolveria. O que este arquivo testa é a JORNADA (o bloco do dia
 * chegando ao motor), não o agrupamento — que tem o seu próprio arquivo,
 * `lote-janela.test.ts`, onde a janela roda com relógio de verdade.
 */
vi.mock("./lote-inbound", async (orig) => {
  const real = await orig<typeof import("./lote-inbound")>();
  return {
    ...real,
    aguardarTurnoDaMae: async (_s: unknown, p: { textoAtual: string }) => ({
      texto: p.textoAtual,
      quantidade: 1,
    }),
    descartarTurnoPendente: async () => {},
  };
});

const { processInbound, sendTrial } = await import("./orchestrator");

const MS_DIA = 24 * 60 * 60 * 1000;
const ENV = process.env.AYLA_EXPERIMENTAL_FAMILY_IDS;
beforeEach(() => {
  registros.length = 0;
  systems.length = 0;
});
afterEach(() => {
  if (ENV === undefined) delete process.env.AYLA_EXPERIMENTAL_FAMILY_IDS;
  else process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = ENV;
});

/**
 * Uma família NO dia `dia` do teste.
 *
 * ⚠️ `montarMundo` semeia a família como assinante ativa — o que é certo para os
 * cenários de artefato e é justamente o que precisa ser SOBRESCRITO aqui: uma
 * assinante não tem jornada, e o teste passaria verde medindo o silêncio.
 */
function familiaNoDia(dia: number, telefone = "+5541999990055") {
  const mundo = montarMundo({
    nomeMae: "Carla",
    telefone,
    criancas: [{ nome: "Manu", nascimento: "2022-04-10", genero: "feminino" }],
  });
  const inicio = Date.now() - dia * MS_DIA;
  const tabela = (mundo.db as unknown as { tabelas: Map<string, Array<Record<string, unknown>>> })
    .tabelas.get("subscription_accesses");
  const linha = tabela?.find((l) => l.family_account_id === mundo.familyId);
  if (linha) {
    linha.status = "trialing";
    linha.created_at = new Date(inicio).toISOString();
    linha.trial_ends_at = new Date(inicio + TRIAL_DIAS * MS_DIA).toISOString();
  }
  return mundo;
}

async function turno(mundo: Mundo, texto: string) {
  mundoRef.atual = mundo;
  mundoRef.alvo = mundo.membros["Manu"];
  process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = mundo.familyId;
  await processInbound(mundo.db.cliente(), inboundDe(mundo, texto));
  await new Promise((r) => setTimeout(r, 50));
  return systems.join("\n");
}

describe("O BLOCO CHEGA AO MOTOR NOVO, COM O DIA CERTO", () => {
  it("0. o turno roda pelo experimental — sem isto nada aqui é sobre a jornada", async () => {
    const mundo = familiaNoDia(2);
    await turno(mundo, "Oi, tudo bem?");
    expect(passouPeloExperimental(mundo), "o turno caiu para o Legacy").toBe(true);
  }, 30000);

  it("1. D0 a D7: o bloco entra e nomeia o dia", async () => {
    for (const dia of [0, 1, 2, 3, 4, 5, 6]) {
      systems.length = 0;
      const mundo = familiaNoDia(dia, `+554199999${1000 + dia}`);
      const sys = await turno(mundo, "Oi");
      expect(passouPeloExperimental(mundo), `dia ${dia}: caiu no Legacy`).toBe(true);
      expect(sys, `dia ${dia}: bloco ausente`).toContain("<jornada>");
      expect(sys, `dia ${dia}: dia errado`).toContain(`Dia ${dia} de`);
    }
  }, 60000);

  it("2. teste VENCIDO nem chega à jornada — o gate de acesso barra antes", async () => {
    // ⚠️ MEDIDO (15/08/2026). A fase `trial_encerrado` existe no leitor, mas na
    // conversa reativa ela é inalcançável: o portão de assinatura encerra o
    // turno acima do ramo experimental. Quem venceu recebe o convite de
    // assinatura, não uma conversa conduzida — e isso é o desenho, não um furo.
    const mundo = familiaNoDia(TRIAL_DIAS + 2, "+5541999991200");
    const sys = await turno(mundo, "Oi");
    expect(sys, "o turno de trial vencido chegou ao modelo").toBe("");
    expect(passouPeloExperimental(mundo)).toBe(false);
  }, 30000);

  it("3. o rastro do dia fica na auditoria do turno", async () => {
    const mundo = familiaNoDia(5, "+5541999991300");
    await turno(mundo, "Oi");
    const log = mundo.db.linhas("ayla_send_log").find((l) => {
      const p = l.payload as { meta?: { ayla_path?: string } } | null;
      return p?.meta?.ayla_path === "experimental";
    });
    const meta = (log?.payload as { meta?: Record<string, unknown> }).meta ?? {};
    expect(meta.jornada_dia, "o dia não ficou registrado").toBe(5);
    expect(meta.jornada_fechamento, "D5 é dia de fechamento").toBe(true);
  }, 30000);

  it("4. D2 não é dia de fechamento, e o rastro diz isso", async () => {
    const mundo = familiaNoDia(2, "+5541999991400");
    await turno(mundo, "Oi");
    const log = mundo.db.linhas("ayla_send_log").find((l) => {
      const p = l.payload as { meta?: { ayla_path?: string } } | null;
      return p?.meta?.ayla_path === "experimental";
    });
    const meta = (log?.payload as { meta?: Record<string, unknown> }).meta ?? {};
    expect(meta.jornada_fechamento).toBe(false);
  }, 30000);
});

describe("QUEM ASSINOU SAI DA CONDUÇÃO — no turno real", () => {
  it("5. assinou no D3: nenhum bloco de jornada no system", async () => {
    const mundo = familiaNoDia(3, "+5541999991500");
    const linha = (mundo.db as unknown as { tabelas: Map<string, Array<Record<string, unknown>>> })
      .tabelas.get("subscription_accesses")
      ?.find((l) => l.family_account_id === mundo.familyId);
    if (linha) linha.status = "active";

    const sys = await turno(mundo, "Oi");
    expect(passouPeloExperimental(mundo)).toBe(true);
    expect(sys, "assinante recebeu condução comercial").not.toContain("<jornada>");
  }, 30000);

  it("6. assinou no D6: idem — e é o caso que mais dói se falhar", async () => {
    const mundo = familiaNoDia(6, "+5541999991600");
    const linha = (mundo.db as unknown as { tabelas: Map<string, Array<Record<string, unknown>>> })
      .tabelas.get("subscription_accesses")
      ?.find((l) => l.family_account_id === mundo.familyId);
    if (linha) linha.status = "active";

    const sys = await turno(mundo, "Oi");
    expect(sys).not.toContain("<jornada>");
    expect(sys).not.toContain("continuar com a Kolo");
  }, 30000);
});

describe("EVIDÊNCIA REAL — do que a família viveu, e só", () => {
  it("7. família com plano entregue: o plano aparece contado", async () => {
    const mundo = familiaNoDia(6, "+5541999991700");
    mundo.db.semear("planos", [
      {
        id: "plano-1",
        family_account_id: mundo.familyId,
        membro_atipico_id: mundo.membros["Manu"],
        titulo: "Sono e hora de dormir",
        created_at: new Date().toISOString(),
      },
    ]);
    const sys = await turno(mundo, "Oi");
    expect(sys).toContain("planos entregues: 1");
    expect(sys).toContain("Sono e hora de dormir");
  }, 30000);

  it("8. família sem evidência: nada é afirmado — nem plano, nem progresso", async () => {
    const mundo = familiaNoDia(6, "+5541999991800");
    const sys = await turno(mundo, "Oi");
    expect(sys).toContain("<jornada>");
    expect(sys).not.toContain("planos entregues");
    expect(sys).not.toContain("rotinas criadas");
    expect(sys).toContain("Não diga que algo funcionou se a família não disse");
  }, 30000);

  it("9. o relato da família entra; a sugestão da Ayla não vira resultado", async () => {
    const mundo = familiaNoDia(6, "+5541999991900");
    mundo.db.semear("eventos_membro", [
      {
        id: "evt-1",
        family_account_id: mundo.familyId,
        membro_atipico_id: mundo.membros["Manu"],
        data: new Date().toISOString().slice(0, 10),
        tipo: "marco",
        descricao: "dormiu melhor com o aviso de 5 minutos",
        fonte: "ayla",
        created_at: new Date().toISOString(),
      },
    ]);
    const sys = await turno(mundo, "Oi");
    expect(sys).toContain("dormiu melhor com o aviso de 5 minutos");
    // A saída do modelo (que é a fala da Ayla) nunca é evidência de nada.
    expect(sys).not.toContain("[resposta da Ayla experimental]");
  }, 30000);

  it("10. a evidência de uma família não vaza para outra", async () => {
    const a = familiaNoDia(6, "+5541999992000");
    a.db.semear("planos", [
      {
        id: "plano-a",
        family_account_id: a.familyId,
        titulo: "Transição da escola pra casa",
        created_at: new Date().toISOString(),
      },
    ]);
    const b = familiaNoDia(6, "+5541999992100");
    const sys = await turno(b, "Oi");
    expect(sys, "o plano da família A apareceu no turno da B").not.toContain(
      "Transição da escola pra casa",
    );
  }, 30000);
});

describe("A NECESSIDADE DE AGORA — a jornada nunca atropela", () => {
  it("11. crise no D6: a precedência está no bloco, antes da intenção do dia", async () => {
    const mundo = familiaNoDia(6, "+5541999992200");
    const sys = await turno(mundo, "Não aguento mais, tô no meu limite hoje");
    const i = sys.indexOf("A NECESSIDADE DE AGORA MANDA");
    const j = sys.indexOf("Intenção disponível hoje");
    expect(i, "a precedência não chegou ao modelo").toBeGreaterThan(-1);
    expect(i, "a intenção do dia veio antes da precedência").toBeLessThan(j);
  }, 30000);

  it("12. pedido de plano no D7: o turno entrega o plano, e não vira conversa de venda", async () => {
    const mundo = familiaNoDia(TRIAL_DIAS - 1, "+5541999992300");
    const sys = await turno(
      mundo,
      "Me manda um plano pra ajudar a Manu com a hora de dormir, por favor",
    );
    // A família foi atendida e a jornada esteve presente SEM tomar o turno: a
    // precedência entra antes da intenção do dia, no último dia do teste.
    expect(mundo.enviadas.length, "o pedido concreto ficou sem resposta").toBeGreaterThan(0);
    expect(sys).toContain("A NECESSIDADE DE AGORA MANDA");
    expect(sys).toContain("continuar com a Kolo");
    // ⚠️ A ENTREGA DO PDF EM SI é provada em `ponte-plano-caminho-novo.test.ts`,
    // onde o gerador do plano tem duplo. Aqui ele é real e falha por falta de
    // catálogo no banco em memória — medir isso como "plano não entregue" seria
    // acusar o produto por um limite do harness.

  }, 30000);

  it("13. família monossilábica no D4 ganha alternativas do que viveu", async () => {
    const mundo = familiaNoDia(4, "+5541999992400");
    mundo.db.semear("planos", [
      {
        id: "plano-m",
        family_account_id: mundo.familyId,
        titulo: "Birras na saída de casa",
        created_at: new Date().toISOString(),
      },
    ]);
    // Cinco respostas curtas: é assim que ela conversa.
    mundo.db.semear(
      "ayla_messages",
      ["sim", "não", "não sei", "piorou", "sono"].map((t, i) => ({
        id: `curta-${i}`,
        family_account_id: mundo.familyId,
        direcao: "inbound",
        texto: t,
        created_at: new Date(Date.now() - i * 60_000).toISOString(),
      })),
    );
    const sys = await turno(mundo, "sim");
    expect(sys).toContain("responde curto");
    expect(sys).toContain("Birras na saída de casa");
  }, 30000);
});

describe("CONVIVÊNCIA COM A PROATIVA — sem abordagem repetida", () => {
  it("14. depois de um fechamento reativo, a proativa de trial cala", async () => {
    const mundo = familiaNoDia(4, "+5541999992500");
    mundoRef.atual = mundo;
    mundoRef.alvo = mundo.membros["Manu"];
    process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = mundo.familyId;

    // A conversa do D4 já cumpriu a função comercial.
    await processInbound(mundo.db.cliente(), inboundDe(mundo, "Oi"));
    await new Promise((r) => setTimeout(r, 50));
    expect(passouPeloExperimental(mundo)).toBe(true);

    const r = await sendTrial(mundo.db.cliente(), mundo.familyId, 3);
    expect(r.enviada, "a família levou a mesma abordagem duas vezes").toBe(false);
    expect(r.enviada ? "" : r.motivo).toContain("fechamento reativo");
  }, 30000);

  it("15. família que NÃO conversou continua recebendo a proativa", async () => {
    // É a razão de a proativa existir: quem não aparece não pode atravessar o
    // teste inteiro sem nenhum contato.
    const mundo = familiaNoDia(4, "+5541999992600");
    mundoRef.atual = mundo;
    const r = await sendTrial(mundo.db.cliente(), mundo.familyId, 3);
    expect(r.enviada ? "" : r.motivo).not.toContain("fechamento reativo");
  }, 30000);

  it("16. um turno de D2 não cala a proativa — não houve função comercial", async () => {
    const mundo = familiaNoDia(2, "+5541999992700");
    mundoRef.atual = mundo;
    mundoRef.alvo = mundo.membros["Manu"];
    process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = mundo.familyId;
    await processInbound(mundo.db.cliente(), inboundDe(mundo, "Oi"));
    await new Promise((r) => setTimeout(r, 50));

    const r = await sendTrial(mundo.db.cliente(), mundo.familyId, 3);
    expect(r.enviada ? "" : r.motivo).not.toContain("fechamento reativo");
  }, 30000);
});
