import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * O ponto de entrada único dos dois canais. O que se testa aqui é o
 * COMPORTAMENTO DE FRONTEIRA — flag, falha, vazio, instrumentação —, porque é
 * disso que depende a promessa de que ligar a BIA não pode quebrar a Ayla.
 */

/** Evento logado, no formato que os testes inspecionam. */
type EventoLogado = {
  kind: string;
  severity?: string;
  payload?: Record<string, unknown>;
};

const logEvent = vi.fn<(evt: EventoLogado) => Promise<void>>(async () => {});
const buscar =
  vi.fn<
    (supabase: unknown, ctx: { dominio?: string | null }, opcoes?: unknown) => Promise<unknown>
  >();

vi.mock("@/lib/log", () => ({ logEvent: (evt: EventoLogado) => logEvent(evt) }));
vi.mock("./retriever", () => ({
  buscarConhecimentosBIA: (s: unknown, c: { dominio?: string | null }, o?: unknown) =>
    buscar(s, c, o),
}));

const { carregarBlocoBia, inferirDominio } = await import("./contexto-ayla");

const supabase = {} as SupabaseClient;

function resultado(tipo = "estrategia", score = 60) {
  return {
    chunk: {
      id: "abc123",
      nucleo: "sono",
      secao: "TEMA 6",
      titulo: "TEMA 6",
      tipo_conhecimento: tipo,
      faixa_etaria_min_meses: null,
      faixa_etaria_max_meses: null,
      faixa_rotulo: null,
      situacoes_relacionadas: [],
      diagnosticos_relacionados: [],
      nivel_de_cautela: "baixo",
      muda_conduta: null,
      texto_original: "Mantenha a interação mínima durante o despertar noturno.",
      revisao_pendente: false,
      ordem: 1,
    },
    score,
    motivos: [{ codigo: "dominio", descricao: "domínio", peso: 50 }],
    explicacao: "domínio",
  };
}

const base = {
  supabase,
  familyId: "fam-1",
  contexto: { idadeAnos: 5, textoDaConversa: "ela acorda toda madrugada" },
} as const;

beforeEach(() => {
  logEvent.mockClear();
  buscar.mockReset();
  delete process.env.BIA_PROMPT_ENABLED;
});

afterEach(() => {
  delete process.env.BIA_PROMPT_ENABLED;
});

describe("feature flag", () => {
  it("DESLIGADA por padrão: não consulta o banco e devolve vazio", async () => {
    const r = await carregarBlocoBia({ ...base, canal: "web" });
    expect(r).toBe("");
    expect(buscar).not.toHaveBeenCalled();
    // Nem loga: não houve consulta.
    expect(logEvent).not.toHaveBeenCalled();
  });

  it("valor inesperado na variável mantém tudo desligado", async () => {
    for (const v of ["", "0", "false", "sim", "on"]) {
      process.env.BIA_PROMPT_ENABLED = v;
      expect(await carregarBlocoBia({ ...base, canal: "web" })).toBe("");
    }
    expect(buscar).not.toHaveBeenCalled();
  });

  it("ligada: consulta e devolve o bloco", async () => {
    process.env.BIA_PROMPT_ENABLED = "1";
    buscar.mockResolvedValue([resultado()]);
    const r = await carregarBlocoBia({ ...base, canal: "whatsapp" });
    expect(buscar).toHaveBeenCalledTimes(1);
    expect(r).toContain("<conhecimento_de_apoio>");
  });
});

