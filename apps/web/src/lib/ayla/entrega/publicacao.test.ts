import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A fronteira. O que se prova aqui é que nada sai sem posse, que retry não
 * repete parte confirmada, e que uma resposta obsoleta some em silêncio — sem
 * fallback, porque fallback é para resposta barrada, não para corrida perdida.
 */

const enviarTexto = vi.fn<(p: { texto: string }) => Promise<{ messageId: string }>>(
  async () => ({ messageId: "m1" }),
);
const enviarDocumento = vi.fn<(p: { url: string }) => Promise<{ messageId: string }>>(
  async () => ({ messageId: "d1" }),
);
const logEvent = vi.fn(async () => {});

vi.mock("../whatsappSender", () => ({
  enviarTexto: (p: { texto: string }) => enviarTexto(p),
  enviarDocumento: (p: { url: string }) => enviarDocumento(p),
}));
vi.mock("@/lib/log", () => ({ logEvent: () => logEvent() }));

const confirmarPosse = vi.fn(async () => ({ ok: true }) as { ok: boolean; motivo?: string });
vi.mock("./posse", () => ({
  confirmarPosse: () => confirmarPosse(),
  TETO_EXECUCAO_MS: 240_000,
}));

const { publicar, quebrarEmBolhas } = await import("./publicacao");
const { comoTextoParaFamilia } = await import("./tipos");

/** Supabase falso: insert nunca falha, select devolve vazio. */
const supabase = {
  from: () => ({
    insert: async () => ({ error: null }),
    select: () => ({ eq: () => ({ limit: async () => ({ data: [] }) }) }),
  }),
} as unknown as SupabaseClient;

const base = {
  conversationId: "fam-1",
  sourceMessageId: "msg-1",
  executionId: "exec-1",
  phoneE164: "+5511999999999",
  responseType: "resposta" as const,
};

beforeEach(() => {
  enviarTexto.mockClear();
  enviarDocumento.mockClear();
  enviarTexto.mockImplementation(async () => ({ messageId: "m1" }));
  confirmarPosse.mockImplementation(async () => ({ ok: true }));
});
afterEach(() => vi.clearAllMocks());

const posse = { familyId: "fam-1", sourceMessageId: "msg-1", executionId: "exec-1", iniciadaEm: Date.now() };

describe("bolhas", () => {
  it("quebra por linha em branco, como a conversa sempre fez", () => {
    expect(quebrarEmBolhas("um\n\ndois\n\ntrês")).toEqual(["um", "dois", "três"]);
    expect(quebrarEmBolhas("só uma")).toEqual(["só uma"]);
  });
});

describe("posse", () => {
  it("sem posse, NADA sai — e nenhum fallback é inventado", async () => {
    confirmarPosse.mockImplementation(async () => ({ ok: false, motivo: "inbound_mais_recente" }));
    const r = await publicar(
      supabase,
      { ...base, text: comoTextoParaFamilia("oi") },
      { posse },
    );
    expect(r.status).toBe("descartado");
    expect(enviarTexto).not.toHaveBeenCalled();
    expect(enviarDocumento).not.toHaveBeenCalled();
  });

  it("execução expirada não publica", async () => {
    confirmarPosse.mockImplementation(async () => ({ ok: false, motivo: "execucao_expirada" }));
    const r = await publicar(supabase, { ...base, text: comoTextoParaFamilia("oi") }, { posse });
    expect(r).toEqual({ status: "descartado", motivo: "execucao_expirada" });
  });

  it("já publicado para a mesma inbound não publica de novo", async () => {
    confirmarPosse.mockImplementation(async () => ({ ok: false, motivo: "ja_publicado" }));
    const r = await publicar(supabase, { ...base, text: comoTextoParaFamilia("oi") }, { posse });
    expect(r.status).toBe("descartado");
    expect(enviarTexto).not.toHaveBeenCalled();
  });

  it("sem contexto de posse (operacional) publica — é o balão de espera", async () => {
    const r = await publicar(supabase, { ...base, text: comoTextoParaFamilia("um segundo") });
    expect(r.status).toBe("publicado");
    expect(confirmarPosse).not.toHaveBeenCalled();
  });
});

describe("entrega única", () => {
  it("texto vem ANTES do anexo — o anexo só faz sentido depois da frase", async () => {
    const ordem: string[] = [];
    enviarTexto.mockImplementation(async () => {
      ordem.push("texto");
      return { messageId: "m" };
    });
    enviarDocumento.mockImplementation(async () => {
      ordem.push("doc");
      return { messageId: "d" };
    });

    await publicar(
      supabase,
      {
        ...base,
        text: comoTextoParaFamilia("Montei o plano 🌿"),
        attachments: [{ tipo: "documento", url: "http://x/p.pdf", nomeArquivo: "plano.pdf" }],
        responseType: "entrega",
      },
      { posse },
    );
    expect(ordem).toEqual(["texto", "doc"]);
  });

  it("anexo sem texto é válido quando é só o anexo", async () => {
    const r = await publicar(
      supabase,
      {
        ...base,
        attachments: [{ tipo: "documento", url: "http://x/p.pdf", nomeArquivo: "p.pdf" }],
        responseType: "entrega",
      },
      { posse },
    );
    expect(r.status).toBe("publicado");
    expect(enviarDocumento).toHaveBeenCalledTimes(1);
  });

  it("sem texto e sem anexo não publica nada", async () => {
    const r = await publicar(supabase, { ...base }, { posse });
    expect(r).toEqual({ status: "descartado", motivo: "sem_conteudo" });
  });
});

describe("publicação parcial", () => {
  it("falha no meio devolve parcial com o que foi confirmado", async () => {
    let n = 0;
    enviarTexto.mockImplementation(async () => {
      n += 1;
      if (n === 2) throw new Error("z-api fora");
      return { messageId: "m" };
    });

    const r = await publicar(
      supabase,
      { ...base, text: comoTextoParaFamilia("um\n\ndois\n\ntrês") },
      { posse },
    );
    expect(r.status).toBe("parcial");
    if (r.status === "parcial") {
      expect(r.partesConfirmadas).toBe(1);
      expect(r.partesTotais).toBe(3);
    }
  });

  it("retry NÃO repete a parte já confirmada", async () => {
    const enviados: string[] = [];
    enviarTexto.mockImplementation(async (p) => {
      enviados.push(p.texto);
      return { messageId: "m" };
    });

    await publicar(
      supabase,
      { ...base, text: comoTextoParaFamilia("um\n\ndois\n\ntrês") },
      { posse, partesJaConfirmadas: 1 },
    );
    expect(enviados).toEqual(["dois", "três"]);
  });

  it("falha logo na primeira parte é falha, não parcial", async () => {
    enviarTexto.mockImplementation(async () => {
      throw new Error("caiu");
    });
    const r = await publicar(supabase, { ...base, text: comoTextoParaFamilia("um") }, { posse });
    expect(r.status).toBe("falha");
  });
});
