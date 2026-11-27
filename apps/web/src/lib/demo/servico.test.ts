import { describe, it, expect, vi, beforeEach } from "vitest";
import { BancoMemoria } from "@/lib/ayla/__harness/banco-memoria";
import { esquecerCacheDeDocumentos } from "@/lib/ayla/documentos";
import type { EntradaConversacional } from "@/lib/ia/provider";

/**
 * DEMONSTRAÇÃO DA AYLA (PEND-259) — o fluxo inteiro, sem rede.
 *
 * Banco em memória, Z-API e modelo falsos. O que se prende:
 *   · código só sai para dados válidos, com cooldown e teto de reenvios;
 *   · o código não aparece em retorno, log nem banco (só o hash);
 *   · confirmação abre 20 minutos; número confirmado não faz outra;
 *   · conversa usa Core + condução do Admin; sem condução ativa não abre;
 *   · teto de mensagens e de tempo;
 *   · resumo sai UMA vez, para o número confirmado, com o link de cadastro;
 *   · a simulação do Admin não grava nada e não envia nada.
 */

const logs: Array<Record<string, unknown>> = [];
vi.mock("@/lib/log", () => ({
  logEvent: async (e: Record<string, unknown>) => {
    logs.push(e);
  },
  logServerError: async () => {},
}));

const {
  pedirCodigo,
  confirmarCodigo,
  conversar,
  encerrar,
  simularNoAdmin,
} = await import("./servico");
const { MAX_TURNOS, DURACAO_MIN, hash, whatsappParaE164, validarDados, estadoDaSessao } = await import("./regras");

type Envio = { phoneE164: string; texto: string };

let db: BancoMemoria;
let envios: Envio[];
let prompts: EntradaConversacional[];
let agora: number;

function deps(extra: Partial<{ falharEnvio: boolean; falharModelo: boolean }> = {}) {
  return {
    admin: db.cliente(),
    enviarWhatsApp: async (p: Envio) => {
      if (extra.falharEnvio) throw new Error("zapi fora");
      envios.push(p);
    },
    gerar: async (e: EntradaConversacional) => {
      prompts.push(e);
      if (extra.falharModelo) throw new Error("modelo fora");
      const resumo = e.system.includes("RESUMO");
      return {
        texto: resumo ? "• Vocês falaram da hora de dormir." : `Resposta ${prompts.length}`,
        provider: "openai" as const,
        model: "m",
        tokensIn: 1,
        tokensOut: 1,
        cacheRead: 0,
        cacheWrite: 0,
        ms: 1,
        motivoDeParada: "stop",
      };
    },
    agora: () => agora,
  };
}

const PESSOA = { nome: "Marina Souza", email: "marina@exemplo.com", whatsapp: "(11) 98888-7777", aceite: true };

function codigoEnviado(): string {
  const ultimo = envios[envios.length - 1]?.texto ?? "";
  return ultimo.match(/\b(\d{6})\b/)?.[1] ?? "";
}

async function demoConfirmada() {
  const p = await pedirCodigo(deps(), PESSOA);
  if (!p.ok) throw new Error(`pedido falhou: ${JSON.stringify(p)}`);
  const c = await confirmarCodigo(deps(), { demoId: p.demoId, codigo: codigoEnviado() });
  if (!c.ok) throw new Error(`confirmação falhou: ${JSON.stringify(c)}`);
  return { demoId: p.demoId, token: c.token };
}

beforeEach(() => {
  db = new BancoMemoria();
  envios = [];
  prompts = [];
  logs.length = 0;
  agora = Date.now();
  esquecerCacheDeDocumentos();
  db.semear("ayla_documentos", [
    { chave: "core", versao: 9, status: "ativo", conteudo: "CORE-DA-AYLA" },
    { chave: "demonstracao", versao: 2, status: "ativo", conteudo: "CONDUCAO-DA-KARINA" },
  ]);
});