describe("falha segura", () => {
  beforeEach(() => {
    process.env.BIA_PROMPT_ENABLED = "1";
  });

  it("erro do retriever nunca propaga — devolve vazio", async () => {
    buscar.mockRejectedValue(new Error("banco fora"));
    await expect(carregarBlocoBia({ ...base, canal: "web" })).resolves.toBe("");
  });

  it("erro é registrado para investigação", async () => {
    buscar.mockRejectedValue(new Error("banco fora"));
    await carregarBlocoBia({ ...base, canal: "web" });
    const evt = logEvent.mock.calls.at(-1)![0];
    expect(evt.kind).toBe("bia_recuperacao_falhou");
    expect(evt.severity).toBe("warn");
  });

  it("busca vazia NÃO gera bloco vazio no prompt", async () => {
    buscar.mockResolvedValue([]);
    expect(await carregarBlocoBia({ ...base, canal: "web" })).toBe("");
  });

  it("busca vazia ainda assim é registrada (é sinal de qualidade)", async () => {
    buscar.mockResolvedValue([]);
    await carregarBlocoBia({ ...base, canal: "web" });
    const evt = logEvent.mock.calls.at(-1)![0];
    expect(evt.payload!.vazio).toBe(true);
    expect(evt.payload!.consultada).toBe(true);
  });
});

describe("instrumentação", () => {
  beforeEach(() => {
    process.env.BIA_PROMPT_ENABLED = "1";
  });

  it("registra o que é preciso para avaliar a recuperação", async () => {
    buscar.mockResolvedValue([resultado()]);
    await carregarBlocoBia({ ...base, canal: "whatsapp" });

    const evt = logEvent.mock.calls.at(-1)![0];
    expect(evt.kind).toBe("bia_recuperacao");
    const p = evt.payload!;
    expect(p.canal).toBe("whatsapp");
    expect(p.consultada).toBe(true);
    expect(p.dominio).toBe("sono"); // inferido de "acorda toda madrugada"
    expect(p.nucleos).toEqual(["sono"]);
    expect(p.chunks).toEqual([
      { id: "abc123", tipo: "estrategia", score: 60, motivos: ["dominio"] },
    ]);
    expect(typeof p.chars).toBe("number");
    expect(typeof p.tokens_aprox).toBe("number");
    expect(typeof p.ms).toBe("number");
    expect(p.conflito).toBe(false);
    expect(p.vazio).toBe(false);
  });

  it("NÃO registra a conversa da família nem o texto dos chunks", async () => {
    buscar.mockResolvedValue([resultado()]);
    await carregarBlocoBia({
      ...base,
      canal: "web",
      contexto: {
        idadeAnos: 5,
        textoDaConversa: "SEGREDO DA FAMILIA que não pode vazar no log",
      },
    });
    const bruto = JSON.stringify(logEvent.mock.calls.at(-1)?.[0]);
    expect(bruto).not.toContain("SEGREDO DA FAMILIA");
    expect(bruto).not.toContain("Mantenha a interação mínima");
  });

  it("conflito com Boa Prática sobe para warn (persiste em eventos_app)", async () => {
    buscar.mockResolvedValue([
      resultado(),
      {
        ...resultado(),
        chunk: {
          ...resultado().chunk,
          id: "cv",
          tipo_conhecimento: "regra_operacional",
          texto_original:
            "SE a criança evita contato visual ENTÃO não forçar o olhar — é sobrecarga visual-social.",
        },
      },
    ]);

    const r = await carregarBlocoBia({
      ...base,
      canal: "web",
      textosBoasPraticas: [
        "Estabeleça contato visual frequente e observe se ele mantém o olhar.",
      ],
    });

    const evt = logEvent.mock.calls.at(-1)![0];
    expect(evt.severity).toBe("warn");
    expect(evt.payload!.conflito).toBe(true);
    expect(evt.payload!.conflito_temas).toContain("contato_visual");
    // E o modelo é instruído a seguir o mais cauteloso.
    expect(r).toMatch(/MAIS CAUTELOSA/);
  });
});

describe("os dois canais usam o MESMO serviço", () => {
  beforeEach(() => {
    process.env.BIA_PROMPT_ENABLED = "1";
  });

  it("mesma entrada → mesmo bloco, mude só o canal", async () => {
    buscar.mockResolvedValue([resultado()]);
    const wpp = await carregarBlocoBia({ ...base, canal: "whatsapp" });
    buscar.mockResolvedValue([resultado()]);
    const web = await carregarBlocoBia({ ...base, canal: "web" });
    expect(wpp).toBe(web);
  });

  it("as mesmas opções de recuperação são usadas nos dois", async () => {
    buscar.mockResolvedValue([resultado()]);
    await carregarBlocoBia({ ...base, canal: "whatsapp" });
    const opcoesWpp = buscar.mock.calls.at(-1)?.[2];
    await carregarBlocoBia({ ...base, canal: "web" });
    const opcoesWeb = buscar.mock.calls.at(-1)?.[2];
    expect(opcoesWpp).toEqual(opcoesWeb);
  });
});

