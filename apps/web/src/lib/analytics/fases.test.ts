import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import {
  classificarFase,
  estaAtivado,
  FASE_INFO,
  FASE_ORDEM,
  type Fase,
  type SinaisDaFamilia,
} from "./fases";

/**
 * A RÉGUA DA JORNADA, escrita como tabela.
 *
 * Este arquivo é o documento executável da definição de cada fase. Quando a
 * Karina quiser mudar o que significa "ativado", muda-se a tabela abaixo e o
 * código segue — não o contrário.
 */

const BASE: SinaisDaFamilia = {
  concluiuOnboarding: false,
  usosUltimos90d: 0,
  temAtividade: false,
  temPlano: false,
  falouComAyla: false,
  horasSemAtividade: null,
  statusAssinatura: "trialing",
  trialVencido: false,
  diaDoTrial: 1,
};

const com = (p: Partial<SinaisDaFamilia>): SinaisDaFamilia => ({ ...BASE, ...p });

describe("a tabela de casos", () => {
  const casos: Array<[string, Partial<SinaisDaFamilia>, Fase]> = [
    ["criou a conta e sumiu", {}, "cadastrou"],
    ["abriu e mexeu, sem terminar o cadastro", { temAtividade: true }, "ativou_teste"],
    [
      "terminou o cadastro mas não fez nada",
      { concluiuOnboarding: true },
      "cadastrou",
    ],
    [
      "terminou o cadastro e usou o app",
      { concluiuOnboarding: true, temAtividade: true, usosUltimos90d: 1 },
      "ativado",
    ],
    [
      "terminou o cadastro e só conversou com a Ayla",
      { concluiuOnboarding: true, temAtividade: true, falouComAyla: true },
      "ativado",
    ],
    [
      "terminou o cadastro e só recebeu um plano",
      { concluiuOnboarding: true, temAtividade: true, temPlano: true },
      "ativado",
    ],
    [
      "voltou: usou duas vezes",
      { concluiuOnboarding: true, temAtividade: true, usosUltimos90d: 2 },
      "engajado",
    ],
    [
      "recebeu plano E conversou com a Ayla",
      { concluiuOnboarding: true, temAtividade: true, temPlano: true, falouComAyla: true },
      "engajado",
    ],
    [
      "usou e parou há mais de um dia",
      { concluiuOnboarding: true, temAtividade: true, usosUltimos90d: 1, horasSemAtividade: 30 },
      "em_risco",
    ],
    [
      "reta final do teste, já usou",
      { concluiuOnboarding: true, temAtividade: true, usosUltimos90d: 1, diaDoTrial: 6 },
      "oportunidade",
    ],
    ["assinou", { statusAssinatura: "active" }, "convertido"],
    ["o teste acabou", { trialVencido: true }, "expirado"],
    ["cancelou", { statusAssinatura: "canceled" }, "expirado"],
    ["pausou", { statusAssinatura: "paused" }, "expirado"],
  ];

  for (const [nome, sinais, esperada] of casos) {
    it(`${nome} → ${esperada}`, () => {
      expect(classificarFase(com(sinais))).toBe(esperada);
    });
  }
});

describe("conversa com a Ayla conta como valor", () => {
  it("quem só usa o WhatsApp está ativada — era o que a régua antiga perdia", () => {
    // A cópia do drill-down exigia uso no APP. Uma mãe que terminou o cadastro
    // e fala com a Ayla todo dia aparecia como NÃO ativada: o produto se
    // media pelo canal secundário.
    const soWhatsApp = com({ concluiuOnboarding: true, temAtividade: true, falouComAyla: true });
    expect(estaAtivado(soWhatsApp)).toBe(true);

    const reguaAntiga = soWhatsApp.concluiuOnboarding && soWhatsApp.usosUltimos90d >= 1;
    expect(reguaAntiga).toBe(false); // o que mudou
  });

  it("sem terminar o cadastro, conversar com a Ayla não basta", () => {
    expect(estaAtivado(com({ falouComAyla: true, temAtividade: true }))).toBe(false);
  });
});

describe("prioridade: a fase é um estado único", () => {
  it("quem assinou não aparece como engajada", () => {
    const s = com({
      statusAssinatura: "active",
      concluiuOnboarding: true,
      temAtividade: true,
      usosUltimos90d: 9,
    });
    expect(classificarFase(s)).toBe("convertido");
  });

  it("oportunidade vence engajado na reta final", () => {
    const s = com({
      concluiuOnboarding: true,
      temAtividade: true,
      usosUltimos90d: 5,
      diaDoTrial: 7,
    });
    expect(classificarFase(s)).toBe("oportunidade");
  });

  it("nunca devolve fase fora da lista", () => {
    for (const st of ["trialing", "active", "canceled", "paused", "past_due", null]) {
      const f = classificarFase(com({ statusAssinatura: st }));
      expect(FASE_ORDEM).toContain(f);
    }
  });
});

describe("toda fase tem definição visível", () => {
  it("nenhuma fase fica sem rótulo nem sem definição", () => {
    for (const f of FASE_ORDEM) {
      expect(FASE_INFO[f].label, `${f} sem rótulo`).toBeTruthy();
      expect(FASE_INFO[f].definicao, `${f} sem definição`).toBeTruthy();
    }
  });

  it("a definição é frase para gente ler, não fórmula", () => {
    for (const f of FASE_ORDEM) {
      const d = FASE_INFO[f].definicao;
      expect(d.length, `${f}: definição curta demais`).toBeGreaterThan(15);
      expect(d, `${f}: vazou nome de campo do banco`).not.toMatch(/onboarding_completed|user_events|>=/);
    }
  });

  it("nenhum rótulo repete — dois nomes parecidos foi como tudo se embaralhou", () => {
    // "Ativou o teste" ao lado de "Ativado" produziu uma terceira régua.
    const labels = FASE_ORDEM.map((f) => FASE_INFO[f].label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels).toContain("Começou a usar");
  });
});

describe("ninguém mais decide a fase por conta própria", () => {
  const SRC = resolve(__dirname, "../..");

  function arquivos(dir: string, acc: string[] = []): string[] {
    for (const nome of readdirSync(dir)) {
      if (nome === "node_modules" || nome === ".next") continue;
      const caminho = join(dir, nome);
      if (statSync(caminho).isDirectory()) arquivos(caminho, acc);
      else if (/\.tsx?$/.test(nome)) acc.push(caminho);
    }
    return acc;
  }

  it("só ./fases classifica — o resto coleta sinais e chama", () => {
    // Foi a duplicação desta decisão em três lugares que fez "ativado"
    // significar coisas diferentes em painéis diferentes.
    const culpados: string[] = [];
    for (const caminho of arquivos(SRC)) {
      const rel = relative(SRC, caminho).replace(/\\/g, "/");
      if (rel === "lib/analytics/fases.ts" || rel === "lib/analytics/fases.test.ts") continue;
      const src = readFileSync(caminho, "utf8");
      // A assinatura de uma régua paralela: decidir ativação na mão.
      // `\s*` guloso retrocede e faria a negação valer contra o espaço —
      // por isso o espaço é literal aqui.
      const decideNaMao =
        /onboarding_completed\)?\s*&&/.test(src) ||
        /(ativado|engajado)Bool = (?!esta(Ativado|Engajado))/.test(src);
      if (decideNaMao) {
        culpados.push(rel);
      }
    }
    expect(
      culpados,
      `estes arquivos voltaram a decidir a fase sozinhos — use classificarFase()/estaAtivado()`,
    ).toEqual([]);
  });
});
