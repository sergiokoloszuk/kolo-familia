import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * O primeiro corte da Memória Viva. O que se prova aqui:
 *
 *  - com a flag desligada, NADA acontece (rollback é desligar a variável);
 *  - reprocessar a mesma mensagem não duplica, mas a família repetindo noutro
 *    dia gera evidência nova — a distinção que a maturação vai precisar;
 *  - a Neuro Copa nasce com escopo e NÃO vira traço permanente;
 *  - inferência da IA nunca entra como relato da família;
 *  - falha da escrita sombra não quebra nada;
 *  - a afirmação (conteúdo clínico sobre uma criança) nunca aparece no log.
 */

const logEvent = vi.fn<(evt: unknown) => Promise<void>>(async () => {});
vi.mock("@/lib/log", () => ({ logEvent: (e: unknown) => logEvent(e) }));

const { registrarFatoPerfil, chaveIdempotencia, normalizarAfirmacao, escritaSombraHabilitada } =
  await import("./registrar");
const { candidatoDeItemKoloVivo, derivarConceito, slug } = await import("./adaptador");
const { EXTRACTOR_VERSION } = await import("./tipos");

/** Supabase falso: guarda as linhas e simula o unique de idempotency_key. */
function supabaseFalso() {
  const linhas: Record<string, unknown>[] = [];
  const chaves = new Set<string>();
  const client = {
    from: () => ({
      upsert: (linha: Record<string, unknown>) => ({
        select: async () => {
          const k = String(linha.idempotency_key);
          if (chaves.has(k)) return { data: [], error: null }; // ignoreDuplicates
          chaves.add(k);
          linhas.push(linha);
          return { data: [{ id: `f${linhas.length}` }], error: null };
        },
      }),
    }),
  } as unknown as SupabaseClient;
  return { client, linhas };
}

const base = {
  familyId: "fam-1",
  membroId: "membro-1",
  conceito: "interesses.futebol",
  dominio: "interesses",
  afirmacao: "Adorou assistir ao jogo do Brasil",
  proveniencia: { sourceType: "caregiver_report" as const, channel: "whatsapp" as const },
};

beforeEach(() => {
  logEvent.mockClear();
  process.env.PERFIL_FATOS_SHADOW_WRITE = "1";
});
afterEach(() => {
  delete process.env.PERFIL_FATOS_SHADOW_WRITE;
});

describe("feature flag", () => {
  it("desligada por padrão: não escreve nada", async () => {
    delete process.env.PERFIL_FATOS_SHADOW_WRITE;
    expect(escritaSombraHabilitada({})).toBe(false);
    const { client, linhas } = supabaseFalso();
    const r = await registrarFatoPerfil(client, base);
    expect(r).toEqual({ status: "ignorado", motivo: "flag_desligada" });
    expect(linhas).toHaveLength(0);
    // Nem loga: não houve tentativa.
    expect(logEvent).not.toHaveBeenCalled();
  });

  it("valor inesperado mantém desligado", () => {
    for (const v of ["", "0", "false", "sim", "on"]) {
      expect(escritaSombraHabilitada({ PERFIL_FATOS_SHADOW_WRITE: v })).toBe(false);
    }
    expect(escritaSombraHabilitada({ PERFIL_FATOS_SHADOW_WRITE: "true" })).toBe(true);
  });
});

describe("Neuro Copa — cenário 1: durante a campanha", () => {
  it("nasce com escopo de campanha e NÃO como traço permanente", async () => {
    const { client, linhas } = supabaseFalso();
    await registrarFatoPerfil(client, {
      ...base,
      escopo: { tipo: "campaign", id: "neuro-copa" },
      observadoEm: "2026-06-20",
      proveniencia: { ...base.proveniencia, messageId: "msg-1" },
    });

    expect(linhas).toHaveLength(1);
    const f = linhas[0];
    expect(f.escopo_tipo).toBe("campaign");
    expect(f.escopo_id).toBe("neuro-copa");
    // O ponto do cenário: conservador. Nunca trait, nunca preference.
    expect(f.fact_kind).toBe("observation");
    expect(f.observado_em).toBe("2026-06-20");
    expect(f.source_type).toBe("caregiver_report");
    expect(f.source_channel).toBe("whatsapp");
    expect(f.source_message_id).toBe("msg-1");
    expect(f.verification_status).toBe("reported");
    expect(f.extractor_version).toBe(EXTRACTOR_VERSION);
  });
});

describe("Neuro Copa — cenário 2: depois da campanha", () => {
  it("interesse relatado de novo, fora do escopo, é fato NOVO", async () => {
    const { client, linhas } = supabaseFalso();
    await registrarFatoPerfil(client, {
      ...base,
      escopo: { tipo: "campaign", id: "neuro-copa" },
      observadoEm: "2026-06-20",
      proveniencia: { ...base.proveniencia, messageId: "msg-1" },
    });
    await registrarFatoPerfil(client, {
      ...base,
      afirmacao: "Continua querendo ver futebol",
      observadoEm: "2026-09-02",
      proveniencia: { ...base.proveniencia, messageId: "msg-2" },
    });

    expect(linhas).toHaveLength(2);
    expect(linhas[1].escopo_tipo).toBe("sempre");
    // Fica disponível para a maturação promover — que é trabalho de outra etapa.
    expect(linhas[1].observado_em).toBe("2026-09-02");
  });
});

