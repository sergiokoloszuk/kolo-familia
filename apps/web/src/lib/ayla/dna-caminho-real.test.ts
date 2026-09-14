import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { montarMundo, inboundDe, passouPeloExperimental, type Mundo } from "./__harness/cenario";
import { clienteFalso, type Registro } from "./__harness/modelo";
import { BLOCO_DNA } from "@/lib/conducao/dna-especialistas";

/**
 * O DNA DOS ESPECIALISTAS CHEGA AO MODELO — provado pelo TURNO, não pelo arquivo.
 *
 * ⚠️ POR QUE A ASSERÇÃO É SOBRE O `system` QUE O PRODUTOR RECEBEU. Um teste que
 * verificasse `experimental.ts` conter a string `BLOCO_DNA` passaria mesmo se a
 * variável estivesse num array morto, dentro de um ramo que nunca executa, ou
 * apagada por um `.filter(Boolean)` mal colocado. Presença de código não é prova
 * de execução — é a lição da PEND-072, e o arquivo `perfil-familia-caminho-real`
 * nasceu exatamente disso.
 *
 * Aqui o turno roda inteiro por `processInbound`, com banco em memória, e a
 * asserção é sobre o que o modelo efetivamente recebeu.
 *
 * ⚠️ O QUE ESTE ARQUIVO **NÃO** PROVA, e precisa estar dito: que a resposta
 * ficou melhor. Isso foi medido na arena de valor (270 gerações, 270
 * julgamentos cegos, 4% → 24% de alto valor) e não é reproduzível num teste
 * unitário — modelo falso devolve texto fixo. O que se trava aqui é a FIAÇÃO:
 * o bloco chega, chega uma vez só, chega no lugar certo, e não chega onde não
 * deveria.
 */

const registros: Registro[] = [];
const mundoRef: { atual: Mundo | null; alvo: string | null } = { atual: null, alvo: null };
/** Todo system que o produtor recebeu neste turno — a prova de injeção. */
const systems: string[] = [];

vi.mock("./whatsappSender", () => ({
  enviarTexto: async (p: { phoneE164: string; texto: string }) => {
    mundoRef.atual?.enviadas.push({ texto: p.texto, para: p.phoneE164 });
    return { messageId: "m", raw: {} };
  },
  enviarDocumento: async () => ({ messageId: "doc", raw: {} }),
  enviarImagem: async () => ({ messageId: "img", raw: {} }),
  sendVideoGuia: async () => ({ messageId: "vid", raw: {} }),
  parseZapiWebhook: () => null,
}));

vi.mock("@/lib/ia/provider", () => ({
  MODELO_CONVERSA: { anthropic: "claude-sonnet-4-6", openai: "gpt-5.6-luna" },
  providerConversacionalParaFamilia: () => "openai",
  gerarConversacional: async (p: { system?: string }) => {
    systems.push(String(p.system ?? ""));
    return {
      texto: '{"fala":"[resposta da Ayla experimental]","campo_investigado":null}',
      provider: "openai",
      model: "gpt-5.6-luna",
      tokensIn: 100,
      tokensOut: 20,
      cacheRead: 0,
      cacheWrite: 0,
      ms: 1,
    };
  },
}));

vi.mock("./anthropic", async (orig) => {
  const real = (await orig()) as Record<string, unknown>;
  return { ...real, getAylaAnthropicClient: () => clienteFalso({ alvo: mundoRef.alvo }, registros) };
});

const { processInbound } = await import("./orchestrator");

const ENV = process.env.AYLA_EXPERIMENTAL_FAMILY_IDS;
beforeEach(() => {
  registros.length = 0;
  systems.length = 0;
});
afterEach(() => {
  if (ENV === undefined) delete process.env.AYLA_EXPERIMENTAL_FAMILY_IDS;
  else process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = ENV;
});

function familia() {
  return montarMundo({
    nomeMae: "Renata",
    telefone: "+5541999990077",
    criancas: [{ nome: "Bento", nascimento: "2016-09-03", genero: "masculino" }],
  });
}

async function turno(mundo: Mundo, texto: string) {
  mundoRef.atual = mundo;
  mundoRef.alvo = mundo.membros["Bento"];
  process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = mundo.familyId;
  await processInbound(mundo.db.cliente(), inboundDe(mundo, texto));
  await new Promise((r) => setTimeout(r, 50));
}

/** O system que foi ao PRODUTOR da resposta — o maior, não o do classificador. */
const systemDaResposta = () => systems.slice().sort((a, b) => b.length - a.length)[0] ?? "";

