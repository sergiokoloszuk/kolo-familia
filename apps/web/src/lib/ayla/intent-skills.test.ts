import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseSkills, separarCampos } from "./intent";

/**
 * O QUARTO CAMPO — e as três coisas que ele não pode quebrar (06/08/2026).
 *
 * `classificarIntencao` decide intenção, tema e aceite de TODA mensagem de
 * família real, hoje, em produção. O parser é `split("|")` sobre texto solto.
 * Acrescentar um campo é fácil; o que não é trivial é garantir que uma saída
 * estranha no campo NOVO não desloque os três antigos.
 *
 * Por isso o campo é o ÚLTIMO e a regra é uma só: qualquer coisa que não seja
 * um nome do catálogo vira `[]`. E `[]` é exatamente o produto de ontem — sem
 * repertório recuperado. O pior caso do campo novo é o comportamento anterior
 * a ele existir.
 */

const CATALOGO = [
  "emocional", "rotina", "sensorial", "comunicacao", "sono", "meu_bem_estar",
  "aprendizado", "foco", "nutricional", "socializacao", "autonomia", "motor", "imitacao",
];

describe("parseSkills — as 13 formas de a saída vir errada", () => {
  it("1. saída normal, uma skill", () => {
    expect(parseSkills("aprendizado", CATALOGO)).toEqual(["aprendizado"]);
  });

  it("2. duas skills — a primeira é a principal", () => {
    expect(parseSkills("motor,aprendizado", CATALOGO)).toEqual(["motor", "aprendizado"]);
    expect(parseSkills("motor, aprendizado", CATALOGO)).toEqual(["motor", "aprendizado"]);
  });

  it("3. quarto campo vazio", () => {
    for (const v of ["", "   ", "-", "\n"]) {
      expect(parseSkills(v, CATALOGO), JSON.stringify(v)).toEqual([]);
    }
  });

  it("4. quarto campo ausente", () => {
    // É o que chega quando o modelo esquece o campo: `split` devolve undefined.
    expect(parseSkills(undefined, CATALOGO)).toEqual([]);
  });

  it("5. skill inexistente é descartada", () => {
    expect(parseSkills("comportamento", CATALOGO)).toEqual([]);
    expect(parseSkills("aprendizagem", CATALOGO)).toEqual([]); // quase certa
    expect(parseSkills("foco_escolar", CATALOGO)).toEqual([]);
  });

  it("6. skill duplicada conta uma vez", () => {
    expect(parseSkills("foco,foco", CATALOGO)).toEqual(["foco"]);
    expect(parseSkills("foco, foco, aprendizado", CATALOGO)).toEqual(["foco", "aprendizado"]);
  });

  it("7. três skills → só as duas primeiras", () => {
    // Três é sinal de que o modelo listou tudo que encostou no assunto, e aí o
    // repertório deixa de ser sobre o problema da família.
    expect(parseSkills("foco,aprendizado,motor", CATALOGO)).toEqual(["foco", "aprendizado"]);
  });

  it("8. texto extra depois da skill", () => {
    expect(parseSkills("foco (principal)", CATALOGO)).toEqual([]);
    expect(parseSkills("foco, aprendizado — porque ele levanta", CATALOGO)).toEqual([
      "foco",
    ]);
    expect(parseSkills("skills: foco", CATALOGO)).toEqual([]);
  });

  it("9. delimitador inesperado", () => {
    expect(parseSkills("foco/aprendizado", CATALOGO)).toEqual(["foco", "aprendizado"]);
    expect(parseSkills("foco e aprendizado", CATALOGO)).toEqual(["foco", "aprendizado"]);
    expect(parseSkills("foco;aprendizado", CATALOGO)).toEqual(["foco", "aprendizado"]);
  });

  it("10. saída truncada no meio do nome", () => {
    expect(parseSkills("aprendiza", CATALOGO)).toEqual([]);
    expect(parseSkills("foco,apren", CATALOGO)).toEqual(["foco"]);
  });

  it("11-13. catálogo vazio nunca libera nada", () => {
    // Em runtime, catálogo vazio = nenhuma skill ativa carregada. Devolver
    // qualquer nome aqui seria rotear pra uma skill desligada.
    expect(parseSkills("foco", [])).toEqual([]);
    expect(parseSkills("foco,aprendizado", [])).toEqual([]);
  });

  it("skill DESLIGADA não passa, mesmo que o modelo a nomeie", () => {
    // Runtime real: só as 6 ativas entram no catálogo.
    const ativas = ["emocional", "rotina", "sensorial", "comunicacao", "sono", "meu_bem_estar"];
    expect(parseSkills("aprendizado", ativas)).toEqual([]);
    expect(parseSkills("foco,sensorial", ativas)).toEqual(["sensorial"]);
  });

  it("nunca lança, com qualquer entrada", () => {
    for (const v of ["|||", ",,,", "...", "🙂", "a".repeat(500), "-\n-", "NULL"]) {
      expect(() => parseSkills(v, CATALOGO), JSON.stringify(v.slice(0, 12))).not.toThrow();
    }
  });
});

