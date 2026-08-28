import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { montarMundo, inboundDe, passouPeloExperimental, type Mundo } from "./__harness/cenario";
import { clienteFalso, type Registro } from "./__harness/modelo";
import { TRIAL_DIAS } from "@/lib/billing/fatos-comerciais";

/**
 * A EXPERIÊNCIA DE QUEM VOLTA DEPOIS QUE O TESTE ACABOU — 28/08/2026.
 *
 * ⚠️ O CASO QUE ORIGINOU ESTE ARQUIVO. Nicole (f824762d) teve o teste vencido às
 * 01h29. Às 11h01 o cron mandou "Hoje é o último dia do seu período grátis" —
 * nove horas e meia DEPOIS de ela já estar bloqueada. Às 11h24 ela escreveu
 * "Oi" e recebeu "Que bom te ver por aqui 😊 Como você está?" seguido de um
 * SEGUNDO link de assinatura, mintado 23 minutos depois do primeiro.
 *
 * Três defeitos, provados um a um antes de qualquer alteração:
 *   1. `runComercial` seleciona o D-0 por DIA DE CALENDÁRIO e nunca compara com
 *      o agora — MEDI 86 de 237 contas (36%) vencendo antes da primeira batida
 *      do cron, e 11 de 15 `trial_d0` já enviadas mentindo sobre o prazo;
 *   2. `reservarConviteAssinatura` olhava só `assinatura_nudge`, e o convite das
 *      11h01 estava sob `trial_d0` — invisível para o cooldown;
 *   3. o `<pos_trial>` cobria desafio, objeção e "quero assinar", mas não o
 *      "oi" seco — o turno sem conteúdo caía numa pergunta social vazia.
 *
 * ⚠️ O QUE ESTE ARQUIVO NÃO PROVA. O modelo é falso: ele registra o `system` que
 * recebeu e devolve texto fixo. Dá para provar QUAL INSTRUÇÃO chegou; não dá
 * para provar o que um modelo real escreveria com ela. Onde a asserção é sobre
 * instrução, o nome do teste diz "instrução".
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
      texto: "[resposta da Ayla]",
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
 * ⚠️ `gerarMagicLink` NÃO USA O CLIENTE DO TURNO. Ele chama
 * `createServiceRoleClient()`, que sem env real estoura e devolve `null` em
 * silêncio — e o teste do convite mediria "nenhum token" pelo motivo errado.
 * Apontar o service-role para o MESMO banco em memória é o que faz
 * `acessos_app` ser contável aqui.
 */
vi.mock("@/lib/supabase/server", async (orig) => {
  const real = (await orig()) as Record<string, unknown>;
  return { ...real, createServiceRoleClient: () => mundoRef.atual?.db.cliente() };
});

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
const MS_HORA = 60 * 60 * 1000;
const ENV_EXP = process.env.AYLA_EXPERIMENTAL_FAMILY_IDS;
const ENV_POS = process.env.AYLA_POS_TRIAL;

beforeEach(() => {
  registros.length = 0;
  systems.length = 0;
  // O ramo pós-Trial é o objeto deste arquivo; sem a flag, o turno morre no
  // convite fixo e nada aqui mediria o que diz medir.
  process.env.AYLA_POS_TRIAL = "1";
});
afterEach(() => {
  if (ENV_EXP === undefined) delete process.env.AYLA_EXPERIMENTAL_FAMILY_IDS;
  else process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = ENV_EXP;
  if (ENV_POS === undefined) delete process.env.AYLA_POS_TRIAL;
  else process.env.AYLA_POS_TRIAL = ENV_POS;
});

/** Acesso à linha real de `subscription_accesses` do mundo sintético. */
function subDe(mundo: Mundo): Record<string, unknown> {
  const tabelas = (
    mundo.db as unknown as { tabelas: Map<string, Array<Record<string, unknown>>> }
  ).tabelas;
  const linha = tabelas
    .get("subscription_accesses")
    ?.find((l) => l.family_account_id === mundo.familyId);
  if (!linha) throw new Error("fixture sem subscription_accesses");
  return linha;
}

/**
 * Uma família cujo teste termina em `fimEmHoras` a partir de agora.
 * Negativo = já venceu. `montarMundo` semeia assinante ativa; aqui isso é
 * sobrescrito, senão o teste passaria verde medindo uma assinante.
 */
/**
 * Consentimento e janela de horário — sem isto `podeEnviarProativa` recusa por
 * "Sem ayla_preferences (LGPD)" e o teste mediria o portão errado. A janela vai
 * de 00h a 23h59 de propósito: o objeto aqui é o TEXTO do fechamento, não a
 * preferência de horário, que tem cobertura própria.
 */
