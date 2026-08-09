import { describe, expect, it } from "vitest";
import {
  CHAVE_OUTRA,
  ehEntradaVaga,
  interpretarEscolha,
  lerMenuDoTexto,
  montarMenuTemas,
  textoDoMenu,
} from "./entrada-guiada";

const chaves = (m: ReturnType<typeof montarMenuTemas>) => m.opcoes.map((o) => o.chave);

describe("CASO A · três desafios do onboarding vêm primeiro", () => {
  const menu = montarMenuTemas(["comunicacao", "foco", "socializacao"]);

  it("1. os três aparecem no topo, na ordem em que a família marcou", () => {
    expect(chaves(menu).slice(0, 3)).toEqual(["comunicacao", "foco", "socializacao"]);
    expect(menu.doOnboarding).toBe(3);
    expect(menu.opcoes.slice(0, 3).every((o) => o.doOnboarding)).toBe(true);
  });

  it("2. numeração é 1..n sem buraco", () => {
    expect(menu.opcoes.map((o) => o.n)).toEqual(menu.opcoes.map((_, i) => i + 1));
  });

  it("3. NENHUM tema se repete embaixo", () => {
    const todas = chaves(menu);
    expect(new Set(todas).size).toBe(todas.length);
    expect(todas.filter((c) => c === "comunicacao")).toHaveLength(1);
  });

  it("4. 'outra situação' é sempre a última", () => {
    expect(menu.opcoes.at(-1)?.chave).toBe(CHAVE_OUTRA);
  });

  it("5. o texto diz que veio do cadastro — e só quando veio", () => {
    const txt = textoDoMenu({ menu, nomeMae: "Gabriela", nomeCrianca: "João" });
    expect(txt).toContain("Gabriela");
    expect(txt).toContain("João");
    expect(txt).toMatch(/Quando você entrou, me contou/);
    expect(txt).toMatch(/Também posso ajudar com/);
    expect(txt).toMatch(/só com o número/);
    expect(txt).toMatch(/áudio/);
  });
});

describe("CASO B/C · onboarding incompleto — não inventar", () => {
  it("6. com um só desafio, mostra um — não completa três", () => {
    const m = montarMenuTemas(["sono"]);
    expect(m.doOnboarding).toBe(1);
    expect(m.opcoes[0].chave).toBe("sono");
    expect(m.opcoes.filter((o) => o.doOnboarding)).toHaveLength(1);
  });

  it("7. e 'sono' não reaparece na lista complementar", () => {
    const m = montarMenuTemas(["sono"]);
    expect(chaves(m).filter((c) => c === "sono")).toHaveLength(1);
  });

  it("8. SEM desafios: não finge memória", () => {
    const m = montarMenuTemas([]);
    expect(m.doOnboarding).toBe(0);
    const txt = textoDoMenu({ menu: m, nomeMae: "Ana" });
    expect(txt).not.toMatch(/me contou/);
    expect(txt).not.toMatch(/quando entrou/);
    expect(txt).toMatch(/Posso te ajudar com/);
  });

  it("9. chave desconhecida é descartada, não vira linha sem rótulo", () => {
    const m = montarMenuTemas(["tema_que_nao_existe", "sono"]);
    expect(m.doOnboarding).toBe(1);
    expect(m.opcoes[0].chave).toBe("sono");
    expect(chaves(m)).not.toContain("tema_que_nao_existe");
  });

  it("10. mais de três desafios: só três sobem", () => {
    const m = montarMenuTemas(["sono", "foco", "escola", "motor", "nutricional"]);
    expect(m.doOnboarding).toBe(3);
    expect(chaves(m).slice(0, 3)).toEqual(["sono", "foco", "escola"]);
  });
});

describe("CASO H · nome ausente não é inventado", () => {
  it("11. sem nome da mãe, a saudação funciona sem nome", () => {
    const txt = textoDoMenu({ menu: montarMenuTemas([]), nomeMae: null, nomeCrianca: null });
    expect(txt.startsWith("Oi! 💛")).toBe(true);
    expect(txt).not.toMatch(/undefined|null/);
  });

  it("12. sem nome da criança, não escreve 'com '", () => {
    const txt = textoDoMenu({ menu: montarMenuTemas([]), nomeMae: "Ana", nomeCrianca: "  " });
    expect(txt).toMatch(/Por onde você quer que eu te ajude\?/);
  });
});

