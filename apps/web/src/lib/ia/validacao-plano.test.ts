import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  admiteFaltaDeContexto,
  temPlaceholder,
  escolherTitulo,
  validarPlano,
} from "./validacao-plano";
import type { PlanoSecao } from "./plano";

/**
 * O PORTÃO DO PLANO — a partir do PDF que a mãe da Adelly recebeu.
 *
 * "Aguardando a situação específica de Adelly.pdf", com sete seções boas
 * dentro. O conteúdo estava certo; o título, que vem de outra chamada, dizia
 * o contrário. Ela provavelmente nem abriu.
 */

const secao = (tipo: string, chars: number): PlanoSecao => ({
  tipo,
  titulo: tipo,
  conteudo_markdown: "Conteúdo real e específico sobre a criança. ".repeat(Math.ceil(chars / 43)).slice(0, chars),
});

/** Um plano que se sustenta: estrutura + 4 seções de conteúdo. */
const PLANO_BOM: PlanoSecao[] = [
  secao("entender", 1240),
  secao("crencas", 2108),
  secao("diferente", 1813),
  secao("brincadeiras", 1934),
  secao("atividades", 1963),
  secao("frases", 1398),
  secao("observar", 925),
];

describe("classe: texto que admite falta de contexto", () => {
  for (const t of [
    "Aguardando a situação específica de Adelly",
    "Tema a definir",
    "Plano a ser definido",
    "Ainda não sei do que se trata",
    "Sem informações suficientes",
    "Assim que você contar, eu monto",
    "Pendente de mais detalhes",
  ]) {
    it(`barra: "${t}"`, () => expect(admiteFaltaDeContexto(t)).toBe(true));
  }

  // O falso positivo que importa evitar: "específico" é palavra legítima.
  for (const t of [
    "Rotina específica da manhã",
    "Um momento específico do dia",
    "Transição da escola pra casa",
    "Sono e hora de dormir",
    "Brincar com outras crianças",
    "Agressividade quando tiram o objeto",
  ]) {
    it(`passa: "${t}"`, () => expect(admiteFaltaDeContexto(t)).toBe(false));
  }
});

describe("classe: placeholder", () => {
  it("pega marcadores de template", () => {
    expect(temPlaceholder("[inserir nome aqui]")).toBe(true);
    expect(temPlaceholder("TODO: escrever")).toBe(true);
    expect(temPlaceholder("Lorem ipsum dolor")).toBe(true);
    expect(temPlaceholder("{{nome}}")).toBe(true);
  });

  it("não confunde markdown normal", () => {
    expect(temPlaceholder("Diga: **agora é hora do banho** [1]")).toBe(false);
    expect(temPlaceholder("- item\n- outro item")).toBe(false);
  });
});

describe("título: um plano bom não morre por causa dele", () => {
  it("CASO ADELLY — título ruim + conteúdo bom → troca pelo tema validado", () => {
    const r = escolherTitulo({
      gerado: "Aguardando a situação específica de Adelly",
      temaValidado: "Agressividade em casa e tarefas",
    });
    expect(r.trocado).toBe(true);
    expect(r.titulo).toBe("Agressividade em casa e tarefas");
    expect(r.motivo).toContain("admitia falta de contexto");
  });

  it("título bom é mantido — não mexe no que está certo", () => {
    const r = escolherTitulo({ gerado: "Sono e hora de dormir", temaValidado: "outra coisa" });
    expect(r).toMatchObject({ titulo: "Sono e hora de dormir", trocado: false });
  });

  it("título legítimo com 'específico' passa", () => {
    const r = escolherTitulo({ gerado: "Rotina específica da manhã", temaValidado: "x" });
    expect(r.trocado).toBe(false);
  });

  it("sem título e sem tema → usa o nome, nunca fica vazio", () => {
    expect(escolherTitulo({ gerado: "", temaValidado: "", nome: "Adelly" }).titulo).toBe(
      "Plano — Adelly",
    );
  });

  it("tema também ruim → cai no nome, não propaga o problema", () => {
    const r = escolherTitulo({
      gerado: "Aguardando situação",
      temaValidado: "a definir",
      nome: "Theo",
    });
    expect(r.titulo).toBe("Plano — Theo");
  });

  it("tema muito longo é cortado, não vira título quilométrico", () => {
    const r = escolherTitulo({ gerado: "", temaValidado: "a".repeat(120) });
    expect(r.titulo.length).toBeLessThanOrEqual(70);
  });
});

