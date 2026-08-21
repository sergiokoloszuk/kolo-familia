import { describe, expect, it } from "vitest";
import {
  estadoRetencao,
  motivosAtivos,
  descreverMotivosAtivos,
  RETENCAO_DIAS,
  JANELA_ALTERACAO_RECENTE_MIN,
  type LinhaAssinatura,
} from "./retencao";

/**
 * APAGAR É IRREVERSÍVEL — ENTÃO O QUE ESTES TESTES GUARDAM É O "NÃO APAGA".
 *
 * A regra prometida na tela ("seus dados ficam guardados por 7 dias e depois
 * são excluídos") não tinha implementação para dois dos três caminhos: o cron
 * filtrava por `pagamento_falhou_em`, carimbo que só existe em falha de fatura.
 * Trial vencido e cancelamento voluntário nunca geram esse evento — logo nunca
 * eram apagados, e a promessa era falsa.
 *
 * Ao construir o que faltava, o risco inverteu: passou a ser apagar demais. Por
 * isso a maioria destes casos prova que alguém **não** é elegível.
 */

const DIA = 24 * 60 * 60 * 1000;
const AGORA = new Date("2026-08-20T12:00:00.000Z").getTime();

/** Contexto padrão: não é staff, e JÁ foi avisada (senão nada seria elegível). */
const AVISADA = { ehStaff: false, foiAvisada: true };

function hoje(offsetDias: number): string {
  return new Date(AGORA + offsetDias * DIA).toISOString();
}

function linha(over: Partial<LinhaAssinatura> = {}): LinhaAssinatura {
  return {
    family_account_id: "fam-1",
    status: "trialing",
    trial_ends_at: null,
    current_period_end: null,
    pagamento_falhou_em: null,
    cortesia: false,
    cortesia_ate: null,
    // Longe da janela de alteração recente, para não interferir nos casos.
    updated_at: hoje(-30),
    ...over,
  };
}

describe("trial vencido", () => {
  it("1. vencido há 6 dias → NÃO apaga (ainda em retenção)", () => {
    const e = estadoRetencao(linha({ trial_ends_at: hoje(-6) }), AVISADA, AGORA);
    expect(e.motivo).toBe("trial");
    expect(e.elegivel).toBe(false);
    expect(e.protecao).toBeNull();
    expect(e.explicacao).toMatch(/faltam 1 dia/);
  });

  it("2. vencido há 7 dias → ELEGÍVEL", () => {
    const e = estadoRetencao(linha({ trial_ends_at: hoje(-7) }), AVISADA, AGORA);
    expect(e.motivo).toBe("trial");
    expect(e.elegivel).toBe(true);
    expect(e.protecao).toBeNull();
    expect(e.inicioEm).toBe(hoje(-7));
    expect(e.elegivelEm).toBe(hoje(0));
  });

  it("3. vencido há 30 dias → elegível (não expira a elegibilidade)", () => {
    expect(estadoRetencao(linha({ trial_ends_at: hoje(-30) }), AVISADA, AGORA).elegivel).toBe(true);
  });

  it("4. trial ainda válido → NÃO apaga, e nem tem motivo", () => {
    const e = estadoRetencao(linha({ trial_ends_at: hoje(+2) }), AVISADA, AGORA);
    expect(e.motivo).toBeNull();
    expect(e.elegivel).toBe(false);
    expect(e.protecao).toBe("estado_ambiguo");
  });

  it("5. ASSINOU NO SEXTO DIA → NÃO apaga (status virou active)", () => {
    const e = estadoRetencao(
      linha({ status: "active", trial_ends_at: hoje(-6) }),
      AVISADA,
      AGORA,
    );
    expect(e.elegivel).toBe(false);
    expect(e.protecao).toBe("assinatura_ativa");
  });

  it("6. assinou DEPOIS de vencer a retenção → NÃO apaga (pagar tira da fila)", () => {
    const e = estadoRetencao(
      linha({ status: "active", trial_ends_at: hoje(-40) }),
      AVISADA,
      AGORA,
    );
    expect(e.elegivel).toBe(false);
    expect(e.protecao).toBe("assinatura_ativa");
  });

  it("7. o teste que NASCEU vencido segue a mesma regra — o aviso é que protege", () => {
    const nascidaVencida = linha({ trial_ends_at: hoje(-10) });
    expect(estadoRetencao(nascidaVencida, { ehStaff: false, foiAvisada: false }, AGORA).protecao)
      .toBe("nunca_avisada");
    expect(estadoRetencao(nascidaVencida, AVISADA, AGORA).elegivel).toBe(true);
  });
});