describe("regras puras", () => {
  it("WhatsApp: celular brasileiro com ou sem país e máscara; fixo e lixo não", () => {
    expect(whatsappParaE164("(11) 98888-7777")).toBe("+5511988887777");
    expect(whatsappParaE164("+55 11 98888-7777")).toBe("+5511988887777");
    expect(whatsappParaE164("11 3333-4444")).toBeNull();
    expect(whatsappParaE164("123")).toBeNull();
  });

  it("os quatro dados são obrigatórios, inclusive o aceite", () => {
    expect(validarDados({ ...PESSOA, nome: "a" })).toEqual({ ok: false, campo: "nome" });
    expect(validarDados({ ...PESSOA, email: "sem-arroba" })).toEqual({ ok: false, campo: "email" });
    expect(validarDados({ ...PESSOA, whatsapp: "11 3333-4444" })).toEqual({ ok: false, campo: "whatsapp" });
    expect(validarDados({ ...PESSOA, aceite: false })).toEqual({ ok: false, campo: "aceite" });
    expect(validarDados(PESSOA).ok).toBe(true);
  });

  it("estado da sessão: tempo e teto de mensagens", () => {
    const fim = new Date(agora + 60_000).toISOString();
    expect(estadoDaSessao({ encerrada_em: null, expira_em: fim, turnos: 0 }, agora)).toBe("ativa");
    expect(estadoDaSessao({ encerrada_em: null, expira_em: fim, turnos: MAX_TURNOS }, agora)).toBe("turnos_esgotados");
    expect(estadoDaSessao({ encerrada_em: null, expira_em: fim, turnos: 0 }, agora + 61_000)).toBe("tempo_esgotado");
    expect(estadoDaSessao({ encerrada_em: fim, expira_em: fim, turnos: 0 }, agora)).toBe("encerrada");
  });
});

describe("1. pedir o código", () => {
  it("dados válidos: código vai para o WhatsApp informado e só o hash fica no banco", async () => {
    const r = await pedirCodigo(deps(), PESSOA);
    expect(r.ok).toBe(true);
    expect(envios).toHaveLength(1);
    expect(envios[0].phoneE164).toBe("+5511988887777");
    const codigo = codigoEnviado();
    expect(codigo).toMatch(/^\d{6}$/);

    const [linha] = db.linhas("demonstracoes_ayla");
    expect(linha.codigo_hash).toBe(hash(codigo));
    expect(JSON.stringify(linha)).not.toContain(codigo);
    expect(JSON.stringify(r)).not.toContain(codigo);
    expect(JSON.stringify(logs)).not.toContain(codigo);
    expect(JSON.stringify(logs)).not.toContain("98888");
  });

  it("dados inválidos não gravam nem enviam", async () => {
    const r = await pedirCodigo(deps(), { ...PESSOA, aceite: false });
    expect(r).toEqual({ ok: false, motivo: "dados_invalidos", campo: "aceite" });
    expect(envios).toHaveLength(0);
    expect(db.linhas("demonstracoes_ayla")).toHaveLength(0);
  });

  it("reenvio: cooldown de 60 s, depois atualiza a MESMA linha; teto de 3 reenvios", async () => {
    await pedirCodigo(deps(), PESSOA);
    const cedo = await pedirCodigo(deps(), PESSOA);
    expect(cedo.ok).toBe(false);
    expect((cedo as { motivo: string }).motivo).toBe("cooldown");

    for (let i = 0; i < 3; i++) {
      agora += 61_000;
      expect((await pedirCodigo(deps(), PESSOA)).ok).toBe(true);
    }
    agora += 61_000;
    expect(await pedirCodigo(deps(), PESSOA)).toEqual({ ok: false, motivo: "max_reenvios" });
    expect(db.linhas("demonstracoes_ayla")).toHaveLength(1);
  });

  it("Z-API fora: avisa envio_falhou (não finge que mandou)", async () => {
    const r = await pedirCodigo(deps({ falharEnvio: true }), PESSOA);
    expect(r).toEqual({ ok: false, motivo: "envio_falhou" });
    expect(logs.some((l) => l.kind === "demo_codigo_envio_falhou" && l.severity === "error")).toBe(true);
  });
});

