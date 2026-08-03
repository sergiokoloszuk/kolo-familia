import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CRITERIO_TAMANHO_ROTINA } from "./prontidao-rotina";
import { pediuRotinaExplicitamente, pediuParaImprimir } from "./rotina-guiada";
import { ORIENTACAO_DE_TRANSICAO } from "@/lib/conducao/formas";

/**
 * A MENOR AJUDA SUFICIENTE.
 *
 * A decisão existia mas ninguém a tomava. "Todo dia dá briga pra sair do
 * videogame" caía em `nao_e_rotina` e a família ficava com o que o modelo
 * improvisasse. Do outro lado só havia um tamanho: rotina inteira, com PDF
 * automático e cartões disparados por existir um tema.
 *
 * Três tamanhos, com um piso: quem pede rotina com todas as letras recebe
 * rotina.
 */

const PRONTIDAO = readFileSync(resolve(__dirname, "prontidao-rotina.ts"), "utf8");
const GUIADA = readFileSync(resolve(__dirname, "rotina-guiada.ts"), "utf8");
const SERVICO = readFileSync(resolve(__dirname, "../ludico/rotina-servico.ts"), "utf8");

describe("o critério de tamanho", () => {
  it("define os três, e o menor primeiro", () => {
    expect(CRITERIO_TAMANHO_ROTINA).toMatch(/MENOR que resolve/);
    expect(CRITERIO_TAMANHO_ROTINA).toMatch(/"orientacao"[^\n]*ANTES, DURANTE e DEPOIS/);
    expect(CRITERIO_TAMANHO_ROTINA).toMatch(/"mini"[^\n]*2 a 4 etapas/);
    expect(CRITERIO_TAMANHO_ROTINA).toMatch(/"rotina"[^\n]*várias atividades/);
  });

  it("proíbe rebaixar pedido explícito, mas libera sugerir", () => {
    expect(CRITERIO_TAMANHO_ROTINA).toMatch(/PEDIDO EXPLÍCITO NÃO SE REBAIXA/);
    expect(CRITERIO_TAMANHO_ROTINA).toMatch(/DIGA isso na conversa e deixe a família escolher/);
  });

  it("transição difícil deixa de cair fora — vira orientação", () => {
    expect(PRONTIDAO).toMatch(/UMA TRANSIÇÃO DIFÍCIL NÃO É "nao_e_rotina"/);
    expect(PRONTIDAO).toMatch(/sair do videogame/);
  });

  it("tema não é motivo pra cartão, e está escrito no critério do visual", () => {
    expect(PRONTIDAO).toMatch(/Não marque true só porque existe um interesse/);
  });
});

// ============================================================
// O FALLBACK — nunca reduzir por acidente
// ============================================================

describe("tamanho inválido cai em rotina, nunca em orientação", () => {
  it("o parse só aceita os três, e o resto vira rotina", () => {
    expect(PRONTIDAO).toMatch(
      /t === "orientacao" \|\| t === "mini" \|\| t === "rotina" \? t : "rotina"/,
    );
  });

  it("falha de consulta também devolve rotina", () => {
    // SEGURO() é o retorno de toda exceção e de todo JSON ilegível.
    expect(PRONTIDAO).toMatch(/desfecho: "falta",\n\s*\/\/[\s\S]{0,200}?tamanho: "rotina"/);
  });

  it("o motivo está escrito onde alguém vai ler antes de mexer", () => {
    expect(PRONTIDAO).toMatch(/O erro barato é entregar mais/);
  });
});

// ============================================================
// O PISO — determinístico, não confiado ao modelo
// ============================================================

describe("pedido explícito não é rebaixado", () => {
  const PEDE = [
    "quero uma rotina",
    "monta a rotina da tarde",
    "Quero organizar a tarde da Manu",
    "quero uma rotina visual",
    "preciso de uma rotina pro meu filho",
    "me ajuda a montar a rotina da manhã",
    "quero organizar o dia dele",
    "faz um quadro de rotina",
  ];
  for (const t of PEDE) {
    it(`piso em ${JSON.stringify(t)}`, () => expect(pediuRotinaExplicitamente(t)).toBe(true));
  }

  const NAO_PEDE = [
    "todo dia dá briga quando tiro o videogame pra ir pro banho",
    "ela demora pra sair de casa, mas quando aviso com antecedência ela vai",
    "ele não come nada além de macarrão",
    "hoje foi um dia horrível",
  ];
  for (const t of NAO_PEDE) {
    it(`sem piso em ${JSON.stringify(t)}`, () => expect(pediuRotinaExplicitamente(t)).toBe(false));
  }

  it("e o pedido explícito ENTRA no fluxo — medido, não suposto", () => {
    const ORCH = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");
    // "quero organizar a tarde da Manu" dá false em `pedeRotina` (não tem a
    // palavra "rotina") e "outro" no classificador. Sem esta linha, o pedido
    // mais explícito que existe não chegava no condutor.
    expect(ORCH).toMatch(/pediuRotinaExplicitamente\(inbound\.texto\)/);
  });

  it("o piso roda no condutor, e o log diz quando ele agiu", () => {
    expect(GUIADA).toMatch(/const tamanho = pedidoExplicito \? "rotina" : prontidao\.tamanho/);
    expect(GUIADA).toMatch(/piso: modelo disse/);
  });
});

// ============================================================
// ORIENTAÇÃO — nada é montado
// ============================================================

