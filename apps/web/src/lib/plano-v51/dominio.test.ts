import { describe, expect, it } from "vitest";
import { aplicarPlano, criarPlanoV51, diaPlano, etapaConcluida, PASSOS, perguntasPendentes, type AcaoPlano, type PlanoV51 } from "./dominio";
import { conteudoDemonstrativo, MEMBROS_FICTICIOS } from "./demonstracao";

const agora = "2026-11-26T15:00:00-03:00";
const relato = "Na hora da lição, senta mas não começa. Quero entender o que ajuda.";
const criar = () => criarPlanoV51({ id: "p1", familyId: "f1", membro: MEMBROS_FICTICIOS[0], titulo: "Hora da lição", relato, conteudo: conteudoDemonstrativo(relato), agora });
let numero = 0;
const entrada = (acao: AcaoPlano, extra = {}) => ({ familyId: "f1", membroId: "demo-manu", eventoId: `e${++numero}`, agora, acao, ...extra });
function acao(p: PlanoV51, a: AcaoPlano): PlanoV51 {
  const r = aplicarPlano(p, entrada(a));
  if (!r.ok) throw new Error(r.erro);
  return r.plano;
}
function combinado() {
  let p = criar();
  while (PASSOS[p.passo].id !== "lembretes") {
    const passo = PASSOS[p.passo].id;
    if (passo === "perguntas") for (const q of perguntasPendentes(p)) p = acao(p, { tipo: "responder", perguntaId: q.id, resposta: "Não sei / não reparei" });
    if (passo === "caminhos") p = acao(p, { tipo: "escolher", estrategiaId: "demo-primeiro-passo" });
    if (passo === "combinado") {
      p = acao(p, { tipo: "combinado", campo: "quando", valor: "Depois do lanche" });
      p = acao(p, { tipo: "combinado", campo: "frequencia", valor: "Na próxima oportunidade" });
      p = acao(p, { tipo: "combinado", campo: "quem", valor: "Eu" });
    }
    p = acao(p, { tipo: "avancar" });
  }
  return acao(p, { tipo: "confirmar" });
}
function tentativa(p: PlanoV51, resultado: "ajudou" | "parcial" | "nao_mudou" | "incerto" = "ajudou") {
  return acao(p, { tipo: "registrar", registro: { id: "r1", origem: "web", estrategiaId: "demo-primeiro-passo", tipo: "tentativa", relato: "Mostrei a primeira parte e ela começou com ajuda.", resultado } });
}

