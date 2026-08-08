import { describe, expect, it } from "vitest";
import { progressoDaRotina, resumoDoProgresso } from "./rotina-progresso";

const p = (id: string, concluida = false) => ({ id, concluida });

describe("progressoDaRotina", () => {
  it("1. rotina válida recém-aberta: nada feito, o agora é a primeira", () => {
    const r = progressoDaRotina([p("a"), p("b"), p("c")]);
    expect(r).toEqual({ total: 3, feitas: 0, faltam: 3, agoraId: "a", completa: false });
  });

  it("2. etapa concluída sai da conta e o agora anda", () => {
    const r = progressoDaRotina([p("a", true), p("b"), p("c")]);
    expect(r.feitas).toBe(1);
    expect(r.faltam).toBe(2);
    expect(r.agoraId).toBe("b");
  });

  it("3. o agora é a PRIMEIRA pendente, não a seguinte à última marcada", () => {
    // A mãe marcou o 3º e esqueceu o 2º. A criança segue a sequência da rotina,
    // então o agora é o 2º — não o 4º.
    const r = progressoDaRotina([p("a", true), p("b"), p("c", true), p("d")]);
    expect(r.agoraId).toBe("b");
    expect(r.feitas).toBe(2);
  });

  it("4. todas concluídas: não há agora, e a rotina está completa", () => {
    const r = progressoDaRotina([p("a", true), p("b", true)]);
    expect(r.agoraId).toBeNull();
    expect(r.completa).toBe(true);
    expect(r.faltam).toBe(0);
  });

  it("5. rotina VAZIA não está completa — e não tem agora", () => {
    const r = progressoDaRotina([]);
    expect(r.completa).toBe(false);
    expect(r.agoraId).toBeNull();
    expect(r.total).toBe(0);
  });

  it("6. uma etapa só, pendente", () => {
    expect(progressoDaRotina([p("x")])).toEqual({
      total: 1,
      feitas: 0,
      faltam: 1,
      agoraId: "x",
      completa: false,
    });
  });

  it("7. não muta nem reordena o que recebeu", () => {
    const passos = [p("a", true), p("b")];
    const copia = JSON.parse(JSON.stringify(passos));
    progressoDaRotina(passos);
    expect(passos).toEqual(copia);
  });
});

describe("resumoDoProgresso", () => {
  it("8. situa sem ensinar: quantas e qual é o agora", () => {
    const r = progressoDaRotina([p("a", true), p("b"), p("c")]);
    expect(resumoDoProgresso(r, "Jantar")).toBe("1 de 3 · agora: Jantar");
  });

  it("9. terminou: celebra e não inventa um 'agora'", () => {
    const r = progressoDaRotina([p("a", true)]);
    const texto = resumoDoProgresso(r, null);
    expect(texto).toContain("Tudo feito");
    expect(texto).not.toContain("agora:");
  });

  it("10. rotina vazia não diz que terminou", () => {
    const texto = resumoDoProgresso(progressoDaRotina([]), null);
    expect(texto).not.toContain("Tudo feito");
    expect(texto).toBe("Nenhuma etapa ainda.");
  });

  it("11. sem texto do agora, ainda diz a contagem", () => {
    const r = progressoDaRotina([p("a"), p("b")]);
    expect(resumoDoProgresso(r, null)).toBe("0 de 2");
  });
});
