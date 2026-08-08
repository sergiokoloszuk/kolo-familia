import { describe, it, expect, beforeEach, vi } from "vitest";
import { assinaturaLiberada } from "@/lib/auth/assinatura";

/**
 * PAGOU E NÃO RECEBEU ACESSO — a classe de falha do incidente Rochelle.
 *
 * Estes testes exercitam a ROTA de verdade (não as funções soltas), com um
 * banco falso em memória e um Stripe falso, e medem COMPORTAMENTO OBSERVÁVEL:
 * o estado final da linha, o código HTTP da resposta e se o acesso — pela
 * regra única `assinaturaLiberada` — ficou liberado ou não.
 *
 * Duas coisas estão sendo protegidas aqui, e elas puxam em direções opostas:
 *
 *   1. um evento transitório (`incomplete`, que aparece em TODO checkout) não
 *      pode tirar acesso de ninguém;
 *   2. um evento negativo de verdade (`invoice.payment_failed`,
 *      `subscription.deleted`) tem que continuar tirando.
 *
 * Uma correção que só olhasse a primeira quebraria o dunning em silêncio.
 */

// ============================================================
// BANCO FALSO — em memória, com os mesmos modos de falha do Supabase:
// devolve `error` em vez de lançar, e um UPDATE que não casa com ninguém
// devolve zero linhas sem erro nenhum.
// ============================================================

type Linha = Record<string, unknown>;
type ErroFalso = { message: string; code?: string };

function criarBanco(subscriptionAccesses: Linha[] = []) {
  const tabelas: Record<string, Linha[]> = {
    subscription_accesses: subscriptionAccesses,
    assinaturas: [],
  };
  let erroProgramado: { tabela: string; restantes: number; erro: ErroFalso } | null = null;

  function consumirErro(tabela: string): ErroFalso | null {
    if (!erroProgramado || erroProgramado.tabela !== tabela) return null;
    erroProgramado.restantes -= 1;
    const erro = erroProgramado.erro;
    if (erroProgramado.restantes <= 0) erroProgramado = null;
    return erro;
  }

  function from(tabela: string) {
    const filtros: Array<(l: Linha) => boolean> = [];
    let acao: { tipo: "select" | "update" | "insert"; patch?: Linha; novos?: Linha[] } = {
      tipo: "select",
    };

    const alvos = () => (tabelas[tabela] ?? []).filter((l) => filtros.every((f) => f(l)));

    async function executar() {
      const erro = consumirErro(tabela);
      if (erro) return { data: null, error: erro };

      if (acao.tipo === "update") {
        const casadas = alvos();
        for (const l of casadas) Object.assign(l, acao.patch);
        return { data: casadas.map((l) => ({ family_account_id: l.family_account_id })), error: null };
      }
      if (acao.tipo === "insert") {
        const novos = acao.novos ?? [];
        for (const novo of novos) {
          const jaExiste = (tabelas[tabela] ?? []).some(
            (l) => l.stripe_event_id === novo.stripe_event_id,
          );
          if (jaExiste) {
            return {
              data: null,
              error: {
                message: 'duplicate key value violates unique constraint "assinaturas_stripe_event_id_key"',
                code: "23505",
              },
            };
          }
          tabelas[tabela].push({ id: `row_${tabelas[tabela].length + 1}`, ...novo });
        }
        return { data: novos.map((_, i) => ({ id: `row_${i}` })), error: null };
      }
      return { data: alvos().map((l) => ({ ...l })), error: null };
    }

    const builder = {
      select: () => builder,
      update(patch: Linha) {
        acao = { tipo: "update", patch };
        return builder;
      },
      insert(novos: Linha | Linha[]) {
        acao = { tipo: "insert", novos: Array.isArray(novos) ? novos : [novos] };
        return builder;
      },
      eq(coluna: string, valor: unknown) {
        filtros.push((l) => l[coluna] === valor);
        return builder;
      },
      is(coluna: string, valor: unknown) {
        filtros.push((l) => (valor === null ? l[coluna] == null : l[coluna] === valor));
        return builder;
      },
      maybeSingle: async () => ({ data: alvos()[0] ?? null, error: null }),
      then: (resolver: (v: unknown) => unknown, rejeitar?: (e: unknown) => unknown) =>
        executar().then(resolver, rejeitar),
    };
    return builder;
  }

  return {
    from,
    tabelas,
    linha: (familyId: string) =>
      tabelas.subscription_accesses.find((l) => l.family_account_id === familyId),
    falharProxima(tabela: string, erro: ErroFalso, vezes = 1) {
      erroProgramado = { tabela, restantes: vezes, erro };
    },
  };
}

