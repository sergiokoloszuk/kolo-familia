import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A MÃE QUE ESCREVE SEM TER CADASTRO.
 *
 * O que estes testes travam não é a redação da mensagem — é o comportamento
 * que custou dois dias de silêncio a uma pessoa: o contato tem de ficar
 * registrado SEMPRE, a resposta tem de sair UMA vez, e nada disso pode
 * derrubar o webhook.
 */

const enviarTexto = vi.fn<(p: unknown) => Promise<{ messageId: string; raw: unknown }>>(
  async () => ({ messageId: "m1", raw: {} }),
);
vi.mock("./whatsappSender", () => ({ enviarTexto: (p: unknown) => enviarTexto(p) }));

const logEvent = vi.fn<(e: unknown) => Promise<void>>(async () => {});
vi.mock("@/lib/log", () => ({ logEvent: (e: unknown) => logEvent(e) }));

const { atenderDesconhecido, textoParaDesconhecido } = await import("./desconhecido");

/** Supabase falso: `respondidos` simula eventos de resposta já registrados. */
function bancoFalso(respondidos: number, erro = false) {
  return {
    from: () => {
      const api: Record<string, unknown> = {
        select: () => api,
        eq: () => api,
        gte: () => api,
        contains: () => api,
        limit: async () =>
          erro
            ? Promise.reject(new Error("banco fora"))
            : { data: Array.from({ length: respondidos }, () => ({ id: "e" })), error: null },
      };
      return api;
    },
  } as unknown as SupabaseClient;
}

const INBOUND = { phoneE164: "+553484430420", texto: "tou tentando falar com vc sobre minha filha" };

beforeEach(() => {
  enviarTexto.mockClear();
  logEvent.mockClear();
  process.env.NEXT_PUBLIC_APP_URL = "https://app.exemplo.com";
  delete process.env.AYLA_RESPOSTA_DESCONHECIDO;
});
afterEach(() => {
  delete process.env.AYLA_RESPOSTA_DESCONHECIDO;
});

const eventos = () => logEvent.mock.calls.map((c) => c[0] as Record<string, unknown>);
const doKind = (k: string) => eventos().filter((e) => e.kind === k);
/** Primeiro evento do tipo — falha com mensagem clara se não houver nenhum. */
function primeiro(kind: string): Record<string, unknown> {
  const e = doKind(kind)[0];
  if (!e) throw new Error(`nenhum evento "${kind}" registrado`);
  return e;
}

describe("o contato nunca mais se perde", () => {
  it("registra o inbound mesmo quando responde", async () => {
    const r = await atenderDesconhecido(bancoFalso(0), INBOUND);
    expect(r).toEqual({ registrado: true, respondido: true });

    const rec = doKind("ayla_inbound_desconhecido");
    expect(rec).toHaveLength(1);
    // `warn` é o que faz o logger PERSISTIR em eventos_app; com `info` o
    // registro ficaria só no stdout — ou seja, perdido de novo.
    expect(primeiro("ayla_inbound_desconhecido").severity).toBe("warn");
  });

  it("registra mesmo com a resposta desligada", async () => {
    process.env.AYLA_RESPOSTA_DESCONHECIDO = "0";
    const r = await atenderDesconhecido(bancoFalso(0), INBOUND);
    expect(r).toMatchObject({ registrado: true, respondido: false, motivo: "flag_desligada" });
    expect(doKind("ayla_inbound_desconhecido")).toHaveLength(1);
    expect(enviarTexto).not.toHaveBeenCalled();
  });

  it("registra mesmo quando já respondeu antes", async () => {
    await atenderDesconhecido(bancoFalso(1), INBOUND);
    expect(doKind("ayla_inbound_desconhecido")).toHaveLength(1);
  });

  it("guarda só um preview, nunca a mensagem inteira", async () => {
    const longa = "a".repeat(300);
    await atenderDesconhecido(bancoFalso(0), { phoneE164: "+553484430420", texto: longa });
    const p = primeiro("ayla_inbound_desconhecido").payload as Record<string, string>;
    expect(p.preview.length).toBeLessThanOrEqual(60);
    expect(p.chave).toBe("3484430420");
  });
});

