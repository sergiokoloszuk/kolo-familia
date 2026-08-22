import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  ehPerguntaComercial,
  precisaDeHumano,
  linkPlanos,
  origemCanonica,
  notaComercial,
  notaSuporte,
  WHATSAPP_SUPORTE,
} from "./destino-comercial";

/**
 * O DESTINO COMERCIAL — e o que ele não pode confundir.
 *
 * Metade destes testes prova uma NEGATIVA, e é de propósito: o risco desta
 * frente não é só deixar de mandar o link (perda de conversão), é jogar link
 * de preço no meio de uma conversa sobre a criança (perda de confiança).
 *
 * As negativas não são inventadas — vêm do vocabulário real da Kolo, medido em
 * conversas de produção: "plano" é o material estratégico, "cartão" é da rotina
 * visual, "valor" costuma ser o valor da mãe como mãe.
 */

describe("intenção comercial — as que TÊM que pegar", () => {
  const pega = [
    // as oito exigidas na missão
    "quanto custa?",
    "quanto é?",
    "quais são os planos?",
    "quero assinar",
    "onde assino?",
    "como assino?",
    "me manda o link",
    "quero continuar depois do teste",
    // as que a auditoria mediu falhando
    "quero ser assinante",
    "queria contratar",
    "quais planos vocês tem",
    "onde eu assino",
    "manda o link de pagamento",
    "quero continuar",
    // as que o gatilho antigo já pegava — não podem regredir
    "Qual valor?",
    "qual o valor",
    "Quanto custa?",
    "quanto fica por mês",
    "tem desconto?",
    "não consigo nenhum cupom de desconto pra assinar?",
    "como faço pra assinar",
    "qual o preço do app",
    "isso é grátis?",
    "vou ter que pagar depois?",
    "quero saber os valores do plano",
    "a mensalidade é quanto",
    "quando começa a cobrança?",
  ];
  for (const t of pega) {
    it(`pega: "${t}"`, () => expect(ehPerguntaComercial(t)).toBe(true));
  }
});

describe("intenção comercial — as que NÃO podem virar venda", () => {
  const ignora = [
    // as três exigidas na missão
    "meu filho não quer assinar o caderno",
    "qual o plano para melhorar o sono?",
    "quanto tempo espero antes de tentar novamente?",
    // o vocabulário normal da Kolo (vinham do teste do gatilho antigo)
    "ele adora os cartões da rotina",
    "posso imprimir o cartão do banho?",
    "ela não enxerga o valor dela como mãe",
    "isso não tem valor nenhum pra ele",
    "vale a pena insistir na fono?",
    "o quanto ele se esforça pra falar",
    "quanto tempo antes eu aviso ele?",
    "o plano que você montou ajudou demais",
    "quero um plano sobre o sono",
    // links que não são de venda
    "me manda o link do vídeo",
    "manda o link da rotina dele",
    "qual o link do relatório?",
    // continuar outra coisa
    "quero continuar a terapia dele",
    "quero continuar tentando em casa",
    "quero continuar a rotina do banho",
    // assinar papel
    "ela precisa assinar a autorização da escola",
    "não quero assinar esse laudo sem entender",
    "",
  ];
  for (const t of ignora) {
    it(`ignora: "${t || "(vazio)"}"`, () => expect(ehPerguntaComercial(t)).toBe(false));
  }
});

describe("suporte humano — quando é caso de gente", () => {
  const humano = [
    "quero falar com uma pessoa",
    "queria falar com alguém do time",
    "tem alguém aí que possa me ajudar?",
    "estou tentando pagar e aparece um erro que não consigo resolver",
    "meu cartão foi recusado",
    "fui cobrado duas vezes",
    "não consigo entrar no app, não carrega",
    "quero um reembolso",
  ];
  for (const t of humano) {
    it(`humano: "${t}"`, () => expect(precisaDeHumano(t)).toBe(true));
  }

  /** A regra de produto desta frente, em forma de teste. */
  const naoHumano = [
    "quanto custa?",
    "onde assino?",
    "quais são os planos?",
    "me manda o link",
    "quero assinar",
    "como funciona a rotina visual?",
    "o Lorenzo não quer tomar banho",
  ];
  for (const t of naoHumano) {
    it(`NÃO é suporte: "${t}"`, () => expect(precisaDeHumano(t)).toBe(false));
  }
});

