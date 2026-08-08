import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  reconciliarDivergencias,
  alertaOperacionalRecente,
  KIND_ALERTA_OPERACIONAL,
  KIND_PULSO,
} from "./reconciliacao";
import { assinaturaLiberada } from "@/lib/auth/assinatura";
import type { SyncResult } from "./sync";

/**
 * "EXISTE FAMÍLIA QUE DEVERIA TER ACESSO E A KOLO NÃO ESTÁ CONCEDENDO?"
 *
 * O reconciliador antigo perguntava "quem está em past_due?" — reagia a um
 * estado específico e não via a classe do incidente Rochelle, que era
 * `trialing` vencida. Estes testes medem comportamento observável: quem entra
 * na população, quantas vezes o Stripe é chamado, quem termina com acesso pela
 * fonte única `assinaturaLiberada`, e o que é alertado.
 *
 * Duas coisas puxam em direções opostas e as duas precisam valer:
 *   1. quem pagou e está travado tem que ser encontrado e destravado;
 *   2. quem NÃO pagou não pode ganhar acesso, e quem está certo não pode ser
 *      tocado nem custar uma chamada ao Stripe.
 */

type LogCapturado = {
  kind: string;
  severity?: string;
  message?: string;
  payload?: Record<string, unknown>;
};
const logs: LogCapturado[] = [];

/**
 * O mock imita a regra real do `logEvent`: só `warn+` PERSISTE em
 * `eventos_app`. Isso importa aqui porque a janela do pulso lê exatamente essa
 * tabela — um mock que persistisse tudo esconderia o bug que motivou o pulso.
 */
let bancoAtual: { persistir: (e: LogCapturado) => void } | null = null;
vi.mock("@/lib/log", () => ({
  logEvent: async (e: LogCapturado) => {
    logs.push(e);
    if (["warn", "error", "fatal"].includes(e.severity ?? "info")) bancoAtual?.persistir(e);
  },
  logServerError: async () => {},
}));

// ============================================================
// BANCO FALSO — com os mesmos modos de falha do Supabase: devolve `error` em
// vez de lançar, e conhece o filtro `.or(...)` de vínculo usado na população.
// ============================================================

type Linha = Record<string, unknown>;

function criarBanco(linhas: Linha[], eventos: Linha[] = []) {
  let erroNoSelect: { message: string } | null = null;
  const tabelas: Record<string, Linha[]> = {
    subscription_accesses: linhas,
    eventos_app: eventos,
  };
  let relogio = Date.now();

  function from(tabela: string) {
    const alvo = tabelas[tabela] ?? [];
    const filtros: Array<(l: Linha) => boolean> = [];
    const builder = {
      select: () => builder,
      eq(coluna: string, valor: unknown) {
        filtros.push((l) => l[coluna] === valor);
        return builder;
      },
      or(expressao: string) {
        // Só a expressão que a reconciliação usa: vínculo com o Stripe.
        expect(expressao).toBe("stripe_customer_id.not.is.null,stripe_subscription_id.not.is.null");
        filtros.push((l) => l.stripe_customer_id != null || l.stripe_subscription_id != null);
        return builder;
      },
      gte(coluna: string, valor: string) {
        filtros.push((l) => String(l[coluna] ?? "") >= valor);
        return builder;
      },
      limit: () => builder,
      maybeSingle: async () => {
        if (erroNoSelect) return { data: null, error: erroNoSelect };
        return { data: alvo.filter((l) => filtros.every((f) => f(l)))[0] ?? null, error: null };
      },
      then(resolver: (v: unknown) => unknown, rejeitar?: (e: unknown) => unknown) {
        const resultado = erroNoSelect
          ? { data: null, error: erroNoSelect }
          : { data: alvo.filter((l) => filtros.every((f) => f(l))), error: null };
        return Promise.resolve(resultado).then(resolver, rejeitar);
      },
    };
    return builder;
  }

  const api = {
    from,
    linhas,
    eventos,
    linha: (id: string) => linhas.find((l) => l.family_account_id === id),
    falharSelect(message: string) {
      erroNoSelect = { message };
    },
    /** Chamado pelo mock do logEvent quando a severidade persiste. */
    persistir(e: { kind: string; payload?: Record<string, unknown> }) {
      eventos.push({ id: `ev_${eventos.length + 1}`, kind: e.kind, created_at: new Date(relogio).toISOString(), payload: e.payload });
    },
    /** Move o relógio das gravações, para exercitar a janela. */
    avancarHoras(h: number) {
      relogio += h * 60 * 60 * 1000;
    },
  };
  // Todo banco criado vira o "atual" para o mock do logEvent persistir nele.
  bancoAtual = api;
  return api;
}

