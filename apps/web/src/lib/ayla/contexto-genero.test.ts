import { describe, it, expect } from "vitest";
import { montarContextoBase } from "./experimental-contexto";

/**
 * O GÊNERO REGISTRADO CHEGA AO MODELO — A-1, 17/08/2026.
 *
 * ═══ A LACUNA ═══
 *
 * `membros_atipicos.genero` era o ÚNICO dos cinco dados essenciais que o
 * sistema tinha e não entregava. A coluna já vinha no `select` e já era usada
 * por `resolverFoco` — é ela que faz "minha filha" apontar para a criança
 * certa —, mas nenhuma linha do bloco de contexto a mencionava.
 *
 * Consequência: quando a Ayla escrevia "ele" ou "ela", estava adivinhando.
 * Normalmente pelo nome, que é o mesmo palpite removido das proativas no
 * mesmo dia (`endsWith("a") ? "a" : "o"` — todo Nicolas virava menina).
 *
 * ═══ A REGRA ═══
 *
 * Gênero REGISTRADO chega. Ausente, neutro ou estranho NÃO vira palpite, e
 * também não vira lacuna: não se pergunta o gênero de uma criança só para
 * escrever bonito. Quem responde "isto é dado ou não?" é `pronomesPara`, a
 * fonte única do projeto, pelo campo `generoDefinido`.
 */

const MEMBRO = {
  nome: "Manuela",
  data_nascimento: "2020-01-10",
  diagnosticos_formais: null,
};

/**
 * ⚠️ `como_e` é TOP-LEVEL, não vai dentro de `categorias_extras` — foi assim
 * que este teste pegou a própria fixture errada na primeira execução.
 */
const PERFIL = {
  como_e: { interesses: ["dinossauros", "princesas"] },
  categorias_extras: {
    sono: { texto: "Demora a pegar no sono nas noites de escola", atualizado_em: "2026-08-10" },
    comunicacao: { texto: "Fala por palavras soltas", atualizado_em: "2026-08-09" },
  },
};

const montar = (genero?: string | null) =>
  montarContextoBase({
    nomeResponsavel: "Karina",
    membro: { ...MEMBRO, genero },
    perfilVivo: PERFIL as never,
  });

describe("gênero registrado chega ao contexto", () => {
  it("1. feminino vira concordância utilizável", () => {
    const { bloco } = montar("feminino");
    expect(bloco).toContain("ela/dela");
  });

  it("2. masculino idem", () => {
    const { bloco } = montar("masculino");
    expect(bloco).toContain("ele/dele");
  });
});

describe("ausência NÃO vira palpite", () => {
  for (const g of [null, undefined, "", "neutro", "nao_informado", "outro"]) {
    it(`3. ${JSON.stringify(g)} não produz ele/dele nem ela/dela`, () => {
      const { bloco } = montar(g);
      expect(bloco, "inferiu gênero a partir de dado ausente/ambíguo").not.toMatch(
        /\bele\/dele\b|\bela\/dela\b/,
      );
    });
  }

  it("4. MORDE: o nome NÃO decide o gênero", () => {
    // "Manuela" termina em "a" — o palpite antigo diria feminino.
    const { bloco } = montar(null);
    expect(bloco).toContain("Manuela");
    expect(bloco).not.toContain("ela/dela");
  });

  it("5. gênero ausente NÃO entra como lacuna — não se pergunta por isso", () => {
    const { lacunas } = montar(null);
    expect(lacunas.join(" ").toLowerCase()).not.toContain("gênero");
    expect(lacunas.join(" ").toLowerCase()).not.toContain("genero");
  });
});

describe("nada do contexto se perde", () => {
  /** Tudo que o bloco entregava ANTES desta mudança. */
  const ESSENCIAIS = [
    "Responsável: Karina",
    "Criança: Manuela, 6 anos",
    "dinossauros",
    "sono:",
    "comunicação",
  ];

  it("6. com gênero, o bloco continua trazendo todo o resto", () => {
    const { bloco } = montar("feminino");
    for (const t of ESSENCIAIS) {
      expect(bloco, `sumiu do contexto: ${t}`).toContain(t);
    }
  });

  it("7. sem gênero, idem — a linha some, o resto fica", () => {
    const { bloco } = montar(null);
    for (const t of ESSENCIAIS) {
      expect(bloco, `sumiu do contexto: ${t}`).toContain(t);
    }
  });

  it("8. a única diferença entre os dois casos é a linha do gênero", () => {
    const com = montar("feminino").bloco.split("\n");
    const sem = montar(null).bloco.split("\n");
    const extras = com.filter((l) => !sem.includes(l));
    expect(extras.length, `mudou mais de uma linha: ${JSON.stringify(extras)}`).toBe(1);
    expect(extras[0]).toContain("ela/dela");
  });

  it("9. sem perfil vivo nenhum, continua funcionando", () => {
    const { bloco } = montarContextoBase({
      nomeResponsavel: null,
      membro: { ...MEMBRO, genero: "masculino" },
      perfilVivo: null,
    });
    expect(bloco).toContain("Criança: Manuela");
    expect(bloco).toContain("ele/dele");
  });
});
