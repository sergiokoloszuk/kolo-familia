import { beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({
  tarefas: [] as Array<() => Promise<void>>,
  entradas: [] as Array<Record<string, unknown>>,
  enviadas: [] as Array<Record<string, unknown>>,
  transcricao: "" as string | null,
  chamadasStt: 0,
  eventos: [] as Array<Record<string, unknown>>,
  falharEnvio: false,
}));

vi.mock("@/lib/log", () => ({
  logEvent: async (evento: Record<string, unknown>) => { estado.eventos.push(evento); },
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => Response.json(body, init),
  },
  after: (tarefa: () => Promise<void>) => { estado.tarefas.push(tarefa); },
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => ({ origem: "banco-ficticio" }),
}));

vi.mock("@/lib/ayla/whatsappSender", () => ({
  parseZapiWebhook: () => ({
    phoneE164: "+5511999990000",
    texto: "",
    messageId: "inbound-ficticio",
    recebidaEm: new Date("2026-10-11T10:00:00.000Z"),
    midiaTipo: "audio",
    midiaUrl: "https://exemplo.invalid/audio.ogg",
  }),
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

async function receberAudio() {
  const resposta = await POST(new Request("http://localhost/api/ayla/webhook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone: "5511999990000", audio: { audioUrl: "https://exemplo.invalid/audio.ogg" } }),
  }) as never);
  expect(resposta.status).toBe(200);
  expect(await resposta.json()).toEqual({ ok: true, queued: true });
  expect(estado.tarefas).toHaveLength(1);
  await estado.tarefas[0]();
}

beforeEach(() => {
  estado.tarefas.length = 0;
  estado.entradas.length = 0;
  estado.enviadas.length = 0;
  estado.chamadasStt = 0;
  estado.eventos.length = 0;
  estado.falharEnvio = false;
  estado.transcricao = "Áudio fictício transcrito";
});

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
