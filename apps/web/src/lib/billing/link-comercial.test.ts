import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { notaComercial, precisaDeHumano, ehPerguntaComercial } from "./destino-comercial";

/**
 * "QUERO PAGAR" NÃO PODE RECEBER A PÁGINA QUE VENDE TESTE — 27/08/2026.
 *
 * ⚠️ O TURNO REAL, em produção, 15:18. Karina: *"Não, eu quero pagar, eu quero
 * assinar."* A Ayla respondeu com `kolo-familia-web.vercel.app/precos` — a
 * página pública, que sem sessão abre com "7 dias grátis" e "Começar 7 dias
 * grátis" → `/signup`. Intenção de compra explícita, de uma família que a Kolo
 * conhece pelo número, mandada para o começo do funil.
 *
 * ⚠️ E A CORREÇÃO DO D7 NÃO ALCANÇAVA ISTO. Lá o caminho é o template
 * proativo; aqui é a conversa reativa. Mesma decisão, dois arquivos. Agora há
 * uma função só (`link-comercial.ts`) e os dois lados a chamam.
 */

const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, "src", p), "utf8");
/** Sem comentários: uma menção em JSDoc não pode passar por implementação. */
const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("1. nenhum canal manda /precos para família identificada", () => {
  const CANAIS: Array<[string, string]> = [
    ["WhatsApp Oficial", "lib/ayla/experimental.ts"],
    ["WhatsApp Legacy", "lib/ayla/responder.ts"],
    ["Web", "lib/ia/prompt.ts"],
  ];

  for (const [rot, arq] of CANAIS) {
    it(`MORDE: ${rot} não usa linkPlanos() na nota comercial`, () => {
      // ⚠️ A JANELA COBRE A ATRIBUIÇÃO, não só a chamada. O Oficial passa por
      // uma variável (`const linkComercial = await …`), então olhar só o que
      // está entre os parênteses de `notaComercial(` deixaria passar tudo.
      const src = semComentarios(ler(arq));
      const i = src.indexOf("notaComercial(");
      expect(i, `${arq}: notaComercial sumiu`).toBeGreaterThan(-1);
      const janela = src.slice(Math.max(0, i - 400), src.indexOf(")", i) + 1);
      expect(janela, `${arq}`).not.toMatch(/linkPlanos/);
      expect(janela, `${arq}`).toMatch(/linkComercialAutenticado|linkAssinatura/);
    });
  }

  it("MORDE: os dois canais de WhatsApp mandam para /assinatura", () => {
    for (const arq of ["lib/ayla/experimental.ts", "lib/ayla/responder.ts"]) {
      const src = semComentarios(ler(arq));
      const i = src.indexOf("notaComercial(");
      const chamada = src.slice(i, src.indexOf(")", i) + 1);
      expect(chamada, arq).not.toMatch(/"\/precos"|precos/);
    }
  });
});

describe("2. a nota entrega o link que recebeu", () => {
  it("o link do parâmetro aparece no texto", () => {
    expect(notaComercial("https://k/auth/wa?k=TOK")).toContain("https://k/auth/wa?k=TOK");
  });

  it("MORDE: sem link, degrada — não inventa rota", () => {
    const nota = notaComercial(null);
    expect(nota).not.toMatch(/https?:\/\//);
    expect(nota).not.toMatch(/\/precos|\/signup|\/assinatura/);
  });

  it("MORDE: o degrau sem token NUNCA volta para /precos", () => {
    // Um fallback "seguro" para a página pública seria o defeito voltando pela
    // porta dos fundos, e justo quando algo já falhou.
    const src = semComentarios(ler("lib/billing/link-comercial.ts"));
    expect(src).not.toMatch(/\/precos/);
    expect(src).not.toMatch(/linkPlanos/);
    expect(src).toMatch(/criarLinkAcesso/);
    expect(src).toMatch(/linkAssinatura/);
  });

  it("MORDE: há UM dono do link comercial — o do fim de teste reusa o mesmo", () => {
    // Duas cópias da mesma decisão sempre divergem: foi assim que o D7 foi
    // corrigido em 26/08 e a conversa continuou errada até 27/08.
    const src = semComentarios(ler("lib/ayla/messageTemplates.ts"));
    expect(src).toMatch(/linkComercialAutenticado/);
    expect(src).not.toMatch(/async function linkDeFimDeTeste/);
  });
});

describe("3. quem JÁ PAGOU vai para suporte, nunca para venda", () => {
  const JA_PAGOU = [
    "eu paguei e continua pedindo pra assinar",
    "fiz o pagamento mas não liberou meu acesso",
    "assinei e ainda está bloqueado",
    "o pagamento foi aprovado e continua igual",
    "paguei ontem e sigo sem acesso",
  ];
  for (const t of JA_PAGOU) {
    it(`MORDE: "${t.slice(0, 34)}…" → humano`, () => {
      expect(precisaDeHumano(t), t).toBe(true);
    });
  }

  it("MORDE: quem já pagou NÃO recebe link comercial junto", () => {
    // ⚠️ Corrigir só `precisaDeHumano` resolvia metade: a frase saía como
    // comercial E suporte ao mesmo tempo, e a Ayla mandava o contato do time
    // E um link para assinar, no mesmo turno. Para quem acabou de pagar, o
    // link é a pior resposta — sugere que o pagamento não valeu.
    for (const t of JA_PAGOU) {
      expect(ehPerguntaComercial(t), t).toBe(false);
      expect(precisaDeHumano(t), t).toBe(true);
    }
  });

  it("MORDE: quem QUER pagar não vira suporte — é venda", () => {
    // O caso legítimo que não pode ser bloqueado (§12, caso I). Confundir os
    // dois mandaria quem quer comprar para uma fila humana que não existe.
    for (const t of ["quero pagar", "quero assinar", "onde eu assino?", "me manda o link pra assinar"]) {
      expect(precisaDeHumano(t), t).toBe(false);
      expect(ehPerguntaComercial(t), t).toBe(true);
    }
  });

  it("MORDE: pagar OUTRA coisa não vira suporte", () => {
    // Estas frases estão na base. "eu pago caro por este acompanhamento" é de
    // uma mãe falando da médica da filha — viraria falso positivo fácil.
    for (const t of [
      "eu pago caro por este acompanhamento, mas só me sinto segura assim",
      "não tenho condições de pagar a fono",
      "já paguei um ano de curso pra ele",
    ]) {
      expect(precisaDeHumano(t), t).toBe(false);
    }
  });
});

describe("4. informação de preço continua funcionando", () => {
  it('"quanto custa?" segue sendo comercial, não suporte', () => {
    expect(ehPerguntaComercial("quanto custa?")).toBe(true);
    expect(precisaDeHumano("quanto custa?")).toBe(false);
  });

  it("a nota comercial segue proibindo empurrar preço para o suporte", () => {
    expect(notaComercial(null).toLowerCase()).toContain("não mande procurar suporte");
  });
});