// ============================================================
// A SKILL DESLOCADA — o erro que o Haiku comete de verdade
// ============================================================

describe("separarCampos — saídas REAIS medidas em 06/08/2026", () => {
  it("⭐ três campos com a skill no lugar do aceite: o aceite NÃO pode virar 'motor'", () => {
    // Saída real: «outro|aprendizado|motor». Sem o conserto, o orquestrador
    // leria aceite="motor" e resolveria o referente de um "sim" para uma
    // palavra que a mãe nunca disse.
    const r = separarCampos("outro|aprendizado|motor", CATALOGO);
    expect(r.aceite).toBe("");
    expect(r.skills).toEqual(["motor"]);
    expect(r.intencao).toBe("outro");
    expect(r.tema).toBe("aprendizado");
  });

  it("três campos sem skill válida: aceite permanece intocado", () => {
    // «outro|imitacao|--» — "--" não é skill, então continua sendo o aceite
    // (e o filtro de comprimento lá na frente o descarta, como sempre fez).
    const r = separarCampos("outro|imitacao|--", CATALOGO);
    expect(r.aceite).toBe("--");
    expect(r.skills).toEqual([]);
  });

  it("aceite de VERDADE nunca é confundido com skill", () => {
    // Um aceite real é uma frase; some as letras e não vira nome de catálogo.
    const r = separarCampos(
      "outro|comunicacao|montar uma história social sobre chegar num grupo",
      CATALOGO,
    );
    expect(r.aceite).toBe("montar uma história social sobre chegar num grupo");
    expect(r.skills).toEqual([]);
  });

  it("com os QUATRO campos, nada é remanejado", () => {
    const r = separarCampos("plano|autonomia|—|autonomia", CATALOGO);
    expect(r.intencao).toBe("plano");
    expect(r.tema).toBe("autonomia");
    expect(r.aceite).toBe("—");
    expect(r.skills).toEqual(["autonomia"]);
  });

  it("quatro campos com aceite legítimo E skill", () => {
    const r = separarCampos("plano|sono|montar a rotina da noite|sono", CATALOGO);
    expect(r.aceite).toBe("montar a rotina da noite");
    expect(r.skills).toEqual(["sono"]);
  });

  it("um campo só, ou vazio, não quebra", () => {
    expect(() => separarCampos("outro", CATALOGO)).not.toThrow();
    expect(separarCampos("outro", CATALOGO).skills).toEqual([]);
    expect(separarCampos("", CATALOGO).skills).toEqual([]);
  });

  it("a correção só age quando FALTA campo — com 4, o aceite é soberano", () => {
    // Mesmo que o aceite seja literalmente um nome de skill, com 4 campos ele
    // é o que o modelo quis dizer, e não se mexe.
    const r = separarCampos("outro|foco|foco|aprendizado", CATALOGO);
    expect(r.aceite).toBe("foco");
    expect(r.skills).toEqual(["aprendizado"]);
  });
});

