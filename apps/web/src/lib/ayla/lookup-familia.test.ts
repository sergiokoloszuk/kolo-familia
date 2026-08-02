import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { encontrarFamiliaPorTelefone, LIMITE_FAMILIAS } from "./orchestrator";

/**
 * A GARANTIA CENTRAL: falha de banco NUNCA vira "número não cadastrado".
 *
 * Caso real (02/08/2026): um número CADASTRADO recebeu silêncio. O log dizia
 * "inbound de número não cadastrado", e havia 47 segundos entre o parse e esse
 * log — a consulta pendurou durante uma instabilidade do banco. O código lia só
 * `data` e descartava `error`: `undefined` virava `[]`, ninguém casava, e uma
 * falha de infraestrutura era reclassificada como fato de negócio.
 */

/** Supabase falso com a cadeia que a busca usa: from→select→not→limit. */
function fake(resultado: { data?: unknown; error?: { message: string } | null }) {
  const api: Record<string, unknown> = {};
  api.select = () => api;
  api.not = () => api;
  api.limit = async () => ({ data: resultado.data ?? null, error: resultado.error ?? null });
  return { from: () => api } as unknown as SupabaseClient;
}

const CADASTRADA = { id: "fam-1", whatsapp_e164: "+5511994770067" };

describe("busca de família — os três desfechos são distintos", () => {
  it("ENCONTRA: número cadastrado, mesmo em formato diferente", async () => {
    const r = await encontrarFamiliaPorTelefone(fake({ data: [CADASTRADA] }), "5511994770067");
    expect(r.tipo).toBe("ok");
    if (r.tipo === "ok") expect(r.familia?.id).toBe("fam-1");
  });

  it("ENCONTRA: legado sem o 9º dígito casa com o cadastro novo", async () => {
    const r = await encontrarFamiliaPorTelefone(fake({ data: [CADASTRADA] }), "+551194770067");
    expect(r.tipo).toBe("ok");
    if (r.tipo === "ok") expect(r.familia?.id).toBe("fam-1");
  });

  it("NÃO CADASTRADO: consulta funcionou e ninguém casa", async () => {
    const r = await encontrarFamiliaPorTelefone(fake({ data: [CADASTRADA] }), "+5511888880000");
    expect(r.tipo).toBe("ok");
    if (r.tipo === "ok") expect(r.familia).toBeNull();
  });

  it("ERRO DE BANCO nunca é confundido com não cadastrado", async () => {
    const r = await encontrarFamiliaPorTelefone(
      fake({ error: { message: "canceling statement due to statement timeout" } }),
      "+5511994770067",
    );
    // A garantia: tipo "erro", NÃO "ok com familia null".
    expect(r.tipo).toBe("erro");
    if (r.tipo === "erro") expect(r.erro).toMatch(/timeout/);
  });

  it("resposta sem erro E sem dados também é falha, não vazio", async () => {
    // Foi exatamente esta forma que produziu o incidente: `data` undefined
    // virando `[]` silenciosamente.
    const r = await encontrarFamiliaPorTelefone(fake({ data: undefined }), "+5511994770067");
    expect(r.tipo).toBe("erro");
  });

  it("lista vazia COM sucesso é 'não cadastrado' de verdade", async () => {
    const r = await encontrarFamiliaPorTelefone(fake({ data: [] }), "+5511994770067");
    expect(r.tipo).toBe("ok");
    if (r.tipo === "ok") expect(r.familia).toBeNull();
  });
});

describe("busca de família — canário de truncamento", () => {
  it("não sinaliza truncamento em volume normal", async () => {
    const r = await encontrarFamiliaPorTelefone(fake({ data: [CADASTRADA] }), "+5511994770067");
    if (r.tipo === "ok") {
      expect(r.truncou).toBe(false);
      expect(r.total).toBe(1);
    }
  });

  it("sinaliza quando encosta no limite — antes de famílias sumirem em silêncio", async () => {
    const cheio = Array.from({ length: LIMITE_FAMILIAS }, (_, i) => ({
      id: `f${i}`,
      whatsapp_e164: `+551199000${String(i).padStart(4, "0")}`,
    }));
    const r = await encontrarFamiliaPorTelefone(fake({ data: cheio }), "+5511994770067");
    expect(r.tipo).toBe("ok");
    if (r.tipo === "ok") expect(r.truncou).toBe(true);
  });

  it("o limite é explícito, não o padrão implícito do PostgREST", () => {
    // O padrão do PostgREST corta em 1000 sem avisar ninguém.
    expect(LIMITE_FAMILIAS).toBeGreaterThan(1000);
  });
});