describe("orientação não gera artefato nenhum", () => {
  it("tem os três momentos, e proíbe o resto", () => {
    expect(ORIENTACAO_DE_TRANSICAO).toMatch(/ANTES — /);
    expect(ORIENTACAO_DE_TRANSICAO).toMatch(/DURANTE — /);
    expect(ORIENTACAO_DE_TRANSICAO).toMatch(/DEPOIS — /);
    expect(ORIENTACAO_DE_TRANSICAO).toMatch(
      /Não monte rotina, não fale em cartões, não ofereça PDF, não peça mais dados/,
    );
  });

  it("dá a frase pronta e não explica o cérebro", () => {
    expect(ORIENTACAO_DE_TRANSICAO).toMatch(/Dê a frase pronta, curta/);
    expect(ORIENTACAO_DE_TRANSICAO).toMatch(/Nada de explicar como o cérebro funciona/);
  });

  it("pode sugerir subir de tamanho, mas não sobe sozinha", () => {
    expect(ORIENTACAO_DE_TRANSICAO).toMatch(/deixe ela escolher — não monte por conta própria/);
  });

  it("`pronto` é forçado a false: quem decide o tamanho não é quem escreve", () => {
    expect(GUIADA).toMatch(
      /const pronto = !soOrientacao && \(acao === "montar" \|\| parsed\?\.pronto === true\)/,
    );
  });

  it("a forma vive em formas.ts, fora do núcleo", () => {
    expect(GUIADA).toMatch(/import \{ ORIENTACAO_DE_TRANSICAO \} from "@\/lib\/conducao\/formas"/);
  });
});

// ============================================================
// MINI — mesma rotina, menos etapas
// ============================================================

describe("mini não é um segundo sistema", () => {
  it("passa pelo mesmo gerador e pela mesma validação", () => {
    // Se `mini` tivesse gerador próprio, haveria outro import aqui.
    expect(SERVICO).toMatch(/const proposta = await interpretarRotina\(supabase, \{/);
    expect(SERVICO).toMatch(/const veredito = validarRotina\(\{/);
    // Uma chamada só — duas seriam dois geradores de novo.
    expect(SERVICO.match(/await interpretarRotina\(/g)?.length).toBe(1);
  });

  it("entra como instrução, pelo mesmo canal do ponto difícil", () => {
    expect(SERVICO).toMatch(/if \(params\.tamanho === "mini"\)/);
    expect(SERVICO).toMatch(/monte SÓ a passagem que trava, de 2 a 4 etapas/);
    expect(SERVICO).toMatch(/é instrução\n\s*\/\/ ao gerador, não um tipo novo de artefato/);
  });

  it("mini implica visual — sem ver a sequência ela não existe", () => {
    expect(PRONTIDAO).toMatch(/visual: tamanho === "mini" \? true : o\.visual === true/);
  });
});

// ============================================================
// PDF E CARTÕES — por necessidade, não por canal nem por tema
// ============================================================

describe("PDF deixou de ser automático", () => {
  const QUER = [
    "quero imprimir pra colar na geladeira",
    "me manda em PDF",
    "dá pra imprimir?",
    "queria colar na parede",
  ];
  for (const t of QUER) {
    it(`detecta ${JSON.stringify(t)}`, () => expect(pediuParaImprimir(t)).toBe(true));
  }

  it("não sai só porque o canal é WhatsApp", () => {
    expect(GUIADA).toMatch(/if \(params\.phoneE164 && querImprimir\)/);
    expect(GUIADA).not.toMatch(/if \(params\.phoneE164\) \{\n\s*await entregarPdfDaRotina/);
  });

  it("a fala não anuncia PDF que não saiu — e oferece quando não saiu", () => {
    expect(GUIADA).toMatch(/const impresso = querImprimir/);
    expect(GUIADA).toMatch(/se quiser imprimir pra colar na parede, eu te mando em PDF/);
    expect(GUIADA).toMatch(/NÃO diga que mandou PDF/);
  });
});

describe("cartões saem por necessidade visual, não por tema", () => {
  it("o gatilho é `visual`", () => {
    expect(GUIADA).toMatch(/if \(!temSemana && prontidao\.visual && ids\.length\)/);
    expect(GUIADA).not.toMatch(/if \(!temSemana && tema && ids\.length\)/);
  });

  it("sem tema o cartão ainda existe — tema é personalização", () => {
    expect(GUIADA).toMatch(/dispararGeracao\(id, tema \?\? ""\)/);
    expect(GUIADA).toMatch(/o cartão existe quando VER a sequência ajuda/);
  });

  it("a atividade vem antes da estética", () => {
    expect(GUIADA).toMatch(/primeiro se entende que é BANHO, depois é que ele é um dinossauro/);
  });
});

// ============================================================
// "SEMPRE ENTREGA" GANHOU A SEGUNDA METADE
// ============================================================

describe("entregar é resolver, não é gerar artefato", () => {
  it("o contrato diz as duas coisas — e continua mandando montar quando dá", () => {
    expect(GUIADA).toMatch(/AYLA SEMPRE ENTREGA — ajuda útil, não necessariamente artefato/);
    expect(GUIADA).toMatch(/NÃO quer dizer gerar um quadro em toda conversa/);
    // A metade que matou o interrogatório NÃO pode ter sumido.
    expect(GUIADA).toMatch(/Se já dá pra montar uma primeira versão, MONTE/);
  });
});

// ============================================================
// APRENDIZADO
// ============================================================

describe("a pergunta depois do uso", () => {
  const ORCH = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");

  it("pergunta onde funcionou e onde travou — não 'gostou?'", () => {
    expect(ORCH).toMatch(/onde funcionou, e onde ainda travou/);
    expect(ORCH).not.toMatch(/Me conta o que você achou — e se ficou com a cara/);
  });

  it("promete preservar o que funcionou", () => {
    expect(ORCH).toMatch(/O que estiver bom eu mantenho, e a gente mexe só no ponto que precisa/);
  });
});
