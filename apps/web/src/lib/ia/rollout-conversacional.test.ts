import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  modoConversacional,
  providerConversacionalAtivo,
  providerConversacionalParaFamilia,
} from "./provider";

/**
 * LIBERAÇÃO CONTROLADA DO GPT — a etapa entre "desligado" e "todas as famílias".
 *
 * O que estes testes protegem não é a feature: é o ACIDENTE. Um rollout de
 * teste que se promove sozinho a 100% por causa de uma variável apagada é pior
 * que não ter rollout de teste — porque quem configurou acha que só a
 * Rosângela está no GPT.
 *
 * Regra única, testada nas duas direções: FAIL CLOSED. Na dúvida, Claude.
 */

const ANTES = { ...process.env };
afterEach(() => {
  process.env = { ...ANTES };
});

/** Configura o ambiente como o painel de env faria. */
function ambiente(iaProvider?: string, ids?: string) {
  if (iaProvider === undefined) delete process.env.IA_PROVIDER;
  else process.env.IA_PROVIDER = iaProvider;
  if (ids === undefined) delete process.env.OPENAI_TEST_FAMILY_IDS;
  else process.env.OPENAI_TEST_FAMILY_IDS = ids;
}

// Com LETRAS de propósito: um uuid só de dígitos faz `toUpperCase()` devolver
// ele mesmo, e o caso de "caixa diferente é outro id" passaria sem testar nada.
const AUTORIZADA = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const OUTRA = "f9e8d7c6-b5a4-4938-8271-6f5e4d3c2b1a";

// ============================================================
// OS TRÊS ESTADOS
// ============================================================

describe("estado DESLIGADO — todas as famílias no Claude", () => {
  it("1. IA_PROVIDER ausente", () => {
    ambiente(undefined, `${AUTORIZADA}`);
    expect(modoConversacional()).toBe("anthropic");
    expect(providerConversacionalParaFamilia(AUTORIZADA)).toBe("anthropic");
    expect(providerConversacionalAtivo()).toBe("anthropic");
  });

  it("2. IA_PROVIDER=anthropic — a allowlist não vale nada aqui", () => {
    ambiente("anthropic", `${AUTORIZADA},${OUTRA}`);
    // Uma lista esquecida no ambiente NÃO pode ligar ninguém: o modo manda.
    expect(providerConversacionalParaFamilia(AUTORIZADA)).toBe("anthropic");
    expect(providerConversacionalParaFamilia(OUTRA)).toBe("anthropic");
  });
});

describe("estado TESTE — só a allowlist", () => {
  it("3. família autorizada → GPT", () => {
    ambiente("openai_teste", `${AUTORIZADA}`);
    expect(modoConversacional()).toBe("openai_teste");
    expect(providerConversacionalParaFamilia(AUTORIZADA)).toBe("openai");
  });

  it("4. família NÃO autorizada → Claude", () => {
    ambiente("openai_teste", `${AUTORIZADA}`);
    expect(providerConversacionalParaFamilia(OUTRA)).toBe("anthropic");
  });

  it("5. allowlist vazia ou ausente → NINGUÉM no GPT", () => {
    // Este é o teste que define a arquitetura. Se a lista vazia significasse
    // "sem restrição", apagar a variável promoveria todas as famílias pra 100%
    // em silêncio — o acidente mais provável virando o resultado mais perigoso.
    for (const lista of [undefined, "", "   ", ",", ",,, ,"]) {
      ambiente("openai_teste", lista);
      expect(providerConversacionalParaFamilia(AUTORIZADA), String(lista)).toBe("anthropic");
      expect(providerConversacionalParaFamilia(OUTRA), String(lista)).toBe("anthropic");
    }
  });

  it("6. family_account_id ausente → Claude", () => {
    ambiente("openai_teste", `${AUTORIZADA}`);
    for (const id of [null, undefined, "", "   "]) {
      expect(providerConversacionalParaFamilia(id), String(id)).toBe("anthropic");
    }
    // Sem id, o "provider do ambiente" é o que qualquer um de fora recebe.
    expect(providerConversacionalAtivo()).toBe("anthropic");
  });

  it("7. ids com espaços, quebras de linha e vírgulas duplas", () => {
    for (const lista of [
      `  ${AUTORIZADA}  `,
      `${OUTRA}, ${AUTORIZADA}`,
      `${OUTRA},,${AUTORIZADA},`,
      `${OUTRA}\n${AUTORIZADA}`,
      `${OUTRA} ${AUTORIZADA}`,
    ]) {
      ambiente("openai_teste", lista);
      expect(providerConversacionalParaFamilia(AUTORIZADA), lista).toBe("openai");
      // E o espaço acidental no id que CHEGA também não pode barrar quem está
      // na lista, nem liberar quem não está.
      expect(providerConversacionalParaFamilia(` ${AUTORIZADA} `), lista).toBe("openai");
      expect(providerConversacionalParaFamilia("33333333"), lista).toBe("anthropic");
    }
  });

  it("8. entrada inválida não libera GPT indevidamente", () => {
    ambiente("openai_teste", `${AUTORIZADA}`);
    for (const id of [
      AUTORIZADA.slice(0, 8), // prefixo do id autorizado
      `${AUTORIZADA}x`, // sufixo
      AUTORIZADA.toUpperCase(), // caixa diferente = outro id
      "*",
      "all",
      "true",
      "33333333",
    ]) {
      expect(providerConversacionalParaFamilia(id), id).toBe("anthropic");
    }
    // E valores estranhos em IA_PROVIDER caem no Claude, mesmo com lista cheia.
    for (const v of ["opemai", "OpenAI", "gpt", "openai-teste", "teste", "true", "1"]) {
      ambiente(v, `${AUTORIZADA}`);
      expect(providerConversacionalParaFamilia(AUTORIZADA), v).toBe("anthropic");
    }
  });
});

