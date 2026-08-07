import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { providerConversacionalAtivo } from "./provider";
import { nucleoConducao, CONTRATO_DE_VERDADE } from "@/lib/conducao/diretrizes";

/**
 * A MIGRAÇÃO CONVERSACIONAL — o que não pode regredir em silêncio (06/08/2026).
 *
 * Estes testes não medem qualidade de resposta (isso é a bancada). Eles travam
 * as quatro propriedades que fazem a troca de provider ser SEGURA: o custo é
 * registrado com quem realmente respondeu, a volta atrás não precisa de deploy,
 * o sistema guarda o que fez, e a Ayla não afirma o que o sistema não fez.
 */

const raiz = resolve(__dirname, "..", "..");
const ler = (p: string) => readFileSync(resolve(raiz, p), "utf8");
/**
 * O CÓDIGO, sem comentários. Estes arquivos EXPLICAM por escrito o que não
 * podem fazer ("nunca grave a string unknown", "não renomeie pra entregue") —
 * uma asserção sobre o texto inteiro leria a própria explicação como se fosse
 * a violação. Mesma técnica de `provider.test.ts`.
 */
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const ROTA_WEB = ler("app/api/conversar/stream/route.ts");
const RESPONDER = ler("lib/ayla/responder.ts");
const ORQUESTRADOR = ler("lib/ayla/orchestrator.ts");
const SENDER = ler("lib/ayla/whatsappSender.ts");

// ============================================================
// 1. BILLING — o custo nunca pode ser atribuído a um modelo chutado
// ============================================================

