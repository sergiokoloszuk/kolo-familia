import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { reservarConviteAssinatura } from "./orchestrator";
import { assinaturaLiberada } from "@/lib/auth/assinatura";

const ORCH = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");

/**
 * FASE 0A — COOLDOWN REAL DO CONVITE DE ASSINATURA.
 *
 * Rochelle (família 7c764314), 23/07/2026: 4 convites em 6 SEGUNDOS (uma rajada de 4 desabafos) e 15
 * no dia. A função que parecia o dedup — `convidouAssinarRecente`, comentada
 * como "dedup do convite" — não deduplicava nada: o retorno só escolhia entre o
 * texto longo e o curto, e o envio saía sempre. Toda mensagem que entrava de
 * uma família sem acesso virava um convite.
 *
 * O gate de acesso estava CERTO em 9 de 9 famílias. O que faltava era cooldown.
 */

// ————————————————————————————————————————————————————————————
// Supabase de mentira: duas tabelas em memória, encadeamento igual ao real.
// A rajada é o que interessa — várias invocações LEEM antes de qualquer
// escrita, então o fake precisa deixar isso acontecer de verdade.
// ————————————————————————————————————————————————————————————
type Linha = Record<string, unknown>;

function fakeSupabase(inicial: { mensagens?: Linha[]; reservas?: Linha[] } = {}) {
  const tabelas: Record<string, Linha[]> = {
    ayla_messages: [...(inicial.mensagens ?? [])],
    ayla_send_log: [...(inicial.reservas ?? [])],
  };
  let seq = 0;
  // Cada insert avança 1ms a partir de agora: "quem chegou antes" fica
  // decidível (o relógio real empata em milissegundos numa rajada) e as linhas
  // caem dentro da janela de rajada, como cairiam em produção.
  let relogio = Date.now();

  const query = (nome: string) => {
    let filtros: Array<(l: Linha) => boolean> = [];
    let limite: number | null = null;
    const rodar = () => {
      const r = tabelas[nome].filter((l) => filtros.every((f) => f(l)));
      return limite === null ? r : r.slice(0, limite);
    };
    const api: Record<string, unknown> = {
      select: () => api,
      eq: (c: string, v: unknown) => {
        filtros.push((l) => l[c] === v);
        return api;
      },
      gte: (c: string, v: string) => {
        filtros.push((l) => String(l[c]) >= v);
        return api;
      },
      limit: (n: number) => {
        limite = n;
        return Promise.resolve({ data: rodar(), error: null });
      },
      single: () => Promise.resolve({ data: rodar()[0] ?? null, error: null }),
      delete: () => {
        filtros = [];
        return {
          eq: (c: string, v: unknown) => {
            tabelas[nome] = tabelas[nome].filter((l) => l[c] !== v);
            return Promise.resolve({ error: null });
          },
        };
      },
      insert: (linha: Linha) => {
        const nova = {
          ...linha,
          id: `r${++seq}`,
          created_at: new Date(relogio++).toISOString(),
        };
        tabelas[nome].push(nova);
        const dep: Record<string, unknown> = {
          select: () => dep,
          single: () => Promise.resolve({ data: nova, error: null }),
          then: (f: (x: unknown) => unknown) => Promise.resolve({ error: null }).then(f),
        };
        return dep;
      },
      then: (f: (x: unknown) => unknown) =>
        Promise.resolve({ data: rodar(), error: null }).then(f),
    };
    return api;
  };

  const client = { from: (n: string) => query(n) } as unknown as SupabaseClient;
  return { client, tabelas };
}

const FAM = "fam-simone";
const nudgeEnviado = (minutosAtras: number): Linha => ({
  id: `m${minutosAtras}`,
  family_account_id: FAM,
  direcao: "outbound",
  tipo: "assinatura_nudge",
  created_at: new Date(Date.now() - minutosAtras * 60_000).toISOString(),
});

// ————————————————————————————————————————————————————————————
// A–G: os casos que definem PASSOU
// ————————————————————————————————————————————————————————————

