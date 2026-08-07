import { describe, it, expect } from "vitest";
import {
  acharConclusaoDiagnostica,
  confirmadosDoBloco,
} from "./deteccao-diagnostico";
import { fronteiraAtravessada } from "./fronteiras";
import { blocoDiagnosticoRegistrado } from "@/lib/onboarding/diagnostico";

/**
 * O DETECTOR PASSA A CONHECER O QUE A FAMÍLIA JÁ INFORMOU — 06/08/2026.
 *
 * O núcleo separa (A) diagnóstico já registrado, (B) diagnóstico novo e (C)
 * causalidade. O detector não separava nada: rodava sobre o texto puro e tratava
 * "o laudo confirma o TEA que já estava no perfil" igual a "pelo que você
 * contou, ela tem TEA".
 *
 * Custo real: uma mãe mandou o laudo da filha, a Ayla leu, o detector derrubou,
 * a regeneração também, e o piso respondeu uma pergunta que ninguém fez. Duas
 * vezes na mesma conversa.
 *
 * O QUE ESTES TESTES PROTEGEM não é a permissão — é o limite dela. Cada bloco
 * "PERMITIDO" tem um "BLOQUEADO" gêmeo, com a mesma condição e o mesmo perfil,
 * mudando só quem está afirmando. Se a correção relaxar demais, é o par que
 * quebra.
 */

const codigos = (t: string, bloco?: string | null) =>
  acharConclusaoDiagnostica(t, { confirmados: confirmadosDoBloco(bloco) }).map((a) => a.codigo);

/**
 * Blocos REAIS, montados pela mesma função que alimenta o prompt — e no formato
 * que o banco guarda de verdade (`diagnosticos_formais` é um array de rótulos,
 * com "Hipótese: X" para o que ainda está em investigação).
 */
const COM_TEA_TDAH = blocoDiagnosticoRegistrado(["TEA", "TDAH"], "TEA", "Ana");
const SEM_NADA = blocoDiagnosticoRegistrado(["Em investigação"], "", "Ana");
const SO_HIPOTESE = blocoDiagnosticoRegistrado(
  ["Em investigação", "Hipótese: TEA"],
  "",
  "Ana",
);

describe("leitura do bloco de diagnóstico", () => {
  it("pega o confirmado e IGNORA a hipótese", () => {
    expect(confirmadosDoBloco(COM_TEA_TDAH).sort()).toEqual(["autismo", "tdah"]);
    // Hipótese é o caso (B) do núcleo: continua proibido concluir.
    expect(confirmadosDoBloco(SO_HIPOTESE)).toEqual([]);
    expect(confirmadosDoBloco(SEM_NADA)).toEqual([]);
    expect(confirmadosDoBloco(null)).toEqual([]);
  });

  it("TEA, autismo e autista são a mesma condição", () => {
    expect(confirmadosDoBloco(COM_TEA_TDAH)).toContain("autismo");
  });
});

describe("confirma_condicao — citar o registrado × concluir", () => {
  it("PERMITIDO: o laudo confirma o que já estava no perfil", () => {
    for (const t of [
      "O laudo confirma o TEA que já estava registrado no perfil dela.",
      "Esses documentos confirmam o que já tínhamos no perfil dela: TEA.",
      "O relatório médico confirma o TDAH que vocês já tinham informado.",
    ]) {
      expect(codigos(t, COM_TEA_TDAH), t).not.toContain("confirma_condicao");
    }
  });

  it("BLOQUEADO: a mesma frase quando a família NÃO informou nada", () => {
    // O par exato: muda só o perfil. Sem registro, confirmar é diagnosticar.
    const t = "Esses documentos confirmam o que já tínhamos no perfil dela: TEA.";
    expect(codigos(t, SEM_NADA)).toContain("confirma_condicao");
    expect(codigos(t, SO_HIPOTESE)).toContain("confirma_condicao");
  });

  it("BLOQUEADO: condição registrada não libera OUTRA condição", () => {
    // TEA e TDAH confirmados não autorizam fechar dislexia.
    const t = "O que você descreveu confirma dislexia.";
    expect(codigos(t, COM_TEA_TDAH)).toContain("confirma_condicao");
  });

  it("BLOQUEADO: concluir a partir do relato continua proibido", () => {
    for (const t of [
      "Pelo que você descreveu, ela tem TEA.",
      "Isso aponta para TDAH.",
    ]) {
      expect(codigos(t, COM_TEA_TDAH).length, t).toBeGreaterThan(0);
    }
  });
});

/**
 * ⚠️ LACUNAS QUE JÁ EXISTIAM — encontradas ao escrever os pares desta frente,
 * e deliberadamente NÃO corrigidas aqui.
 *
 * Estas frases estão PROIBIDAS no núcleo (a FRONTEIRA_DIAGNOSTICO cita "há
 * grandes chances" por nome) e o detector nunca as pegou — antes ou depois da
 * mudança. Não são regressão: conferi contra o comportamento anterior.
 *
 * Ficam registradas em teste, e não só num relatório, porque a rede é a última
 * linha de defesa e alguém precisa poder ver o buraco. Quando forem cobertas,
 * ESTE TESTE VAI FALHAR — e falhar aqui é a notícia boa: é só apagar o caso da
 * lista. Ampliar o vocabulário do detector é outra frente, com outra medição.
 */