function semearPreferencias(mundo: Mundo): void {
  mundo.db.semear("ayla_preferences", [
    {
      family_account_id: mundo.familyId,
      consentimento_em: new Date(Date.now() - 30 * MS_DIA).toISOString(),
      desativada: false,
      pausada_ate: null,
      horario_preferido_inicio: "00:00:00",
      horario_preferido_fim: "23:59:00",
      frequencia: "diaria",
    },
  ]);
}

function familiaComFim(fimEmHoras: number, telefone: string): Mundo {
  const mundo = montarMundo({
    nomeMae: "Nicole",
    telefone,
    criancas: [{ nome: "Tarcisio", nascimento: "2018-10-10", genero: "masculino" }],
  });
  const linha = subDe(mundo);
  linha.status = "trialing";
  linha.created_at = new Date(
    Date.now() + fimEmHoras * MS_HORA - TRIAL_DIAS * MS_DIA,
  ).toISOString();
  linha.trial_ends_at = new Date(Date.now() + fimEmHoras * MS_HORA).toISOString();
  semearPreferencias(mundo);
  return mundo;
}

async function turno(mundo: Mundo, texto: string): Promise<string> {
  mundoRef.atual = mundo;
  mundoRef.alvo = mundo.membros["Tarcisio"];
  process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = mundo.familyId;
  await processInbound(mundo.db.cliente(), inboundDe(mundo, texto));
  await new Promise((r) => setTimeout(r, 50));
  return systems.join("\n");
}

/**
 * ESTE TURNO FOI RESPONDIDO PELO RAMO PÓS-TRIAL?
 *
 * ⚠️ NÃO DÁ PARA USAR `passouPeloExperimental` AQUI, e a diferença não é
 * cosmética: o ramo pós-Trial grava `ayla_path: "pos_trial"`, e o normal grava
 * `"experimental"`. Medir o rótulo errado daria falso vermelho num turno que
 * funcionou — foi o que aconteceu na primeira rodada deste arquivo.
 *
 * A marca vem do que o turno GRAVOU, como em `passouPeloExperimental`: é a
 * mesma coisa que se leria no banco de produção para saber quem respondeu.
 */
function passouPeloPosTrial(mundo: Mundo): boolean {
  return mundo.db.linhas("ayla_send_log").some((l) => {
    const payload = l.payload as { meta?: { ayla_path?: string } } | null;
    return payload?.meta?.ayla_path === "pos_trial";
  });
}

/** O texto que a família recebeu de fato neste mundo. */
const recebido = (mundo: Mundo) => mundo.enviadas.map((e) => e.texto).join("\n---\n");

const DIZ_ULTIMO_DIA = /hoje é o último dia|hoje termina/i;
const DIZ_TERMINOU = /terminou|chegou ao fim/i;

// ============================================================
// A PROATIVA — o prazo não pode mentir
// ============================================================

describe("o fechamento do teste diz a verdade sobre o prazo", () => {
  it("CASO 1: trial ativo e ainda não é o último dia → nenhuma copy de último dia", async () => {
    // O D-0 só é selecionado pelo cron no dia do vencimento; três dias antes o
    // que existe é o D-3, e ele não fala em "hoje".
    const mundo = familiaComFim(3 * 24, "+5541999997001");
    mundoRef.atual = mundo;
    const r = await sendTrial(
      mundo.db.cliente(),
      mundo.familyId,
      3,
      new Date(),
      String(subDe(mundo).trial_ends_at),
    );
    expect(r.enviada, "o D-3 não saiu").toBe(true);
    expect(recebido(mundo)).not.toMatch(DIZ_ULTIMO_DIA);
    expect(recebido(mundo)).toMatch(/3 dias/i);
  }, 30000);

  it("CASO 2: último dia de verdade, com horas pela frente → recebe o D-0 previsto", async () => {
    // Vence daqui a 6 horas: "hoje é o último dia" é VERDADE neste instante, e
    // é exatamente a mensagem que a família deve continuar recebendo.
    const mundo = familiaComFim(6, "+5541999997002");
    mundoRef.atual = mundo;
    const r = await sendTrial(
      mundo.db.cliente(),
      mundo.familyId,
      0,
      new Date(),
      String(subDe(mundo).trial_ends_at),
    );
    expect(r.enviada, "o D-0 legítimo não saiu").toBe(true);
    expect(recebido(mundo), "a família em D-0 real perdeu a mensagem prevista").toMatch(
      DIZ_ULTIMO_DIA,
    );
  }, 30000);

  it("CASO 3: MORDE — venceu há 9h30 (o caso Nicole) → nunca diz 'hoje é o último dia'", async () => {
    // O relógio exato do caso real: trial_ends_at 01h29, cron às 11h01.
    const mundo = familiaComFim(-9.5, "+5541999997003");
    mundoRef.atual = mundo;
    const r = await sendTrial(
      mundo.db.cliente(),
      mundo.familyId,
      0,
      new Date(),
      String(subDe(mundo).trial_ends_at),
    );
    expect(
      r.enviada,
      "a família vencida deixou de ser alcançada — isso é regressão de cobertura",
    ).toBe(true);
    expect(recebido(mundo), "a copy voltou a mentir sobre o prazo").not.toMatch(DIZ_ULTIMO_DIA);
    expect(recebido(mundo), "não disse que terminou").toMatch(DIZ_TERMINOU);
  }, 30000);

  it("MORDE: sem `trial_ends_at` legível, o comportamento é o de antes — a dúvida não inventa", async () => {
    // Não afirmar "acabou" para quem talvez ainda tenha horas é decisão
    // explícita: custaria uma conversão, e a ausência de dado não é evidência.
    const mundo = familiaComFim(-5, "+5541999997004");
    mundoRef.atual = mundo;
    await sendTrial(mundo.db.cliente(), mundo.familyId, 0, new Date(), null);
    expect(recebido(mundo)).toMatch(DIZ_ULTIMO_DIA);
  }, 30000);
});