describe("A–G · comportamento do cooldown", () => {
  it("A. trial vencido, nenhum convite recente → envia 1", async () => {
    const { client } = fakeSupabase();
    expect(await reservarConviteAssinatura(client, FAM)).toBe(true);
  });

  it("B. convite há menos de 12h → envia 0", async () => {
    const { client } = fakeSupabase({ mensagens: [nudgeEnviado(60)] });
    expect(await reservarConviteAssinatura(client, FAM)).toBe(false);
  });

  it("C. rajada de 4 inbounds simultâneos → 1 convite, não 4", async () => {
    // O caso real: 4 mensagens em 6 segundos. As 4 invocações leem o banco
    // antes de qualquer uma escrever a mensagem — só a reserva as separa.
    const { client } = fakeSupabase();
    const decisoes = await Promise.all(
      Array.from({ length: 4 }, () => reservarConviteAssinatura(client, FAM)),
    );
    expect(decisoes.filter(Boolean)).toHaveLength(1);
  });

  it("C2. rajada de 15 (o dia inteiro da Rochelle) → 1", async () => {
    const { client } = fakeSupabase();
    const decisoes = await Promise.all(
      Array.from({ length: 15 }, () => reservarConviteAssinatura(client, FAM)),
    );
    expect(decisoes.filter(Boolean)).toHaveLength(1);
  });

  it("D. o vencedor da rajada não bloqueia a si mesmo; os perdedores somem", async () => {
    const { client, tabelas } = fakeSupabase();
    await Promise.all(Array.from({ length: 4 }, () => reservarConviteAssinatura(client, FAM)));
    // Só a reserva vencedora fica. Reserva órfã de perdedor silenciaria a
    // família por um convite que nunca existiu.
    expect(tabelas.ayla_send_log).toHaveLength(1);
  });

  it("E. trial vencido sem pagar → o convite legítimo continua saindo", async () => {
    // O convite de 13h atrás não bloqueia: a janela é de 12h.
    const { client } = fakeSupabase({ mensagens: [nudgeEnviado(13 * 60)] });
    expect(await reservarConviteAssinatura(client, FAM)).toBe(true);
  });

  it("F. passadas as 12h, volta a ser elegível — e 11h59 ainda não", async () => {
    const { client: c1 } = fakeSupabase({ mensagens: [nudgeEnviado(11 * 60 + 59)] });
    expect(await reservarConviteAssinatura(c1, FAM)).toBe(false);
    const { client: c2 } = fakeSupabase({ mensagens: [nudgeEnviado(12 * 60 + 1)] });
    expect(await reservarConviteAssinatura(c2, FAM)).toBe(true);
  });

  it("G. família ativa nunca chega aqui — o gate de acesso não foi tocado", () => {
    // 9/9 corretos no incidente. Esta fase não mexe em QUEM recebe.
    const agora = Date.now();
    expect(
      assinaturaLiberada({
        status: "trialing",
        trial_ends_at: new Date(agora - 86_400_000).toISOString(),
      } as never),
    ).toBe(false);
    expect(
      assinaturaLiberada({
        status: "trialing",
        trial_ends_at: new Date(agora + 86_400_000).toISOString(),
      } as never),
    ).toBe(true);
    expect(assinaturaLiberada({ status: "active" } as never)).toBe(true);
    expect(assinaturaLiberada(null)).toBe(false);
  });
});

describe("isolamento e falha", () => {
  it("o cooldown é por família — o convite de uma não cala a outra", async () => {
    const { client } = fakeSupabase({ mensagens: [nudgeEnviado(60)] });
    expect(await reservarConviteAssinatura(client, FAM)).toBe(false);
    expect(await reservarConviteAssinatura(client, "outra-familia")).toBe(true);
  });

  it("banco fora do ar na reserva → ENVIA (repetir é menos grave que emudecer)", async () => {
    const quebrado = {
      from: () => ({
        select: () => ({
          eq: () => ({ eq: () => ({ eq: () => ({ gte: () => ({ limit: async () => ({ data: [] }) }) }) }) }),
        }),
        insert: () => {
          throw new Error("connection reset");
        },
      }),
    } as unknown as SupabaseClient;
    expect(await reservarConviteAssinatura(quebrado, FAM)).toBe(true);
  });
});

// ————————————————————————————————————————————————————————————
// Invariantes estruturais — o que não pode voltar
// ————————————————————————————————————————————————————————————

describe("invariantes", () => {
  it("a função que só trocava a copy não existe mais", () => {
    // O comentário histórico cita o nome de propósito; o que não pode voltar
    // é a função — declaração ou chamada.
    expect(ORCH).not.toMatch(/function convidouAssinarRecente|convidouAssinarRecente\(/);
  });

  it("a decisão SUPRIME o envio — não escolhe texto", () => {
    const bloco = ORCH.slice(
      ORCH.indexOf("const podeConvidar = await reservarConviteAssinatura"),
      ORCH.indexOf("const link = await gerarMagicLink(supabase, { familyId: family.id"),
    );
    expect(bloco).toMatch(/if \(!podeConvidar\)/);
    expect(bloco).toMatch(/return \{ tratada: true, familia: family\.id \}/);
  });

  it("o estado vive no banco, não em memória de processo", () => {
    // Serverless: cada invocação é um processo. Cache local não veria a rajada.
    const fn = ORCH.slice(
      ORCH.indexOf("export async function reservarConviteAssinatura"),
      ORCH.indexOf("/** Avisa a admin"),
    );
    expect(fn).not.toMatch(/new Map\(|new Set\(|globalThis/);
  });

  it("as duas janelas são distintas: 12h para o convite, 2min para a rajada", () => {
    // Se a reserva olhasse 12h, uma reserva órfã calaria a família por 12h.
    expect(ORCH).toMatch(/JANELA_NUDGE_MS = 12 \* 60 \* 60 \* 1000/);
    expect(ORCH).toMatch(/JANELA_RAJADA_MS = 2 \* 60 \* 1000/);
  });

  it("o cooldown se apoia no envio que SAIU, não na tentativa", () => {
    const fn = ORCH.slice(
      ORCH.indexOf("export async function reservarConviteAssinatura"),
      ORCH.indexOf("/** Avisa a admin"),
    );
    expect(fn).toMatch(/from\("ayla_messages"\)[\s\S]{0,200}tipo", "assinatura_nudge"/);
    // `enviarEPersistir` só grava em ayla_messages quando `resultado.enviada`.
    expect(ORCH).toMatch(/if \(resultado\.enviada\) \{\s*\n\s*await supabase\.from\("ayla_messages"\)/);
  });

  it("a copy do convite não mudou", () => {
    expect(ORCH).toMatch(/Mas seu período grátis acabou/);
    expect(ORCH).toMatch(/O que você me contou fica tudo guardado/);
  });

  it("a variante curta saiu por ser inalcançável, não por decisão de copy", () => {
    expect(ORCH).not.toMatch(/🌿 Pra gente continuar, é só assinar aqui/);
    expect(ORCH).toMatch(/o ramo virou inalcançável/);
  });
});