describe("lacunas pré-existentes do detector (não corrigidas nesta frente)", () => {
  it("formas de conclusão que atravessam sem disparar", () => {
    for (const t of [
      "Há grandes chances de ser autismo.",
      "Há uma grande probabilidade de ser TEA.",
      "Isso indica TDAH.",
      "Eu diria que o diagnóstico é TEA.",
      "Pelo relato, o quadro dela é leve.",
    ]) {
      expect(codigos(t, SEM_NADA), t).toEqual([]);
    }
  });
});

describe("nivel_suporte — citar a graduação × graduar", () => {
  it("PERMITIDO: a graduação vem de um documento", () => {
    for (const t of [
      "O laudo registra TEA nível 1.",
      "No relatório consta nível 1 de suporte.",
      "A avaliação da neuropediatra descreve grau leve.",
    ]) {
      expect(codigos(t, COM_TEA_TDAH), t).not.toContain("nivel_suporte");
    }
  });

  it("BLOQUEADO: a Ayla graduando, mesmo com diagnóstico registrado", () => {
    for (const t of [
      "Ela é nível 1.",
      "Pelo comportamento, ela parece nível 1.",
      "Eu diria que é nível 2.",
    ]) {
      expect(codigos(t, COM_TEA_TDAH), t).toContain("nivel_suporte");
    }
  });

  it("BLOQUEADO: citar a fonte E concluir na mesma frase é concluir", () => {
    // A afirmação própria vence a fonte — senão bastaria dizer "laudo" antes.
    const t = "O laudo fala em suporte, e pelo que você conta ela é nível 2.";
    expect(codigos(t, COM_TEA_TDAH)).toContain("nivel_suporte");
  });

  it("BLOQUEADO: graduação sem fonte nenhuma continua disparando", () => {
    // Default conservador: na ausência de marcador, a fronteira vale.
    expect(codigos("É um caso de nível 1.", COM_TEA_TDAH)).toContain("nivel_suporte");
  });
});

describe("atribuicao_distribuida — o código mais ruidoso", () => {
  const repartindo = (a: string, b: string) =>
    `Algumas coisas que você descreveu vêm do ${a}; já outras, dela, são mais do ${b}.`;

  it("PERMITIDO: reparte entre condições que a família CADASTROU", () => {
    expect(codigos(repartindo("autismo", "TDAH"), COM_TEA_TDAH)).not.toContain(
      "atribuicao_distribuida",
    );
  });

  it("BLOQUEADO: a mesma frase sem nada registrado", () => {
    expect(codigos(repartindo("autismo", "TDAH"), SEM_NADA)).toContain(
      "atribuicao_distribuida",
    );
  });

  it("BLOQUEADO: basta UMA condição não registrada pra voltar a ser atribuição", () => {
    // TEA confirmado + ansiedade que ninguém informou = diagnóstico novo entrando
    // pela porta lateral. Este é o caso real da família com só TEA no perfil.
    expect(codigos(repartindo("autismo", "ansiedade"), COM_TEA_TDAH)).toContain(
      "atribuicao_distribuida",
    );
    expect(codigos(repartindo("ansiedade", "TOD"), COM_TEA_TDAH)).toContain(
      "atribuicao_distribuida",
    );
  });

  it("educação geral continua passando, como antes", () => {
    expect(
      codigos("Autismo e TDAH podem coexistir e têm características que se sobrepõem.", SEM_NADA),
    ).not.toContain("atribuicao_distribuida");
  });
});

describe("nada disso relaxa o resto da fronteira", () => {
  it("negação, metalinguagem e recusa seguem como estavam", () => {
    expect(codigos("Não diga que ela tem TDAH.", COM_TEA_TDAH)).toEqual([]);
    expect(codigos("Eu não consigo dizer se é ou não é autismo.", SEM_NADA)).toEqual([]);
  });

  it("os padrões fora desta frente não mudaram com o contexto", () => {
    for (const t of [
      "Isso não é autismo.",
      "O cérebro dela está reagindo a uma perda.",
      "Pelo que você descreveu, ela tem TEA.",
    ]) {
      const comBloco = codigos(t, COM_TEA_TDAH);
      const semBloco = codigos(t, SEM_NADA);
      expect(comBloco.length, t).toBeGreaterThan(0);
      // Só os três códigos desta frente podem divergir entre os dois contextos.
      const divergiu = [...new Set([...comBloco, ...semBloco])].filter(
        (c) => comBloco.includes(c) !== semBloco.includes(c),
      );
      for (const c of divergiu) {
        expect(
          ["confirma_condicao", "nivel_suporte", "caso_graduado", "atribuicao_distribuida"],
          `${t} → ${c}`,
        ).toContain(c);
      }
    }
  });
});

describe("a rede inteira, pelo caminho que os canais usam", () => {
  it("o caso real de produção deixa de cair no piso", () => {
    const respostaReal =
      "Recebi! Laudo bem completo. Os diagnósticos confirmam o que já tínhamos " +
      "no perfil dela: TEA, TDAH e ansiedade. O laudo registra TEA nível 1.";
    // "Ansiedade" não está no enum do onboarding: entra como "Outro" e o rótulo
    // livre vai pro bloco — que é exatamente o que o modelo lê.
    const bloco = blocoDiagnosticoRegistrado(["TEA", "TDAH", "Ansiedade"], "TEA", "Ana");
    expect(fronteiraAtravessada(respostaReal, bloco)).toBeNull();
    // E sem o bloco — família que não registrou nada — continua barrando.
    expect(fronteiraAtravessada(respostaReal, null)).not.toBeNull();
  });

  it("omitir o contexto mantém o comportamento antigo", () => {
    const t = "Esses documentos confirmam o que já tínhamos no perfil dela: TEA.";
    expect(fronteiraAtravessada(t)).not.toBeNull();
  });
});
