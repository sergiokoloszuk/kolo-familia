import { describe, expect, it } from "vitest";
import {
  carregarPerfilConsultavel,
  classificarValor,
  resumoDoDominio,
} from "./consultar";

/**
 * BASE 1 consultável. O cliente é falso e em memória, mas a função exercitada
 * é a de verdade — inclusive o `parsearSubcampos` que a tela do Kolo Vivo usa.
 */
function fakeSupabase(linhas: Array<Record<string, unknown>>) {
  const filtros: Record<string, string> = {};
  const chain = {
    select: () => chain,
    eq(coluna: string, valor: string) {
      filtros[coluna] = valor;
      return chain;
    },
    maybeSingle() {
      const achada = linhas.find(
        (l) =>
          l.membro_atipico_id === filtros.membro_atipico_id &&
          l.family_account_id === filtros.family_account_id,
      );
      return Promise.resolve({ data: achada ?? null, error: null });
    },
  };
  return { from: () => chain, filtros } as never;
}

const FAM = "fam-1";
const OUTRA_FAM = "fam-2";
const A = "crianca-a";
const B = "crianca-b";

/** Texto do domínio sono, no formato exato que a tela grava. */
const SONO_A = [
  "Como costuma ser o sono: irregular, varia muito",
  "Como adormece: preciso ficar no quarto até ele apagar",
  "Despertares: não",
  "O que atrapalha: medo do escuro",
].join("\n");

const linhaA = {
  membro_atipico_id: A,
  family_account_id: FAM,
  categorias_extras: { sono: SONO_A, foco: "Como é o foco: disperso na lição" },
};
const linhaB = {
  membro_atipico_id: B,
  family_account_id: OUTRA_FAM,
  categorias_extras: { sono: "Como adormece: dorme sozinha em 10 minutos" },
};

describe("classificarValor — os três estados", () => {
  it("1. texto com conteúdo é preenchido", () => {
    expect(classificarValor("medo do escuro")).toEqual({
      estado: "preenchido",
      valor: "medo do escuro",
    });
  });

  it("2. ausência é vazio, e vazio não tem valor", () => {
    for (const v of ["", "   ", null, undefined]) {
      expect(classificarValor(v)).toEqual({ estado: "vazio", valor: null });
    }
  });

  it("3. C · negativa NÃO é confundida com desconhecido", () => {
    for (const v of ["não", "Não", "nao", "nenhum", "nenhuma", "nada", "não.", "-"]) {
      const r = classificarValor(v);
      expect(r.estado, `"${v}" deveria ser negativo`).toBe("negativo");
      expect(r.valor).not.toBeNull();
    }
  });

  it("4. 'não' dentro de uma frase NÃO vira negativa — é resposta de verdade", () => {
    // "não consegue dormir sem mim" é informação rica; tratá-la como negativa
    // apagaria o que a mãe contou.
    expect(classificarValor("não consegue dormir sem mim").estado).toBe("preenchido");
    expect(classificarValor("não tem hora certa, varia muito").estado).toBe("preenchido");
  });
});

describe("A/B/E · campos são recuperados do domínio certo", () => {
  it("5. campo preenchido volta com o valor", async () => {
    const p = await carregarPerfilConsultavel(fakeSupabase([linhaA]), {
      membroId: A,
      familyId: FAM,
    });
    expect(p.valorDe("sono", "adormece")).toContain("ficar no quarto");
    expect(p.sabemos("sono", "adormece")).toBe(true);
  });

  it("6. campo nunca respondido é reconhecido como vazio", async () => {
    const p = await carregarPerfilConsultavel(fakeSupabase([linhaA]), {
      membroId: A,
      familyId: FAM,
    });
    const lac = p.lacunasDe("sono").map((c) => c.key);
    expect(lac.length).toBeGreaterThan(0);
    for (const k of lac) expect(p.sabemos("sono", k)).toBe(false);
  });

  it("7. a negativa CONTA como sabido — não vira lacuna", async () => {
    const p = await carregarPerfilConsultavel(fakeSupabase([linhaA]), {
      membroId: A,
      familyId: FAM,
    });
    // "Despertares: não" foi respondido. Perguntar de novo é o erro.
    expect(p.sabemos("sono", "despertares")).toBe(true);
    expect(p.lacunasDe("sono").map((c) => c.key)).not.toContain("despertares");
  });

  it("8. E · cada domínio lê o seu próprio texto", async () => {
    const p = await carregarPerfilConsultavel(fakeSupabase([linhaA]), {
      membroId: A,
      familyId: FAM,
    });
    expect(p.valorDe("foco", "padrao") ?? "").toContain("disperso");
    // O que está em foco não pode aparecer em sono.
    const sono = p.dominios.get("sono")!;
    expect(JSON.stringify(sono)).not.toContain("disperso");
  });
});

