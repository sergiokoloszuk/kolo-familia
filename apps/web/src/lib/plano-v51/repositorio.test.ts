import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { inserirPlanoV51, gravarEventosPlano, lerPlano, listarPlanosV51 } from "./repositorio";
import { conteudoDemonstrativo } from "./demonstracao";
import { lerPlanoV51, MARCADOR_V51, secoesDoPlano } from "./contrato";

const familyId = randomUUID(), membroId = randomUUID(), agora = "2026-11-26T15:00:00Z";
type Row = Record<string, unknown>;
function banco() {
  const rows: Row[] = [], chamadas: { table: string; op: string; filtros: unknown[] }[] = [];
  const falhas = { leitura: false, escrita: false, descartar: false, corrida: false, falhaDepoisDeGravar: false };
  const subset = (a: unknown, b: unknown): boolean => {
    if (Array.isArray(b)) return Array.isArray(a) && b.every(x => a.some(y => subset(y, x)));
    if (b && typeof b === "object") return !!a && typeof a === "object" && Object.entries(b).every(([k, v]) => subset((a as Row)[k], v));
    return a === b;
  };
  const db = { from(table: string) {
    let op = "read", payload: Row = {}; const filtros: [string, string, unknown][] = [];
    const executar = (single: boolean) => {
      chamadas.push({ table, op, filtros: structuredClone(filtros) });
      if (falhas.leitura && op === "read") return { data: null, error: { message: "read failure" } };
      if (falhas.escrita && op !== "read") return { data: null, error: { message: "write failure" } };
      if (op === "insert") {
        if (rows.some(r => r.id === payload.id)) return { data: null, error: { code: "23505" } };
        if (!falhas.descartar) rows.push(structuredClone(payload));
        if (falhas.falhaDepoisDeGravar) return { data: null, error: { message: "timeout" } };
        return { data: { id: payload.id }, error: null };
      }
      const selecionadas = rows.filter(r => filtros.every(([kind, campo, valor]) => kind === "eq" ? r[campo] === valor : subset(r[campo], valor)));
      if (op === "update") {
        if (falhas.corrida) return { data: null, error: null };
        if (!falhas.descartar) selecionadas.forEach(r => Object.assign(r, structuredClone(payload)));
        if (falhas.falhaDepoisDeGravar) return { data: null, error: { message: "timeout" } };
      }
      return { data: single ? structuredClone(selecionadas[0] ?? null) : structuredClone(selecionadas), error: null };
    };
    const query = {
      select() { return query; }, eq(k: string, v: unknown) { filtros.push(["eq", k, v]); return query; },
      contains(k: string, v: unknown) { filtros.push(["contains", k, v]); return query; }, order() { return query; }, limit() { return query; },
      insert(p: Row) { op = "insert"; payload = p; return query; }, update(p: Row) { op = "update"; payload = p; return query; },
      maybeSingle: async () => executar(true), single: async () => executar(true),
      then(resolve: (r: ReturnType<typeof executar>) => unknown) { return Promise.resolve(executar(false)).then(resolve); },
    }; return query;
  } } as unknown as SupabaseClient;
  return { db, rows, chamadas, falhas };
}
async function novo(b: ReturnType<typeof banco>, id = randomUUID(), child = membroId, fam = familyId) {
  const relato = "Na lição, quero entender o começo.";
  return inserirPlanoV51(b.db, { familyId: fam, membro: { id: child, nome: "Criança fictícia", cadastro: [] }, requisicaoId: id, titulo: "Lição", relato, conteudo: conteudoDemonstrativo(relato), agora });
}
const lote = (id: string, revisao = 0) => ({ planoId: id, membroId, revisao, eventos: [{ id: randomUUID(), acao: { tipo: "avancar" } }] });

