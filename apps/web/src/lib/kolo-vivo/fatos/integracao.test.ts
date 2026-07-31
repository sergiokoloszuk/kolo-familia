import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * TESTES DE INTEGRAÇÃO DOS CHAMADORES REAIS.
 *
 * A auditoria da Fase 2 achou dois defeitos que os testes do serviço não
 * pegavam — escopo que nenhum fluxo passava e status epistemológico que caía no
 * default errado — justamente porque testavam o serviço DIRETO. Aqui a entrada
 * é a função que a aplicação chama de verdade (`aplicarPropostaNoPerfil`,
 * `aplicarItensNoMembro`), e só o Supabase é falso.
 *
 * PARIDADE ENTRE CANAIS: web e WhatsApp têm rotas e adaptadores diferentes, e
 * isso está certo. O que precisa ser igual é o CONTRATO — a mesma informação
 * tem de produzir o mesmo domínio, conceito e natureza nos dois; só a
 * proveniência muda. É o que os testes de paridade cobram.
 */

const logEvent = vi.fn<(evt: unknown) => Promise<void>>(async () => {});
vi.mock("@/lib/log", () => ({ logEvent: (e: unknown) => logEvent(e) }));

const { aplicarPropostaNoPerfil } = await import("../aplicar");
const { aplicarItensNoMembro } = await import("../incorporar");
const { candidatoDeItemKoloVivo } = await import("./adaptador");
const { registrarFatoPerfil } = await import("./registrar");
const { definirResolvedorEscopo, restaurarResolvedorEscopo } = await import("./escopo-ativo");

/** Captura o que chegaria em `perfil_fatos`, e deixa o resto passar. */
function supabaseFalso() {
  const fatos: Record<string, unknown>[] = [];
  const chaves = new Set<string>();
  const client = {
    from: (tabela: string) => {
      if (tabela === "perfil_fatos") {
        return {
          upsert: (linha: Record<string, unknown>) => ({
            select: async () => {
              const k = String(linha.idempotency_key);
              if (chaves.has(k)) return { data: [], error: null };
              chaves.add(k);
              fatos.push(linha);
              return { data: [{ id: `f${fatos.length}` }], error: null };
            },
          }),
        };
      }
      // perfil_vivo_membro / perfil_vivo_familia — o caminho antigo segue.
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: null }) }),
        }),
        upsert: async () => ({ error: null }),
      };
    },
  } as unknown as SupabaseClient;
  return { client, fatos };
}

const itemSensorial = {
  camada: "camada1" as const,
  campo: "sensorial",
  subcampo: "hipersensibilidade_auditiva",
  texto: "Se incomoda muito com o barulho do liquidificador",
  operacao: "adicionar" as const,
};

beforeEach(() => {
  logEvent.mockClear();
  process.env.PERFIL_FATOS_SHADOW_WRITE = "1";
});
afterEach(() => {
  delete process.env.PERFIL_FATOS_SHADOW_WRITE;
  restaurarResolvedorEscopo();
});

describe("fluxo WEB manual (Guardar no Perfil)", () => {
  it("produz fato com pessoa, conceito, canal e status corretos", async () => {
    const { client, fatos } = supabaseFalso();
    await aplicarPropostaNoPerfil(client, {
      familyId: "fam-1",
      membroId: "membro-1",
      itens: [itemSensorial],
      fatos: {
        proveniencia: { sourceType: "caregiver_report", channel: "web" },
        verificationStatus: "confirmed",
      },
    });

    expect(fatos).toHaveLength(1);
    const f = fatos[0];
    expect(f.membro_atipico_id).toBe("membro-1");
    expect(f.dominio).toBe("sensorial");
    expect(f.conceito).toBe("sensorial.hipersensibilidade_auditiva");
    expect(f.source_channel).toBe("web");
    expect(f.source_type).toBe("caregiver_report");
    // Clique explícito em salvar é confirmação.
    expect(f.verification_status).toBe("confirmed");
    expect(f.fact_kind).toBe("statement");
    expect(f.escopo_tipo).toBe("sempre");
  });

  it("com a flag desligada não grava nada — nem tenta", async () => {
    delete process.env.PERFIL_FATOS_SHADOW_WRITE;
    const { client, fatos } = supabaseFalso();
    await aplicarPropostaNoPerfil(client, {
      familyId: "fam-1",
      membroId: "membro-1",
      itens: [itemSensorial],
      fatos: { proveniencia: { sourceType: "caregiver_report", channel: "web" } },
    });
    expect(fatos).toHaveLength(0);
  });

  it("sem o parâmetro de proveniência, o comportamento é o de antes", async () => {
    const { client, fatos } = supabaseFalso();
    await aplicarPropostaNoPerfil(client, {
      familyId: "fam-1",
      membroId: "membro-1",
      itens: [itemSensorial],
    });
    expect(fatos).toHaveLength(0);
  });
});

