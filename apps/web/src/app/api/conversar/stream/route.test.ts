import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const estado = vi.hoisted(() => ({
  falharInsert: false,
  falharGeracao: false,
  mensagemGravada: null as Record<string, unknown> | null,
  billing: null as Record<string, unknown> | null,
  eventos: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "user-qa" } } }) },
    from: (tabela: string) => {
      if (tabela === "conversas") return {
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({
          data: { id: "conversa-qa", membro_atipico_id: "membro-qa" },
        }) }) }) }),
      };
      if (tabela === "mensagens_skill") return {
        select: () => ({ eq: () => ({ order: async () => ({ data: [
          { id: "user-message-qa", papel: "user", conteudo: "pedido fictício" },
        ] }) }) }),
        insert: (linha: Record<string, unknown>) => {
          estado.mensagemGravada = linha;
          return { select: () => ({ single: async () => estado.falharInsert
            ? { data: null, error: { code: "E_TEST" } }
            : { data: { id: "assistant-message-qa" }, error: null } }) };
        },
      };
      throw new Error(`tabela inesperada: ${tabela}`);
    },
  }),
  createServiceRoleClient: () => ({}),
}));
vi.mock("@/lib/auth/current-family", () => ({ resolveFamily: async () => ({ data: { id: "familia-qa" } }) }));
vi.mock("@/lib/auth/require-active-write", () => ({ requireActiveWrite: async () => {} }));
vi.mock("@/lib/ia/engine", () => ({ prepararRespostaStream: async () => ({
  system: [{ text: "sistema fictício" }], messages: [], roteadas: [], intencao: "outro", tema: null,
  ctx: { membroFoco: null, cuidador: null },
}) }));
vi.mock("@/lib/ia/provider", () => ({
  providerConversacionalParaFamilia: () => "openai",
  MODELO_CONVERSA: { openai: "modelo-qa" },
  gerarConversacional: async () => {
    if (estado.falharGeracao) throw new Error("falha sintética de geração");
    return {
      texto: "Ajuda fictícia.", provider: "openai", model: "modelo-qa",
      tokensIn: 10, tokensOut: 5, ms: 20, cacheRead: 0,
    };
  },
}));
vi.mock("@/lib/conducao/fronteiras", () => ({ fronteiraAtravessada: () => null }));
vi.mock("@/lib/billing/logar", () => ({ logarUsoApi: async (_db: unknown, chamada: Record<string, unknown>) => {
  estado.billing = chamada;
} }));
vi.mock("@/lib/log", () => ({ logEvent: async (evento: Record<string, unknown>) => {
  estado.eventos.push(evento);
} }));

const { POST } = await import("./route");

function pedido(): NextRequest {
  return new Request("http://localhost/api/conversar/stream", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversaId: "conversa-qa" }),
  }) as NextRequest;
}

describe("G0 · correlação e persistência da conversa Web", () => {
  beforeEach(() => {
    estado.falharInsert = false;
    estado.falharGeracao = false;
    estado.mensagemGravada = null;
    estado.billing = null;
    estado.eventos.length = 0;
  });

  it("liga a mensagem da pessoa à resposta gravada e à chamada de IA", async () => {
    const resposta = await POST(pedido());
    expect(resposta.status).toBe(200);
    expect(await resposta.text()).toBe("Ajuda fictícia.");
    expect((estado.mensagemGravada?.metadata as Record<string, unknown>).source_user_message_id)
      .toBe("user-message-qa");
    const meta = estado.billing?.meta as Record<string, unknown>;
    expect(meta.user_message_id).toBe("user-message-qa");
    expect(meta.assistant_message_id).toBe("assistant-message-qa");
    expect(meta.assistant_persistida).toBe(true);
    expect(meta.texto_pronto_em).toEqual(expect.any(Number));
    expect(meta.enfileirada_em).toEqual(expect.any(Number));
  });

  it("separa texto enfileirado de resposta não gravada", async () => {
    estado.falharInsert = true;
    const resposta = await POST(pedido());
    expect(await resposta.text()).toBe("Ajuda fictícia.");
    const meta = estado.billing?.meta as Record<string, unknown>;
    expect(meta.user_message_id).toBe("user-message-qa");
    expect(meta.assistant_message_id).toBeNull();
    expect(meta.assistant_persistida).toBe(false);
    expect(estado.eventos.some((e) => e.kind === "conversa_web_assistente_nao_persistiu")).toBe(true);
  });

  it("stream interrompido antes do texto não inventa resposta nem billing", async () => {
    estado.falharGeracao = true;
    const resposta = await POST(pedido());
    await expect(resposta.text()).rejects.toThrow();
    expect(estado.mensagemGravada).toBeNull();
    expect(estado.billing).toBeNull();
  });
});
