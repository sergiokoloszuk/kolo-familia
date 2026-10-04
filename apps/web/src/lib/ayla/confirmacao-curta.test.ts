import { describe, expect, it } from "vitest";
import { decidirConfirmacaoCurta, ehFechamentoSocial, textoFechamentoCurto, TEXTO_AGRADECIMENTO_CURTO, TEXTO_FECHAMENTO_CURTO } from "./confirmacao-curta";

const agora = new Date("2026-10-04T14:00:00.000Z");
const base = {
  mensagem: "Ok",
  ultimaSaida: { texto: "Tente fazer a transição com um aviso simples.", created_at: "2026-10-04T13:58:00.000Z", tipo: "resposta_registro" },
  agora,
  perguntaPendente: false,
  artefatoPendente: false,
  segurancaAberta: false,
  rotinaPendente: false,
  ofertaFimDeSemanaPendente: false,
};

describe("fechamento social da Ayla", () => {
  it.each(["Ok", "Obrigada!", "obrigado", "Entendi", "Tá bom", "Combinado"])(
    "fecha %s sem repetir a orientação", (mensagem) => {
      expect(decidirConfirmacaoCurta({ ...base, mensagem })).toBe("responder");
      expect(textoFechamentoCurto(mensagem).length).toBeLessThanOrEqual(40);
    },
  );

  it.each(["Sim", "1", "não funcionou", "Ok, mas ela ainda chora", "Pode montar"])(
    "não captura %s", (mensagem) => {
      expect(ehFechamentoSocial(mensagem)).toBe(false);
      expect(decidirConfirmacaoCurta({ ...base, mensagem })).toBe("seguir");
    },
  );

  it("não cria pingue-pongue com outra confirmação", () => {
    expect(decidirConfirmacaoCurta({ ...base, ultimaSaida: { ...base.ultimaSaida, texto: TEXTO_FECHAMENTO_CURTO } }))
      .toBe("silencio");
    expect(decidirConfirmacaoCurta({ ...base, ultimaSaida: { ...base.ultimaSaida, texto: TEXTO_AGRADECIMENTO_CURTO } }))
      .toBe("silencio");
  });

  it("agradece sem confirmar uma ação que não aconteceu", () => {
    expect(textoFechamentoCurto("Obrigada!")).toBe("Por nada 💛");
  });

  it("não transforma 'me conta como foi' em orientação repetida quando a família só diz ok", () => {
    expect(decidirConfirmacaoCurta({
      ...base,
      ultimaSaida: { ...base.ultimaSaida, texto: "Experimente esse passo hoje. Me conta como foi." },
    })).toBe("responder");
  });

  it.each([
    { perguntaPendente: true },
    { artefatoPendente: true },
    { segurancaAberta: true },
    { rotinaPendente: true },
    { ofertaFimDeSemanaPendente: true },
  ])("preserva o estado pendente %o", (estado) => {
    expect(decidirConfirmacaoCurta({ ...base, ...estado })).toBe("seguir");
  });

  it.each([
    "Quer que eu monte um plano?",
    "Se quiser, posso montar um plano.",
    "Toque em Gerar cartões.",
    "Escolha o tema para continuar.",
  ])("não toma uma oferta ou instrução por conversa encerrada: %s", (texto) => {
    expect(decidirConfirmacaoCurta({ ...base, ultimaSaida: { ...base.ultimaSaida, texto } }))
      .toBe("seguir");
  });

  it("não fecha resposta antiga ou sem histórico", () => {
    expect(decidirConfirmacaoCurta({ ...base, ultimaSaida: null })).toBe("seguir");
    expect(decidirConfirmacaoCurta({ ...base, ultimaSaida: { ...base.ultimaSaida, created_at: "2026-10-04T10:00:00.000Z" } }))
      .toBe("seguir");
  });

  it.each(["seguranca", "rotina_conversa", "assinatura_nudge", "trial", "recuperacao_rotina"])(
    "não captura confirmação de fluxo %s", (tipo) => {
      expect(decidirConfirmacaoCurta({ ...base, ultimaSaida: { ...base.ultimaSaida, tipo } }))
        .toBe("seguir");
    },
  );
});