let banco = criarBanco();
const assinaturasStripe = new Map<string, Record<string, unknown>>();
const logs: Array<{ kind: string; severity?: string; message?: string }> = [];

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => banco,
}));

vi.mock("@/lib/stripe/client", () => ({
  getStripeClient: () => ({
    webhooks: {
      // Assinatura já validada no ambiente real; aqui o corpo é o próprio evento.
      constructEvent: (body: string) => JSON.parse(body),
    },
    subscriptions: {
      retrieve: async (id: string) => {
        const sub = assinaturasStripe.get(id);
        if (!sub) throw new Error(`assinatura ${id} não existe no Stripe falso`);
        return sub;
      },
    },
  }),
}));

vi.mock("@/lib/log", () => ({
  logEvent: async (e: { kind: string; severity?: string; message?: string }) => {
    logs.push(e);
  },
  logServerError: async (kind: string, err: unknown) => {
    logs.push({ kind, severity: "error", message: err instanceof Error ? err.message : "erro" });
  },
}));

const { POST } = await import("./route");

// ============================================================
// FIXTURES
// ============================================================

const FAMILIA = "11111111-1111-4111-8111-111111111111";
const CLIENTE = "cus_teste";
const ASSINATURA = "sub_teste";

const AGORA = Date.now();
const DIA = 24 * 60 * 60 * 1000;
const ONTEM = new Date(AGORA - DIA).toISOString();
const DAQUI_A_5_DIAS = new Date(AGORA + 5 * DIA).toISOString();
const DAQUI_A_UM_MES = Math.floor((AGORA + 30 * DIA) / 1000);

function linhaTrial(opcoes: { vencido: boolean }): Linha {
  return {
    family_account_id: FAMILIA,
    status: "trialing",
    trial_ends_at: opcoes.vencido ? ONTEM : DAQUI_A_5_DIAS,
    current_period_end: null,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    cancel_at_period_end: false,
    pagamento_falhou_em: null,
    cortesia: false,
    cortesia_ate: null,
  };
}

function registrarNoStripe(status: string, familyId: string | null = FAMILIA) {
  assinaturasStripe.set(ASSINATURA, {
    id: ASSINATURA,
    status,
    customer: CLIENTE,
    current_period_end: DAQUI_A_UM_MES,
    cancel_at_period_end: false,
    metadata: familyId ? { family_account_id: familyId } : {},
    items: { data: [{ current_period_end: DAQUI_A_UM_MES }] },
  });
}

let seqEvento = 0;
function idEvento() {
  seqEvento += 1;
  return `evt_${seqEvento}`;
}

function eventoCheckout(opcoes: { familyId?: string | null; pago?: boolean; id?: string } = {}) {
  const familyId = opcoes.familyId === undefined ? FAMILIA : opcoes.familyId;
  return {
    id: opcoes.id ?? idEvento(),
    type: "checkout.session.completed",
    data: {
      object: {
        metadata: familyId ? { family_account_id: familyId } : {},
        client_reference_id: familyId,
        customer: CLIENTE,
        subscription: ASSINATURA,
        payment_status: opcoes.pago === false ? "unpaid" : "paid",
      },
    },
  };
}

