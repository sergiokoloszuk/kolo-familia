import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * O PREÇO TEM UM DONO SÓ, E O CHECKOUT SE RECUSA A COBRAR ERRADO.
 *
 * Em 20/08/2026, dois defeitos reais em sequência, no mesmo botão:
 *
 *   1. o price do plano "anual" estava como `recurring · month × 1` a
 *      R$ 603,90 — quem clicasse seria cobrado **R$ 603,90 por mês**, com a
 *      tela dizendo "por ano";
 *   2. a primeira correção criou um price `one_time`, que `mode:
 *      "subscription"` recusa — o botão daria erro na cara da mãe.
 *
 * Nenhum dos dois era detectável antes de cobrar, porque nada comparava o que
 * a tela dizia com o que o Stripe faria. Estes testes prendem as três defesas:
 * a trava fail-closed, o espelho que se corrige, e o desconto calculado.
 */

const priceRetrieve = vi.fn();

vi.mock("@/lib/stripe/client", () => ({
  getStripeClient: () => ({ prices: { retrieve: priceRetrieve } }),
  STRIPE_PRICE: { mensal: "price_mensal_x", anual: "price_anual_x" },
}));

const {
  economiaAnual,
  seloEconomiaAnual,
  formatarBRL,
  lerPlanoNoStripe,
  exigirPlanoCobravel,
  sincronizarPlanos,
  RECORRENCIA_ESPERADA,
} = await import("./planos");

/** Os valores REAIS da Kolo em 20/08/2026, para os testes falarem do produto. */
const MENSAL = 5490;
const ANUAL = 60390;

function priceFake(over: Record<string, unknown> = {}) {
  return {
    id: "price_anual_x",
    unit_amount: ANUAL,
    currency: "brl",
    active: true,
    recurring: { interval: "year", interval_count: 1 },
    ...over,
  };
}

beforeEach(() => {
  priceRetrieve.mockReset();
});

describe("o desconto do anual é calculado, nunca escrito", () => {
  it("1. R$ 603,90 contra 12 × R$ 54,90 é 1 mês grátis — não 2, não 20%", () => {
    const e = economiaAnual(MENSAL, ANUAL);
    expect(e).not.toBeNull();
    // 658,80 − 603,90 = 54,90 → exatamente uma mensalidade.
    expect(e!.centavos).toBe(5490);
    expect(e!.meses).toBeCloseTo(1, 5);
    expect(e!.pct).toBeCloseTo(8.333, 2);
    expect(seloEconomiaAnual(MENSAL, ANUAL)).toBe("1 mês grátis");
  });

  it("2. o selo acompanha o preço quando ele muda — não é texto fixo", () => {
    // Um anual de 10 mensalidades passa a dizer 2 meses, sozinho.
    expect(seloEconomiaAnual(MENSAL, MENSAL * 10)).toBe("2 meses grátis");
    // Um desconto quebrado cai para percentual, em vez de mentir em meses.
    expect(seloEconomiaAnual(MENSAL, MENSAL * 12 - 2000)).toMatch(/^Economia de \d+%$/);
  });

  it("3. sem economia, não existe selo (em vez de anunciar desconto negativo)", () => {
    expect(economiaAnual(MENSAL, MENSAL * 12)).toBeNull();
    expect(economiaAnual(MENSAL, MENSAL * 13)).toBeNull();
    expect(seloEconomiaAnual(MENSAL, MENSAL * 13)).toBeNull();
  });

  it("4. valor ausente não vira 'R$ 0,00' na tela", () => {
    expect(formatarBRL(null)).toBeNull();
    expect(formatarBRL(undefined)).toBeNull();
    expect(economiaAnual(null, ANUAL)).toBeNull();
    expect(economiaAnual(MENSAL, null)).toBeNull();
  });

  it("5. formata em pt-BR, em um lugar só", () => {
    expect(formatarBRL(MENSAL)).toMatch(/^R\$\s?54,90$/);
    expect(formatarBRL(ANUAL)).toMatch(/^R\$\s?603,90$/);
  });
});

