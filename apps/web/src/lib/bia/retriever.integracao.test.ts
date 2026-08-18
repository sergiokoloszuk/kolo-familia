import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buscarConhecimentosBIA, montarConsultaTexto } from "./retriever";

/**
 * TESTES DE INTEGRAÇÃO DA BUSCA — de CONTRATO, não contra um Postgres real.
 *
 * ⚠️ LIMITE HONESTO: não existe ambiente seguro neste projeto (sem Docker, sem
 * Postgres local, e o único SUPABASE_URL configurado é o de PRODUÇÃO). A
 * migração 0071 não foi aplicada. Então estes testes NÃO provam que a consulta
 * roda — provam que ela é COERENTE com o schema declarado e que usa a sintaxe
 * que o Postgres aceita.
 *
 * Eles pegam justamente a classe de erro que só apareceria em produção:
 *   - coluna que o retriever pede e a migração não cria;
 *   - tabela com nome diferente;
 *   - `textSearch` sem `type: "websearch"` (o default é `to_tsquery`, que
 *     rejeita a palavra "or" com erro de sintaxe — foi um bug real, encontrado
 *     ao escrever este arquivo);
 *   - filtro `or()` com sintaxe PostgREST inválida.
 *
 * O que continua por verificar contra o banco de verdade está listado em
 * `docs/bia-aplicacao-0071.md`.
 */

const MIGRACAO = resolve(__dirname, "../../../../../supabase/migrations/0071_bia.sql");

/** Colunas declaradas em `create table public.bia_chunks`. */
function colunasDaMigracao(): Set<string> {
  const sql = readFileSync(MIGRACAO, "utf8");
  const corpo = sql.slice(
    sql.indexOf("create table if not exists public.bia_chunks"),
  );
  const cols = new Set<string>();
  for (const linha of corpo.split("\n")) {
    // "  nome_da_coluna tipo ..." — ignora comentários, constraints e índices.
    const m = linha.match(/^\s{2}([a-z_]+)\s+(uuid|text|int|boolean|timestamptz|tsvector)/);
    if (m) cols.add(m[1]);
  }
  return cols;
}

type Chamada = { metodo: string; args: unknown[] };

function supabaseFalso(registro: Chamada[]) {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "or", "in", "textSearch", "limit"]) {
    b[m] = (...args: unknown[]) => {
      registro.push({ metodo: m, args });
      return b;
    };
  }
  b.then = (resolver: (v: { data: unknown[] }) => unknown) => resolver({ data: [] });
  return {
    from: (t: string) => {
      registro.push({ metodo: "from", args: [t] });
      return b;
    },
  } as unknown as SupabaseClient;
}

const ctx = {
  idadeAnos: 5,
  perfil: "TEA",
  dominio: "sono",
  dificuldade: "acorda de madrugada",
  textoDaConversa: "ela acorda toda madrugada e não volta a dormir",
};

describe("contrato com o schema da migração 0071", () => {
  it("a migração cria a tabela que o retriever consulta", async () => {
    const reg: Chamada[] = [];
    await buscarConhecimentosBIA(supabaseFalso(reg), ctx);
    const tabelas = reg.filter((c) => c.metodo === "from").map((c) => c.args[0]);
    expect(new Set(tabelas)).toEqual(new Set(["bia_chunks"]));
    expect(readFileSync(MIGRACAO, "utf8")).toContain("public.bia_chunks");
  });

  it("TODA coluna pedida no select existe na migração", async () => {
    const reg: Chamada[] = [];
    await buscarConhecimentosBIA(supabaseFalso(reg), ctx);

    const select = reg.find((c) => c.metodo === "select")!.args[0] as string;
    const pedidas = select.split(",").map((s) => s.trim());
    const declaradas = colunasDaMigracao();

    expect(declaradas.size).toBeGreaterThan(20); // sanidade do parser
    for (const col of pedidas) {
      expect(declaradas, `coluna "${col}" não existe na migração 0071`).toContain(col);
    }
  });

  it("as colunas filtradas também existem", async () => {
    const reg: Chamada[] = [];
    await buscarConhecimentosBIA(supabaseFalso(reg), ctx);
    const declaradas = colunasDaMigracao();

    for (const c of reg.filter((x) => x.metodo === "eq")) {
      expect(declaradas).toContain(String(c.args[0]));
    }
    for (const c of reg.filter((x) => x.metodo === "in")) {
      expect(declaradas).toContain(String(c.args[0]));
    }
    for (const c of reg.filter((x) => x.metodo === "textSearch")) {
      expect(declaradas).toContain(String(c.args[0]));
    }
  });

  it("o índice de busca textual existe para a coluna consultada", () => {
    const sql = readFileSync(MIGRACAO, "utf8");
    expect(sql).toMatch(/create index[^;]*using gin\(texto_busca\)/i);
  });
});

describe("sintaxe que o Postgres precisa aceitar", () => {
  it("a busca textual usa websearch — to_tsquery rejeitaria a palavra 'or'", async () => {
    const reg: Chamada[] = [];
    await buscarConhecimentosBIA(supabaseFalso(reg), ctx);
    const ts = reg.find((c) => c.metodo === "textSearch")!;
    expect(ts.args[2]).toEqual({ config: "portuguese", type: "websearch" });
  });

  it("a consulta textual não vaza caractere que quebre o parser", () => {
    const q = montarConsultaTexto({
      textoDaConversa: "ela grita: \"não!\" & foge (sempre) — 100% das vezes; ok?",
    })!;
    // `termos()` já normaliza para [a-z0-9]; nada de operador solto.
    expect(q).not.toMatch(/[&|!():"'<>*]/);
    expect(q).toMatch(/^[a-z0-9]+( or [a-z0-9]+)*$/);
  });

  it("o filtro de faixa etária usa sintaxe PostgREST válida", async () => {
    const reg: Chamada[] = [];
    await buscarConhecimentosBIA(supabaseFalso(reg), ctx);
    const ors = reg.filter((c) => c.metodo === "or").map((c) => String(c.args[0]));
    // 4 = duas consultas (estruturada + textual) × dois filtros de faixa
    // (mínimo e máximo). Cada consulta é montada por `base()`, então o filtro
    // de idade tem de estar presente nas DUAS — se estivesse só numa, a outra
    // devolveria conhecimento fora da faixa etária da criança.
    expect(ors.length).toBe(4);
    for (const o of ors) {
      // "coluna.operador.valor" separado por vírgula, sem espaço.
      expect(o).toMatch(/^[a-z_]+\.is\.null,[a-z_]+\.(lte|gte)\.\d+$/);
    }
  });

  it("o config de dicionário existe no Postgres padrão", async () => {
    const reg: Chamada[] = [];
    await buscarConhecimentosBIA(supabaseFalso(reg), ctx);
    const ts = reg.find((c) => c.metodo === "textSearch")!;
    // `portuguese` é dicionário padrão — não exige extensão nem instalação.
    // É o mesmo usado na coluna gerada `texto_busca` da 0071.
    expect((ts.args[2] as { config: string }).config).toBe("portuguese");
    expect(readFileSync(MIGRACAO, "utf8")).toContain("to_tsvector(\n      'portuguese'");
  });

  it("respeita o teto de candidatos por consulta", async () => {
    const reg: Chamada[] = [];
    await buscarConhecimentosBIA(supabaseFalso(reg), ctx, { candidatosMax: 42 });
    for (const c of reg.filter((x) => x.metodo === "limit")) {
      expect(c.args[0]).toBe(42);
    }
  });
});
