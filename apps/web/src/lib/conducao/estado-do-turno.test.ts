import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BancoMemoria } from "@/lib/ayla/__harness/banco-memoria";
import { apurarEstadoDoTurno, blocoDeEstado } from "./estado-do-turno";

/**
 * ⚠️ A REGRA QUE ESTES TESTES PRENDEM. O estado do turno existe para que o
 * modelo veja o que a Kolo sabe — e para que ele NÃO conclua nada sobre o que
 * ela não sabe. Desconhecido e inexistente têm de sair diferentes do bloco.
 *
 * O caso de origem: Karina, 06/09/2026. Rotina prometida às 15:01, em
 * `aguardando`. Às 17:14 ela cobrou ("E agora?", "Consegue trazer?") e ouviu
 * "Sobre quem você está falando? Mario ou Manu?". O dado existia na tabela e
 * não existia no prompt.
 */

const FAM = "fam-1";
const MEMBRO = "membro-1";

function db() {
  return new BancoMemoria();
}

const fala = (direcao: string, texto: string) => ({ direcao, texto });

describe("ARTEFATO PENDENTE — o campo que justifica a fase", () => {
  it("rotina em aguardando sem tema aparece, e diz o que falta", async () => {
    const b = db();
    b.semear("rotinas", [
      { family_account_id: FAM, nome: "Dia com os tios", tema: null, cards_status: "aguardando" },
    ]);
    const e = await apurarEstadoDoTurno(b.cliente() as never, {
      familyId: FAM,
      membroId: MEMBRO,
      membroNome: "Manu",
      historico: [],
    });
    expect(e.artefatoPendente.conhecido).toBe("sim");
    if (e.artefatoPendente.conhecido === "sim") {
      expect(e.artefatoPendente.valor.falta).toBe("tema");
      expect(e.artefatoPendente.valor.nome).toBe("Dia com os tios");
    }
    const bloco = blocoDeEstado(e);
    expect(bloco).toMatch(/esperando o TEMA/);
    // ⚠️ O bloco tem de PROIBIR explicitamente a afirmação de conclusão — é a
    // mesma verdade que o portão 3 da Rotina Visual protege do outro lado.
    expect(bloco).toMatch(/não diga que está/i);
  });

  it("rotina COM tema e ainda aguardando: falta o ato, não o dado", async () => {
    const b = db();
    b.semear("rotinas", [
      { family_account_id: FAM, nome: "Manhã", tema: "princesa", cards_status: "aguardando" },
    ]);
    const e = await apurarEstadoDoTurno(b.cliente() as never, {
      familyId: FAM, membroId: MEMBRO, membroNome: "Manu", historico: [],
    });
    if (e.artefatoPendente.conhecido === "sim") expect(e.artefatoPendente.valor.falta).toBe("geracao");
  });

  it("sem rotina pendente diz 'nenhum', não some", async () => {
    const e = await apurarEstadoDoTurno(db().cliente() as never, {
      familyId: FAM, membroId: MEMBRO, membroNome: "Manu", historico: [],
    });
    expect(e.artefatoPendente.conhecido).toBe("nenhum");
    expect(blocoDeEstado(e)).toMatch(/artefato_pendente: nenhum/);
  });

  it("rotina pronta NÃO é artefato pendente", async () => {
    const b = db();
    b.semear("rotinas", [
      { family_account_id: FAM, nome: "Manhã", tema: "princesa", cards_status: "pronto" },
    ]);
    const e = await apurarEstadoDoTurno(b.cliente() as never, {
      familyId: FAM, membroId: MEMBRO, membroNome: "Manu", historico: [],
    });
    expect(e.artefatoPendente.conhecido).toBe("nenhum");
  });
});