const DIA = 24 * 60 * 60 * 1000;
const AGORA = Date.now();
const ONTEM = new Date(AGORA - DIA).toISOString();
const DAQUI_A_5_DIAS = new Date(AGORA + 5 * DIA).toISOString();

function familia(id: string, extra: Linha = {}): Linha {
  return {
    family_account_id: id,
    status: "trialing",
    trial_ends_at: ONTEM, // trial vencido = sem acesso, salvo indicação contrária
    cortesia: false,
    cortesia_ate: null,
    pagamento_falhou_em: null,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    ...extra,
  };
}

const COM_VINCULO = { stripe_customer_id: "cus_1", stripe_subscription_id: "sub_1" };

/** Sincronizador falso: escreve na linha o que o "Stripe" diz, como o real faz. */
function sincronizadorQueEscreve(
  banco: ReturnType<typeof criarBanco>,
  porFamilia: Record<string, { status: string; stripeStatus: string } | { erro: string } | "lanca">,
) {
  const chamadas: string[] = [];
  const fn = (async (_admin: unknown, familyId: string): Promise<SyncResult> => {
    chamadas.push(familyId);
    const cfg = porFamilia[familyId];
    if (cfg === "lanca") throw new Error("Stripe fora do ar");
    if (!cfg) return { ok: false, error: "Família sem linha de assinatura." };
    if ("erro" in cfg) return { ok: false, error: cfg.erro };
    const linha = banco.linha(familyId)!;
    const antes = (linha.status as string) ?? null;
    linha.status = cfg.status;
    if (cfg.status === "active") linha.pagamento_falhou_em = null;
    return {
      ok: true,
      antes,
      depois: cfg.status,
      stripeStatus: cfg.stripeStatus,
      via: "subscription",
      mudou: antes !== cfg.status,
    };
  }) as unknown as typeof import("./sync").sincronizarAssinaturaDoStripe;
  return { fn, chamadas };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const comoAdmin = (b: ReturnType<typeof criarBanco>) => b as any;

beforeEach(() => {
  logs.length = 0;
});

// ============================================================
// 1-2, 6, 10. QUEM ENTRA NA POPULAÇÃO
// ============================================================

describe("população: divergência, não lista de status", () => {
  it("banco sem ninguém com vínculo → zero candidatas e zero chamadas ao Stripe", async () => {
    const banco = criarBanco([familia("f1"), familia("f2")]);
    const sync = sincronizadorQueEscreve(banco, {});

    const r = await reconciliarDivergencias(comoAdmin(banco), { sincronizar: sync.fn });

    expect(r.candidatas).toBe(0);
    expect(r.chamadasStripe).toBe(0);
    expect(sync.chamadas).toHaveLength(0);
  });

  it("trial vencido SEM vínculo não entra — não há o que reconciliar", async () => {
    // São as 118 famílias do baseline de produção: sem vínculo, nada a fazer.
    const banco = criarBanco([familia("f1"), familia("f2"), familia("f3")]);
    const sync = sincronizadorQueEscreve(banco, {});

    const r = await reconciliarDivergencias(comoAdmin(banco), { sincronizar: sync.fn });

    expect(r.candidatas).toBe(0);
    expect(sync.chamadas).toHaveLength(0);
  });

  it("família COM acesso fica fora da população — zero chamada ao Stripe", async () => {
    const banco = criarBanco([
      familia("ativa", { ...COM_VINCULO, status: "active" }),
      familia("trial_valido", { ...COM_VINCULO, trial_ends_at: DAQUI_A_5_DIAS }),
      familia("cortesia", { ...COM_VINCULO, cortesia: true, cortesia_ate: null }),
      familia("graca", {
        ...COM_VINCULO,
        status: "past_due",
        pagamento_falhou_em: new Date(AGORA - 1 * DIA).toISOString(),
      }),
    ]);
    const sync = sincronizadorQueEscreve(banco, {});

    const r = await reconciliarDivergencias(comoAdmin(banco), { sincronizar: sync.fn });

    expect(r.candidatas).toBe(0);
    expect(r.chamadasStripe).toBe(0);
    // E ninguém foi tocado.
    expect(banco.linha("ativa")?.status).toBe("active");
    expect(banco.linha("graca")?.status).toBe("past_due");
  });
});

// ============================================================
// 3-5. CASO A — o Stripe diz que há direito e a Kolo não concede
// ============================================================

describe("caso A: divergência real é corrigida", () => {
  it("trialing VENCIDO com vínculo + Stripe active → ganha acesso (a classe Rochelle)", async () => {
    const banco = criarBanco([familia("rochelle", COM_VINCULO)]);
    expect(assinaturaLiberada(banco.linha("rochelle") as never)).toBe(false);
    const sync = sincronizadorQueEscreve(banco, {
      rochelle: { status: "active", stripeStatus: "active" },
    });

    const r = await reconciliarDivergencias(comoAdmin(banco), { sincronizar: sync.fn });

    expect(r.candidatas).toBe(1);
    expect(r.corrigidas).toHaveLength(1);
    expect(r.corrigidas[0]).toMatchObject({ familyId: "rochelle", antes: "trialing", depois: "active" });
    expect(assinaturaLiberada(banco.linha("rochelle") as never)).toBe(true);
    // Persistido: divergência corrigida vira registro, não só log de stdout.
    expect(logs.some((l) => l.severity === "warn" && /corrigida/.test(l.message ?? ""))).toBe(true);
  });

  it("past_due com vínculo + Stripe active → corrige (o caso que o antigo já pegava)", async () => {
    const banco = criarBanco([familia("f1", { ...COM_VINCULO, status: "past_due" })]);
    const sync = sincronizadorQueEscreve(banco, { f1: { status: "active", stripeStatus: "active" } });

    const r = await reconciliarDivergencias(comoAdmin(banco), { sincronizar: sync.fn });

    expect(r.corrigidas).toHaveLength(1);
    expect(assinaturaLiberada(banco.linha("f1") as never)).toBe(true);
  });

  it("canceled com vínculo + Stripe active → o estado deriva do Stripe e o acesso volta", async () => {
    const banco = criarBanco([familia("f1", { ...COM_VINCULO, status: "canceled" })]);
    const sync = sincronizadorQueEscreve(banco, { f1: { status: "active", stripeStatus: "active" } });

    const r = await reconciliarDivergencias(comoAdmin(banco), { sincronizar: sync.fn });

    expect(r.corrigidas).toHaveLength(1);
    expect(banco.linha("f1")?.status).toBe("active");
    expect(assinaturaLiberada(banco.linha("f1") as never)).toBe(true);
  });
});

// ============================================================
// 7, 15. CASO B — o Stripe confirma que NÃO há direito
// ============================================================

describe("caso B: bloqueio correto continua bloqueado", () => {
  it("vínculo + Stripe não ativo → não ganha acesso e não vira alerta de correção", async () => {
    const banco = criarBanco([familia("f1", { ...COM_VINCULO, status: "past_due" })]);
    const sync = sincronizadorQueEscreve(banco, {
      f1: { status: "past_due", stripeStatus: "past_due" },
    });

    const r = await reconciliarDivergencias(comoAdmin(banco), { sincronizar: sync.fn });

    expect(r.candidatas).toBe(1);
    expect(r.corrigidas).toHaveLength(0); // nada a alertar
    expect(r.verificadasSemAcesso).toBe(1); // mas ficou registrado que foi verificada
    expect(r.naoCorrigidas).toHaveLength(0); // e não é falha
    expect(assinaturaLiberada(banco.linha("f1") as never)).toBe(false);
  });

  it("checkout abandonado (Stripe incomplete) não vira acesso", async () => {
    const banco = criarBanco([familia("abandonou", COM_VINCULO)]);
    // Evidência neutra: o re-sync mantém o status como está (Etapa 2).
    const sync = sincronizadorQueEscreve(banco, {
      abandonou: { status: "trialing", stripeStatus: "incomplete" },
    });

    const r = await reconciliarDivergencias(comoAdmin(banco), { sincronizar: sync.fn });

    expect(r.corrigidas).toHaveLength(0);
    expect(r.verificadasSemAcesso).toBe(1);
    expect(assinaturaLiberada(banco.linha("abandonou") as never)).toBe(false);
  });

  it("sync que muda o status sem liberar acesso NÃO conta como corrigida", async () => {
    // O reconciliador antigo contava `depois === "trialing"` como conserto —
    // mas trialing sobre trial vencido não libera nada. Falso positivo.
    const banco = criarBanco([familia("f1", { ...COM_VINCULO, status: "past_due" })]);
    const sync = sincronizadorQueEscreve(banco, {
      f1: { status: "trialing", stripeStatus: "trialing" },
    });

    const r = await reconciliarDivergencias(comoAdmin(banco), { sincronizar: sync.fn });

    expect(r.corrigidas).toHaveLength(0);
    expect(r.verificadasSemAcesso).toBe(1);
    expect(assinaturaLiberada(banco.linha("f1") as never)).toBe(false);
  });
});

// ============================================================
// 8-10. FALHAS — leitura e sincronização
// ============================================================

describe("falha não pode virar 'zero problemas'", () => {
  it("erro no SELECT da população LANÇA — nunca responde 0 encontrados", async () => {
    const banco = criarBanco([familia("f1", COM_VINCULO)]);
    banco.falharSelect("connection reset by peer");
    const sync = sincronizadorQueEscreve(banco, {});

    await expect(
      reconciliarDivergencias(comoAdmin(banco), { sincronizar: sync.fn }),
    ).rejects.toThrow(/falha ao ler a população/);

    expect(logs.some((l) => l.severity === "error" && /população/.test(l.message ?? ""))).toBe(true);
    expect(sync.chamadas).toHaveLength(0);
  });

  it("sync que devolve erro entra em naoCorrigidas, com motivo", async () => {
    const banco = criarBanco([familia("f1", COM_VINCULO)]);
    const sync = sincronizadorQueEscreve(banco, {
      f1: { erro: "Sem vínculo com o Stripe (nem customer nem subscription id)." },
    });

    const r = await reconciliarDivergencias(comoAdmin(banco), { sincronizar: sync.fn });

    expect(r.naoCorrigidas).toHaveLength(1);
    expect(r.naoCorrigidas[0].motivo).toContain("Sem vínculo");
    expect(r.corrigidas).toHaveLength(0);
    expect(logs.some((l) => l.severity === "error")).toBe(true);
  });

  it("sync que LANÇA não desaparece num catch vazio", async () => {
    const banco = criarBanco([familia("f1", COM_VINCULO)]);
    const sync = sincronizadorQueEscreve(banco, { f1: "lanca" });

    const r = await reconciliarDivergencias(comoAdmin(banco), { sincronizar: sync.fn });

    expect(r.naoCorrigidas).toHaveLength(1);
    expect(r.naoCorrigidas[0].motivo).toContain("Stripe fora do ar");
  });

  it("uma família falha e a outra é corrigida — processamento independente", async () => {
    const banco = criarBanco([
      familia("quebra", COM_VINCULO),
      familia("conserta", COM_VINCULO),
    ]);
    const sync = sincronizadorQueEscreve(banco, {
      quebra: "lanca",
      conserta: { status: "active", stripeStatus: "active" },
    });

    const r = await reconciliarDivergencias(comoAdmin(banco), { sincronizar: sync.fn });

    expect(r.candidatas).toBe(2);
    expect(r.corrigidas.map((c) => c.familyId)).toEqual(["conserta"]);
    expect(r.naoCorrigidas.map((c) => c.familyId)).toEqual(["quebra"]);
    expect(assinaturaLiberada(banco.linha("conserta") as never)).toBe(true);
  });
});

// ============================================================
// 11. IDEMPOTÊNCIA
// ============================================================

describe("rodar duas vezes", () => {
  it("a segunda execução não encontra nada, não chama o Stripe e não alerta de novo", async () => {
    const banco = criarBanco([familia("f1", COM_VINCULO)]);
    const sync = sincronizadorQueEscreve(banco, { f1: { status: "active", stripeStatus: "active" } });

    const primeira = await reconciliarDivergencias(comoAdmin(banco), { sincronizar: sync.fn });
    expect(primeira.corrigidas).toHaveLength(1);
    expect(sync.chamadas).toHaveLength(1);

    const segunda = await reconciliarDivergencias(comoAdmin(banco), { sincronizar: sync.fn });

    // Corrigida → tem acesso → sai da população. Sem segunda correção, sem
    // segunda chamada ao Stripe, sem alerta repetido.
    expect(segunda.candidatas).toBe(0);
    expect(segunda.corrigidas).toHaveLength(0);
    expect(segunda.chamadasStripe).toBe(0);
    expect(sync.chamadas).toHaveLength(1);
    expect(banco.linha("f1")?.status).toBe("active");
  });

  it("bloqueio correto é reverificado, mas nunca vira correção", async () => {
    const banco = criarBanco([familia("f1", { ...COM_VINCULO, status: "past_due" })]);
    const sync = sincronizadorQueEscreve(banco, {
      f1: { status: "past_due", stripeStatus: "past_due" },
    });

    const a = await reconciliarDivergencias(comoAdmin(banco), { sincronizar: sync.fn });
    const b = await reconciliarDivergencias(comoAdmin(banco), { sincronizar: sync.fn });

    expect(a.corrigidas).toHaveLength(0);
    expect(b.corrigidas).toHaveLength(0);
    expect(b.verificadasSemAcesso).toBe(1);
    expect(assinaturaLiberada(banco.linha("f1") as never)).toBe(false);
  });
});

// ============================================================
// 12-14. O QUE ALIMENTA O ALERTA
// ============================================================

describe("sinais para o alerta", () => {
  it("nenhuma correção e nenhuma falha → nada para alertar", async () => {
    const banco = criarBanco([familia("ok", { ...COM_VINCULO, status: "active" })]);
    const sync = sincronizadorQueEscreve(banco, {});

    const r = await reconciliarDivergencias(comoAdmin(banco), { sincronizar: sync.fn });

    expect(r.corrigidas).toHaveLength(0);
    expect(r.naoCorrigidas).toHaveLength(0);
    // O único registro persistido de uma execução limpa é o pulso — o resumo
    // detalhado fica em stdout, senão seriam 24 linhas por dia.
    const persistidos = logs.filter((l) => l.severity === "warn" || l.severity === "error");
    expect(persistidos.map((l) => l.kind)).toEqual([KIND_PULSO]);
  });

  it("correção real produz o dado do alerta de correção", async () => {
    const banco = criarBanco([familia("f1", COM_VINCULO)]);
    const sync = sincronizadorQueEscreve(banco, { f1: { status: "active", stripeStatus: "active" } });

    const r = await reconciliarDivergencias(comoAdmin(banco), { sincronizar: sync.fn });

    expect(r.corrigidas[0]).toMatchObject({ antes: "trialing", depois: "active", stripe: "active" });
  });

  it("falha real produz o dado do alerta operacional", async () => {
    const banco = criarBanco([familia("f1", { ...COM_VINCULO, status: "past_due" })]);
    const sync = sincronizadorQueEscreve(banco, { f1: { erro: "Falha ao consultar o Stripe: timeout" } });

    const r = await reconciliarDivergencias(comoAdmin(banco), { sincronizar: sync.fn });

    expect(r.naoCorrigidas[0]).toMatchObject({ familyId: "f1", statusAnterior: "past_due" });
    expect(r.naoCorrigidas[0].motivo).toContain("timeout");
  });
});

// ============================================================
// PULSO DE SAÚDE — a prova de que a reconciliação está viva
// ============================================================

describe("pulso: execução limpa deixa rastro, sem virar ruído", () => {
  const pulsos = (b: ReturnType<typeof criarBanco>) =>
    b.eventos.filter((e) => e.kind === KIND_PULSO);

  it("população 0 produz pulso válido, com os números da execução", async () => {
    // É o caso REAL de produção hoje: 2 linhas com vínculo, ambas com acesso.
    const banco = criarBanco([
      familia("ok1", { ...COM_VINCULO, status: "active" }),
      familia("ok2", { ...COM_VINCULO, status: "active" }),
    ]);
    const sync = sincronizadorQueEscreve(banco, {});

    const r = await reconciliarDivergencias(comoAdmin(banco), {
      sincronizar: sync.fn,
      agora: AGORA,
    });

    expect(r.candidatas).toBe(0);
    expect(pulsos(banco)).toHaveLength(1);
    // O pulso responde às perguntas do §11 sem precisar de mais nada.
    expect(pulsos(banco)[0].payload).toMatchObject({
      resultado: "pulso",
      com_vinculo: 2,
      candidatas: 0,
      chamadas_stripe: 0,
      corrigidas: 0,
      nao_corrigidas: 0,
    });
  });

  it("execuções seguintes na mesma janela NÃO poluem", async () => {
    const banco = criarBanco([familia("ok", { ...COM_VINCULO, status: "active" })]);
    const sync = sincronizadorQueEscreve(banco, {});

    for (const h of [0, 1, 2, 5, 11, 19]) {
      await reconciliarDivergencias(comoAdmin(banco), {
        sincronizar: sync.fn,
        agora: AGORA + h * 60 * 60 * 1000,
      });
    }

    // Seis execuções dentro da janela, UM registro.
    expect(pulsos(banco)).toHaveLength(1);
  });

  it("nova janela permite novo pulso — pelo menos um por dia", async () => {
    const banco = criarBanco([familia("ok", { ...COM_VINCULO, status: "active" })]);
    const sync = sincronizadorQueEscreve(banco, {});

    await reconciliarDivergencias(comoAdmin(banco), { sincronizar: sync.fn, agora: AGORA });
    banco.avancarHoras(21);
    await reconciliarDivergencias(comoAdmin(banco), {
      sincronizar: sync.fn,
      agora: AGORA + 21 * 60 * 60 * 1000,
    });

    expect(pulsos(banco)).toHaveLength(2);
  });

  it("erro continua persistindo NA HORA, sem esperar janela nenhuma", async () => {
    const banco = criarBanco([familia("f1", COM_VINCULO)]);
    const sync = sincronizadorQueEscreve(banco, { f1: { erro: "timeout" } });

    await reconciliarDivergencias(comoAdmin(banco), { sincronizar: sync.fn, agora: AGORA });
    await reconciliarDivergencias(comoAdmin(banco), {
      sincronizar: sync.fn,
      agora: AGORA + 60 * 60 * 1000,
    });

    // Duas execuções, dois registros de erro — a janela não silencia falha.
    const erros = logs.filter((l) => l.severity === "error");
    expect(erros.length).toBeGreaterThanOrEqual(2);
  });

  it("divergência corrigida persiste na hora, e não gasta o pulso", async () => {
    const banco = criarBanco([familia("f1", COM_VINCULO)]);
    const sync = sincronizadorQueEscreve(banco, { f1: { status: "active", stripeStatus: "active" } });

    const r = await reconciliarDivergencias(comoAdmin(banco), {
      sincronizar: sync.fn,
      agora: AGORA,
    });

    expect(r.corrigidas).toHaveLength(1);
    // O resumo já persistiu e prova a execução; o pulso não repete.
    expect(pulsos(banco)).toHaveLength(0);
    expect(banco.eventos.some((e) => e.kind === "reconciliacao_divergencia")).toBe(true);
  });

  it("o pulso NÃO dispara WhatsApp — as duas condições do cron seguem falsas", async () => {
    const banco = criarBanco([familia("ok", { ...COM_VINCULO, status: "active" })]);
    const sync = sincronizadorQueEscreve(banco, {});

    const r = await reconciliarDivergencias(comoAdmin(banco), {
      sincronizar: sync.fn,
      agora: AGORA,
    });

    expect(pulsos(banco)).toHaveLength(1);
    // O cron só envia se uma destas for > 0.
    expect(r.corrigidas).toHaveLength(0);
    expect(r.naoCorrigidas).toHaveLength(0);
  });
});

// ============================================================
// ANTI-SPAM DO ALERTA OPERACIONAL
// ============================================================

describe("o alerta operacional não vira spam de hora em hora", () => {
  const evento = (horasAtras: number) => ({
    id: "e1",
    kind: KIND_ALERTA_OPERACIONAL,
    created_at: new Date(AGORA - horasAtras * 60 * 60 * 1000).toISOString(),
  });

  it("sem alerta anterior → pode alertar", async () => {
    const banco = criarBanco([]);
    expect(await alertaOperacionalRecente(comoAdmin(banco), AGORA)).toBe(false);
  });

  it("alerta enviado há 1 hora → NÃO alerta de novo (o problema é o mesmo)", async () => {
    const banco = criarBanco([], [evento(1)]);
    expect(await alertaOperacionalRecente(comoAdmin(banco), AGORA)).toBe(true);
  });

  it("passadas 12 horas, volta a alertar — o problema segue de pé", async () => {
    const banco = criarBanco([], [evento(13)]);
    expect(await alertaOperacionalRecente(comoAdmin(banco), AGORA)).toBe(false);
  });

  it("erro na leitura da trava → ALERTA mesmo assim; emudecer é pior que repetir", async () => {
    const banco = criarBanco([], [evento(1)]);
    banco.falharSelect("timeout");
    expect(await alertaOperacionalRecente(comoAdmin(banco), AGORA)).toBe(false);
  });
});

// ============================================================
// REGRESSÃO — a lógica nova precisa ser SUPERCONJUNTO da antiga
// ============================================================

describe("regressão: nada do comportamento útil anterior se perdeu", () => {
  it("todo past_due com vínculo que o antigo consertaria continua sendo consertado", async () => {
    const banco = criarBanco([
      familia("a", { ...COM_VINCULO, status: "past_due" }),
      familia("b", { ...COM_VINCULO, status: "past_due" }),
    ]);
    const sync = sincronizadorQueEscreve(banco, {
      a: { status: "active", stripeStatus: "active" },
      b: { status: "active", stripeStatus: "active" },
    });

    const r = await reconciliarDivergencias(comoAdmin(banco), { sincronizar: sync.fn });

    expect(r.corrigidas.map((c) => c.familyId).sort()).toEqual(["a", "b"]);
  });

  it("e o que o antigo NÃO via agora é visto: trialing vencido e canceled", async () => {
    const banco = criarBanco([
      familia("trial_vencido", COM_VINCULO),
      familia("cancelada", { ...COM_VINCULO, status: "canceled" }),
      familia("pausada", { ...COM_VINCULO, status: "paused" }),
    ]);
    const sync = sincronizadorQueEscreve(banco, {
      trial_vencido: { status: "active", stripeStatus: "active" },
      cancelada: { status: "active", stripeStatus: "active" },
      pausada: { status: "active", stripeStatus: "active" },
    });

    const r = await reconciliarDivergencias(comoAdmin(banco), { sincronizar: sync.fn });

    expect(r.candidatas).toBe(3);
    expect(r.corrigidas).toHaveLength(3);
  });
});
