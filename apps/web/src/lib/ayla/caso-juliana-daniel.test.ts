import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { novoId } from "./__harness/banco-memoria";
import { estadoDoTurno, inboundDe, montarMundo, type Mundo } from "./__harness/cenario";
import { clienteFalso, type Registro } from "./__harness/modelo";
import { atoSobreArtefato } from "@/lib/conducao/ato-artefato";
import { pedeArtefatoImprimivel, apontaProRecente, RESPOSTA_PDF } from "./rotina-pdf-rota";

/**
 * O CASO JULIANA / DANIEL — 11/08/2026, produção, primeira conversa da família.
 *
 * ⚠️ RECONSTRUÍDO DO BANCO, não de memória (13/08/2026):
 *
 *   18:34 UTC  AYLA  boas-vindas (tipo `boas_vindas`)
 *   22:01 UTC  AYLA  proativa `tipo="rotina"`: "Que tal a gente começar por uma
 *                    coisa de hoje? Uma pequena vitória ou algo que foi difícil."
 *   01:59:42   MÃE   "ele esta colocando muita coisa na boca, planta, bonecos,
 *                    papel, plastico"
 *   01:59:53   AYLA  "Ainda não temos uma rotina montada pra eu transformar em
 *                    PDF 🌿 Se você me contar a sequência do dia, eu organizo e
 *                    já te mando."
 *
 * A Ayla pediu que a mãe contasse algo do dia. A mãe contou que o filho está
 * levando coisas à boca. E recebeu uma cobrança sobre rotina.
 *
 * ⚠️ A CAUSA, uma palavra: **papel**. `PEDE_PDF` casa `\bpapel\b` — a palavra
 * está lá porque "me manda no papel" é pedido legítimo de impressão. A condição
 * era VERDADEIRA; o problema é que ela respondia a outra pergunta. Detectar
 * vocabulário não é receber um pedido.
 *
 * ⚠️ O QUE **NÃO** CAUSOU, e foi verificado no banco antes de escrever isto:
 *   · não havia rotina nenhuma na família (zero linhas em `rotinas`);
 *   · não havia plano nenhum (zero linhas em `planos`);
 *   · a proativa das 19:01 (22:01 UTC) NÃO deixou estado pendente:
 *     `rotinaConversaPendente` procura `tipo = "rotina_conversa"`, e ela era
 *     `tipo = "rotina"` — string diferente, nenhum fluxo aberto;
 *   · ela também não ativou `apontaProRecente`: o texto da mãe não tem
 *     demonstrativo e a fala anterior da Ayla não tem lista numerada.
 *
 * Ou seja: nenhum aceite, nenhuma intenção herdada, nenhum pedido pendente e
 * nenhum estado persistido. O portão abriu só pelo vocabulário.
 *
 * CORRIGIDO por `283c82b` ("vocabulario detecta, ato autoriza"), commitado
 * 11/08/2026 23:14:32 -0300 — **15 minutos depois** deste turno.
 */

const FALA_DA_MAE = "ele esta colocando muita coisa na boca, planta, bonecos, papel, plastico";
const PROATIVA_19H =
  "Sabe, Juliana, quanto mais você me conta do dia a dia do Daniel — as pequenas coisas, os avanços, até os momentos difíceis — mais eu consigo enxergar de verdade como ele tá evoluindo.\n\nQue tal a gente começar por uma coisa de hoje? Uma pequena vitória ou algo que foi difícil. O que tá na cabeça agora?";

// ── OS DUPLOS ────────────────────────────────────────────────────────────
const registros: Registro[] = [];
const mundoRef: { atual: Mundo | null; alvo: string | null } = { atual: null, alvo: null };

vi.mock("./whatsappSender", () => ({
  enviarTexto: async (p: { phoneE164: string; texto: string }) => {
    mundoRef.atual?.enviadas.push({ para: p.phoneE164, texto: p.texto });
    return { ok: true, messageId: `zaap-out-${mundoRef.atual?.enviadas.length}` };
  },
  enviarImagem: async () => ({ ok: true, messageId: "img" }),
  enviarDocumento: async () => ({ ok: true, messageId: "doc" }),
  parseZapiWebhook: () => null,
}));

