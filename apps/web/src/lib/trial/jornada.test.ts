import { describe, it, expect } from "vitest";
import {
  blocoDaJornada,
  alternativasConcretas,
  EVIDENCIAS_VAZIAS,
  MENSAGENS_USO_BAIXO,
  type EvidenciasJornada,
} from "./jornada";
import { estadoTrialDe, type LinhaAssinatura } from "./estado";
import { TRIAL_DIAS } from "@/lib/billing/fatos-comerciais";

/**
 * A JORNADA COMO TEXTO — a parte determinística, provada dia a dia.
 *
 * O que este arquivo prova: qual intenção aparece em cada dia, que o bloco
 * SOME para quem não deve ser conduzido, que evidência inventada não entra e
 * que a precedência da necessidade real vem antes de tudo.
 *
 * O que ele NÃO prova, e está dito: se a Ayla OBEDECE. Isso é julgamento sobre
 * a resposta e é trabalho da bancada com modelo real.
 */

const MS_DIA = 24 * 60 * 60 * 1000;
const T0 = new Date("2026-08-15T12:00:00.000Z").getTime();

function emTeste(dia: number): LinhaAssinatura {
  const inicio = T0 - dia * MS_DIA;
  return {
    status: "trialing",
    created_at: new Date(inicio).toISOString(),
    trial_ends_at: new Date(inicio + TRIAL_DIAS * MS_DIA).toISOString(),
  };
}

const ev = (p: Partial<EvidenciasJornada> = {}): EvidenciasJornada => ({
  ...EVIDENCIAS_VAZIAS,
  mensagensDaFamilia: 20,
  mediaCaracteres: 120,
  ...p,
});

const blocoNoDia = (dia: number, e: EvidenciasJornada = ev()) =>
  blocoDaJornada(estadoTrialDe(emTeste(dia), T0), e);

describe("D0–D7 — cada dia oferece a sua intenção", () => {
  it("todo dia do teste produz bloco, e o bloco diz o dia", () => {
    for (let d = 0; d < TRIAL_DIAS; d++) {
      const b = blocoNoDia(d);
      expect(b, `dia ${d}`).toContain("<jornada>");
      expect(b, `dia ${d}`).toContain(`Dia ${d} de`);
    }
  });

  it("D0 conhece a criança; D2 conecta temas", () => {
    expect(blocoNoDia(0)).toContain("Conhecer a criança");
    expect(blocoNoDia(2)).toContain("conectar");
  });

  it("as quatro etapas do fechamento caem nos QUATRO ÚLTIMOS dias, em ordem", () => {
    // ⚠️ MEDIDO: a jornada tem 8 etapas e o teste tem 7 dias. A compressão
    // acontece no meio, nunca no fim — a decisão precisa cair no último dia.
    expect(blocoNoDia(3)).toContain("MAIS AJUDOU");
    expect(blocoNoDia(4)).toContain("mais útil daqui para frente");
    expect(blocoNoDia(5)).toContain("SÓ com evidência real");
    expect(blocoNoDia(6)).toContain("continuar com a Kolo");
  });

  it("o fechamento é invertido: pergunta o que ajudou ANTES de propor", () => {
    const b = blocoNoDia(3);
    expect(b).toContain("MAIS AJUDOU");
    expect(b).toContain("Quem nomeia o valor é ela");
  });

  it("o valor futuro vem antes do resumo, e o resumo antes da decisão", () => {
    expect(blocoNoDia(4)).toContain("mais útil daqui para frente");
    expect(blocoNoDia(5)).toContain("SÓ com evidência real");
  });

  it("o ÚLTIMO dia conecta o que ELA valorizou — e só aí pergunta da continuidade", () => {
    const b = blocoNoDia(6);
    expect(b).toContain("ela mesma valorizou");
    expect(b).toContain("continuar com a Kolo");
  });

  it("os primeiros dias NÃO abrem conversa de assinatura", () => {
    for (const d of [0, 1, 2]) {
      expect(blocoNoDia(d), `dia ${d}`).not.toContain("continuar com a Kolo");
      expect(blocoNoDia(d), `dia ${d}`).not.toContain("Se ela disser SIM");
    }
  });

  it("os dias de fechamento carregam as três respostas possíveis, sem pressão", () => {
    for (const d of [3, 4, 5, 6]) {
      const b = blocoNoDia(d);
      expect(b, `dia ${d}`).toContain("Se ela disser SIM, pare de convencer");
      expect(b, `dia ${d}`).toContain("NÃO SEI");
      expect(b, `dia ${d}`).toContain("Nada de pressão");
    }
  });

  it("o teste encerrado cai no D7, não em dia nenhum", () => {
    const venceu = estadoTrialDe(emTeste(TRIAL_DIAS + 2), T0);
    const b = blocoDaJornada(venceu, ev());
    expect(b).toContain("período de teste terminou");
    expect(b).toContain("continuar com a Kolo");
  });
});

