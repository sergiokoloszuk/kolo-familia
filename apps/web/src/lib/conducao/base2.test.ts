import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BASE2 } from "./base2-conteudo";
import { blocoBase2, secaoPorId, secoesDe, TEMAS_BASE2, temMaterial } from "./base2";

const RAIZ = resolve(__dirname, "../../../../..");
const MD = (t: string) => readFileSync(resolve(RAIZ, "docs/skills", `${t}.md`), "utf8");

describe("o módulo gerado não pode ficar defasado", () => {
  it("1. MORDE: regerar produz exatamente o arquivo em disco", () => {
    // Se alguém editar um .md e esquecer de rodar o gerador, a Ayla passaria a
    // conduzir por um material que não é mais o aprovado. Este teste é a única
    // coisa que impede isso.
    const antes = readFileSync(resolve(RAIZ, "apps/web/src/lib/conducao/base2-conteudo.ts"), "utf8");
    execFileSync("node", [resolve(RAIZ, "scripts/gerar-base2.mjs")], { cwd: RAIZ });
    const depois = readFileSync(resolve(RAIZ, "apps/web/src/lib/conducao/base2-conteudo.ts"), "utf8");
    expect(depois, "rode `node scripts/gerar-base2.mjs` e commite o resultado").toBe(antes);
  }, 30000);

  it("2. o conteúdo é VERBATIM — sai igual ao .md", () => {
    const s = secaoPorId("aprendizado/leitura-mapa-de-raciocinio")!;
    expect(MD("aprendizado")).toContain(s.conteudo);
  });
});

describe("cobertura da BASE 2", () => {
  it("3. os doze temas foram parseados, inclusive o de formato diferente", () => {
    expect(TEMAS_BASE2).toEqual([
      "aprendizado",
      "autonomia",
      "comunicacao",
      "emocional",
      "foco",
      "imitacao",
      "motor",
      "nutricional",
      "rotina",
      "sensorial",
      "socializacao",
      "sono",
    ]);
    // `nutricional.md` não usa `#` nos títulos; sem suporte a caixa alta ele
    // saía com zero seções.
    expect(BASE2.filter((s) => s.tema === "nutricional").length).toBeGreaterThan(10);
  });

  it("4. os cinco temas que faltavam agora têm material — e ele é recuperável", () => {
    // Este teste dizia o contrário até 09/08/2026: os cinco eram lacuna
    // declarada. O PR #77 os escreveu, e a asserção inverteu junto. O que ele
    // guarda agora é que o material EXISTE e é recortável por estado — não
    // basta o arquivo estar no disco.
    for (const tema of ["sono", "emocional", "sensorial", "comunicacao", "rotina"]) {
      expect(temMaterial(tema), `${tema} deveria ter material`).toBe(true);
      const inv = secoesDe({ tema, estado: "investigacao" });
      expect(inv.length, `${tema} sem seção de investigação`).toBeGreaterThan(0);
      expect(inv.every((s) => s.conteudo.trim().length > 0)).toBe(true);
    }
  });
});

describe("GOLDEN CASE · leitura", () => {
  it("5. 'dificuldade para ler' chega ao MAPA DE RACIOCÍNIO de leitura", () => {
    const r = secoesDe({ tema: "aprendizado", subtema: "leitura", estado: "investigacao" });
    expect(r[0].id).toBe("aprendizado/leitura-mapa-de-raciocinio");
  });

  it("6. e o mapa traz as diferenciações reais do material", () => {
    const s = secaoPorId("aprendizado/leitura-mapa-de-raciocinio")!;
    for (const dim of [
      /reconhece letras/i,
      /conhece sons/i,
      /junta s[ií]labas/i,
      /decodifica mas n[ãa]o compreende/i,
      /compreende quando algu[ée]m l[êe] para ele/i,
      /textos longos/i,
      /atenç[ãa]o do que em decodifica/i,
    ]) {
      expect(s.conteudo, `falta a dimensão ${dim}`).toMatch(dim);
    }
  });

  it("7. 'junta as sílabas mas se perde' encontra a conduta, não o ensino de letras", () => {
    const s = secaoPorId("aprendizado/leitura-mapa-de-raciocinio")!;
    expect(s.conteudo).toMatch(/junta as s[ií]labas, mas se perde/i);
    expect(s.conteudo).toMatch(/vamos ensinar as letras/i);
    expect(s.conteudo).toMatch(/revelar uma s[ií]laba por vez/i);
  });

  it("8. MORDE: o mapa de MATEMÁTICA não invade uma conversa de leitura", () => {
    const r = secoesDe({ tema: "aprendizado", subtema: "leitura", estado: "investigacao" });
    expect(r.map((s) => s.id)).not.toContain("aprendizado/matematica-mapa-de-raciocinio");
    expect(r.map((s) => s.id)).not.toContain("aprendizado/escrita-mapa-de-raciocinio");
  });

  it("9. MORDE: trocar o tema muda tudo", () => {
    const r = secoesDe({ tema: "foco", subtema: "leitura", estado: "investigacao" });
    expect(r.every((s) => s.tema === "foco")).toBe(true);
    expect(r.map((s) => s.id)).not.toContain("aprendizado/leitura-mapa-de-raciocinio");
  });
});

