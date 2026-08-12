/**
 * UM SUPABASE DE MENTIRA, MAS COM AS REGRAS DE VERDADE.
 *
 * ⚠️ POR QUE ISTO EXISTE (11/08/2026). Os testes da Ayla provam ESTRUTURA — que
 * uma linha de código está onde deveria. Nenhum deles fazia a mãe escrever uma
 * mensagem e ver o que sai do outro lado. `processInbound` nunca tinha sido
 * executado num teste: `clarificacao-retoma.test.ts` e
 * `turno-instrumentacao.test.ts` leem o arquivo com `readFileSync`.
 *
 * Estrutura não é comportamento. Um portão pode estar escrito certo e o turno
 * ainda assim terminar errado, porque outro portão antes dele já decidiu.
 *
 * ⚠️ O QUE ESTE DUPLO NÃO É: um Postgres. Ele não tem RLS, não tem transação,
 * não tem tipo. O que ele reproduz é o CONTRATO do cliente Supabase que o
 * código usa — inclusive o detalhe que já custou caro neste repositório:
 * `.update()` e `.insert()` DEVOLVEM `{ error }` em vez de lançar.
 */

type Linha = Record<string, unknown>;

/** Comparações acumuladas até o `await`. */
type Filtro =
  | { op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte"; col: string; val: unknown }
  | { op: "in"; col: string; val: unknown[] }
  | { op: "is"; col: string; val: null }
  | { op: "not"; col: string; val: unknown };

let seq = 0;
/** Ids estáveis e legíveis — `Math.random` não entra em teste. */
/**
 * ⚠️ ID LEGÍVEL, MAS COM FORMA DE UUID — e a segunda metade não é estética.
 *
 * A versão anterior devolvia `membro-0016`. Isso passou meses sem incomodar,
 * até a medição de latência de 13/08/2026: o `ParserSchema` exige
 * `z.string().uuid()` no `membro_atipico_id`, então TODO turno do harness com
 * modelo real reprovava no schema, devolvia null e caía no modelo de fallback.
 * O resultado foi uma medição que atribuía ~6s por turno a um "defeito de
 * produto" que era da fixture — e em produção, onde o id É uuid, não acontece.
 *
 * O prefixo continua legível no meio do uuid (`membro-0016` vira
 * `6d656d62-0016-4000-8000-...`) porque ler o cenário quebrado importa; mas a
 * FORMA agora é a de produção. Fixture que não imita o formato do banco não
 * prova nada sobre o banco.
 */
export const novoId = (p = "id") => {
  const n = (++seq).toString().padStart(4, "0");
  const hex = Buffer.from(p).toString("hex").padEnd(8, "0").slice(0, 8);
  return `${hex}-${n}-4000-8000-${n.padStart(12, "0")}`;
};

export class BancoMemoria {
  readonly tabelas = new Map<string, Linha[]>();
  /** Toda escrita fica registrada — é como o cenário prova o que foi salvo. */
  readonly escritas: Array<{ tabela: string; op: string; linha: Linha }> = [];
  /** Tabelas que devem falhar na escrita, para exercitar erro engolido. */
  readonly falhamAoEscrever = new Set<string>();

  semear(tabela: string, linhas: Linha[]) {
    const atual = this.tabelas.get(tabela) ?? [];
    for (const l of linhas) atual.push({ id: novoId(tabela), created_at: new Date().toISOString(), ...l });
    this.tabelas.set(tabela, atual);
    return this;
  }

  linhas(tabela: string): Linha[] {
    return this.tabelas.get(tabela) ?? [];
  }

  from(tabela: string) {
    return new Consulta(this, tabela);
  }

  /** O objeto que o código recebe no lugar do `SupabaseClient`. */
  cliente(): never {
    return { from: (t: string) => this.from(t) } as never;
  }
}

function passa(l: Linha, f: Filtro): boolean {
  const v = l[f.col];
  switch (f.op) {
    case "eq":
      return v === f.val;
    case "neq":
      return v !== f.val;
    case "is":
      return v === null || v === undefined;
    case "not":
      return v !== f.val;
    case "in":
      return f.val.includes(v);
    case "gt":
      return String(v) > String(f.val);
    case "gte":
      return String(v) >= String(f.val);
    case "lt":
      return String(v) < String(f.val);
    case "lte":
      return String(v) <= String(f.val);
  }
}

/**
 * A cadeia do PostgREST. Ela é *thenable*: o código faz `await supabase.from(…)
 * .select(…).eq(…)` sem chamar nada que "execute" — quem dispara é o `await`.
 */
class Consulta implements PromiseLike<{ data: unknown; error: unknown }> {
  private filtros: Filtro[] = [];
  private ordem: { col: string; asc: boolean } | null = null;
  private teto: number | null = null;
  private modo: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private carga: Linha[] = [];
  private umSo = false;
  private colunas = "*";

  constructor(
    private readonly db: BancoMemoria,
    private readonly tabela: string,
  ) {}

  select(cols = "*") {
    this.colunas = cols;
    if (this.modo === "select") this.modo = "select";
    return this;
  }
  eq(col: string, val: unknown) {
    this.filtros.push({ op: "eq", col, val });
    return this;
  }
  neq(col: string, val: unknown) {
    this.filtros.push({ op: "neq", col, val });
    return this;
  }
  gt(col: string, val: unknown) {
    this.filtros.push({ op: "gt", col, val });
    return this;
  }
  gte(col: string, val: unknown) {
    this.filtros.push({ op: "gte", col, val });
    return this;
  }
  lt(col: string, val: unknown) {
    this.filtros.push({ op: "lt", col, val });
    return this;
  }
  lte(col: string, val: unknown) {
    this.filtros.push({ op: "lte", col, val });
    return this;
  }
  in(col: string, val: unknown[]) {
    this.filtros.push({ op: "in", col, val });
    return this;
  }
  is(col: string, val: null) {
    this.filtros.push({ op: "is", col, val });
    return this;
  }
  not(col: string, _op: string, val: unknown) {
    this.filtros.push({ op: "not", col, val });
    return this;
  }
  or() {
    // `or` aparece em consultas de leitura auxiliares; o duplo não o
    // interpreta, e por isso NÃO filtra — mais linhas, nunca menos. Um cenário
    // que dependa de `or` para excluir algo tem que dizer isso por escrito.
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.ordem = { col, asc: opts?.ascending ?? true };
    return this;
  }
  limit(n: number) {
    this.teto = n;
    return this;
  }
  range(_de: number, ate: number) {
    this.teto = ate + 1;
    return this;
  }
  maybeSingle() {
    this.umSo = true;
    return this;
  }
  single() {
    this.umSo = true;
    return this;
  }

  insert(linha: Linha | Linha[]) {
    this.modo = "insert";
    this.carga = Array.isArray(linha) ? linha : [linha];
    return this;
  }
  upsert(linha: Linha | Linha[], _opts?: unknown) {
    this.modo = "upsert";
    this.carga = Array.isArray(linha) ? linha : [linha];
    return this;
  }
  update(linha: Linha) {
    this.modo = "update";
    this.carga = [linha];
    return this;
  }
  delete() {
    this.modo = "delete";
    return this;
  }

  private filtradas(): Linha[] {
    let r = this.db.linhas(this.tabela).filter((l) => this.filtros.every((f) => passa(l, f)));
    if (this.ordem) {
      const { col, asc } = this.ordem;
      r = [...r].sort((a, b) => {
        const x = String(a[col] ?? ""), y = String(b[col] ?? "");
        return asc ? (x < y ? -1 : x > y ? 1 : 0) : x < y ? 1 : x > y ? -1 : 0;
      });
    }
    if (this.teto != null) r = r.slice(0, this.teto);
    return r;
  }

  private executar(): { data: unknown; error: unknown } {
    // A FALHA DE ESCRITA É SILENCIOSA DE PROPÓSITO: devolvida em `error`, nunca
    // lançada. É exatamente assim que o acesso da Rochelle sumiu.
    if (this.modo !== "select" && this.db.falhamAoEscrever.has(this.tabela)) {
      return { data: null, error: { message: `escrita barrada em ${this.tabela} (cenário)` } };
    }

    switch (this.modo) {
      case "insert":
      case "upsert": {
        const criadas = this.carga.map((l) => ({
          id: novoId(this.tabela),
          created_at: new Date().toISOString(),
          ...l,
        }));
        const atual = this.db.linhas(this.tabela);
        for (const c of criadas) {
          this.db.escritas.push({ tabela: this.tabela, op: this.modo, linha: c });
          atual.push(c);
        }
        this.db.tabelas.set(this.tabela, atual);
        return { data: this.umSo ? criadas[0] : criadas, error: null };
      }
      case "update": {
        const alvo = this.filtradas();
        for (const l of alvo) {
          Object.assign(l, this.carga[0]);
          this.db.escritas.push({ tabela: this.tabela, op: "update", linha: l });
        }
        return { data: this.umSo ? (alvo[0] ?? null) : alvo, error: null };
      }
      case "delete": {
        const alvo = this.filtradas();
        const resto = this.db.linhas(this.tabela).filter((l) => !alvo.includes(l));
        this.db.tabelas.set(this.tabela, resto);
        for (const l of alvo) this.db.escritas.push({ tabela: this.tabela, op: "delete", linha: l });
        return { data: alvo, error: null };
      }
      default: {
        const r = this.filtradas();
        return { data: this.umSo ? (r[0] ?? null) : r, error: null };
      }
    }
  }

  then<A, B = never>(
    ok?: ((v: { data: unknown; error: unknown }) => A | PromiseLike<A>) | null,
    falha?: ((r: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve(this.executar()).then(ok, falha);
  }
}