describe("estado TODOS — exige alguém digitar `openai`", () => {
  it("a allowlist deixa de importar quando o rollout é total", () => {
    ambiente("openai", undefined);
    expect(modoConversacional()).toBe("openai");
    expect(providerConversacionalParaFamilia(OUTRA)).toBe("openai");
    expect(providerConversacionalParaFamilia(null)).toBe("openai");
  });

  it("espaço acidental em volta do valor não desliga o rollout", () => {
    ambiente("  openai  ", undefined);
    expect(providerConversacionalParaFamilia(OUTRA)).toBe("openai");
  });
});

// ============================================================
// OS DOIS CANAIS, E O ROLLBACK
// ============================================================

const raiz = resolve(__dirname, "..", "..");
const ler = (p: string) => readFileSync(resolve(raiz, p), "utf8");
const ROTA_WEB = ler("app/api/conversar/stream/route.ts");
const RESPONDER = ler("lib/ayla/responder.ts");

describe("WhatsApp e Estratégias obedecem à MESMA regra", () => {
  it("9-11. a mesma família decide igual nos dois canais", () => {
    ambiente("openai_teste", `${AUTORIZADA}`);
    // A função é uma só — então "os dois canais" aqui é literal: é a mesma
    // chamada, com o id que cada canal tem em mãos.
    const noWhatsApp = providerConversacionalParaFamilia(AUTORIZADA);
    const nasEstrategias = providerConversacionalParaFamilia(AUTORIZADA);
    expect(noWhatsApp).toBe("openai");
    expect(nasEstrategias).toBe("openai");

    expect(providerConversacionalParaFamilia(OUTRA)).toBe("anthropic");
  });

  it("nenhum canal decide por conta própria", () => {
    for (const [nome, src] of [
      ["rota web", ROTA_WEB],
      ["responder do WhatsApp", RESPONDER],
    ] as const) {
      expect(src, nome).toMatch(/providerConversacionalParaFamilia\(/);
      // Regra duplicada nos dois arquivos é como uma família recebe GPT num
      // canal e Claude no outro, dentro da mesma conversa.
      expect(src, nome).not.toMatch(/OPENAI_TEST_FAMILY_IDS|IA_PROVIDER/);
      expect(src, nome).not.toMatch(/provider = "(openai|anthropic)"/);
    }
  });

  it("cada canal passa o id que tem, e não um placeholder", () => {
    expect(ROTA_WEB).toMatch(/providerConversacionalParaFamilia\(family\.id\)/);
    expect(RESPONDER).toMatch(
      /providerConversacionalParaFamilia\(tracking\?\.family_account_id\)/,
    );
  });

  it("12. rollback — uma variável derruba tudo de volta pro Claude", () => {
    ambiente("openai_teste", `${AUTORIZADA},${OUTRA}`);
    expect(providerConversacionalParaFamilia(AUTORIZADA)).toBe("openai");

    // Rollback do teste: troca o modo. A lista pode ficar onde está.
    ambiente("anthropic", `${AUTORIZADA},${OUTRA}`);
    expect(providerConversacionalParaFamilia(AUTORIZADA)).toBe("anthropic");

    // Rollback do 100%: remover a variável basta.
    ambiente("openai", undefined);
    expect(providerConversacionalParaFamilia(OUTRA)).toBe("openai");
    ambiente(undefined, undefined);
    expect(providerConversacionalParaFamilia(OUTRA)).toBe("anthropic");
    expect(providerConversacionalParaFamilia(AUTORIZADA)).toBe("anthropic");
  });
});

// ============================================================
// O ESCOPO NÃO PODE VAZAR
// ============================================================

describe("nada além da conversa mudou de provider", () => {
  it("gerarConversacional continua com DOIS consumidores de produção", () => {
    // Se um classificador, parser ou gerador de artefato aparecer aqui, a
    // liberação de teste deixou de ser sobre a conversa.
    const src = resolve(raiz);
    const esperados = [
      "app/api/conversar/stream/route.ts",
      "lib/ayla/responder.ts",
      "app/api/admin/provider-check/route.ts", // prova a chave, não conversa
    ];
    for (const p of esperados) {
      expect(readFileSync(resolve(src, p), "utf8")).toMatch(/gerarConversacional/);
    }
    for (const proibido of [
      "lib/ayla/parser.ts",
      "lib/ayla/intent.ts",
      "lib/ia/plano.ts",
      "lib/ia/router.ts",
      "lib/ayla/prontidao-rotina.ts",
      "lib/ayla/estado-seguranca.ts",
      "lib/ayla/traduzir.ts",
    ]) {
      expect(readFileSync(resolve(src, proibido), "utf8"), proibido).not.toMatch(
        /gerarConversacional|providerConversacionalParaFamilia/,
      );
    }
  });
});
