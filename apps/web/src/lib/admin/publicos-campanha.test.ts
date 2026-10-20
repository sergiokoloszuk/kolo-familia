import { describe, expect, it } from "vitest";
import { classificarPublico, GRUPOS_PUBLICO } from "./publicos-campanha";

const AGORA = Date.parse("2026-10-20T12:00:00Z");
const AMANHA = "2026-10-21T12:00:00Z";
const ONTEM = "2026-10-19T12:00:00Z";

describe("grupos visíveis da comunicação", () => {
  it("inclui todo cadastro, mesmo sem acesso registrado", () => {
    expect(classificarPublico(null, AGORA).grupos).toEqual(["todos", "revisar"]);
  });

  it("separa teste em andamento de teste vencido pela data", () => {
    expect(classificarPublico({ status: "trialing", trial_ends_at: AMANHA }, AGORA).grupos).toContain("trial");
    const vencido = classificarPublico({ status: "trialing", trial_ends_at: ONTEM }, AGORA).grupos;
    expect(vencido).toContain("trial_vencido");
    expect(vencido).not.toContain("trial");
  });

  it("cortesia vigente não vira pagante ou trial vencido", () => {
    const cortesia = classificarPublico({ status: "active", cortesia: true, cortesia_ate: AMANHA }, AGORA).grupos;
    expect(cortesia).toContain("cortesias");
    expect(cortesia).not.toContain("assinantes");
    const teste = classificarPublico({ status: "trialing", trial_ends_at: ONTEM, cortesia: true }, AGORA).grupos;
    expect(teste).not.toContain("trial_vencido");
  });

  it("distingue cancelamento solicitado de assinatura já encerrada", () => {
    const solicitado = classificarPublico({ status: "active", stripe_subscription_id: "sub_qa", cancel_at_period_end: true }, AGORA).grupos;
    expect(solicitado).toContain("assinantes");
    expect(solicitado).toContain("cancelamento_solicitado");
    expect(solicitado).not.toContain("cancelados");
    expect(classificarPublico({ status: "canceled" }, AGORA).grupos).toContain("cancelados");
  });

  it("não chama de pagante um status ativo sem assinatura Stripe vinculada", () => {
    const grupos = classificarPublico({ status: "active" }, AGORA).grupos;
    expect(grupos).toContain("revisar");
    expect(grupos).not.toContain("assinantes");
  });

  it("mantém pagamento em falha e pausa separados", () => {
    expect(classificarPublico({ status: "past_due", pagamento_falhou_em: ONTEM }, AGORA).grupos).toContain("pagamento_pendente");
    const trialSemCartao = classificarPublico({ status: "past_due" }, AGORA).grupos;
    expect(trialSemCartao).toContain("trial_vencido");
    expect(trialSemCartao).not.toContain("pagamento_pendente");
    expect(classificarPublico({ status: "paused" }, AGORA).grupos).toContain("pausadas");
  });

  it("não repete ids de grupos no menu", () => {
    const ids = GRUPOS_PUBLICO.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