describe("cancelamento voluntário", () => {
  it("8. cancelou mas AINDA está no período pago → NÃO apaga", () => {
    // Enquanto o período corre, o Stripe mantém `active` + cancel_at_period_end.
    const e = estadoRetencao(
      linha({ status: "active", current_period_end: hoje(+12) }),
      AVISADA,
      AGORA,
    );
    expect(e.elegivel).toBe(false);
    expect(e.protecao).toBe("assinatura_ativa");
  });

  it("9. período pago terminou há 3 dias → NÃO apaga", () => {
    const e = estadoRetencao(
      linha({ status: "canceled", current_period_end: hoje(-3) }),
      AVISADA,
      AGORA,
    );
    expect(e.motivo).toBe("cancelamento");
    expect(e.elegivel).toBe(false);
    expect(e.explicacao).toMatch(/faltam 4 dia/);
  });

  it("10. período terminou há 7 dias → ELEGÍVEL, e o relógio parte do fim do período", () => {
    const e = estadoRetencao(
      linha({ status: "canceled", current_period_end: hoje(-7) }),
      AVISADA,
      AGORA,
    );
    expect(e.motivo).toBe("cancelamento");
    expect(e.elegivel).toBe(true);
    expect(e.inicioEm).toBe(hoje(-7));
  });

  it('11. "MUDEI DE IDEIA" → NÃO apaga (volta a active, mesmo com período vencido)', () => {
    const e = estadoRetencao(
      linha({ status: "active", current_period_end: hoje(-1) }),
      AVISADA,
      AGORA,
    );
    expect(e.elegivel).toBe(false);
    expect(e.protecao).toBe("assinatura_ativa");
  });

  it("12. NÃO depende de invoice.payment_failed — o carimbo está vazio e mesmo assim decide", () => {
    const e = estadoRetencao(
      linha({ status: "canceled", current_period_end: hoje(-9), pagamento_falhou_em: null }),
      AVISADA,
      AGORA,
    );
    expect(e.motivo).toBe("cancelamento");
    expect(e.elegivel).toBe(true);
  });
});

describe("inadimplência", () => {
  it("13. dentro da tolerância (1 dia) → NÃO apaga", () => {
    const e = estadoRetencao(
      linha({ status: "past_due", pagamento_falhou_em: hoje(-1) }),
      AVISADA,
      AGORA,
    );
    expect(e.motivo).toBe("inadimplencia");
    expect(e.elegivel).toBe(false);
  });

  it("14. bloqueada mas dentro dos 7 dias (dia 5) → NÃO apaga", () => {
    expect(
      estadoRetencao(linha({ status: "past_due", pagamento_falhou_em: hoje(-5) }), AVISADA, AGORA)
        .elegivel,
    ).toBe(false);
  });

  it("15. 7 dias sem regularizar → ELEGÍVEL", () => {
    const e = estadoRetencao(
      linha({ status: "past_due", pagamento_falhou_em: hoje(-7) }),
      AVISADA,
      AGORA,
    );
    expect(e.motivo).toBe("inadimplencia");
    expect(e.elegivel).toBe(true);
  });

  it("16. REGULARIZOU → NÃO apaga (o webhook limpa o carimbo e volta a active)", () => {
    const e = estadoRetencao(
      linha({ status: "active", pagamento_falhou_em: null }),
      AVISADA,
      AGORA,
    );
    expect(e.elegivel).toBe(false);
    expect(e.protecao).toBe("assinatura_ativa");
  });

  it("17. past_due SEM carimbo é caminho de TRIAL, não de dunning", () => {
    // Trial encerrado sem cartão: o Stripe manda past_due e NÃO gera
    // invoice.payment_failed. Confundir os dois foi o que criou o fail-safe
    // que vazou acesso eterno em julho.
    const e = estadoRetencao(
      linha({ status: "past_due", pagamento_falhou_em: null, trial_ends_at: hoje(-8) }),
      AVISADA,
      AGORA,
    );
    expect(e.motivo).toBe("trial");
    expect(e.elegivel).toBe(true);
  });

  it("18. canceled COM carimbo é inadimplência, e o relógio parte da falha", () => {
    const e = estadoRetencao(
      linha({ status: "canceled", pagamento_falhou_em: hoje(-10), current_period_end: hoje(-2) }),
      AVISADA,
      AGORA,
    );
    expect(e.motivo).toBe("inadimplencia");
    expect(e.inicioEm).toBe(hoje(-10));
  });
});

