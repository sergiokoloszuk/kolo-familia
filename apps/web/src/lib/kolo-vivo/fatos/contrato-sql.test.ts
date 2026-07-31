import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * CONTRATO ENTRE O CÓDIGO E A MIGRAÇÃO 0073.
 *
 * Não substitui rodar contra um Postgres de verdade — nada substitui. O que ele
 * faz é pegar, sem banco, a classe de erro que só apareceria lá:
 *
 *   - campo escrito que não existe como coluna;
 *   - coluna NOT NULL sem default que ninguém preenche;
 *   - valor que o TypeScript aceita e o CHECK do Postgres recusa;
 *   - **policy de RLS faltando para um caminho que escreve com o cliente do
 *     usuário** — foi assim que se descobriu que o diário e a web manual seriam
 *     rejeitados pelo banco, em silêncio, enquanto o WhatsApp funcionava.
 *
 * O último é o motivo de este arquivo existir. O erro não aparecia em teste
 * nenhum porque todos os testes mockam o Supabase, e mock não tem RLS.
 */

const MIGRACAO = resolve(__dirname, "../../../../../../supabase/migrations/0073_perfil_fatos.sql");
const REGISTRAR = resolve(__dirname, "registrar.ts");
const TIPOS = resolve(__dirname, "tipos.ts");

const sql = () => readFileSync(MIGRACAO, "utf8");

/** Colunas declaradas em `create table`. */
function colunas(): Map<string, { notNull: boolean; temDefault: boolean }> {
  const corpo = sql().slice(
    sql().indexOf("create table if not exists public.perfil_fatos"),
    sql().indexOf("\n);"),
  );
  const out = new Map<string, { notNull: boolean; temDefault: boolean }>();
  for (const linha of corpo.split("\n")) {
    const m = linha.match(
      /^\s{2}([a-z_]+)\s+(uuid|text|int|integer|boolean|timestamptz|date|numeric)(.*)$/,
    );
    if (m) {
      out.set(m[1], {
        notNull: m[3].includes("not null"),
        temDefault: m[3].includes("default"),
      });
    }
  }
  return out;
}

/** Campos do payload de insert em `registrar.ts`. */
function camposEscritos(): Set<string> {
  const ts = readFileSync(REGISTRAR, "utf8");
  const bloco = ts.slice(ts.indexOf("const linha = {"), ts.indexOf("idempotency_key: chave,") + 60);
  const out = new Set<string>();
  for (const m of bloco.matchAll(/^\s{4}([a-z_]+)[,:]/gm)) out.add(m[1]);
  return out;
}

/** Valores aceitos por um CHECK ... in (...). */
function valoresDoCheck(coluna: string): Set<string> {
  const re = new RegExp(`${coluna} text[^,]*check \\(${coluna} in \\(([^)]*)\\)\\)`, "s");
  const m = sql().match(re);
  if (!m) return new Set();
  return new Set(
    m[1]
      .split(",")
      .map((v) => v.trim().replace(/\n/g, "").replace(/'/g, "").trim())
      .filter(Boolean),
  );
}

/** Membros de uma union de string literal em tipos.ts. */
function membrosDaUnion(nome: string): Set<string> {
  const ts = readFileSync(TIPOS, "utf8");
  const i = ts.indexOf(`export type ${nome} =`);
  if (i < 0) return new Set();
  const trecho = ts.slice(i, ts.indexOf(";", i));
  return new Set([...trecho.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]));
}

describe("colunas", () => {
  it("todo campo escrito existe como coluna", () => {
    const cols = colunas();
    const orfaos = [...camposEscritos()].filter((c) => !cols.has(c));
    expect(orfaos, `campos sem coluna: ${orfaos.join(", ")}`).toEqual([]);
  });

  it("toda coluna NOT NULL sem default é preenchida pelo código", () => {
    const escritos = camposEscritos();
    const faltando = [...colunas().entries()]
      .filter(([, d]) => d.notNull && !d.temDefault)
      .map(([c]) => c)
      .filter((c) => !escritos.has(c));
    expect(faltando, `NOT NULL não preenchidas: ${faltando.join(", ")}`).toEqual([]);
  });
});

describe("CHECK do Postgres × unions do TypeScript", () => {
  const pares: Array<[string, string]> = [
    ["fact_kind", "FactKind"],
    ["escopo_tipo", "EscopoTipo"],
    ["source_type", "SourceType"],
    ["source_channel", "SourceChannel"],
    ["verification_status", "VerificationStatus"],
    ["temporal_status", "TemporalStatus"],
  ];

  for (const [coluna, tipo] of pares) {
    it(`${tipo} não produz valor que o CHECK de ${coluna} recuse`, () => {
      const aceitos = valoresDoCheck(coluna);
      const possiveis = membrosDaUnion(tipo);
      expect(aceitos.size, `CHECK de ${coluna} não encontrado`).toBeGreaterThan(0);
      expect(possiveis.size, `union ${tipo} não encontrada`).toBeGreaterThan(0);
      const recusados = [...possiveis].filter((v) => !aceitos.has(v));
      expect(recusados, `${tipo} produz o que ${coluna} recusa: ${recusados.join(", ")}`).toEqual(
        [],
      );
    });
  }
});

describe("RLS — cada caminho de escrita precisa de policy", () => {
  /**
   * Dois dos quatro caminhos escrevem com o cliente do USUÁRIO
   * (`createClient()`), não com service role: o diário e o "Guardar no Perfil"
   * da web. Sem policy de insert, o Postgres rejeita — e o serviço engole o
   * erro, então a falha é silenciosa.
   */
  it("existe policy de INSERT para authenticated", () => {
    expect(sql()).toMatch(/create policy [a-z_]+ on public\.perfil_fatos\s+for insert to authenticated/);
  });

  it("a policy de insert restringe à família da própria pessoa", () => {
    const m = sql().match(/for insert to authenticated\s+with check \(([^;]*)\)/);
    expect(m?.[1] ?? "").toContain("current_family_account_id()");
  });

  it("RLS está habilitado", () => {
    expect(sql()).toContain("alter table public.perfil_fatos enable row level security");
  });
});

describe("quarentena isolada por índice, não por disciplina", () => {
  it("o índice de leitura exclui quarentena e invalidado", () => {
    expect(sql()).toMatch(/perfil_fatos_membro_idx[\s\S]*?status = 'ativo'/);
  });

  it("a idempotência é garantida por índice único", () => {
    expect(sql()).toMatch(/create unique index[^;]*perfil_fatos_idempotency_uk[^;]*idempotency_key/);
  });
});