describe("inferirDominio", () => {
  it("mapeia conversa livre para o domínio do Kolo Vivo", () => {
    expect(inferirDominio("ela acorda toda madrugada")).toBe("sono");
    expect(inferirDominio("ele não fala nenhuma palavra")).toBe("comunicacao");
    expect(inferirDominio("só come coisas crocantes")).toBe("nutricional");
    expect(inferirDominio("ele comeu tudo hoje")).toBe("nutricional");
  });

  it("não confunde 'começa' com 'come' — era uma crise virando alimentação", () => {
    // `\b` trata "ç" como separador, então "começa" casava com "come".
    // "chorar" (emocional) vem antes de "sair de casa" (rotina) na lista de
    // pistas; qualquer um dos dois serve — o que não pode é alimentação.
    expect(inferirDominio("na hora de sair de casa ele trava e começa a chorar")).toBe("emocional");
    expect(inferirDominio("começa a gritar do nada")).not.toBe("nutricional");
    // E a preposição "com" nunca pode puxar alimentação.
    expect(inferirDominio("ele foi com a irmã")).toBeNull();
  });

  it("na dúvida devolve null — errar o domínio é pior que não ter", () => {
    expect(inferirDominio("oi, tudo bem?")).toBeNull();
    expect(inferirDominio("")).toBeNull();
    expect(inferirDominio(null)).toBeNull();
  });

  it("um domínio explícito do chamador tem precedência sobre a inferência", async () => {
    process.env.BIA_PROMPT_ENABLED = "1";
    buscar.mockResolvedValue([]);
    await carregarBlocoBia({
      ...base,
      canal: "web",
      contexto: { dominio: "motor", textoDaConversa: "ela acorda toda madrugada" },
    });
    const ctxUsado = buscar.mock.calls.at(-1)?.[1] as { dominio: string };
    expect(ctxUsado.dominio).toBe("motor");
  });
});

describe("desabafo puro não consulta a BIA", () => {
  beforeEach(() => {
    process.env.BIA_PROMPT_ENABLED = "1";
  });

  it("acolhimento sem conteúdo concreto: bloco vazio e nenhuma ida ao banco", async () => {
    const r = await carregarBlocoBia({
      ...base,
      canal: "web",
      contexto: { idadeAnos: 6, textoDaConversa: "hoje eu não aguento mais, tô exausta" },
    });
    expect(r).toBe("");
    expect(buscar).not.toHaveBeenCalled();
  });

  it("fica registrado por que não consultou", async () => {
    await carregarBlocoBia({
      ...base,
      canal: "web",
      contexto: { idadeAnos: 6, textoDaConversa: "tô muito cansada essa semana" },
    });
    const evt = logEvent.mock.calls.at(-1)![0];
    expect(evt.payload!.consultada).toBe(false);
    expect(evt.payload!.motivo).toBe("desabafo_puro");
    expect(evt.payload!.vazio).toBe(true);
    // E nada da conversa vaza no registro.
    expect(JSON.stringify(evt)).not.toContain("cansada");
  });

  it("o mesmo desabafo COM problema concreto volta a consultar", async () => {
    buscar.mockResolvedValue([resultado()]);
    const r = await carregarBlocoBia({
      ...base,
      canal: "web",
      contexto: {
        idadeAnos: 6,
        textoDaConversa: "tô exausta, ele acorda toda madrugada",
      },
    });
    expect(buscar).toHaveBeenCalledTimes(1);
    expect(r).toContain("<conhecimento_de_apoio>");
  });
});
