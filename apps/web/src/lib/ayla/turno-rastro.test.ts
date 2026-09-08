import { readFileSync } from "node:fs";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  novoRastroTurno,
  registrarRastroTurno,
  marco,
  contarQuery,
  registrarLLM,
} from "./turno-rastro";

const ORQ = readFileSync(new URL("./orchestrator.ts", import.meta.url), "utf8");

const persistidos: Array<Record<string, unknown>> = [];
vi.mock("@/lib/log", () => ({
  logEvent: async (evt: Record<string, unknown>) => {
    persistidos.push(evt);
  },
}));

/**
 * O ORÇAMENTO TEMPORAL DO TURNO — observabilidade pura.
 *
 * ⚠️ O turno homologado no Gate A levou 26 s para a família. Sabíamos explicar
 * 8,05 s do interior de `conduzirRotina` e 10 s de debounce deliberado.
 * Sobravam ~8 s sem nome, e otimizar o que não se mediu é escolher o alvo pelo
 * palpite.
 */
describe("o rastro cobre todas as saídas do turno", () => {
  beforeEach(() => {
    persistidos.length = 0;
  });

  it("o flush está num finally em volta do corpo inteiro", () => {
    // `processInbound` tem dezenas de `return`. Um invólucro é a única forma de
    // garantir que a saída esquecida também deixe rastro.
    expect(ORQ).toMatch(/async function processInboundInterno\(/);
    expect(ORQ).toMatch(/\} finally \{[\s\S]{0,200}?void registrarRastroTurno\(rastro\);/);
  });

  it("a exceção é nomeada antes de subir — e continua subindo", () => {
    expect(ORQ).toMatch(/rastro\.saida = "null_excecao"/);
    const bloco = ORQ.slice(ORQ.indexOf('rastro.saida = "null_excecao"'), ORQ.indexOf('rastro.saida = "null_excecao"') + 300);
    expect(bloco).toMatch(/throw e;/);
  });

  it("os marcos existem nas quatro etapas do orçamento", () => {
    for (const m of [
      "debounce_inicio",
      "debounce_fim",
      "decisor_inicio",
      "decisor_fim",
      "capacidade_inicio",
      "capacidade_fim",
      "envio_inicio",
      "envio_fim",
    ]) {
      expect(ORQ, `falta o marco ${m}`).toContain(`marco(rastro, "${m}")`);
    }
  });

  it("MEDIR NÃO PODE MUDAR O CÓDIGO MEDIDO", () => {
    // Onze testes prendem a forma das chamadas do orquestrador; um deles CONTA
    // ocorrências. Por isso a instrumentação é carimbo, nunca invólucro.
    expect(ORQ).not.toMatch(/etapaTurno\(rastro/);
    expect(ORQ.split("await decidirTurno(").length - 1).toBe(1);
  });
});

describe("o orçamento fecha, e a ignorância é medida", () => {
  beforeEach(() => {
    persistidos.length = 0;
  });

  it("calcula as durações a partir dos marcos", async () => {
    const r = novoRastroTurno({ chars: 40 });
    r.marcos.debounce_inicio = 1000;
    r.marcos.debounce_fim = 11000;
    r.marcos.decisor_inicio = 11000;
    r.marcos.decisor_fim = 12500;
    r.saida = "tratada";
    await registrarRastroTurno(r);
    expect(r.ms.debounce_deliberado).toBe(10000);
    expect(r.ms.decisor).toBe(1500);
  });

  it("`nao_medido` é o tamanho da nossa ignorância — e existe", async () => {
    const r = novoRastroTurno({ chars: 10 });
    r.marcos.inicio = Date.now() - 5000;
    r.marcos.decisor_inicio = 0;
    r.marcos.decisor_fim = 1000;
    r.saida = "tratada";
    await registrarRastroTurno(r);
    expect(r.ms.total).toBeGreaterThanOrEqual(5000);
    expect(r.ms.nao_medido).toBeGreaterThan(3000);
  });

  it("marco pela metade não vira duração inventada", async () => {
    const r = novoRastroTurno({ chars: 10 });
    r.marcos.capacidade_inicio = 500; // sem `_fim`
    r.saida = "tratada";
    await registrarRastroTurno(r);
    expect(r.ms.capacidade).toBeUndefined();
  });

  it("o tempo ANTES de nós é contado — a viagem da Z-API e a fila", () => {
    const r = novoRastroTurno({ chars: 10, recebidaEm: new Date(Date.now() - 2000) });
    expect(r.ms_ate_processar).toBeGreaterThanOrEqual(1900);
  });

  it("sem carimbo da Z-API, não inventa o número", () => {
    expect(novoRastroTurno({ chars: 10 }).ms_ate_processar).toBeNull();
    expect(novoRastroTurno({ chars: 10, recebidaEm: null }).ms_ate_processar).toBeNull();
  });
});

describe("o que o rastro conta, e o que ele nunca guarda", () => {
  beforeEach(() => {
    persistidos.length = 0;
  });

  it("consulta repetida vira número", () => {
    const r = novoRastroTurno({ chars: 10 });
    contarQuery(r, "perfil_vivo_membro");
    contarQuery(r, "perfil_vivo_membro");
    contarQuery(r, "rotinas");
    expect(r.queries.perfil_vivo_membro).toBe(2);
    expect(r.queries.rotinas).toBe(1);
  });

  it("chamada de modelo guarda função, modelo, duração e tokens", () => {
    const r = novoRastroTurno({ chars: 10 });
    registrarLLM(r, {
      funcao: "decidirTurno",
      provider: "openai",
      modelo: "gpt-x",
      ms: 1200,
      tokens_in: 900,
      tokens_out: 40,
      desfecho: "ok",
    });
    expect(r.chamadas).toHaveLength(1);
    expect(r.chamadas[0].modelo).toBe("gpt-x");
  });

  it("nenhum campo carrega fala da mãe ou da Ayla", () => {
    const r = novoRastroTurno({ chars: 137 });
    expect(r.chars_entrada).toBe(137);
    for (const k of Object.keys(r)) {
      expect(["texto", "mensagem", "fala", "conversa", "nome"], `campo suspeito: ${k}`).not.toContain(k);
    }
  });

  it("é PERSISTIDO, não só logado", async () => {
    const r = novoRastroTurno({ chars: 10 });
    r.saida = "tratada";
    await registrarRastroTurno(r);
    expect(persistidos[0].persistir).toBe(true);
    expect(persistidos[0].kind).toBe("turno_externo");
  });

  it("saída muda sobe a severidade", async () => {
    const r = novoRastroTurno({ chars: 10 });
    r.saida = "null_excecao";
    await registrarRastroTurno(r);
    expect(persistidos[0].severity).toBe("warn");
  });

  it("marco carimba tempo absoluto, para reconstruir a linha do tempo", () => {
    const r = novoRastroTurno({ chars: 10 });
    marco(r, "familia_resolvida");
    expect(r.marcos.familia_resolvida).toBeGreaterThan(0);
    expect(r.marcos.familia_resolvida).toBeGreaterThanOrEqual(r.marcos.inicio);
  });
});