describe("A NECESSIDADE DE AGORA MANDA", () => {
  it("a precedência é a PRIMEIRA linha do bloco, em todos os dias", () => {
    for (let d = 0; d <= 7; d++) {
      const corpo = blocoNoDia(d).split("\n")[1] ?? "";
      expect(corpo, `dia ${d}`).toContain("A NECESSIDADE DE AGORA MANDA");
    }
  });

  it("o bloco manda ignorar a etapa quando há necessidade real", () => {
    expect(blocoNoDia(6)).toContain("ignore a intenção do dia");
  });
});

describe("QUEM NÃO É CONDUZIDO NÃO TEM BLOCO", () => {
  it("assinante: nada", () => {
    expect(blocoDaJornada(estadoTrialDe({ status: "active" }, T0), ev())).toBe("");
  });

  it("cortesia: nada", () => {
    const e = estadoTrialDe({ status: "canceled", cortesia: true, cortesia_ate: null }, T0);
    expect(blocoDaJornada(e, ev())).toBe("");
  });

  it("staff: nada", () => {
    expect(blocoDaJornada(estadoTrialDe(emTeste(2), T0, true), ev())).toBe("");
  });

  it("falha de pagamento: nada — a conversa ali é de recuperação, não de teste", () => {
    const e = estadoTrialDe(
      { status: "past_due", pagamento_falhou_em: new Date(T0 - MS_DIA).toISOString() },
      T0,
    );
    expect(blocoDaJornada(e, ev())).toBe("");
  });

  it("sem linha, teste não iniciado ou estado desconhecido: nada", () => {
    expect(blocoDaJornada(estadoTrialDe(null, T0), ev())).toBe("");
    expect(blocoDaJornada(estadoTrialDe({ status: "trialing", trial_ends_at: null }, T0), ev())).toBe("");
  });
});

describe("EVIDÊNCIA É SÓ O QUE ACONTECEU", () => {
  it("o bloco proíbe transformar sugestão em resultado", () => {
    const b = blocoNoDia(6);
    expect(b).toContain("Não diga que algo funcionou se a família não disse");
    expect(b).toContain("nem suposição como progresso");
  });

  it("sem plano e sem rotina, o bloco não menciona plano nem rotina entregues", () => {
    const b = blocoNoDia(4, ev({ planos: 0, rotinas: 0, relatos: [], temas: [] }));
    expect(b).not.toContain("planos entregues");
    expect(b).not.toContain("rotinas criadas");
  });

  it("o que existe aparece com o número real", () => {
    const b = blocoNoDia(6, ev({ planos: 2, rotinas: 1, relatos: ["dormiu melhor com o aviso de 5 min"] }));
    expect(b).toContain("planos entregues: 2");
    expect(b).toContain("rotinas criadas: 1");
    expect(b).toContain("dormiu melhor com o aviso de 5 min");
  });
});

describe("FAMÍLIA MONOSSILÁBICA — mais direção, nunca suposição", () => {
  it("responde curto e tem experiência: ganha alternativas concretas do que viveu", () => {
    const b = blocoNoDia(4, ev({ mediaCaracteres: 12, planos: 1, temas: ["Sono e hora de dormir"] }));
    expect(b).toContain("responde curto");
    expect(b).toContain("Sono e hora de dormir");
    expect(b).toContain("ideias práticas para testar");
  });

  it("responde curto e NÃO viveu nada: nenhuma alternativa é inventada", () => {
    const b = blocoNoDia(4, ev({ mediaCaracteres: 8, planos: 0, rotinas: 0, relatos: [], temas: [] }));
    expect(b).toContain("ainda não há experiência suficiente");
    expect(b).not.toContain("ideias práticas para testar");
  });

  it("fala bastante: nenhuma muleta de alternativas", () => {
    expect(blocoNoDia(4, ev({ mediaCaracteres: 200 }))).not.toContain("responde curto");
  });

  it("as alternativas saem SÓ do que existe", () => {
    expect(alternativasConcretas(EVIDENCIAS_VAZIAS)).toEqual([]);
    const alt = alternativasConcretas(ev({ planos: 1, rotinas: 1, temas: ["Escola"], relatos: ["x"] }));
    expect(alt.length).toBeLessThanOrEqual(3);
    expect(alt.join(" ")).toContain("Escola");
  });
});

describe("USO BAIXO — ajuda, não cobrança", () => {
  it("quem quase não usou recebe oferta concreta, sem lamento", () => {
    const b = blocoNoDia(5, ev({ mensagensDaFamilia: MENSAGENS_USO_BAIXO - 1 }));
    expect(b).toContain("usou pouco");
    expect(b).toContain("Não cobre");
  });

  it("quem conversa muito não recebe essa nota", () => {
    expect(blocoNoDia(5, ev({ mensagensDaFamilia: 40 }))).not.toContain("usou pouco");
  });
});
