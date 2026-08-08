import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  RESPOSTAS_FEEDBACK,
  ehRespostaFeedback,
  gravarResultadoDaRotina,
  resultadoDe,
} from "./rotina-resultado";

/** Cliente falso, em memória: exercita a função de verdade, sem banco. */
function fakeSupabase(opts: {
  linhas?: Array<{ id: string; family_account_id: string }>;
  erro?: string;
}) {
  const chamadas: Array<{ tabela: string; patch: Record<string, unknown>; filtros: Record<string, string> }> = [];
  const linhas = opts.linhas ?? [];
  const cliente = {
    from(tabela: string) {
      return {
        update(patch: Record<string, unknown>) {
          const filtros: Record<string, string> = {};
          const chain = {
            eq(coluna: string, valor: string) {
              filtros[coluna] = valor;
              return chain;
            },
            select(_cols: string) {
              chamadas.push({ tabela, patch, filtros });
              if (opts.erro) return Promise.resolve({ data: null, error: { message: opts.erro } });
              const casadas = linhas.filter(
                (l) => l.id === filtros.id && l.family_account_id === filtros.family_account_id,
              );
              return Promise.resolve({ data: casadas.map((l) => ({ id: l.id })), error: null });
            },
          };
          return chain;
        },
      };
    },
  };
  return { cliente: cliente as never, chamadas };
}

const ROTINA = "11111111-1111-1111-1111-111111111111";
const FAMILIA = "22222222-2222-2222-2222-222222222222";
const OUTRA = "33333333-3333-3333-3333-333333333333";
const linha = [{ id: ROTINA, family_account_id: FAMILIA }];

describe("vocabulário", () => {
  it("1. os quatro botões da tela viram os quatro valores que o banco aceita", () => {
    expect(RESPOSTAS_FEEDBACK.map((r) => r.resultado)).toEqual([
      "funcionou",
      "parcial",
      "nao_testou",
      "nao_funcionou",
    ]);
  });

  it("2. cada resposta traduz para o resultado certo", () => {
    expect(resultadoDe("ajudou")).toBe("funcionou");
    expect(resultadoDe("ajudou_em_parte")).toBe("parcial");
    expect(resultadoDe("nao_usamos")).toBe("nao_testou");
    expect(resultadoDe("quero_ajustar")).toBe("nao_funcionou");
  });

  it("3. NENHUM valor gravado pode estar fora do check da migração 0075", () => {
    // Lê o SQL de verdade: se alguém acrescentar uma resposta na tela sem
    // acrescentar no banco, a gravação estouraria em produção, não aqui.
    const sql = readFileSync(
      resolve(__dirname, "../../../../../supabase/migrations/0075_rotina_resultado.sql"),
      "utf8",
    );
    const aceitos = [...sql.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    for (const r of RESPOSTAS_FEEDBACK) {
      expect(aceitos, `"${r.resultado}" não está no check da 0075`).toContain(r.resultado);
    }
  });

  it("4. resposta desconhecida não vira valor silencioso", () => {
    expect(ehRespostaFeedback("ajudou")).toBe(true);
    expect(ehRespostaFeedback("talvez")).toBe(false);
    expect(() => resultadoDe("talvez" as never)).toThrow();
  });
});

describe("gravarResultadoDaRotina", () => {
  it("5. grava a resposta e o timestamp", async () => {
    const { cliente, chamadas } = fakeSupabase({ linhas: linha });
    const agora = new Date("2026-08-08T12:00:00.000Z");
    const r = await gravarResultadoDaRotina(cliente, {
      rotinaId: ROTINA,
      familyId: FAMILIA,
      resposta: "ajudou",
      agora,
    });
    expect(r).toEqual({ ok: true });
    expect(chamadas[0].tabela).toBe("rotinas");
    expect(chamadas[0].patch).toEqual({
      resultado: "funcionou",
      resultado_em: agora.toISOString(),
    });
  });

  it("6. isola por família E por rotina — os dois filtros, sempre", async () => {
    const { cliente, chamadas } = fakeSupabase({ linhas: linha });
    await gravarResultadoDaRotina(cliente, {
      rotinaId: ROTINA,
      familyId: FAMILIA,
      resposta: "ajudou_em_parte",
    });
    expect(chamadas[0].filtros).toEqual({ id: ROTINA, family_account_id: FAMILIA });
  });

  it("7. rotina de OUTRA família não é alterada — e NÃO devolve sucesso", async () => {
    const { cliente } = fakeSupabase({ linhas: linha });
    const r = await gravarResultadoDaRotina(cliente, {
      rotinaId: ROTINA,
      familyId: OUTRA,
      resposta: "ajudou",
    });
    expect(r.ok).toBe(false);
    expect(r).toHaveProperty("error");
  });

  it("8. rotina inexistente não devolve sucesso", async () => {
    const { cliente } = fakeSupabase({ linhas: [] });
    const r = await gravarResultadoDaRotina(cliente, {
      rotinaId: ROTINA,
      familyId: FAMILIA,
      resposta: "nao_usamos",
    });
    expect(r.ok).toBe(false);
  });

  it("9. erro de persistência NUNCA aparece como sucesso", async () => {
    const { cliente } = fakeSupabase({ erro: "connection reset" });
    const r = await gravarResultadoDaRotina(cliente, {
      rotinaId: ROTINA,
      familyId: FAMILIA,
      resposta: "ajudou",
    });
    expect(r).toEqual({ ok: false, error: "connection reset" });
  });

  it("10. a mãe pode mudar a resposta — a última vale", async () => {
    const { cliente, chamadas } = fakeSupabase({ linhas: linha });
    await gravarResultadoDaRotina(cliente, { rotinaId: ROTINA, familyId: FAMILIA, resposta: "ajudou" });
    const r = await gravarResultadoDaRotina(cliente, {
      rotinaId: ROTINA,
      familyId: FAMILIA,
      resposta: "quero_ajustar",
    });
    expect(r).toEqual({ ok: true });
    expect(chamadas[1].patch.resultado).toBe("nao_funcionou");
  });

  it("11. NÃO apaga a nota que a família escreveu pelo WhatsApp", async () => {
    const { cliente, chamadas } = fakeSupabase({ linhas: linha });
    await gravarResultadoDaRotina(cliente, { rotinaId: ROTINA, familyId: FAMILIA, resposta: "ajudou" });
    expect(chamadas[0].patch).not.toHaveProperty("resultado_nota");
  });

  it("12. não mexe em seguimento_enviado_em — quem responde aqui sai da fila por ter resultado", async () => {
    const { cliente, chamadas } = fakeSupabase({ linhas: linha });
    await gravarResultadoDaRotina(cliente, { rotinaId: ROTINA, familyId: FAMILIA, resposta: "ajudou" });
    expect(chamadas[0].patch).not.toHaveProperty("seguimento_enviado_em");
  });
});