describe("D · criança A nunca recebe dado da criança B", () => {
  it("9. o perfil de outra família não é alcançado", async () => {
    const p = await carregarPerfilConsultavel(fakeSupabase([linhaA, linhaB]), {
      membroId: B,
      familyId: FAM, // família errada para essa criança
    });
    expect(p.valorDe("sono", "adormece")).toBeNull();
    expect(JSON.stringify([...p.dominios.values()])).not.toContain("dorme sozinha");
  });

  it("10. com a família certa, o dado é o dela — e só o dela", async () => {
    const p = await carregarPerfilConsultavel(fakeSupabase([linhaA, linhaB]), {
      membroId: B,
      familyId: OUTRA_FAM,
    });
    expect(p.valorDe("sono", "adormece")).toContain("dorme sozinha");
    expect(JSON.stringify([...p.dominios.values()])).not.toContain("medo do escuro");
  });

  it("11. os dois filtros são aplicados, sempre", async () => {
    const sb = fakeSupabase([linhaA]);
    await carregarPerfilConsultavel(sb, { membroId: A, familyId: FAM });
    expect((sb as unknown as { filtros: Record<string, string> }).filtros).toEqual({
      membro_atipico_id: A,
      family_account_id: FAM,
    });
  });
});

describe("F · o que já sabemos impede a pergunta repetida", () => {
  it("12. o caso real do golden case de sono", async () => {
    const p = await carregarPerfilConsultavel(fakeSupabase([linhaA]), {
      membroId: A,
      familyId: FAM,
    });
    // Já contado: NÃO perguntar de novo.
    expect(p.sabemos("sono", "adormece")).toBe(true);
    expect(p.sabemos("sono", "atrapalha")).toBe(true);
    // Ainda desconhecido: é aqui que cabe a próxima pergunta.
    const lacunas = p.lacunasDe("sono").map((c) => c.label);
    expect(lacunas.length).toBeGreaterThan(0);
    expect(lacunas.join(" ")).not.toContain("Como adormece");
  });

  it("13. o resumo traz só o que se sabe, e some quando não se sabe nada", async () => {
    const p = await carregarPerfilConsultavel(fakeSupabase([linhaA]), {
      membroId: A,
      familyId: FAM,
    });
    const txt = resumoDoDominio(p.dominios.get("sono"));
    expect(txt).toContain("medo do escuro");
    expect(txt).not.toContain("Horários"); // vazio não vira linha
    expect(resumoDoDominio(p.dominios.get("nutricional"))).toBe("");
  });

  it("14. perfil inexistente não quebra — tudo vira lacuna", async () => {
    const p = await carregarPerfilConsultavel(fakeSupabase([]), {
      membroId: "ninguem",
      familyId: FAM,
    });
    expect(p.sabemos("sono", "adormece")).toBe(false);
    expect(p.lacunasDe("sono").length).toBeGreaterThan(0);
    expect(resumoDoDominio(p.dominios.get("sono"))).toBe("");
  });

  it("15. banco fora do ar não derruba a consulta", async () => {
    const quebrado = {
      from: () => ({
        select: () => ({
          eq: () => ({ eq: () => ({ maybeSingle: () => Promise.reject(new Error("down")) }) }),
        }),
      }),
    } as never;
    const p = await carregarPerfilConsultavel(quebrado, { membroId: A, familyId: FAM });
    expect(p.sabemos("sono", "adormece")).toBe(false);
  });
});
