import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { montarMundo, inboundDe, type Mundo } from "./__harness/cenario";
import { clienteFalso, type Registro } from "./__harness/modelo";

/**
 * BLOQUEADOR 2 · A PONTE DO PLANO CHEGA AO CAMINHO NOVO — provada pelo turno.
 *
 * ⚠️ O QUE ESTAVA ERRADO. A ponte do plano vivia DENTRO de
 * `enviarRespostaEmChunks`, chamada num lugar só: o Legacy. O ramo experimental
 * publica por `enviarEPersistir` — outra função. Uma família no experimento
 * conversava e nunca recebia plano nenhum, e nenhum teste acusava isso, porque
 * nenhum exercitava a ponte pelo caminho novo.
 *
 * ⚠️ POR QUE ESTE ARQUIVO MOCKA `@/lib/ia/provider`. Sem isso
 * `gerarConversacional` morre por falta de chave, `responderExperimental`
 * devolve `null` e o turno CAI PARA O LEGACY — que é fail-closed correto em
 * produção e um falso verde num teste que diz medir o caminho novo. O teste 0
 * existe para provar que o ramo experimental realmente rodou.
 *
 * ⚠️ O QUE ESTE ARQUIVO PROVA E O QUE NÃO PROVA.
 *   PROVA: quem chama a ponte, com que família e que criança, o que a família
 *   recebe, o que fica em `ayla_messages`, e que os freios reais (cooldown /
 *   janela de 20h) continuam de pé no caminho novo.
 *   NÃO PROVA: o texto que um modelo de verdade escreveria dentro do plano —
 *   `gerarPlano` é o MESMO dos dois caminhos e não foi tocado nesta mudança.
 */

const registros: Registro[] = [];
const mundoRef: { atual: Mundo | null; alvo: string | null } = { atual: null, alvo: null };

/** O que a ponte recebeu, turno a turno — a prova de família/criança corretas. */
type ChamadaPonte = {
  familyId: string;
  membroAtipicoId: string | null;
  mensagem: string;
  temDesafio: boolean;
  phoneE164: string;
  forcar?: boolean;
};
const chamadasPonte: ChamadaPonte[] = [];
/** `real: true` deixa a ponte VERDADEIRA rodar (para provar os freios dela). */
const ponteRef: { real: boolean; resposta: string | null } = { real: false, resposta: null };

vi.mock("./whatsappSender", () => ({
  enviarTexto: async (p: { phoneE164: string; texto: string }) => {
    mundoRef.atual?.enviadas.push({ texto: p.texto, para: p.phoneE164 });
    return { messageId: `msg-${mundoRef.atual?.enviadas.length}`, raw: {} };
  },
  enviarDocumento: async () => ({ messageId: "doc", raw: {} }),
  enviarImagem: async () => ({ messageId: "img", raw: {} }),
  sendVideoGuia: async () => ({ messageId: "vid", raw: {} }),
  parseZapiWebhook: () => null,
}));

vi.mock("@/lib/ia/provider", () => ({
  MODELO_CONVERSA: { anthropic: "claude-sonnet-4-6", openai: "gpt-5.6-luna" },
  providerConversacionalParaFamilia: () => "openai",
  gerarConversacional: async () => ({
    texto: "[resposta da Ayla experimental]",
    provider: "openai",
    model: "gpt-5.6-luna",
    tokensIn: 100,
    tokensOut: 20,
    cacheRead: 0,
    cacheWrite: 0,
    ms: 1,
  }),
}));

vi.mock("./anthropic", async (orig) => {
  const real = (await orig()) as Record<string, unknown>;
  return { ...real, getAylaAnthropicClient: () => clienteFalso({ alvo: mundoRef.alvo }, registros) };
});

vi.mock("./ponte", async (orig) => {
  const real = (await orig()) as Record<string, unknown>;
  const verdadeira = real.montarPonteWhatsApp as (s: unknown, p: ChamadaPonte) => Promise<string | null>;
  return {
    ...real,
    montarPonteWhatsApp: async (supabase: unknown, params: ChamadaPonte) => {
      chamadasPonte.push({ ...params });
      if (ponteRef.real) return verdadeira(supabase, params);
      return ponteRef.resposta;
    },
  };
});

const { processInbound } = await import("./orchestrator");

const NUDGE =
  "Montei um plano estratégico com atividades sobre isso 🌿\nPra ver no app (já entra direto): https://app.kolo/auth/wa?t=tok";

function criancaEscolar() {
  return montarMundo({
    nomeMae: "Juliana",
    telefone: "+5541999990022",
    criancas: [{ nome: "Daniel", nascimento: "2016-03-19", genero: "masculino" }],
  });
}
function doisIrmaos() {
  return montarMundo({
    nomeMae: "Renata",
    telefone: "+5541999990023",
    criancas: [
      { nome: "Bento", nascimento: "2017-08-02", genero: "masculino" },
      { nome: "Alice", nascimento: "2020-11-15", genero: "feminino" },
    ],
  });
}