function eventoAssinatura(status: string, opcoes: { tipo?: string; familyId?: string | null; id?: string } = {}) {
  const familyId = opcoes.familyId === undefined ? FAMILIA : opcoes.familyId;
  return {
    id: opcoes.id ?? idEvento(),
    type: opcoes.tipo ?? "customer.subscription.updated",
    data: {
      object: {
        id: ASSINATURA,
        status,
        customer: CLIENTE,
        current_period_end: DAQUI_A_UM_MES,
        cancel_at_period_end: false,
        metadata: familyId ? { family_account_id: familyId } : {},
        items: { data: [{ current_period_end: DAQUI_A_UM_MES }] },
      },
    },
  };
}

function eventoFatura(tipo: "invoice.payment_succeeded" | "invoice.payment_failed") {
  return {
    id: idEvento(),
    type: tipo,
    data: { object: { customer: CLIENTE, subscription: ASSINATURA, metadata: {} } },
  };
}

function requisicao(evento: unknown) {
  const corpo = JSON.stringify(evento);
  return {
    headers: { get: (k: string) => (k === "stripe-signature" ? "assinatura_valida" : null) },
    text: async () => corpo,
  } as unknown as Parameters<typeof POST>[0];
}

async function entregar(evento: unknown) {
  const res = await POST(requisicao(evento));
  return { status: res.status, corpo: (await res.json()) as Record<string, unknown> };
}

function acessoLiberado() {
  return assinaturaLiberada(banco.linha(FAMILIA) as never);
}

beforeEach(() => {
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_teste";
  banco = criarBanco([linhaTrial({ vencido: true })]);
  assinaturasStripe.clear();
  registrarNoStripe("active");
  logs.length = 0;
  seqEvento = 0;
});

// ============================================================
// 1-2. O CAMINHO FELIZ, com trial válido e com trial vencido
// ============================================================

describe("pagamento confirmado libera o acesso", () => {
  it("trial ainda válido → pagamento mantém o acesso e vira active", async () => {
    banco = criarBanco([linhaTrial({ vencido: false })]);
    expect(acessoLiberado()).toBe(true);

    const r = await entregar(eventoCheckout());

    expect(r.status).toBe(200);
    expect(banco.linha(FAMILIA)?.status).toBe("active");
    expect(acessoLiberado()).toBe(true);
  });

  it("trial VENCIDO → pagamento concede acesso que ela não tinha", async () => {
    expect(acessoLiberado()).toBe(false);

    const r = await entregar(eventoCheckout());

    expect(r.status).toBe(200);
    expect(banco.linha(FAMILIA)?.status).toBe("active");
    expect(banco.linha(FAMILIA)?.stripe_subscription_id).toBe(ASSINATURA);
    expect(acessoLiberado()).toBe(true);
  });
});

// ============================================================
// 3. A CLASSE ROCHELLE — regressão permanente
// ============================================================

describe("classe Rochelle: trial vencido + evento transitório incomplete", () => {
  it("o incomplete NÃO vira past_due, NÃO concede acesso e preserva os vínculos", async () => {
    // ESTADO INICIAL: trialing vencida, sem acesso, família identificável.
    expect(banco.linha(FAMILIA)?.status).toBe("trialing");
    expect(acessoLiberado()).toBe(false);

    // EVENTO TRANSITÓRIO: o Stripe abre a assinatura como `incomplete` —
    // acontece em todo checkout, antes de a cobrança confirmar.
    const r = await entregar(eventoAssinatura("incomplete", { tipo: "customer.subscription.created" }));

    expect(r.status).toBe(200);
    // Antes desta correção, aqui virava `past_due` — e como não havia carimbo
    // de dunning, a família ficava trancada sem ninguém saber.
    expect(banco.linha(FAMILIA)?.status).toBe("trialing");
    expect(banco.linha(FAMILIA)?.status).not.toBe("past_due");
    // Não ganhou acesso: `incomplete` não é pagamento.
    expect(acessoLiberado()).toBe(false);
    // Mas os vínculos foram gravados — é o que permite reconciliar depois.
    expect(banco.linha(FAMILIA)?.stripe_customer_id).toBe(CLIENTE);
    expect(banco.linha(FAMILIA)?.stripe_subscription_id).toBe(ASSINATURA);
    // E a escrita foi conferida de verdade.
    expect(logs.some((l) => l.kind === "stripe_subscription_changed" && l.severity === "info")).toBe(true);
  });

  it("o evento positivo que vem depois concede o acesso", async () => {
    await entregar(eventoAssinatura("incomplete", { tipo: "customer.subscription.created" }));
    expect(acessoLiberado()).toBe(false);

    const r = await entregar(eventoCheckout());

    expect(r.status).toBe(200);
    expect(banco.linha(FAMILIA)?.status).toBe("active");
    expect(acessoLiberado()).toBe(true);
  });
});

