import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  FLAG_PILOTO_4A,
  FLAG_PILOTO_4A_FAMILIAS,
  pilotoQuatroA,
} from "./piloto";
import { providerConversacionalParaFamilia } from "@/lib/ia/provider";

/**
 * ISOLAMENTO DO PILOTO — quem recebe o quê, e sobretudo quem NÃO recebe.
 *
 * O piloto de 10/08/2026 tem três famílias reais (Admin, Rosangela, Sergio) e
 * 169 que não podem perceber nada. As identidades aqui são SINTÉTICAS: os ids
 * reais vivem em variável de ambiente, e um teste que os carregasse os tornaria
 * públicos no repositório — além de quebrar no dia em que a lista mudasse.
 *
 * O que se prova aqui é o MECANISMO. Que os ids certos estão na variável certa
 * é conferência de ambiente, não de teste — e está registrada na Fase 3 da
 * missão, por leitura de `api_calls` em produção.
 *
 * ⚠️ DUAS DECISÕES, DUAS PERGUNTAS. "Quem responde" (GPT × Claude) e "com o que
 * ela pensa" (4A) são independentes de propósito. Testá-las juntas esconderia
 * exatamente o acoplamento que o desenho evita.
 */

const src = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

const PILOTO_ADMIN = "aaaaaaaa-0000-0000-0000-000000000001";
const PILOTO_ROSANGELA = "aaaaaaaa-0000-0000-0000-000000000002";
const PILOTO_SERGIO = "aaaaaaaa-0000-0000-0000-000000000003";
const FAMILIA_COMUM_A = "bbbbbbbb-0000-0000-0000-000000000001";
const FAMILIA_COMUM_B = "bbbbbbbb-0000-0000-0000-000000000002";

const TRIO = [PILOTO_ADMIN, PILOTO_ROSANGELA, PILOTO_SERGIO];
const COMUNS = [FAMILIA_COMUM_A, FAMILIA_COMUM_B];

/** O ambiente do piloto, como ele existirá na Vercel. */
function ambienteDoPiloto() {
  process.env.IA_PROVIDER = "openai_teste";
  process.env.OPENAI_TEST_FAMILY_IDS = TRIO.join(",");
  process.env[FLAG_PILOTO_4A] = "teste";
  process.env[FLAG_PILOTO_4A_FAMILIAS] = TRIO.join(",");
}

afterEach(() => {
  delete process.env.IA_PROVIDER;
  delete process.env.OPENAI_TEST_FAMILY_IDS;
  delete process.env[FLAG_PILOTO_4A];
  delete process.env[FLAG_PILOTO_4A_FAMILIAS];
});

/** As duas decisões de um turno, para uma família. */
const turnoDe = (id: string | null | undefined) => ({
  provider: providerConversacionalParaFamilia(id),
  quatroA: pilotoQuatroA(id),
});

describe("o piloto recebe GPT + 4A", () => {
  it("1. as três famílias do piloto, nas duas decisões", () => {
    ambienteDoPiloto();
    for (const [nome, id] of [
      ["PILOTO_ADMIN", PILOTO_ADMIN],
      ["PILOTO_ROSANGELA", PILOTO_ROSANGELA],
      ["PILOTO_SERGIO", PILOTO_SERGIO],
    ] as const) {
      expect(turnoDe(id), nome).toEqual({ provider: "openai", quatroA: true });
    }
  });

  it("2. a decisão é a MESMA nos dois canais — não há função por canal", () => {
    // Web e WhatsApp chamam as mesmas duas funções. Se um canal ganhar a sua
    // própria cópia, uma família pode receber GPT no WhatsApp e Claude nas
    // Estratégias dentro da mesma conversa — que foi o motivo de a decisão de
    // provider ter sido centralizada em 06/08.
    expect(src("../app/api/conversar/stream/route.ts")).toMatch(
      /providerConversacionalParaFamilia\(family\.id\)/,
    );
    expect(src("ayla/responder.ts")).toMatch(
      /providerConversacionalParaFamilia\(tracking\?\.family_account_id\)/,
    );
    expect(src("ia/context.ts")).toMatch(/pilotoQuatroA\(familyId\)/);
    expect(src("ayla/orchestrator.ts")).toMatch(/pilotoQuatroA\(family\.id\)/);
  });
});

describe("as famílias comuns não percebem nada", () => {
  it("3. nenhuma família comum recebe 4A", () => {
    ambienteDoPiloto();
    for (const id of COMUNS) expect(pilotoQuatroA(id), id).toBe(false);
  });

  it("4. nenhuma família comum troca de provider", () => {
    ambienteDoPiloto();
    for (const id of COMUNS) {
      expect(providerConversacionalParaFamilia(id), id).toBe("anthropic");
    }
  });

  it("5. ausência de ID nunca ativa nada", () => {
    ambienteDoPiloto();
    for (const id of [null, undefined, "", "   "]) {
      expect(turnoDe(id), JSON.stringify(id)).toEqual({
        provider: "anthropic",
        quatroA: false,
      });
    }
  });

  it("6. MORDE: um id que só PARECE do piloto não entra", () => {
    // Prefixo, sufixo e espaço interno não podem casar. A lista é de igualdade,
    // nunca de "começa com" — senão um id novo que compartilhe prefixo entraria.
    ambienteDoPiloto();
    for (const quase of [
      PILOTO_ADMIN.slice(0, -1),
      `${PILOTO_ADMIN}x`,
      PILOTO_ADMIN.toUpperCase(),
      PILOTO_ADMIN.replace("-", ""),
    ]) {
      expect(pilotoQuatroA(quase), quase).toBe(false);
      expect(providerConversacionalParaFamilia(quase), quase).toBe("anthropic");
    }
  });
});