describe("validarPlano", () => {
  it("plano bom + título bom → passa", () => {
    expect(validarPlano({ titulo: "Agressividade nas tarefas", secoes: PLANO_BOM }).ok).toBe(true);
  });

  it("CASO ADELLY completo: título já corrigido + as 7 seções reais → passa", () => {
    // O conteúdo sempre foi bom. Depois do conserto do título, publica.
    const { titulo } = escolherTitulo({
      gerado: "Aguardando a situação específica de Adelly",
      temaValidado: "Agressividade em casa e tarefas",
    });
    expect(validarPlano({ titulo, secoes: PLANO_BOM }).ok).toBe(true);
  });

  it("entender ausente → barra", () => {
    const r = validarPlano({
      titulo: "ok",
      secoes: PLANO_BOM.filter((s) => s.tipo !== "entender"),
    });
    expect(r.ok).toBe(false);
    expect(r.falhas.some((f) => f.codigo === "sem_estrutural")).toBe(true);
  });

  it("observar ausente → barra", () => {
    const r = validarPlano({
      titulo: "ok",
      secoes: PLANO_BOM.filter((s) => s.tipo !== "observar"),
    });
    expect(r.falhas.some((f) => f.codigo === "sem_estrutural")).toBe(true);
  });

  it("entender fraco (menos de 200 chars) → barra", () => {
    const r = validarPlano({
      titulo: "ok",
      secoes: [secao("entender", 120), ...PLANO_BOM.filter((s) => s.tipo !== "entender")],
    });
    expect(r.falhas.some((f) => f.codigo === "estrutural_fraca")).toBe(true);
  });

  it("seção de 50 caracteres → barra", () => {
    const r = validarPlano({ titulo: "ok", secoes: [...PLANO_BOM, secao("rotina", 50)] });
    expect(r.falhas.some((f) => f.codigo === "secao_vazia")).toBe(true);
  });

  it("só estrutura, sem conteúdo → barra", () => {
    const r = validarPlano({ titulo: "ok", secoes: [secao("entender", 900), secao("observar", 900)] });
    expect(r.falhas.some((f) => f.codigo === "sem_conteudo")).toBe(true);
  });

  it("placeholder numa seção → barra", () => {
    const suja: PlanoSecao = { tipo: "frases", titulo: "Frases", conteudo_markdown: `[preencher aqui] ${"x".repeat(300)}` };
    const r = validarPlano({ titulo: "ok", secoes: [...PLANO_BOM, suja] });
    expect(r.falhas.some((f) => f.codigo === "placeholder")).toBe(true);
  });

  it("título que ainda admite falta de contexto → barra", () => {
    const r = validarPlano({ titulo: "Aguardando a situação", secoes: PLANO_BOM });
    expect(r.falhas.some((f) => f.codigo === "admite_falta_contexto")).toBe(true);
  });

  it("seção curta que só diz 'me conta mais' → barra", () => {
    const s: PlanoSecao = {
      tipo: "atividades",
      titulo: "Atividades",
      conteudo_markdown: "Assim que você contar mais sobre o que acontece, eu trago atividades. " + "-".repeat(120),
    };
    const r = validarPlano({ titulo: "ok", secoes: [...PLANO_BOM, s] });
    expect(r.falhas.some((f) => f.codigo === "admite_falta_contexto")).toBe(true);
  });
});

describe("o portão está no caminho, antes de persistir", () => {
  const PLANO = readFileSync(resolve(__dirname, "plano.ts"), "utf8");

  it("valida ANTES do insert — nada é salvo sem passar", () => {
    const iPortao = PLANO.indexOf("PORTÃO: nada é persistido");
    const iInsert = PLANO.indexOf('.from("planos")');
    expect(iPortao).toBeGreaterThan(0);
    expect(iPortao).toBeLessThan(iInsert);
  });

  it("lança erro tipado — quem chama sabe que nada foi persistido", () => {
    expect(PLANO).toMatch(/throw new PlanoSemSubstanciaError\(veredito\.falhas\)/);
  });

  it("o título é escolhido antes de ir pro banco", () => {
    expect(PLANO).toMatch(/titulo: tituloFinal/);
    expect(PLANO).toMatch(/const escolha = escolherTitulo\(/);
  });

  it("a ponte passa o tema validado pela prontidão", () => {
    const PONTE = readFileSync(resolve(__dirname, "../ayla/ponte.ts"), "utf8");
    expect(PONTE).toMatch(/temaValidado: temaAuto/);
  });
});
