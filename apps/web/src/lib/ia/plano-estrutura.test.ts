import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PLANO_TIPOS } from "./plano";
import {
  recursosConcretos,
  blocoAntiRepeticao,
  PAPEL_DA_SECAO,
} from "./plano-recursos";

/**
 * O PLANO KOLO GANHA UM ARCO — e para de repetir a almofada.
 *
 * Dois números da auditoria de 07/08/2026, em 48 planos reais:
 *   · `diferente` — a estratégia central — faltava em 18% dos planos. Saíam
 *     cheios de atividades sem dizer o que mudar, e o guard "3 de 5 práticas"
 *     deixava passar.
 *   · 50% repetiam o mesmo objeto concreto em 2+ seções práticas: caixa (12),
 *     almofada (9), tampinha (8), pote (6).
 *
 * A causa da repetição não era preguiça do modelo: cada seção é uma chamada
 * independente que não vê as outras. Duas chegavam sozinhas no mesmo pote de
 * tampinhas.
 */

const PLANO = readFileSync(resolve(__dirname, "plano.ts"), "utf8");
const MIGRACAO = readFileSync(
  resolve(__dirname, "../../../../../supabase/migrations/0076_plano_versionamento.sql"),
  "utf8",
);

describe("a estratégia central manda no plano", () => {
  it("saiu do lote e é gerada sozinha, primeiro", () => {
    expect(PLANO).toMatch(/const SECAO_ESTRATEGIA = "diferente";/);
    expect(PLANO).toMatch(/const estrategia = await gerarSecao\(\s*\n?\s*SECAO_ESTRATEGIA/);
  });

  it("não está mais no lote das outras", () => {
    expect(PLANO).toMatch(/const SECOES_SEMPRE = \["crencas", "brincadeiras", "atividades", "frases"\]/);
  });

  it("a estratégia é gerada ANTES das demais", () => {
    expect(PLANO.indexOf("const estrategia = await gerarSecao(")).toBeLessThan(
      PLANO.indexOf("const [secoesOutput, framing] = await Promise.all(["),
    );
  });

  it("e ANTES do arco, que precisa dela pra existir", () => {
    expect(PLANO.indexOf("const estrategia = await gerarSecao(")).toBeLessThan(
      PLANO.indexOf("await gerarArcoDoPlano("),
    );
    expect(PLANO).toMatch(/if \(estrategiaTexto\) \{/);
  });
});

describe("o arco: uma chamada, seis papéis", () => {
  it("os seis tipos existem no catálogo", () => {
    for (const t of ["objetivo", "progressao", "evitar", "incentivar", "avaliar", "ajustar"])
      expect(PLANO_TIPOS as readonly string[]).toContain(t);
  });

  it("é UMA função, não seis", () => {
    expect(PLANO).toMatch(/async function gerarArcoDoPlano\(/);
    const chamadas = PLANO.match(/await gerarArcoDoPlano\(/g) ?? [];
    expect(chamadas).toHaveLength(1);
  });

  it("recebe o plano já escrito — é a única que enxerga tudo", () => {
    expect(PLANO).toMatch(/secoesProntas: \[\.\.\.porTipo\.values\(\)\]/);
    expect(PLANO).toMatch(/<plano_ja_escrito>/);
  });

  it("o degrau da progressão é o mesmo que a avaliação mede", () => {
    // É a razão de nascerem juntos. Separados, sairiam seis listas que não se
    // encaixam.
    expect(PLANO).toMatch(/o degrau que a progressão propõe é o mesmo que a avaliação mede/);
    expect(PLANO).toMatch(/o que se evita é o oposto do que se incentiva/);
  });

  it("avaliação em sinais observáveis, nunca 'melhorou/não melhorou'", () => {
    expect(PLANO).toMatch(/NUNCA "melhorou\/não melhorou"/);
    expect(PLANO).toMatch(/precisa de menos ajuda, começa mais rápido/);
  });

  it("o objetivo é funcional e observável", () => {
    expect(PLANO).toMatch(/FUNCIONAL e OBSERVÁVEL/);
    expect(PLANO).toMatch(/nunca abstrato \("melhorar o foco"\)/);
  });

  it("o primeiro degrau cabe nesta semana", () => {
    expect(PLANO).toMatch(/pequeno o bastante pra acontecer esta semana/);
  });

  it("ajustar cobre os quatro desfechos", () => {
    expect(PLANO).toMatch(/quando funcionou, quando funcionou em parte, quando não funcionou e quando ficou fácil demais/);
  });

  it("fecha, não resume", () => {
    expect(PLANO).toMatch(/você fecha, não resume/);
  });

  it("o arco entra na ordem de leitura, com objetivo abrindo e ajustar fechando", () => {
    const ordem = PLANO.slice(PLANO.indexOf("const ORDEM_SECOES = ["));
    const pos = (t: string) => ordem.indexOf(`"${t}"`);
    expect(pos("objetivo")).toBeLessThan(pos("entender"));
    expect(pos("entender")).toBeLessThan(pos("diferente"));
    expect(pos("diferente")).toBeLessThan(pos("progressao"));
    expect(pos("avaliar")).toBeLessThan(pos("ajustar"));
    expect(pos("ajustar")).toBeGreaterThan(pos("observar"));
  });
});

describe("o guard por substância", () => {
  it("exige estratégia, progressão e avaliação", () => {
    expect(PLANO).toMatch(/const SECOES_OBRIGATORIAS = \["diferente", "progressao", "avaliar"\]/);
  });

  it("a contagem deixou de ser o critério principal", () => {
    expect(PLANO).toMatch(/faltandoObrigatoria\.length === 0 && praticas\.length >= MINIMO_PRATICAS/);
  });

  it("cada obrigatória ausente vira falha nomeada, não um número", () => {
    expect(PLANO).toMatch(/motivo: "obrigatória e ausente"/);
  });

  it("o plano incompleto continua não sendo gravado", () => {
    expect(PLANO).toMatch(/throw new PlanoIncompletoError/);
  });
});

// ============================================================
// REPETIÇÃO
// ============================================================

describe("os recursos concretos", () => {
  it("acha os quatro campeões da auditoria", () => {
    const t = "Use uma caixa com tampinhas, uma almofada firme e alguns potes.";
    const r = recursosConcretos(t);
    for (const x of ["caixa", "tampinhas", "almofada", "potes"]) expect(r).toContain(x);
  });

  it("pega variação de número e de acento", () => {
    expect(recursosConcretos("as almofadas e o elástico")).toEqual(
      expect.arrayContaining(["almofada", "elástico"]),
    );
  });

  it("texto sem recurso não inventa nenhum", () => {
    expect(recursosConcretos("Converse com calma e espere a resposta dele.")).toEqual([]);
    expect(recursosConcretos("")).toEqual([]);
  });

  it("não repete o mesmo rótulo duas vezes", () => {
    const r = recursosConcretos("almofada, almofadinha, outra almofada");
    expect(r.filter((x) => x === "almofada")).toHaveLength(1);
  });
});

describe("o bloco anti-repetição", () => {
  it("some quando não há nada a evitar", () => {
    expect(blocoAntiRepeticao({ jaUsados: [] })).toBe("");
  });

  it("passa a estratégia central como espinha", () => {
    const b = blocoAntiRepeticao({ estrategiaCentral: "objeto na mão", jaUsados: [] });
    expect(b).toMatch(/<estrategia_central>/);
    expect(b).toMatch(/não abrir um caminho paralelo/);
  });

  it("lista o que já foi gasto e proíbe reapresentar como novidade", () => {
    const b = blocoAntiRepeticao({ jaUsados: ["almofada", "caixa"] });
    expect(b).toMatch(/JÁ USADOS EM OUTRAS SEÇÕES DESTE PLANO: almofada, caixa/);
    expect(b).toMatch(/Não reapresente nenhum deles como novidade/);
  });

  it("NÃO é proibição absoluta — reuso citado de passagem é permitido", () => {
    // Proibir de todo empurraria o modelo a inventar um recurso pior só pra
    // não repetir: trocar repetição por má sugestão.
    const b = blocoAntiRepeticao({ jaUsados: ["almofada"] });
    expect(b).toMatch(/Se um for mesmo necessário aqui, cite de passagem e siga/);
  });

  it("cada seção recebe a função que a diferencia", () => {
    expect(PAPEL_DA_SECAO.brincadeiras).toMatch(/LÚDICAS/);
    expect(PAPEL_DA_SECAO.atividades).toMatch(/ESTRUTURADA/);
    expect(PAPEL_DA_SECAO.frases).toMatch(/DIZER/);
    expect(PAPEL_DA_SECAO.crencas).toMatch(/INTERPRETAÇÕES/);
    expect(PAPEL_DA_SECAO.diferente).toMatch(/caminho principal/);
  });

  it("os papéis são distintos entre si", () => {
    const vals = Object.values(PAPEL_DA_SECAO);
    expect(new Set(vals).size).toBe(vals.length);
  });
});

describe("a ligação da anti-repetição no gerador", () => {
  it("o acumulador começa com o que a estratégia gastou", () => {
    expect(PLANO).toMatch(/const usados = new Set<string>\(recursosConcretos\(estrategiaTexto\)\)/);
  });

  it("cada seção pronta publica o que gastou", () => {
    expect(PLANO).toMatch(/for \(const r of recursosConcretos\(secao\.conteudo_markdown\)\) usados\.add\(r\)/);
  });

  it("cada seção recebe estratégia + já usados + o próprio papel", () => {
    expect(PLANO).toMatch(/estrategiaCentral: estrategiaTexto,\s*\n?\s*jaUsados: \[\.\.\.usados\],\s*\n?\s*papel: PAPEL_DA_SECAO\[tipo\]/);
  });
});

// ============================================================
// VERSIONAMENTO
// ============================================================

describe("a migração 0076", () => {
  it("são três colunas, e só três", () => {
    for (const c of ["plano_pai_id", "versao", "tipo_relacao"]) expect(MIGRACAO).toContain(c);
    expect(MIGRACAO).toMatch(/check \(tipo_relacao in \('novo', 'revisao', 'relacionado'\)\)/);
  });

  it("apagar a v1 não leva junto a v2", () => {
    // `set null`, não cascade: a v2 é o que a família está usando hoje.
    expect(MIGRACAO).toMatch(/references public\.planos\(id\) on delete set null/);
    expect(MIGRACAO).not.toMatch(/planos\(id\) on delete cascade/);
  });

  it("é aditiva — todo plano de hoje vira 'plano solto'", () => {
    expect(MIGRACAO).toMatch(/versao int not null default 1/);
    expect(MIGRACAO).toMatch(/Nenhuma linha existente muda de sentido/);
  });

  it("a regra de produto está escrita junto do schema", () => {
    expect(MIGRACAO).toMatch(/MESMO objetivo funcional \+ ajuste de estratégia\/progressão\s*→ `revisao`/);
    expect(MIGRACAO).toMatch(/Objetivo funcional DIFERENTE\s*→ `novo`/);
  });

  it("diz por que não é mais que isso", () => {
    expect(MIGRACAO).toMatch(/Nada de árvore de revisões, diff, merge/);
  });

  it("traz rollback e o aviso da fila", () => {
    expect(MIGRACAO).toMatch(/ROLLBACK/);
    expect(MIGRACAO).toMatch(/NÃO APLICAR ainda/);
    expect(MIGRACAO).toMatch(/0075 primeiro/);
  });
});