describe("uma resposta, não duas", () => {
  it("responde quando é a primeira vez", async () => {
    await atenderDesconhecido(bancoFalso(0), INBOUND);
    expect(enviarTexto).toHaveBeenCalledTimes(1);
    expect(doKind("ayla_desconhecido_respondido")).toHaveLength(1);
  });

  it("NÃO responde de novo dentro da janela", async () => {
    const r = await atenderDesconhecido(bancoFalso(1), INBOUND);
    expect(r).toMatchObject({ respondido: false, motivo: "ja_respondido" });
    expect(enviarTexto).not.toHaveBeenCalled();
  });

  it("a dedup é pela chave normalizada — com ou sem o 9º dígito é a mesma pessoa", async () => {
    await atenderDesconhecido(bancoFalso(0), { phoneE164: "+5534984430420", texto: "oi" });
    const chaveCom9 = (primeiro("ayla_desconhecido_respondido").payload as Record<string, string>).chave;
    logEvent.mockClear();
    await atenderDesconhecido(bancoFalso(0), { phoneE164: "+553484430420", texto: "oi" });
    const chaveSem9 = (primeiro("ayla_desconhecido_respondido").payload as Record<string, string>).chave;
    expect(chaveCom9).toBe(chaveSem9);
  });

  it("banco fora do ar NÃO manda mensagem — insistir seria pior que perder um envio", async () => {
    const r = await atenderDesconhecido(bancoFalso(0, true), INBOUND);
    expect(r).toMatchObject({ respondido: false, motivo: "ja_respondido" });
    expect(enviarTexto).not.toHaveBeenCalled();
    // Mas o contato continua registrado.
    expect(doKind("ayla_inbound_desconhecido")).toHaveLength(1);
  });
});

describe("nunca derruba o webhook", () => {
  it("falha de envio vira motivo, não exceção", async () => {
    enviarTexto.mockRejectedValueOnce(new Error("z-api fora"));
    const r = await atenderDesconhecido(bancoFalso(0), INBOUND);
    expect(r).toMatchObject({ registrado: true, respondido: false, motivo: "envio_falhou" });
    expect(doKind("ayla_desconhecido_envio_falhou")).toHaveLength(1);
  });

  it("sem NEXT_PUBLIC_APP_URL não manda convite sem porta", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    const r = await atenderDesconhecido(bancoFalso(0), INBOUND);
    expect(r).toMatchObject({ respondido: false, motivo: "sem_link" });
    expect(enviarTexto).not.toHaveBeenCalled();
    expect(primeiro("ayla_desconhecido_sem_link").severity).toBe("error");
  });
});

describe("a mensagem", () => {
  const texto = textoParaDesconhecido("https://app.exemplo.com/signup");

  it("explica o silêncio e leva o link", () => {
    expect(texto).toContain("não encontrei um cadastro");
    expect(texto).toContain("https://app.exemplo.com/signup");
  });

  it("NÃO faz pergunta — responder aqui cairia no mesmo silêncio", () => {
    // Enquanto ela não se cadastrar, uma resposta dela não é lida por ninguém.
    // Pedir que ela conte algo seria abrir uma porta que não existe.
    expect(texto).not.toContain("?");
  });

  it("NÃO promete número de dias de teste", () => {
    // O ledger hasheia o telefone sem normalizar; "já usou o teste?" não é
    // respondível daqui com confiança. Prometer e o cadastro negar é pior.
    expect(texto).not.toMatch(/\d+\s*dias/i);
    expect(texto.toLowerCase()).not.toContain("grátis");
  });

  it("cabe no WhatsApp", () => {
    expect(texto.split(/\s+/).length).toBeLessThan(70);
  });
});