describe("seletividade — não mandar o arquivo inteiro", () => {
  it("10. o pedido devolve poucas seções, não o tema todo", () => {
    const doTema = BASE2.filter((s) => s.tema === "aprendizado").length;
    const r = secoesDe({ tema: "aprendizado", subtema: "leitura", estado: "investigacao" });
    expect(r.length).toBeLessThanOrEqual(3);
    expect(r.length).toBeLessThan(doTema / 5);
  });

  it("11. MORDE: o bloco é uma fração do arquivo", () => {
    const inteiro = MD("aprendizado").length;
    const bloco = blocoBase2(secoesDe({ tema: "aprendizado", subtema: "leitura", estado: "investigacao" }));
    expect(bloco.length).toBeLessThan(inteiro * 0.25);
    expect(bloco.length).toBeGreaterThan(200);
  });

  it("12. o limite é respeitado", () => {
    expect(secoesDe({ tema: "foco", estado: "investigacao", limite: 1 })).toHaveLength(1);
    expect(secoesDe({ tema: "foco", estado: "investigacao", limite: 5 }).length).toBeLessThanOrEqual(5);
  });
});

describe("estado da conversa seleciona coisas diferentes", () => {
  it("13. investigação traz diferenciação; intervenção traz condução", () => {
    const inv = secoesDe({ tema: "foco", estado: "investigacao", limite: 5 });
    const int = secoesDe({ tema: "foco", estado: "intervencao", limite: 5 });
    expect(inv.every((s) => s.estado !== "intervencao")).toBe(true);
    expect(int.every((s) => s.estado !== "investigacao")).toBe(true);
    expect(inv.map((s) => s.id)).not.toEqual(int.map((s) => s.id));
  });

  it("14. foco em investigação alcança a triagem que separa caminhos", () => {
    const ids = secoesDe({ tema: "foco", estado: "investigacao", limite: 6 }).map((s) => s.id);
    expect(ids.some((i) => /triagem|principio-central|regra-de-conducao/.test(i))).toBe(true);
  });

  it("15. intervenção de aprendizado alcança atividades e frases", () => {
    const ids = secoesDe({ tema: "aprendizado", estado: "intervencao", limite: 8 }).map((s) => s.id);
    expect(ids).toContain("aprendizado/atividades");
    expect(ids.some((i) => /frases-para-o-cuidador/.test(i))).toBe(true);
  });
});

describe("rastreabilidade — dá pra provar de onde veio", () => {
  it("16. toda seção carrega tema, seção, título e id estável", () => {
    for (const s of BASE2) {
      expect(s.id).toMatch(/^[a-z_]+\/[a-z0-9-]+$/);
      expect(s.tema.length).toBeGreaterThan(0);
      expect(s.titulo.length).toBeGreaterThan(0);
      expect(s.conteudo.trim().length).toBeGreaterThan(0);
    }
  });

  it("17. MORDE: ids não se repetem — senão o rastro aponta pra dois lugares", () => {
    const ids = BASE2.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("18. a CAMADA 1 não entra — ela já vive no banco", () => {
    expect(BASE2.some((s) => /camada 1/i.test(s.titulo))).toBe(false);
    expect(BASE2.some((s) => s.conteudo.includes("routing_priority"))).toBe(false);
  });
});

describe("o bloco do prompt", () => {
  it("19. vazio não vira bloco", () => {
    expect(blocoBase2([])).toBe("");
  });

  it("20. o bloco diz que é material de condução, não roteiro", () => {
    const b = blocoBase2(secoesDe({ tema: "aprendizado", subtema: "leitura", estado: "investigacao" }));
    expect(b).toContain("<conducao_kolo>");
    expect(b).toMatch(/não é roteiro/i);
    expect(b).toMatch(/uma ou duas coisas/i);
    expect(b).toContain("LEITURA — MAPA DE RACIOCÍNIO");
  });
});
