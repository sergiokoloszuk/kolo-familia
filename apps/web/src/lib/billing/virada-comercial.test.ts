import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * VIRADA COMERCIAL — 27/11/2026.
 *
 * O que estes testes prendem:
 *   · sem data programada, NADA muda (a jornada de 7 dias, byte a byte);
 *   · com a virada valendo, família nova não ganha teste — e quem já tem
 *     linha (direito de legado da 0084) continua passando pela RPC;
 *   · ninguém promete dias grátis a quem nunca teve teste: Ayla, /precos,
 *     /ajuda, número desconhecido;
 *   · quem já teve teste recebe exatamente o texto de sempre.
 */

vi.mock("@/lib/log", () => ({
  logEvent: vi.fn(async () => {}),
  logServerError: vi.fn(async () => {}),
}));

import {
  CHAVE_VIRADA_COMERCIAL,
  familiaSemTesteAnterior,
  instanteDeBrasilia,
  jornadaSemTrial,
  lerVirada,
  paraCampoDeBrasilia,
  viradaAtivaEm,
} from "./virada-comercial";
import {
  FATOS_COMERCIAIS,
  FATOS_COMERCIAIS_SEM_TRIAL,
  fatosComerciaisParaFamilia,
} from "./fatos-comerciais";
import { iniciarTrial } from "@/lib/trial/iniciar";
import { blocoPosTrial } from "@/lib/trial/jornada";
import { nuncaTeveTeste } from "@/lib/auth/assinatura";
import { ctaDoEstado, type EstadoComercial } from "@/app/(public)/precos/cta-por-estado";
import { textoParaDesconhecido } from "@/lib/ayla/desconhecido";

const FAMILIA = "22222222-2222-4222-8222-222222222222";
const ONTEM = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const AMANHA = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

type Linha = Record<string, unknown>;

/** Banco falso: tabelas em memória + `rpc` registrada. Só o que estes fluxos usam. */
function banco(opcoes: {
  virada?: string | null;
  acesso?: Linha | null;
  participacaoBf?: Linha | null;
  erroAcesso?: boolean;
} = {}) {
  const rpcs: string[] = [];
  const tabelas: Record<string, Linha[]> = {
    configuracao_geral:
      opcoes.virada != null ? [{ chave: CHAVE_VIRADA_COMERCIAL, valor: opcoes.virada }] : [],
    subscription_accesses: opcoes.acesso ? [{ family_account_id: FAMILIA, ...opcoes.acesso }] : [],
    black_friday_2026_participacoes: opcoes.participacaoBf
      ? [{ family_account_id: FAMILIA, ...opcoes.participacaoBf }]
      : [],
  };
  const cliente = {
    from(tabela: string) {
      const filtros: Array<[string, unknown]> = [];
      const b = {
        select: () => b,
        eq: (col: string, val: unknown) => {
          filtros.push([col, val]);
          return b;
        },
        maybeSingle: async () => {
          if (tabela === "subscription_accesses" && opcoes.erroAcesso) {
            return { data: null, error: { message: "timeout" } };
          }
          const linha = (tabelas[tabela] ?? []).find((l) =>
            filtros.every(([c, v]) => l[c] === v),
          );
          return { data: linha ?? null, error: null };
        },
      };
      return b;
    },
    rpc: async (nome: string) => {
      rpcs.push(nome);
      return { data: "iniciado", error: null };
    },
  };
  return { cliente: cliente as unknown as SupabaseClient, rpcs };
}

beforeEach(() => vi.clearAllMocks());

