import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { montarMundo, inboundDe, type Mundo } from "./__harness/cenario";
import { clienteFalso, type Registro } from "./__harness/modelo";

/**
 * A PORTA AO LADO — 15/08/2026.
 *
 * A Ayla atual é o CONTROLE e continua inteira. Este arquivo prova as três
 * coisas que precisam ser verdadeiras para o experimento poder existir em
 * produção sem risco:
 *
 *   1. só entra quem está na allowlist explícita;
 *   2. qualquer dúvida cai para a Ayla atual (FAIL CLOSED);
 *   3. a família recebe UMA resposta — nunca as duas Aylas.
 *
 * ⚠️ O terceiro é o que mais assusta e o mais fácil de quebrar: basta alguém
 * remover o `return` do bloco experimental para a mãe receber duas respostas
 * diferentes no mesmo turno.
 */

const registros: Registro[] = [];
const mundoRef: { atual: Mundo | null; alvo: string | null } = { atual: null, alvo: null };
/** Quantas vezes cada caminho gerou texto neste turno. */
const chamadas = { experimental: 0, legacy: 0 };

vi.mock("./whatsappSender", () => ({
  enviarTexto: async (p: { phoneE164: string; texto: string }) => {
    mundoRef.atual?.enviadas.push({ para: p.phoneE164, texto: p.texto });
    return { ok: true, messageId: "z" };
  },
  enviarImagem: async () => ({ ok: true, messageId: "i" }),
  enviarDocumento: async () => ({ ok: true, messageId: "d" }),
  parseZapiWebhook: () => null,
}));

/**
 * O provider é o MESMO para os dois caminhos — o que os distingue é o system.
 * O prompt experimental abre com "Você é **AYLA**"; o núcleo atual abre com
 * "# Quem você é". É assim que este arquivo sabe quem respondeu.
 */
