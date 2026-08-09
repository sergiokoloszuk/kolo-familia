import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { montarRastro, motivoDoVazio, registrarRastroConhecimento } from "./rastro";
import type { BoaPraticaRecuperada } from "./recuperar";

const bp = (id: string): BoaPraticaRecuperada => ({
  id,
  titulo: `BP ${id}`,
  versao_conversa: null,
  quando_usar: null,
  erros_comuns: [],
  passos_praticos: [],
});

const FAM = "fam-1";
const OUTRA = "fam-2";

describe("A · recuperação encontrou conteúdo", () => {
  it("1. os ids ficam rastreados, recuperados e enviados", () => {
    const r = montarRastro({
      canal: "whatsapp",
      familyId: FAM,
      membroId: "m1",
      skills: ["sono", "rotina"],
      idade: 6,
      recuperadas: [bp("a"), bp("b"), bp("c")],
      enviadas: [bp("a"), bp("b"), bp("c")],
    });
    expect(r.recuperados).toEqual(["a", "b", "c"]);
    expect(r.enviados).toEqual(["a", "b", "c"]);
    expect(r.motivoVazio).toBeUndefined();
    expect(r.skills).toEqual(["sono", "rotina"]);
  });

  it("2. registra IDs, nunca o texto da boa prática", () => {
    const r = montarRastro({
      canal: "web",
      familyId: FAM,
      membroId: null,
      skills: ["sono"],
      recuperadas: [bp("a")],
      enviadas: [bp("a")],
    });
    expect(JSON.stringify(r)).not.toContain("BP a");
  });
});

describe("B · recuperação vazia fica explícita, com o motivo", () => {
  it("3. sem skill nenhuma: nem se consultou", () => {
    const r = montarRastro({
      canal: "whatsapp",
      familyId: FAM,
      membroId: null,
      skills: [],
      recuperadas: [],
      enviadas: [],
    });
    expect(r.motivoVazio).toBe("sem_skill");
  });

  it("4. skill existe e o acervo não tinha nada — o caso `meu_bem_estar`", () => {
    const r = montarRastro({
      canal: "whatsapp",
      familyId: FAM,
      membroId: null,
      skills: ["meu_bem_estar"],
      recuperadas: [],
      enviadas: [],
    });
    expect(r.motivoVazio).toBe("acervo_vazio");
    expect(r.skills).toEqual(["meu_bem_estar"]);
  });

  it("5. consulta quebrada NÃO se confunde com acervo vazio", () => {
    const r = montarRastro({
      canal: "web",
      familyId: FAM,
      membroId: null,
      skills: ["sono"],
      recuperadas: [],
      enviadas: [],
      erroNaConsulta: true,
    });
    expect(r.motivoVazio).toBe("erro_na_consulta");
  });

  it("6. os três motivos são distintos entre si", () => {
    expect(motivoDoVazio({ skills: [], tags: 0 })).toBe("sem_skill");
    expect(motivoDoVazio({ skills: ["sono"], tags: 0 })).toBe("acervo_vazio");
    expect(motivoDoVazio({ skills: ["sono"], tags: 0, erroNaConsulta: true })).toBe("erro_na_consulta");
    expect(motivoDoVazio({ skills: [], tags: 3 })).toBe("acervo_vazio");
  });
});

describe("C · recuperado ≠ enviado ao modelo", () => {
  it("7. recuperar três e mandar zero é registrado como vazio", () => {
    const r = montarRastro({
      canal: "whatsapp",
      familyId: FAM,
      membroId: null,
      skills: ["sono"],
      recuperadas: [bp("a"), bp("b"), bp("c")],
      enviadas: [],
    });
    expect(r.recuperados).toHaveLength(3);
    expect(r.enviados).toHaveLength(0);
    // Para a família, conteúdo que não chegou ao modelo é conteúdo que não existiu.
    expect(r.motivoVazio).toBeDefined();
  });

  it("8. enviar um subconjunto preserva os dois estados", () => {
    const r = montarRastro({
      canal: "web",
      familyId: FAM,
      membroId: null,
      skills: ["sono"],
      recuperadas: [bp("a"), bp("b"), bp("c")],
      enviadas: [bp("a")],
    });
    expect(r.recuperados).toEqual(["a", "b", "c"]);
    expect(r.enviados).toEqual(["a"]);
    expect(r.motivoVazio).toBeUndefined();
  });

  it("9. USO EFETIVO não é afirmado em lugar nenhum do rastro", () => {
    const r = montarRastro({
      canal: "web",
      familyId: FAM,
      membroId: null,
      skills: ["sono"],
      recuperadas: [bp("a")],
      enviadas: [bp("a")],
    });
    expect(r).not.toHaveProperty("usados");
    expect(r).not.toHaveProperty("usado");
  });

  it("10. e o evento diz por extenso que uso não é observável", () => {
    const src = readFileSync(resolve(__dirname, "rastro.ts"), "utf8");
    expect(src).toMatch(/uso_efetivo: "nao_observavel"/);
  });
});

