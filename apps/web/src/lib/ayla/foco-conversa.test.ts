import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolverFoco, criancaDeForaNaConversa, blocoDeFoco, type Membro } from "./experimental-foco";

/**
 * O FOCO LEMBRA A CONVERSA — 23/11/2026.
 *
 * Caso real, simulador da Karina (família com Manu e Mario). Ela falou de uma
 * terceira filha: "minha filha" e "ela" apontavam pelo gênero para a Manu, e a
 * Ayla chamava a terceira criança de Manu. Sem sinal de gênero, o foco caía em
 * `ambiguo` a cada mensagem e a Ayla perguntava de novo "é a terceira ou um dos
 * seus filhos?" depois de já ter a resposta.
 *
 * Os casos marcados LEGÍTIMO são os que a correção não pode quebrar (§12, I).
 */

/** Banco vazio: a "última criança das 24 h" não existe — como no simulador. */
const bancoVazio = new Proxy({}, {
  get: (_t, p) => (p === "then" ? (ok: (v: unknown) => void) => ok({ data: [] }) : () => bancoVazio),
}) as unknown as SupabaseClient;

const MANU: Membro = { id: "manu", nome: "Manu", genero: "feminino" };
const MARIO: Membro = { id: "mario", nome: "Mario", genero: "masculino" };
const KARINA = [MANU, MARIO];
const ALICE: Membro = { id: "alice", nome: "Alice", genero: "feminino" };
const BIA: Membro = { id: "bia", nome: "Bia", genero: "feminino" };
const DUAS = [ALICE, BIA];

const foco = (texto: string, membros: Membro[], antes: string[] = []) =>
  resolverFoco(bancoVazio, "fam", texto, membros, antes);

describe("O CASO DA KARINA — criança que não está cadastrada", () => {
  it("'ela' depois de 'minha terceira filha' NÃO é a Manu", async () => {
    const f = await foco("ela acorda várias vezes de madrugada", KARINA, [
      "Quero ajuda com a Lia, minha terceira filha, ela chora muito na hora de dormir",
    ]);
    expect(f.tipo).toBe("externa");
    expect(f.membros).toEqual([]);
  });

  it("a resposta 'nenhum dos dois, é meu sobrinho' vale nos turnos seguintes", async () => {
    expect((await foco("nenhum dos dois, é meu sobrinho Davi que mora comigo", KARINA)).tipo).toBe("externa");
    const depois = await foco("ele bate nos colegas também", KARINA, [
      "nenhum dos dois, é meu sobrinho Davi que mora comigo",
      "a criança não para quieta na sala",
    ]);
    expect(depois.tipo).toBe("externa");
  });

  it("'não é a Manu nem o Mario' é criança de fora", async () => {
    expect((await foco("não é a Manu nem o Mario, é outra criança", KARINA)).tipo).toBe("externa");
  });

  it("o bloco manda NÃO perguntar de novo e NÃO usar os cadastrados", async () => {
    const b = blocoDeFoco(await foco("ela não dorme", KARINA, ["é minha terceira filha"]));
    expect(b).toMatch(/NÃO pergunte de novo/);
    expect(b).toMatch(/Manu e Mario/);
  });

  it("o orquestrador enxerga a mesma decisão", () => {
    expect(criancaDeForaNaConversa("ela chora", ["é minha terceira filha, a Lia"], KARINA)).toBe(true);
    expect(criancaDeForaNaConversa("a Manu chorou", ["é minha terceira filha, a Lia"], KARINA)).toBe(false);
    expect(criancaDeForaNaConversa("ela chora", [], KARINA)).toBe(false);
  });
});

describe("A RESPOSTA DA MÃE VALE NOS TURNOS SEGUINTES", () => {
  it("duas filhas: depois de 'a Bia', o 'ela' seguinte continua sendo a Bia", async () => {
    const f = await foco("e ela grita quando a água cai na cabeça", DUAS, [
      "a Bia",
      "ela não quer tomar banho de jeito nenhum",
    ]);
    expect(f.tipo).toBe("individual");
    expect(f.membros.map((m) => m.id)).toEqual(["bia"]);
  });

  it("sem nada decisivo na conversa, continua ambíguo (não chuta)", async () => {
    const f = await foco("ela não quer tomar banho", DUAS, ["oi", "tudo bem?"]);
    expect(f.tipo).toBe("ambiguo");
  });

  it("a fala mais RECENTE manda: troca de criança no meio da conversa", async () => {
    const f = await foco("e ela dorme mal", DUAS, ["agora a Alice", "a Bia não come"]);
    expect(f.membros.map((m) => m.id)).toEqual(["alice"]);
  });
});

describe("LEGÍTIMO — o que não pode quebrar", () => {
  it("'A Manu não brinca com outra criança' continua sendo a Manu", async () => {
    const f = await foco("A Manu não brinca com outra criança no recreio", KARINA);
    expect(f.tipo).toBe("individual");
    expect(f.membros.map((m) => m.id)).toEqual(["manu"]);
  });

  it("'nenhum dos dois quer comer' fala DOS DOIS, não de criança de fora", async () => {
    const f = await foco("nenhum dos dois quer comer hoje", KARINA);
    expect(f.tipo).not.toBe("externa");
  });

  it("'não é a Manu, é o Mario' resolve no Mario", async () => {
    const f = await foco("não é a Manu, é o Mario que não dorme", KARINA);
    expect(f.membros.map((m) => m.id)).toEqual(["mario"]);
  });

  it("'minha filha não come' sem conversa continua na Manu (regra de gênero)", async () => {
    const f = await foco("minha filha não come", KARINA);
    expect(f.membros.map((m) => m.id)).toEqual(["manu"]);
  });

  it("gênero da mensagem atual vence o nome de um turno antigo", async () => {
    const f = await foco("meu filho não dormiu", KARINA, ["a Manu não come"]);
    expect(f.membros.map((m) => m.id)).toEqual(["mario"]);
  });

  it("'os dois' continua compartilhado", async () => {
    expect((await foco("os dois brigam o tempo todo", KARINA)).tipo).toBe("compartilhado");
  });

  it("filho único sem sinal de fora continua 'unica'", async () => {
    expect((await foco("ela não dorme", [MANU])).tipo).toBe("unica");
  });

  it("filho único, mas a mãe fala da sobrinha: não usa o perfil da filha", async () => {
    expect((await foco("minha sobrinha de 5 anos não fala", [MANU])).tipo).toBe("externa");
  });
});