describe("billing: provider e modelo vêm do RETORNO da chamada", () => {
  it("a conversa da WEB loga uso — antes não logava nada", () => {
    expect(ROTA_WEB).toMatch(/logarUsoApi\(/);
    expect(ROTA_WEB).toMatch(/feature: "conversa_web"/);
  });

  it("web e WhatsApp usam r.provider/r.model, nunca um literal", () => {
    for (const [nome, src] of [
      ["rota web", ROTA_WEB],
      ["responder do WhatsApp", RESPONDER],
    ] as const) {
      const chamada = src.slice(src.indexOf("logarUsoApi("));
      const bloco = chamada.slice(0, chamada.indexOf("});"));
      expect(bloco, nome).toMatch(/provider: r\.provider/);
      expect(bloco, nome).toMatch(/model: r\.model/);
      // Um literal aqui faria o /admin/uso-api cobrar o modelo errado no dia
      // seguinte a um rollback — o custo passaria a mentir exatamente quando
      // mais importa saber quanto cada lado custou.
      expect(bloco, nome).not.toMatch(/provider: "(anthropic|openai)"/);
      expect(bloco, nome).not.toMatch(/model: (MODELS|AYLA_MODEL|MODELO_CONVERSA)/);
    }
  });

  it("os tokens também saem do retorno normalizado", () => {
    expect(ROTA_WEB).toMatch(/input_tokens: r\.tokensIn/);
    expect(RESPONDER).toMatch(/output_tokens: r\.tokensOut/);
  });
});

// ============================================================
// 2. ROLLBACK — por env, sem deploy
// ============================================================

describe("seletor de provider", () => {
  const comEnv = (v: string | undefined) => {
    const antes = process.env.IA_PROVIDER;
    if (v === undefined) delete process.env.IA_PROVIDER;
    else process.env.IA_PROVIDER = v;
    try {
      return providerConversacionalAtivo();
    } finally {
      if (antes === undefined) delete process.env.IA_PROVIDER;
      else process.env.IA_PROVIDER = antes;
    }
  };

  it("IA_PROVIDER=openai liga o GPT", () => {
    expect(comEnv("openai")).toBe("openai");
  });

  it("ausente ou anthropic mantém o Claude", () => {
    expect(comEnv(undefined)).toBe("anthropic");
    expect(comEnv("anthropic")).toBe("anthropic");
  });

  it("valor inválido NÃO desliga a conversa — cai no Claude", () => {
    // Um typo no painel de env não pode deixar as famílias sem resposta: o
    // pior caso tem que ser "continua como estava".
    for (const lixo of ["opemai", "OpenAI ", "gpt", "", "true"]) {
      expect(comEnv(lixo), lixo).toBe("anthropic");
    }
  });

  it("os dois canais leem o seletor — nenhum tem provider fixo no código", () => {
    for (const [nome, src] of [
      ["rota web", ROTA_WEB],
      ["responder do WhatsApp", RESPONDER],
    ] as const) {
      // A decisão por família é a de `rollout-conversacional.test.ts`; aqui só
      // importa que o canal NÃO decide sozinho e que o modelo segue o provider.
      expect(src, nome).toMatch(/providerConversacionalParaFamilia\(/);
      expect(src, nome).toMatch(/MODELO_CONVERSA\[provider\]/);
    }
  });
});

// ============================================================
// 3. VERDADE OPERACIONAL — o sistema guarda o que fez
// ============================================================

describe("prova de envio no WhatsApp", () => {
  it('a Z-API nunca devolve a string "unknown" — id ausente é null', () => {
    // "unknown" mentia sobre existir um id E colidia no índice único de
    // ayla_messages.zaap_message_id (0053), o que derrubaria o registro da
    // mensagem na segunda ocorrência.
    expect(semComentarios(SENDER)).not.toMatch(/"unknown"/);
    expect(SENDER).toMatch(/json\.messageId \?\? json\.zaapId \?\? null/);
  });

  it("toda mensagem de saída persiste o id do provedor", () => {
    // Na conversa da Vitória foram 27 de 27 mensagens com zaap_message_id
    // nulo — o sistema não sabia se tinha enviado, e a Ayla disse "Chegou!".
    const inserts = ORQUESTRADOR.split('from("ayla_messages").insert(').slice(1);
    const saida = inserts.filter((b) => b.slice(0, 400).includes('direcao: "outbound"'));
    expect(saida.length).toBeGreaterThanOrEqual(2); // reativa + proativa
    const comRegistro = saida.filter((b) => b.slice(0, 400).includes("registroDeEnvio("));
    expect(comRegistro.length).toBeGreaterThanOrEqual(2);
  });

  it("o campo se chama pelo que prova: aceito, não entregue", () => {
    expect(ORQUESTRADOR).toMatch(/aceito_pelo_provedor/);
    // Aceito pelo provedor ≠ entregue ≠ recebido ≠ lido. Status de entrega
    // viria de webhook, que não escutamos — inventar o nome seria trocar um
    // nulo honesto por um número errado.
    const registro = semComentarios(
      ORQUESTRADOR.slice(
        ORQUESTRADOR.indexOf("function registroDeEnvio"),
        ORQUESTRADOR.indexOf("async function enviarEPersistir"),
      ),
    );
    expect(registro).not.toMatch(/entregue|recebida_no_aparelho|lida/);
  });
});

// ============================================================
// 4. CONTRATO DE VERDADE — a Ayla explica o estado, não o inventa
// ============================================================

describe("contrato de verdade", () => {
  it("está no núcleo — vale nos DOIS canais, não em um só", () => {
    expect(nucleoConducao()).toContain(CONTRATO_DE_VERDADE);
  });

  it("nomeia as frases que saíram em produção", () => {
    for (const frase of ["já atualizo aqui", "anotado", "está pronto", "chegou aí"]) {
      expect(CONTRATO_DE_VERDADE.toLowerCase()).toContain(frase);
    }
  });

  it("não vira recusa: diz o que fazer NO LUGAR", () => {
    // Regra que só proíbe produz a Ayla burocrática — o mesmo erro que a
    // fronteira do diagnóstico documenta ("resposta segura e inútil é falha").
    expect(CONTRATO_DE_VERDADE).toMatch(/NO LUGAR/);
    expect(CONTRATO_DE_VERDADE).toMatch(/EXPLICA o estado/);
  });
});
