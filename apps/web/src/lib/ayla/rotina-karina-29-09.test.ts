import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { temaJaDitoNoHistorico } from "./rotina-guiada";
import type { SupabaseClient } from "@supabase/supabase-js";

const ORCH = readFileSync(new URL("./orchestrator.ts", import.meta.url), "utf8");
const GUIADA = readFileSync(new URL("./rotina-guiada.ts", import.meta.url), "utf8");

describe("Karina 29/09 — clarificação não pergunta a mesma criança de novo", () => {
  it("a criança respondida prevalece sobre o gênero do áudio original", () => {
    const alvo = ORCH.slice(ORCH.indexOf("const alvoDaRotina ="), ORCH.indexOf("// 3c-rotina-ver."));
    expect(alvo.indexOf("if (retomada?.membroId")).toBeLessThan(alvo.indexOf("resolverMembroAlvo({"));
    expect(alvo).toContain("ctxR.membros.some((m) => m.id === retomada.membroId)");
    expect(alvo).toContain("return { membroId: retomada.membroId, ambiguo: null }");
  });

  it("pedido ambíguo de organização nomeando rotina chega ao condutor, sem abrir desabafo", () => {
    expect(ORCH).toContain('(intent === "organizacao" && portao.nomeou && portao.ato === "ambiguo")');
    expect(ORCH).toContain("const r = await conduzirRotina(supabase");
  });

  it("pedido genérico de nova rotina preserva a criança da conversa em foco", () => {
    const rotina = ORCH.slice(ORCH.indexOf("A conversa atual é contexto legítimo"), ORCH.indexOf("const r = await conduzirRotina"));
    expect(rotina).toContain("const alvo = alvoDaRotina(ctxR, rotinaConversa?.membroId ?? membroConversa)");
  });
});

describe("tema de outra rotina não contamina a pendente", () => {
  it("busca somente mensagens posteriores à criação do artefato", async () => {
    let desde = "";
    const db = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              gte: (_campo: string, data: string) => {
                desde = data;
                return { order: () => ({ limit: async () => ({ data: [] }) }) };
              },
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;
    const criadoEm = new Date(Date.now() - 60_000).toISOString();
    await temaJaDitoNoHistorico(db, "familia", criadoEm);
    expect(desde).toBe(criadoEm);
    expect(GUIADA).toContain("temaJaDitoNoHistorico(supabase, familyId, pendente.criadaEm)");
  });

  it("erro ao salvar tema não autoriza prometer cartões", () => {
    expect(GUIADA).toContain("if (erroTema) {");
    expect(GUIADA.indexOf("if (erroTema) {")).toBeLessThan(GUIADA.indexOf("rastro.geracao_iniciada = false"));
  });
});