describe("DESCONHECIDO NÃO É INEXISTENTE", () => {
  it("correções da família saem como não rastreado, nunca como nenhum", async () => {
    const e = await apurarEstadoDoTurno(db().cliente() as never, {
      familyId: FAM, membroId: MEMBRO, membroNome: "Manu", historico: [],
    });
    // ⚠️ A Kolo não tem coluna, tabela nem marcação de correção. Dizer "nenhum"
    // afirmaria que a família não corrigiu nada — e ela pode ter corrigido três
    // vezes. Admitir a lacuna é o comportamento correto.
    expect(e.correcoesDaFamilia.conhecido).toBe("nao_rastreado");
    expect(blocoDeEstado(e)).toMatch(/correcoes_da_familia: não rastreado/);
    expect(blocoDeEstado(e)).toMatch(/não conclua nada/);
  });

  it("plano sem seguimento enviado: resultado é não rastreado", async () => {
    const b = db();
    b.semear("planos", [
      { family_account_id: FAM, membro_atipico_id: MEMBRO, tema: "birra na saída",
        created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
        resultado: null, resultado_nota: null, seguimento_enviado_em: null },
    ]);
    const e = await apurarEstadoDoTurno(b.cliente() as never, {
      familyId: FAM, membroId: MEMBRO, membroNome: "Manu", historico: [],
    });
    expect(e.estrategiaEmAcompanhamento.conhecido).toBe("sim");
    // Nunca perguntamos → a Kolo não sabe. Não pode virar "não funcionou".
    expect(e.resultadoConhecido.conhecido).toBe("nao_rastreado");
  });

  it("plano COM seguimento e sem resposta: aí sim é ausência de verdade", async () => {
    const b = db();
    b.semear("planos", [
      { family_account_id: FAM, membro_atipico_id: MEMBRO, tema: "birra",
        created_at: new Date().toISOString(),
        resultado: null, resultado_nota: null, seguimento_enviado_em: new Date().toISOString() },
    ]);
    const e = await apurarEstadoDoTurno(b.cliente() as never, {
      familyId: FAM, membroId: MEMBRO, membroNome: "Manu", historico: [],
    });
    // Perguntamos e ela não respondeu — a Ayla não deve insistir.
    expect(e.resultadoConhecido.conhecido).toBe("nenhum");
  });
});

describe("ISOLAMENTO ENTRE IRMÃOS", () => {
  it("o plano do outro filho não vira estratégia em acompanhamento deste", async () => {
    const b = db();
    b.semear("planos", [
      { family_account_id: FAM, membro_atipico_id: "outro-irmao", tema: "sono do Mario",
        created_at: new Date().toISOString(), resultado: null, resultado_nota: null,
        seguimento_enviado_em: null },
    ]);
    const e = await apurarEstadoDoTurno(b.cliente() as never, {
      familyId: FAM, membroId: MEMBRO, membroNome: "Manu", historico: [],
    });
    expect(e.estrategiaEmAcompanhamento.conhecido).toBe("nenhum");
    expect(blocoDeEstado(e)).not.toMatch(/Mario/);
  });
});

describe("PERGUNTA PENDENTE E INTERROGATÓRIO", () => {
  it("a lista numerada vira opções legíveis — o caso Lucila", async () => {
    const e = await apurarEstadoDoTurno(db().cliente() as never, {
      familyId: FAM, membroId: MEMBRO, membroNome: "Heitor",
      historico: [
        fala("inbound", "ele grita muito na hora do banho"),
        // Formato real: opções em linha própria. Medido em 114 mensagens de
        // produção — 96% das listas da Ayla saem assim, e `extrairOpcoes` as lê.
        fala("outbound", "Qual parte pesa mais?\n\n1. tirar a roupa\n2. a água\n3. sair do banho"),
      ],
    });
    expect(e.perguntaPendente.conhecido).toBe("sim");
    if (e.perguntaPendente.conhecido === "sim") {
      expect(e.perguntaPendente.valor.opcoes).toHaveLength(3);
      expect(e.perguntaPendente.valor.opcoes[2].texto).toMatch(/sair do banho/);
    }
    // ⚠️ É isto que dá referente ao "3" que chega no turno seguinte.
    expect(blocoDeEstado(e)).toMatch(/3\) sair do banho/);
  });

  it("perguntas já feitas ficam visíveis — o caso Vanessa", async () => {
    const e = await apurarEstadoDoTurno(db().cliente() as never, {
      familyId: FAM, membroId: MEMBRO, membroNome: "Miguel",
      historico: [
        fala("outbound", "Quantos anos ele tem?"),
        fala("inbound", "6"),
        fala("outbound", "E ele já faz acompanhamento com alguém?"),
        fala("inbound", "faz fono"),
      ],
    });
    // ⚠️ A queixa da Vanessa era recoleta do que já tinha respondido. Sem esta
    // lista o modelo não vê o que já perguntou; com ela, vê.
    expect(e.perguntasRecentes.length).toBeGreaterThanOrEqual(2);
    expect(blocoDeEstado(e)).toMatch(/ja_perguntei_recentemente/);
    expect(blocoDeEstado(e)).toMatch(/Quantos anos/);
  });

  it("sem pergunta na última fala, diz nenhum", async () => {
    const e = await apurarEstadoDoTurno(db().cliente() as never, {
      familyId: FAM, membroId: MEMBRO, membroNome: "Manu",
      historico: [fala("outbound", "Fico feliz que tenha funcionado.")],
    });
    expect(e.perguntaPendente.conhecido).toBe("nenhum");
  });
});

