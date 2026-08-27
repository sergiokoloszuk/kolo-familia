import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { textoBoasVindas, jaRecebeuBoasVindas, TIPO_BOAS_VINDAS } from "./boas-vindas";
import { temaParaRetomar, ehRespostaSocial } from "./retomada";

/**
 * A PRIMEIRA MENSAGEM COMO ASSINANTE — os nove cenários.
 *
 * ⚠️ A REGRA EDITORIAL QUE ESTES TESTES PRENDEM: **até 7 dias**, só assunto que
 * a FAMÍLIA trouxe, e na dúvida pergunta aberta. Não é uma escolha de
 * implementação — é a diferença entre a Ayla soar como quem lembra e como quem
 * vasculha problemas antigos para provar memória.
 */

const DIA = 86400000;
const AGORA = Date.parse("2026-08-27T12:00:00Z");

/** Banco falso: devolve o que a consulta encadeada pedir. */
function bancoPlanos(linhas: Array<Record<string, unknown>>) {
  return {
    from() {
      const filtros: Array<[string, unknown]> = [];
      const q: Record<string, unknown> = {
        select: () => q,
        eq: (c: string, v: unknown) => { filtros.push([c, v]); return q; },
        is: (c: string, v: unknown) => { filtros.push([c, v]); return q; },
        gte: (c: string, v: unknown) => { filtros.push([c, v]); return q; },
        order: () => q,
        limit: () => q,
        maybeSingle: () => {
          // O fake ORDENA: a funcao real pede order(created_at, desc), e um
          // fake que ignora isso faria o teste "escolhe o mais recente" provar
          // o contrario do que diz.
          const ok = [...linhas]
            .sort((x, y) => String(y.created_at).localeCompare(String(x.created_at)))
            .filter((l) =>
            filtros.every(([c, v]) => {
              if (c === "created_at") return String(l.created_at) >= String(v);
              return l[c] === v || (v === null && l[c] == null);
            }),
          );
          return Promise.resolve({ data: ok[0] ?? null, error: null });
        },
      };
      return q;
    },
  };
}

function plano(diasAtras: number, extra: Record<string, unknown> = {}) {
  return {
    id: `p-${diasAtras}`,
    family_account_id: "fam",
    tema: "agressividade",
    titulo: "Joelhada no bebê",
    origem: "estrategias",
    resultado: null,
    seguimento_enviado_em: null,
    created_at: new Date(AGORA - diasAtras * DIA).toISOString(),
    ...extra,
  };
}

describe("a mensagem em si", () => {
  it("traz o nome da criança da família real, e não fala de pagamento", () => {
    const t = textoBoasVindas("Pedro");
    expect(t).toContain("sobre Pedro");
    expect(t).toContain("não precisamos começar de novo");
    expect(t).not.toMatch(/pagamento processado|obrigad[ao] por adquirir|bem-vind[ao] ao plano/i);
  });

  it("MORDE: não faz pergunta — abre e espera", () => {
    // Emendar pergunta aqui transformaria o momento em questionário.
    expect(textoBoasVindas("Ana")).not.toContain("?");
  });

  it("sem nome da criança, degrada sem cicatriz no texto", () => {
    expect(textoBoasVindas(null)).toContain("tudo o que fomos construindo,");
    expect(textoBoasVindas(null)).not.toMatch(/sobre\s*,|sobre\s*$/);
  });
});

