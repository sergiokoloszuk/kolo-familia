import { describe, it, expect } from "vitest";
import { estadoTrialDe } from "./estado";
import { blocoDaJornada } from "./jornada";

/**
 * O TEMPO DO TESTE, CALCULADO PELO CÓDIGO — 26/08/2026.
 *
 * ⚠️ POR QUE O MODELO NÃO PODE FAZER ESTA CONTA. Subtrair dias de um timestamp
 * é a operação em que um LLM erra sem avisar — e aqui o erro é caro: dizer
 * "faltam 2 dias" a quem tem 5, ou "hoje é o último dia" a quem ainda tem uma
 * semana, é pressão comercial em cima de informação falsa.
 *
 * ⚠️ E POR QUE ISTO NÃO É UM ROTEIRO. Não existe instrução mandando anunciar o
 * dia, e não pode existir: uma Ayla que abre toda mensagem com "você está no
 * dia 4" vira contagem regressiva de cobrança. O dado fica disponível; quem
 * decide se e como mencionar é a condução, e isso será amadurecido
 * editorialmente depois.
 */
const DIA = 24 * 60 * 60 * 1000;
const AGORA = Date.parse("2026-08-26T15:00:00Z");

function linhaTrial(diasDesdeInicio: number, duracao = 7) {
  const comeco = AGORA - diasDesdeInicio * DIA;
  return {
    status: "trialing",
    created_at: new Date(comeco).toISOString(),
    trial_ends_at: new Date(comeco + duracao * DIA).toISOString(),
    cortesia: false,
    cortesia_ate: null,
    pagamento_falhou_em: null,
  };
}

describe("o estado temporal é derivado, não adivinhado", () => {
  it("1. no terceiro dia: dia 3, faltam 4, termina na data certa", () => {
    const e = estadoTrialDe(linhaTrial(3), AGORA);
    expect(e.fase).toBe("trial");
    expect(e.dia).toBe(3);
    expect(e.diasRestantes).toBe(4);
    expect(e.terminaEm?.slice(0, 10)).toBe("2026-08-30");
    expect(e.comecouEm?.slice(0, 10)).toBe("2026-08-23");
    expect(e.ultimoDia).toBe(false);
    expect(e.encerrado).toBe(false);
  });

  it("2. MORDE: `ultimoDia` usa `<= 1`, não `=== 0`", () => {
    // `diasRestantes` é `ceil`: no último dia ele vale 1 durante quase toda a
    // sua duração e só vira 0 no instante do vencimento. Comparar com 0 faria
    // "hoje é o último dia" nunca ser verdade num turno real.
    const e = estadoTrialDe(linhaTrial(6), AGORA);
    expect(e.diasRestantes).toBe(1);
    expect(e.ultimoDia).toBe(true);
  });

  it("3. no primeiro dia, nada de últimos dias", () => {
    const e = estadoTrialDe(linhaTrial(0), AGORA);
    expect(e.dia).toBe(0);
    expect(e.diasRestantes).toBe(7);
    expect(e.ultimoDia).toBe(false);
  });

  it("4. teste vencido: encerrado, sem dia e sem contagem", () => {
    const e = estadoTrialDe(linhaTrial(10), AGORA);
    expect(e.fase).toBe("trial_encerrado");
    expect(e.encerrado).toBe(true);
    expect(e.ultimoDia).toBe(false);
    expect(e.terminaEm).toBeTruthy();
  });

  it("5. MORDE: assinante não tem contagem de teste", () => {
    const e = estadoTrialDe({ ...linhaTrial(3), status: "active" }, AGORA);
    expect(e.fase).toBe("assinante");
    expect(e.dia).toBeNull();
    expect(e.diasRestantes).toBeNull();
    expect(e.encerrado).toBe(false);
    expect(e.terminaEm).toBeNull();
  });

  it("6. MORDE: cortesia também fica fora", () => {
    const e = estadoTrialDe({ ...linhaTrial(3), cortesia: true }, AGORA);
    expect(e.fase).toBe("cortesia");
    expect(e.terminaEm).toBeNull();
    expect(e.encerrado).toBe(false);
  });
});

describe("o bloco entrega o dado pronto ao contexto", () => {
  const bloco = blocoDaJornada(estadoTrialDe(linhaTrial(3), AGORA));

  it("7. o bloco traz dia, dias restantes e a data de encerramento", () => {
    expect(bloco).toMatch(/<trial_estado>/);
    expect(bloco).toMatch(/dia_atual: 3/);
    expect(bloco).toMatch(/dias_restantes: 4/);
    expect(bloco).toMatch(/termina_em: 30\/08\/2026/);
    expect(bloco).toMatch(/ultimo_dia: nao/);
    expect(bloco).toMatch(/encerrado: nao/);
  });

  it("8. a data sai em pt-BR, no fuso do Brasil — não em ISO", () => {
    expect(bloco).not.toMatch(/2026-08-30T/);
    expect(bloco).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it("9. MORDE: o bloco PROÍBE recalcular e PROÍBE anunciar por hábito", () => {
    expect(bloco).toMatch(/NÃO os recalcule/);
    expect(bloco).toMatch(/NÃO os anuncie por hábito/);
  });

  it("10. MORDE: não há instrução mandando dizer o dia", () => {
    // Se um dia alguém escrever "diga em que dia ela está", a contagem
    // regressiva comercial volta — e ela não foi decidida editorialmente.
    expect(bloco).not.toMatch(/diga.{0,20}(que dia|o dia)/i);
    expect(bloco).not.toMatch(/avise.{0,20}quantos dias/i);
  });

  it("11. MORDE: assinante não recebe bloco nenhum", () => {
    const e = estadoTrialDe({ ...linhaTrial(3), status: "active" }, AGORA);
    expect(blocoDaJornada(e)).toBe("");
  });

  it("12. no último dia o bloco diz isso, sem o modelo contar", () => {
    const b = blocoDaJornada(estadoTrialDe(linhaTrial(6), AGORA));
    expect(b).toMatch(/ultimo_dia: sim/);
    expect(b).toMatch(/dias_restantes: 1/);
  });
});