// ============================================================
// NÃO-REGRESSÃO — os três campos que já existiam
// ============================================================

const SRC = readFileSync(resolve(__dirname, "intent.ts"), "utf8");

describe("intenção, tema e aceite não podem regredir", () => {
  it("o campo novo é o ÚLTIMO — a posição dos três não muda", () => {
    // `separarCampos` lê índice 0,1,2 pros três antigos e 3 pro novo. A única
    // exceção é a recuperação da skill deslocada, testada acima.
    expect(SRC).toMatch(/const intencao = p\[0\] \?\? raw;/);
    expect(SRC).toMatch(/const tema = p\[1\] \?\? "";/);
    expect(SRC).toMatch(/let aceite = p\[2\] \?\? "";/);
    expect(SRC).toMatch(/let skills = parseSkills\(p\[3\], permitidas\);/);
  });

  it("a leitura dos três continua idêntica", () => {
    // aceite lê `ladoAceite` (índice 2), não o último elemento — se lesse o
    // último, o campo novo teria roubado o aceite.
    expect(SRC).toMatch(/const bruto = \(ladoAceite \?\? ""\)\.trim\(\);/);
    expect(SRC).toMatch(/const candidata = \(ladoTema \?\? ""\)\.trim\(\)/);
    expect(SRC).toMatch(/const i = ladoIntencao \?\? raw;/);
  });

  it("os dois retornos de fallback devolvem skills vazias", () => {
    // Sem texto e em exceção: o campo novo não pode ficar undefined e quebrar
    // quem consumir `.skills`.
    const retornos = SRC.match(/return \{ intencao: "outro", tema: anterior, aceite: null[^}]*\}/g) ?? [];
    expect(retornos.length).toBe(2);
    for (const r of retornos) expect(r).toContain("skills: []");
  });

  it("sem catálogo o prompt NÃO ganha o campo — comportamento de antes", () => {
    expect(SRC).toMatch(/const comSkills = catalogo\.length > 0;/);
    expect(SRC).toMatch(/comSkills \? "intencao\|tema\|aceite\|skills" : "intencao\|tema\|aceite"/);
  });
});

describe("o classificador recebe só nome e keywords", () => {
  it("nunca a Camada 1 — objective, tone, scope e limits ficam de fora", () => {
    const bloco = SRC.slice(
      SRC.indexOf("function blocoSkills"),
      SRC.indexOf("function montarSystem"),
    );
    expect(bloco.length).toBeGreaterThan(200); // a fatia existe mesmo
    expect(bloco).toMatch(/s\.name/);
    expect(bloco).toMatch(/routing_keywords/);
    for (const campo of ["objective", "tone", "scope", "limits"]) {
      expect(bloco, campo).not.toMatch(new RegExp(`s\\.${campo}`));
    }
  });

  it("o catálogo do runtime só carrega ativo=true", () => {
    // Vive em `catalogo-skills.ts`, e não em `intent.ts`, porque o classificador
    // é livre de banco por contrato (`entrega.test.ts` trava isso desde 02/08).
    const CAT = readFileSync(resolve(__dirname, "catalogo-skills.ts"), "utf8");
    expect(CAT).toMatch(/\.select\("name, routing_keywords"\)/);
    expect(CAT).toMatch(/\.eq\("ativo", true\)/);
    // E a separação tem que continuar valendo: nada de `from(` no classificador.
    expect(SRC).not.toMatch(/\.from\(/);
  });

  it("as keywords são apresentadas como EXEMPLO, não como regex", () => {
    expect(SRC).toMatch(/EXEMPLOS do que as famílias dizem, não uma lista pra casar palavra/);
  });
});
