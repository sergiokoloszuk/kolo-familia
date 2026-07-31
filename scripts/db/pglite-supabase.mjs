/**
 * ADAPTADOR PGlite → supabase-js.
 *
 * Implementa o subconjunto do query builder que os caminhos de escrita da
 * Memória Viva usam, executando SQL de verdade contra o PGlite. É o que permite
 * rodar `aplicarPropostaNoPerfil`, `aplicarItensNoMembro` e companhia SEM
 * mockar a persistência — a diferença entre "o schema funciona" e "a aplicação
 * grava o que o schema promete".
 *
 * ⚠️ LIMITE HONESTO, e é o mais importante deste arquivo: **isto não é
 * PostgREST**. É a minha implementação do que eu acredito que o PostgREST faz.
 * Onde a semântica dele é a hipótese sob teste — notadamente
 * `upsert(..., { ignoreDuplicates: true }).select("id")` —, este adaptador
 * codifica a hipótese, não a verifica. Ver `CONTRATO_POSTGREST` abaixo.
 */

/**
 * CONTRATO ASSUMIDO DO POSTGREST — hipótese NÃO VERIFICADA.
 *
 * `upsert(linha, { onConflict: "col", ignoreDuplicates: true })` gera
 * `INSERT ... ON CONFLICT (col) DO NOTHING`. Com `.select("id")`:
 *
 *   - inserção nova  → devolve [{ id }]
 *   - conflito       → devolve []
 *
 * Toda a idempotência do serviço depende disso: `data.length === 0` é lido como
 * "duplicata". Se o PostgREST devolvesse a linha existente em vez de vazio, o
 * serviço reportaria "gravado" onde houve duplicata, e as métricas de
 * recorrência nasceriam erradas — sem sintoma visível.
 *
 * O SQL puro foi verificado (`validar-memoria.mjs`: "ON CONFLICT DO NOTHING
 * devolve ZERO linhas"). O que falta é a camada do cliente.
 */
export const CONTRATO_POSTGREST = {
  descricao: "upsert + ignoreDuplicates + select devolve [] em conflito",
  verificado: false,
  verificadoPor: null,
  menorExperimento:
    "um insert repetido contra qualquer projeto Supabase, com a mesma chamada do supabase-js, olhando o retorno",
};

const cita = (id) => `"${String(id).replace(/"/g, '""')}"`;

/** Constrói o WHERE a partir dos filtros encadeados. */
function montarWhere(filtros, params) {
  if (filtros.length === 0) return "";
  const partes = filtros.map((f) => {
    if (f.tipo === "eq") {
      params.push(f.valor);
      return `${cita(f.coluna)} = $${params.length}`;
    }
    if (f.tipo === "is") {
      return `${cita(f.coluna)} is ${f.valor === null ? "null" : f.valor}`;
    }
    if (f.tipo === "in") {
      const marcadores = f.valor.map((v) => {
        params.push(v);
        return `$${params.length}`;
      });
      return `${cita(f.coluna)} in (${marcadores.join(",")})`;
    }
    if (f.tipo === "neq") {
      params.push(f.valor);
      return `${cita(f.coluna)} <> $${params.length}`;
    }
    if (f.tipo === "ilike") {
      params.push(f.valor);
      return `${cita(f.coluna)} ilike $${params.length}`;
    }
    if (f.tipo === "gte" || f.tipo === "lte" || f.tipo === "gt" || f.tipo === "lt") {
      const op = { gte: ">=", lte: "<=", gt: ">", lt: "<" }[f.tipo];
      params.push(f.valor);
      return `${cita(f.coluna)} ${op} $${params.length}`;
    }
    throw new Error(`filtro não suportado: ${f.tipo}`);
  });
  return ` where ${partes.join(" and ")}`;
}

