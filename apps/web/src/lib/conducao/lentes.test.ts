import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LENTES_PROFISSIONAIS, SKILLS_COM_LENTE, lenteDoTurno } from "./lentes";
import { nucleoConducao } from "./diretrizes";

/**
 * AS LENTES — contrato, taxonomia e custo.
 *
 * A prova de FIAÇÃO (a lente chega ao produtor depois de `processInbound`) está
 * em `ayla/conversa-e2e.test.ts`, de propósito: aqui eu provaria a função, e a
 * lição desta frente é que teste de função não prova que alguém a chama.
 */

describe("taxonomia: as chaves são skills que existem de verdade", () => {
  /**
   * ⚠️ ESTE É O TESTE QUE IMPEDE UMA LENTE MORTA. Uma chave que o roteamento
   * nunca devolve é código que parece implementado e nunca executa — foi
   * exatamente o risco de `dialogo_afetivo`, que a missão pedia e que NÃO
   * existe nesta taxonomia.
   *
   * A fonte da verdade é `docs/skills/*.md`, que é o que a Karina escreve.
   */
  it("toda lente corresponde a um documento em docs/skills", () => {
    const dir = path.resolve(__dirname, "../../../../../docs/skills");
    const doc = readdirSync(dir)
      .filter((f) => f.endsWith(".md") && !/^(README|COMO-ESCREVER)\.md$/.test(f))
      .map((f) => f.replace(/\.md$/, ""))
      .sort();
    // Guarda anti-teste-vazio: se o caminho quebrar, `doc` vem [] e o
    // `toEqual` abaixo passaria a cobrar uma lista vazia das lentes.
    expect(doc.length, "não encontrei docs/skills — o caminho quebrou").toBeGreaterThan(5);
    expect(SKILLS_COM_LENTE.slice().sort()).toEqual(doc);
  });

  it("dialogo_afetivo NÃO virou chave inventada", () => {
    expect(LENTES_PROFISSIONAIS.dialogo_afetivo).toBeUndefined();
    // O conteúdo dele foi para `emocional`, onde a equivalência é evidente.
    expect(LENTES_PROFISSIONAIS.emocional).toContain("RESPOSTA DO ADULTO");
    expect(LENTES_PROFISSIONAIS.emocional).toContain("SEM culpar quem cuida");
  });
});

describe("lenteDoTurno: o contrato", () => {
  it("sem skill não há lente — e isso é caminho normal, não erro", () => {
    expect(lenteDoTurno([])).toBe("");
    expect(lenteDoTurno(null)).toBe("");
    expect(lenteDoTurno(undefined)).toBe("");
  });

  it("skill desconhecida é ignorada em silêncio, sem emudecer o turno", () => {
    expect(lenteDoTurno(["skill_que_nao_existe"])).toBe("");
    // E não contamina: com uma boa junto, a boa entra.
    expect(lenteDoTurno(["skill_que_nao_existe", "sono"])).toContain("SONO.");
  });

  it("no máximo DUAS lentes, na ordem que o roteamento entregou", () => {
    const r = lenteDoTurno(["sensorial", "emocional", "sono", "foco"]);
    expect(r).toContain("SENSORIAL.");
    expect(r).toContain("EMOCIONAL E RELAÇÃO.");
    expect(r, "entrou uma terceira lente — o prompt cresce sem teto").not.toContain("SONO.");
    expect(r).not.toContain("FOCO E FUNÇÕES EXECUTIVAS.");
    // A ordem é a do roteamento, não alfabética nem por peso.
    expect(r.indexOf("SENSORIAL.")).toBeLessThan(r.indexOf("EMOCIONAL E RELAÇÃO."));
  });

  it("skill repetida não duplica o texto no turno", () => {
    const r = lenteDoTurno(["sensorial", "sensorial"]);
    expect(r.match(/SENSORIAL\./g)?.length).toBe(1);
  });

  it("o envelope reafirma o núcleo — a lente não revoga ajude-primeiro nem hipótese", () => {
    const r = lenteDoTurno(["sensorial"]);
    expect(r).toContain("<lente_profissional>");
    expect(r).toContain("raciocínio SILENCIOSO");
    expect(r).toContain("ajude primeiro");
    expect(r).toContain("hipótese nunca vira causa");
    expect(r).toContain("segurança vem antes de explicar");
  });
});