// ============================================================
// 4-5, 11. ORDEM DOS EVENTOS
// ============================================================

describe("ordem dos eventos", () => {
  it("incomplete ANTES do positivo → termina com acesso", async () => {
    await entregar(eventoAssinatura("incomplete", { tipo: "customer.subscription.created" }));
    await entregar(eventoCheckout());
    expect(banco.linha(FAMILIA)?.status).toBe("active");
    expect(acessoLiberado()).toBe(true);
  });

  it("incomplete DEPOIS do positivo → o acesso não é derrubado", async () => {
    await entregar(eventoCheckout());
    expect(acessoLiberado()).toBe(true);

    await entregar(eventoAssinatura("incomplete"));

    expect(banco.linha(FAMILIA)?.status).toBe("active");
    expect(acessoLiberado()).toBe(true);
  });

  it("active não vira trialing com trial já vencido — isso tiraria o acesso de quem pagou", async () => {
    await entregar(eventoCheckout());
    expect(acessoLiberado()).toBe(true);

    // `trialing` é positivo, mas mais fraco: o trial interno da linha venceu
    // ontem, então escrever "trialing" aqui trancaria a família.
    await entregar(eventoAssinatura("trialing"));

    expect(banco.linha(FAMILIA)?.status).toBe("active");
    expect(acessoLiberado()).toBe(true);
  });

  it("active não é rebaixado por um subscription.updated atrasado com past_due", async () => {
    // Sincronização de ciclo de vida não tem autoridade sobre quem já pagou.
    // Quem tira acesso de pagante é invoice.payment_failed ou o cancelamento.
    await entregar(eventoCheckout());
    await entregar(eventoAssinatura("past_due"));

    expect(banco.linha(FAMILIA)?.status).toBe("active");
    expect(acessoLiberado()).toBe(true);
    expect(logs.some((l) => l.kind === "stripe_subscription_changed")).toBe(true);
  });
});

// ============================================================
// 6-7, 10. REPETIÇÃO, CONCORRÊNCIA E RETRY
// ============================================================

describe("repetição e concorrência", () => {
  it("o mesmo evento entregue duas vezes não quebra nem duplica", async () => {
    const evento = eventoCheckout({ id: "evt_repetido" });

    const primeira = await entregar(evento);
    const segunda = await entregar(evento);

    expect(primeira.status).toBe(200);
    expect(segunda.status).toBe(200); // replay não vira erro
    expect(banco.linha(FAMILIA)?.status).toBe("active");
    // A auditoria guardou UMA linha: o unique de stripe_event_id segurou.
    expect(banco.tabelas.assinaturas).toHaveLength(1);
    expect(logs.some((l) => l.kind === "stripe_evento_registrado" && /replay/.test(l.message ?? ""))).toBe(true);
  });

  it("positivo e transitório processados ao mesmo tempo terminam em active", async () => {
    const [a, b] = await Promise.all([
      entregar(eventoCheckout()),
      entregar(eventoAssinatura("incomplete", { tipo: "customer.subscription.created" })),
    ]);

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    // O transitório não escreve status, então não existe ordem entre os dois
    // que produza estado errado.
    expect(banco.linha(FAMILIA)?.status).toBe("active");
    expect(acessoLiberado()).toBe(true);
  });

  it("retry depois de uma falha de banco converge para o estado certo", async () => {
    banco.falharProxima("subscription_accesses", { message: "connection reset" });

    const falha = await entregar(eventoCheckout({ id: "evt_retry" }));
    expect(falha.status).toBe(500);
    expect(banco.linha(FAMILIA)?.status).toBe("trialing");
    expect(acessoLiberado()).toBe(false);

    // O Stripe reentrega o MESMO evento — é o que o 500 pede.
    const retry = await entregar(eventoCheckout({ id: "evt_retry" }));

    expect(retry.status).toBe(200);
    expect(banco.linha(FAMILIA)?.status).toBe("active");
    expect(acessoLiberado()).toBe(true);
    expect(banco.tabelas.assinaturas).toHaveLength(1); // sem duplicar auditoria
  });
});

