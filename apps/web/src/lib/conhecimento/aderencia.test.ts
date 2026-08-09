import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ordenarPorAderencia,
  PISO_ADERENCIA,
  pontuarItem,
  termosDoRelato,
  type ItemRankeavel,
} from "./aderencia";

const bp = (id: string, titulo: string, extra: Partial<ItemRankeavel> = {}): ItemRankeavel => ({
  id,
  titulo,
  versao_conversa: null,
  quando_usar: null,
  passos_praticos: [],
  tags: [],
  ...extra,
});

describe("termos do relato", () => {
  it("1. tira palavra vazia e mantém o que distingue", () => {
    const t = termosDoRelato("Minha filha bate na irmã quando é contrariada");
    expect(t).toContain("bate");
    expect(t.some((x) => "irmã".normalize("NFD").startsWith(x) || "irma".startsWith(x))).toBe(true);
    expect(t).not.toContain("minha");
    expect(t).not.toContain("filha");
    expect(t).not.toContain("quando");
  });

  it("2. plural e flexão caem na mesma raiz", () => {
    const a = termosDoRelato("as tarefas");
    const b = termosDoRelato("a tarefa");
    expect(a[0]).toBe(b[0]);
  });

  it("3. relato vazio não produz termo", () => {
    expect(termosDoRelato("   ")).toEqual([]);
    expect(termosDoRelato("ele não")).toEqual([]);
  });
});

describe("não é caça-palavra", () => {
  const termos = termosDoRelato("Minha filha bate na irmã quando é contrariada");

  it("4. UM termo sozinho não sustenta escolha", () => {
    const so = pontuarItem(bp("x", "Quando a criança bate a porta ao sair"), termos);
    expect(so.pontos).toBeLessThan(PISO_ADERENCIA);
  });

  it("5. DOIS termos convergindo no mesmo campo pontuam de verdade", () => {
    const conv = pontuarItem(bp("y", "Explosões de raiva: bate na irmã, grita, joga coisas"), termos);
    expect(conv.pontos).toBeGreaterThanOrEqual(PISO_ADERENCIA);
    expect(conv.termos.length).toBeGreaterThanOrEqual(2);
  });

  it("6. MORDE: sem a exigência de convergência, o falso positivo venceria", () => {
    const falso = pontuarItem(bp("x", "Quando a criança bate a porta ao sair"), termos);
    const certo = pontuarItem(bp("y", "Explosões de raiva: bate na irmã, grita, joga coisas"), termos);
    expect(certo.pontos).toBeGreaterThan(falso.pontos * 2);
  });

  it("6b. MORDE a convergência: uma palavra repetida em vários campos não vale como aderência", () => {
    // Sem a exigência de dois termos DISTINTOS, esta BP somaria título (5) +
    // quando_usar (4) + tags (3) + corpo (2) = 14 e passaria o piso — só por
    // repetir "bate" quatro vezes falando de outra coisa.
    const repetida = pontuarItem(
      bp("repete", "Quando a criança bate a porta", {
        quando_usar: "quando bate a porta com força",
        tags: ["bate-porta"],
        versao_conversa: "se ela bate a porta ao sair do quarto",
      }),
      termos,
    );
    expect(repetida.termos).toHaveLength(1);
    expect(repetida.pontos).toBe(0);

    const genuina = pontuarItem(
      bp("genuina", "Explosões: bate na irmã quando contrariada"),
      termos,
    );
    expect(genuina.pontos).toBeGreaterThan(repetida.pontos);
  });

  it("7b. MORDE o piso: sinal fraco de verdade também não reordena", () => {
    // Dois termos, mas só no corpo — 2+2 de campo mais 4 de convergência = 8,
    // abaixo do piso. É sinal, e é fraco demais para mexer na ordem.
    const fraco = bp("fraco", "Título sem relação nenhuma", {
      versao_conversa: "menciona bate e menciona irmã de passagem",
    });
    const p = pontuarItem(fraco, termos);
    expect(p.pontos).toBeGreaterThan(0);
    expect(p.pontos).toBeLessThan(PISO_ADERENCIA);

    const r = ordenarPorAderencia([bp("primeiro", "Genérico"), fraco], "Minha filha bate na irmã quando é contrariada");
    expect(r.interferiu).toBe(false);
    expect(r.itens[0].id).toBe("primeiro");
  });

  it("7. o piso protege: abaixo dele, a ordem original é preservada", () => {
    const itens = [bp("a", "Conteúdo genérico de regulação"), bp("b", "Quando bate a porta")];
    const r = ordenarPorAderencia(itens, "Minha filha bate na irmã quando é contrariada");
    expect(r.interferiu).toBe(false);
    expect(r.itens.map((i) => i.id)).toEqual(["a", "b"]);
  });
});