describe("erro de configuração falha de forma segura", () => {
  it("7. lista apagada = ninguém, nas duas decisões", () => {
    // O acidente mais provável: alguém apaga a variável, ou um deploy não a
    // carrega. Não pode virar "liberado pra todos".
    process.env.IA_PROVIDER = "openai_teste";
    process.env[FLAG_PILOTO_4A] = "teste";
    delete process.env.OPENAI_TEST_FAMILY_IDS;
    delete process.env[FLAG_PILOTO_4A_FAMILIAS];
    for (const id of [...TRIO, ...COMUNS]) {
      expect(turnoDe(id), id).toEqual({ provider: "anthropic", quatroA: false });
    }
  });

  it("8. estado escrito errado cai no comportamento antigo, nunca no novo", () => {
    for (const errado of ["ON", "Teste", "1", "true", "openai", "sim"]) {
      process.env[FLAG_PILOTO_4A] = errado;
      process.env[FLAG_PILOTO_4A_FAMILIAS] = TRIO.join(",");
      expect(pilotoQuatroA(PILOTO_ADMIN), errado).toBe(false);
    }
  });

  it("9. lista do piloto sem o estado `teste` não liga nada", () => {
    delete process.env[FLAG_PILOTO_4A];
    process.env[FLAG_PILOTO_4A_FAMILIAS] = TRIO.join(",");
    for (const id of TRIO) expect(pilotoQuatroA(id), id).toBe(false);
  });
});

describe("as duas decisões são independentes — e precisam continuar sendo", () => {
  it("10. dá para ter 4A sem GPT", () => {
    // O rollout seguinte pode querer medir a inteligência nova no Claude antes
    // de somar a troca de provider. Acoplar as listas tornaria isso impossível.
    delete process.env.IA_PROVIDER;
    process.env[FLAG_PILOTO_4A] = "teste";
    process.env[FLAG_PILOTO_4A_FAMILIAS] = PILOTO_ADMIN;
    expect(turnoDe(PILOTO_ADMIN)).toEqual({ provider: "anthropic", quatroA: true });
  });

  it("11. dá para ter GPT sem 4A", () => {
    process.env.IA_PROVIDER = "openai_teste";
    process.env.OPENAI_TEST_FAMILY_IDS = PILOTO_ADMIN;
    delete process.env[FLAG_PILOTO_4A];
    expect(turnoDe(PILOTO_ADMIN)).toEqual({ provider: "openai", quatroA: false });
  });

  it("12. MORDE: as listas não podem ser a mesma variável", () => {
    // Se alguém "simplificar" fazendo o piloto ler OPENAI_TEST_FAMILY_IDS, os
    // dois testes acima passam a ser impossíveis de satisfazer.
    process.env.IA_PROVIDER = "openai_teste";
    process.env.OPENAI_TEST_FAMILY_IDS = FAMILIA_COMUM_A;
    process.env[FLAG_PILOTO_4A] = "teste";
    process.env[FLAG_PILOTO_4A_FAMILIAS] = PILOTO_ADMIN;
    expect(turnoDe(FAMILIA_COMUM_A)).toEqual({ provider: "openai", quatroA: false });
    expect(turnoDe(PILOTO_ADMIN)).toEqual({ provider: "anthropic", quatroA: true });
  });
});

describe("o rollout geral não exige implementação nova", () => {
  it("13. `on` libera todos os canais para todas as famílias", () => {
    // É a promessa feita ao escolher este desenho: liberar para todos é trocar
    // uma palavra. Se este teste quebrar, o rollout virou código outra vez.
    process.env[FLAG_PILOTO_4A] = "on";
    delete process.env[FLAG_PILOTO_4A_FAMILIAS];
    for (const id of [...TRIO, ...COMUNS, null]) {
      expect(pilotoQuatroA(id), String(id)).toBe(true);
    }
  });
});

describe("o Plano continua fora desta missão", () => {
  it("14. MORDE: o gerador do Plano não consulta o piloto", () => {
    // PEND-027 documenta que o Plano é cego para BASE 2, perfil consultável e
    // ranking — e que isso NÃO se corrige aqui. Se `plano.ts` começar a ler o
    // piloto, a missão vazou para uma frente que tem pendência própria.
    const plano = src("ia/plano.ts");
    expect(plano, "plano.ts passou a ler o piloto").not.toMatch(/pilotoQuatroA|KOLO_PILOTO_4A/);
    expect(plano, "plano.ts passou a usar perfil consultável").not.toMatch(
      /carregarPerfilConsultavel/,
    );
    expect(plano, "plano.ts passou a usar BASE 2").not.toMatch(/secoesDe\(/);
  });

  it("15. MORDE: o Plano continua sem passar `relato` — o ranking não o alcança", () => {
    const plano = src("ia/plano.ts");
    const chamadas = plano.split("buildContext(").slice(1);
    expect(chamadas.length).toBeGreaterThan(0);
    for (const c of chamadas) {
      const args = c.slice(0, c.indexOf("})"));
      expect(args, "plano.ts passou relato para buildContext").not.toMatch(/\brelato\s*:/);
    }
  });
});
