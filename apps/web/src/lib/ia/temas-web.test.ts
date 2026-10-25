import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { BancoMemoria } from "@/lib/ayla/__harness/banco-memoria";
import { GUIAS_TEMATICOS } from "@/lib/conducao/temas-conversa";
import { secoesDe } from "@/lib/conducao/base2";
import type { ContextoSkillResposta } from "./context";
import type { SkillRow } from "./router";

const mock = vi.hoisted(() => ({ context: vi.fn(), classify: vi.fn(), route: vi.fn(), load: vi.fn() }));
vi.mock("./context", () => ({ buildContext: mock.context }));
vi.mock("./intencao", () => ({ classificarIntencao: mock.classify }));
vi.mock("./router", () => ({ loadActiveSkills: mock.load, routeSkillsAI: mock.route }));
import { prepararRespostaStream } from "./engine";

const skills = GUIAS_TEMATICOS.map((g) => ({ id: g.chave, name: g.chave, display_name: g.nome,
  objective: g.proposito, tone: "acolhedor", scope: g.consultar, limits: "não inventar",
  kolo_vivo_fields: [], knowledge_tags: [], routing_keywords: [], routing_priority: 1, fallback_questions: [],
})) satisfies SkillRow[];
const original = process.env.AYLA_QUALIDADE_RESPOSTA_V2;
let ctx: ContextoSkillResposta;
beforeEach(() => {
  process.env.AYLA_QUALIDADE_RESPOSTA_V2 = "on";
  vi.clearAllMocks();
  ctx = { membroFoco: { id: "m1", nome: "Nora", idade: 19, perfil: "adulta", genero: "feminino",
    diagnosticoRegistrado: null, secoes: { como_e: "Gosta de cinema", nutricional: "Aceita arroz, frango e batata" } },
    cuidador: null, membros: [], familia: {}, diariosRecentes: [], ultimoCheckin: null,
    boasPraticas: [], base2: [], perfilConsultavel: null, historico: [{ papel: "assistant", conteudo: "Podemos pensar juntas na refeição." }] };
  mock.load.mockResolvedValue(skills);
  mock.route.mockResolvedValue([{ skill: skills.find((s) => s.name === "nutricional"), score: 99, matchedKeywords: [] }]);
  mock.context.mockImplementation(async () => ({ ...ctx, historico: [...ctx.historico] }));
  mock.classify.mockResolvedValue({ intencao: "desafio", tema: "nutricional", aceite: null, trocaTema: null });
});
afterEach(() => { if (original == null) delete process.env.AYLA_QUALIDADE_RESPOSTA_V2; else process.env.AYLA_QUALIDADE_RESPOSTA_V2 = original; });
const rodar = (area = "nutricional", userInput = "Quero ajuda na alimentação") => {
  const db = new BancoMemoria();
  return prepararRespostaStream({ supabase: db.cliente(), telemetria: db.cliente(), familyId: "f1",
    membroAtipicoId: "m1", conversaId: "c1", userInput, temaEscolhido: area });
};
describe("conversa temática pelo engine e compositor reais (classificador/contexto simulados)", () => {
  it("entrega perfil, biblioteca identificável e contrato rico ao produtor", async () => {
    const r = await rodar();
    const system = r.system.map((s) => s.text).join("\n");
    const messages = JSON.stringify(r.messages);
    expect(system).toContain("<forma_da_conversa_ayla>");
    expect(system).toContain("Alimentação Positiva");
    expect(messages).toContain("Nora");
    expect(messages).toContain("Aceita arroz, frango e batata");
    expect(messages).toContain("Podemos pensar juntas na refeição");
    expect(r.base2Ids.length).toBeGreaterThan(0);
    r.base2Ids.forEach((id) => {
      const secao = secoesDe({ tema: "nutricional", estado: "investigacao", limite: 40 }).find((s) => s.id === id)!;
      expect(messages).toContain(secao.titulo);
    });
    expect(mock.context).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ membroAtipicoId: "m1", familyId: "f1" }));
  });
  it("a entrada de uma área leva a nota de abertura; caso concreto e off não levam", async () => {
    const entrada = await rodar("nutricional", "Quero explorar Alimentação Positiva.");
    expect(JSON.stringify(entrada.messages)).toContain("<abertura_de_area>");
    expect(JSON.stringify(entrada.messages)).toContain("Aceita arroz, frango e batata");
    expect(JSON.stringify((await rodar()).messages)).not.toContain("<abertura_de_area>");
    process.env.AYLA_QUALIDADE_RESPOSTA_V2 = "off";
    expect(JSON.stringify((await rodar("nutricional", "Quero explorar Alimentação Positiva.")).messages)).not.toContain("<abertura_de_area>");
  });
  it("complementa sem mudar a área-base por menção a outro assunto", async () => {
    mock.classify.mockResolvedValue({ intencao: "desafio", tema: "sono", aceite: null, trocaTema: null });
    const r = await rodar("nutricional", "Come pouco quando dorme mal");
    expect(r.areaAtiva).toBe("nutricional");
    expect(r.roteadas.map((x) => x.skill.name)).toEqual(["nutricional", "sono"]);
  });
  it("muda a lente e preserva pessoa/histórico quando a troca é explícita", async () => {
    mock.classify.mockResolvedValue({ intencao: "desafio", tema: "sono", aceite: null, trocaTema: "sono" });
    const r = await rodar("nutricional", "Agora quero falar de sono");
    expect(r.areaAtiva).toBe("sono");
    expect(r.roteadas.map((x) => x.skill.name)).toEqual(["sono"]);
    expect(JSON.stringify(r.messages)).toContain("Podemos pensar juntas na refeição");
    expect(JSON.stringify(r.messages)).toContain("Nora");
  });
  it("troca inválida não cria especialista e crise não recebe o formato rico", async () => {
    mock.classify.mockResolvedValue({ intencao: "crise", tema: "sono", aceite: null, trocaTema: "inventado" });
    const r = await rodar();
    expect(r.areaAtiva).toBe("nutricional");
    expect(r.system.map((s) => s.text).join()).not.toContain("<forma_da_conversa_ayla>");
  });
  it("off continua no roteador anterior e não injeta a candidata", async () => {
    process.env.AYLA_QUALIDADE_RESPOSTA_V2 = "off";
    const r = await rodar();
    expect(mock.route).toHaveBeenCalledOnce();
    expect(r.system.map((s) => s.text).join()).not.toContain("<guia_tematico_da_ayla>");
    expect(r.base2Ids).toEqual([]);
  });
});
