import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O DIREITO AO PRIMEIRO TESTE — migração 0084.
 *
 * ⚠️ ESTES TESTES LEEM O SQL, e é uma limitação declarada. O comportamento
 * vive numa função `plpgsql`, e não existe Postgres neste ambiente de teste —
 * então o que dá para prender aqui são as DECISÕES ESTRUTURAIS: a ordem das
 * checagens, a forma do consumo atômico, e as proteções. A prova de
 * COMPORTAMENTO é por execução contra o banco, depois de aplicada, e está
 * descrita no roteiro que acompanha a migração.
 */

const SQL = readFileSync(
  join(process.cwd(), "../../supabase/migrations/0084_trial_legado_elegivel.sql"),
  "utf8",
);
/** Sem comentários: uma explicação não pode passar por implementação. */
const CORPO = SQL.replace(/--[^\n]*/g, "");

describe("a fotografia congelada", () => {
  it("MORDE: são exatamente 96 famílias", () => {
    const linhas = SQL.match(/\('[0-9a-f-]{36}', 'pre_0082_nunca_usou'\)/g) ?? [];
    expect(linhas.length).toBe(96);
  });

  it("MORDE: nenhum id repetido", () => {
    const ids = (SQL.match(/\('([0-9a-f-]{36})'/g) ?? []).map((x) => x.slice(2, -1));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("a PK impede duas elegibilidades para a mesma família", () => {
    expect(CORPO).toMatch(/family_account_id uuid primary key/);
  });

  it("reexecutar a migração não estraga resgates já feitos", () => {
    expect(CORPO).toMatch(/on conflict \(family_account_id\) do nothing/);
  });

  it("MORDE: a tabela tem RLS e nenhuma policy — não é dado de família", () => {
    expect(CORPO).toMatch(/alter table public\.trial_legado_elegivel enable row level security/);
    expect(CORPO).not.toMatch(/create policy/);
  });
});

describe("o fluxo da RPC, na ordem exata", () => {
  /** O corpo do ramo "já existe assinatura". */
  const ramo = (() => {
    // ⚠️ O RECORTE ANCORA NO FIM REAL DO RAMO. A primeira versão terminava num
    // marcador de COMENTÁRIO — e `CORPO` tem os comentários removidos, então o
    // recorte vazava para o fluxo normal e o teste "não insere segunda
    // assinatura" falhava por causa do `insert` do outro caminho.
    const i = CORPO.indexOf("if exists (select 1 from public.subscription_accesses");
    const fim = CORPO.indexOf("return 'legado_iniciado';", i);
    expect(i, "o ramo do legado sumiu").toBeGreaterThan(-1);
    expect(fim, "o ramo não termina em legado_iniciado").toBeGreaterThan(i);
    return CORPO.slice(i, fim);
  })();

  it("MORDE: as três checagens vêm ANTES do consumo", () => {
    // Se o consumo subir, uma família que volta sem consentimento QUEIMA o
    // direito sem ganhar nada — o pior caso possível desta feature.
    const consumo = ramo.indexOf("update public.trial_legado_elegivel");
    expect(consumo).toBeGreaterThan(-1);
    for (const checagem of ["sem_whatsapp", "nao_verificado", "sem_consentimento"]) {
      expect(ramo.indexOf(`'${checagem}'`), checagem).toBeLessThan(consumo);
      expect(ramo.indexOf(`'${checagem}'`), `${checagem} sumiu do ramo do legado`).toBeGreaterThan(-1);
    }
  });

  it("MORDE: o consumo é atômico — update…where…returning, não select-depois-update", () => {
    // A garantia é do Postgres: a segunda chamada bloqueia na linha, relê, e
    // não casa mais no `where`. Não existe janela entre conferir e escrever.
    expect(ramo).toMatch(/update public\.trial_legado_elegivel\s+set redeemed_at = now\(\)\s+where family_account_id = p_family_id\s+and redeemed_at is null\s+returning/);
  });

  it("MORDE: quem perde a corrida sai por ja_existia, sem estender prazo", () => {
    const i = ramo.indexOf("returning family_account_id into v_consumido");
    const depois = ramo.slice(i, i + 200);
    expect(depois).toMatch(/if v_consumido is null then\s+return 'ja_existia';/);
  });

  it("MORDE: ATUALIZA a assinatura, nunca insere uma segunda", () => {
    expect(ramo).toMatch(/update public\.subscription_accesses/);
    expect(ramo).not.toMatch(/insert into public\.subscription_accesses/);
  });

  it("concede exatamente 7 dias, a partir de agora", () => {
    expect(ramo).toMatch(/trial_ends_at = now\(\) \+ interval '7 days'/);
  });

  it("MORDE: reconfere o estado ATUAL, não confia só na lista congelada", () => {
    // A fotografia é de 27/08. Entre lá e o resgate a família pode ter
    // assinado ou ganhado cortesia.
    for (const p of ["status = 'active'", "stripe_customer_id is not null", "stripe_subscription_id is not null", "cortesia = true"]) {
      expect(ramo, p).toContain(p);
    }
  });

  it("MORDE: quem não está na lista sai por ja_existia — o caminho normal não muda", () => {
    expect(ramo).toMatch(/if not v_elegivel then\s+return 'ja_existia';/);
  });
});

describe("o caminho normal ficou intacto", () => {
  it("os quatro motivos originais continuam existindo", () => {
    for (const m of ["familia_inexistente", "sem_whatsapp", "nao_verificado", "sem_consentimento", "iniciado", "ja_existia"]) {
      expect(CORPO, m).toContain(`'${m}'`);
    }
  });

  it("MORDE: quem NÃO tem assinatura ainda cai no insert de sempre", () => {
    const i = CORPO.lastIndexOf("insert into public.subscription_accesses");
    expect(i).toBeGreaterThan(-1);
    expect(CORPO.slice(i, i + 200)).toMatch(/'trialing', now\(\) \+ interval '7 days'/);
  });

  it("o novo motivo é o único acréscimo ao vocabulário", () => {
    const motivos = new Set((CORPO.match(/return '([a-z_]+)'/g) ?? []).map((x) => x.slice(8, -1)));
    expect(motivos).toEqual(new Set([
      "familia_inexistente", "sem_whatsapp", "nao_verificado",
      "sem_consentimento", "iniciado", "ja_existia", "legado_iniciado",
    ]));
  });
});

describe("o TypeScript conhece o novo motivo", () => {
  const TS = readFileSync(join(process.cwd(), "src/lib/trial/iniciar.ts"), "utf8");

  it("`legado_iniciado` está no tipo", () => {
    expect(TS).toMatch(/\|\s*"legado_iniciado"/);
  });

  it("MORDE: conta como trial INICIADO, não como recusa", () => {
    expect(TS).toMatch(/iniciado: motivo === "iniciado" \|\| motivo === "legado_iniciado"/);
  });

  it("MORDE: não vira alerta de motivo inesperado", () => {
    const i = TS.indexOf("RECUSAS_LEGITIMAS.has(motivo)");
    expect(TS.slice(i, i + 220)).toContain('motivo !== "legado_iniciado"');
  });
});