// ─────────────────────────────────────────────────────────────────────────────
describe("o DNA chega ao modelo, no turno real", () => {
  it("0. o turno roda pelo motor novo — sem isto, nada abaixo prova nada", async () => {
    const mundo = familia();
    await turno(mundo, "Oi, tudo bem?");
    expect(passouPeloExperimental(mundo), "o turno caiu para o Legacy").toBe(true);
  }, 30000);

  it("1. o bloco INTEIRO entra no system do produtor", async () => {
    const mundo = familia();
    await turno(mundo, "O Bento não consegue esperar a vez em atividade de grupo");
    const sys = systemDaResposta();
    // ⚠️ O BLOCO INTEIRO, não uma etiqueta. Uma asserção de título passaria com
    // o corpo truncado, e é o corpo que muda a resposta.
    expect(sys, "o DNA não chegou ao modelo").toContain(BLOCO_DNA);
  }, 30000);

  it("2. UMA vez só — bloco repetido gastaria contexto e competiria consigo", async () => {
    const mundo = familia();
    await turno(mundo, "Ele se irrita quando erra, o que eu faço?");
    const sys = systemDaResposta();
    const marcador = "# Como raciocinar antes de responder";
    expect(sys.split(marcador).length - 1).toBe(1);
  }, 30000);

  it("3. DEPOIS do contexto e ANTES do formato — a ordem em que foi medido", async () => {
    const mundo = familia();
    await turno(mundo, "Como eu trabalho o esperar a vez com ele?");
    const sys = systemDaResposta();
    const iCore = sys.indexOf("# Como raciocinar antes de responder");
    const iCtx = sys.indexOf("<o_que_ja_sabemos>");
    const iFormato = sys.lastIndexOf("# Idioma");
    expect(iCore, "DNA ausente").toBeGreaterThan(-1);
    expect(iFormato, "formato ausente").toBeGreaterThan(-1);
    // o contexto pode não existir num perfil vazio; quando existe, vem antes
    if (iCtx > -1) expect(iCore).toBeGreaterThan(iCtx);
    expect(iCore).toBeLessThan(iFormato);
  }, 30000);

  it("4. o Core continua sendo o PREFIXO do system — o DNA não o empurrou", async () => {
    const mundo = familia();
    await turno(mundo, "Me dá uma ideia pra hoje à tarde");
    const sys = systemDaResposta();
    // O `cache_control` da Anthropic casa por prefixo, e o prefixo é o Core.
    // Um bloco inserido ANTES dele invalidaria o cache de todo mundo.
    expect(sys.indexOf("# Como raciocinar antes de responder")).toBeGreaterThan(2000);
  }, 30000);
});

describe("o que o DNA NÃO pode mudar", () => {
  it("5. a segurança continua soberana — o bloco não fala de risco", () => {
    // ⚠️ REGRA DA MISSÃO: o DNA evita PERSEVERAÇÃO, não desliga segurança. A
    // garantia é estrutural: ele não menciona risco, crise nem encaminhamento,
    // então não tem como competir com a decisão de segurança, que roda antes e
    // em outro lugar.
    expect(BLOCO_DNA).not.toMatch(/risco|crise|emerg[êe]ncia|CVV|se machuc|autoagress|suic/i);
    expect(BLOCO_DNA).not.toMatch(/n[ãa]o pergunte se|deixe de perguntar|ignore/i);
  });

  it("6. não instrui a perguntar mais — o interrogatório não pode voltar por aqui", () => {
    // O bloco tem UMA menção a pergunta, e ela é sobre o que a Ayla precisa
    // saber internamente ("em qual etapa trava"), não sobre interrogar a mãe.
    expect(BLOCO_DNA).not.toMatch(/pergunte (à |a )?(mãe|família|ela)/i);
    expect(BLOCO_DNA).not.toMatch(/fa[çc]a (uma |mais )?pergunta/i);
  });

  it("7. não carrega Pós nem Boas Práticas — as três fontes seguem separadas", () => {
    expect(BLOCO_DNA).not.toMatch(/boas pr[áa]ticas|neurodesenvolvimento|DSM|CID-11|Dunn|apraxia/i);
  });

  it("8. não vaza nome de especialista nem de persona", () => {
    expect(BLOCO_DNA).not.toMatch(
      /especialista de|persona|skill \d|aprendizado:|autonomia:|socializacao:/i,
    );
  });

  it("9. é curto — 1.791 caracteres contra os 28 mil do Core", () => {
    // Um bloco longo competiria com o Core, e competição dentro de prompt é
    // como regra perde. O número está preso para que crescer seja uma decisão.
    expect(BLOCO_DNA.length).toBeLessThan(2200);
  });

  it("10. não toca o escritor da Fase 2 — nenhuma menção a Perfil Vivo ou escrita", () => {
    expect(BLOCO_DNA).not.toMatch(/grave|registre|salve|perfil vivo|atualize o perfil/i);
  });
});

describe("SABOTAGEM: sem o bloco, a fiação não existe", () => {
  /**
   * ⚠️ ESTE BLOCO MORDE A INJEÇÃO, NÃO O ARQUIVO. Ele lê `experimental.ts` e
   * exige que `BLOCO_DNA` esteja DENTRO do array do `system` — não apenas
   * importado. Um `import` sem uso passaria por uma verificação de import;
   * passaria também num `tsc` com `noUnusedLocals` desligado; e a família não
   * receberia nada.
   *
   * Removida a linha `posTrial ? "" : BLOCO_DNA`, os testes 1 a 4 acima ficam
   * vermelhos — foi executado.
   */
  it("11. `BLOCO_DNA` está no array do system, e sob a guarda do pós-trial", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const src = readFileSync(resolve(__dirname, "experimental.ts"), "utf8");
    const arr = src.slice(src.indexOf("system: ["), src.indexOf("messages: [{ role: \"user\""));
    expect(arr, "BLOCO_DNA fora do array do system").toContain("posTrial ? \"\" : BLOCO_DNA");
    // e o repertório continua DEPOIS dele
    expect(arr.indexOf("BLOCO_DNA")).toBeLessThan(arr.indexOf("repertorio"));
  });
});
