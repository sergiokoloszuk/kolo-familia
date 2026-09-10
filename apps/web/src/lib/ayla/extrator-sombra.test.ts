import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A SOMBRA NÃO PODE ESCREVER — PEND-194.
 *
 * ⚠️ O QUE ESTE ARQUIVO PROTEGE não é o resultado da medição: é o fato de ela
 * ser inofensiva. Uma medição que escreve no perfil de uma criança deixa de ser
 * medição e vira a migração inteira, sem revisão e sem flag. Por isso a metade
 * dos testes aqui é sobre o que NÃO acontece.
 */

const chamadasExtrair: unknown[] = [];
const eventos: Array<{ kind: string; payload?: Record<string, unknown>; severity?: string }> = [];
/** Toda operação de ESCRITA tentada no banco — tem de ficar vazia. */
const escritas: string[] = [];

/** Liga a falha do modelo para UMA chamada — sem precisar de spy. */
const falharNaProxima = { valor: false };

vi.mock("@/lib/conhecimento/extrair", () => ({
  extrairAtualizacoes: async (p: unknown) => {
    if (falharNaProxima.valor) {
      falharNaProxima.valor = false;
      throw new Error("modelo fora do ar");
    }
    chamadasExtrair.push(p);
    return {
      koloVivo: [
        { camada: "camada1", campo: "comunicacao", subcampo: "conversa", texto: "Conversa bem", operacao: "adicionar" },
        { camada: "camada1", campo: "emocional", subcampo: "outras", texto: "algo solto", operacao: "adicionar" },
        { camada: "camada2", campo: "dinamica", subcampo: null, texto: "família", operacao: "adicionar" },
      ],
      conquista: null,
      desafio: null,
      fatos: [],
      rejeitados: [{ candidato: {}, motivo: "subcampo_desconhecido", detalhe: "x" }],
    };
  },
}));

vi.mock("@/lib/kolo-vivo/incorporar", () => ({
  montarKoloVivoResumo: async () => "[criança/comunicacao] Outras observações: Conversa bem",
}));

vi.mock("@/lib/log", () => ({
  logEvent: async (e: { kind: string; payload?: Record<string, unknown>; severity?: string }) => {
    eventos.push(e);
  },
  logServerError: async () => {},
}));

const { medirExtratorEmSombra, extratorSombraLigado } = await import("./extrator-sombra");

/** Cliente que grita se alguém tentar escrever. */
const supabaseFalso = {
  from: (tabela: string) => ({
    insert: () => escritas.push(`insert:${tabela}`),
    update: () => escritas.push(`update:${tabela}`),
    upsert: () => escritas.push(`upsert:${tabela}`),
    delete: () => escritas.push(`delete:${tabela}`),
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
  }),
} as unknown as SupabaseClient;

const turno = {
  supabase: supabaseFalso,
  familyId: "fam-1",
  membroId: "membro-1",
  membro: { nome: "Mario", idade: 9, perfil: "TEA" },
  historico: [{ de: "mae" as const, texto: "ele trava quando fica bravo" }],
  entrada: "Quero ajudar ele a se comunicar melhor quando fica frustrado.",
  via: "whatsapp_texto" as const,
};

beforeEach(() => {
  chamadasExtrair.length = 0;
  eventos.length = 0;
  escritas.length = 0;
  process.env.KOLO_EXTRATOR_SOMBRA = "1";
});
afterEach(() => {
  delete process.env.KOLO_EXTRATOR_SOMBRA;
});