describe("fluxo WEB automático (extração da conversa)", () => {
  it("NUNCA grava como reported — a IA recortou, ninguém confirmou", async () => {
    const { client, fatos } = supabaseFalso();
    await aplicarPropostaNoPerfil(client, {
      familyId: "fam-1",
      membroId: "membro-1",
      itens: [itemSensorial],
      // Exatamente o que `ia/aprender.ts` passa.
      fatos: {
        proveniencia: {
          sourceType: "caregiver_report",
          channel: "web",
          conversationId: "conv-1",
        },
        verificationStatus: "uncertain",
      },
    });

    expect(fatos[0].verification_status).toBe("uncertain");
    expect(fatos[0].verification_status).not.toBe("reported");
    expect(fatos[0].verification_status).not.toBe("confirmed");
    expect(fatos[0].source_conversation_id).toBe("conv-1");
  });
});

describe("fluxo DIÁRIO", () => {
  it("grava com entrada manual, canal diário e autor autenticado", async () => {
    const { client, fatos } = supabaseFalso();
    await aplicarItensNoMembro(
      client,
      "fam-1",
      "membro-1",
      [itemSensorial],
      {
        proveniencia: {
          sourceType: "manual_entry",
          channel: "diario",
          actorId: "user-42",
        },
        verificationStatus: "confirmed",
      },
    );

    expect(fatos).toHaveLength(1);
    const f = fatos[0];
    expect(f.source_type).toBe("manual_entry");
    expect(f.source_channel).toBe("diario");
    expect(f.source_actor_id).toBe("user-42");
    // Não inventa mensagem: o diário não tem uma.
    expect(f.source_message_id).toBeNull();
    expect(f.conceito).toBe("sensorial.hipersensibilidade_auditiva");
  });

  it("salvar o MESMO diário de novo não duplica", async () => {
    const { client, fatos } = supabaseFalso();
    const origem = {
      proveniencia: {
        sourceType: "manual_entry" as const,
        channel: "diario" as const,
        actorId: "user-42",
      },
      observadoEm: "2026-07-31",
    };
    await aplicarItensNoMembro(client, "fam-1", "membro-1", [itemSensorial], origem);
    await aplicarItensNoMembro(client, "fam-1", "membro-1", [itemSensorial], origem);
    expect(fatos).toHaveLength(1);
  });

  it("a mesma observação em OUTRO dia é evidência nova", async () => {
    const { client, fatos } = supabaseFalso();
    const prov = {
      sourceType: "manual_entry" as const,
      channel: "diario" as const,
      actorId: "user-42",
    };
    await aplicarItensNoMembro(client, "fam-1", "membro-1", [itemSensorial], {
      proveniencia: prov,
      observadoEm: "2026-07-31",
    });
    await aplicarItensNoMembro(client, "fam-1", "membro-1", [itemSensorial], {
      proveniencia: prov,
      observadoEm: "2026-08-05",
    });
    expect(fatos).toHaveLength(2);
  });

  it("sem proveniência, o diário continua exatamente como era", async () => {
    const { client, fatos } = supabaseFalso();
    await aplicarItensNoMembro(client, "fam-1", "membro-1", [itemSensorial]);
    expect(fatos).toHaveLength(0);
  });
});

describe("escopo de campanha atravessa o fluxo REAL", () => {
  it("com campanha ativa, o fato nasce preso a ela", async () => {
    definirResolvedorEscopo(async () => ({ tipo: "campaign", id: "neuro-copa" }));
    const { client, fatos } = supabaseFalso();
    await aplicarPropostaNoPerfil(client, {
      familyId: "fam-1",
      membroId: "membro-1",
      // Campo real do perfil: o que não é campo válido é filtrado antes de
      // virar fato — foi assim que este teste pegou um erro do próprio teste.
      itens: [{ ...itemSensorial, texto: "Adorou o jogo do Brasil" }],
      fatos: { proveniencia: { sourceType: "caregiver_report", channel: "web" } },
    });

    expect(fatos[0].escopo_tipo).toBe("campaign");
    expect(fatos[0].escopo_id).toBe("neuro-copa");
    // O ponto: não vira característica permanente.
    expect(fatos[0].fact_kind).toBe("statement");
  });

  it("sem campanha, o escopo é o padrão — sem contaminação", async () => {
    const { client, fatos } = supabaseFalso();
    await aplicarPropostaNoPerfil(client, {
      familyId: "fam-1",
      membroId: "membro-1",
      itens: [itemSensorial],
      fatos: { proveniencia: { sourceType: "caregiver_report", channel: "web" } },
    });
    expect(fatos[0].escopo_tipo).toBe("sempre");
    expect(fatos[0].escopo_id).toBeNull();
  });

  it("o diário também recebe o escopo do resolvedor", async () => {
    definirResolvedorEscopo(async () => ({ tipo: "campaign", id: "neuro-copa" }));
    const { client, fatos } = supabaseFalso();
    await aplicarItensNoMembro(client, "fam-1", "membro-1", [itemSensorial], {
      proveniencia: { sourceType: "manual_entry", channel: "diario", actorId: "u" },
    });
    expect(fatos[0].escopo_tipo).toBe("campaign");
  });

  it("falha do resolvedor não impede o fato — escopo é enriquecimento", async () => {
    definirResolvedorEscopo(async () => {
      throw new Error("indisponível");
    });
    const { client, fatos } = supabaseFalso();
    await aplicarPropostaNoPerfil(client, {
      familyId: "fam-1",
      membroId: "membro-1",
      itens: [itemSensorial],
      fatos: { proveniencia: { sourceType: "caregiver_report", channel: "web" } },
    });
    expect(fatos).toHaveLength(1);
    expect(fatos[0].escopo_tipo).toBe("sempre");
  });
});

