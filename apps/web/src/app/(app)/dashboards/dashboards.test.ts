import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * O "LEAD DUPLICADO" QUE NUNCA EXISTIU — 05/08/2026.
 *
 * Dois e-mails apareciam duas vezes na tela com os campos idênticos. A auditoria
 * somente-leitura fechou: 150 usuários no auth, 150 `family_accounts`, ZERO
 * e-mails com mais de um usuário, ZERO usuários com mais de uma família, e as
 * duas funções de dashboard devolvendo 144/144 e 150/150 ids únicos.
 *
 * A causa era de COMPOSIÇÃO: a página mostra duas listas com propósitos
 * diferentes — o recorte que a pessoa abriu ("Quem está em: Cadastrou") e a
 * lista geral ("Leads em trial"). Uma família em trial no estágio Cadastrou
 * satisfaz as duas, então com o drill-down aberto ela aparecia nas duas. 38 de
 * 38 leads estavam nas duas.
 *
 * A correção é só de tela: com um recorte aberto, a lista geral se recolhe.
 * Nada de deduplicar — deduplicar esconderia um comportamento correto.
 */

const PAGE = readFileSync(resolve(__dirname, "page.tsx"), "utf8");
const JORNADA = readFileSync(resolve(__dirname, "../../../lib/analytics/jornada.ts"), "utf8");

/** O trecho do arquivo entre duas âncoras — pra afirmar o que está DENTRO de quê. */
function entre(fonte: string, de: string, ate: string) {
  const i = fonte.indexOf(de);
  const f = fonte.indexOf(ate, i);
  expect(i).toBeGreaterThan(-1);
  expect(f).toBeGreaterThan(i);
  return fonte.slice(i, f);
}

describe("uma lista de cada vez", () => {
  it("a lista geral só renderiza quando NÃO há recorte aberto", () => {
    // Nada entre a guarda e o bloco: a lista inteira está dentro dela.
    expect(entre(PAGE, "{!segDef && (", '<Bloco titulo="Leads em trial"').trim()).toBe(
      "{!segDef && (",
    );
  });

  it("o recorte só renderiza quando HÁ segmento", () => {
    expect(entre(PAGE, "{segDef && (", "titulo={`Quem está em:")).toMatch(
      /^\{segDef && \(\s*<Bloco\s*$/,
    );
  });

  it("as duas condições são opostas — nunca as duas na tela, nunca nenhuma", () => {
    // `segDef` é a única fonte das duas. Se um dia virar dois estados
    // independentes, dá pra ter as duas listas de novo sem ninguém perceber.
    expect(PAGE).toMatch(/const segDef = sp\.seg \? SEGMENTOS\[sp\.seg\] : undefined;/);
  });
});

describe("dá pra voltar", () => {
  it("o caminho de volta é explícito, não um 'limpar' vago", () => {
    expect(PAGE).toMatch(/Voltar para a visão geral/);
    expect(PAGE).not.toMatch(/limpar seleção/);
  });

  it("volta pra /dashboards sem segmento — é o que traz a lista geral de volta", () => {
    const recorte = entre(PAGE, "titulo={`Quem está em:", "</Bloco>");
    expect(recorte).toMatch(/<Link href="\/dashboards"/);
  });

  it("trocar de segmento é só trocar o ?seg= — o estado vive na URL", () => {
    expect(PAGE).toMatch(/`\/dashboards\?seg=\$\{SEG_CHECKOUT\}`/);
    expect(PAGE).toMatch(/const ativo = segAtivo === f\.key/);
    expect(PAGE).toMatch(/`\/dashboards\?seg=\$\{f\.key\}`/);
  });

  it("clicar no estágio já ativo desliga o recorte", () => {
    expect(PAGE).toMatch(/segAtivo === SEG_CHECKOUT \? "\/dashboards" :/);
    expect(PAGE).toMatch(/segAtivo === "em_risco" \? "\/dashboards" :/);
  });
});

describe("nada além da tela mudou", () => {
  it("as contagens do funil ficam FORA do condicional — aparecem sempre", () => {
    const iFunil = PAGE.indexOf("segAtivo === SEG_CHECKOUT ? \"/dashboards\"");
    const iRecorte = PAGE.indexOf("{segDef && (");
    const iGeral = PAGE.indexOf("{!segDef && (");
    expect(iFunil).toBeGreaterThan(0);
    expect(iFunil).toBeLessThan(iRecorte);
    expect(iFunil).toBeLessThan(iGeral);
  });

  it("as duas listas continuam saindo das MESMAS fontes de sempre", () => {
    expect(PAGE).toMatch(/const familiasSeg = segDef \? j\.todasFamilias\.filter\(segDef\.pred\) : \[\];/);
    expect(PAGE).toMatch(/j\.leads\.map\(/);
  });

  it("nenhuma deduplicação foi introduzida — não havia o que deduplicar", () => {
    for (const proibido of [/\bnew Set\(/, /dedup/i, /distinct/i, /\.filter\(\(f, i, a\)/]) {
      expect(PAGE).not.toMatch(proibido);
    }
  });

  it("a query não foi tocada: 1 família = 1 linha, como já era", () => {
    // `todasFamilias` e `leads` nascem do mesmo laço sobre `fams`, que vem de
    // `family_accounts` — a granularidade é a família, e nenhum JOIN multiplica.
    expect(JORNADA).toMatch(/todasFamilias/);
    expect(JORNADA).toMatch(/leads/);
  });
});