const ENV = process.env.AYLA_EXPERIMENTAL_FAMILY_IDS;
beforeEach(() => {
  registros.length = 0;
  chamadasPonte.length = 0;
  ponteRef.real = false;
  ponteRef.resposta = NUDGE;
});
afterEach(() => {
  if (ENV === undefined) delete process.env.AYLA_EXPERIMENTAL_FAMILY_IDS;
  else process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = ENV;
});

/** As saídas gravadas desta família — o que sobrou depois do turno. */
function saidas(mundo: Mundo) {
  return mundo.db.linhas("ayla_messages").filter((m) => m.direcao === "outbound");
}
/** O turno rodou pelo ramo experimental? A métrica só existe lá. */
function passouPeloExperimental(mundo: Mundo): boolean {
  return mundo.db
    .linhas("ayla_send_log")
    .some((l) => {
      const payload = l.payload as { meta?: { ayla_path?: string } } | null;
      return payload?.meta?.ayla_path === "experimental";
    });
}

async function esperarPersistencia() {
  await new Promise((r) => setTimeout(r, 50));
}

describe("O CAMINHO NOVO ENTREGA PLANO", () => {
  it("0. o turno rodou mesmo pelo experimental (senão tudo abaixo mede o Legacy)", async () => {
    const mundo = criancaEscolar();
    mundoRef.atual = mundo;
    mundoRef.alvo = mundo.membros["Daniel"];
    process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = mundo.familyId;

    await processInbound(mundo.db.cliente(), inboundDe(mundo, "Oi, tudo bem?"));
    await esperarPersistencia();

    expect(passouPeloExperimental(mundo), "o turno caiu para o Legacy").toBe(true);
  }, 30000);

  it("1. pedido explícito de plano: a ponte é chamada, e forçada", async () => {
    const mundo = criancaEscolar();
    mundoRef.atual = mundo;
    mundoRef.alvo = mundo.membros["Daniel"];
    process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = mundo.familyId;

    await processInbound(
      mundo.db.cliente(),
      inboundDe(mundo, "Me manda um plano pra ajudar o Daniel com a hora de dormir, por favor"),
    );
    await esperarPersistencia();

    expect(chamadasPonte.length, "a ponte não foi chamada pelo caminho novo").toBe(1);
    // `forcar` é o que fura dedup e gate de suficiência — sem ele, um pedido
    // explícito ficaria esperando a prontidão que a conversa ainda não tem.
    expect(chamadasPonte[0].forcar).toBe(true);
  }, 30000);

  it("2. a resposta principal sai UMA vez, e a ponte vem DEPOIS dela", async () => {
    const mundo = criancaEscolar();
    mundoRef.atual = mundo;
    mundoRef.alvo = mundo.membros["Daniel"];
    process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = mundo.familyId;

    await processInbound(
      mundo.db.cliente(),
      inboundDe(mundo, "Preciso de um plano pro Daniel, ele não para na lição"),
    );
    await esperarPersistencia();

    const principais = mundo.enviadas.filter((e) => e.texto.includes("[resposta da Ayla"));
    expect(principais.length, "a resposta principal saiu mais de uma vez").toBe(1);

    const iPrincipal = mundo.enviadas.findIndex((e) => e.texto.includes("[resposta da Ayla"));
    const iPonte = mundo.enviadas.findIndex((e) => e.texto.includes("/auth/wa"));
    expect(iPonte, "a ponte não chegou à família").toBeGreaterThan(-1);
    expect(iPonte, "a ponte saiu antes da resposta principal").toBeGreaterThan(iPrincipal);
  }, 30000);

  it("3. a ponte é da família e da criança do turno", async () => {
    const mundo = doisIrmaos();
    mundoRef.atual = mundo;
    mundoRef.alvo = mundo.membros["Bento"];
    process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = mundo.familyId;

    await processInbound(
      mundo.db.cliente(),
      inboundDe(mundo, "Queria um plano pro Bento, ele briga na hora de sair de casa"),
    );
    await esperarPersistencia();

    expect(chamadasPonte.length).toBe(1);
    expect(chamadasPonte[0].familyId).toBe(mundo.familyId);
    expect(chamadasPonte[0].phoneE164).toBe(mundo.telefone);
    // Irmãos: o plano NUNCA pode nascer carimbado na outra criança.
    expect(chamadasPonte[0].membroAtipicoId).not.toBe(mundo.membros["Alice"]);
  }, 30000);

  it("4. a bolha da ponte FICA em ayla_messages — é ela que sustenta o dedup", async () => {
    const mundo = criancaEscolar();
    mundoRef.atual = mundo;
    mundoRef.alvo = mundo.membros["Daniel"];
    process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = mundo.familyId;

    await processInbound(
      mundo.db.cliente(),
      inboundDe(mundo, "Pode me mandar um plano pro Daniel sobre a rotina da noite?"),
    );
    await esperarPersistencia();

    // O cooldown e a janela de 20h procuram "/auth/wa" nas mensagens gravadas.
    // Enviar sem persistir deixaria o freio cego — e a família ganharia um
    // plano por turno.
    const comLink = saidas(mundo).filter((m) => String(m.texto ?? "").includes("/auth/wa"));
    expect(comLink.length, "a ponte foi enviada e não foi gravada").toBe(1);
    expect(comLink[0].family_account_id).toBe(mundo.familyId);
  }, 30000);
});

