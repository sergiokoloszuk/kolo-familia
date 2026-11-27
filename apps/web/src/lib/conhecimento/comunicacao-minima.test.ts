import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { recuperarBoasPraticas, blocoBoasPraticas } from "./recuperar";
import { montarRastro } from "./rastro";
import { BancoMemoria } from "@/lib/ayla/__harness/banco-memoria";
import { APOIO_AO_ADULTO, PISO, SEGURANCA_COMPARTILHADA, nucleoConducao } from "@/lib/conducao/diretrizes";
import { VOZ_LIMITES_E_FRONTEIRA } from "@/lib/ia/prompt";
import { AYLA_EXPERIMENTAL_PROMPT } from "@/lib/ayla/experimental-prompt";

type BP = Record<string, unknown>;
function banco(rows: BP[], erroFase?: number) {
  const db = new BancoMemoria(); db.semear("boas_praticas", rows);
  const from = db.from.bind(db); const ors: string[] = []; let fase = 0;
  db.from = (t) => {
    const q = from(t); const atual = ++fase;
    q.or = (filtro = "") => {
      ors.push(filtro);
      const termos = [...filtro.matchAll(/(skills_relacionadas|tags)\.cs\.(\["[^"\\]*"\])/g)]
        .map(m => [m[1], JSON.parse(m[2])[0]]);
      return q.in("id", rows.filter(r => termos.some(([k, v]) => (r[k] as string[] ?? []).includes(v))).map(r => r.id));
    };
    if (atual === erroFase) {
      q.then = <A, B = never>(
        ok?: ((v: {data: unknown; error: unknown}) => A | PromiseLike<A>) | null,
        fail?: ((e: unknown) => B | PromiseLike<B>) | null,
      ): PromiseLike<A | B> => Promise.resolve({data: null, error: {message:"falha fictícia"}}).then(ok, fail);
    }
    return q;
  };
  return { db: db as unknown as SupabaseClient, ors };
}
const fixture = (id: string, tag: string): BP => ({id, titulo: id, status: "ativo", tags: [tag], skills_relacionadas: [], peso_relevancia: .7, versao_conversa: "Orientação fictícia"});
const patches = JSON.parse(readFileSync(resolve(process.cwd(), "../../data/curadoria/comunicacao-minima-20261126.json"), "utf8")) as Array<{id: string; alteracoes: BP}>;
const curadas = patches.map(p => ({...fixture(p.id, ""), ...p.alteracoes}));

describe("tags editoriais: correspondência exata e consulta limitada", () => {
  it.each(["comunicação", "saúde mental", "pré-escolar", "leite materno/fórmula"])("preserva %s", async tag => {
    const {db, ors} = banco([fixture("positivo", tag)]);
    const r = await recuperarBoasPraticas({supabase: db, skills: [], tags: [tag]});
    expect(r.map(x => x.id)).toEqual(["positivo"]); expect(ors[0]).toContain(JSON.stringify([tag]));
  });
  it.each(['x"],status.eq.ativo', "x,y", "x\ny", "x\\y", "x);id.gt.0", "x".repeat(121)])("rejeita expressão inválida sem consultar: %s", async tag => {
    const {db, ors} = banco([fixture("negativo", tag)]);
    expect(await recuperarBoasPraticas({supabase: db, skills: [], tags: [tag]})).toEqual([]); expect(ors).toEqual([]);
  });
  it("mantém slugs restritos e teto de 12 tags", async () => {
    const {db, ors} = banco([]);
    await recuperarBoasPraticas({supabase: db, skills: ['x",status.eq.ativo'], tags: Array.from({length: 20}, (_, i) => `tag ${i}`)});
    expect(ors[0].match(/tags\.cs/g)).toHaveLength(12); expect(ors[0]).not.toContain("skills_relacionadas");
  });
});
describe("curadoria local: positivos e negativos", () => {
  it("não oferece as duas BPs como repertório genérico de comunicação", async () => {
    const {db} = banco(curadas);
    expect(await recuperarBoasPraticas({supabase: db, skills: ["comunicacao"], idade: 4})).toEqual([]);
  });
  it.each([["rotina", patches[0].id], ["emocional", patches[1].id]])("preserva o positivo %s", async (skill, id) => {
    const {db} = banco(curadas);
    expect((await recuperarBoasPraticas({supabase: db, skills: [skill], idade: 4})).map(x => x.id)).toEqual([id]);
  });
  it("o recorte editorial literal não infantiliza adolescentes", async () => {
    const {db} = banco(curadas);
    expect(await recuperarBoasPraticas({supabase: db, skills: ["rotina", "emocional"], idade: 16})).toEqual([]);
  });
  it("idade desconhecida continua incerta e recuperável", async () => {
    const {db} = banco(curadas);
    expect(await recuperarBoasPraticas({supabase: db, skills: ["rotina"], idade: null})).toHaveLength(1);
  });
});
describe("erros e crenças não viram fatos", () => {
  it("distingue falha de consulta de acervo vazio", async () => {
    const falhou = vi.fn(); const {db} = banco([], 1);
    expect(await recuperarBoasPraticas({supabase: db, skills: ["comunicacao"], aoFalhar: falhou})).toEqual([]);
    expect(falhou).toHaveBeenCalledOnce();
    expect(montarRastro({canal:"whatsapp", familyId:null, membroId:null, skills:["comunicacao"], recuperadas:[], enviadas:[], erroNaConsulta:true}).motivoVazio).toBe("erro_na_consulta");
    expect(montarRastro({canal:"whatsapp", familyId:null, membroId:null, skills:["comunicacao"], recuperadas:[], enviadas:[]}).motivoVazio).toBe("acervo_vazio");
  });
  it("preserva a BP leve e sinaliza falha no detalhe", async () => {
    const falhou = vi.fn(); const {db} = banco([fixture("leve", "comunicação")], 2);
    expect((await recuperarBoasPraticas({supabase:db, skills:[], tags:["comunicação"], aoFalhar:falhou})).map(x=>x.id)).toEqual(["leve"]);
    expect(falhou).toHaveBeenCalledOnce();
  });
  it("permite reflexão respeitosa somente como hipótese apoiada no relato", () => {
    const b = blocoBoasPraticas([{id:"x", titulo:"x", versao_conversa:null, quando_usar:null, erros_comuns:[], passos_praticos:[], atividades_praticas:[], crenca_adulto:"Não fala, não compreende"}]);
    expect(b).toContain("quando houver apoio no relato"); expect(b).toContain("sem corrigir de forma seca"); expect(b).not.toContain("NÃO diga isso a ela");
  });
});
describe("uma regra por prompt e proteção independente de BPs", () => {
  it("as seis linhas entram uma vez no núcleo e no fallback", () => {
    for (const p of [nucleoConducao(), AYLA_EXPERIMENTAL_PROMPT]) for (const l of APOIO_AO_ADULTO.split("\n")) expect(p.split(l)).toHaveLength(2);
  });
  it.each([PISO, VOZ_LIMITES_E_FRONTEIRA, AYLA_EXPERIMENTAL_PROMPT])("compartilha segurança sem resposta exclusiva ao CVV", p => {
    expect(p).toContain(SEGURANCA_COMPARTILHADA); expect(p).toContain("não adie ajuda imediata");
    expect(p).not.toContain("responda APENAS"); expect(p).toContain("Esgotamento, sozinho, não comprova risco");
  });
});