describe("a data da virada", () => {
  it("sem valor, valor inválido ou data futura: a jornada antiga continua", () => {
    expect(viradaAtivaEm(null)).toBe(false);
    expect(viradaAtivaEm("")).toBe(false);
    expect(viradaAtivaEm("amanhã")).toBe(false);
    expect(viradaAtivaEm(AMANHA)).toBe(false);
  });

  it("data alcançada: a jornada sem teste vale", () => {
    expect(viradaAtivaEm(ONTEM)).toBe(true);
    expect(viradaAtivaEm("2026-12-01T03:00:00.000Z", Date.parse("2026-12-01T03:00:00.000Z"))).toBe(true);
    expect(viradaAtivaEm("2026-12-01T03:00:00.000Z", Date.parse("2026-12-01T02:59:59.999Z"))).toBe(false);
  });

  it("o campo do Admin é horário de Brasília e volta igual", () => {
    expect(instanteDeBrasilia("2026-12-01T00:00")).toBe("2026-12-01T03:00:00.000Z");
    expect(instanteDeBrasilia("01/12/2026")).toBeNull();
    expect(paraCampoDeBrasilia("2026-12-01T03:00:00.000Z")).toBe("2026-12-01T00:00");
    expect(paraCampoDeBrasilia(null)).toBe("");
  });

  it("lê do banco e falha fechada para a jornada antiga", async () => {
    expect(await lerVirada(banco({ virada: ONTEM }).cliente)).toEqual({ programadaPara: ONTEM, ativa: true });
    expect(await lerVirada(banco({ virada: AMANHA }).cliente)).toEqual({ programadaPara: AMANHA, ativa: false });
    expect(await lerVirada(banco({ virada: "lixo" }).cliente)).toEqual({ programadaPara: null, ativa: false });
    expect(await jornadaSemTrial(banco().cliente)).toBe(false);
    const quebrado = { from: () => { throw new Error("sem tabela"); } } as unknown as SupabaseClient;
    expect(await jornadaSemTrial(quebrado)).toBe(false);
  });
});

describe("o teste deixa de nascer — e só para família nova", () => {
  it("sem virada: chama a RPC como sempre (caso legítimo intacto)", async () => {
    const { cliente, rpcs } = banco();
    const r = await iniciarTrial(cliente, FAMILIA);
    expect(rpcs).toEqual(["iniciar_trial_se_apto"]);
    expect(r).toEqual({ iniciado: true, motivo: "iniciado" });
  });

  it("virada valendo, família sem linha: NÃO chama a RPC e não concede", async () => {
    const { cliente, rpcs } = banco({ virada: ONTEM });
    const r = await iniciarTrial(cliente, FAMILIA);
    expect(rpcs).toEqual([]);
    expect(r).toEqual({ iniciado: false, motivo: "sem_trial_jornada_nova" });
  });

  it("virada valendo, família com linha: a RPC decide (direito de legado preservado)", async () => {
    const { cliente, rpcs } = banco({ virada: ONTEM, acesso: { status: "trialing", trial_ends_at: ONTEM } });
    await iniciarTrial(cliente, FAMILIA);
    expect(rpcs).toEqual(["iniciar_trial_se_apto"]);
  });

  it("virada valendo e leitura falha: na dúvida, não concede", async () => {
    const { cliente, rpcs } = banco({ virada: ONTEM, erroAcesso: true });
    const r = await iniciarTrial(cliente, FAMILIA);
    expect(rpcs).toEqual([]);
    expect(r).toEqual({ iniciado: false, motivo: "erro" });
  });
});

describe("a Ayla não promete dias grátis depois da virada", () => {
  it("sem virada, o fato é o de sempre", async () => {
    expect(await fatosComerciaisParaFamilia(banco().cliente, FAMILIA)).toBe(FATOS_COMERCIAIS);
  });

  it("com virada, o fato diz que não há teste — sem número de dias", async () => {
    const texto = await fatosComerciaisParaFamilia(banco({ virada: ONTEM }).cliente, FAMILIA);
    expect(texto).toBe(FATOS_COMERCIAIS_SEM_TRIAL);
    expect(texto).not.toMatch(/\d+\s*dias/);
    expect(texto).toMatch(/não oferece teste grátis/);
  });

  it("com virada, a participante da Black Friday mantém o fato individual", async () => {
    const texto = await fatosComerciaisParaFamilia(
      banco({
        virada: ONTEM,
        participacaoBf: { trial_fim_em: "2026-12-10T03:00:00Z", oferta_fim_exclusivo: "2026-12-12T03:00:00Z" },
      }).cliente,
      FAMILIA,
    );
    expect(texto.startsWith(FATOS_COMERCIAIS_SEM_TRIAL)).toBe(true);
    expect(texto).toMatch(/FATO INDIVIDUAL BLACK FRIDAY 2026/);
    expect(texto).toMatch(/2026-12-10/);
  });

  it("modo pós-Trial: quem nunca teve teste não ouve que o teste terminou", () => {
    const novo = blocoPosTrial({ nomeCrianca: "Nina", rotulos: [], fatos: 0, semTesteAnterior: true });
    expect(novo).not.toMatch(/TERMINOU/);
    // A ordem de DIZER que terminou sai; fica só a proibição.
    expect(novo).not.toMatch(/sem rodeio, que o período gratuito terminou/);
    expect(novo).toMatch(/nunca diga que um período gratuito terminou/);
    expect(novo).toMatch(/AINDA NÃO ASSINOU/);
    expect(novo).toMatch(/escolher um plano/);
  });

  it("modo pós-Trial: quem teve teste recebe o texto de sempre", () => {
    const antigo = blocoPosTrial({ nomeCrianca: "Nina", rotulos: [], fatos: 0 });
    expect(antigo).toMatch(/o período de teste desta família TERMINOU/);
    expect(antigo).toMatch(/que o período gratuito terminou/);
    expect(antigo).toBe(blocoPosTrial({ nomeCrianca: "Nina", rotulos: [], fatos: 0, semTesteAnterior: false }));
  });

  it("número desconhecido: sem virada fala de teste; com virada, de criar a conta", () => {
    expect(textoParaDesconhecido("https://x/signup")).toMatch(/começar o teste/);
    const novo = textoParaDesconhecido("https://x/signup", true);
    expect(novo).not.toMatch(/teste/);
    expect(novo).toMatch(/criar a conta/);
    expect(novo).toMatch(/este mesmo número/);
  });
});