describe("cenários 1 a 5 — quando retomar, e quando não", () => {
  it("1. conversa de 2 dias + tema aberto → PODE retomar", async () => {
    const r = await temaParaRetomar(bancoPlanos([plano(2)]) as never, "fam", AGORA);
    expect(r?.tema).toBe("agressividade");
  });

  it("2. conversa de 6 dias + tema aberto → PODE retomar", async () => {
    const r = await temaParaRetomar(bancoPlanos([plano(6)]) as never, "fam", AGORA);
    expect(r).not.toBeNull();
  });

  it("3. MORDE: 8 dias → NÃO retoma, mesmo com resultado nulo", async () => {
    // A ausência de resultado NÃO é evidência de assunto pendente. Depois de
    // uma semana, provavelmente significa que ela seguiu a vida.
    const r = await temaParaRetomar(bancoPlanos([plano(8)]) as never, "fam", AGORA);
    expect(r).toBeNull();
  });

  it("4. MORDE: plano de 3 dias com origem `fim_de_semana` → NÃO retoma", async () => {
    // MEDI: 19 dos 179 planos são do cron de sexta, 11 sem resultado. Cobrar
    // isso seria a Ayla perguntando por algo que a família nunca pediu.
    const r = await temaParaRetomar(
      bancoPlanos([plano(3, { origem: "fim_de_semana" })]) as never, "fam", AGORA,
    );
    expect(r).toBeNull();
  });

  it("5. MORDE: assunto já encerrado (tem resultado) → NÃO retoma", async () => {
    const r = await temaParaRetomar(
      bancoPlanos([plano(3, { resultado: "funcionou" })]) as never, "fam", AGORA,
    );
    expect(r).toBeNull();
  });

  it("5b. MORDE: já foi acompanhado antes → NÃO cobra duas vezes", async () => {
    const r = await temaParaRetomar(
      bancoPlanos([plano(3, { seguimento_enviado_em: "2026-08-25T10:00:00Z" })]) as never, "fam", AGORA,
    );
    expect(r).toBeNull();
  });

  it("entre dois candidatos válidos, escolhe o mais recente", async () => {
    const r = await temaParaRetomar(
      bancoPlanos([plano(6, { id: "velho" }), plano(1, { id: "novo" })]) as never, "fam", AGORA,
    );
    expect(r?.planoId).toBe("novo");
  });

  it("MORDE: erro de leitura vira pergunta aberta, nunca exceção", async () => {
    const quebrado = {
      from: () => ({
        select: () => ({ eq: () => ({ eq: () => ({ is: () => ({ is: () => ({ gte: () => ({ order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: { message: "boom" } }) }) }) }) }) }) }) }) }),
      }),
    };
    await expect(temaParaRetomar(quebrado as never, "fam", AGORA)).resolves.toBeNull();
  });
});

describe("cenários 6 a 8 — a resposta dela", () => {
  it("6. MORDE: resposta COM conteúdo → não é social, segue o assunto dela", () => {
    for (const t of [
      "Obrigada! Hoje ele não quis entrar na escola de novo.",
      "obrigada 💜 ela dormiu melhor essa noite",
      "valeu! e sobre a alimentação, o que eu faço?",
    ]) {
      expect(ehRespostaSocial(t), t).toBe(false);
    }
  });

  it("7. resposta só de cortesia → é social", () => {
    for (const t of ["obrigada", "Obrigado!", "valeu", "ok", "tá bom", "combinado",
      "que bom", "ótimo", "muito obrigada mesmo, viu", "de nada", "perfeito"]) {
      expect(ehRespostaSocial(t), t).toBe(true);
    }
  });

  it("8. só emoji → mesma regra", () => {
    for (const t of ["💜", "🙏", "❤️", "obrigada 💜", "🙏🙏"]) {
      expect(ehRespostaSocial(t), t).toBe(true);
    }
  });

  it("MORDE: o viés é conservador — na dúvida, NÃO é social", () => {
    // Um falso positivo faria a Ayla ignorar o que a mãe acabou de contar para
    // disparar pergunta automática. É o pior comportamento possível aqui.
    expect(ehRespostaSocial("")).toBe(false);
    expect(ehRespostaSocial(null)).toBe(false);
    expect(ehRespostaSocial("obrigada, mas ele piorou muito essa semana e eu não sei o que fazer")).toBe(false);
    expect(ehRespostaSocial("crise")).toBe(false);
    expect(ehRespostaSocial("sono")).toBe(false);
  });
});