vi.mock("@/lib/ia/provider", () => ({
  MODELO_CONVERSA: { anthropic: "claude-sonnet-4-6", openai: "gpt-5.6-luna" },
  providerConversacionalParaFamilia: () => "anthropic",
  gerarConversacional: async (p: { system?: string }) => {
    const sys = String(p.system ?? "");
    if (sys.includes("Você é **AYLA**")) chamadas.experimental++;
    else chamadas.legacy++;
    return {
      texto: sys.includes("Você é **AYLA**") ? "[resposta EXPERIMENTAL]" : "[resposta LEGACY]",
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
vi.mock("./anthropic", () => ({
  AYLA_MODEL: "claude-haiku-4-5",
  AYLA_MODEL_FALLBACK: "claude-sonnet-4-6",
  getAylaAnthropicClient: () => clienteFalso({ alvo: mundoRef.alvo }, registros),
}));
vi.mock("./lote-inbound", () => ({
  aguardarTurnoDaMae: async (_s: unknown, p: { textoAtual: string }) => ({ texto: p.textoAtual, quantidade: 1 }),
  descartarTurnoPendente: async () => {},
}));
vi.mock("@/lib/ai/prompts", () => ({ getSystemPrompt: async (_k: string, f: string) => f }));

const { processInbound } = await import("./orchestrator");
const { ehFamiliaExperimental } = await import("./experimental");

const ENV_ORIGINAL = process.env.AYLA_EXPERIMENTAL_FAMILY_IDS;

function familia() {
  const m = montarMundo({
    nomeMae: "Juliana",
    criancas: [{ nome: "Daniel", nascimento: "2016-03-19", genero: "masculino" }],
  });
  mundoRef.atual = m;
  mundoRef.alvo = m.membros["Daniel"];
  return m;
}

beforeEach(() => {
  chamadas.experimental = 0;
  chamadas.legacy = 0;
  registros.length = 0;
});
afterEach(() => {
  if (ENV_ORIGINAL === undefined) delete process.env.AYLA_EXPERIMENTAL_FAMILY_IDS;
  else process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = ENV_ORIGINAL;
});

describe("o portão: quem entra", () => {
  it("MORDE: sem a variável, NINGUÉM entra", () => {
    delete process.env.AYLA_EXPERIMENTAL_FAMILY_IDS;
    expect(ehFamiliaExperimental("qualquer-id")).toBe(false);
  });

  it("MORDE: lista vazia significa ninguém, nunca todo mundo", () => {
    process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = "";
    expect(ehFamiliaExperimental("qualquer-id")).toBe(false);
    process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = "   ";
    expect(ehFamiliaExperimental("qualquer-id")).toBe(false);
  });

  it("MORDE: só o id EXATO da allowlist entra", () => {
    process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = "fam-A, fam-B";
    expect(ehFamiliaExperimental("fam-A")).toBe(true);
    expect(ehFamiliaExperimental("fam-B")).toBe(true);
    expect(ehFamiliaExperimental("fam-C")).toBe(false);
    // Nada de prefixo, sufixo ou "contém".
    expect(ehFamiliaExperimental("fam-A2")).toBe(false);
    expect(ehFamiliaExperimental("fam")).toBe(false);
  });

  it("MORDE: id ausente, vazio ou não-string → Ayla atual", () => {
    process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = "fam-A";
    expect(ehFamiliaExperimental(null)).toBe(false);
    expect(ehFamiliaExperimental(undefined)).toBe(false);
    expect(ehFamiliaExperimental("")).toBe(false);
    expect(ehFamiliaExperimental("   ")).toBe(false);
    expect(ehFamiliaExperimental(42 as unknown as string)).toBe(false);
  });

  it("o portão NÃO olha o texto da mensagem — só o id da família", () => {
    const EXP = readFileSync(resolve(__dirname, "experimental.ts"), "utf8");
    const gate = EXP.slice(EXP.indexOf("export function ehFamiliaExperimental"));
    const corpo = gate.slice(0, gate.indexOf("\n}"));
    expect(corpo).not.toMatch(/texto|mensagem|nome|includes\(["']/);
  });
});

describe("UMA resposta, nunca duas", () => {
  it("MORDE: família NA allowlist é respondida SÓ pela experimental", async () => {
    const mundo = familia();
    process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = mundo.familyId;
    await processInbound(mundo.db.cliente(), inboundDe(mundo, "Ele fica bravo quando perde um jogo."));

    expect(chamadas.experimental, "a experimental não respondeu").toBe(1);
    expect(chamadas.legacy, "a Ayla atual respondeu TAMBÉM — a mãe receberia duas").toBe(0);
    expect(mundo.enviadas.length, "mais de uma mensagem enviada").toBe(1);
    expect(mundo.enviadas[0].texto).toContain("EXPERIMENTAL");
  });

  it("MORDE: família FORA da allowlist é respondida SÓ pela Ayla atual", async () => {
    const mundo = familia();
    process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = "outra-familia-qualquer";
    await processInbound(mundo.db.cliente(), inboundDe(mundo, "Ele fica bravo quando perde um jogo."));

    expect(chamadas.experimental, "família de fora entrou no experimento").toBe(0);
    expect(chamadas.legacy).toBe(1);
    expect(mundo.enviadas[0].texto).toContain("LEGACY");
  });

  it("MORDE: sem a variável configurada, o turno é idêntico ao de hoje", async () => {
    const mundo = familia();
    delete process.env.AYLA_EXPERIMENTAL_FAMILY_IDS;
    await processInbound(mundo.db.cliente(), inboundDe(mundo, "Ele fica bravo quando perde um jogo."));
    expect(chamadas.experimental).toBe(0);
    expect(chamadas.legacy).toBe(1);
  });

  it("o `return` que impede a resposta dupla continua lá", () => {
    const ORCH = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");
    const bloco = ORCH.slice(ORCH.indexOf("if (ehFamiliaExperimental(family.id))"));
    const ate = bloco.slice(0, bloco.indexOf("// 3a. Resposta à oferta"));
    expect(ate).toMatch(/return \{ tratada: true, familia: family\.id, resposta: resp \};/);
  });
});

describe("o caminho curto pula mesmo a condução atual", () => {
  it("MORDE: nenhum auxiliar (parser, intenção) roda no turno experimental", async () => {
    const mundo = familia();
    process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = mundo.familyId;
    await processInbound(mundo.db.cliente(), inboundDe(mundo, "Ele fica bravo quando perde um jogo."));
    // `registros` recebe TODA chamada ao cliente Anthropic — parser, intenção,
    // roteador, dedup. No caminho experimental não pode haver nenhuma.
    expect(registros.length, `auxiliares chamados: ${registros.length}`).toBe(0);
  });

  it("MORDE: o núcleo de diretrizes.ts NÃO entra no prompt experimental", async () => {
    const mundo = familia();
    process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = mundo.familyId;
    const EXP = readFileSync(resolve(__dirname, "experimental.ts"), "utf8");
    // Só os IMPORTS — a palavra "diretrizes" aparece nos comentários, dizendo
    // exatamente que o núcleo NÃO entra. Regex sobre o arquivo inteiro
    // confundiria a explicação com o defeito.
    const imports = (EXP.match(/^import .*$/gm) ?? []).join("\n");
    expect(imports, "o experimento importou o núcleo atual").not.toMatch(
      /nucleoConducao|conducao\/diretrizes|conducao\/lentes|conducao\/formas/,
    );
    const PROMPT = readFileSync(resolve(__dirname, "experimental-prompt.ts"), "utf8");
    expect(PROMPT, "o prompt experimental importou algo do núcleo").not.toMatch(/^import /m);
  });
});

describe("as proteções que NÃO podem ser puladas", () => {
  it("a rede de fronteiras continua inspecionando a saída", () => {
    const EXP = readFileSync(resolve(__dirname, "experimental.ts"), "utf8");
    expect(EXP).toMatch(/fronteiraAtravessada\(texto, membro\?\.diagnosticos_formais \?\? null\)/);
    // E barrar significa cair pro fluxo atual, não enviar assim mesmo.
    expect(EXP).toMatch(/if \(vazamento\) \{[\s\S]{0,320}return null;/);
  });

  it("o portão fica DEPOIS de identidade, bloqueio, idempotência e assinatura", () => {
    const ORCH = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");
    const iPortao = ORCH.indexOf("if (ehFamiliaExperimental(family.id))");
    expect(iPortao).toBeGreaterThan(-1);
    for (const antes of [
      "encontrarFamiliaPorTelefone",
      "if (pref?.desativada && pref?.consentimento_em)",
      "onConflict: \"zaap_message_id\"",
      "const turno = await aguardarTurnoDaMae",
      "if (!(await aylaServicoLiberado(supabase, family.id)))",
    ]) {
      const i = ORCH.indexOf(antes);
      expect(i, `não achei a proteção: ${antes}`).toBeGreaterThan(-1);
      expect(i, `o experimento passou NA FRENTE de: ${antes}`).toBeLessThan(iPortao);
    }
  });

  it("o contexto é recortado pela família do turno — sem vazamento", () => {
    const EXP = readFileSync(resolve(__dirname, "experimental.ts"), "utf8");
    const ctx = EXP.slice(EXP.indexOf("async function montarContexto"));
    const corpo = ctx.slice(0, ctx.indexOf("\n}"));
    const consultas = corpo.match(/\.from\(/g) ?? [];
    const recortes = corpo.match(/\.eq\("family_account_id", familyId\)/g) ?? [];
    expect(consultas.length, "nenhuma consulta encontrada").toBeGreaterThan(0);
    expect(recortes.length, "há consulta sem recorte de família").toBe(consultas.length);
  });
});