// ============================================================
// A REATIVA — quem volta depois do fim
// ============================================================

describe("quem volta depois do fim recebe uma conversa coerente", () => {
  it("CASO 4: 'oi' de família vencida → instrução de nomear o fim, sem pergunta social", async () => {
    const mundo = familiaComFim(-9.5, "+5541999997005");
    const sys = await turno(mundo, "Oi");
    expect(
      passouPeloPosTrial(mundo),
      "o turno não chegou ao ramo pós-Trial — nada aqui foi medido",
    ).toBe(true);
    expect(sys, "o bloco pós-Trial não entrou").toContain("<pos_trial>");
    expect(sys, "a abertura sem conteúdo continua sem dono").toContain("ABERTURA SEM CONTEÚDO");
    expect(sys, "a proibição da pergunta social não chegou").toMatch(/NÃO faça pergunta social/);
    expect(sys, "o caminho da assinatura sumiu do bloco").toMatch(/link de assinatura/i);
  }, 30000);

  it("CASO 5: 'quero assinar' → instrução de parar de argumentar e entregar o link", async () => {
    const mundo = familiaComFim(-30, "+5541999997006");
    const sys = await turno(mundo, "quero assinar, como faço?");
    expect(passouPeloPosTrial(mundo)).toBe(true);
    expect(sys).toMatch(/quer assinar, PARE de argumentar e entregue o link/);
  }, 30000);

  it("CASO 6: 'me ajuda com meu filho' → proibição de orientar, sem fingir acesso", async () => {
    const mundo = familiaComFim(-30, "+5541999997007");
    const sys = await turno(mundo, "me ajuda com meu filho, ele não dorme");
    expect(passouPeloPosTrial(mundo)).toBe(true);
    expect(sys, "a proibição de orientar sumiu").toMatch(
      /NÃO PODE, em nenhuma hipótese: dar orientação individual nova/,
    );
    expect(sys, "o acolhimento do desafio sumiu").toMatch(/QUANDO A FAMÍLIA TRAZ UM DESAFIO/);
    expect(mundo.db.linhas("planos"), "gerou plano sem acesso").toHaveLength(0);
    expect(mundo.db.linhas("rotinas"), "gerou rotina sem acesso").toHaveLength(0);
  }, 30000);
});

// ============================================================
// O LINK — um convite por janela, venha ele de onde vier
// ============================================================

describe("o convite não se duplica", () => {
  it("CASO 7: MORDE — convite acabou de sair como `trial_d0`; o 'oi' seguinte não cria outro", async () => {
    const mundo = familiaComFim(-9.5, "+5541999997008");
    mundoRef.atual = mundo;

    // 11h01 — o fechamento do teste sai pelo cron, com link, sob `trial_d0`.
    await sendTrial(
      mundo.db.cliente(),
      mundo.familyId,
      0,
      new Date(),
      String(subDe(mundo).trial_ends_at),
    );
    const tokensDepoisDoCron = mundo.db.linhas("acessos_app").length;
    expect(tokensDepoisDoCron, "o fechamento não gerou o link que deveria").toBeGreaterThan(0);

    // 11h24 — ela responde "Oi".
    const sys = await turno(mundo, "Oi");
    expect(passouPeloPosTrial(mundo)).toBe(true);
    expect(
      mundo.db.linhas("acessos_app").length,
      "um SEGUNDO token foi mintado 23 minutos depois do primeiro — o defeito do caso Nicole",
    ).toBe(tokensDepoisDoCron);
    expect(sys, "sem link novo, a Ayla precisa apontar o que já está acima — não calar").toMatch(
      /O LINK DE ASSINATURA JÁ FOI ENVIADO/,
    );
  }, 30000);

  it("MORDE: sem convite anterior, o primeiro 'oi' recebe link — o cooldown não pode emudecer", async () => {
    const mundo = familiaComFim(-30, "+5541999997009");
    const sys = await turno(mundo, "Oi");
    expect(
      mundo.db.linhas("acessos_app").length,
      "quem nunca recebeu ficou sem caminho",
    ).toBeGreaterThan(0);
    expect(sys).not.toMatch(/O LINK DE ASSINATURA JÁ FOI ENVIADO/);
  }, 30000);
});