describe("cenário 9 — idempotência", () => {
  const banco = (linhas: unknown[], erro: unknown = null) => ({
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: linhas, error: erro }) }) }) }) }),
    }),
  });

  it("9. família já recebida → não manda de novo", async () => {
    expect(await jaRecebeuBoasVindas(banco([{ id: "x" }]) as never, "fam")).toBe(true);
  });

  it("família nunca recebida → pode mandar", async () => {
    expect(await jaRecebeuBoasVindas(banco([]) as never, "fam")).toBe(false);
  });

  it("MORDE: erro de leitura responde 'já recebeu' — silêncio é melhor que repetir", async () => {
    // Errar para o lado do silêncio custa uma mensagem que não sai. Para o
    // outro lado, a família é recebida duas vezes — e isso quebra justamente a
    // promessa de continuidade que a mensagem faz.
    expect(await jaRecebeuBoasVindas(banco([], { message: "boom" }) as never, "fam")).toBe(true);
  });

  it("MORDE: a idempotência não depende de janela de tempo", async () => {
    // Renovação, webhook repetido e reconciliador acontecem em dias diferentes.
    // Se a pergunta fosse "mandei hoje?", todos os três repetiriam.
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("./boas-vindas.ts", import.meta.url), "utf8"),
    );
    const corpo = src.slice(src.indexOf("export async function jaRecebeuBoasVindas"));
    expect(corpo).not.toMatch(/gte|created_at|startOfDay|hoje/i);
    // a funcao usa a CONSTANTE, nao o literal — e isso que se prende.
    expect(corpo).toContain("TIPO_BOAS_VINDAS");
  });
});

describe("a fiação — uma regra, dois chamadores", () => {
  const raiz = process.cwd();
  const ler = (p: string) => readFileSync(join(raiz, "src", p), "utf8");
  const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

  it("MORDE: webhook E reconciliador chamam a MESMA função", () => {
    // "Não criar duas implementações diferentes da regra." Duas cópias da mesma
    // decisão sempre divergem — foi assim que o D7 foi corrigido e a conversa
    // reativa continuou errada por um dia.
    for (const arq of ["app/api/stripe/webhook/route.ts", "lib/stripe/reconciliacao.ts"]) {
      const src = semComentarios(ler(arq));
      expect(src, arq).toMatch(/talvezReceberComoAssinante\(/);
      // …e nenhum dos dois tem regra própria de idempotência.
      expect(src, arq).not.toMatch(/assinante_boas_vindas["']/);
    }
  });

  it("MORDE: o webhook manda DEPOIS da escrita conferida, nunca antes", () => {
    // Mandar "sua assinatura já está ativa" sobre uma escrita que não pegou
    // seria dizer isso para quem continua bloqueada.
    // ⚠️ ESTE TESTE JÁ NASCEU FRACO UMA VEZ: procurava `conferirEscrita` com
    // `indexOf`, que acha o **import** no topo do arquivo — então o índice era
    // sempre pequeno e a comparação sempre passava. Movi a chamada para antes
    // da escrita e o teste continuou verde. Agora ele ancora na CHAMADA
    // (`await conferirEscrita(`), e a prova de mutação é de verdade.
    const src = semComentarios(ler("app/api/stripe/webhook/route.ts"));
    const iEscrita = src.indexOf("await conferirEscrita(");
    const iMsg = src.indexOf("talvezReceberComoAssinante(admin");
    expect(iEscrita, "a escrita conferida sumiu").toBeGreaterThan(-1);
    expect(iMsg, "a chamada da mensagem sumiu").toBeGreaterThan(-1);
    expect(iMsg).toBeGreaterThan(iEscrita);
  });

  it("MORDE: só manda se o pagamento foi RECONHECIDO", () => {
    const src = semComentarios(ler("app/api/stripe/webhook/route.ts"));
    const i = src.indexOf("talvezReceberComoAssinante(");
    expect(src.slice(Math.max(0, i - 40), i)).toMatch(/if \(pago\)/);
  });

  it("MORDE: a função confere o estado antes de mandar", () => {
    const src = semComentarios(ler("lib/assinatura/boas-vindas.ts"));
    const i = src.indexOf("export async function talvezReceberComoAssinante");
    const corpo = src.slice(i);
    expect(corpo).toMatch(/status\s*!==\s*"active"/);
    expect(corpo).toMatch(/jaRecebeuBoasVindas/);
    expect(corpo).toMatch(/reservarEnvioProativo/);
    // ⚠️ Nunca lança: o pagamento não pode falhar porque a mensagem não saiu.
    expect(corpo).toMatch(/catch/);
  });
});