describe("preço nunca vira suporte", () => {
  const comerciais = ["quanto custa?", "onde assino?", "quais são os planos?", "me manda o link"];
  for (const t of comerciais) {
    it(`"${t}" → comercial, não humano`, () => {
      expect(ehPerguntaComercial(t)).toBe(true);
      expect(precisaDeHumano(t)).toBe(false);
    });
  }

  it("erro ao pagar é humano, mesmo falando de pagamento", () => {
    const t = "estou tentando pagar e aparece um erro que não consigo resolver";
    expect(precisaDeHumano(t)).toBe(true);
  });
});

describe("o destino é único e absoluto", () => {
  it("o link de Planos sai da origem canônica e aponta para /precos", () => {
    const origem = origemCanonica();
    const link = linkPlanos();
    if (origem) {
      expect(link).toBe(`${origem}/precos`);
      expect(link!.startsWith("http")).toBe(true);
    } else {
      expect(link).toBeNull();
    }
  });

  it("nunca oferece o magic link como destino comercial", () => {
    expect(notaComercial()).not.toContain("/auth/wa");
    expect(linkPlanos() ?? "").not.toContain("/auth/wa");
  });

  it("a nota comercial proíbe mandar para o suporte", () => {
    expect(notaComercial().toLowerCase()).toContain("não mande procurar suporte");
  });

  it("a nota de suporte carrega o contato — nunca manda procurar sem dizer onde", () => {
    expect(notaSuporte()).toContain(WHATSAPP_SUPORTE);
  });
});

// ============================================================
// Os dois canais — a mesma decisão, da mesma fonte
// ============================================================

describe("WhatsApp e Web resolvem pela MESMA fonte", () => {
  const RAIZ = join(process.cwd(), "src");
  const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8");
  const semComentarios = (p: string) =>
    ler(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

  const CANAIS = ["lib/ayla/responder.ts", "lib/ia/prompt.ts"];

  for (const canal of CANAIS) {
    it(`${canal} importa a fonte canônica`, () => {
      expect(semComentarios(canal)).toContain('from "@/lib/billing/destino-comercial"');
    });
    it(`${canal} decide comercial pela fonte, não por regex próprio`, () => {
      const src = semComentarios(canal);
      expect(src).toContain("ehPerguntaComercial");
      expect(src).toContain("notaComercial");
    });
    it(`${canal} decide suporte pela fonte`, () => {
      const src = semComentarios(canal);
      expect(src).toContain("precisaDeHumano");
      expect(src).toContain("notaSuporte");
    });
    it(`${canal} não constrói URL de preço à mão`, () => {
      expect(semComentarios(canal)).not.toMatch(/["'`]\/precos["'`]/);
    });
  }

  it("o gatilho antigo do WhatsApp não existe mais", () => {
    expect(semComentarios("lib/ayla/responder.ts")).not.toContain("PERGUNTA_DE_PRECO");
  });

  it("o telefone do suporte não está escrito à mão em prompt nenhum", () => {
    for (const a of [...CANAIS, "lib/conducao/diretrizes.ts", "lib/billing/fatos-comerciais.ts"]) {
      expect(semComentarios(a), a).not.toContain("94037-7337");
    }
    // …e o Core o recebe da fonte, por interpolação.
    expect(semComentarios("lib/conducao/diretrizes.ts")).toContain("${WHATSAPP_SUPORTE}");
  });

  it("o Core deixou de mandar preço para o suporte", () => {
    const core = ler("lib/conducao/diretrizes.ts");
    expect(core).toContain("NÃO são humano");
    expect(core).not.toContain("o time responde pelo suporte dentro do app e pelo e-mail de contato");
  });
});
