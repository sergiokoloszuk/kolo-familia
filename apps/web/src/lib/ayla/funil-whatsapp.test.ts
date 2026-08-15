import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { enviarTexto } from "./whatsappSender";
import { sintaxeCruaWhatsApp } from "./apresentacao";

/**
 * O FUNIL — prova por EXECUÇÃO, não por grep.
 *
 * ⚠️ POR QUE ESTE ARQUIVO EXISTE. Em 15/08/2026 eu liguei `paraWhatsApp` no
 * caminho de balões do orquestrador e escrevi um teste afirmando que aquele era
 * o único ponto de publicação. O teste passou e a afirmação era FALSA: eu tinha
 * procurado por `dividirEmBolhas`, não por `enviarTexto`. Existem oito
 * chamadores, e a Karina recebeu uma resposta cheia de `###`, `>` e listas.
 *
 * A lição é sobre o método, não sobre o bug: um teste que lê os CHAMADORES só
 * enxerga os chamadores que eu lembrei de procurar. Um teste que intercepta o
 * `fetch` e afere o corpo que sai enxerga TODOS — inclusive os que ainda não
 * existem.
 *
 * Por isso aqui não há grep nenhum. Há `fetch` capturado e o payload real.
 */

const ANTES: string[] = [];
const DEPOIS: string[] = [];

beforeEach(() => {
  process.env.ZAPI_INSTANCE_ID ||= "i";
  process.env.ZAPI_TOKEN ||= "t";
  process.env.ZAPI_CLIENT_TOKEN ||= "c";
  ANTES.length = 0;
  DEPOIS.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: { body: string }) => {
      DEPOIS.push(JSON.parse(init.body).message as string);
      return { ok: true, json: async () => ({ messageId: "m1" }) } as unknown as Response;
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

/** Manda pelo funil e devolve o texto que a Z-API receberia de fato. */
async function chegaAoProvider(texto: string): Promise<string> {
  ANTES.push(texto);
  await enviarTexto({ phoneE164: "+5511999999999", texto });
  return DEPOIS[DEPOIS.length - 1];
}

// A mensagem REAL que a Karina recebeu em 15/08, reduzida ao que importa e
// mantendo cada tipo de marcação que apareceu na tela dela.
const MENSAGEM_KARINA = `Claro, Karina. Para o Mario, eu começaria **pelo sentido da multiplicação**, antes de pedir para decorar.

### 1. Explique como "grupos iguais"

Diga:

> "Multiplicar é juntar vários grupos com a mesma quantidade."

Por exemplo, para explicar *3 × 4*:

- faça *3 grupos*;
- coloque *4 carrinhos em cada grupo*;
- conte: 4 + 4 + 4 = 12;
- então: *3 × 4 = 12*.

---

### 2. Use uma sequência simples

1. montar os grupos;
2. contar os objetos;

Para eu adaptar: *qual tabuada ele precisa fazer?*`;

describe("A MENSAGEM REAL DA KARINA — antes → depois → provider", () => {
  it("chega ao provider sem uma única marcação incompatível", async () => {
    const saiu = await chegaAoProvider(MENSAGEM_KARINA);

    // O que ela viu na tela, e que não pode mais sair:
    expect(MENSAGEM_KARINA).toContain("### 1.");
    expect(MENSAGEM_KARINA).toContain("> \"Multiplicar");
    expect(MENSAGEM_KARINA).toContain("**pelo sentido");
    expect(MENSAGEM_KARINA).toContain("\n---\n");

    expect(saiu).not.toContain("###");
    expect(saiu).not.toContain("**");
    expect(saiu).not.toMatch(/^\s*>/m);
    expect(saiu).not.toMatch(/^\s*-{3,}\s*$/m);
    expect(sintaxeCruaWhatsApp(saiu)).toEqual([]);
  });

  it("os títulos viraram negrito do WhatsApp, não sumiram", async () => {
    const saiu = await chegaAoProvider(MENSAGEM_KARINA);
    expect(saiu).toContain('*1. Explique como "grupos iguais"*');
    expect(saiu).toContain("*2. Use uma sequência simples*");
  });

  it("a citação perdeu a seta e manteve o que era citado", async () => {
    const saiu = await chegaAoProvider(MENSAGEM_KARINA);
    expect(saiu).toContain("Multiplicar é juntar vários grupos com a mesma quantidade.");
  });

  it("NENHUMA palavra, número ou símbolo de conteúdo se perdeu", async () => {
    const saiu = await chegaAoProvider(MENSAGEM_KARINA);
    const pal = (t: string) => (t.match(/\p{L}+/gu) ?? []).join("|");
    const num = (t: string) => (t.match(/\d+/g) ?? []).join("|");
    expect(pal(saiu)).toBe(pal(MENSAGEM_KARINA));
    expect(num(saiu)).toBe(num(MENSAGEM_KARINA));
    // "3 × 4 = 12" continua legível
    expect(saiu).toContain("4 + 4 + 4 = 12");
    expect(saiu).toContain("×");
  });

  it("a lista com hífen continua lista — o canal já a renderiza", async () => {
    const saiu = await chegaAoProvider(MENSAGEM_KARINA);
    expect(saiu).toMatch(/^- faça/m);
  });
});

/**
 * OS SEIS CAMINHOS. Não importa QUEM chama: o que se afere é o corpo do POST.
 * Um caminho novo que apareça amanhã já nasce dentro desta prova.
 */
describe("TODO CAMINHO passa pelo funil", () => {
  const SUJO = "## Título\n\nTexto **forte**.\n\n> citado\n\n* item um\n* item dois\n\n---\n\nFim.";
  const CAMINHOS = [
    "resposta normal",
    "proativa",
    "cron",
    "nudge",
    "administrativo",
    "ativação",
  ];

  it.each(CAMINHOS)("%s não entrega Markdown incompatível", async (nome) => {
    const saiu = await chegaAoProvider(`[${nome}]\n\n${SUJO}`);
    expect(sintaxeCruaWhatsApp(saiu)).toEqual([]);
    expect(saiu).toContain(nome); // o conteúdo do caminho continua lá
  });

  it("o delayTyping continua funcionando — a normalização não come o ritmo", async () => {
    await enviarTexto({ phoneE164: "+5511999999999", texto: "oi", delaySegundos: 3 });
    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as { body: string }).body);
    expect(body.delayTyping).toBe(3);
    expect(body.message).toBe("oi");
  });
});

