import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * A FALHA QUE ESTES TESTES REPRODUZEM — medida em produção, 15/08/2026.
 *
 * `ayla_daily_checkins` tinha **zero linhas na história inteira do produto**.
 * Não é "pouco uso": é uma escrita que nunca funcionou.
 *
 * `persistirRegistro` grava com
 *   `.upsert({...}, { onConflict: "family_account_id,membro_atipico_id,date" })`
 * e a tabela (0001_init.sql) nasceu com um índice NÃO-ÚNICO e nenhuma
 * constraint que casasse com essa especificação. O Postgres devolve 42P10 e o
 * PostgREST responde **400**, em toda execução.
 *
 * E ninguém soube por meses porque a escrita **não conferia o próprio
 * resultado** — o `error` do upsert era descartado e o fluxo seguia como
 * sucesso. É o padrão exato que o §7 do protocolo proíbe e que produziu o
 * incidente da Rochelle.
 *
 * A consequência não era só telemetria: o orquestrador lê esta tabela para pôr
 * "último check-in" no contexto da Ayla. Sempre vazia, esse contexto sempre
 * foi vazio.
 */

const RAIZ = join(process.cwd(), "..", "..");
const ORQ = readFileSync(
  join(process.cwd(), "src/lib/ayla/orchestrator.ts"),
  "utf8",
);
const MIGRACOES = join(RAIZ, "supabase/migrations");

/**
 * O bloco do upsert do check-in, isolado do resto do arquivo.
 *
 * ⚠️ Começa em "// 1. Daily check-in", e não no `.upsert(`: a captura do erro
 * fica na linha ANTES da chamada, e ancorar no `.upsert(` deixaria justamente
 * o que este arquivo precisa medir fora do recorte.
 */
const INICIO = ORQ.indexOf("// 1. Daily check-in");
const BLOCO = ORQ.slice(INICIO, INICIO + 2000);

/** As colunas que o `onConflict` do código exige que sejam únicas no banco. */
function colunasDoOnConflict(): string[] {
  const m = BLOCO.match(/onConflict:\s*"([^"]+)"/);
  if (!m) throw new Error("onConflict não encontrado no upsert do check-in");
  return m[1].split(",").map((c) => c.trim());
}

function sqlDeTodasAsMigracoes(): string {
  return readdirSync(MIGRACOES)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => readFileSync(join(MIGRACOES, f), "utf8"))
    .join("\n")
    .toLowerCase();
}

describe("O UPSERT DO CHECK-IN TEM ONDE ENCAIXAR", () => {
  it("existe unicidade no banco para EXATAMENTE as colunas do onConflict", () => {
    // ⚠️ ESTE É O TESTE QUE FALHA ANTES DA 0078. Sem a unicidade, o banco
    // devolve 42P10 e o PostgREST devolve 400 — que foi o que a auditoria de
    // produção viu.
    const colunas = colunasDoOnConflict();
    expect(colunas).toEqual(["family_account_id", "membro_atipico_id", "date"]);

    const sql = sqlDeTodasAsMigracoes();
    const declaracoes = sql
      .split(";")
      .filter(
        (s) =>
          s.includes("ayla_daily_checkins") &&
          (s.includes("unique index") || s.includes("unique (") || s.includes("unique(")),
      );

    expect(
      declaracoes.length,
      "nenhuma migração declara unicidade em ayla_daily_checkins — o upsert devolve 400",
    ).toBeGreaterThan(0);

    // A unicidade precisa cobrir as três colunas, na mesma especificação. Uma
    // unicidade só em (family, date) não casa com o onConflict e o 400 volta.
    const casa = declaracoes.some((d) => colunas.every((c) => d.includes(c)));
    expect(casa, `nenhuma unicidade cobre ${colunas.join(", ")}`).toBe(true);
  });

  it("a unicidade é a chave do negócio: uma linha por família, por criança, por dia", () => {
    const sql = sqlDeTodasAsMigracoes();
    expect(sql).toContain("ayla_daily_checkins_familia_membro_dia");
  });
});

describe("A ESCRITA CONFERE O PRÓPRIO RESULTADO (§7)", () => {
  it("o upsert captura o `error` em vez de descartá-lo", () => {
    // Foi o descarte que fez a falha durar meses: `await .upsert(...)` sem
    // olhar o retorno é indistinguível de sucesso.
    expect(BLOCO).toMatch(/const\s*\{\s*error:\s*erroCheckin\s*\}\s*=/);
  });

  it("a falha vira evento PERSISTIDO, não um log que some com a retenção", () => {
    expect(BLOCO).toContain("erroCheckin");
    expect(BLOCO).toContain('kind: "checkin_nao_gravou"');
    expect(BLOCO).toContain('severity: "error"');
  });

  it("mas a falha NÃO derruba o turno — a mãe já recebeu a resposta", () => {
    // Caso I do §12: a correção não pode bloquear o caminho legítimo.
    expect(BLOCO).not.toMatch(/if\s*\(erroCheckin\)\s*\{?\s*(throw|return)/);
  });

  it("SABOTAGEM · voltar a descartar o erro seria pego", () => {
    const sabotado = ORQ.replace(
      "const { error: erroCheckin } = await supabase.from(\"ayla_daily_checkins\").upsert(",
      "await supabase.from(\"ayla_daily_checkins\").upsert(",
    );
    expect(sabotado).not.toMatch(/const\s*\{\s*error:\s*erroCheckin\s*\}/);
    expect(ORQ).toMatch(/const\s*\{\s*error:\s*erroCheckin\s*\}/);
  });
});
