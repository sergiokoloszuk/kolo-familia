import { describe, expect, it } from "vitest";
import { perfilConsultavelDaLinha } from "@/lib/kolo-vivo/consultar";
import {
  escolherLacunaDecisiva,
  jaRespondidas,
  lacunaSugeridaDoTurno,
  type DecisaoDeLacuna,
} from "./lacuna-decisiva";

/**
 * PEND-187A — SUGERIR NÃO É PERGUNTAR, E PERGUNTAR NÃO É APRENDER.
 *
 * ⚠️ O DEFEITO, medido no teste humano de 09/09/2026. `deveGravarLacuna`
 * gravava a lacuna escolhida sempre que a fala da Ayla continha "?". A
 * interrogação provava que houve UMA pergunta — nunca que foi ESTA:
 *
 *   | sugerido e gravado | o que a Ayla realmente perguntou                  |
 *   |--------------------|--------------------------------------------------|
 *   | `sensorial.perfil` | "...ou continua gritando por bastante tempo?"     |
 *   | `sensorial.toques` | "...tenta se machucar, machucar alguém ou fugir?" |
 *
 * E no turno seguinte a resposta "ela continua gritando mesmo quando ofereço
 * outra coisa" FECHOU `sensorial.perfil`. Aquela frase não diz nada sobre
 * perfil sensorial: um campo foi dado como sabido sem ninguém ter investigado.
 *
 * ⚠️ O QUE ESTA FRENTE FAZ, e o que ela deliberadamente NÃO faz. Ela para de
 * afirmar o que não se sabe: `lacuna_sugerida` diz só que o Gate B achou o
 * campo útil, e não exclui candidata nenhuma. Ela NÃO tenta descobrir qual das
 * três coisas aconteceu (perguntou a sugerida · perguntou outra · não
 * perguntou) — isso exige vínculo estrutural e é a PEND-187B.
 */

const L = (p: string[]) => p.join("\n");
const M = "manu";
const perfil = (linha: object) => perfilConsultavelDaLinha(linha as Record<string, unknown>, M);

/** Só o emocional preenchido: o sensorial fica aberto, como no caso real. */
const PERFIL_DA_MANU_ANTES = {
  categorias_extras: {
    emocional: { texto: L(["Como costuma ser: Desregula com facilidade"]) },
  },
};

const decidirCom = (linha: object, temas: string[], resolvidas?: ReturnType<typeof jaRespondidas>) =>
  escolherLacunaDecisiva({
    perfil: perfil(linha),
    temas,
    relato: "Ela grita quando eu desligo o tablet",
    ...(resolvidas ? { resolvidas } : {}),
  });

const falaComPergunta = (chave: string, pergunta: string) => [
  { direcao: "outbound", texto: pergunta, metadata: { lacuna_sugerida: chave }, membro_atipico_id: M },
];

// ═══════════════════════════════════════════════════════════════════════
// 1 · OS DOIS CASOS REAIS
// ═══════════════════════════════════════════════════════════════════════

describe("PEND-187A · caso A — sugeriu sensorial.perfil, perguntou outra coisa", () => {
  const PERGUNTA_REAL =
    "Quando o tablet termina, ela consegue se acalmar com uma atividade que gosta ou continua gritando por bastante tempo?";
  const RESPOSTA_REAL = "Ela continua gritando por bastante tempo, mesmo quando ofereço outra coisa.";

  it("a sugestão é gravada — e é só isso que ela afirma", () => {
    const d = {
      escolhida: { dominio: "sensorial", campo: "perfil", label: "Perfil sensorial" },
    } as DecisaoDeLacuna;
    expect(lacunaSugeridaDoTurno(d)).toBe("sensorial.perfil");
  });

  it("a pergunta do Core NÃO fecha a sugestão", () => {
    const falas = [
      ...falaComPergunta("sensorial.perfil", PERGUNTA_REAL),
      { direcao: "inbound", texto: RESPOSTA_REAL, membro_atipico_id: M },
    ];
    const resolvidas = jaRespondidas(falas, M);
    // O histórico continua LEGÍVEL — é observação, não fechamento.
    expect(resolvidas.fechadas.has("sensorial.perfil")).toBe(true);
    // ⚠️ MAS NÃO EXCLUI: é aqui que o defeito morre.
    const d = decidirCom(PERFIL_DA_MANU_ANTES, ["emocional"], resolvidas);
    expect(
      d.descartadas.some((x) => x.chave === "sensorial.perfil" && x.motivo === "já respondido nesta conversa"),
      "a sugestão ainda está excluindo candidata",
    ).toBe(false);
    expect(d.candidatasChaves).toContain("sensorial.perfil");
  });

  it("a resposta sobre duração não vira conhecimento sobre perfil sensorial", () => {
    const falas = [
      ...falaComPergunta("sensorial.perfil", PERGUNTA_REAL),
      { direcao: "inbound", texto: RESPOSTA_REAL, membro_atipico_id: M },
    ];
    const d = decidirCom(PERFIL_DA_MANU_ANTES, ["emocional"], jaRespondidas(falas, M));
    // O campo continua aberto: ninguém investigou perfil sensorial.
    expect(perfil(PERFIL_DA_MANU_ANTES).sabemos("sensorial", "perfil")).toBe(false);
    expect(d.candidatasChaves).toContain("sensorial.perfil");
  });
});