describe("Plano V5.1 — escrita e leitura controladas, sem produção", () => {
  it("grava em planos.secoes existente, lê de volta e retoma estado", async () => {
    const b = banco(), p = await novo(b), a = lote(p.id);
    const salvo = await gravarEventosPlano(b.db, familyId, a, agora);
    expect(salvo.passo).toBe(1); expect(salvo.revisao).toBe(1);
    expect(await lerPlano(b.db, familyId, membroId, p.id)).toEqual(salvo);
    expect(b.chamadas.every(c => c.table === "planos")).toBe(true);
  });
  it("preserva planos antigos sem converter ou sobrescrever", async () => {
    const b = banco(), legado = { id: randomUUID(), family_account_id: familyId, membro_atipico_id: membroId, secoes: [{ tipo: "entender", titulo: "Antes", conteudo_markdown: "Texto anterior" }] };
    b.rows.push(legado); const copia = structuredClone(legado);
    await novo(b);
    await expect(gravarEventosPlano(b.db, familyId, lote(legado.id), agora)).rejects.toThrow(/encontrado/);
    expect(legado).toEqual(copia); expect(await listarPlanosV51(b.db, familyId)).toHaveLength(1);
  });
  it("isola família, criança e plano", async () => {
    const b = banco(), p = await novo(b), outroFilho = randomUUID(), outroPlano = await novo(b, randomUUID(), outroFilho), outraFamilia = randomUUID();
    await novo(b, randomUUID(), randomUUID(), outraFamilia);
    const antes = structuredClone(b.rows);
    await expect(gravarEventosPlano(b.db, outraFamilia, lote(p.id), agora)).rejects.toThrow();
    await expect(gravarEventosPlano(b.db, familyId, { ...lote(p.id), membroId: outroFilho }, agora)).rejects.toThrow();
    expect(b.rows).toEqual(antes);
    await gravarEventosPlano(b.db, familyId, lote(p.id), agora);
    expect((await lerPlano(b.db, familyId, outroFilho, outroPlano.id)).revisao).toBe(0);
    expect(await listarPlanosV51(b.db, familyId)).toHaveLength(2);
  });
  it("não confirma criação que não ficou no banco", async () => {
    const b = banco(); b.falhas.descartar = true;
    await expect(novo(b)).rejects.toThrow(/ler/); expect(b.rows).toHaveLength(0);
  });
  it("não confirma update com erro nem sem mudança efetiva", async () => {
    const b = banco(), p = await novo(b);
    b.falhas.escrita = true;
    await expect(gravarEventosPlano(b.db, familyId, lote(p.id), agora)).rejects.toThrow(/confirmar/);
    b.falhas.escrita = false; b.falhas.descartar = true;
    await expect(gravarEventosPlano(b.db, familyId, lote(p.id), agora)).rejects.toThrow(/confirmada/);
    expect((await lerPlano(b.db, familyId, membroId, p.id)).revisao).toBe(0);
  });
  it("gravação parcial seguida de retry não duplica eventos", async () => {
    const b = banco(), p = await novo(b), a = lote(p.id); b.falhas.falhaDepoisDeGravar = true;
    await expect(gravarEventosPlano(b.db, familyId, a, agora)).rejects.toThrow();
    b.falhas.falhaDepoisDeGravar = false;
    const retomado = await gravarEventosPlano(b.db, familyId, a, agora);
    expect(retomado.eventos).toHaveLength(1); expect(retomado.revisao).toBe(1);
  });
  it("CAS recusa update concorrente sem sobrescrever", async () => {
    const b = banco(), p = await novo(b); b.falhas.corrida = true;
    await expect(gravarEventosPlano(b.db, familyId, lote(p.id), agora)).rejects.toThrow(/confirmada/);
    expect((await lerPlano(b.db, familyId, membroId, p.id)).revisao).toBe(0);
    expect(b.chamadas.find(c => c.op === "update")?.filtros).toContainEqual(["contains", "secoes", [{ tipo: MARCADOR_V51, revisao: 0 }]]);
  });
  it("revisão antiga não desfaz alterações posteriores", async () => {
    const b = banco(), p = await novo(b); await gravarEventosPlano(b.db, familyId, lote(p.id), agora);
    await expect(gravarEventosPlano(b.db, familyId, lote(p.id), agora)).rejects.toThrow(/mudou/);
  });
  it("criação repetida preserva um único plano", async () => {
    const b = banco(), id = randomUUID(); const p = await novo(b, id);
    expect(await novo(b, id)).toEqual(p); expect(b.rows).toHaveLength(1);
  });
  it("não mascara falha de leitura como lista vazia", async () => {
    const b = banco(); b.falhas.leitura = true;
    await expect(listarPlanosV51(b.db, familyId)).rejects.toThrow(/carregar/);
  });
  it("recusa origem WhatsApp forjada no browser e ativação de envio", async () => {
    const b = banco(), p = await novo(b);
    for (const acao of [{ tipo: "lembrete", disponivel: true, canal: "WhatsApp", frequencia: "diária", horario: "17:00" }, { tipo: "registrar", registro: { id: randomUUID(), tipo: "tentativa", origem: "whatsapp", relato: "Mensagem", estrategiaId: "demo-primeiro-passo", resultado: "ajudou" } }]) {
      await expect(gravarEventosPlano(b.db, familyId, { ...lote(p.id), eventos: [{ id: randomUUID(), acao }] }, agora)).rejects.toThrow();
    }
    expect((await lerPlano(b.db, familyId, membroId, p.id)).registros).toEqual([]);
  });
  it("envelope adulterado não autoriza membro/família diferente", async () => {
    const b = banco(), p = await novo(b);
    b.rows[0].secoes = secoesDoPlano({ ...p, membroId: randomUUID() });
    await expect(lerPlano(b.db, familyId, membroId, p.id)).rejects.toThrow();
    expect(lerPlanoV51([{ tipo: "entender" }])).toBeNull();
  });
});