describe("paridade web × WhatsApp", () => {
  /**
   * O WhatsApp não passa por `aplicarPropostaNoPerfil` — tem o próprio
   * caminho no orquestrador. O que se prova aqui é que os dois chegam ao MESMO
   * contrato pelo mesmo adaptador; a diferença fica só na proveniência.
   */
  const mesmaInformacao = {
    campo: "sensorial",
    subcampo: "hipersensibilidade_auditiva",
    texto: "Se incomoda muito com o barulho do liquidificador",
  };

  it("mesma informação → mesmo domínio, conceito e natureza nos dois canais", async () => {
    const { client, fatos } = supabaseFalso();

    await registrarFatoPerfil(
      client,
      candidatoDeItemKoloVivo({
        familyId: "fam-1",
        membroId: "membro-1",
        ...mesmaInformacao,
        proveniencia: { sourceType: "caregiver_report", channel: "web" },
      }),
    );
    await registrarFatoPerfil(
      client,
      candidatoDeItemKoloVivo({
        familyId: "fam-1",
        membroId: "membro-1",
        ...mesmaInformacao,
        proveniencia: {
          sourceType: "caregiver_report",
          channel: "whatsapp",
          messageId: "msg-1",
        },
      }),
    );

    expect(fatos).toHaveLength(2);
    const [web, wpp] = fatos;
    expect(web.dominio).toBe(wpp.dominio);
    expect(web.conceito).toBe(wpp.conceito);
    expect(web.fact_kind).toBe(wpp.fact_kind);
    expect(web.afirmacao).toBe(wpp.afirmacao);
    // A proveniência é o que DEVE diferir.
    expect(web.source_channel).toBe("web");
    expect(wpp.source_channel).toBe("whatsapp");
    // E não são unificados: mensagens diferentes, evidências diferentes.
    expect(web.idempotency_key).not.toBe(wpp.idempotency_key);
  });

  it("sem subcampo, os dois canais degradam IGUAL — conceito mais amplo", async () => {
    const { client, fatos } = supabaseFalso();
    for (const channel of ["web", "whatsapp"] as const) {
      await registrarFatoPerfil(
        client,
        candidatoDeItemKoloVivo({
          familyId: "fam-1",
          membroId: "membro-1",
          campo: "sensorial",
          texto: `Barulho incomoda (${channel})`,
          proveniencia: { sourceType: "caregiver_report", channel },
        }),
      );
    }
    expect(fatos[0].conceito).toBe("sensorial");
    expect(fatos[1].conceito).toBe("sensorial");
    // Sem estrutura suficiente, o conceito amplo é o comportamento correto —
    // e o fato NÃO é promovido a padrão nem traço por causa disso.
    expect(fatos[0].fact_kind).toBe("statement");
  });

  it("fatos distintos no MESMO domínio produzem conceitos distintos", async () => {
    const { client, fatos } = supabaseFalso();
    for (const sub of ["hipersensibilidade_auditiva", "busca_proprioceptiva"]) {
      await registrarFatoPerfil(
        client,
        candidatoDeItemKoloVivo({
          familyId: "fam-1",
          membroId: "membro-1",
          campo: "sensorial",
          subcampo: sub,
          texto: `algo sobre ${sub}`,
          proveniencia: { sourceType: "caregiver_report", channel: "whatsapp" },
        }),
      );
    }
    expect(fatos[0].conceito).not.toBe(fatos[1].conceito);
    expect(fatos[0].dominio).toBe(fatos[1].dominio);
  });
});

describe("falha da escrita sombra não quebra o caminho principal", () => {
  it("erro no fact store não impede a atualização do perfil", async () => {
    const client = {
      from: (t: string) => {
        if (t === "perfil_fatos") throw new Error("fact store fora");
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
          upsert: async () => ({ error: null }),
        };
      },
    } as unknown as SupabaseClient;

    const r = await aplicarPropostaNoPerfil(client, {
      familyId: "fam-1",
      membroId: "membro-1",
      itens: [itemSensorial],
      fatos: { proveniencia: { sourceType: "caregiver_report", channel: "web" } },
    });
    // O caminho antigo concluiu normalmente.
    expect(r.erro).toBeUndefined();
    expect(r.itensMembro).toBe(1);
  });
});
