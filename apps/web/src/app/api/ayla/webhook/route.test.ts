import { beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({
  tarefas: [] as Array<() => Promise<void>>,
  entradas: [] as Array<Record<string, unknown>>,
  enviadas: [] as Array<Record<string, unknown>>,
  eventos: [] as Array<Record<string, unknown>>,
  inbound: {
    phoneE164: "+5511999990000",
    texto: "",
    messageId: "inbound-ficticio",
    recebidaEm: new Date("2026-10-11T10:00:00.000Z"),
    midiaTipo: "audio" as string | null,
    midiaUrl: "https://exemplo.invalid/audio.ogg" as string | null,
  },
  transcricao: "" as string | null,
  chamadasStt: 0,
  falharEnvio: false,
  falharProcessamento: false,
}));

vi.mock("@/lib/log", () => ({
  logEvent: async (evento: Record<string, unknown>) => { estado.eventos.push(evento); },
}));
vi.mock("next/server", () => ({
  NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) },
  after: (tarefa: () => Promise<void>) => { estado.tarefas.push(tarefa); },
}));
vi.mock("@/lib/supabase/server", () => ({ createServiceRoleClient: () => ({ origem: "banco-ficticio" }) }));
vi.mock("@/lib/ayla/whatsappSender", () => ({
  parseZapiWebhook: () => ({ ...estado.inbound }),
  enviarTexto: async (params: Record<string, unknown>) => {
    estado.enviadas.push(params);
    if (estado.falharEnvio) throw new Error("falha sintética do provedor");
    return { ok: true, messageId: "fallback-ficticio" };
  },
}));
vi.mock("@/lib/ayla/orchestrator", () => ({
  idiomaPorTelefone: async () => "pt",
  processInbound: async (_db: unknown, inbound: Record<string, unknown>) => {
    estado.entradas.push(inbound);
    if (estado.falharProcessamento) throw new Error("erro com texto-ficticio-sigiloso e +5511999990000");
    return { tratada: true };
  },
}));
vi.mock("@/lib/ayla/transcribe", () => ({
  transcreverAudio: async () => {
    estado.chamadasStt += 1;
    return estado.transcricao;
  },
}));

const { POST } = await import("./route");

beforeEach(() => {
  estado.tarefas.length = 0;
  estado.entradas.length = 0;
  estado.enviadas.length = 0;
  estado.eventos.length = 0;
  estado.chamadasStt = 0;
  estado.falharEnvio = false;
  estado.falharProcessamento = false;
  estado.transcricao = "Áudio fictício transcrito";
  estado.inbound.texto = "";
  estado.inbound.midiaTipo = "audio";
  estado.inbound.midiaUrl = "https://exemplo.invalid/audio.ogg";
  vi.restoreAllMocks();
});

async function receber(payload: Record<string, unknown>) {
  const resposta = await POST(new Request("http://localhost/api/ayla/webhook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  }) as never);
  expect(resposta.status).toBe(200);
  expect(await resposta.json()).toEqual({ ok: true, queued: true });
  expect(estado.tarefas).toHaveLength(1);
  await estado.tarefas[0]();
}

async function receberAudio() {
  await receber({ phone: "5511999990000", audio: { audioUrl: "https://exemplo.invalid/audio.ogg" } });
}

describe("G0 · fronteira do áudio no webhook", () => {
  it("passa a transcrição para o turno sem mudar o tipo de mídia", async () => {
    await receberAudio();
    expect(estado.chamadasStt).toBe(1);
    expect(estado.entradas).toHaveLength(1);
    expect(estado.entradas[0]).toMatchObject({
      texto: "Áudio fictício transcrito",
      midiaTipo: "audio",
      messageId: "inbound-ficticio",
    });
    expect(estado.entradas[0].transcricaoMs).toEqual(expect.any(Number));
    expect(estado.eventos).toHaveLength(0);
    expect(estado.enviadas).toHaveLength(0);
  });

  it("se STT devolve null, não chama o orquestrador e pede reenvio", async () => {
    estado.transcricao = null;
    await receberAudio();
    expect(estado.chamadasStt).toBe(1);
    expect(estado.entradas).toHaveLength(0);
    expect(estado.enviadas).toHaveLength(1);
    expect(estado.enviadas[0].texto).toMatch(/mandar de novo, ou escrever em texto/i);
    expect(estado.eventos).toEqual([expect.objectContaining({
      kind: "ayla_audio_transcricao_falhou",
      payload: expect.objectContaining({
        inbound_message_id: "inbound-ficticio",
        transcricao_ms: expect.any(Number),
        fallback_aceito_provedor: true,
      }),
    })]);
    expect(JSON.stringify(estado.eventos)).not.toContain("+5511999990000");
    expect(JSON.stringify(estado.eventos)).not.toContain("https://exemplo.invalid/audio.ogg");
  });

  it("não declara aceite do fallback quando o provedor falha", async () => {
    estado.transcricao = null;
    estado.falharEnvio = true;
    await receberAudio();
    expect(estado.entradas).toHaveLength(0);
    expect(estado.eventos[0].payload).toMatchObject({ fallback_aceito_provedor: false });
  });
});

describe("PEND-240 · privacidade do webhook", () => {
  it.each([false, true])("não registra payload, telefone ou texto; erro=%s", async (falha) => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    estado.inbound.texto = "texto-ficticio-sigiloso";
    estado.inbound.midiaTipo = null;
    estado.inbound.midiaUrl = null;
    estado.falharProcessamento = falha;

    await receber({ phone: "5511999990000", text: "texto-ficticio-sigiloso", token: "segredo-ficticio" });

    expect(estado.entradas).toHaveLength(1);
    const saida = JSON.stringify([...log.mock.calls, ...erro.mock.calls]);
    expect(saida).not.toMatch(/5511999990000|texto-ficticio-sigiloso|segredo-ficticio/);
    expect(saida).toContain("tem_texto");
    if (falha) expect(saida).toContain("erro no processamento");
  });

  it("classifica LID sem imprimir campos arbitrários ou seus valores", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    estado.inbound.texto = "texto-ficticio-sigiloso";
    estado.inbound.midiaTipo = null;
    estado.inbound.midiaUrl = null;

    await receber({ phone: "lid-ficticio@lid", "segredo-ficticio": "valor-ficticio" });

    const saida = JSON.stringify([...log.mock.calls, ...erro.mock.calls]);
    expect(saida).toContain("IDENTIFICADOR NÃO-TELEFONE");
    expect(saida).not.toMatch(/lid-ficticio|segredo-ficticio|valor-ficticio/);
  });
});