describe("proteções — nenhuma delas pode falhar", () => {
  it("19. STAFF nunca é elegível, em nenhum motivo", () => {
    const casos: LinhaAssinatura[] = [
      linha({ trial_ends_at: hoje(-90) }),
      linha({ status: "canceled", current_period_end: hoje(-90) }),
      linha({ status: "past_due", pagamento_falhou_em: hoje(-90) }),
    ];
    for (const c of casos) {
      const e = estadoRetencao(c, { ehStaff: true, foiAvisada: true }, AGORA);
      expect(e.elegivel).toBe(false);
      expect(e.protecao).toBe("staff");
    }
  });

  it("20. CORTESIA vitalícia nunca é elegível", () => {
    const e = estadoRetencao(
      linha({ trial_ends_at: hoje(-90), cortesia: true, cortesia_ate: null }),
      AVISADA,
      AGORA,
    );
    expect(e.elegivel).toBe(false);
    expect(e.protecao).toBe("cortesia");
  });

  it("21. cortesia com prazo: protege enquanto vale, e some quando expira", () => {
    const viva = linha({ trial_ends_at: hoje(-90), cortesia: true, cortesia_ate: hoje(+10) });
    expect(estadoRetencao(viva, AVISADA, AGORA).protecao).toBe("cortesia");
    const expirada = linha({ trial_ends_at: hoje(-90), cortesia: true, cortesia_ate: hoje(-10) });
    expect(estadoRetencao(expirada, AVISADA, AGORA).elegivel).toBe(true);
  });

  it("22. NUNCA AVISADA nunca é elegível — vale para os três motivos", () => {
    const casos: LinhaAssinatura[] = [
      linha({ trial_ends_at: hoje(-90) }),
      linha({ status: "canceled", current_period_end: hoje(-90) }),
      linha({ status: "past_due", pagamento_falhou_em: hoje(-90) }),
    ];
    for (const c of casos) {
      const e = estadoRetencao(c, { ehStaff: false, foiAvisada: false }, AGORA);
      expect(e.elegivel).toBe(false);
      expect(e.protecao).toBe("nunca_avisada");
      // O motivo continua sendo reportado — dá para dizer "seria por trial,
      // mas nunca foi avisada" em vez de só "não elegível".
      expect(e.motivo).not.toBeNull();
    }
  });

  it("23. ALTERAÇÃO RECENTE adia — a linha foi tocada agora há pouco", () => {
    const e = estadoRetencao(
      linha({ trial_ends_at: hoje(-90), updated_at: new Date(AGORA - 60_000).toISOString() }),
      AVISADA,
      AGORA,
    );
    expect(e.elegivel).toBe(false);
    expect(e.protecao).toBe("alteracao_recente");
  });

  it("24. passada a janela de alteração, volta a ser elegível", () => {
    const fora = new Date(AGORA - (JANELA_ALTERACAO_RECENTE_MIN + 5) * 60_000).toISOString();
    expect(
      estadoRetencao(linha({ trial_ends_at: hoje(-90), updated_at: fora }), AVISADA, AGORA)
        .elegivel,
    ).toBe(true);
  });
});