describe("Plano V5.1 — percurso e estados", () => {
  it("começa proposto, vazio e sem lembretes", () => {
    const p = criar();
    expect(p.registros).toEqual([]); expect(p.lembretes).toEqual({ autorizado: false });
    expect(p.estados["demo-primeiro-passo"]).toBe("proposto");
    expect(diaPlano(p, agora)).toBe(1);
    expect(p.combinado.voltarEm).toBe("2026-12-03");
    expect(p.eventos).toEqual([]);
  });
  it("impede ir direto a Experimentar ou confirmar sem percorrer e escolher", () => {
    expect(aplicarPlano(criar(), entrada({ tipo: "navegar", passo: 12 })).ok).toBe(false);
    expect(aplicarPlano(criar(), entrada({ tipo: "confirmar" })).ok).toBe(false);
  });
  it("confirmar combinado não cria tentativa, resultado ou conquista", () => {
    const p = combinado();
    expect(p.passo).toBe(12); expect(p.registros).toEqual([]);
    expect(p.estados["demo-primeiro-passo"]).toBe("escolhido");
    expect(etapaConcluida(p, 3)).toBe(false);
    expect(diaPlano(p, agora)).toBe(1);
    expect(p.lembretes.autorizado).toBe(false);
  });
  it("abrir uma etapa não marca conclusão", () => {
    const p = acao(combinado(), { tipo: "navegar", passo: 13 });
    expect(etapaConcluida(p, 3)).toBe(false); expect(etapaConcluida(p, 4)).toBe(false);
  });
  it.each(["ajudou", "parcial"] as const)("%s é resultado observado, não conquista", r => {
    const p = tentativa(combinado(), r);
    expect(p.estados["demo-primeiro-passo"]).toBe("resultado_observado");
    expect(p.registros[0].conquista).toBeUndefined();
    expect(p.eventos.map(e => e.tipo)).toContain("tentado");
    expect(p.eventos.map(e => e.tipo)).toContain("resultado_observado");
    expect(etapaConcluida(p, 3)).toBe(true);
  });
  it("só confirma conquista com relato de melhoria e confirmação explícita", () => {
    const p = tentativa(combinado());
    expect(aplicarPlano(p, entrada({ tipo: "conquista", registroId: "r1", melhoria: "", confirma: true })).ok).toBe(false);
    expect(aplicarPlano(p, entrada({ tipo: "conquista", registroId: "r1", melhoria: "Começou com ajuda", confirma: false })).ok).toBe(false);
    const n = acao(p, { tipo: "conquista", registroId: "r1", melhoria: "Começou com ajuda", confirma: true });
    expect(n.estados["demo-primeiro-passo"]).toBe("conquista_confirmada");
    expect(n.registros[0].conquista?.melhoria).toBe("Começou com ajuda");
    expect(p.registros[0].conquista).toBeUndefined();
  });
  it.each(["nao_mudou", "incerto"] as const)("não promove %s a conquista", resultado => {
    expect(aplicarPlano(tentativa(combinado(), resultado), entrada({ tipo: "conquista", registroId: "r1", melhoria: "Uma melhoria", confirma: true })).ok).toBe(false);
  });
  it("não experimentar preserva estado escolhido e não marca Experimentar feito", () => {
    const p = acao(combinado(), { tipo: "registrar", registro: { id: "n1", origem: "web", estrategiaId: "demo-primeiro-passo", tipo: "sem_tentativa", relato: "Não teve oportunidade" } });
    expect(p.estados["demo-primeiro-passo"]).toBe("escolhido"); expect(etapaConcluida(p, 3)).toBe(false);
  });
  it("resultado sem tentativa ou sem relato é rejeitado", () => {
    const p = combinado();
    for (const tipo of ["tentativa", "sem_tentativa"] as const) expect(aplicarPlano(p, entrada({ tipo: "registrar", registro: { id: "r1", origem: "web", estrategiaId: "demo-primeiro-passo", tipo, relato: "", resultado: "ajudou" } })).ok).toBe(false);
  });
  it("feedback não muda resultado nem cria conquista", () => {
    const p = acao(combinado(), { tipo: "feedback", nota: 5, comentario: "Gostei" });
    expect(p.feedback?.nota).toBe(5); expect(p.registros).toEqual([]); expect(etapaConcluida(p, 3)).toBe(false);
  });
  it("não reaproveita perguntas respondidas no contexto", () => {
    const p = criar(); p.conteudo.perguntas[0].respondidaNoContexto = true;
    expect(perguntasPendentes(p).map(q => q.id)).toEqual(["apoio"]);
    const n = acao(p, { tipo: "responder", perguntaId: "apoio", resposta: "Não sei / não reparei" });
    expect(perguntasPendentes(n)).toEqual([]); expect(n.respostas.apoio).toBe("Não sei / não reparei");
  });
  it("não exige etapa de perguntas quando não há lacunas relevantes", () => {
    const p = criar(); p.conteudo.perguntas = [];
    expect(acao(p, { tipo: "avancar" }).passo).toBe(2);
  });
});