describe("a trava do checkout (fail-closed)", () => {
  it("6. O CASO QUE ORIGINOU TUDO: anual cobrando por mês é recusado", async () => {
    priceRetrieve.mockResolvedValue(
      priceFake({ recurring: { interval: "month", interval_count: 1 } }),
    );
    const info = await lerPlanoNoStripe("anual");
    expect(info.ok).toBe(false);
    expect(info.problema).toMatch(/deveria cobrar 1× por ano/);
    await expect(exigirPlanoCobravel("anual")).rejects.toThrow(/por ano/);
  });

  it("7. O SEGUNDO CASO REAL: price avulso (one_time) é recusado", async () => {
    priceRetrieve.mockResolvedValue(priceFake({ recurring: null }));
    const info = await lerPlanoNoStripe("anual");
    expect(info.ok).toBe(false);
    expect(info.problema).toMatch(/avulso/);
    await expect(exigirPlanoCobravel("anual")).rejects.toThrow(/avulso/);
  });

  it("8. CASO LEGÍTIMO — o anual correto passa, e devolve o price certo", async () => {
    priceRetrieve.mockResolvedValue(priceFake());
    const info = await exigirPlanoCobravel("anual");
    expect(info.ok).toBe(true);
    expect(info.priceId).toBe("price_anual_x");
    expect(info.intervalo).toBe("year");
    expect(info.centavos).toBe(ANUAL);
  });

  it("9. CASO LEGÍTIMO — o mensal correto passa (a trava não bloqueia demais)", async () => {
    priceRetrieve.mockResolvedValue(
      priceFake({ unit_amount: MENSAL, recurring: { interval: "month", interval_count: 1 } }),
    );
    const info = await exigirPlanoCobravel("mensal");
    expect(info.ok).toBe(true);
    expect(info.intervalo).toBe("month");
  });

  it("10. mensal com recorrência anual também é recusado (o espelho do defeito)", async () => {
    priceRetrieve.mockResolvedValue(
      priceFake({ recurring: { interval: "year", interval_count: 1 } }),
    );
    await expect(exigirPlanoCobravel("mensal")).rejects.toThrow(/por mês/);
  });

  it("11. price arquivado no Stripe é recusado", async () => {
    priceRetrieve.mockResolvedValue(priceFake({ active: false }));
    await expect(exigirPlanoCobravel("anual")).rejects.toThrow(/arquivado/);
  });

  it("12. cobrança a cada 3 meses não passa por 'mensal'", async () => {
    priceRetrieve.mockResolvedValue(
      priceFake({ recurring: { interval: "month", interval_count: 3 } }),
    );
    await expect(exigirPlanoCobravel("mensal")).rejects.toThrow(/3× por month/);
  });

  it("13. Stripe fora do ar recusa em vez de cobrar às cegas", async () => {
    priceRetrieve.mockRejectedValue(new Error("connection error"));
    const info = await lerPlanoNoStripe("anual");
    expect(info.ok).toBe(false);
    expect(info.problema).toMatch(/Não consegui ler/);
    await expect(exigirPlanoCobravel("anual")).rejects.toThrow();
  });

  it("13b. price SEM valor fixo é recusado (o único defeito de valor que resta)", async () => {
    // ⚠️ Não existe teste de "valor incorreto", e a ausência é a prova de que
    // a arquitetura mudou: o valor EXIBIDO passa a ser derivado do valor
    // COBRADO, então não há dois números para divergir. O que sobra é o price
    // sem `unit_amount` (preço graduado/por uso), que não serve para um plano.
    priceRetrieve.mockResolvedValue(priceFake({ unit_amount: null }));
    const info = await lerPlanoNoStripe("anual");
    expect(info.ok).toBe(false);
    expect(info.problema).toMatch(/não tem valor fixo/);
    await expect(exigirPlanoCobravel("anual")).rejects.toThrow(/valor fixo/);
  });

  it("14. a recorrência esperada de cada plano está declarada e é a óbvia", () => {
    expect(RECORRENCIA_ESPERADA.mensal).toBe("month");
    expect(RECORRENCIA_ESPERADA.anual).toBe("year");
  });
});

/** Cliente de banco falso — exercita a função de verdade, sem tocar em produção. */
function supabaseFake(opts: { erro?: string; linhas?: number } = {}) {
  const updates: Record<string, unknown>[] = [];
  const chavesAtualizadas: string[] = [];
  const client = {
    updates,
    chavesAtualizadas,
    from() {
      return {
        update(patch: Record<string, unknown>) {
          updates.push(patch);
          return {
            eq(_col: string, valor: string) {
              chavesAtualizadas.push(valor);
              return {
                select() {
                  const n = opts.linhas ?? 1;
                  return Promise.resolve({
                    data: opts.erro ? null : Array.from({ length: n }, () => ({ chave: valor })),
                    error: opts.erro ? { message: opts.erro } : null,
                  });
                },
              };
            },
          };
        },
      };
    },
  };
  return client;
}

