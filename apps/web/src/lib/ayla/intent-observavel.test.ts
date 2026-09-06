import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O CLASSIFICADOR SAI DA INVISIBILIDADE.
 *
 * ⚠️ O QUE ESTAVA ERRADO. `classificarIntencao` roda em TODO turno de WhatsApp
 * e não chamava `logarUsoApi`. PROVEI POR EXECUÇÃO em 15/08/2026: nas 6.000
 * chamadas mais recentes de `api_calls`, a feature `classificar_intencao`
 * aparecia ZERO vezes. Custo e latência dele não existiam em lugar nenhum.
 *
 * E a bancada do mesmo dia MEDIU uma cauda de 12.208 ms em 1 de 30 chamadas,
 * contra p50 de 849 ms. Uma cauda dessas, em produção, era literalmente
 * indetectável: a mãe esperava 12 s e nenhum registro dizia por quê.
 *
 * ⚠️ O RISCO DESTA MUDANÇA é ela mesma virar problema — observabilidade que
 * bloqueia turno, ou que derruba a conversa quando a gravação falha. Os testes
 * abaixo existem sobretudo para isso.
 */

const INTENT = readFileSync(join(process.cwd(), "src/lib/ayla/intent.ts"), "utf8");
const ORQ = readFileSync(join(process.cwd(), "src/lib/ayla/orchestrator.ts"), "utf8");

describe("REGISTRA — o que faltava aparecer", () => {
  it("1. usa o mecanismo existente, não um sistema paralelo", () => {
    expect(INTENT).toContain('from "@/lib/billing/logar"');
    expect(INTENT).toContain('feature: "classificar_intencao"');
    // Nada de tabela nova, nada de logger próprio.
    expect(INTENT).not.toMatch(/from\("[a-z_]*"\)\.insert/);
  });

  it("2. registra modelo, provider e tokens dos dois lados", () => {
    expect(INTENT).toContain("model: AYLA_MODEL");
    expect(INTENT).toContain('provider: "anthropic"');
    expect(INTENT).toContain("input_tokens: resp.usage?.input_tokens ?? 0");
    expect(INTENT).toContain("output_tokens: resp.usage?.output_tokens ?? 0");
  });

  it("3. registra a DURAÇÃO — a coluna que a tabela não tem, e a que faltava", () => {
    // Sem isto, p50/p95/cauda continuam impossíveis de calcular.
    expect(INTENT).toContain("const tModelo = Date.now()");
    expect(INTENT).toContain("const msModelo = Date.now() - tModelo");
    expect(INTENT).toContain("meta: { ms: msModelo }");
  });

  it("4. registra também a FALHA, e ela é distinguível do sucesso", () => {
    // `output_tokens: 0` + `erro` preenchido é o que separa "falhou" de
    // "não rodou". Sem isso, um provider fora do ar aparece só como "a Ayla
    // está mais genérica hoje".
    const blocoCatch = INTENT.slice(INTENT.indexOf("} catch (e) {"));
    expect(blocoCatch).toContain('feature: "classificar_intencao"');
    expect(blocoCatch).toContain("meta: { erro:");
    expect(blocoCatch).toContain("output_tokens: 0");
  });
});

describe("NÃO ATRAPALHA — o turno não paga por ser observável", () => {
  it("5. o registro é fire-and-forget: `void` e sem `await`", () => {
    // Um `await logarUsoApi` colocaria uma ida ao banco no caminho crítico de
    // todo turno — trocaria a cauda invisível por lentidão garantida.
    const ocorrencias = INTENT.split("logarUsoApi(").length - 1;
    expect(ocorrencias).toBe(2); // sucesso e falha
    expect(INTENT).not.toContain("await logarUsoApi");
    expect(INTENT.split("void logarUsoApi(").length - 1).toBe(2);
  });

  it("6. falha de gravação nunca derruba o turno", () => {
    const registros = INTENT.split("void logarUsoApi(").slice(1);
    for (const r of registros) expect(r.slice(0, 400)).toContain(".catch(() => {})");
  });

  it("7. o registro é OPCIONAL — quem não passa supabase/familyId segue igual", () => {
    // Nenhum chamador é obrigado a mudar, e o simulador continua livre.
    expect(INTENT).toContain("if (params.supabase && params.familyId)");
    expect(INTENT).toContain("familyId?: string | null");
  });

  it("8. o orquestrador passa os dois — e é o único que precisa", () => {
    const chamada = ORQ.slice(ORQ.indexOf("await decidirTurno({"), ORQ.indexOf("await decidirTurno({") + 900);
    expect(chamada).toContain("supabase,");
    expect(chamada).toContain("familyId: family.id");
  });
});