describe("2. confirmar e o 1 por número", () => {
  it("código certo abre 20 minutos e devolve o token (só o hash fica no banco)", async () => {
    const { token } = await demoConfirmada();
    const [linha] = db.linhas("demonstracoes_ayla");
    expect(linha.verificado_em).toBeTruthy();
    expect(linha.codigo_hash).toBeNull();
    expect(linha.token_hash).toBe(hash(token));
    expect(Date.parse(linha.expira_em as string) - agora).toBe(DURACAO_MIN * 60 * 1000);
  });

  it("código errado conta tentativa; na 5ª, bloqueia", async () => {
    const p = await pedirCodigo(deps(), PESSOA);
    const demoId = (p as { demoId: string }).demoId;
    const certo = codigoEnviado();
    const errado = certo === "000000" ? "111111" : "000000";
    const motivos: string[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await confirmarCodigo(deps(), { demoId, codigo: errado });
      motivos.push((r as { motivo: string }).motivo);
    }
    expect(motivos).toEqual(["codigo_errado", "codigo_errado", "codigo_errado", "codigo_errado", "max_tentativas"]);
    expect(await confirmarCodigo(deps(), { demoId, codigo: certo })).toEqual({ ok: false, motivo: "max_tentativas" });
  });

  it("código expirado não confirma", async () => {
    const p = await pedirCodigo(deps(), PESSOA);
    agora += 11 * 60 * 1000;
    const r = await confirmarCodigo(deps(), { demoId: (p as { demoId: string }).demoId, codigo: codigoEnviado() });
    expect(r).toEqual({ ok: false, motivo: "expirado" });
  });

  it("MORDE: número que já fez a demonstração não recebe outro código", async () => {
    await demoConfirmada();
    envios = [];
    agora += 24 * 60 * 60 * 1000;
    // Mesmo número escrito de outro jeito (com país, sem máscara).
    const r = await pedirCodigo(deps(), { ...PESSOA, whatsapp: "5511988887777", email: "outro@exemplo.com" });
    expect(r).toEqual({ ok: false, motivo: "ja_usou" });
    expect(envios).toHaveLength(0);
  });

  it("corrida: o índice único do banco recusa a segunda confirmação → ja_usou", async () => {
    const p = await pedirCodigo(deps(), PESSOA);
    const cliente = db.cliente() as unknown as { from: (t: string) => unknown };
    const comIndice = {
      from: (t: string) => {
        const q = cliente.from(t) as Record<string, unknown> & { update: (l: unknown) => unknown };
        if (t !== "demonstracoes_ayla") return q;
        const updateOriginal = q.update.bind(q);
        q.update = (linha: unknown) => {
          if ((linha as Record<string, unknown>).verificado_em) {
            const falha = { eq: () => falha, is: () => falha, select: async () => ({ data: null, error: { code: "23505", message: "duplicate key" } }) };
            return falha;
          }
          return updateOriginal(linha);
        };
        return q;
      },
    };
    const r = await confirmarCodigo({ ...deps(), admin: comIndice as never }, {
      demoId: (p as { demoId: string }).demoId,
      codigo: codigoEnviado(),
    });
    expect(r).toEqual({ ok: false, motivo: "ja_usou" });
  });
});

describe("3. conversar", () => {
  it("a resposta vem do Core + condução do Admin + regras fixas, e a conversa é guardada", async () => {
    const { token } = await demoConfirmada();
    const r = await conversar(deps(), { token, texto: "Meu filho não dorme" });
    expect(r.ok).toBe(true);
    const system = prompts[0].system;
    expect(system.indexOf("CORE-DA-AYLA")).toBeLessThan(system.indexOf("CONDUCAO-DA-KARINA"));
    expect(system).toMatch(/<demonstracao_regras>/);
    expect(system).toMatch(/Não ofereça teste grátis/);
    expect(db.linhas("demonstracao_mensagens").map((m) => m.papel)).toEqual(["pessoa", "ayla"]);
    expect(db.linhas("demonstracoes_ayla")[0].documento_versao).toBe(2);
  });

  it("o histórico entra nos turnos seguintes", async () => {
    const { token } = await demoConfirmada();
    await conversar(deps(), { token, texto: "primeira" });
    await conversar(deps(), { token, texto: "segunda" });
    const msgs = prompts[1].messages.map((m) => m.content);
    expect(msgs).toEqual(["primeira", "Resposta 1", "segunda"]);
  });

  it("MORDE: sem documento `demonstracao` ativo, a demonstração não abre", async () => {
    const { token } = await demoConfirmada();
    db.tabelas.set("ayla_documentos", db.linhas("ayla_documentos").filter((d) => d.chave !== "demonstracao"));
    esquecerCacheDeDocumentos();
    expect(await conversar(deps(), { token, texto: "oi" })).toEqual({ ok: false, motivo: "indisponivel" });
    expect(prompts).toHaveLength(0);
  });

  it("token inválido, mensagem vazia ou longa demais", async () => {
    const { token } = await demoConfirmada();
    expect(await conversar(deps(), { token: "x".repeat(43), texto: "oi" })).toEqual({ ok: false, motivo: "token_invalido" });
    expect(await conversar(deps(), { token, texto: "   " })).toEqual({ ok: false, motivo: "mensagem_invalida" });
    expect(await conversar(deps(), { token, texto: "a".repeat(1501) })).toEqual({ ok: false, motivo: "mensagem_invalida" });
  });

  it("depois de 20 minutos, não responde mais (e não gasta modelo)", async () => {
    const { token } = await demoConfirmada();
    agora += DURACAO_MIN * 60 * 1000 + 1;
    expect(await conversar(deps(), { token, texto: "ainda?" })).toEqual({ ok: false, motivo: "tempo_esgotado" });
    expect(prompts).toHaveLength(0);
  });

  it("teto de mensagens", async () => {
    const { token } = await demoConfirmada();
    db.linhas("demonstracoes_ayla")[0].turnos = MAX_TURNOS;
    expect(await conversar(deps(), { token, texto: "mais uma" })).toEqual({ ok: false, motivo: "turnos_esgotados" });
  });
});

