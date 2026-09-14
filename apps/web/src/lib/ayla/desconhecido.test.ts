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

const { atenderDesconhecido, textoParaDesconhecido, pareceCelularPessoal, ehTelefoneDeVerdade } =
  await import("./desconhecido");

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

describe("uma resposta, para sempre", () => {
  it("1. primeira mensagem de número desconhecido → recebe o convite", async () => {
    await atenderDesconhecido(bancoFalso(0), INBOUND);
    expect(enviarTexto).toHaveBeenCalledTimes(1);
    expect(doKind("ayla_desconhecido_respondido")).toHaveLength(1);
  });

  it("2-4. quem já recebeu NUNCA recebe de novo — logo depois, no dia seguinte, meses depois", async () => {
    // Regra de produto (Sérgio, 31/07/2026): uma mensagem por número, para
    // sempre. Quem não se cadastrou entra em silêncio definitivo — o convite é
    // oferta, não cobrança, e insistir seria perseguir quem já respondeu com o
    // próprio silêncio.
    //
    // O duplo devolve "já existe um evento de convite" independentemente de
    // QUANDO ele aconteceu — que é exatamente o ponto: não há recorte de tempo.
    const r = await atenderDesconhecido(bancoFalso(1), INBOUND);
    expect(r).toMatchObject({ respondido: false, motivo: "ja_respondido" });
    expect(enviarTexto).not.toHaveBeenCalled();
  });

  it("MORDE: a consulta de dedup NÃO recorta por data", async () => {
    // ⚠️ ESTE TESTE EXISTE PORQUE A REGRA JÁ SE PERDEU UMA VEZ. Em 17/08 o
    // módulo foi recuperado do commit anterior à decisão, com janela de 7 dias,
    // e a versão superada chegou a produção. Se alguém puser um
    // `gte("created_at", ...)` naquela consulta, o convite volta a se repetir —
    // e a diferença não aparece em lugar nenhum até uma mãe receber duas vezes.
    const usados: string[] = [];
    const banco = {
      from: () => {
        const api: Record<string, unknown> = {
          select: () => api,
          eq: () => api,
          gte: () => {
            usados.push("gte");
            return api;
          },
          contains: () => api,
          limit: async () => ({ data: [], error: null }),
        };
        return api;
      },
    } as unknown as SupabaseClient;
    await atenderDesconhecido(banco, INBOUND);
    expect(usados, "voltou a recortar por data — a repetição está de volta").not.toContain("gte");
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

  it("sem NEXT_PUBLIC_APP_URL cai no app de produção, não no silêncio", async () => {
    // A variável manda; se faltar, o motivo do silêncio de uma mãe não pode ser
    // uma configuração de ambiente. O endereço do piso foi CONFERIDO em
    // produção pelo `sitemap.xml` público em 17/08/2026.
    delete process.env.NEXT_PUBLIC_APP_URL;
    const r = await atenderDesconhecido(bancoFalso(0), INBOUND);
    expect(r).toMatchObject({ respondido: true });
    const enviado = enviarTexto.mock.calls[0]![0] as { texto: string };
    expect(enviado.texto).toContain("https://kolo-familia-web.vercel.app/signup");
  });
});

/**
 * GRUPO NÃO RECEBE CONVITE — guarda acrescentada em 17/08/2026.
 *
 * `parseZapiWebhook` filtra `fromMe`, mas não filtra grupo: a mensagem de um
 * grupo chega com o ID DO GRUPO no campo `phone`, não casa com família nenhuma
 * e cai neste módulo. Enquanto a resposta era silêncio isso não fazia mal;
 * ligar a resposta sem esta guarda faria a Ayla despejar convite de cadastro
 * dentro de grupo de WhatsApp.
 */
describe("só gente, nunca grupo", () => {
  it("id de grupo é registrado e NÃO recebe mensagem", async () => {
    const r = await atenderDesconhecido(bancoFalso(0), {
      phoneE164: "+120363019502650977", // id de grupo da Z-API: 18 dígitos
      texto: "alguém sabe de um bom terapeuta?",
    });
    expect(r).toMatchObject({ registrado: true, respondido: false, motivo: "nao_e_pessoal" });
    expect(enviarTexto).not.toHaveBeenCalled();
    // Registrar continua valendo: é assim que se descobre que aconteceu.
    expect(doKind("ayla_inbound_desconhecido")).toHaveLength(1);
  });

  it("celular normal continua passando", async () => {
    const r = await atenderDesconhecido(bancoFalso(0), {
      phoneE164: "+5521996801351",
      texto: "oi",
    });
    expect(r).toMatchObject({ respondido: true });
    expect(enviarTexto).toHaveBeenCalledTimes(1);
  });

  it("MORDE: a régua é o formato E.164, não uma lista de prefixos", () => {
    expect(pareceCelularPessoal("+5521996801351")).toBe(true);
    expect(pareceCelularPessoal("+553484430420")).toBe(true);
    expect(pareceCelularPessoal("+120363019502650977")).toBe(false);
    expect(pareceCelularPessoal("")).toBe(false);
    expect(pareceCelularPessoal(null)).toBe(false);
  });
});

describe("a mensagem", () => {
  const texto = textoParaDesconhecido("https://app.exemplo.com/signup");

  it("explica o silêncio e leva o link", () => {
    expect(texto).toContain("não encontrei um cadastro");
    expect(texto).toContain("https://app.exemplo.com/signup");
  });

  it("orienta a tocar no botão de começar o teste", () => {
    // O pedido do produto (17/08/2026): não basta mandar o link — a pessoa
    // precisa saber o que apertar quando a página abrir.
    expect(texto).toContain("começar o teste");
  });

  it("pede o cadastro COM ESTE MESMO número", () => {
    // Sem isto ela pode cadastrar outro telefone e voltar ao mesmo silêncio
    // por outro caminho — o WhatsApp da Ayla casa por número.
    expect(texto).toMatch(/mesmo número de WhatsApp/i);
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

/**
 * O LID DO WHATSAPP — O FALSO "NÃO ENCONTREI CADASTRO". 14/09/2026.
 *
 * ⚠️ O DEFEITO NÃO ERA DE CÓPIA E NÃO ERA DE BANCO. A consulta funcionava, não
 * havia erro, não havia truncamento (190 famílias contra um teto de 2000). O
 * que chegava era um identificador que NÃO É TELEFONE — o LID que o WhatsApp
 * passou a entregar para parte dos remetentes — e `chaveTelefoneBR`, ao
 * descartar os não-dígitos, apagava a única pista de que aquilo não era um
 * número. A partir daí tudo funcionava "corretamente" até a conclusão errada.
 *
 * Provado em produção: Barbara conversava com a Ayla sobre o filho se bater e,
 * seis minutos depois, recebeu duas vezes "Ainda não encontrei um cadastro com
 * este número".
 */
describe("identificador que não é telefone nunca recebe o convite de cadastro", () => {
  it("L1. LID do WhatsApp não é telefone de verdade", () => {
    expect(ehTelefoneDeVerdade("+147390476623892@lid")).toBe(false);
    expect(ehTelefoneDeVerdade("86638231335067@lid")).toBe(false);
    expect(ehTelefoneDeVerdade("+213293075533927@lid")).toBe(false);
  });

  it("L2. grupo e lista de transmissão também não são", () => {
    expect(ehTelefoneDeVerdade("120363041234567890@g.us")).toBe(false);
    expect(ehTelefoneDeVerdade("status@broadcast")).toBe(false);
  });

  it("L3. MORDE ONDE DOÍA: o LID de 15 dígitos passava pela guarda antiga", () => {
    // A guarda antiga contava dígitos DEPOIS de limpar — 15 dígitos, dentro da
    // faixa, e o convite saía. É exatamente este caso que produziu o incidente.
    const lid = "+147390476623892@lid";
    expect(lid.replace(/\D/g, "").length).toBe(15); // passava no teto antigo
    expect(pareceCelularPessoal(lid)).toBe(false); // e agora não passa
  });

  it("L4. telefone BR de verdade continua passando — com e sem +55", () => {
    for (const t of ["+5511994770067", "5511994770067", "+55 (11) 99477-0067", "11994770067"]) {
      expect(ehTelefoneDeVerdade(t), t).toBe(true);
      expect(pareceCelularPessoal(t), t).toBe(true);
    }
  });

  it("L5. o nono dígito e a formatação não mudam nada", () => {
    expect(pareceCelularPessoal("+551194770067")).toBe(true); // sem o 9
    expect(pareceCelularPessoal("+55 11 9477-0067")).toBe(true);
  });

  it("L6. telefone internacional legítimo continua passando", () => {
    expect(pareceCelularPessoal("+351912345678")).toBe(true);
    expect(pareceCelularPessoal("+14155552671")).toBe(true);
  });

  it("L7. vazio, letras e lixo não passam", () => {
    for (const t of ["", "   ", "abc", "+55abc11", null, undefined]) {
      expect(ehTelefoneDeVerdade(t as string), String(t)).toBe(false);
    }
  });

  it("L8. o convite NÃO é enviado para um LID — e a perda fica registrada", async () => {
    const r = await atenderDesconhecido(bancoFalso(0), {
      phoneE164: "+86638231335067@lid",
      texto: "Quero ajudar ele a se comunicar melhor quando fica frustrado",
    });
    expect(r.respondido).toBe(false);
    expect(r.motivo).toBe("nao_e_pessoal");
    // o contato continua registrado — a medição não pode sumir junto
    expect(r.registrado).toBe(true);
    expect(enviarTexto).not.toHaveBeenCalled();
    // ⚠️ SILÊNCIO SEM REGISTRO TROCARIA UM DEFEITO VISÍVEL POR UM INVISÍVEL.
    // Enquanto o LID não for resolvido, cada linha destas é uma mãe sem resposta.
    const perda = primeiro("ayla_identificador_nao_telefone");
    expect((perda.payload as Record<string, unknown>).sufixo).toBe("lid");
    expect(perda.severity).toBe("error");
  });

  it("L9. o telefone de verdade continua recebendo o convite — caso I do §12", async () => {
    const r = await atenderDesconhecido(bancoFalso(0), INBOUND);
    expect(r.respondido).toBe(true);
    expect(enviarTexto).toHaveBeenCalledTimes(1);
    expect(doKind("ayla_identificador_nao_telefone")).toHaveLength(0);
  });
});
