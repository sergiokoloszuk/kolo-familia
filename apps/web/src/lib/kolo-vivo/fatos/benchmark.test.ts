import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CASOS, CASOS_SEM_EXTRACAO } from "./__fixtures__/conversas-benchmark";

/**
 * AUDITORIA DETERMINÍSTICA — a bateria de 50 conversas passando pela camada que
 * não depende de IA nem de banco (adaptador → serviço).
 *
 * O que este arquivo é: uma linha de base medida. Ele **afirma os invariantes
 * que não podem quebrar** e **mede o resto**, imprimindo o resultado. Um
 * benchmark que falha a cada defeito conhecido vira ruído e alguém desliga —
 * então defeito conhecido aparece na métrica, não no vermelho.
 *
 * O que ele NÃO mede: a qualidade da extração. `extracao` no fixture é o que o
 * extrator DEVERIA produzir; medir o que ele produz de fato exige rodar IA, e é
 * a Fase 4. Este arquivo mede o que acontece DEPOIS da extração.
 */

const logEvent = vi.fn<(evt: unknown) => Promise<void>>(async () => {});
vi.mock("@/lib/log", () => ({ logEvent: (e: unknown) => logEvent(e) }));

const { registrarFatoPerfil } = await import("./registrar");
const { candidatoDeItemKoloVivo } = await import("./adaptador");

function bancoFalso() {
  const linhas: Record<string, unknown>[] = [];
  const chaves = new Set<string>();
  const client = {
    from: () => ({
      upsert: (l: Record<string, unknown>) => ({
        select: async () => {
          const k = String(l.idempotency_key);
          if (chaves.has(k)) return { data: [], error: null };
          chaves.add(k);
          linhas.push(l);
          return { data: [{ id: `f${linhas.length}` }], error: null };
        },
      }),
    }),
  } as unknown as SupabaseClient;
  return { client, linhas };
}

const FAM = "fam-benchmark";
const MEMBRO = "membro-benchmark";

/** Roda a bateria inteira e devolve os fatos que seriam gravados. */
async function rodarBateria() {
  const { client, linhas } = bancoFalso();
  const porCaso = new Map<string, Record<string, unknown>[]>();

  for (const caso of CASOS) {
    const antes = linhas.length;
    for (const [i, item] of caso.extracao.entries()) {
      await registrarFatoPerfil(
        client,
        candidatoDeItemKoloVivo({
          familyId: FAM,
          membroId: MEMBRO,
          campo: item.campo,
          subcampo: item.subcampo ?? null,
          texto: item.texto,
          verificationStatus: caso.esperado.verificationStatus,
          proveniencia: {
            sourceType: caso.esperado.sourceType,
            channel: caso.canal,
            messageId: caso.canal === "whatsapp" ? `${caso.id}-${i}` : null,
            actorId: caso.canal === "diario" ? "user-benchmark" : null,
          },
        }),
      );
    }
    porCaso.set(caso.id, linhas.slice(antes));
  }
  return { linhas, porCaso };
}

beforeEach(() => {
  logEvent.mockClear();
  process.env.PERFIL_FATOS_SHADOW_WRITE = "1";
});