describe("custo: a lente é do TURNO, não do núcleo", () => {
  /**
   * ⚠️ A REGRA QUE ESTE TESTE PROTEGE. Doze lentes dentro de
   * `nucleoConducao()` seriam ~9.000 caracteres pagos em TODO turno, sendo que
   * onze de cada doze não seriam usados. Se um dia alguém "simplificar" movendo
   * as lentes para o núcleo, o teto de `entrega.test.ts` avisaria só quando já
   * estivesse caro — este avisa na hora.
   */
  it("nenhuma lente entra em nucleoConducao()", () => {
    const nucleo = nucleoConducao();
    for (const [nome, texto] of Object.entries(LENTES_PROFISSIONAIS)) {
      expect(nucleo, `a lente ${nome} vazou para o núcleo`).not.toContain(texto.slice(0, 60));
    }
    expect(nucleo).not.toContain("<lente_profissional>");
  });

  it("uma lente custa pouco, duas custam pouco — e o teto é consciente", () => {
    const base = nucleoConducao().length;
    const uma = Math.max(...SKILLS_COM_LENTE.map((s) => lenteDoTurno([s]).length));
    const duas = Math.max(
      ...SKILLS_COM_LENTE.flatMap((a) =>
        SKILLS_COM_LENTE.filter((b) => b !== a).map((b) => lenteDoTurno([a, b]).length),
      ),
    );
    // Medido em 12/08/2026: núcleo 62.048 · 1 lente entre 945 e 1.374 (média
    // 1.107) · 2 lentes no máximo 2.166 — pior caso total 64.214, +3,5% sobre
    // o que o turno já pagava. Os tetos abaixo são ~2× o pior caso de hoje:
    // dão espaço para reescrever uma lente sem soltar o freio, e barram a
    // lente que virou documento.
    expect(uma, `pior lente sozinha: ${uma}`).toBeLessThan(2_000);
    expect(duas, `pior par de lentes: ${duas}`).toBeLessThan(4_000);
    // E o conjunto continua sendo uma fração do que o turno já paga.
    expect(duas).toBeLessThan(base * 0.1);
  });

  it("toda lente tem as duas metades: o que OLHAR e o erro a NÃO cometer", () => {
    for (const [nome, texto] of Object.entries(LENTES_PROFISSIONAIS)) {
      expect(texto, `${nome} não diz o que olhar`).toContain("OLHE:");
      // Sem o "NÃO", a lente vira lista de tópicos — e lista de tópicos o
      // modelo já tem sozinho. O erro clássico do domínio é o valor dela.
      expect(texto, `${nome} não traz o erro clássico do domínio`).toMatch(/\bNÃO\b/);
      expect(texto.length, `${nome} virou documento (${texto.length})`).toBeLessThan(1_400);
    }
  });
});

describe("limites clínicos preservados dentro das lentes", () => {
  it("sono e alimentação não abrem porta pra prescrição", () => {
    expect(LENTES_PROFISSIONAIS.sono).toContain("melatonina");
    expect(LENTES_PROFISSIONAIS.sono).toMatch(/NÃO diagnostique/);
    expect(LENTES_PROFISSIONAIS.nutricional).toMatch(/NÃO prescreva dieta, suplemento/);
  });

  it("motor não gradua nem conclui alteração", () => {
    expect(LENTES_PROFISSIONAIS.motor).toMatch(/NÃO conclua alteração motora/);
  });

  it("a lente de rotina não dá autoridade sobre o artefato", () => {
    expect(LENTES_PROFISSIONAIS.rotina).toContain("A lente não dá autoridade nenhuma sobre artefato");
  });

  it("o arquivo é NEUTRO de canal — não importa de lib/ia nem de lib/ayla", () => {
    const src = readFileSync(path.join(__dirname, "lentes.ts"), "utf8");
    const imports = src.match(/^import .*$/gm) ?? [];
    expect(imports, "a lente ganhou dependência de canal e deixou de ser compartilhada").toEqual([]);
  });
});
