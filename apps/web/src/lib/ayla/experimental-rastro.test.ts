import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { montarMundo, type Mundo } from "./__harness/cenario";

const h = vi.hoisted(() => ({ eventos: [] as Array<Record<string, unknown>>, prompts: [] as string[] }));
vi.mock("@/lib/log", () => ({ logEvent: async (e: Record<string, unknown>) => {h.eventos.push(e);} }));
vi.mock("@/lib/ia/provider", () => ({
  MODELO_CONVERSA: {openai:"modelo-ficticio", anthropic:"modelo-ficticio"},
  providerConversacionalParaFamilia: () => "openai",
  gerarConversacional: async (p: {system: string}) => {
    h.prompts.push(p.system);
    return {texto:JSON.stringify({fala:"Vamos compreender o que aconteceu, sem atribuir intenção.", campo_investigado:null}), tokensIn:10, tokensOut:10, ms:1, provider:"openai", model:"modelo-ficticio", cacheRead:0, cacheWrite:0};
  },
}));
import { responderExperimental } from "./experimental";
import { esquecerCacheDeDocumentos } from "./documentos";

function mundo(): Mundo {
  return montarMundo({telefone:"+5500000000000", nomeMae:"Responsável fictícia", criancas:[{nome:"Criança fictícia", nascimento:"2022-04-10"}]});
}
async function responder(m: Mundo, catalogo = true) {
  return responderExperimental(m.db as unknown as SupabaseClient, {
    familyId:m.familyId, mensagem:"Não responde quando chamo.", origem:"simulador", membroPreferidoId:Object.values(m.membros)[0],
    turnoClassificado:{intencao:"duvida", tema:"comunicacao", aceite:null, skills:catalogo?["comunicacao"]:[], skillsAvaliadas:catalogo},
  });
}
const rastros = () => h.eventos.filter(e => e.kind === "conhecimento_consultado").map(e=>e.payload as Record<string, unknown>);
beforeEach(()=>{h.eventos.length=0;h.prompts.length=0;esquecerCacheDeDocumentos();});
describe("rastro no gerador oficial do WhatsApp", () => {
  it("registra os mesmos IDs do repertório realmente passado à geração", async () => {
    const m=mundo();m.db.semear("boas_praticas",[{id:"bp-ficticia",titulo:"Conhecimento fictício", status:"ativo", skills_relacionadas:["comunicacao"],versao_conversa:"Conteúdo de referência fictício."}]);
    expect(await responder(m)).not.toBeNull();expect(h.prompts).toHaveLength(1);
    expect(h.prompts[0]).toContain("Conteúdo de referência fictício.");
    expect(rastros()).toHaveLength(1);expect(rastros()[0]).toMatchObject({canal:"whatsapp", recuperados:["bp-ficticia"], enviados:["bp-ficticia"], erro_na_consulta:false});
    expect(rastros()[0].turno_id).toEqual(expect.any(String));
    expect(JSON.stringify(rastros())).not.toContain("Não responde quando chamo");
  });
  it("acervo vazio não vira erro", async () => {
    expect(await responder(mundo())).not.toBeNull();expect(rastros()[0]).toMatchObject({motivo_vazio:"acervo_vazio", recuperados:[], enviados:[], erro_na_consulta:false});
  });
  it("falha de leitura continua respondendo e registra erro, não vazio legítimo", async () => {
    const m=mundo(), from=m.db.from.bind(m.db);
    m.db.from=t=>{if(t==="boas_praticas")throw Error("Falha fictícia de consulta");return from(t);};
    expect(await responder(m)).not.toBeNull();expect(rastros()[0]).toMatchObject({motivo_vazio:"erro_na_consulta", erro_na_consulta:true, enviados:[]});
  });
  it("catálogo indisponível permanece distinto de nada pertinente", async () => {
    expect(await responder(mundo(), false)).not.toBeNull();expect(rastros()[0]).toMatchObject({motivo_vazio:"catalogo_indisponivel", enviados:[]});
  });
});