function construtor(db, tabela, registro) {
  const estado = {
    acao: null,
    colunas: "*",
    filtros: [],
    linhas: null,
    onConflict: null,
    ignoreDuplicates: false,
    ordem: null,
    limite: null,
    unico: null,
    contar: false,
    apenasContagem: false,
  };

  async function executar() {
    const params = [];
    let sql;

    if (estado.acao === "insert" || estado.acao === "upsert") {
      const linhas = Array.isArray(estado.linhas) ? estado.linhas : [estado.linhas];
      const cols = [...new Set(linhas.flatMap((l) => Object.keys(l)))];
      const valores = linhas.map(
        (l) =>
          `(${cols
            .map((c) => {
              params.push(l[c] ?? null);
              return `$${params.length}`;
            })
            .join(",")})`,
      );
      sql = `insert into ${cita(tabela)} (${cols.map(cita).join(",")}) values ${valores.join(",")}`;
      if (estado.acao === "upsert" && estado.onConflict) {
        // `onConflict` aceita lista separada por vírgula ("a,b") — chave
        // composta. Citar a string inteira faria um identificador só, e o
        // Postgres reclamaria de coluna inexistente.
        const alvo = estado.onConflict.split(",").map((c) => c.trim());
        const alvoSql = alvo.map(cita).join(",");
        // Ver CONTRATO_POSTGREST: esta é a tradução assumida.
        sql += estado.ignoreDuplicates
          ? ` on conflict (${alvoSql}) do nothing`
          : ` on conflict (${alvoSql}) do update set ${cols
              .filter((c) => !alvo.includes(c))
              .map((c) => `${cita(c)} = excluded.${cita(c)}`)
              .join(",")}`;
      }
      if (estado.colunas !== null) sql += ` returning ${estado.colunas === "*" ? "*" : estado.colunas}`;
    } else if (estado.acao === "update") {
      const cols = Object.keys(estado.linhas);
      const sets = cols.map((c) => {
        params.push(estado.linhas[c]);
        return `${cita(c)} = $${params.length}`;
      });
      sql = `update ${cita(tabela)} set ${sets.join(",")}${montarWhere(estado.filtros, params)}`;
      if (estado.colunas !== null) sql += ` returning ${estado.colunas === "*" ? "*" : estado.colunas}`;
    } else {
      // `select("id", { count: "exact", head: true })` do supabase-js: devolve
      // { count } sem linhas. Sem isto, `count` volta undefined e vira 0 em
      // silencio - foi o que quebrou tres validacoes da revisao.
      const projecao = estado.apenasContagem ? "count(*)::int as __count" : estado.colunas;
      sql = `select ${projecao} from ${cita(tabela)}${montarWhere(estado.filtros, params)}`;
      if (estado.ordem) sql += ` order by ${cita(estado.ordem.coluna)} ${estado.ordem.asc ? "asc" : "desc"}`;
      if (estado.limite != null) sql += ` limit ${estado.limite}`;
    }

    registro?.push({ tabela, sql });
    try {
      const r = await db.query(sql, params);
      const linhas = r.rows ?? [];
      if (estado.apenasContagem) {
        return { data: null, count: linhas[0]?.__count ?? 0, error: null };
      }
      if (estado.contar) {
        return { data: linhas, count: linhas.length, error: null };
      }
      if (estado.unico === "maybeSingle") {
        return { data: linhas[0] ?? null, error: null };
      }
      if (estado.unico === "single") {
        if (linhas.length !== 1) {
          return { data: null, error: { message: `esperava 1 linha, veio ${linhas.length}` } };
        }
        return { data: linhas[0], error: null };
      }
      return { data: linhas, error: null };
    } catch (e) {
      // O supabase-js NÃO lança: devolve { error }. Reproduzir isso importa —
      // é disso que depende a falha segura do serviço.
      try {
        await db.exec("rollback");
      } catch {
        /* não havia transação */
      }
      return { data: null, error: { message: e.message, code: e.code } };
    }
  }

  const api = {
    select(colunas = "*", opcoes = {}) {
      estado.colunas = colunas;
      estado.contar = Boolean(opcoes.count);
      estado.apenasContagem = Boolean(opcoes.head);
      if (!estado.acao) estado.acao = "select";
      return api;
    },
    insert(linhas) {
      estado.acao = "insert";
      estado.linhas = linhas;
      estado.colunas = null;
      return api;
    },
    upsert(linhas, opcoes = {}) {
      estado.acao = "upsert";
      estado.linhas = linhas;
      estado.onConflict = opcoes.onConflict ?? null;
      estado.ignoreDuplicates = Boolean(opcoes.ignoreDuplicates);
      estado.colunas = null;
      return api;
    },
    update(linhas) {
      estado.acao = "update";
      estado.linhas = linhas;
      estado.colunas = null;
      return api;
    },
    eq(coluna, valor) {
      estado.filtros.push({ tipo: "eq", coluna, valor });
      return api;
    },
    is(coluna, valor) {
      estado.filtros.push({ tipo: "is", coluna, valor });
      return api;
    },
    in(coluna, valor) {
      estado.filtros.push({ tipo: "in", coluna, valor });
      return api;
    },
    gte(coluna, valor) {
      estado.filtros.push({ tipo: "gte", coluna, valor });
      return api;
    },
    lte(coluna, valor) {
      estado.filtros.push({ tipo: "lte", coluna, valor });
      return api;
    },
    not(coluna, op, valor) {
      if (op === "is" && valor === null) {
        estado.filtros.push({ tipo: "is", coluna, valor: "not null" });
      }
      return api;
    },
    neq(coluna, valor) {
      estado.filtros.push({ tipo: "neq", coluna, valor });
      return api;
    },
    ilike(coluna, valor) {
      estado.filtros.push({ tipo: "ilike", coluna, valor });
      return api;
    },
    order(coluna, opcoes = {}) {
      estado.ordem = { coluna, asc: opcoes.ascending !== false };
      return api;
    },
    limit(n) {
      estado.limite = n;
      return api;
    },
    maybeSingle() {
      estado.unico = "maybeSingle";
      return api;
    },
    single() {
      estado.unico = "single";
      return api;
    },
    then(resolve, reject) {
      return executar().then(resolve, reject);
    },
  };
  return api;
}

/**
 * Cliente compatível com o subconjunto de `SupabaseClient` que a Memória Viva
 * usa. `registro` (opcional) acumula o SQL emitido, para inspeção.
 */
export function clienteSupabaseSobrePGlite(db, registro) {
  return {
    from: (tabela) => construtor(db, tabela, registro),
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        createSignedUrl: async () => ({ data: { signedUrl: "http://teste/x.pdf" } }),
      }),
    },
  };
}
