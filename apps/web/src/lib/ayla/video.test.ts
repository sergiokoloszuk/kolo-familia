import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BancoMemoria, novoId } from "./__harness/banco-memoria";
import { estadoDoTurno, inboundDe, montarMundo, type Mundo } from "./__harness/cenario";
import { clienteFalso, type Registro } from "./__harness/modelo";
import { parseZapiWebhook } from "./whatsappSender";

/**
 * VÍDEO — 13/08/2026.
 *
 * ⚠️ O QUE ACONTECIA. A mãe mandava um vídeo do filho em crise e não recebia
 * NADA. Nem um "recebi". `parseZapiWebhook` devolvia `null`, o webhook
 * respondia `{skipped:true}`, e `processInbound` nunca era chamado — não era a
 * Ayla sem saber o que dizer, era a Ayla nunca acordada. Silêncio, não recusa.
 *
 * E o pior caso não era o vídeo mudo: era o vídeo COM LEGENDA. `video.caption`
 * não estava na lista de legendas, então a mãe escrevia o que queria junto do
 * vídeo e perdia o próprio texto também.
 *
 * ⚠️ O QUE ESTA FATIA NÃO FAZ, e não pode passar a fazer sem decisão: assistir.
 * A Kolo não baixa nem analisa vídeo. O objetivo é não emudecer.
 *
 * ⚠️ MEDIDO em produção antes da correção: `ayla_messages` tem 327 linhas com
 * mídia — 227 áudio, 100 imagem, **zero vídeo**. Coerente com nunca entrar.
 */

// ── OS DUPLOS (mesmo desenho de `conversa-e2e.test.ts`) ──────────────────
const registros: Registro[] = [];
const mundoRef: { atual: Mundo | null; alvo: string | null } = { atual: null, alvo: null };

/**
 * O PAYLOAD INTEIRO de cada chamada conversacional.
 *
 * ⚠️ A primeira versão deste arquivo olhava `p.imagemUrl` e recebia `undefined`
 * até no controle da imagem — porque `imagemUrl` é parâmetro de `responderAyla`,
 * não do provider. O que atravessa é o bloco `<foto>` no prompt (e, quando o
 * download da imagem funciona, um content block base64). Sonda no campo errado
 * dá verde por engano nos dois sentidos.
 */
const payloads: string[] = [];
/** O prompt viu uma FOTO? É o marcador que o vídeo nunca pode acionar. */
const viuFoto = () => payloads.filter((p) => p.includes("<foto>"));