describe("Plano V5.1 — identidade, confirmação e integridade", () => {
  it.each([{ familyId: "outra" }, { membroId: "demo-theo" }])("nega acesso cruzado %j", extra => {
    const p = combinado(), original = structuredClone(p);
    expect(aplicarPlano(p, entrada({ tipo: "registrar", registro: { id: "r1", tipo: "tentativa", relato: "Aconteceu", resultado: "ajudou", origem: "web", estrategiaId: "demo-primeiro-passo" } }, extra)).ok).toBe(false);
    expect(p).toEqual(original);
  });
  it("operações e registros repetidos são idempotentes", () => {
    const p = combinado(), evento = entrada({ tipo: "registrar", registro: { id: "r1", tipo: "tentativa", relato: "Aconteceu", resultado: "ajudou", origem: "web", estrategiaId: "demo-primeiro-passo" } });
    const r = aplicarPlano(p, evento); if (!r.ok) throw Error(r.erro);
    expect(aplicarPlano(r.plano, evento)).toEqual(r);
    const novo = aplicarPlano(r.plano, { ...evento, eventoId: "outro" });
    expect(novo).toEqual(r); expect(r.plano.registros).toHaveLength(1);
  });
  it("recusa hipóteses com origem inventada", () => {
    const conteudo = conteudoDemonstrativo("Ela quer manipular a mãe.");
    expect(() => criarPlanoV51({ id: "p", familyId: "f", membro: MEMBROS_FICTICIOS[0], titulo: "Lição", relato, conteudo, agora })).toThrow(/origem/);
  });
  it("nunca transforma cadastro de uma irmã em origem da outra", () => {
    const conteudo = conteudoDemonstrativo(relato);
    conteudo.olhares[0].origem = { tipo: "cadastro", frase: "Gosta de dinossauros" };
    expect(() => criarPlanoV51({ id: "p", familyId: "f", membro: MEMBROS_FICTICIOS[1], titulo: "Lição", relato, conteudo, agora })).toThrow(/origem/);
  });
  it("não ativa lembrete sem canal real e autorização completa", () => {
    const p = combinado();
    expect(aplicarPlano(p, entrada({ tipo: "lembrete", canal: "WhatsApp", frequencia: "todo dia", horario: "17:00", disponivel: false })).ok).toBe(false);
    expect(aplicarPlano(p, entrada({ tipo: "lembrete", canal: "", frequencia: "todo dia", horario: "17:00", disponivel: true })).ok).toBe(false);
  });
  it("pausar e encerrar retiram autorização; retomar não reativa", () => {
    const p = acao(combinado(), { tipo: "lembrete", canal: "WhatsApp", frequencia: "todo dia", horario: "17:00", disponivel: true });
    const pausado = acao(p, { tipo: "pausar" }); expect(pausado.lembretes.autorizado).toBe(false);
    expect(acao(pausado, { tipo: "retomar" }).lembretes.autorizado).toBe(false);
    const encerrado = acao(p, { tipo: "encerrar" }); expect(encerrado.lembretes.autorizado).toBe(false);
    expect(aplicarPlano(encerrado, entrada({ tipo: "retomar" })).ok).toBe(false);
  });
  it("não permite registrar enquanto pausado", () => {
    expect(() => tentativa(acao(combinado(), { tipo: "pausar" }))).toThrow(/ativo/);
  });
  it("mantém a origem WhatsApp quando o evento a comprova", () => {
    const p = acao(combinado(), { tipo: "registrar", registro: { id: "wa1", origem: "whatsapp", tipo: "tentativa", estrategiaId: "demo-primeiro-passo", relato: "Tentamos", resultado: "nao_mudou" } });
    expect(p.registros[0].origem).toBe("whatsapp");
  });
  it("risco atual interrompe avanço, sem ser uma etapa do plano", () => {
    const p = acao(criar(), { tipo: "cuidado", cuidado: { risco: "agora", frase: "Na hora da lição", emAberto: true } });
    expect(aplicarPlano(p, entrada({ tipo: "avancar" })).ok).toBe(false);
    expect(PASSOS.map(s => s.id)).not.toContain("cuidado");
    const n = acao(p, { tipo: "cuidado", cuidado: { risco: "nao_mais", frase: "Na hora da lição", emAberto: false } });
    expect(aplicarPlano(n, entrada({ tipo: "avancar" })).ok).toBe(true);
  });
});