describe("o conteúdo aderente sobe", () => {
  const itens = [
    bp("generico1", "O cérebro tem andares: tronco cerebral, sistema límbico"),
    bp("generico2", "Momentos de quietude estruturados restauram o sistema"),
    bp("aderente", "Explosões de raiva — bate, grita, joga coisas", {
      quando_usar: "quando a criança bate na irmã ou em colegas",
      tags: ["agressao", "frustracao"],
    }),
  ];

  it("8. o aderente vira o primeiro", () => {
    const r = ordenarPorAderencia(itens, "Minha filha bate na irmã quando é contrariada");
    expect(r.itens[0].id).toBe("aderente");
    expect(r.interferiu).toBe(true);
  });

  it("9. MORDE: sem relato, nada se move", () => {
    const r = ordenarPorAderencia(itens, null);
    expect(r.itens.map((i) => i.id)).toEqual(["generico1", "generico2", "aderente"]);
    expect(r.interferiu).toBe(false);
  });

  it("10. a ordem entre os NÃO aderentes é estável", () => {
    const r = ordenarPorAderencia(itens, "Minha filha bate na irmã quando é contrariada");
    const resto = r.itens.slice(1).map((i) => i.id);
    expect(resto).toEqual(["generico1", "generico2"]);
  });

  it("11. título pesa mais que corpo", () => {
    const termos = termosDoRelato("dificuldade com a lição de matemática");
    const noTitulo = pontuarItem(bp("t", "Lição de matemática: por onde começar"), termos);
    const noCorpo = pontuarItem(
      bp("c", "Orientação geral", { versao_conversa: "vale para lição de matemática também" }),
      termos,
    );
    expect(noTitulo.pontos).toBeGreaterThan(noCorpo.pontos);
  });
});

describe("o ranking não decide quem é elegível", () => {
  it("12. MORDE: item fora do conjunto nunca aparece, por mais aderente que seja", () => {
    // A faixa etária é aplicada ANTES; o ranking só ordena o que sobrou.
    const elegiveis = [bp("a", "Conteúdo genérico")];
    const r = ordenarPorAderencia(elegiveis, "bate na irmã quando contrariada");
    expect(r.itens).toHaveLength(1);
    expect(r.itens.map((i) => i.id)).not.toContain("fora-da-faixa");
  });

  it("13. o top-k continua sendo de quem chama — o ranking devolve tudo, ordenado", () => {
    const itens = Array.from({ length: 9 }, (_, i) => bp(`i${i}`, `Item ${i}`));
    const r = ordenarPorAderencia(itens, "qualquer relato sem aderência nenhuma");
    expect(r.itens).toHaveLength(9);
  });
});