describe("Neuro Copa — cenário 3: sugestão da Ayla", () => {
  it("inferência da IA NUNCA entra como relato da família", async () => {
    const { client, linhas } = supabaseFalso();
    await registrarFatoPerfil(client, {
      ...base,
      afirmacao: "Futebol pode servir como motivador",
      // Mesmo que o chamador tente marcar como relato, a fonte manda.
      verificationStatus: "reported",
      proveniencia: { sourceType: "ai_inference", channel: "whatsapp" },
    });

    expect(linhas[0].verification_status).toBe("inferred");
    expect(linhas[0].source_type).toBe("ai_inference");
    expect(linhas[0].fact_kind).toBe("observation");
  });
});

describe("idempotência", () => {
  it("reprocessar a MESMA mensagem não duplica", async () => {
    const { client, linhas } = supabaseFalso();
    const c = { ...base, proveniencia: { ...base.proveniencia, messageId: "msg-1" } };
    expect((await registrarFatoPerfil(client, c)).status).toBe("gravado");
    expect((await registrarFatoPerfil(client, c)).status).toBe("duplicado");
    expect(linhas).toHaveLength(1);
  });

  it("repetição LEGÍTIMA em outra mensagem é evidência nova", async () => {
    const { client, linhas } = supabaseFalso();
    // Mesma frase, mesma pessoa, mesmo conceito — mensagens diferentes.
    await registrarFatoPerfil(client, {
      ...base,
      proveniencia: { ...base.proveniencia, messageId: "msg-1" },
    });
    await registrarFatoPerfil(client, {
      ...base,
      proveniencia: { ...base.proveniencia, messageId: "msg-9" },
    });
    // Se isto colapsasse, a recorrência nunca existiria e a maturação futura
    // não teria do que promover.
    expect(linhas).toHaveLength(2);
  });

  it("sem mensagem de origem, a chave cai no DIA", () => {
    const c = { ...base, proveniencia: { sourceType: "manual_entry" as const } };
    expect(chaveIdempotencia(c, "2026-07-31")).toBe(chaveIdempotencia(c, "2026-07-31"));
    expect(chaveIdempotencia(c, "2026-07-31")).not.toBe(chaveIdempotencia(c, "2026-08-01"));
  });

  it("normalização ignora acento, caixa e pontuação", () => {
    expect(normalizarAfirmacao("Adorou o JOGO, do Brasil!")).toBe(
      normalizarAfirmacao("adorou o jogo do brasil"),
    );
  });
});

describe("validação", () => {
  it("sem membro não grava — evitar associar ao perfil errado", async () => {
    const { client, linhas } = supabaseFalso();
    const r = await registrarFatoPerfil(client, { ...base, membroId: null });
    expect(r).toEqual({ status: "ignorado", motivo: "sem_membro" });
    expect(linhas).toHaveLength(0);
  });

  it("afirmação vazia ou curta é rejeitada", async () => {
    const { client } = supabaseFalso();
    expect((await registrarFatoPerfil(client, { ...base, afirmacao: "  " })).status).toBe(
      "rejeitado",
    );
  });

  it("sem conceito é rejeitado", async () => {
    const { client } = supabaseFalso();
    expect((await registrarFatoPerfil(client, { ...base, conceito: "" })).status).toBe("rejeitado");
  });
});

describe("falha nunca quebra o turno", () => {
  it("erro do banco devolve status, não lança", async () => {
    const client = {
      from: () => ({
        upsert: () => ({
          select: async () => ({ data: null, error: { message: "conexão caiu" } }),
        }),
      }),
    } as unknown as SupabaseClient;
    const r = await registrarFatoPerfil(client, base);
    expect(r.status).toBe("falhou");
  });

  it("exceção inesperada também é contida", async () => {
    const client = {
      from: () => {
        throw new Error("boom");
      },
    } as unknown as SupabaseClient;
    await expect(registrarFatoPerfil(client, base)).resolves.toMatchObject({ status: "falhou" });
  });

  it("a falha é observável — não some em silêncio", async () => {
    const client = {
      from: () => {
        throw new Error("boom");
      },
    } as unknown as SupabaseClient;
    await registrarFatoPerfil(client, base);
    expect(logEvent).toHaveBeenCalled();
  });
});

describe("segurança dos logs", () => {
  it("a afirmação NUNCA aparece no evento operacional", async () => {
    const { client } = supabaseFalso();
    await registrarFatoPerfil(client, {
      ...base,
      afirmacao: "SEGREDO CLINICO DA CRIANCA que nao pode vazar",
    });
    const bruto = JSON.stringify(logEvent.mock.calls);
    expect(bruto).not.toContain("SEGREDO CLINICO");
    // Mas o conceito aparece — é o que permite medir sem expor.
    expect(bruto).toContain("interesses.futebol");
  });
});

describe("adaptador", () => {
  it("deriva conceito do campo e subcampo, sem IA nova", () => {
    expect(derivarConceito("comunicacao", "fala expressiva")).toBe("comunicacao.fala_expressiva");
    expect(derivarConceito("sensorial")).toBe("sensorial");
    expect(slug("Regulação Emocional")).toBe("regulacao_emocional");
  });

  it("o candidato sai conservador por padrão", () => {
    const c = candidatoDeItemKoloVivo({
      familyId: "f",
      membroId: "m",
      campo: "interesses",
      texto: "Gostou de futebol",
      proveniencia: { sourceType: "caregiver_report" },
    });
    expect(c.factKind).toBeUndefined(); // vira "observation" no serviço
    expect(c.observadoEmPreciso).toBe(false);
  });
});
