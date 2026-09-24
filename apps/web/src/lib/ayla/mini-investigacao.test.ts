import { describe, expect, it } from "vitest";
import { perfilConsultavelDaLinha } from "@/lib/kolo-vivo/consultar";
import { blocoMiniInvestigacao, decidirMiniInvestigacao } from "./mini-investigacao";

const perfil = (extras: Record<string, unknown> = {}) =>
  perfilConsultavelDaLinha({ categorias_extras: extras }, "crianca-1");

describe("mini-investigacao inteligente", () => {
  it("na alimentacao nao pergunta de novo o que o Perfil ja sabe", () => {
    const d = decidirMiniInvestigacao({
      perfil: perfil({ nutricional: { texto: "Aceita bem / preferidos: arroz; banana" } }),
      temas: ["nutricional"],
      relato: "Ja tentei oferecer comida aos poucos e sem pressao, mas nao funcionou.",
      falas: [],
      membroId: "crianca-1",
    });

    expect(d.acao).toBe("PERGUNTAR");
    expect(d.campos).toEqual(["alimentacao.reacao_novo", "alimentacao.sensorial"]);
    expect(d.perguntas.join(" ")).not.toMatch(/aceita comer hoje/i);
  });

  it("nao ativa regulacao sem ganho significativo no A/B", () => {
    const d = decidirMiniInvestigacao({
      perfil: perfil(),
      temas: ["emocional"],
      relato: "Ja tentei falar baixo e dar espaco, mas nada ajuda quando ele explode.",
      falas: [],
      membroId: "crianca-1",
    });

    expect(d.acao).toBe("NAO_USAR");
    expect(d.motivo).toMatch(/A\/B nao demonstrou ganho significativo/);
  });

  it("mantem a regra padrao quando falta menos de duas informacoes", () => {
    const d = decidirMiniInvestigacao({
      perfil: perfil({
        comunicacao: {
          texto:
            "Como se comunica: Fala palavras soltas\nComo mostra o que quer: aponta e leva pela mao",
        },
      }),
      temas: ["comunicacao"],
      relato: "Ja tentei oferecer escolhas, mas ele tem dificuldade para se comunicar.",
      falas: [],
      membroId: "crianca-1",
    });

    expect(d.acao).toBe("NAO_USAR");
  });

  it("nao atrasa orientacao de urgencia para investigar", () => {
    const d = decidirMiniInvestigacao({
      perfil: perfil(),
      temas: ["emocional"],
      relato: "Ele esta gritando agora e tentando se machucar.",
      falas: [],
      membroId: "crianca-1",
    });
    expect(d.acao).toBe("NAO_USAR");
    expect(d.motivo).toBe("risco ou urgencia");
  });

  it("depois da resposta obriga a orientar e nao abre nova bateria", () => {
    const d = decidirMiniInvestigacao({
      perfil: perfil(),
      temas: ["nutricional"],
      relato: "Ele aceita arroz; com novidade cheira e se afasta; pastoso incomoda.",
      falas: [
        {
          direcao: "outbound",
          membro_atipico_id: "crianca-1",
          metadata: {
            mini_investigacao_tema: "alimentacao",
            mini_investigacao_campos: [
              "alimentacao.aceita",
              "alimentacao.reacao_novo",
              "alimentacao.sensorial",
            ],
          },
        },
        { direcao: "inbound", membro_atipico_id: "crianca-1" },
      ],
      membroId: "crianca-1",
    });

    expect(d.acao).toBe("ORIENTAR");
    const bloco = blocoMiniInvestigacao(d);
    expect(bloco).toContain("Agora é OBRIGATÓRIO ajudar");
    expect(bloco).toContain("Não faça outra bateria");
  });

  it("nao reaproveita a mini-investigacao de outra crianca", () => {
    const d = decidirMiniInvestigacao({
      perfil: perfil(),
      temas: ["nutricional"],
      relato: "Ja tentei oferecer aos poucos, mas ele continua seletivo para comer.",
      falas: [
        {
          direcao: "outbound",
          membro_atipico_id: "irmao-2",
          metadata: {
            mini_investigacao_tema: "alimentacao",
            mini_investigacao_campos: ["alimentacao.aceita", "alimentacao.sensorial"],
          },
        },
        { direcao: "inbound", membro_atipico_id: "crianca-1" },
      ],
      membroId: "crianca-1",
    });

    expect(d.acao).toBe("PERGUNTAR");
  });

  it("nao usa mini-investigacao quando ainda da para ajudar primeiro", () => {
    const d = decidirMiniInvestigacao({
      perfil: perfil(),
      temas: ["foco"],
      relato: "Ele nao quer fazer nenhuma atividade comigo.",
      falas: [],
      membroId: "crianca-1",
    });
    expect(d.acao).toBe("NAO_USAR");
    expect(d.motivo).toMatch(/primeira orientacao util/);
  });

  it("agrupa atividade quando tentativas anteriores falharam", () => {
    const d = decidirMiniInvestigacao({
      perfil: perfil(),
      temas: ["foco"],
      relato: "Ja tentei deixar a atividade curta e dar escolhas, mas nao funcionou. Nao sei onde trava.",
      falas: [],
      membroId: "crianca-1",
    });
    expect(d.acao).toBe("PERGUNTAR");
    expect(d.campos).toHaveLength(3);
    expect(blocoMiniInvestigacao(d)).toContain("inclusive por áudio");
  });
});