function respostaAuxiliar(system: string): string {
  const alvo = mundoRef.alvo;
  if (alvo && /membro_atipico_id/.test(system)) {
    return JSON.stringify({
      membro_atipico_id: alvo,
      confianca_identificacao: 95,
      conquista: null,
      desafio: null,
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
  return "{}";
}

vi.mock("./whatsappSender", async (original) => {
  // ⚠️ `parseZapiWebhook` NÃO é dublada: metade deste arquivo a exercita de
  // verdade. Só o envio é substituído.
  const real = await original<typeof import("./whatsappSender")>();
  return {
    ...real,
    enviarTexto: async (p: { phoneE164: string; texto: string }) => {
      mundoRef.atual?.enviadas.push({ para: p.phoneE164, texto: p.texto });
      return { ok: true, messageId: `zaap-out-${mundoRef.atual?.enviadas.length}` };
    },
    enviarImagem: async () => ({ ok: true, messageId: "img" }),
    enviarDocumento: async () => ({ ok: true, messageId: "doc" }),
  };
});

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
    payloads.push(JSON.stringify(p));
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

/** O lote dorme 3s de propósito. Nos cenários de turno cada fala vem sozinha,
 *  então o duplo devolve "segue com o seu texto" — que é o resultado real desse
 *  caso. A janela DE VERDADE é exercitada no último bloco, sem este duplo. */
vi.mock("./lote-inbound", async (original) => {
  const real = await original<typeof import("./lote-inbound")>();
  return {
    ...real,
    aguardarTurnoDaMae: async (_s: unknown, p: { textoAtual: string }) => ({
      texto: p.textoAtual,
      quantidade: 1,
    }),
    descartarTurnoPendente: async () => {},
  };
});

vi.mock("@/lib/ai/prompts", () => ({ getSystemPrompt: async (_k: string, f: string) => f }));

const { processInbound } = await import("./orchestrator");
void respostaAuxiliar;

// ════════════════════════════════════════════════════════════════════════
// 1. A PORTA DE ENTRADA — `parseZapiWebhook` de verdade
// ════════════════════════════════════════════════════════════════════════

const base = { phone: "5511999990000", fromMe: false };

describe("o vídeo atravessa a porta de entrada", () => {
  it("1. vídeo SEM legenda entra — antes devolvia null e o webhook ficava mudo", () => {
    const r = parseZapiWebhook({
      ...base,
      messageId: "M1",
      video: { videoUrl: "https://z.api/v1.mp4", mimeType: "video/mp4", caption: "" },
    });
    expect(r, "vídeo sem legenda continua morrendo no parser").not.toBeNull();
    expect(r?.midiaTipo).toBe("video");
    expect(r?.midiaUrl).toBe("https://z.api/v1.mp4");
    expect(r?.texto).toBe("");
  });

  it("2. vídeo com `video.caption` PRESERVA o texto da mãe", () => {
    // O pior dos casos antigos: ela escreveu o que queria e sumiu tudo.
    const r = parseZapiWebhook({
      ...base,
      messageId: "M2",
      video: { videoUrl: "https://z.api/v2.mp4", caption: "olha ele batendo a cabeça" },
    });
    expect(r?.texto).toBe("olha ele batendo a cabeça");
    expect(r?.midiaTipo).toBe("video");
  });

  it("3. vídeo com caption na RAIZ preserva o texto E marca que era vídeo", () => {
    // Este caso já "entrava" antes — como texto puro, sem midiaTipo nenhum. A
    // Ayla respondia sem saber que houve vídeo, e o banco não guardava rastro.
    const r = parseZapiWebhook({
      ...base,
      messageId: "M3",
      caption: "olha ele batendo a cabeça",
      video: { videoUrl: "https://z.api/v3.mp4" },
    });
    expect(r?.texto).toBe("olha ele batendo a cabeça");
    expect(r?.midiaTipo, "entrou como texto puro, sem saber que era vídeo").toBe("video");
  });

  it("3b. forma achatada do n8n (mediaUrl + mediaType) também entra", () => {
    const r = parseZapiWebhook({
      ...base,
      messageId: "M3b",
      mediaUrl: "https://z.api/v3b.mp4",
      mediaType: "video",
    });
    expect(r?.midiaTipo).toBe("video");
  });

  it("4. vídeo SEM URL entra — metadata quebrada não pode virar silêncio", () => {
    const r = parseZapiWebhook({ ...base, messageId: "M4", video: { mimeType: "video/mp4" } });
    expect(r, "vídeo sem url voltou a morrer calado").not.toBeNull();
    expect(r?.midiaTipo).toBe("video");
    expect(r?.midiaUrl).toBeUndefined();
  });

  it("4b. vídeo sem URL mas COM legenda preserva a legenda", () => {
    const r = parseZapiWebhook({
      ...base,
      messageId: "M4b",
      video: { mimeType: "video/mp4", caption: "olha isso" },
    });
    expect(r?.texto).toBe("olha isso");
    expect(r?.midiaTipo).toBe("video");
  });

  it("o messageId sobrevive — é a trava de idempotência", () => {
    const r = parseZapiWebhook({ ...base, messageId: "M-id", video: { videoUrl: "u" } });
    expect(r?.messageId).toBe("M-id");
  });
});

describe("CONTROLES — imagem e áudio não podem ter regredido", () => {
  it("imagem COM legenda: entra, com legenda e url", () => {
    const r = parseZapiWebhook({
      ...base,
      messageId: "C1",
      image: { imageUrl: "https://z.api/i.jpg", caption: "a lição" },
    });
    expect(r?.texto).toBe("a lição");
    expect(r?.midiaTipo).toBe("image");
    expect(r?.midiaUrl).toBe("https://z.api/i.jpg");
  });

  it("imagem SEM legenda: entra, texto vazio, tipo image", () => {
    const r = parseZapiWebhook({ ...base, messageId: "C2", image: { imageUrl: "https://z.api/i.jpg" } });
    expect(r?.midiaTipo).toBe("image");
    expect(r?.texto).toBe("");
  });

  it("áudio: entra para ser transcrito", () => {
    const r = parseZapiWebhook({ ...base, messageId: "C3", audio: { audioUrl: "https://z.api/a.ogg" } });
    expect(r?.midiaTipo).toBe("audio");
    expect(r?.midiaUrl).toBe("https://z.api/a.ogg");
  });

  it("texto puro: intocado", () => {
    const r = parseZapiWebhook({ ...base, messageId: "C4", text: { message: "oi" } });
    expect(r?.texto).toBe("oi");
    expect(r?.midiaTipo).toBeUndefined();
  });

  it("o que não é mensagem CONTINUA sendo descartado", () => {
    expect(parseZapiWebhook({ ...base, messageId: "C5" }), "payload vazio passou a entrar").toBeNull();
    expect(parseZapiWebhook({ ...base, fromMe: true, text: { message: "eco" } })).toBeNull();
    expect(
      parseZapiWebhook({ ...base, messageId: "C6", mediaUrl: "u", mediaType: "sticker" }),
      "sticker sem texto passou a entrar",
    ).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════
// 2. O TURNO INTEIRO — `processInbound` de verdade
// ════════════════════════════════════════════════════════════════════════

function familia() {
  const m = montarMundo({
    nomeMae: "Rosangela",
    criancas: [{ nome: "Theo", nascimento: "2019-03-10", genero: "masculino" }],
  });
  mundoRef.atual = m;
  mundoRef.alvo = m.membros["Theo"];
  return m;
}

const inboundVideo = (mundo: Mundo, texto = "") => ({
  ...inboundDe(mundo, texto),
  midiaTipo: "video",
  midiaUrl: "https://z.api/v.mp4",
});

beforeEach(() => {
  registros.length = 0;
  payloads.length = 0;
  mundoRef.atual = null;
  mundoRef.alvo = null;
});

describe("vídeo sem texto: recado honesto, sem modelo nenhum", () => {
  it("MORDE: a mãe recebe resposta — o silêncio acabou", async () => {
    const mundo = familia();
    await processInbound(mundo.db.cliente(), inboundVideo(mundo));
    const e = estadoDoTurno(mundo);
    expect(e.respondeu, "a Ayla ficou muda diante do vídeo").toBe(true);
    expect(e.ultimoTexto).toContain("Recebi seu vídeo");
    expect(e.ultimoTexto, "prometeu assistir depois").toContain("ainda não consigo assistir");
    expect(e.ultimoTexto, "fechou a conversa em vez de continuá-la").toMatch(/me conta/i);
  });

  it("MORDE: ZERO chamada de IA neste caminho", async () => {
    const mundo = familia();
    await processInbound(mundo.db.cliente(), inboundVideo(mundo));
    expect(mundo.chamadas.map((c) => c.quem), "chamou o modelo para dizer uma frase fixa").toEqual([]);
    expect(registros.length, "chamou o modelo auxiliar (parser/intenção)").toBe(0);
  });

  it("MORDE: fica salvo COMO VÍDEO, com a url e o id da mensagem", async () => {
    const mundo = familia();
    const inb = inboundVideo(mundo);
    await processInbound(mundo.db.cliente(), inb);
    const entrada = mundo.db
      .linhas("ayla_messages")
      .find((m) => m.direcao === "inbound");
    expect(entrada?.midia_tipo, "o vídeo não ficou marcado como vídeo").toBe("video");
    expect(entrada?.midia_url).toBe("https://z.api/v.mp4");
    expect(entrada?.zaap_message_id, "sem id não há trava de idempotência").toBe(inb.messageId);
  });

  it("MORDE: o tipo da saída é `midia_nao_suportada`, não `resposta_registro`", async () => {
    // Com `resposta_registro` a ponte do Plano dispararia, e a mãe receberia um
    // PDF de plano por ter mandado um vídeo — o caso real de 03/08 com a rotina.
    const mundo = familia();
    await processInbound(mundo.db.cliente(), inboundVideo(mundo));
    const e = estadoDoTurno(mundo);
    expect(e.tipo).toBe("midia_nao_suportada");
    expect(e.planosCriados, "o vídeo gerou um Plano").toBe(0);
    expect(e.rotinasCriadas).toBe(0);
  });

  it("MORDE: o vídeo em si nunca é baixado nem analisado", async () => {
    const mundo = familia();
    await processInbound(mundo.db.cliente(), inboundVideo(mundo));
    expect(payloads, "o modelo foi chamado no caminho do recado fixo").toEqual([]);
    expect(mundo.db.linhas("desenhos").length).toBe(0);
  });

  it("IDEMPOTÊNCIA: o mesmo webnook duas vezes responde UMA vez", async () => {
    const mundo = familia();
    const inb = inboundVideo(mundo);
    await processInbound(mundo.db.cliente(), inb);
    await processInbound(mundo.db.cliente(), inb);
    expect(mundo.enviadas.length, "a Z-API reentregou e a mãe recebeu duas vezes").toBe(1);
  });
});

describe("vídeo COM texto: conversa normal, sobre o texto — nunca sobre o vídeo", () => {
  it("MORDE: responde pelo fluxo conversacional, não pelo recado fixo", async () => {
    const mundo = familia();
    await processInbound(
      mundo.db.cliente(),
      inboundVideo(mundo, "olha ele batendo a cabeça quando a irmã chega"),
    );
    const e = estadoDoTurno(mundo);
    expect(e.respondeu).toBe(true);
    expect(e.ultimoTexto, "caiu no recado fixo tendo texto da mãe").not.toContain("Recebi seu vídeo");
    expect(e.tipo).not.toBe("midia_nao_suportada");
    expect(mundo.chamadas.map((c) => c.quem)).toContain("conversa");
  });

  it("MORDE: `imagemUrl` chega NULO ao modelo — fingir que assistiu é impossível", async () => {
    // A garantia não é uma proibição em prompt (que competiria com "seja
    // prestativa" e perderia). É o orquestrador não oferecer o que não existe:
    // `imagemUrl` exige `midiaTipo === "image"`, igualdade estrita.
    const mundo = familia();
    await processInbound(mundo.db.cliente(), inboundVideo(mundo, "olha ele batendo a cabeça"));
    expect(payloads.length, "o modelo conversacional nem foi chamado").toBeGreaterThan(0);
    expect(viuFoto(), "o vídeo entrou no prompt como se fosse foto").toEqual([]);
    for (const p of payloads) {
      expect(p, "a url do vídeo vazou para o modelo").not.toContain("v.mp4");
    }
  });

  it("MORDE: continua salvo como vídeo, com o texto da mãe junto", async () => {
    const mundo = familia();
    await processInbound(mundo.db.cliente(), inboundVideo(mundo, "olha ele batendo a cabeça"));
    const entrada = mundo.db.linhas("ayla_messages").find((m) => m.direcao === "inbound");
    expect(entrada?.midia_tipo).toBe("video");
    expect(entrada?.texto).toBe("olha ele batendo a cabeça");
  });
});

describe("CONTROLES do turno — imagem e áudio não regrediram", () => {
  it("imagem com legenda: segue no caminho de VISÃO, com a url", async () => {
    const mundo = familia();
    await processInbound(mundo.db.cliente(), {
      ...inboundDe(mundo, "o que essa lição pede?"),
      midiaTipo: "image",
      midiaUrl: "https://z.api/licao.jpg",
    });
    expect(estadoDoTurno(mundo).tipo).not.toBe("midia_nao_suportada");
    expect(viuFoto().length, "a imagem parou de chegar ao modelo como foto").toBeGreaterThan(0);
  });

  it("imagem SEM legenda: NÃO cai no recado de vídeo", async () => {
    const mundo = familia();
    await processInbound(mundo.db.cliente(), {
      ...inboundDe(mundo, ""),
      midiaTipo: "image",
      midiaUrl: "https://z.api/foto.jpg",
    });
    expect(estadoDoTurno(mundo).ultimoTexto ?? "").not.toContain("Recebi seu vídeo");
  });

  it("texto puro: nada mudou", async () => {
    const mundo = familia();
    await processInbound(mundo.db.cliente(), inboundDe(mundo, "ele não quis ir pra escola hoje"));
    const e = estadoDoTurno(mundo);
    expect(e.respondeu).toBe(true);
    expect(e.tipo).not.toBe("midia_nao_suportada");
  });
});

// ════════════════════════════════════════════════════════════════════════
// 3. A JANELA DO LOTE — relógio de verdade, sem duplo
// ════════════════════════════════════════════════════════════════════════

describe("vídeo + texto: dentro e fora da janela de 3s", () => {
  // ⚠️ O LOTE DE VERDADE, não o duplo declarado lá em cima. A primeira versão
  // importava `./lote-inbound` no topo e recebia o MOCK — o teste "provava" que
  // o texto se perdia, quando estava lendo a própria dublagem.
  const real = () => vi.importActual<typeof import("./lote-inbound")>("./lote-inbound");

  const bancoCom = (linhas: Array<{ texto: string; quando: Date }>) => {
    const db = new BancoMemoria();
    db.semear(
      "ayla_messages",
      linhas.map((l) => ({
        id: novoId("msg"),
        family_account_id: "fam-1",
        direcao: "inbound",
        texto: l.texto,
        created_at: l.quando.toISOString(),
        processada_em: null,
      })),
    );
    return db;
  };

  const FALA = "olha o que ele faz quando a irmã chega";

  it("DENTRO de 3s: vídeo (texto vazio) + texto viram UM turno, e o texto manda", async () => {
    // ⚠️ AS DUAS MENSAGENS FICAM NO PASSADO. Carimbar a segunda no futuro faz o
    // lote ver "chegou algo depois de mim" e CEDER A VEZ — foi como este teste
    // nasceu, devolvendo null e parecendo defeito de produto. Quem responde uma
    // rajada é sempre a ÚLTIMA execução, e para ela as duas já estão gravadas.
    const agora = Date.now();
    const db = bancoCom([
      { texto: "", quando: new Date(agora - 2000) }, // o vídeo
      { texto: FALA, quando: new Date(agora - 1500) }, // a fala, 500ms depois
    ]);
    const { aguardarTurnoDaMae } = await real();
    const r = await aguardarTurnoDaMae(db.cliente(), { familyId: "fam-1", textoAtual: FALA });
    expect(r, "o lote cedeu a vez e ninguém respondeu").not.toBeNull();
    expect(r?.texto, "a fala da mãe se perdeu junto com o texto vazio do vídeo").toBe(FALA);
    // E o vídeo saiu da fila junto — senão voltaria sozinho no próximo lote e a
    // mãe receberia o recado de vídeo depois de já ter sido respondida.
    const pendentes = db.linhas("ayla_messages").filter((m) => m.processada_em == null);
    expect(pendentes.length, "o vídeo ficou pendente e voltará fora de hora").toBe(0);
  }, 15_000);

  it("FORA de 3s: são dois turnos — comportamento de hoje, e é a PEND-058", async () => {
    // ⚠️ NÃO é regressão desta fatia e NÃO se resolve alargando a janela: a
    // mediana entre balões do mesmo turno é 11,2s (p90 34s), então cobrir isso
    // custaria 34 segundos de espera a 100% dos turnos, sendo que 86,3% têm um
    // balão só. A mãe recebe o recado do vídeo e, depois, a resposta ao texto.
    const db = bancoCom([{ texto: "", quando: new Date(Date.now() - 2000) }]);
    const { aguardarTurnoDaMae } = await real();
    const r1 = await aguardarTurnoDaMae(db.cliente(), { familyId: "fam-1", textoAtual: "" });
    expect(r1?.texto, "o turno do vídeo já saiu sem texto — é ele que dispara o recado").toBe("");

    // A fala chega 8s depois do vídeo: turno NOVO, porque o anterior já foi
    // claimado e não volta.
    db.semear("ayla_messages", [
      {
        id: novoId("msg"),
        family_account_id: "fam-1",
        direcao: "inbound",
        texto: FALA,
        created_at: new Date(Date.now() - 500).toISOString(),
        processada_em: null,
      },
    ]);
    const r2 = await aguardarTurnoDaMae(db.cliente(), { familyId: "fam-1", textoAtual: FALA });
    expect(r2?.texto, "os dois turnos se fundiram — a janela mudou sem dado").toBe(FALA);
  }, 20_000);
});

// ════════════════════════════════════════════════════════════════════════
// 4. SABOTAGEM — as duas garantias estruturais continuam escritas
// ════════════════════════════════════════════════════════════════════════

describe("SABOTAGEM", () => {
  const ORCH = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");
  const SENDER = readFileSync(resolve(__dirname, "whatsappSender.ts"), "utf8");

  it("o vídeo continua aceito no portão de entrada", () => {
    expect(SENDER).toMatch(/const ehVideo = midiaTipo === "video";/);
    expect(SENDER).toMatch(/!ehAudio && !ehImagem && !ehVideo/);
    expect(SENDER, "voltou a exigir url para o vídeo entrar").not.toMatch(
      /const ehVideo = Boolean\(midiaUrl\)/,
    );
  });

  it("a igualdade estrita que impede fingir que assistiu continua lá", () => {
    // Trocar por `midiaTipo !== "audio"` ou por um `includes` abriria o vídeo
    // para o caminho de visão sem que nenhum teste de texto percebesse.
    expect(ORCH).toMatch(/imagemUrl: inbound\.midiaTipo === "image" \? \(inbound\.midiaUrl \?\? null\) : null/);
  });

  it("o recado do vídeo não passa por modelo", () => {
    const bloco = ORCH.slice(ORCH.indexOf('if (inbound.midiaTipo === "video"'));
    const ate = bloco.slice(0, bloco.indexOf("return { tratada: true"));
    expect(ate).toMatch(/TEXTO_VIDEO_SEM_TEXTO/);
    expect(ate, "o recado fixo passou a ser gerado").not.toMatch(/gerarConversacional|responderAyla/);
    expect(ate).toMatch(/tipo: "midia_nao_suportada"/);
  });
});
