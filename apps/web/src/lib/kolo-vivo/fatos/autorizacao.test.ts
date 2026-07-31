import { describe, expect, it } from "vitest";
import {
  FLAG_ENV,
  LISTA_ENV,
  escritaSombraHabilitada,
  familiasAutorizadas,
  memoriaVivaAutorizada,
  resumoDaAutorizacao,
} from "./autorizacao";

/**
 * A BARREIRA DA AMOSTRA CONTROLADA.
 *
 * Cada caso aqui é uma forma de a configuração estar errada. Todas têm de
 * terminar no mesmo lugar: ninguém entra. O custo de não coletar um fato é ele
 * voltar na próxima conversa; o custo de coletar de quem não consentiu não tem
 * desfazer — então o viés é sempre para o "não".
 *
 * Os caminhos reais (WhatsApp, web, lote, cron) são exercidos contra Postgres
 * em `scripts/db/validar-autorizacao.mjs`.
 */

const A = "6f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f";
const B = "9ab27c31-5d6e-4f70-8192-a3b4c5d6e7f8";

const env = (flag?: string, lista?: string) => ({
  ...(flag === undefined ? {} : { [FLAG_ENV]: flag }),
  ...(lista === undefined ? {} : { [LISTA_ENV]: lista }),
});

describe("1. flag global desligada", () => {
  it("bloqueia mesmo com a família na lista", () => {
    expect(memoriaVivaAutorizada(A, env("0", A))).toBe(false);
    expect(memoriaVivaAutorizada(A, env("false", A))).toBe(false);
    expect(memoriaVivaAutorizada(A, env(undefined, A))).toBe(false);
  });
});

describe("2. flag ligada, lista ausente", () => {
  it("bloqueia — flag sozinha nunca autorizou ninguém", () => {
    expect(memoriaVivaAutorizada(A, env("1"))).toBe(false);
  });
});

describe("3. flag ligada, lista vazia", () => {
  it("bloqueia, com string vazia ou só espaço", () => {
    expect(memoriaVivaAutorizada(A, env("1", ""))).toBe(false);
    expect(memoriaVivaAutorizada(A, env("1", "   "))).toBe(false);
    expect(memoriaVivaAutorizada(A, env("1", " , ; "))).toBe(false);
  });
});

describe("4. configuração inválida", () => {
  it("bloqueia quando a lista não são uuids", () => {
    expect(memoriaVivaAutorizada(A, env("1", "familia-do-sergio"))).toBe(false);
    expect(memoriaVivaAutorizada(A, env("1", "5511999999999"))).toBe(false);
    expect(memoriaVivaAutorizada(A, env("1", "kkoloszuk@gmail.com"))).toBe(false);
  });

  it("UM token quebrado invalida a lista inteira", () => {
    // A regra que parece severa e é a certa: descartar só o token ruim
    // transformaria erro de digitação em autorização parcial silenciosa —
    // quem editou acharia que pôs duas famílias e teria posto uma.
    expect(memoriaVivaAutorizada(A, env("1", `${A},lixo`))).toBe(false);
    expect(memoriaVivaAutorizada(A, env("1", `${A},${B},xyz`))).toBe(false);
    expect(familiasAutorizadas(env("1", `${A},lixo`)).size).toBe(0);
  });

  it("uuid truncado ou com sobra não passa", () => {
    expect(memoriaVivaAutorizada(A, env("1", A.slice(0, -1)))).toBe(false);
    expect(memoriaVivaAutorizada(A, env("1", `${A}0`))).toBe(false);
  });
});

describe("5. família autorizada", () => {
  it("passa com a flag ligada e o id na lista", () => {
    expect(memoriaVivaAutorizada(A, env("1", A))).toBe(true);
    expect(memoriaVivaAutorizada(A, env("true", `${A},${B}`))).toBe(true);
  });

  it("caixa do uuid não importa", () => {
    expect(memoriaVivaAutorizada(A.toUpperCase(), env("1", A))).toBe(true);
    expect(memoriaVivaAutorizada(A, env("1", A.toUpperCase()))).toBe(true);
  });
});

describe("6. família não autorizada", () => {
  it("bloqueia quem está fora da lista", () => {
    expect(memoriaVivaAutorizada(B, env("1", A))).toBe(false);
  });

  it("id ausente, vazio ou malformado nunca entra", () => {
    for (const id of [null, undefined, "", "   ", "qualquer-coisa"]) {
      expect(memoriaVivaAutorizada(id, env("1", A))).toBe(false);
    }
  });
});

describe("7. duas famílias no mesmo processo", () => {
  it("recebem decisões diferentes com a mesma configuração", () => {
    const e = env("1", A);
    expect(memoriaVivaAutorizada(A, e)).toBe(true);
    expect(memoriaVivaAutorizada(B, e)).toBe(false);
  });
});

describe("8. espaços e separadores", () => {
  it("vírgula, ponto e vírgula, espaço e quebra de linha funcionam igual", () => {
    for (const lista of [
      `${A},${B}`,
      `${A}, ${B}`,
      `  ${A} , ${B}  `,
      `${A};${B}`,
      `${A}\n${B}`,
      `${A}\t${B}`,
      `${A},,${B}`,
    ]) {
      const e = env("1", lista);
      expect(familiasAutorizadas(e).size, lista).toBe(2);
      expect(memoriaVivaAutorizada(A, e), lista).toBe(true);
      expect(memoriaVivaAutorizada(B, e), lista).toBe(true);
    }
  });

  it("o id com espaço em volta continua sendo o mesmo id", () => {
    expect(memoriaVivaAutorizada(`  ${A}  `, env("1", A))).toBe(true);
  });
});

describe("9. identificador parcial", () => {
  it("prefixo de um uuid autorizado não autoriza outra família", () => {
    // Se a comparação fosse por prefixo ou `includes`, isto passaria.
    const parecido = `${A.slice(0, 8)}-0000-4000-8000-000000000000`;
    expect(memoriaVivaAutorizada(parecido, env("1", A))).toBe(false);
  });

  it("prefixo na LISTA não autoriza o uuid completo", () => {
    expect(memoriaVivaAutorizada(A, env("1", A.slice(0, 8)))).toBe(false);
  });
});

describe("flag e lista são perguntas separadas", () => {
  it("escritaSombraHabilitada só olha a flag", () => {
    expect(escritaSombraHabilitada(env("1"))).toBe(true);
    expect(escritaSombraHabilitada(env("0", A))).toBe(false);
    // Valores parecidos com verdadeiro que NÃO são: fail-closed.
    for (const v of ["sim", "yes", "on", "2", "TRUE ", " 1 "]) {
      expect(escritaSombraHabilitada(env(v)), v).toBe(v.trim().toLowerCase() === "true" || v.trim() === "1");
    }
  });

  it("o resumo de diagnóstico não expõe quem está na lista", () => {
    const r = resumoDaAutorizacao(env("1", `${A},${B}`));
    expect(r).toEqual({ flag: true, quantidade: 2 });
    expect(JSON.stringify(r)).not.toContain(A);
  });
});
