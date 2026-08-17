import { describe, it, expect } from "vitest";
import { estadoTrialDe, type LinhaAssinatura } from "./estado";
import { TRIAL_DIAS } from "@/lib/billing/fatos-comerciais";
import { assinaturaLiberada } from "@/lib/auth/assinatura";

/**
 * O LEITOR DE ESTADO DO TRIAL — provado dia a dia, e provado CONTRA a fonte.
 *
 * ⚠️ O teste que mais importa aqui não é nenhum dos D0–D7: é o de coerência
 * (`acesso` sempre igual a `assinaturaLiberada`). Um leitor de jornada que
 * discorde do gate de acesso é a receita do incidente da Rosangela — a mesma
 * pergunta respondida em dois lugares, e um deles envelhecendo sozinho.
 */

const MS_DIA = 24 * 60 * 60 * 1000;
const T0 = new Date("2026-08-15T12:00:00.000Z").getTime();

/** Uma família que começou o teste `dia` dias atrás. */
function emTeste(dia: number): LinhaAssinatura {
  const inicio = T0 - dia * MS_DIA;
  return {
    status: "trialing",
    created_at: new Date(inicio).toISOString(),
    trial_ends_at: new Date(inicio + TRIAL_DIAS * MS_DIA).toISOString(),
    cortesia: false,
    cortesia_ate: null,
    pagamento_falhou_em: null,
  };
}

describe("D0 a D7 — o dia é o que a condução precisa saber", () => {
  it("cada dia do teste é lido como o dia certo", () => {
    for (let d = 0; d < TRIAL_DIAS; d++) {
      const e = estadoTrialDe(emTeste(d), T0);
      expect(e.fase, `dia ${d}`).toBe("trial");
      expect(e.dia, `dia ${d}`).toBe(d);
    }
  });

  it("D0 é o dia da chegada, não D1 — o off-by-one erra a mensagem da família", () => {
    const e = estadoTrialDe(emTeste(0), T0);
    expect(e.dia).toBe(0);
    expect(e.diasRestantes).toBe(TRIAL_DIAS);
  });

  it("no último dia ainda é teste, e falta 1", () => {
    const e = estadoTrialDe(emTeste(TRIAL_DIAS - 1), T0);
    expect(e.fase).toBe("trial");
    expect(e.dia).toBe(TRIAL_DIAS - 1);
    expect(e.diasRestantes).toBe(1);
  });

  it("D7 já é fim: o teste de 7 dias acabou, e o estado diz isso", () => {
    const e = estadoTrialDe(emTeste(TRIAL_DIAS), T0);
    expect(e.fase).toBe("trial_encerrado");
    expect(e.dia).toBeNull();
    expect(e.acesso).toBe(false);
  });

  it("sem created_at o dia degrada pelo fim do teste, não para 'não sei'", () => {
    const linha = { ...emTeste(3), created_at: null };
    const e = estadoTrialDe(linha, T0);
    expect(e.fase).toBe("trial");
    expect(e.dia).toBe(3);
  });
});