describe("D/E · os dois canais deixam rastro", () => {
  it("11. WhatsApp registra tags = 0, que é a assimetria medida", () => {
    const r = montarRastro({
      canal: "whatsapp",
      familyId: FAM,
      membroId: null,
      skills: ["sono"],
      recuperadas: [bp("a")],
      enviadas: [bp("a")],
    });
    expect(r.canal).toBe("whatsapp");
    expect(r.tags).toBe(0);
  });

  it("12. Web registra o canal e quantas tags entraram", () => {
    const r = montarRastro({
      canal: "web",
      familyId: FAM,
      membroId: null,
      skills: ["sono"],
      tags: 5,
      recuperadas: [bp("a")],
      enviadas: [bp("a")],
    });
    expect(r.canal).toBe("web");
    expect(r.tags).toBe(5);
  });

  it("13. os dois call sites instrumentados existem no código", () => {
    const wa = readFileSync(resolve(__dirname, "../ayla/orchestrator.ts"), "utf8");
    const web = readFileSync(resolve(__dirname, "../ia/context.ts"), "utf8");
    expect(wa).toMatch(/registrarRastroConhecimento/);
    expect(wa).toMatch(/canal: "whatsapp"/);
    expect(web).toMatch(/registrarRastroConhecimento/);
    expect(web).toMatch(/canal: "web"/);
  });
});

describe("F · famílias não se misturam", () => {
  it("14. cada rastro carrega a sua família e a sua criança", () => {
    const a = montarRastro({
      canal: "web", familyId: FAM, membroId: "m1", skills: ["sono"],
      recuperadas: [bp("x")], enviadas: [bp("x")],
    });
    const b = montarRastro({
      canal: "web", familyId: OUTRA, membroId: "m2", skills: ["sono"],
      recuperadas: [bp("y")], enviadas: [bp("y")],
    });
    expect(a.familyId).toBe(FAM);
    expect(b.familyId).toBe(OUTRA);
    expect(a.membroId).not.toBe(b.membroId);
    expect(a.recuperados).not.toEqual(b.recuperados);
  });
});

describe("G · o rastro não derruba a conversa", () => {
  it("15. registrar não lança, mesmo sem banco configurado", async () => {
    await expect(
      registrarRastroConhecimento({
        canal: "whatsapp", familyId: FAM, membroId: null,
        skills: ["sono"], tags: 0, idade: null,
        recuperados: ["a"], enviados: ["a"],
      }),
    ).resolves.toBeUndefined();
  });

  it("16. o aviso de falha da recuperação é protegido por catch próprio", () => {
    const src = readFileSync(resolve(__dirname, "recuperar.ts"), "utf8");
    expect(src).toMatch(/p\.aoFalhar\?\.\(motivo\)/);
    expect(src).toMatch(/um callback que lança levaria/i);
  });

  it("17. os call sites não esperam o rastro (void, não await)", () => {
    const wa = readFileSync(resolve(__dirname, "../ayla/orchestrator.ts"), "utf8");
    expect(wa).toMatch(/void registrarRastroConhecimento\(/);
  });
});

describe("o rastro persiste — senão some com a retenção do stdout", () => {
  it("18. usa `persistir`, e não inflaciona a severidade para warn", () => {
    const src = readFileSync(resolve(__dirname, "rastro.ts"), "utf8");
    expect(src).toMatch(/severity: "info"/);
    expect(src).toMatch(/persistir: true/);
    expect(src).not.toMatch(/severity: "warn"/);
  });

  it("19. o logger honra `persistir` mesmo abaixo do limiar", () => {
    const src = readFileSync(resolve(__dirname, "../log.ts"), "utf8");
    expect(src).toMatch(/if \(!evt\.persistir && !\(PERSIST_THRESHOLD/);
  });
});