describe("a flag manda", () => {
  it("desligada, não chama modelo nem emite evento", async () => {
    delete process.env.KOLO_EXTRATOR_SOMBRA;
    expect(extratorSombraLigado()).toBe(false);
    await medirExtratorEmSombra(turno);
    expect(chamadasExtrair).toHaveLength(0);
    expect(eventos).toHaveLength(0);
  });

  it("aceita `true` como o resto do repositório — e sem caixa", async () => {
    // ⚠️ ESTE TESTE NASCEU DE UM DEFEITO REAL. A primeira versão só aceitava
    // "1"; a variável foi configurada em produção, o deploy subiu e a sombra
    // continuou inerte. `AYLA_EXPERIMENTAL_TODAS` e `AYLA_POS_TRIAL` sempre
    // aceitaram os dois — inventar uma convenção nova custou um deploy.
    process.env.KOLO_EXTRATOR_SOMBRA = "TRUE";
    expect(extratorSombraLigado()).toBe(true);
    await medirExtratorEmSombra(turno);
    expect(chamadasExtrair).toHaveLength(1);
  });

  it("valor que não é 1 nem true continua desligada", async () => {
    for (const v of ["0", "sim", "on", "ligado", " "]) {
      process.env.KOLO_EXTRATOR_SOMBRA = v;
      expect(extratorSombraLigado()).toBe(false);
    }
    await medirExtratorEmSombra(turno);
    expect(chamadasExtrair).toHaveLength(0);
  });
});

describe("a sombra é inofensiva", () => {
  it("não escreve NADA no banco", async () => {
    await medirExtratorEmSombra(turno);
    expect(chamadasExtrair).toHaveLength(1);
    expect(escritas).toEqual([]);
  });

  it("sem criança resolvida, nem roda — não se adivinha dono de fato", async () => {
    await medirExtratorEmSombra({ ...turno, membroId: null });
    await medirExtratorEmSombra({ ...turno, membro: null });
    expect(chamadasExtrair).toHaveLength(0);
  });

  it("falha do extrator não derruba o turno, e fica visível", async () => {
    falharNaProxima.valor = true;
    await expect(medirExtratorEmSombra(turno)).resolves.toBeUndefined();
    expect(eventos.at(-1)?.kind).toBe("extrator_sombra_falhou");
    expect(eventos.at(-1)?.severity).toBe("warn");
  });
});

describe("o que a medição publica", () => {
  it("conta só camada1 e separa o que cairia no balde de sobra", async () => {
    await medirExtratorEmSombra(turno);
    const p = eventos[0].payload!;
    expect(eventos[0].kind).toBe("extrator_sombra");
    expect(p.n_itens).toBe(3);
    expect(p.n_camada1).toBe(2);
    // `emocional.outras` é o último sub-campo do domínio; `comunicacao.conversa` não é.
    expect(p.n_balde_de_sobra).toBe(1);
    expect(p.chaves).toEqual(["comunicacao.conversa", "emocional.outras"]);
    expect(p.motivos_rejeicao).toEqual({ subcampo_desconhecido: 1 });
  });

  it("NENHUMA palavra da família vai para o evento", async () => {
    await medirExtratorEmSombra(turno);
    const serializado = JSON.stringify(eventos[0]);
    expect(serializado).not.toContain("frustrado");
    expect(serializado).not.toContain("trava quando fica bravo");
    expect(serializado).not.toContain("Conversa bem");
  });

  it("o transcript inclui a mensagem de agora, e o áudio vira via própria", async () => {
    await medirExtratorEmSombra({ ...turno, via: "whatsapp_audio" });
    const p = chamadasExtrair[0] as { transcript: string; via: string; membro: unknown };
    expect(p.via).toBe("whatsapp_audio");
    expect(p.transcript).toContain("Responsável: ele trava quando fica bravo");
    expect(p.transcript).toContain("Quero ajudar ele a se comunicar melhor");
    expect(p.membro).toEqual({ nome: "Mario", idade: 9, perfil: "TEA" });
  });

  it("a chamada é marcada como sombra, para o custo ser separável", async () => {
    await medirExtratorEmSombra(turno);
    const p = chamadasExtrair[0] as { meta: Record<string, unknown> };
    expect(p.meta).toMatchObject({ sombra: true });
  });
});