describe("OS OUTROS ESTADOS — nenhum inventado, todos com fonte", () => {
  it("assinante sai da condução comercial", () => {
    const e = estadoTrialDe({ status: "active" }, T0);
    expect(e.fase).toBe("assinante");
    expect(e.acesso).toBe(true);
    // Quem já paga não pode ouvir convite para pagar.
    expect(e.emConducaoComercial).toBe(false);
  });

  it("cortesia também sai — e vale mesmo com status vencido", () => {
    const e = estadoTrialDe(
      { status: "canceled", cortesia: true, cortesia_ate: null },
      T0,
    );
    expect(e.fase).toBe("cortesia");
    expect(e.acesso).toBe(true);
    expect(e.emConducaoComercial).toBe(false);
  });

  it("cortesia vencida não é cortesia", () => {
    const e = estadoTrialDe(
      { status: "canceled", cortesia: true, cortesia_ate: new Date(T0 - MS_DIA).toISOString() },
      T0,
    );
    expect(e.fase).not.toBe("cortesia");
    expect(e.acesso).toBe(false);
  });

  it("falha de pagamento dentro da graça: ainda tem acesso, e não é venda de teste", () => {
    const e = estadoTrialDe(
      { status: "past_due", pagamento_falhou_em: new Date(T0 - MS_DIA).toISOString() },
      T0,
    );
    expect(e.fase).toBe("pagamento_em_falha");
    expect(e.acesso).toBe(true);
    expect(e.emConducaoComercial).toBe(false);
    expect(e.diasAteExclusaoDeDados).not.toBeNull();
  });

  it("past_due SEM carimbo é fim de teste, não dunning", () => {
    // É o trial que acabou sem cartão. A família precisa ouvir "seu teste
    // acabou", não "seu pagamento falhou".
    const e = estadoTrialDe({ status: "past_due", pagamento_falhou_em: null }, T0);
    expect(e.fase).toBe("trial_encerrado");
    expect(e.acesso).toBe(false);
  });

  it("trialing sem data não vira D0", () => {
    const e = estadoTrialDe({ status: "trialing", trial_ends_at: null }, T0);
    expect(e.fase).toBe("nao_iniciado");
    expect(e.dia).toBeNull();
    expect(e.acesso).toBe(false);
  });

  it("cancelado sem acesso é encerrado, e não fim de teste", () => {
    const e = estadoTrialDe({ status: "canceled" }, T0);
    expect(e.fase).toBe("encerrado");
    expect(e.emConducaoComercial).toBe(false);
  });

  it("sem linha nenhuma: desconhecida, fail closed, e ninguém é conduzido", () => {
    const e = estadoTrialDe(null, T0);
    expect(e.fase).toBe("desconhecida");
    expect(e.acesso).toBe(false);
    expect(e.emConducaoComercial).toBe(false);
  });

  it("data ilegível não vira dia nenhum", () => {
    const e = estadoTrialDe({ status: "trialing", trial_ends_at: "não é data" }, T0);
    expect(e.fase).toBe("nao_iniciado");
    expect(e.acesso).toBe(false);
  });

  it("staff tem acesso e fica fora da conversa comercial", () => {
    const e = estadoTrialDe(emTeste(TRIAL_DIAS + 3), T0, true);
    expect(e.acesso).toBe(true);
    expect(e.emConducaoComercial).toBe(false);
  });
});

describe("COERÊNCIA COM A FONTE — o portão que impede a segunda verdade", () => {
  const casos: Array<[string, LinhaAssinatura]> = [
    ["trial D0", emTeste(0)],
    ["trial D3", emTeste(3)],
    ["trial D6", emTeste(6)],
    ["trial vencido", emTeste(TRIAL_DIAS + 1)],
    ["assinante", { status: "active" }],
    ["cortesia vitalícia", { status: "canceled", cortesia: true, cortesia_ate: null }],
    ["cortesia vencida", { status: "canceled", cortesia: true, cortesia_ate: new Date(T0 - MS_DIA).toISOString() }],
    ["past_due com carimbo", { status: "past_due", pagamento_falhou_em: new Date(T0 - MS_DIA).toISOString() }],
    ["past_due sem carimbo", { status: "past_due", pagamento_falhou_em: null }],
    ["past_due fora da graça", { status: "past_due", pagamento_falhou_em: new Date(T0 - 30 * MS_DIA).toISOString() }],
    ["canceled", { status: "canceled" }],
    ["paused", { status: "paused" }],
    ["trialing sem data", { status: "trialing", trial_ends_at: null }],
  ];

  for (const [nome, linha] of casos) {
    it(`${nome}: acesso é o mesmo de assinaturaLiberada`, () => {
      // ⚠️ `assinaturaLiberada` usa `Date.now()`; por isso as fixtures ficam
      // ancoradas em datas relativas ao presente, e não a T0 puro.
      const agora = Date.now();
      const ajustada: LinhaAssinatura = { ...linha };
      if (linha.trial_ends_at && linha.created_at) {
        const desl = agora - T0;
        ajustada.trial_ends_at = new Date(new Date(linha.trial_ends_at).getTime() + desl).toISOString();
        ajustada.created_at = new Date(new Date(linha.created_at).getTime() + desl).toISOString();
      }
      const e = estadoTrialDe(ajustada, agora);
      expect(e.acesso, nome).toBe(assinaturaLiberada(ajustada));
    });
  }
});
