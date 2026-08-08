import { describe, it, expect } from "vitest";
import { contarStatusAssinatura, TRIAL_VENCIDO, FUNIL_ASSINATURA } from "./dashboard";
import { assinaturaLiberada } from "@/lib/auth/assinatura";

/**
 * "161 EM TESTE" QUANDO 43 ESTÃO EM TESTE.
 *
 * O trial não expira sozinho no banco: a linha continua `status = 'trialing'`
 * depois de `trial_ends_at` passar, e quem decide acesso é `assinaturaLiberada`,
 * que confere a data. Somar o `status` cru mostra uma população de teste quase
 * quatro vezes maior que a real — e todo número que parta daí herda a distorção.
 *
 * Estes testes medem o que a tela mostra, não a implementação: dado um conjunto
 * de linhas, quantas caem em cada balde.
 */

const DIA = 24 * 60 * 60 * 1000;
const AGORA = Date.now();
const ONTEM = new Date(AGORA - DIA).toISOString();
const DAQUI_A_3_DIAS = new Date(AGORA + 3 * DIA).toISOString();

const linha = (status: string, extra: Record<string, unknown> = {}) => ({
  status,
  trial_ends_at: null,
  cortesia: false,
  cortesia_ate: null,
  pagamento_falhou_em: null,
  ...extra,
});

describe("funil de assinatura: trial vencido sai do balde de teste", () => {
  it("trial dentro do prazo conta como em teste", () => {
    const c = contarStatusAssinatura([linha("trialing", { trial_ends_at: DAQUI_A_3_DIAS })]);
    expect(c.trialing).toBe(1);
    expect(c[TRIAL_VENCIDO]).toBeUndefined();
  });

  it("trial vencido NÃO conta como em teste", () => {
    const c = contarStatusAssinatura([linha("trialing", { trial_ends_at: ONTEM })]);
    expect(c.trialing).toBeUndefined();
    expect(c[TRIAL_VENCIDO]).toBe(1);
  });

  it("o retrato real de produção (2026-08-08) deixa de mentir", () => {
    // 163 linhas: 161 trialing (118 vencidas) + 2 active.
    const linhas = [
      ...Array.from({ length: 43 }, () => linha("trialing", { trial_ends_at: DAQUI_A_3_DIAS })),
      ...Array.from({ length: 118 }, () => linha("trialing", { trial_ends_at: ONTEM })),
      ...Array.from({ length: 2 }, () => linha("active")),
    ];

    const c = contarStatusAssinatura(linhas);

    // ANTES a tela dizia 161 "trialing". DEPOIS:
    expect(c.trialing).toBe(43);
    expect(c[TRIAL_VENCIDO]).toBe(118);
    expect(c.active).toBe(2);
    // Nada some no caminho: os baldes somam o total de linhas.
    expect(Object.values(c).reduce((a, b) => a + b, 0)).toBe(linhas.length);
  });

  it("o balde de teste bate com quem REALMENTE tem acesso pelo trial", () => {
    // A régua não é a contagem por si: é coincidir com a regra que libera o app.
    const linhas = [
      linha("trialing", { trial_ends_at: DAQUI_A_3_DIAS }),
      linha("trialing", { trial_ends_at: ONTEM }),
      linha("trialing", { trial_ends_at: null }), // trialing sem data também não libera
    ];

    const c = contarStatusAssinatura(linhas);
    const comAcessoPeloTrial = linhas.filter((l) => assinaturaLiberada(l as never)).length;

    expect(c.trialing ?? 0).toBe(comAcessoPeloTrial);
  });

  it("os outros status seguem intactos — a correção não mexe em quem não é trial", () => {
    const linhas = [
      linha("active"),
      linha("past_due", { pagamento_falhou_em: ONTEM }),
      linha("paused"),
      linha("canceled"),
    ];

    const c = contarStatusAssinatura(linhas);

    expect(c).toEqual({ active: 1, past_due: 1, paused: 1, canceled: 1 });
    expect(c[TRIAL_VENCIDO]).toBeUndefined();
  });

  it("cortesia sobre trial vencido continua no balde vencido — cortesia não é trial", () => {
    // Ela TEM acesso (por cortesia), mas o trial dela venceu. Contar como "em
    // teste" faria a leitura comercial mentir nos dois sentidos.
    const c = contarStatusAssinatura([
      linha("trialing", { trial_ends_at: ONTEM, cortesia: true, cortesia_ate: null }),
    ]);
    expect(c[TRIAL_VENCIDO]).toBe(1);
    expect(c.trialing).toBeUndefined();
  });

  it("linha sem status não derruba a contagem", () => {
    const c = contarStatusAssinatura([{ status: null }]);
    expect(c["—"]).toBe(1);
  });
});

describe("a tela mostra a definição de cada balde", () => {
  it("todo balde do funil tem rótulo e definição — nada de chave crua", () => {
    // Regra da casa: indicador sem definição na tela vira três conceitos.
    for (const b of FUNIL_ASSINATURA) {
      expect(b.rotulo.length, b.chave).toBeGreaterThan(0);
      expect(b.definicao.length, b.chave).toBeGreaterThan(0);
      expect(b.rotulo, b.chave).not.toBe(b.chave);
    }
  });

  it("o balde derivado aparece no funil, senão 118 famílias sumiriam da tela", () => {
    expect(FUNIL_ASSINATURA.map((b) => b.chave)).toContain(TRIAL_VENCIDO);
  });
});