// ============================================================
// UM DONO SÓ PARA O LINK (PEND-156)
// ============================================================

describe("o link do turno tem um dono só", () => {
  it("MORDE: pedido comercial no pós-Trial cria UM token, não dois", async () => {
    // ⚠️ O DEFEITO (28/08/2026, smoke com modelo real). `ehPerguntaComercial`
    // é verdade para "quero assinar", e o bloco `comercial` de
    // `experimental.ts` mintava o SEU link enquanto o orquestrador mintava o
    // dele. Dois links diferentes, dois tokens, num único turno.
    const mundo = familiaComFim(-30, "+5541999997012");
    await turno(mundo, "quero assinar, como faço?");
    expect(passouPeloPosTrial(mundo)).toBe(true);
    expect(
      mundo.db.linhas("acessos_app").length,
      "dois tokens no mesmo turno — o bloco comercial voltou a mintar o seu",
    ).toBe(1);
  }, 30000);

  it("MORDE: o bloco manda NÃO escrever URL nem marcador de posição", async () => {
    const mundo = familiaComFim(-30, "+5541999997013");
    const sys = await turno(mundo, "Oi");
    expect(sys, "a instrução do dono do link sumiu").toMatch(
      /acrescentado AUTOMATICAMENTE ao final da sua mensagem/,
    );
    expect(sys, "a proibição de marcador de posição sumiu").toContain("[link de Planos]");
  }, 30000);

  it("MORDE: o link aparece no máximo UMA vez no texto final", async () => {
    const mundo = familiaComFim(-30, "+5541999997014");
    await turno(mundo, "quero assinar");
    const links = (recebido(mundo).match(/https?:\/\/\S+/g) ?? []).length;
    expect(links, "mais de um link na mesma mensagem").toBeLessThanOrEqual(1);
  }, 30000);

  it("MORDE: FORA do pós-Trial, a pergunta comercial NÃO perdeu o link", () => {
    // A correção precisa ser cirúrgica: quem ainda tem acesso e pergunta preço
    // continua recebendo o link autenticado do bloco comercial, porque ali o
    // orquestrador não cola nada e esse é o único dono.
    const SRC = readFileSync(join(process.cwd(), "src/lib/ayla/experimental.ts"), "utf8");
    const i = SRC.indexOf("const linkComercial =");
    expect(i, "o bloco comercial sumiu").toBeGreaterThan(-1);
    const trecho = SRC.slice(i, i + 260);
    expect(trecho, "a condição não é sobre o pós-Trial").toMatch(/!posTrial && ehPerguntaComercial/);
    expect(trecho, "o link autenticado sumiu do caminho normal").toMatch(/linkComercialAutenticado/);
  });
});

// ============================================================
// QUEM NÃO PODE SER ALCANÇADO POR NADA DISTO
// ============================================================

describe("nenhuma regressão para quem tem acesso", () => {
  it("CASO 9: assinante ativa não entra no ramo pós-Trial", async () => {
    const mundo = montarMundo({
      nomeMae: "Nicole",
      telefone: "+5541999997010",
      criancas: [{ nome: "Tarcisio", nascimento: "2018-10-10" }],
    });
    // `montarMundo` já semeia `status: "active"` com fim em 2099.
    const sys = await turno(mundo, "Oi");
    expect(passouPeloExperimental(mundo), "a assinante nem chegou ao motor").toBe(true);
    expect(sys, "a assinante recebeu o bloco de quem venceu").not.toContain("<pos_trial>");
    expect(recebido(mundo), "a assinante levou convite de assinatura").not.toMatch(
      /planos estão aqui/i,
    );
  }, 30000);

  it("CASO 10: cortesia vigente não entra no ramo pós-Trial", async () => {
    const mundo = familiaComFim(-30, "+5541999997011");
    const linha = subDe(mundo);
    linha.cortesia = true;
    linha.cortesia_ate = new Date(Date.now() + 30 * MS_DIA).toISOString();
    const sys = await turno(mundo, "Oi");
    expect(sys, "a cortesia recebeu o bloco de quem venceu").not.toContain("<pos_trial>");
    expect(recebido(mundo), "a cortesia levou convite de assinatura").not.toMatch(
      /planos estão aqui/i,
    );
  }, 30000);
});
