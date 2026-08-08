import { describe, it, expect } from "vitest";
import {
  segmentoDa,
  normalizarSegmentos,
  SEGMENTOS_ASSINATURA,
  SEGMENTOS_DEFAULT,
  type SegmentoAssinatura,
} from "./campanha-target";
import { trialValido } from "@/lib/auth/assinatura";

/**
 * "EM TESTE" NÃO PODE ALCANÇAR QUEM SAIU DO TESTE.
 *
 * Aqui o erro não é um número errado numa tela: é mensagem chegando na casa da
 * família. Segmentar por `status = 'trialing'` mandava "você está no seu teste"
 * para 121 famílias cujo teste tinha acabado (medido em produção, 2026-08-08).
 *
 * Os testes medem em que segmento cada linha cai — o que decide quem recebe.
 */

const DIA = 24 * 60 * 60 * 1000;
const AGORA = Date.now();
const ONTEM = new Date(AGORA - DIA).toISOString();
const DAQUI_A_3_DIAS = new Date(AGORA + 3 * DIA).toISOString();

const linha = (status: string | null, trial_ends_at: string | null = null) => ({
  status,
  trial_ends_at,
});

describe("segmento: o trial decide, não o status", () => {
  it("trial válido → Em teste", () => {
    expect(segmentoDa(linha("trialing", DAQUI_A_3_DIAS), AGORA)).toBe("em_teste");
  });

  it("trial vencido → NÃO é Em teste; é Trial vencido", () => {
    const seg = segmentoDa(linha("trialing", ONTEM), AGORA);
    expect(seg).not.toBe("em_teste");
    expect(seg).toBe("trial_vencido");
  });

  it("trialing SEM data segue a mesma fonte de verdade do acesso", () => {
    // `trialValido` é quem decide, e ela exige data no futuro. Sem data não há
    // teste em curso — logo, não é "Em teste".
    const l = linha("trialing", null);
    expect(trialValido(l as never, AGORA)).toBe(false);
    expect(segmentoDa(l, AGORA)).toBe("trial_vencido");
  });

  it("assinante não cai em nenhum segmento de trial", () => {
    const seg = segmentoDa(linha("active"), AGORA);
    expect(seg).toBe("assinante");
    expect(seg).not.toBe("em_teste");
    expect(seg).not.toBe("trial_vencido");
  });

  it("os demais status mapeiam para o próprio segmento", () => {
    expect(segmentoDa(linha("past_due"), AGORA)).toBe("pagamento_falhou");
    expect(segmentoDa(linha("paused"), AGORA)).toBe("pausada");
    expect(segmentoDa(linha("canceled"), AGORA)).toBe("cancelada");
  });

  it("status desconhecido não entra em segmento nenhum — não vira alvo por acidente", () => {
    expect(segmentoDa(linha(null), AGORA)).toBeNull();
    expect(segmentoDa(linha("incomplete"), AGORA)).toBeNull();
  });

  it("o retrato de produção se separa em dois públicos distintos", () => {
    const linhas = [
      ...Array.from({ length: 42 }, () => linha("trialing", DAQUI_A_3_DIAS)),
      ...Array.from({ length: 121 }, () => linha("trialing", ONTEM)),
      ...Array.from({ length: 2 }, () => linha("active")),
    ];
    const conta = (s: SegmentoAssinatura) =>
      linhas.filter((l) => segmentoDa(l, AGORA) === s).length;

    expect(conta("em_teste")).toBe(42);
    expect(conta("trial_vencido")).toBe(121);
    expect(conta("assinante")).toBe(2);
    // Antes, "Em trial" alcançaria 163 famílias.
    expect(conta("em_teste") + conta("trial_vencido")).toBe(163);
  });
});

describe("campanha de retomada tem público próprio", () => {
  it("Trial vencido é um segmento oferecido no Admin", () => {
    expect(SEGMENTOS_ASSINATURA.map((s) => s.value)).toContain("trial_vencido");
  });

  it("campanha geral pode juntar os dois públicos de propósito", () => {
    const geral: SegmentoAssinatura[] = ["em_teste", "trial_vencido"];
    const l = [linha("trialing", DAQUI_A_3_DIAS), linha("trialing", ONTEM)];
    const alvo = l.filter((x) => geral.includes(segmentoDa(x, AGORA)!));
    expect(alvo).toHaveLength(2);
  });

  it("todo segmento tem rótulo humano e definição — nada de nome de coluna", () => {
    for (const s of SEGMENTOS_ASSINATURA) {
      expect(s.label, s.value).not.toMatch(/trialing|past_due|active/);
      expect(s.definicao.length, s.value).toBeGreaterThan(0);
    }
  });
});

describe("compatibilidade: rascunho antigo não quebra em silêncio", () => {
  it("segmentação vazia usa o default", () => {
    expect(normalizarSegmentos(undefined)).toEqual(SEGMENTOS_DEFAULT);
    expect(normalizarSegmentos([])).toEqual(SEGMENTOS_DEFAULT);
  });

  it("o default NÃO inclui trial vencido — quem quer retomada pede explicitamente", () => {
    expect(SEGMENTOS_DEFAULT).not.toContain("trial_vencido");
    expect(SEGMENTOS_DEFAULT).toContain("em_teste");
  });

  it("valores antigos são traduzidos, e a tradução só ESTREITA o público", () => {
    // 'trialing' significava status cru (incluía vencido). Vira "em teste":
    // ninguém passa a receber mensagem que não receberia antes.
    expect(normalizarSegmentos(["trialing"])).toEqual(["em_teste"]);
    expect(normalizarSegmentos(["active", "past_due"])).toEqual([
      "assinante",
      "pagamento_falhou",
    ]);
  });

  it("'incomplete' era filtro morto e não vira público nenhum", () => {
    // O check da coluna nunca permitiu esse valor: ele jamais casou com uma linha.
    expect(normalizarSegmentos(["incomplete"])).toEqual([]);
  });

  it("segmentação só com valores mortos NÃO vira 'todo mundo'", () => {
    // O contrário seria o pior erro possível: campanha sem público virando
    // campanha para a base inteira.
    expect(normalizarSegmentos(["incomplete", "coisa_que_nao_existe"])).toEqual([]);
  });

  it("valor novo e valor antigo convivem sem duplicar público", () => {
    expect(normalizarSegmentos(["em_teste", "trialing"])).toEqual(["em_teste"]);
  });
});