describe("PEND-187A · caso B — sugeriu sensorial.toques, perguntou sobre segurança", () => {
  const PERGUNTA_REAL = "Durante esses episódios, ela tenta se machucar, machucar alguém ou sair correndo?";

  it("nenhuma conclusão sobre toque é criada", () => {
    const falas = [
      ...falaComPergunta("sensorial.toques", PERGUNTA_REAL),
      { direcao: "inbound", texto: "Às vezes ela empurra e sai correndo pelo corredor", membro_atipico_id: M },
    ];
    const d = decidirCom(PERFIL_DA_MANU_ANTES, ["emocional"], jaRespondidas(falas, M));
    expect(d.candidatasChaves).toContain("sensorial.toques");
    expect(perfil(PERFIL_DA_MANU_ANTES).sabemos("sensorial", "toques")).toBe(false);
  });
});

describe("PEND-187A · e depois da PEND-189, o Perfil resolve sozinho", () => {
  /**
   * ⚠️ A LINHA REAL DA MANU, verbatim. Com a PEND-189 os rótulos colados voltam
   * a ser legíveis — e `sensorial.toques` já está preenchido. É o Perfil, e não
   * o histórico da conversa, tirando o campo da disputa. Exatamente a fonte
   * confiável que substituiu a heurística.
   */
  const LINHA_REAL = {
    sensorial: {
      texto:
        "Reação a sons: cobre os ouvidos com barulhos altos — tem sensibilidade significativa a sons. Reação a toques: não gosta de abraço. Texturas (roupas, objetos): adora roupa macia. Luz: luz forte e direta incomoda. Cheiros: cheiro de cigarro.",
    },
  };

  it("sensorial.toques já é sabido, então nem chega a ser candidato", () => {
    const p = perfil(LINHA_REAL);
    expect(p.sabemos("sensorial", "toques")).toBe(true);
    expect(p.valorDe("sensorial", "toques")).toContain("não gosta de abraço");
    const d = decidirCom(LINHA_REAL, ["sensorial"]);
    expect(d.candidatasChaves, "voltou a pedir o que a família já contou").not.toContain(
      "sensorial.toques",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2 · AS PROTEÇÕES
// ═══════════════════════════════════════════════════════════════════════

describe("PEND-187A · o que não pode mais fechar uma lacuna", () => {
  it("uma pergunta qualquer com '?' não fecha a sugestão", () => {
    const falas = [
      ...falaComPergunta("sensorial.perfil", "Como foi o dia de vocês hoje?"),
      { direcao: "inbound", texto: "foi corrido, ela ficou agitada o tempo todo", membro_atipico_id: M },
    ];
    const d = decidirCom(PERFIL_DA_MANU_ANTES, ["emocional"], jaRespondidas(falas, M));
    expect(d.candidatasChaves).toContain("sensorial.perfil");
  });

  it("ausência de pergunta também não fecha", () => {
    const falas = [
      ...falaComPergunta("sensorial.perfil", "Vale reduzir o estímulo nesse momento."),
      { direcao: "inbound", texto: "vou tentar isso hoje à noite então", membro_atipico_id: M },
    ];
    const d = decidirCom(PERFIL_DA_MANU_ANTES, ["emocional"], jaRespondidas(falas, M));
    expect(d.candidatasChaves).toContain("sensorial.perfil");
  });

  it("a sugestão sem escolha não grava nada", () => {
    expect(lacunaSugeridaDoTurno(null)).toBeNull();
    expect(lacunaSugeridaDoTurno({ escolhida: null } as DecisaoDeLacuna)).toBeNull();
  });

  it("ZERO OU UMA sugestão por turno — continua valendo", () => {
    const d = decidirCom(PERFIL_DA_MANU_ANTES, ["emocional"]);
    const chave = lacunaSugeridaDoTurno(d);
    if (chave) expect(chave.split(".").length).toBe(2);
    expect(d.escolhida === null || typeof d.escolhida === "object").toBe(true);
  });
});

describe("PEND-187A · o que continua valendo", () => {
  it("campo JÁ INCORPORADO ao Perfil sai das candidatas — a fonte confiável", () => {
    const comGatilhos = {
      categorias_extras: {
        emocional: {
          texto: L([
            "Como costuma ser: Desregula com facilidade",
            "Gatilhos: insistência e mudança de plano",
          ]),
        },
      },
    };
    const d = decidirCom(comGatilhos, ["emocional"]);
    expect(d.candidatasChaves).not.toContain("emocional.gatilhos");
    expect(perfil(comGatilhos).sabemos("emocional", "gatilhos")).toBe(true);
  });

  it("A CORREÇÃO VENCE O HISTÓRICO — pelo Perfil, que é onde o presente mora", () => {
    // ⚠️ Antes, "não acontece mais" fechava a lacuna via `corrigidas`. Agora
    // quem manda é o valor incorporado: a correção que chega ao Perfil muda o
    // que se sabe, e o campo deixa de ser candidato pelo motivo certo.
    const antes = decidirCom(PERFIL_DA_MANU_ANTES, ["emocional"]);
    expect(antes.candidatasChaves).toContain("emocional.gatilhos");

    const depoisDaCorrecao = {
      categorias_extras: {
        emocional: {
          texto: L([
            "Como costuma ser: Desregula com facilidade",
            "Gatilhos: não acontece mais com mudança de plano; hoje é só cansaço",
          ]),
        },
      },
    };
    const depois = decidirCom(depoisDaCorrecao, ["emocional"]);
    expect(depois.candidatasChaves).not.toContain("emocional.gatilhos");
  });

  it("ISOLAMENTO: o histórico da Manu não alcança o Mario", () => {
    const falas = [
      { direcao: "outbound", metadata: { lacuna_sugerida: "emocional.gatilhos" }, texto: "e o que dispara?", membro_atipico_id: "manu" },
      { direcao: "inbound", texto: "Ela desregula quando muda a rotina", membro_atipico_id: "manu" },
    ];
    expect(jaRespondidas(falas, "mario").fechadas.size).toBe(0);
    const doMario = escolherLacunaDecisiva({
      perfil: perfilConsultavelDaLinha(null, "mario"),
      temas: ["emocional"],
      resolvidas: jaRespondidas(falas, "mario"),
    });
    // ⚠️ ASK É O CERTO AQUI: o Mario tem perfil vazio, então há o que perguntar.
    // O isolamento se prova pelo POSITIVO — `emocional.gatilhos`, o campo que a
    // mãe respondeu sobre a Manu, continua candidato para ele.
    expect(doMario.decisao).toBe("ASK");
    expect(doMario.candidatasChaves, "o Mario perdeu a pergunta por causa da Manu").toContain(
      "emocional.gatilhos",
    );
  });
});

describe("PEND-187A · o histórico legado continua legível, e não é migrado", () => {
  it("a chave antiga `lacuna` ainda é lida — para auditoria", () => {
    const falas = [
      { direcao: "outbound", texto: "e o que dispara?", metadata: { lacuna: "emocional.gatilhos" }, membro_atipico_id: M },
      { direcao: "inbound", texto: "insistência e mudança de plano", membro_atipico_id: M },
    ];
    expect(jaRespondidas(falas, M).fechadas.has("emocional.gatilhos")).toBe(true);
  });

  it("mas ela NÃO exclui candidata — legível ≠ confiável", () => {
    const falas = [
      { direcao: "outbound", texto: "e o que dispara?", metadata: { lacuna: "emocional.gatilhos" }, membro_atipico_id: M },
      { direcao: "inbound", texto: "insistência e mudança de plano", membro_atipico_id: M },
    ];
    const d = decidirCom(PERFIL_DA_MANU_ANTES, ["emocional"], jaRespondidas(falas, M));
    expect(d.candidatasChaves).toContain("emocional.gatilhos");
  });

  it("a chave nova é lida do mesmo jeito, sem uma virar a outra", () => {
    const legado = [
      { direcao: "outbound", texto: "?", metadata: { lacuna: "sono.padrao" }, membro_atipico_id: M },
      { direcao: "inbound", texto: "ela demora quase uma hora para pegar no sono", membro_atipico_id: M },
    ];
    const nova = [
      { direcao: "outbound", texto: "?", metadata: { lacuna_sugerida: "sono.padrao" }, membro_atipico_id: M },
      { direcao: "inbound", texto: "ela demora quase uma hora para pegar no sono", membro_atipico_id: M },
    ];
    expect(jaRespondidas(legado, M).fechadas.has("sono.padrao")).toBe(true);
    expect(jaRespondidas(nova, M).fechadas.has("sono.padrao")).toBe(true);
  });
});