describe("estado ambíguo — fail-closed", () => {
  it("25. status desconhecido → NÃO apaga", () => {
    const e = estadoRetencao(linha({ status: "quem_sabe" }), AVISADA, AGORA);
    expect(e.elegivel).toBe(false);
    expect(e.protecao).toBe("estado_ambiguo");
  });

  it("26. paused → NÃO apaga (não há política definida, e inventar seria decidir sozinho)", () => {
    expect(estadoRetencao(linha({ status: "paused" }), AVISADA, AGORA).protecao).toBe(
      "estado_ambiguo",
    );
  });

  it("27. trialing SEM trial_ends_at → NÃO apaga", () => {
    expect(estadoRetencao(linha({ trial_ends_at: null }), AVISADA, AGORA).elegivel).toBe(false);
  });

  it("28. canceled SEM current_period_end → NÃO apaga", () => {
    expect(
      estadoRetencao(linha({ status: "canceled", current_period_end: null }), AVISADA, AGORA)
        .elegivel,
    ).toBe(false);
  });

  it("29. data corrompida → NÃO apaga", () => {
    expect(
      estadoRetencao(linha({ trial_ends_at: "não é data" }), AVISADA, AGORA).elegivel,
    ).toBe(false);
  });

  it("30. linha inexistente → NÃO apaga", () => {
    expect(estadoRetencao(null, AVISADA, AGORA).elegivel).toBe(false);
    expect(estadoRetencao(undefined, AVISADA, AGORA).protecao).toBe("estado_ambiguo");
  });
});

describe("idempotência e determinismo", () => {
  it("31. avaliar duas vezes o mesmo estado dá o mesmo resultado", () => {
    const l = linha({ trial_ends_at: hoje(-9) });
    expect(estadoRetencao(l, AVISADA, AGORA)).toEqual(estadoRetencao(l, AVISADA, AGORA));
  });

  it("32. o relógio é parâmetro — o mesmo dado não muda de resposta com a hora do dia", () => {
    const l = linha({ trial_ends_at: hoje(-6) });
    // Mesmo dado, avaliado 6 dias depois: aí sim vira elegível.
    expect(estadoRetencao(l, AVISADA, AGORA).elegivel).toBe(false);
    expect(estadoRetencao(l, AVISADA, AGORA + 6 * DIA).elegivel).toBe(true);
  });

  it("33. a retenção é de 7 dias, e o número mora em um lugar só", () => {
    expect(RETENCAO_DIAS).toBe(7);
  });
});

describe("a trava de ativação", () => {
  it("34. ausente, vazia ou off → NENHUM motivo ligado (dry-run é o padrão)", () => {
    for (const v of [undefined, "", "   ", "off", "OFF", "false", "0"]) {
      expect(motivosAtivos(v).size).toBe(0);
      expect(descreverMotivosAtivos(v)).toBe("off");
    }
  });

  it("35. ativação gradual: um motivo de cada vez", () => {
    expect([...motivosAtivos("inadimplencia")]).toEqual(["inadimplencia"]);
    expect(motivosAtivos("inadimplencia").has("trial")).toBe(false);
    expect(motivosAtivos("inadimplencia").has("cancelamento")).toBe(false);
  });

  it("36. combinações", () => {
    const s = motivosAtivos("trial, cancelamento");
    expect(s.has("trial")).toBe(true);
    expect(s.has("cancelamento")).toBe(true);
    expect(s.has("inadimplencia")).toBe(false);
    expect(descreverMotivosAtivos("trial, cancelamento")).toBe("cancelamento,trial");
  });

  it("37. todos", () => {
    expect(motivosAtivos("todos").size).toBe(3);
  });

  it("38. lixo não liga nada — fail-closed também aqui", () => {
    expect(motivosAtivos("sim").size).toBe(0);
    expect(motivosAtivos("trial;cancelamento").size).toBe(0);
    expect(motivosAtivos("TRIAL").has("trial")).toBe(true); // caixa não importa
  });
});
