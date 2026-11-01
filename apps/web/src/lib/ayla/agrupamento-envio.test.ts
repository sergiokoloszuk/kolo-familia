import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { montarMundo } from "./__harness/cenario";

const duplos = vi.hoisted(() => ({ enviar: vi.fn() }));
vi.mock("./whatsappSender", () => ({ enviarTexto: duplos.enviar }));
vi.mock("@/lib/log", () => ({ logEvent: async () => {}, logServerError: async () => {} }));

const { enviarEPersistir } = await import("./orchestrator");
const texto = ["Ponte", "Objeto", "Espelho"].map((nome) =>
  `*${nome}*\n\nMaterial: blocos.\n\nComo começar: Manu escolhe uma peça.\n\nPara terminar: guardem juntas.`,
).join("\n\n");

function cenario() {
  const m = montarMundo({ criancas: [{ nome: "Manu", nascimento: "2020-01-01" }] });
  return { m, params: {
    family_account_id: m.familyId,
    membro_atipico_id: m.membros.Manu,
    phone: m.telefone,
    texto,
    agruparConteudo: true,
    category: "reativa" as const,
    tipo: "resposta_registro" as const,
    metadataMensagem: { pedido: "brincadeiras" },
  } };
}

beforeEach(() => {
  duplos.enviar.mockReset();
  let numero = 0;
  duplos.enviar.mockImplementation(async () => ({ messageId: `parte-${++numero}`, raw: { ok: true } }));
});
afterEach(() => vi.useRealTimers());

describe("envio agrupado com I/O substituído", () => {
  it("mantém a métrica da primeira resposta no primeiro aceite, não no fim das três partes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-29T12:00:00Z"));
    const inicio = Date.now();
    duplos.enviar.mockImplementation(async () => {
      vi.setSystemTime(Date.now() + 50);
      return { messageId: `id-${Date.now()}`, raw: { ok: true } };
    });
    const { m, params } = cenario();
    const resultado = await enviarEPersistir(m.db.cliente(), params);
    expect(resultado.enviada).toBe(true);
    if (resultado.enviada) {
      expect(resultado.metrica?.aceitoEmMs).toBe(inicio + 50);
      expect(resultado.metrica?.provedorMs).toBe(150);
    }
  });

  it("envia três partes, mas mantém uma resposta lógica inteira e a âncora no histórico", async () => {
    const { m, params } = cenario();
    const resultado = await enviarEPersistir(m.db.cliente(), params);
    expect(resultado.enviada).toBe(true);
    expect(duplos.enviar).toHaveBeenCalledTimes(3);
    const mensagens = m.db.linhas("ayla_messages").filter((l) => l.direcao === "outbound");
    expect(mensagens).toHaveLength(1);
    expect(mensagens[0].texto).toBe(texto);
    expect(mensagens[0].membro_atipico_id).toBe(m.membros.Manu);
    expect(mensagens[0].metadata).toMatchObject({
      pedido: "brincadeiras",
      entrega: { bolhas: 3, ids: ["parte-1", "parte-2", "parte-3"] },
    });
  });

  it("não declara sucesso completo se a segunda parte falhar; registra o aceite parcial", async () => {
    const { m, params } = cenario();
    duplos.enviar.mockResolvedValueOnce({ messageId: "primeira", raw: { messageId: "primeira" } });
    duplos.enviar.mockRejectedValueOnce(new Error("falha de teste na segunda parte"));
    const resultado = await enviarEPersistir(m.db.cliente(), params);
    expect(resultado.enviada).toBe(false);
    expect(duplos.enviar).toHaveBeenCalledTimes(2);
    const historico = m.db.linhas("ayla_messages").filter((l) => l.direcao === "outbound");
    expect(historico).toHaveLength(1);
    expect(historico[0].texto).toContain("*Ponte*");
    expect(historico[0].texto).not.toContain("*Objeto*");
    expect(historico[0].metadata).toMatchObject({ entrega: { incompleta: true, bolhas: 1, partes_previstas: 3 } });
    expect(historico[0].metadata).not.toHaveProperty("pedido");
    expect(m.db.linhas("ayla_send_log").at(-1)).toMatchObject({
      status: "falha",
      payload: { texto, apresentacao: { partes_previstas: 3, partes_aceitas: 1 } },
      resposta_provider: { messageId: "primeira" },
    });
  });

  it("não registra uma tentativa sem nenhum aceite como mensagem enviada", async () => {
    const { m, params } = cenario();
    duplos.enviar.mockRejectedValueOnce(new Error("nenhuma parte aceita"));
    expect((await enviarEPersistir(m.db.cliente(), params)).enviada).toBe(false);
    expect(m.db.linhas("ayla_messages").filter((l) => l.direcao === "outbound")).toHaveLength(0);
    expect(m.db.linhas("ayla_send_log").at(-1)).toMatchObject({
      status: "falha", payload: { apresentacao: { partes_aceitas: 0 } },
    });
  });

  it("não muda o envio dos chamadores que não optaram pelo agrupamento", async () => {
    const { m, params } = cenario();
    await enviarEPersistir(m.db.cliente(), { ...params, agruparConteudo: undefined });
    expect(duplos.enviar).toHaveBeenCalledTimes(1);
    expect(duplos.enviar.mock.calls[0][0].texto).toBe(texto);
  });

  it("não agrupa proativas mesmo com opção indevida", async () => {
    const { m, params } = cenario();
    await enviarEPersistir(m.db.cliente(), { ...params, category: "proativa", tipo: "boas_vindas" });
    expect(duplos.enviar).toHaveBeenCalledTimes(1);
    expect(duplos.enviar.mock.calls[0][0].texto).toBe(texto);
  });
});