describe("NÃO MUDA DECISÃO — instrumentar não é alterar", () => {
  it("9. o retorno continua com os mesmos quatro campos", () => {
    expect(INTENT).toContain("return { intencao, tema, aceite, skills: campos.skills }");
    expect(INTENT).toContain('return { intencao: "outro", tema: anterior, aceite: null, skills: [] }');
  });

  it("10. nenhum parâmetro novo entra no prompt do modelo", () => {
    // `familyId` e `supabase` não podem vazar para o `user` nem para o system —
    // seria dado indevido no prompt, e mudaria a classificação.
    const corpoPrompt = INTENT.slice(INTENT.indexOf("const user = ["), INTENT.indexOf("const client ="));
    expect(corpoPrompt).not.toContain("familyId");
    expect(corpoPrompt).not.toContain("supabase");
  });

  it("11. não registra o TEXTO da família — só custo e tempo", () => {
    // Auditoria sem expor conversa: `meta` leva ms e erro, nunca a mensagem.
    const registros = INTENT.split("void logarUsoApi(").slice(1).map((r) => r.slice(0, 400));
    for (const r of registros) {
      expect(r).not.toContain("texto");
      expect(r).not.toContain("params.texto");
      expect(r).not.toContain("raw");
    }
  });
});

/** SABOTAGEM — cada caso constrói o defeito e prova que ele difere do real. */
describe("SABOTAGEM — os testes mordem?", () => {
  it("S1 · `await` no registro (o caminho crítico volta a pagar)", () => {
    const sabotado = INTENT.split("void logarUsoApi(").join("await logarUsoApi(");
    expect(sabotado).toContain("await logarUsoApi");
    expect(INTENT).not.toContain("await logarUsoApi");
  });

  it("S2 · remover o `.catch` (falha de log derruba conversa)", () => {
    const sabotado = INTENT.split(".catch(() => {})").join("");
    expect(sabotado).not.toContain(".catch(() => {})");
    expect(INTENT).toContain(".catch(() => {})");
  });

  it("S3 · não registrar a duração (a cauda volta a ser invisível)", () => {
    const sabotado = INTENT.split("meta: { ms: msModelo }").join("meta: {}");
    expect(sabotado).not.toContain("meta: { ms: msModelo }");
    expect(INTENT).toContain("meta: { ms: msModelo }");
  });

  it("S4 · registrar o texto da mãe (vazamento de conversa no custo)", () => {
    const sabotado = INTENT.replace("meta: { ms: msModelo }", "meta: { ms: msModelo, texto: params.texto }");
    expect(sabotado).toContain("texto: params.texto");
    const registros = INTENT.split("void logarUsoApi(").slice(1).map((r) => r.slice(0, 400));
    for (const r of registros) expect(r).not.toContain("params.texto");
  });
});

describe("O TIMEOUT — o que ainda NÃO existe, declarado", () => {
  it("12. não há timeout inventado, e isso é deliberado", () => {
    // A missão pediu explicitamente: "não invente timeout arbitrário sem medir
    // e provar comportamento". A instrumentação é o pré-requisito — com
    // `meta.ms` em produção dá para escolher o corte com dado real em vez de
    // palpite. Enquanto isso, NÃO SEI qual é o número certo, e não chuto.
    expect(INTENT).not.toContain("AbortController");
    expect(INTENT).not.toContain("setTimeout");
  });

  it("13. mas o fallback já existe e continua intacto", () => {
    // Se o modelo falhar — inclusive por demora do provider — a conversa segue
    // com o regex decidindo e o tema anterior preservado. Nunca fica muda.
    expect(INTENT).toContain('return { intencao: "outro", tema: anterior, aceite: null, skills: [] }');
  });
});

/** Fecha o loop: o mock prova que o registro roda de fato, não só que existe. */
describe("EXECUÇÃO — o registro acontece", () => {
  const chamadas: unknown[] = [];
  beforeEach(() => {
    chamadas.length = 0;
    vi.doMock("@/lib/billing/logar", () => ({
      logarUsoApi: async (_c: unknown, p: unknown) => {
        chamadas.push(p);
      },
    }));
  });
  afterEach(() => vi.doUnmock("@/lib/billing/logar"));

  it("14. sem supabase/familyId, nada é registrado — e o retorno é o mesmo", async () => {
    const { classificarIntencao } = await import("./intent");
    const r = await classificarIntencao({ texto: "" }); // curto-circuito, sem modelo
    expect(r).toEqual({ intencao: "outro", tema: null, aceite: null, skills: [] });
    expect(chamadas).toHaveLength(0);
  });
});