describe("CASO D/E · número → tema, pelo menu que ela VIU", () => {
  const menu = montarMenuTemas(["comunicacao", "foco", "socializacao"]);
  const txt = textoDoMenu({ menu, nomeMae: "Ana", nomeCrianca: "João" });
  const lido = lerMenuDoTexto(txt);

  it("13. o menu é lido de volta do texto enviado, com a mesma numeração", () => {
    expect(lido).toHaveLength(menu.opcoes.length);
    expect(lido.map((o) => o.n)).toEqual(menu.opcoes.map((o) => o.n));
    expect(lido[1].chave).toBe("foco");
  });

  it("14. '2' escolhe o segundo do menu apresentado", () => {
    const e = interpretarEscolha("2", lido);
    expect(e?.chaves).toEqual(["foco"]);
    expect(e?.outra).toBe(false);
  });

  it("15. '1 e 3' reconhece as duas, sem confundir", () => {
    const e = interpretarEscolha("1 e 3", lido);
    expect(e?.chaves).toEqual(["comunicacao", "socializacao"]);
  });

  it("16. '1,3' e '1 3' fazem o mesmo", () => {
    expect(interpretarEscolha("1,3", lido)?.chaves).toEqual(["comunicacao", "socializacao"]);
    expect(interpretarEscolha("1 3", lido)?.chaves).toEqual(["comunicacao", "socializacao"]);
  });

  it("17. o número da última opção é 'outra situação', não um tema", () => {
    const ultimo = lido.at(-1)!;
    const e = interpretarEscolha(String(ultimo.n), lido);
    expect(e?.outra).toBe(true);
    expect(e?.chaves).toEqual([]);
  });

  it("18. número fora do menu não vira escolha", () => {
    expect(interpretarEscolha("99", lido)).toBeNull();
  });

  it("19. FRASE com número dentro NÃO é escolha — ela está conversando", () => {
    expect(interpretarEscolha("ele tem 2 anos", lido)).toBeNull();
    expect(interpretarEscolha("quero a 2 mas o problema é outro", lido)).toBeNull();
    expect(interpretarEscolha("2 vezes por dia ele acorda", lido)).toBeNull();
  });

  it("20. repetido não duplica", () => {
    expect(interpretarEscolha("2 2 2", lido)?.chaves).toEqual(["foco"]);
  });
});

describe("CASO I · duas famílias não se misturam", () => {
  it("21. menus diferentes produzem escolhas diferentes para o MESMO número", () => {
    const a = montarMenuTemas(["comunicacao", "foco", "socializacao"]);
    const b = montarMenuTemas(["sono", "nutricional"]);
    const lidoA = lerMenuDoTexto(textoDoMenu({ menu: a }));
    const lidoB = lerMenuDoTexto(textoDoMenu({ menu: b }));
    expect(interpretarEscolha("1", lidoA)?.chaves).toEqual(["comunicacao"]);
    expect(interpretarEscolha("1", lidoB)?.chaves).toEqual(["sono"]);
  });

  it("22. o menu de uma família não contém o desafio da outra", () => {
    const a = montarMenuTemas(["escola"]);
    expect(a.opcoes.filter((o) => o.doOnboarding).map((o) => o.chave)).toEqual(["escola"]);
    expect(a.opcoes.filter((o) => o.doOnboarding).map((o) => o.chave)).not.toContain("motor");
  });
});

describe("CASO F/G · situação concreta tem prioridade sobre o menu", () => {
  const VAGAS = ["Oi", "oi", "Olá", "oi!", "bom dia", "Oi, tudo bem?", "preciso de ajuda", "Oi, preciso de ajuda", "me ajuda", "  ", "oiii"];
  for (const t of VAGAS) {
    it(`23. vaga: ${JSON.stringify(t)}`, () => expect(ehEntradaVaga(t)).toBe(true));
  }

  const CONCRETAS = [
    "Meu filho não quer fazer lição.",
    "Ela está mordendo a irmã.",
    "Ele não consegue dormir sozinho.",
    "Vai fazer lição fora de casa e queria preparar o que vai acontecer.",
    "Quero ajudar na concentração",
    "ele morde",
    "não come nada",
    "Meu filho vai fazer lição no Leônidas. Mas ele nao esta acostumado a sair.",
  ];
  for (const t of CONCRETAS) {
    it(`24. concreta: ${JSON.stringify(t.slice(0, 40))}`, () =>
      expect(ehEntradaVaga(t)).toBe(false));
  }
});