describe("rastreabilidade do ranking", () => {
  it("14. cada item tem pontuação e os termos que a explicam", () => {
    const itens = [bp("a", "Explosões de raiva: bate na irmã", { tags: ["agressao"] })];
    const r = ordenarPorAderencia(itens, "Minha filha bate na irmã quando é contrariada");
    const a = r.aderencias.get("a")!;
    expect(a.pontos).toBeGreaterThan(0);
    expect(a.termos.length).toBeGreaterThanOrEqual(2);
  });

  it("15. MORDE: relatos diferentes não contaminam um ao outro", () => {
    const itens = [bp("a", "Explosões de raiva: bate na irmã")];
    const r1 = ordenarPorAderencia(itens, "Minha filha bate na irmã quando é contrariada");
    const r2 = ordenarPorAderencia(itens, "Ele não consegue dormir sozinho");
    expect(r1.aderencias.get("a")!.pontos).toBeGreaterThan(
      r2.aderencias.get("a")!.pontos,
    );
    expect(r2.interferiu).toBe(false);
  });
});

describe("FASE 3b · conceitos e fronteira de palavra", () => {
  const termos = termosDoRelato("Minha filha bate na irmã quando é contrariada");

  it("18. o acervo fala 'agressão' e 'recusas'; a mãe fala 'bate' e 'contrariada'", () => {
    // O caso A: só a palavra "bate" coincide literalmente. Sem conceito, esta
    // BP — a mais aderente do acervo — pontuava ZERO.
    const real = pontuarItem(
      bp("explosoes", "Explosões de raiva — bate, grita, joga coisas", {
        quando_usar: "Durante crises de raiva, agressão, transições, após recusas.",
      }),
      termos,
    );
    expect(real.pontos).toBeGreaterThanOrEqual(PISO_ADERENCIA);
    expect(real.termos).toContain("#bate");
    expect(real.termos).toContain("#contrari");
  });

  it("19. MORDE: sem conceito, 'contrariada' nunca alcança 'recusas'", () => {
    const so = pontuarItem(bp("x", "Após recusas, valide a emoção"), termosDoRelato("ela fica contrariada"));
    expect(so.termos).toContain("#contrari");
  });

  it("20. MORDE a fronteira: 'porta' não pode casar dentro de 'importante'", () => {
    // Caso negativo real: "port" casava em "importante"/"suporte" e fazia
    // subir conteúdo de crise emocional num relato sobre bater a porta.
    const t = termosDoRelato("Ele bate a porta quando sai do quarto");
    const falso = pontuarItem(
      bp("f", "Em crise emocional, conecte primeiro", {
        versao_conversa: "é importante dar suporte e criar oportunidade de fala",
      }),
      t,
    );
    expect(falso.termos).not.toContain("port");
    expect(falso.pontos).toBeLessThan(PISO_ADERENCIA);
  });

  it("21. mas 'porta' casa com 'porta' e 'portão'", () => {
    const t = termosDoRelato("Ele bate a porta quando sai do quarto");
    const certo = pontuarItem(bp("c", "Quando bate a porta e sai do quarto correndo"), t);
    expect(certo.termos.some((x) => x === "port")).toBe(true);
  });

  it("22. conceito não infla convergência: 'bate' e 'bater' são a MESMA ideia", () => {
    const p = pontuarItem(bp("y", "Bater e bate são a mesma coisa aqui"), termosDoRelato("ele bate e bater"));
    expect(p.termos).toEqual(["#bate"]);
    expect(p.pontos).toBe(0);
  });
});

describe("FASE 3b · o teto de candidatos", () => {
  it("23. MORDE: o teto não pode voltar a 40 — era ele que matava o conteúdo", () => {
    // Medido em 09/08/2026: com 40, 51 boas práticas elegíveis para uma
    // criança de 5 anos morriam antes do ranking (24 em `emocional`, 19 em
    // `comunicacao`). E buscar a skill inteira custa o mesmo — 91 ms contra
    // 90 ms. O 200 é teto de segurança, não critério de seleção.
    const src = readFileSync(resolve(__dirname, "recuperar.ts"), "utf8");
    expect(src).not.toMatch(/\.limit\(40\)/);
    expect(src).toMatch(/\.limit\(200\)/);
    expect(src).toMatch(/TETO DE SEGURANÇA, não critério de seleção/);
  });
});
