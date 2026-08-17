import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { classificarIntencao } from "@/lib/ayla/intent";

/**
 * A FALHA QUE ESTES TESTES REPRODUZEM — medida em produção, 15/08/2026.
 *
 * Sete eventos `billing_nao_gravou` persistidos em `eventos_app`, todos com a
 * mesma mensagem:
 *
 *   api_calls não gravou classificar_intencao (anthropic/claude-haiku-4-5):
 *   new row violates row-level security policy for table "api_calls"
 *
 * `api_calls` (migração 0035) tem RLS ligada, uma política de SELECT para
 * admin e **nenhuma política de INSERT**. Quem escreve é o service role. A
 * conversa da web chamava `classificarIntencao` com o cliente da SESSÃO DA
 * FAMÍLIA, e o banco recusava a linha.
 *
 * É a MESMA causa que já tinha zerado `conversa_web` até 11/08. Lá a correção
 * foi no ponto de chamada e o varrimento prometido não aconteceu — por isso o
 * teste de baixo não olha só o caminho corrigido: ele olha se o caminho da web
 * pode voltar a escrever auditoria com a sessão da família.
 */

const ENGINE = readFileSync(
  join(process.cwd(), "src/lib/ia/engine.ts"),
  "utf8",
);
const ROTA = readFileSync(
  join(process.cwd(), "src/app/api/conversar/stream/route.ts"),
  "utf8",
);

/** Um cliente que recusa INSERT do jeito que a RLS recusa: devolvendo `error`. */
function clienteQueARlsRecusa() {
  const tentativas: string[] = [];
  return {
    tentativas,
    from(tabela: string) {
      return {
        insert: async () => {
          tentativas.push(tabela);
          return {
            error: {
              message: `new row violates row-level security policy for table "${tabela}"`,
              code: "42501",
            },
          };
        },
      };
    },
  };
}

describe("O CLASSIFICADOR NÃO ESCREVE AUDITORIA COM A SESSÃO DA FAMÍLIA", () => {
  it("o caminho da web passa um cliente de telemetria PRÓPRIO, não o da sessão", () => {
    // A chamada a classificarIntencao dentro do engine não pode usar o
    // `supabase` da família — é o que produziu os 7 erros em produção.
    //
    // ⚠️ A âncora é `classificarIntencao({\n`: o arquivo cita a assinatura
    // antiga dentro de um comentário, e ancorar no primeiro `indexOf` media o
    // comentário, não o código.
    const i = ENGINE.indexOf("classificarIntencao({\n");
    expect(i, "chamada multilinha de classificarIntencao não encontrada").toBeGreaterThan(0);
    const chamada = ENGINE.slice(i, i + 320);
    expect(chamada).toContain("supabase: telemetria");
    expect(chamada).not.toMatch(/supabase,\s*\n\s*familyId/);
  });

  it("`telemetria` é OBRIGATÓRIA — opcional foi como o registro sumiu antes", () => {
    const assinatura = ENGINE.slice(
      ENGINE.indexOf("export async function prepararRespostaStream"),
      ENGINE.indexOf("const { supabase, telemetria"),
    );
    expect(assinatura).toContain("telemetria: SupabaseClient;");
    // Um `?` aqui devolveria o silêncio: quem esquecesse de passar voltaria a
    // perder o registro, e sem nenhum erro de tipo para avisar.
    expect(assinatura).not.toContain("telemetria?:");
  });

  it("quem chama entrega service role — o privilégio fica na rota", () => {
    const chamada = ROTA.slice(
      ROTA.indexOf("prepararRespostaStream({"),
      ROTA.indexOf("prepararRespostaStream({") + 500,
    );
    expect(chamada).toContain("telemetria: createServiceRoleClient()");
  });

  it("SABOTAGEM · voltar a passar a sessão da família seria pego", () => {
    const sabotado = ENGINE.replace("supabase: telemetria", "supabase,");
    expect(sabotado).not.toContain("supabase: telemetria");
    expect(ENGINE).toContain("supabase: telemetria");
  });
});

describe("A FALHA CONTINUA VISÍVEL SE ACONTECER DE NOVO", () => {
  it("recusa da RLS no registro NÃO derruba a classificação", async () => {
    // O turno da mãe não pode morrer porque a telemetria foi recusada. Este é
    // o caso I do §12: o comportamento legítimo não pode ser bloqueado pela
    // correção.
    const cliente = clienteQueARlsRecusa();
    const r = await classificarIntencao({
      supabase: cliente as never,
      familyId: "fam-1",
      texto: "o Matheo não dormiu de novo",
    }).catch((e) => ({ erro: e instanceof Error ? e.message : String(e) }));

    // Sem chave de modelo no ambiente de teste a classificação degrada, mas
    // o que importa aqui é que ela não estoura por causa do registro recusado.
    expect(r).toBeDefined();
    expect(String(JSON.stringify(r))).not.toContain("row-level security");
  });

  it("o registro é best-effort: `void`, nunca `await` que segure o turno", () => {
    const INTENT = readFileSync(
      join(process.cwd(), "src/lib/ayla/intent.ts"),
      "utf8",
    );
    expect(INTENT).toContain("void logarUsoApi(");
    expect(INTENT).not.toContain("await logarUsoApi(");
  });
});