describe("4. encerrar e o resumo", () => {
  it("resumo vai UMA vez para o número confirmado, com o link de cadastro e sem teste grátis", async () => {
    const { token } = await demoConfirmada();
    await conversar(deps(), { token, texto: "Hora de dormir é um caos" });
    envios = [];

    const link = "https://app.exemplo.com/signup?de=demonstracao";
    const r1 = await encerrar(deps(), { token, linkCadastro: link });
    const r2 = await encerrar(deps(), { token, linkCadastro: link });
    expect(r1).toEqual({ ok: true, resumoEnviado: true, linkCadastro: link });
    expect(r2.ok).toBe(true);
    expect(envios).toHaveLength(1);
    expect(envios[0].phoneE164).toBe("+5511988887777");
    expect(envios[0].texto).toContain("Oi, Marina!");
    expect(envios[0].texto).toContain(link);
    expect(envios[0].texto).not.toMatch(/grátis|gratuito/i);
    expect(db.linhas("demonstracoes_ayla")[0].resumo_enviado_em).toBeTruthy();
    // Encerrada: não conversa mais.
    expect(await conversar(deps(), { token, texto: "e agora?" })).toEqual({ ok: false, motivo: "encerrada" });
  });

  it("sem nenhuma mensagem da pessoa, não manda resumo", async () => {
    const { token } = await demoConfirmada();
    envios = [];
    const r = await encerrar(deps(), { token, linkCadastro: "https://x" });
    expect(r).toEqual({ ok: true, resumoEnviado: false, linkCadastro: "https://x" });
    expect(envios).toHaveLength(0);
  });

  it("envio falhou: devolve a reserva para tentar de novo", async () => {
    const { token } = await demoConfirmada();
    await conversar(deps(), { token, texto: "oi" });
    expect(await encerrar(deps({ falharEnvio: true }), { token, linkCadastro: "https://x" })).toEqual({
      ok: false,
      motivo: "envio_falhou",
    });
    expect(db.linhas("demonstracoes_ayla")[0].resumo_reservado_em).toBeNull();
    envios = [];
    expect((await encerrar(deps(), { token, linkCadastro: "https://x" })).ok).toBe(true);
    expect(envios).toHaveLength(1);
  });
});

describe("Admin: simular à vontade", () => {
  it("usa o rascunho quando houver, não grava nada e não envia nada", async () => {
    db.semear("ayla_documentos", [{ chave: "demonstracao", versao: 3, status: "rascunho", conteudo: "RASCUNHO-NOVO" }]);
    const r = await simularNoAdmin(deps(), { historico: [], texto: "oi" });
    expect(r).toMatchObject({ ok: true, origem: "rascunho", versao: 3 });
    expect(prompts[0].system).toContain("RASCUNHO-NOVO");
    expect(db.linhas("demonstracoes_ayla")).toHaveLength(0);
    expect(db.linhas("demonstracao_mensagens")).toHaveLength(0);
    expect(envios).toHaveLength(0);
  });

  it("sem rascunho, usa a versão ativa; sem nenhuma, avisa", async () => {
    const r = await simularNoAdmin(deps(), { historico: [], texto: "oi", usarRascunho: false });
    expect(r).toMatchObject({ ok: true, origem: "ativo", versao: 2 });
    db.tabelas.set("ayla_documentos", db.linhas("ayla_documentos").filter((d) => d.chave !== "demonstracao"));
    esquecerCacheDeDocumentos();
    expect(await simularNoAdmin(deps(), { historico: [], texto: "oi" })).toEqual({ ok: false, motivo: "sem_documento" });
  });
});