describe("o espelho se corrige sozinho", () => {
  it("15. sincroniza os dois planos e grava valor, recorrência e procedência", async () => {
    priceRetrieve.mockImplementation((id: string) =>
      Promise.resolve(
        id === "price_mensal_x"
          ? priceFake({
              unit_amount: MENSAL,
              recurring: { interval: "month", interval_count: 1 },
            })
          : priceFake(),
      ),
    );
    const db = supabaseFake();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await sincronizarPlanos(db as any);

    expect(r.problemas).toEqual([]);
    expect(r.atualizados.sort()).toEqual(["anual", "mensal"]);
    expect(db.chavesAtualizadas.sort()).toEqual(["plano_anual", "plano_mensal"]);
    const anual = db.updates.find((u) => u.valor_centavos === ANUAL)!;
    expect(anual.intervalo).toBe("year");
    expect(anual.stripe_price_id).toBe("price_anual_x");
    expect(anual.sincronizado_em).toBeTruthy();
  });

  it("16. price quebrado NÃO sobrescreve o último valor bom — vira aviso", async () => {
    priceRetrieve.mockImplementation((id: string) =>
      Promise.resolve(
        id === "price_mensal_x"
          ? priceFake({
              unit_amount: MENSAL,
              recurring: { interval: "month", interval_count: 1 },
            })
          : priceFake({ recurring: { interval: "month", interval_count: 1 } }),
      ),
    );
    const db = supabaseFake();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await sincronizarPlanos(db as any);

    expect(r.atualizados).toEqual(["mensal"]);
    expect(r.problemas).toHaveLength(1);
    expect(r.problemas[0]).toMatch(/anual deveria cobrar 1× por ano/);
    expect(db.chavesAtualizadas).toEqual(["plano_mensal"]);
  });

  it("17. FALHA DE PERSISTÊNCIA: erro do banco vira problema, não sucesso mudo", async () => {
    priceRetrieve.mockResolvedValue(priceFake());
    const db = supabaseFake({ erro: "permission denied" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await sincronizarPlanos(db as any);

    expect(r.atualizados).toEqual([]);
    expect(r.problemas.join(" ")).toMatch(/permission denied/);
  });

  it("18. linha inexistente no espelho é detectada (update que não pegou nada)", async () => {
    priceRetrieve.mockResolvedValue(priceFake());
    const db = supabaseFake({ linhas: 0 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await sincronizarPlanos(db as any);

    expect(r.atualizados).toEqual([]);
    expect(r.problemas.join(" ")).toMatch(/não existe em configuracao_precos/);
  });

  it("19. IDEMPOTÊNCIA: sincronizar duas vezes não muda o resultado", async () => {
    priceRetrieve.mockResolvedValue(priceFake());
    const db = supabaseFake();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const um = await sincronizarPlanos(db as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dois = await sincronizarPlanos(db as any);
    expect(dois.atualizados).toEqual(um.atualizados);
    expect(dois.problemas).toEqual(um.problemas);
  });
});

describe("o leitor sobrevive à migração 0079 ainda não aplicada", () => {
  it("24. colunas novas ausentes: o preço continua aparecendo (não some da tela)", async () => {
    const { lerPlanosParaExibir } = await import("./planos");
    let tentativas = 0;
    const db = {
      from() {
        return {
          select(cols: string) {
            return {
              in() {
                tentativas += 1;
                // A migração não rodou: qualquer coluna nova explode.
                if (cols.includes("stripe_price_id")) {
                  return Promise.resolve({
                    data: null,
                    error: { message: 'column "stripe_price_id" does not exist' },
                  });
                }
                return Promise.resolve({
                  data: [
                    { chave: "plano_mensal", valor_centavos: MENSAL },
                    { chave: "plano_anual", valor_centavos: ANUAL },
                  ],
                  error: null,
                });
              },
            };
          },
          update() {
            return {
              eq() {
                return {
                  select: () =>
                    Promise.resolve({
                      data: null,
                      error: { message: 'column "sincronizado_em" does not exist' },
                    }),
                };
              },
            };
          },
        };
      },
    };

    priceRetrieve.mockResolvedValue(priceFake());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const planos = await lerPlanosParaExibir(db as any);

    expect(tentativas).toBeGreaterThanOrEqual(2); // tentou completo, caiu no mínimo
    expect(planos.mensal.centavos).toBe(MENSAL);
    expect(planos.anual.centavos).toBe(ANUAL);
    // O que ainda não existe vem nulo — e nulo não vira texto na tela.
    expect(planos.anual.intervalo).toBeNull();
    expect(planos.anual.sincronizadoEm).toBeNull();
  });
});

/**
 * GUARDAS DE ESTRUTURA — leem o código-fonte.
 *
 * Testam o texto, não o comportamento, e isso é assumido: prendem decisões
 * estruturais que uma edição futura desfaria sem perceber. É o mesmo padrão de
 * `trial-texto.test.ts`, que existe porque "30 dias grátis" sobreviveu a duas
 * migrações de prazo.
 */
const RAIZ = resolve(__dirname, "../../..");

function arquivosDeProduto(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".next") continue;
    const p = resolve(dir, e.name);
    if (e.isDirectory()) arquivosDeProduto(p, acc);
    else if (/\.(ts|tsx)$/.test(e.name) && !e.name.endsWith(".test.ts")) acc.push(p);
  }
  return acc;
}

describe("nenhum número comercial volta a viver em texto", () => {
  it("20. nenhuma tela afirma percentual de desconto escrito à mão", () => {
    const ofensores: string[] = [];
    for (const arq of arquivosDeProduto(resolve(RAIZ, "src"))) {
      const txt = readFileSync(arq, "utf8");
      // "Economia ~20%", "20% de desconto", "economize 20%"…
      for (const linha of txt.split("\n")) {
        if (linha.trimStart().startsWith("*") || linha.trimStart().startsWith("//")) continue;
        if (/(economia|economize|desconto)[^\n]{0,20}\d{1,2}\s?%/i.test(linha)) {
          ofensores.push(`${arq.replace(RAIZ, "")}: ${linha.trim()}`);
        }
      }
    }
    expect(ofensores).toEqual([]);
  });

  it("21. nenhuma tela afirma 'N meses grátis' escrito à mão", () => {
    const ofensores: string[] = [];
    for (const arq of arquivosDeProduto(resolve(RAIZ, "src"))) {
      if (arq.endsWith("planos.ts")) continue; // é quem CALCULA o texto
      const txt = readFileSync(arq, "utf8");
      for (const linha of txt.split("\n")) {
        if (linha.trimStart().startsWith("*") || linha.trimStart().startsWith("//")) continue;
        if (/["'`~][^"'`]{0,10}\d\s+(mês|meses)\s+gr[áa]tis/i.test(linha)) {
          ofensores.push(`${arq.replace(RAIZ, "")}: ${linha.trim()}`);
        }
      }
    }
    expect(ofensores).toEqual([]);
  });

  it("22. os DOIS caminhos de checkout passam pela trava", () => {
    // Uma trava que vale em um caminho só não vale em nenhum: bastaria a
    // chamada entrar pelo outro para a cobrança errada passar.
    const caminhos = [
      "src/app/(app)/assinatura/actions.ts",
      "src/app/api/stripe/checkout/route.ts",
    ];
    for (const c of caminhos) {
      const txt = readFileSync(resolve(RAIZ, c), "utf8");
      expect(txt, `${c} precisa chamar exigirPlanoCobravel`).toMatch(/exigirPlanoCobravel\(/);
      expect(txt, `${c} não pode montar line_items com price fora da trava`).not.toMatch(
        /line_items:\s*\[\{\s*price:\s*priceIdFor\(/,
      );
    }
  });

  it("23. nenhuma tela consulta configuracao_precos por fora do leitor único", () => {
    const permitidos = ["src/lib/billing/planos.ts"];
    const ofensores: string[] = [];
    for (const arq of arquivosDeProduto(resolve(RAIZ, "src"))) {
      const rel = arq.replace(RAIZ + "\\", "").replace(RAIZ + "/", "").replace(/\\/g, "/");
      if (permitidos.includes(rel)) continue;
      const txt = readFileSync(arq, "utf8");
      if (/\.from\(\s*["'`]configuracao_precos["'`]\s*\)/.test(txt)) ofensores.push(rel);
    }
    expect(ofensores).toEqual([]);
  });
});