// ============================================================
// 8-9. FALHA DE PERSISTÊNCIA — o coração da Etapa 1
// ============================================================

describe("falha de persistência não pode terminar como sucesso", () => {
  it("banco recusa a escrita → 500, acesso não concedido, erro observável", async () => {
    banco.falharProxima("subscription_accesses", { message: "permission denied", code: "42501" });

    const r = await entregar(eventoCheckout());

    expect(r.status).toBe(500); // antes: 200, e o Stripe nunca reenviava
    expect(banco.linha(FAMILIA)?.status).toBe("trialing");
    expect(acessoLiberado()).toBe(false);
    const erro = logs.find((l) => l.kind === "stripe_checkout_completed" && l.severity === "error");
    expect(erro?.message).toContain("recusada pelo banco");
  });

  it("update que não casa com nenhuma linha é falha, não silêncio", async () => {
    // Família que não existe na Kolo: o UPDATE devolve error: null e nada.
    // Sem conferir as linhas afetadas, isso passaria por sucesso.
    banco = criarBanco([]);

    const r = await entregar(eventoCheckout());

    expect(r.status).toBe(500);
    const erro = logs.find((l) => l.kind === "stripe_checkout_completed" && l.severity === "error");
    expect(erro?.message).toContain("nenhuma linha");
  });
});

// ============================================================
// 12, 16. QUEM NÃO PAGOU, E QUEM NÃO DÁ PARA IDENTIFICAR
// ============================================================

describe("acesso não sai de graça", () => {
  it("sessão concluída sem pagamento não concede acesso", async () => {
    const r = await entregar(eventoCheckout({ pago: false }));

    expect(r.status).toBe(200);
    expect(banco.linha(FAMILIA)?.status).toBe("trialing");
    expect(acessoLiberado()).toBe(false);
    // Mas o vínculo fica gravado, pra reconciliação futura enxergar.
    expect(banco.linha(FAMILIA)?.stripe_customer_id).toBe(CLIENTE);
  });

  it("nenhum evento transitório sozinho concede acesso", async () => {
    for (const status of ["incomplete", "incomplete_expired", "canceled", "unpaid"]) {
      banco = criarBanco([linhaTrial({ vencido: true })]);
      await entregar(eventoAssinatura(status));
      expect(acessoLiberado(), status).toBe(false);
    }
  });

  it("pagamento sem família resolvível falha de forma visível — e não adivinha", async () => {
    const r = await entregar(eventoCheckout({ familyId: null }));

    expect(r.status).toBe(500); // antes: 200 mudo
    const erro = logs.find((l) => l.kind === "stripe_checkout_sem_familia");
    expect(erro?.severity).toBe("error");
    // Nenhuma família foi tocada — não existe chute de identidade.
    expect(banco.linha(FAMILIA)?.status).toBe("trialing");
  });

  it("evento de ciclo de vida sem família fica registrado, sem derrubar o webhook", async () => {
    const r = await entregar(eventoAssinatura("canceled", { familyId: null }));

    expect(r.status).toBe(200);
    expect(logs.some((l) => l.kind === "stripe_subscription_sem_familia" && l.severity === "warn")).toBe(true);
    expect(banco.linha(FAMILIA)?.status).toBe("trialing");
  });
});