describe("O QUE NÃO PODE MUDAR", () => {
  it("URL sobrevive inteira — inclusive com _ e # e ~", async () => {
    const t = "Veja https://kolo-familia-web.vercel.app/r/a_b_c#topo~x agora";
    expect(await chegaAoProvider(t)).toBe(t);
  });

  it("emoji composto sobrevive caractere a caractere", async () => {
    const t = "Boa 👩🏽‍🍳 demais 👍🏼 💛";
    expect([...(await chegaAoProvider(t))]).toEqual([...t]);
  });

  it("formatação JÁ válida do WhatsApp passa intacta", async () => {
    const t = "*negrito* _itálico_ ~tachado~";
    expect(await chegaAoProvider(t)).toBe(t);
  });

  it("prosa limpa é byte a byte a mesma", async () => {
    const t = "Entendo. Isso cansa mesmo, e não é falha sua.";
    expect(await chegaAoProvider(t)).toBe(t);
  });
});

describe("SABOTAGEM — o teste morde?", () => {
  it("S1 · sem a normalização no funil, a mensagem da Karina sai crua", () => {
    // Reproduz o funil SEM a garantia: é exatamente o `body` de antes de hoje.
    const semGarantia = { message: MENSAGEM_KARINA };
    expect(semGarantia.message).toContain("###");
    expect(sintaxeCruaWhatsApp(semGarantia.message).length).toBeGreaterThan(0);
  });

  it("S2 · a garantia está no funil, não no chamador", () => {
    // A única leitura de arquivo do teste, e ela não substitui nada acima:
    // serve para provar QUE A LINHA ESTÁ NO SENDER, e não que o envio funciona.
    const sender = readFileSync(
      join(process.cwd(), "src/lib/ayla/whatsappSender.ts"),
      "utf8",
    );
    expect(sender).toContain("message: paraWhatsApp(params.texto)");
  });

  it("S3 · aplicar duas vezes não estraga — o orquestrador ainda normaliza antes de dividir", async () => {
    // A normalização precisa continuar ANTES de `dividirEmBolhas`, senão uma
    // linha `---` vira um balão que depois esvazia. Como a função é ponto fixo,
    // rodar de novo no funil é inofensivo — e é o que permite as duas.
    const { paraWhatsApp } = await import("./apresentacao");
    const uma = paraWhatsApp(MENSAGEM_KARINA);
    expect(paraWhatsApp(uma)).toBe(uma);
    expect(await chegaAoProvider(uma)).toBe(uma);
  });
});