describe("invariantes — quebrar aqui é regressão", () => {
  it("inferência da IA NUNCA vira relato, em nenhum caso da bateria", async () => {
    const { linhas } = await rodarBateria();
    const inferencias = linhas.filter((l) => l.source_type === "ai_inference");
    for (const f of inferencias) {
      expect(f.verification_status, String(f.conceito)).toBe("inferred");
    }
  });

  it("nenhum fato nasce como pattern ou trait — generalizar é da maturação", async () => {
    const { linhas } = await rodarBateria();
    for (const f of linhas) {
      expect(["pattern", "trait"]).not.toContain(f.fact_kind);
    }
  });

  it("todo fato tem pessoa, canal, tipo de fonte, data e versão", async () => {
    const { linhas } = await rodarBateria();
    for (const f of linhas) {
      expect(f.membro_atipico_id).toBeTruthy();
      expect(f.source_channel).toBeTruthy();
      expect(f.source_type).toBeTruthy();
      expect(f.observado_em).toBeTruthy();
      expect(f.extractor_version).toBeTruthy();
    }
  });

  it("o diário nunca inventa mensagem de origem", async () => {
    const { linhas } = await rodarBateria();
    for (const f of linhas.filter((l) => l.source_channel === "diario")) {
      expect(f.source_message_id).toBeNull();
      expect(f.source_actor_id).toBeTruthy();
    }
  });

  it("nenhuma afirmação aparece nos logs operacionais", async () => {
    await rodarBateria();
    const bruto = JSON.stringify(logEvent.mock.calls);
    for (const caso of CASOS) {
      for (const item of caso.extracao) {
        expect(bruto).not.toContain(item.texto);
      }
    }
  });

  it("com a flag desligada, a bateria inteira não grava nada", async () => {
    delete process.env.PERFIL_FATOS_SHADOW_WRITE;
    const { linhas } = await rodarBateria();
    expect(linhas).toHaveLength(0);
  });
});

describe("paridade estrutural web × WhatsApp", () => {
  it("a mesma informação sensorial produz domínio e conceito iguais", async () => {
    const { porCaso } = await rodarBateria();
    const wpp = porCaso.get("sens-01")![0];
    const web = porCaso.get("sens-02")![0];

    expect(web.dominio).toBe(wpp.dominio);
    expect(web.conceito).toBe(wpp.conceito);
    expect(web.fact_kind).toBe(wpp.fact_kind);
    // A proveniência é o que DEVE diferir.
    expect(web.source_channel).toBe("web");
    expect(wpp.source_channel).toBe("whatsapp");
    expect(web.idempotency_key).not.toBe(wpp.idempotency_key);
  });
});

describe("linha de base medida", () => {
  it("registra as métricas da bateria", async () => {
    const { linhas } = await rodarBateria();

    const total = linhas.length;
    const conceitoAmplo = linhas.filter((l) => l.conceito === l.dominio).length;
    const porStatus = new Map<string, number>();
    const porCanal = new Map<string, number>();
    const porTipo = new Map<string, number>();
    for (const l of linhas) {
      const s = String(l.verification_status);
      const c = String(l.source_channel);
      const t = String(l.fact_kind);
      porStatus.set(s, (porStatus.get(s) ?? 0) + 1);
      porCanal.set(c, (porCanal.get(c) ?? 0) + 1);
      porTipo.set(t, (porTipo.get(t) ?? 0) + 1);
    }

    const pct = (n: number) => `${Math.round((n / total) * 100)}%`;
    const linha = (m: Map<string, number>) =>
      [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(" ");

    console.log(
      [
        "",
        "── BENCHMARK DA MEMÓRIA · linha de base ──────────────",
        `casos: ${CASOS.length}   fatos gravados: ${total}`,
        `sem extração esperada: ${CASOS_SEM_EXTRACAO.length}`,
        `conceito === domínio: ${conceitoAmplo} (${pct(conceitoAmplo)})`,
        `verification_status: ${linha(porStatus)}`,
        `canal: ${linha(porCanal)}`,
        `fact_kind: ${linha(porTipo)}`,
        "──────────────────────────────────────────────────────",
      ].join("\n"),
    );

    // Sanidade: a bateria produz volume suficiente para as métricas valerem.
    expect(total).toBeGreaterThan(40);
  });

  it("os casos marcados como defeito conhecido continuam catalogados", async () => {
    const comDefeito = CASOS.filter((c) => c.esperado.exponhaDefeito);
    // Se este número cair, ou o defeito foi corrigido (bom) ou alguém apagou o
    // caso (ruim). Os dois merecem uma olhada consciente.
    expect(comDefeito.length).toBeGreaterThan(10);
    for (const c of comDefeito) {
      expect(c.esperado.exponhaDefeito!.length).toBeGreaterThan(20);
    }
  });
});