describe("O QUE A PONTE NÃO PODE FAZER", () => {
  it('5. "sim" curto sem oferta recente NÃO vira plano forçado', async () => {
    const mundo = criancaEscolar();
    mundoRef.atual = mundo;
    mundoRef.alvo = mundo.membros["Daniel"];
    process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = mundo.familyId;

    await processInbound(mundo.db.cliente(), inboundDe(mundo, "sim"));
    await esperarPersistencia();

    // A ponte pode até ser avaliada — o que não pode é vir FORÇADA, porque
    // não houve oferta nenhuma para este "sim" estar aceitando.
    for (const c of chamadasPonte) expect(c.forcar).toBe(false);
  }, 30000);

  it('6. "sim" curto DEPOIS de a Ayla oferecer um plano vira pedido', async () => {
    const mundo = criancaEscolar();
    mundoRef.atual = mundo;
    mundoRef.alvo = mundo.membros["Daniel"];
    process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = mundo.familyId;

    // A oferta que o "sim" está aceitando — do jeito que ela fica no banco.
    mundo.db.semear("ayla_messages", [
      {
        id: "msg-oferta",
        family_account_id: mundo.familyId,
        membro_atipico_id: mundo.membros["Daniel"],
        direcao: "outbound",
        category: "reativa",
        tipo: "resposta_registro",
        texto: "Quer que eu monte um plano estratégico com atividades sobre isso?",
        enviada_em: new Date().toISOString(),
        created_at: new Date().toISOString(),
      },
    ]);

    await processInbound(mundo.db.cliente(), inboundDe(mundo, "sim"));
    await esperarPersistencia();

    expect(chamadasPonte.length, "a ponte não foi avaliada").toBeGreaterThan(0);
    expect(chamadasPonte[0].forcar, "o aceite curto não virou pedido de plano").toBe(true);
  }, 30000);

  it("7. o freio REAL de 20h continua de pé no caminho novo", async () => {
    const mundo = criancaEscolar();
    mundoRef.atual = mundo;
    mundoRef.alvo = mundo.membros["Daniel"];
    // Agora sem duplo: quem decide é `montarPonteWhatsApp` de verdade.
    ponteRef.real = true;
    process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = mundo.familyId;

    // Um plano entregue há 3 minutos. O cooldown vale MESMO com `forcar`.
    mundo.db.semear("ayla_messages", [
      {
        id: "msg-plano-recente",
        family_account_id: mundo.familyId,
        membro_atipico_id: mundo.membros["Daniel"],
        direcao: "outbound",
        category: "reativa",
        tipo: "resposta_registro",
        texto: "Pra ver no app (já entra direto): https://app.kolo/auth/wa?t=antigo",
        enviada_em: new Date(Date.now() - 3 * 60_000).toISOString(),
        created_at: new Date(Date.now() - 3 * 60_000).toISOString(),
      },
    ]);

    const antes = saidas(mundo).length;
    await processInbound(
      mundo.db.cliente(),
      inboundDe(mundo, "Me manda um plano pro Daniel de novo, por favor"),
    );
    await esperarPersistencia();

    const novasComLink = saidas(mundo)
      .slice(antes)
      .filter((m) => String(m.texto ?? "").includes("/auth/wa"));
    expect(novasComLink.length, "a família levou dois planos em minutos").toBe(0);
  }, 30000);
});

describe("O LEGACY NÃO MUDOU", () => {
  it("8. fora da allowlist, o pedido de plano continua chegando à ponte", async () => {
    const mundo = criancaEscolar();
    mundoRef.atual = mundo;
    mundoRef.alvo = mundo.membros["Daniel"];
    delete process.env.AYLA_EXPERIMENTAL_FAMILY_IDS;

    await processInbound(
      mundo.db.cliente(),
      inboundDe(mundo, "Me manda um plano pra ajudar o Daniel com a hora de dormir, por favor"),
    );
    await esperarPersistencia();

    expect(passouPeloExperimental(mundo), "a família de controle entrou no experimento").toBe(false);
    expect(chamadasPonte.length, "o Legacy deixou de chamar a ponte").toBe(1);
    expect(chamadasPonte[0].forcar).toBe(true);
    expect(chamadasPonte[0].familyId).toBe(mundo.familyId);
  }, 30000);
});