describe("quem nunca teve teste — e quem teve", () => {
  it("sem linha, ou só a linha canceled do checkout não pago: nunca teve", () => {
    expect(nuncaTeveTeste(null)).toBe(true);
    expect(nuncaTeveTeste({ status: "canceled" })).toBe(true);
  });

  it("qualquer sinal de teste, cortesia ou past_due: teve (texto antigo)", () => {
    expect(nuncaTeveTeste({ status: "trialing", trial_ends_at: ONTEM })).toBe(false);
    expect(nuncaTeveTeste({ status: "canceled", trial_ends_at: ONTEM })).toBe(false);
    expect(nuncaTeveTeste({ status: "past_due" })).toBe(false);
    expect(nuncaTeveTeste({ status: "trialing", cortesia: true })).toBe(false);
    expect(nuncaTeveTeste({ status: "active" })).toBe(false);
  });

  it("familiaSemTesteAnterior só diz sim com a virada valendo", async () => {
    expect(await familiaSemTesteAnterior(banco().cliente, FAMILIA)).toBe(false);
    expect(await familiaSemTesteAnterior(banco({ virada: ONTEM }).cliente, FAMILIA)).toBe(true);
    expect(
      await familiaSemTesteAnterior(
        banco({ virada: ONTEM, acesso: { status: "trialing", trial_ends_at: ONTEM } }).cliente,
        FAMILIA,
      ),
    ).toBe(false);
    expect(await familiaSemTesteAnterior(banco({ virada: ONTEM, erroAcesso: true }).cliente, FAMILIA)).toBe(false);
  });
});

describe("/precos depois da virada", () => {
  it("visitante: nenhum 'grátis' no botão nem na manchete, e vai ao cadastro", () => {
    const c = ctaDoEstado("visitante", 7, true);
    expect(c.destino).toBe("/signup");
    expect(`${c.rotulo} ${c.hero.titulo} ${c.hero.destaque} ${c.hero.sub}`).not.toMatch(/grátis|teste|sem cartão/i);
  });

  it("cadastrada sem plano vai à assinatura, não a um novo cadastro", () => {
    const c = ctaDoEstado("cadastrada_sem_plano", 7, true);
    expect(c.destino).toBe("/assinatura");
    expect(`${c.rotulo} ${c.hero.titulo} ${c.nota}`).not.toMatch(/grátis|teste/i);
  });

  it("os outros estados não mudam com a virada", () => {
    for (const e of ["em_trial", "trial_vencido", "assinante"] as EstadoComercial[]) {
      expect(ctaDoEstado(e, 7, true)).toEqual(ctaDoEstado(e, 7, false));
    }
  });

  it("sem virada, o visitante vê o de sempre", () => {
    expect(ctaDoEstado("visitante").rotulo).toBe("Começar 7 dias grátis");
  });
});