describe("AJUDA ANTES DE INVESTIGAR", () => {
  it("uma fala longa da Ayla conta como orientação já dada", async () => {
    const e = await apurarEstadoDoTurno(db().cliente() as never, {
      familyId: FAM, membroId: MEMBRO, membroNome: "Manu",
      historico: [fala("outbound", "x".repeat(250))],
    });
    expect(e.jaOrientouNestaConversa).toBe(true);
  });
  it("só perguntas curtas não contam como orientação", async () => {
    const e = await apurarEstadoDoTurno(db().cliente() as never, {
      familyId: FAM, membroId: MEMBRO, membroNome: "Manu",
      historico: [fala("outbound", "Quantos anos ele tem?"), fala("inbound", "6")],
    });
    expect(e.jaOrientouNestaConversa).toBe(false);
  });
});

describe("FALHA DE LEITURA NÃO DERRUBA O TURNO", () => {
  it("consulta que falha vira não rastreado, e o estado ainda sai", async () => {
    const cliente = {
      from: () => {
        throw new Error("banco fora do ar");
      },
    };
    const e = await apurarEstadoDoTurno(cliente as never, {
      familyId: FAM, membroId: MEMBRO, membroNome: "Manu",
      historico: [fala("outbound", "Qual a maior dificuldade hoje?")],
    });
    // ⚠️ FALHA ABERTO. A família que escreveu tem que receber resposta mesmo
    // quando uma consulta cai — com menos memória, nunca com silêncio.
    expect(e.artefatoPendente.conhecido).toBe("nao_rastreado");
    expect(e.perguntaPendente.conhecido).toBe("sim");
    expect(blocoDeEstado(e)).toContain("<estado>");
  });
});

describe("O BLOCO É ESTRUTURADO, NÃO PROSA", () => {
  it("todo campo aparece com rótulo, mesmo vazio", async () => {
    const bloco = blocoDeEstado(
      await apurarEstadoDoTurno(db().cliente() as never, {
        familyId: FAM, membroId: MEMBRO, membroNome: "Manu", historico: [],
      }),
    );
    for (const campo of [
      "sujeito", "pergunta_pendente", "oferta_pendente", "ja_orientou_nesta_conversa",
      "estrategia_em_acompanhamento", "resultado_da_estrategia", "artefato_pendente",
      "correcoes_da_familia",
    ]) {
      // ⚠️ A AUSÊNCIA DE UMA LINHA SERIA LIDA COMO AUSÊNCIA DO FATO. Por isso
      // todo campo sai escrito, inclusive quando o valor é "nenhum".
      expect(bloco).toMatch(new RegExp(`${campo}:`));
    }
    expect(bloco.startsWith("<estado>")).toBe(true);
    expect(bloco.trimEnd().endsWith("</estado>")).toBe(true);
  });
});

/**
 * ⚠️ TESTE ESTRUTURAL — prende a DECISÃO de que o estado chega ao modelo.
 * Ele quebra no dia em que alguém desligar a ligação, que é o único jeito de
 * este módulo inteiro virar código morto sem ninguém perceber.
 */
describe("o estado chega mesmo ao prompt do GPT", () => {
  const EXP = readFileSync(new URL("../ayla/experimental.ts", import.meta.url), "utf8");
  it("experimental.ts apura e injeta o estado", () => {
    expect(EXP).toMatch(/apurarEstadoDoTurno\(/);
    expect(EXP).toMatch(/blocoDeEstado\(estado\)/);
  });
  it("o estado entra no bloco, junto da continuidade", () => {
    expect(EXP).toMatch(/\[\.\.\.partes, continuidade, blocoDeEstado\(estado\)\]/);
  });
});
