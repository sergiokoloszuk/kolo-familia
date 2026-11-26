import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { gerarParaPlano } from "./gerador";
import { conteudoDemonstrativo } from "./demonstracao";

const m = vi.hoisted(() => ({ contexto: vi.fn(), prompt: vi.fn(), modelo: vi.fn(), fronteira: vi.fn(), copia: vi.fn(), uso: vi.fn() }));
vi.mock("@/lib/ia/engine", () => ({ montarContextoDeSecoes: m.contexto }));
vi.mock("@/lib/ia/prompt", () => ({ assemblePrompt: m.prompt }));
vi.mock("@/lib/ia/provider", () => ({ gerarConversacional: m.modelo, MODELO_CONVERSA: { openai: "modelo-ficticio" } }));
vi.mock("@/lib/conducao/fronteiras", () => ({ fronteiraAtravessada: m.fronteira }));
vi.mock("@/lib/ia/validators", () => ({ validateAntiCopy: m.copia }));
vi.mock("@/lib/billing/logar", () => ({ logarUsoApi: m.uso }));
const relato = "Na hora de começar, quero entender o que ajuda.";
const input = { db: {} as SupabaseClient, auditoria: {} as SupabaseClient, familyId: "f1", membro: { id: "m1", nome: "Fictícia", cadastro: [] }, titulo: "Começar", relato };
beforeEach(() => {
  vi.resetAllMocks();
  m.contexto.mockResolvedValue({ ctx: { membroFoco: { id: "m1", diagnosticoRegistrado: null }, boasPraticas: [{ id: "fonte-sintetica" }] }, roteadas: [] });
  m.prompt.mockReturnValue({ system: [{ text: "CORE EXISTENTE PRESERVADO" }], messages: [{ role: "user", content: "contexto sintético" }] });
  m.modelo.mockResolvedValue({ texto: JSON.stringify(conteudoDemonstrativo(relato)), tokensIn: 100, tokensOut: 50, provider: "openai", model: "modelo-ficticio", ms: 12 });
  m.fronteira.mockReturnValue(null); m.copia.mockReturnValue({ ok: true }); m.uso.mockResolvedValue(undefined);
});
describe("adaptador da Ayla V5.1 — transporte substituído, nenhum modelo real", () => {
  it("reutiliza contexto, prompt e provider, registrando origem interna das referências", async () => {
    const r = await gerarParaPlano(input);
    expect(r.conteudo?.estrategias).toHaveLength(2);
    expect(m.contexto).toHaveBeenCalledTimes(1); expect(m.modelo).toHaveBeenCalledTimes(1);
    expect(m.contexto.mock.calls[0][1]).toMatchObject({ familyId: "f1", membroAtipicoId: "m1" });
    expect(m.modelo.mock.calls[0][0].system).toContain("CORE EXISTENTE PRESERVADO");
    expect(m.uso.mock.calls[0][1]).toMatchObject({ meta: { referencias: ["fonte-sintetica"], aceita: true } });
  });
  it("contexto de outro membro impede chamada ao modelo", async () => {
    m.contexto.mockResolvedValue({ ctx: { membroFoco: { id: "m2" }, boasPraticas: [] }, roteadas: [] });
    await expect(gerarParaPlano(input)).rejects.toThrow(/membro/);
    expect(m.modelo).not.toHaveBeenCalled();
  });
  it("rejeita saída inválida e registra a chamada mesmo assim", async () => {
    m.modelo.mockResolvedValue({ texto: "não é JSON", tokensIn: 100, tokensOut: 10, provider: "openai", model: "modelo-ficticio", ms: 10 });
    await expect(gerarParaPlano(input)).rejects.toThrow(); expect(m.uso).toHaveBeenCalledTimes(1);
  });
  it("proteção clínica não desaparece quando a biblioteca retorna vazia", async () => {
    m.contexto.mockResolvedValue({ ctx: { membroFoco: { id: "m1", diagnosticoRegistrado: null }, boasPraticas: [] }, roteadas: [] });
    m.fronteira.mockReturnValue({ nome: "clinica" });
    await expect(gerarParaPlano(input)).rejects.toThrow(/revista/);
    expect(m.uso.mock.calls[0][1].meta.aceita).toBe(false);
  });
  it("rejeita cópia extensa em vez de apresentar como conteúdo da Ayla", async () => {
    m.copia.mockReturnValue({ ok: false });
    await expect(gerarParaPlano(input)).rejects.toThrow(/fonte/);
  });
  it("conversa recebe somente histórico fornecido no escopo e não gera plano", async () => {
    m.modelo.mockResolvedValue({ texto: "Vamos compreender essa tentativa.", tokensIn: 100, tokensOut: 10, provider: "openai", model: "modelo-ficticio", ms: 10 });
    const r = await gerarParaPlano({ ...input, conversa: [{ papel: "user", texto: "Não ajudou" }] });
    expect(r).toEqual({ texto: "Vamos compreender essa tentativa.", conteudo: null });
    expect(m.modelo.mock.calls[0][0].maxTokens).toBe(2048);
  });
});
