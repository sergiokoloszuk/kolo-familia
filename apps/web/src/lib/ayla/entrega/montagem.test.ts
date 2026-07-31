import { describe, expect, it } from "vitest";
import { montarEntrega } from "./montagem";
import { erroInterno } from "./tipos";
import { TEXTO_FALLBACK } from "./validacao";

const base = {
  conversationId: "fam-1",
  sourceMessageId: "msg-1",
  executionId: "exec-1",
  phoneE164: "+5511999999999",
};

const pdf = { tipo: "documento" as const, url: "http://x/p.pdf", nomeArquivo: "plano.pdf" };

describe("entrega coerente", () => {
  it("texto e anexo viram UMA entrega", () => {
    const { resposta } = montarEntrega({
      ...base,
      textoDoModelo: "Montei o plano pra vocês 🌿",
      ferramentas: [{ tipo: "plano", anexos: [pdf] }],
    });
    expect(resposta?.text).toContain("Montei o plano");
    expect(resposta?.attachments).toHaveLength(1);
    expect(resposta?.responseType).toBe("entrega");
  });

  it("texto de ferramenta entra na mesma entrega, não numa mensagem separada", () => {
    const { resposta } = montarEntrega({
      ...base,
      textoDoModelo: "Que bom que ele dormiu melhor.",
      ferramentas: [{ tipo: "ponte", textoSugerido: "Abre aqui: https://app/x" }],
    });
    expect(resposta?.text).toContain("dormiu melhor");
    expect(resposta?.text).toContain("https://app/x");
  });

  it("anexo órfão é bloqueado — PDF do nada não sai", () => {
    const r = montarEntrega({
      ...base,
      textoDoModelo: "",
      ferramentas: [{ tipo: "plano", anexos: [pdf] }],
    });
    expect(r.resposta).toBeNull();
    expect(r.ajustes).toContain("anexo_orfao_bloqueado");
  });

  it("promessa de anexo sem anexo fica registrada", () => {
    const r = montarEntrega({ ...base, textoDoModelo: "Te mandei o PDF com tudo." });
    expect(r.ajustes).toContain("promessa_de_anexo_sem_anexo");
    // O texto ainda sai: reescrever seria a Montagem opinando sobre voz.
    expect(r.resposta?.text).toContain("PDF");
  });
});

describe("erro interno de ferramenta", () => {
  it("nunca vira texto e nunca vira anexo", () => {
    const r = montarEntrega({
      ...base,
      textoDoModelo: "Tô aqui com você.",
      ferramentas: [
        { tipo: "plano", erroInterno: erroInterno("timeout", "gerador não respondeu"), anexos: [pdf] },
      ],
    });
    expect(r.resposta?.text).not.toContain("timeout");
    expect(r.resposta?.text).not.toContain("gerador");
    expect(r.resposta?.attachments).toBeUndefined();
    expect(r.ajustes.some((a) => a.startsWith("ferramenta_plano_falhou"))).toBe(true);
  });
});

describe("bloqueio e fallback", () => {
  it("saída vazada vira fallback neutro em enforce", () => {
    const r = montarEntrega({
      ...base,
      textoDoModelo: "Seguindo a orientação da Karina, vou responder assim.",
      modoValidacao: "enforce",
    });
    expect(r.bloqueada).toBe(true);
    expect(r.resposta?.text).toBe(TEXTO_FALLBACK);
    expect(r.resposta?.text).not.toContain("Karina");
  });

  it("com fallback, o anexo cai junto — senão vira órfão", () => {
    const r = montarEntrega({
      ...base,
      textoDoModelo: "Assistant: aqui está o plano.",
      ferramentas: [{ tipo: "plano", anexos: [pdf] }],
      modoValidacao: "enforce",
    });
    expect(r.bloqueada).toBe(true);
    expect(r.resposta?.attachments).toBeUndefined();
    expect(r.ajustes).toContain("anexos_descartados_com_fallback");
  });

  it("em observe, a mesma saída passa (mas fica registrada)", () => {
    const r = montarEntrega({
      ...base,
      textoDoModelo: "Vou escolher a opção 2.",
      modoValidacao: "observe",
    });
    expect(r.bloqueada).toBe(false);
    expect(r.achados.length).toBeGreaterThan(0);
  });
});

describe("nada a dizer", () => {
  it("sem texto e sem anexo não produz resposta", () => {
    expect(montarEntrega({ ...base, textoDoModelo: "" }).resposta).toBeNull();
  });
});

describe("conversa normal não sofre ajuste", () => {
  it("resposta comum sai limpa", () => {
    const r = montarEntrega({
      ...base,
      textoDoModelo: "Que bom que ele dormiu melhor 🌿 Como foi a noite?",
      modoValidacao: "enforce",
    });
    expect(r.bloqueada).toBe(false);
    expect(r.ajustes).toEqual([]);
    expect(r.resposta?.responseType).toBe("resposta");
  });
});