// ============================================================
// 13-15. O QUE NÃO PODE TER SIDO QUEBRADO — o caso I do §12
// ============================================================

describe("evidência negativa real continua funcionando", () => {
  it("invoice.payment_failed rebaixa, carimba a falha e abre a graça de 2 dias", async () => {
    await entregar(eventoCheckout());
    expect(acessoLiberado()).toBe(true);

    const r = await entregar(eventoFatura("invoice.payment_failed"));

    expect(r.status).toBe(200);
    expect(banco.linha(FAMILIA)?.status).toBe("past_due");
    expect(banco.linha(FAMILIA)?.pagamento_falhou_em).toBeTruthy();
    // Dunning: continua com acesso durante a graça — não pode ter virado corte seco.
    expect(acessoLiberado()).toBe(true);
  });

  it("a graça acaba: past_due com carimbo velho bloqueia", async () => {
    await entregar(eventoCheckout());
    await entregar(eventoFatura("invoice.payment_failed"));

    (banco.linha(FAMILIA) as Linha).pagamento_falhou_em = new Date(AGORA - 3 * DIA).toISOString();

    expect(acessoLiberado()).toBe(false);
  });

  it("a segunda falha não reinicia a contagem da graça", async () => {
    await entregar(eventoCheckout());
    await entregar(eventoFatura("invoice.payment_failed"));
    const primeiroCarimbo = banco.linha(FAMILIA)?.pagamento_falhou_em;

    await entregar(eventoFatura("invoice.payment_failed"));

    expect(banco.linha(FAMILIA)?.pagamento_falhou_em).toBe(primeiroCarimbo);
  });

  it("regularizou depois da falha → volta a active e o carimbo é limpo", async () => {
    await entregar(eventoCheckout());
    await entregar(eventoFatura("invoice.payment_failed"));
    expect(banco.linha(FAMILIA)?.status).toBe("past_due");

    await entregar(eventoFatura("invoice.payment_succeeded"));

    expect(banco.linha(FAMILIA)?.status).toBe("active");
    expect(banco.linha(FAMILIA)?.pagamento_falhou_em).toBeNull();
    expect(acessoLiberado()).toBe(true);
  });

  it("cancelamento real derruba mesmo quem está active", async () => {
    await entregar(eventoCheckout());
    expect(acessoLiberado()).toBe(true);

    const r = await entregar(
      eventoAssinatura("canceled", { tipo: "customer.subscription.deleted" }),
    );

    expect(r.status).toBe(200);
    expect(banco.linha(FAMILIA)?.status).toBe("canceled");
    expect(acessoLiberado()).toBe(false);
  });

  it("quem nunca pagou é rebaixado normalmente por evidência negativa", async () => {
    // A proteção é de quem TEM evidência positiva aplicada; não é anistia geral.
    await entregar(eventoAssinatura("unpaid"));
    expect(banco.linha(FAMILIA)?.status).toBe("past_due");
    expect(acessoLiberado()).toBe(false);
  });
});

// ============================================================
// 17. OS TRÊS CAMINHOS POSITIVOS CONVERGEM
// ============================================================

describe("redundância: três eventos independentes concedem acesso", () => {
  const caminhos: Array<[string, () => unknown]> = [
    ["checkout.session.completed", () => eventoCheckout()],
    ["invoice.payment_succeeded", () => eventoFatura("invoice.payment_succeeded")],
    ["customer.subscription.updated(active)", () => eventoAssinatura("active")],
  ];

  for (const [nome, montar] of caminhos) {
    it(`${nome} sozinho leva a família de trial vencido para o acesso`, async () => {
      banco = criarBanco([linhaTrial({ vencido: true })]);
      expect(acessoLiberado()).toBe(false);

      const r = await entregar(montar());

      expect(r.status).toBe(200);
      expect(banco.linha(FAMILIA)?.status).toBe("active");
      expect(acessoLiberado()).toBe(true);
    });
  }
});