vi.mock("@/lib/ia/provider", () => ({
  MODELO_CONVERSA: { anthropic: "claude-sonnet-4-6", openai: "gpt-5.6-luna" },
  providerConversacionalParaFamilia: () => "anthropic",
  gerarConversacional: async (p: unknown) => {
    mundoRef.atual?.chamadas.push({
      quem: "conversa",
      prompt: JSON.stringify(p),
      mensagem: "",
      notas: [],
    });
    return {
      texto: "[resposta da Ayla]",
      provider: "anthropic",
      model: "claude-sonnet-4-6",
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
    quantidade: 1,
  }),
  descartarTurnoPendente: async () => {},
}));

vi.mock("@/lib/ai/prompts", () => ({ getSystemPrompt: async (_k: string, f: string) => f }));

const { processInbound } = await import("./orchestrator");

// ════════════════════════════════════════════════════════════════════════
// 1. A DETECÇÃO CONTINUA VERDADEIRA — e é isso que torna o caso instrutivo
// ════════════════════════════════════════════════════════════════════════

describe("o vocabulário AINDA casa — a correção não foi mexer na regex", () => {
  it("`pedeArtefatoImprimivel` continua dizendo SIM para a fala da mãe", () => {
    // Tirar "papel" da regex quebraria "me manda no papel", que é pedido real.
    // O detector está certo; ele só nunca teve autoridade para decidir sozinho.
    expect(pedeArtefatoImprimivel(FALA_DA_MAE), "a regex mudou — o caso deixou de ser este").toBe(
      true,
    );
  });

  it("MORDE: o ATO da fala não autoriza artefato nenhum", () => {
    const ato = atoSobreArtefato(FALA_DA_MAE);
    expect(["criar", "editar", "reenviar"], `o ato virou "${ato}" e o portão abre de novo`).not.toContain(
      ato,
    );
  });

  it("e os pedidos LEGÍTIMOS continuam autorizando — o falso positivo tem dois lados", () => {
    // O caso I do §12: quase toda correção que suprime algo suprime demais.
    for (const pedido of ["me manda o pdf", "quero imprimir a rotina", "me manda no papel"]) {
      expect(pedeArtefatoImprimivel(pedido), `deixou de detectar: "${pedido}"`).toBe(true);
      const ato = atoSobreArtefato(pedido);
      expect(["criar", "editar", "reenviar"], `parou de autorizar: "${pedido}" (ato=${ato})`).toContain(
        ato,
      );
    }
  });

  it("a proativa das 19:01 não apontava para nada recente", () => {
    expect(apontaProRecente(FALA_DA_MAE, PROATIVA_19H)).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════
// 2. O TURNO INTEIRO, com o contexto que existia antes dele
// ════════════════════════════════════════════════════════════════════════

/** A família como estava: Daniel, nenhuma rotina, nenhum plano, e as duas
 *  falas anteriores da Ayla no histórico — inclusive a proativa das 19:01. */
function familiaJuliana() {
  const mundo = montarMundo({
    nomeMae: "Juliana",
    criancas: [{ nome: "Daniel", nascimento: "2016-03-19", genero: "masculino" }],
  });
  mundo.db.semear("ayla_messages", [
    {
      family_account_id: mundo.familyId,
      direcao: "outbound",
      category: "proativa",
      tipo: "boas_vindas",
      texto: "Oi, Juliana! Eu sou a Ayla 💛 …",
      created_at: new Date(Date.now() - 8 * 3600_000).toISOString(),
      zaap_message_id: novoId("zaap"),
    },
    {
      family_account_id: mundo.familyId,
      direcao: "outbound",
      category: "proativa",
      // ⚠️ `tipo: "rotina"`, EXATAMENTE como está em produção. Se um dia isto
      // virar "rotina_conversa", `rotinaConversaPendente` passa a abrir um
      // fluxo de rotina em cima de uma mensagem de engajamento.
      tipo: "rotina",
      texto: PROATIVA_19H,
      created_at: new Date(Date.now() - 4 * 3600_000).toISOString(),
      zaap_message_id: novoId("zaap"),
    },
  ]);
  mundoRef.atual = mundo;
  mundoRef.alvo = mundo.membros["Daniel"];
  return mundo;
}

beforeEach(() => {
  registros.length = 0;
  mundoRef.atual = null;
  mundoRef.alvo = null;
});

describe("o turno da Juliana, hoje, pelo fluxo real", () => {
  it("MORDE: a mãe NÃO recebe mais a cobrança de rotina", async () => {
    const mundo = familiaJuliana();
    await processInbound(mundo.db.cliente(), inboundDe(mundo, FALA_DA_MAE));
    const e = estadoDoTurno(mundo);
    expect(e.respondeu).toBe(true);
    expect(e.ultimoTexto, "o caso Juliana/Daniel voltou").not.toBe(RESPOSTA_PDF.semRotina);
    expect(e.ultimoTexto ?? "").not.toContain("transformar em PDF");
    expect(e.ultimoTexto ?? "", "voltou a pedir a sequência do dia").not.toContain(
      "sequência do dia",
    );
  });

  it("MORDE: o relato vira CONVERSA — o modelo é chamado, a rota determinística não", async () => {
    const mundo = familiaJuliana();
    await processInbound(mundo.db.cliente(), inboundDe(mundo, FALA_DA_MAE));
    expect(
      mundo.chamadas.map((c) => c.quem),
      "a rota do PDF respondeu antes e o relato nunca chegou ao modelo",
    ).toContain("conversa");
  });

  it("MORDE: nenhum artefato nasce de um relato sobre a boca da criança", async () => {
    const mundo = familiaJuliana();
    await processInbound(mundo.db.cliente(), inboundDe(mundo, FALA_DA_MAE));
    const e = estadoDoTurno(mundo);
    expect(e.rotinasCriadas, "criou uma rotina a partir do relato").toBe(0);
    expect(e.planosCriados, "criou um plano a partir do relato").toBe(0);
  });

  it("o relato chega ao modelo INTEIRO — inclusive a palavra que causou tudo", async () => {
    const mundo = familiaJuliana();
    await processInbound(mundo.db.cliente(), inboundDe(mundo, FALA_DA_MAE));
    const conversa = mundo.chamadas.find((c) => c.quem === "conversa");
    expect(conversa?.prompt ?? "", "o relato foi truncado ou reescrito").toContain(
      "colocando muita coisa na boca",
    );
  });
});

// ════════════════════════════════════════════════════════════════════════
// 3. SABOTAGEM — devolver a autoridade ao vocabulário traz o caso de volta
// ════════════════════════════════════════════════════════════════════════

describe("SABOTAGEM", () => {
  it("a autorização por ATO continua escrita, e ANTES do uso", () => {
    const ORCH = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");
    expect(ORCH, "voltou a autorizar só pelo vocabulário").not.toMatch(
      /const pedeImprimivel = pedeArtefatoImprimivel\(inbound\.texto\);/,
    );
    expect(ORCH).toMatch(
      /const pedeImprimivel = pedeArtefatoImprimivel\(inbound\.texto\) && autorizaImprimivel;/,
    );
    expect(ORCH, "os três atos que autorizam mudaram sem passar por aqui").toMatch(
      /atoImprimivel === "criar" \|\| atoImprimivel === "editar" \|\| atoImprimivel === "reenviar"/,
    );
  });

  it("a fala da mãe atravessa o portão inteiro só se o ato autorizar", () => {
    // O portão real, recomposto: vocabulário E ato. Trocar o `&&` por `||` —
    // ou tirar o ato — devolve `true` e com ele a resposta errada.
    const vocabulario = pedeArtefatoImprimivel(FALA_DA_MAE);
    const ato = atoSobreArtefato(FALA_DA_MAE);
    const autoriza = ato === "criar" || ato === "editar" || ato === "reenviar";
    expect(vocabulario, "sem isto o caso não é mais este").toBe(true);
    expect(autoriza).toBe(false);
    expect(vocabulario && autoriza, "o portão abriria de novo").toBe(false);
    expect(vocabulario || autoriza, "a sabotagem não reproduz o defeito").toBe(true);
  });
});
