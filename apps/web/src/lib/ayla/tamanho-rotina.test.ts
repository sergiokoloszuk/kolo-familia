import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CRITERIO_TAMANHO_ROTINA } from "./prontidao-rotina";
import { pediuRotinaExplicitamente, pediuParaImprimir, pediuApoioVisual } from "./rotina-guiada";
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
    expect(PRONTIDAO).toMatch(/Tema e interesse também não são motivo/);
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
    expect(GUIADA).toMatch(/const pronto = !soOrientacao &&/);
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
    expect(GUIADA).toMatch(/if \(!temSemana && visual && tema && ids\.length\)/);
    // O gatilho antigo era o tema sozinho — o interesse virando artefato.
    expect(GUIADA).not.toMatch(/if \(!temSemana && tema && ids\.length\)/);
  });

  it("sem tema o cartão NÃO sai em silêncio — vira pergunta", () => {
    // O gerador recusa tema com menos de 2 caracteres. Disparar sem tema era
    // um 400 silencioso: a mãe esperava as imagens e elas nunca chegavam.
    expect(GUIADA).toMatch(/const faltaTema = !temSemana && visual && ids\.length > 0 && !tema/);
    expect(GUIADA).toMatch(/eu transformo isso em cartões ilustrados/);
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

// ============================================================
// UMA DECISÃO SÓ — suficiente monta, ponto
// ============================================================

describe("suficiente gera, sem segundo julgamento", () => {
  it("deveMontar nasce da prontidão, não do condutor", () => {
    expect(GUIADA).toMatch(
      /const deveMontar = prontidao\.desfecho === "suficiente" && !soOrientacao/,
    );
    expect(GUIADA).toMatch(/const pronto = !soOrientacao && \(deveMontar \|\|/);
  });

  it("a instrução proíbe perguntar quando já dá pra montar", () => {
    expect(GUIADA).toMatch(/acao="montar", obrigatoriamente/);
    expect(GUIADA).toMatch(/NÃO faça mais nenhuma pergunta neste turno/);
    expect(GUIADA).toMatch(/enriquecem, mas NÃO seguram a entrega/);
  });

  it("se o modelo perguntar mesmo assim, a pergunta não vai junto da entrega", () => {
    expect(GUIADA).toMatch(/if \(deveMontar && acao !== "montar"\)/);
    expect(GUIADA).toMatch(/montando assim mesmo/);
  });

  it("orientação continua imune — ali `pronto` nunca é true", () => {
    // deveMontar exclui orientação por construção; sem isso, o piso de
    // "suficiente" passaria por cima do menor tamanho.
    expect(GUIADA).toMatch(/deveMontar = prontidao\.desfecho === "suficiente" && !soOrientacao/);
  });
});

// ============================================================
// O CLASSIFICADOR — reconhece a necessidade, não decide a ferramenta
// ============================================================

describe("intenção de organização", () => {
  const INTENT = readFileSync(resolve(__dirname, "intent.ts"), "utf8");
  const ORCH = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");

  it("existe como intenção, com os exemplos reais", () => {
    expect(INTENT).toMatch(/\| "organizacao"/);
    expect(INTENT).toMatch(/ele não entende o que vem depois/);
    expect(INTENT).toMatch(/preciso que ele veja primeiro banho e depois história/);
  });

  it("NÃO decide que precisa de rotina — diz só qual é o assunto", () => {
    expect(INTENT).toMatch(/Isto NÃO decide que ela precisa de uma rotina/);
    expect(INTENT).toMatch(/Quem escolhe é a etapa seguinte/);
  });

  it("episódio isolado continua sendo conversa", () => {
    expect(INTENT).toMatch(/ele fez uma birra enorme no banho hoje.*= outro/);
    expect(INTENT).toMatch(/padrão que se repete é organizacao/);
  });

  it("entra na MESMA capacidade — não abre uma segunda", () => {
    expect(ORCH).toMatch(/intent === "organizacao" \|\|/);
    // Um só bloco de rotina no roteamento: se houvesse dois, seriam duas portas.
    expect(ORCH.match(/const r = await conduzirRotina\(/g)?.length).toBe(1);
  });
});

describe("caso 4 — quem já trouxe a situação não recebe menu", () => {
  it("o critério corrige a semântica de falta_escopo", () => {
    expect(PRONTIDAO).toMatch(/"falta_escopo" É SÓ PRA QUEM PEDIU E NÃO DISSE O QUÊ/);
    expect(PRONTIDAO).toMatch(/ela demora pra sair de casa, mas quando aviso antes ela vai/);
    expect(PRONTIDAO).toMatch(/vender ferramenta em vez de ajudar/);
  });

  it("a orientação preserva o que a família já descobriu", () => {
    expect(ORIENTACAO_DE_TRANSICAO).toMatch(/SE ELA JÁ CONTOU ALGO QUE FUNCIONA/);
    expect(ORIENTACAO_DE_TRANSICAO).toMatch(/não acrescentaria quadro nenhum agora/);
  });
});

// ============================================================
// PEDIR ROTINA NÃO É PEDIR CARTÃO
// ============================================================

describe("o visual é decisão própria", () => {
  it("o critério proíbe inferir do diagnóstico e da transição difícil", () => {
    expect(PRONTIDAO).toMatch(/NÃO INFIRA DO DIAGNÓSTICO/);
    expect(PRONTIDAO).toMatch(/criança com TEA se beneficia de apoio visual" é o rótulo explicando a criança/);
    expect(PRONTIDAO).toMatch(/TRANSIÇÃO DIFÍCIL TAMBÉM NÃO É EVIDÊNCIA DE VISUAL/);
    expect(PRONTIDAO).toMatch(/PEDIR ROTINA NÃO É PEDIR CARTÃO/);
  });

  it("exige poder apontar onde a evidência está escrita", () => {
    expect(PRONTIDAO).toMatch(/Se você não consegue apontar ONDE leu isso, é false/);
    // O contraexemplo é o caso real que disparou cartões sem motivo.
    expect(PRONTIDAO).toMatch(/o banho costuma ser difícil" → visual FALSE/);
  });

  const PEDE_VISUAL = ["quero uma rotina visual da manhã", "manda com os cartões", "pode ser com figuras?", "quero em cards"];
  for (const t of PEDE_VISUAL) {
    it(`piso do visual em ${JSON.stringify(t)}`, () => expect(pediuApoioVisual(t)).toBe(true));
  }

  const NAO_PEDE = ["quero organizar a tarde da Manu", "monta a rotina da tarde", "o cardápio dele é curto", "ele descarta a comida nova"];
  for (const t of NAO_PEDE) {
    it(`sem piso do visual em ${JSON.stringify(t)}`, () => expect(pediuApoioVisual(t)).toBe(false));
  }

  it("o piso SOMA, nunca zera a evidência do perfil", () => {
    expect(GUIADA).toMatch(/const visual = prontidao.visual || historicoPediuVisual/);
    expect(GUIADA).toMatch(/não pedir com essas palavras não zera nada/);
  });

  it("os cartões disparam pelo visual resolvido, não pelo campo cru", () => {
    expect(GUIADA).toMatch(/if \(!temSemana && visual && tema && ids\.length\)/);
    expect(GUIADA).not.toMatch(/if \(!temSemana && prontidao\.visual/);
  });
});

// ============================================================
// O CASO DA DOCERIA — 04/08/2026
// ============================================================

describe("a mãe pediu visual e a oferta saiu dobrada", () => {
  it("o piso pega o PLURAL — foi assim que ela pediu", () => {
    // "Quero uma sequência de atividades visuais": /visual/ não casa com
    // "visuais", e o piso determinístico não disparou.
    expect(pediuApoioVisual("Quero uma sequência de atividades visuais")).toBe(true);
    expect(pediuApoioVisual("quero uma rotina visual")).toBe(true);
    // E o falso-positivo que já estava fechado continua fechado.
    expect(pediuApoioVisual("o cardápio dele é curto")).toBe(false);
  });

  it("se a Ayla já perguntou o tema, o sistema não pergunta de novo", () => {
    expect(GUIADA).toContain("i.test(mensagem)");
    expect(GUIADA).toContain("(faltaTema || ofereceCartoes) &&");
    expect(GUIADA).toMatch(/não pergunte de novo/);
  });

  it("nada de 'dele(a)' à mostra na fala", () => {
    expect(GUIADA).not.toMatch(/ele\(a\) ama/);
    expect(GUIADA).not.toMatch(/a cara dele\(a\)/);
  });
});

// ============================================================
// AVATAR — entrega primeiro, personagem depois
// ============================================================

describe("o avatar entra depois, com o cartão já na mão", () => {
  const ROTA = readFileSync(
    resolve(__dirname, "../../app/api/ludico/gerar-rotina/route.ts"),
    "utf8",
  );

  it("o caminho da Ayla deixou de passar usarAvatar:false fixo", () => {
    expect(ROTA).toMatch(/\{ tema, atividades, idade, nomeRotina, usarAvatar \}/);
    expect(ROTA).not.toMatch(/usarAvatar: false/);
  });

  it("se a criança tem avatar, ela é o personagem — sem pedir nada", () => {
    expect(ROTA).toMatch(/const usarAvatar = Boolean\(avatarUrl\)/);
    expect(ROTA).toMatch(/referenciaUrl: preservar \? \(mascoteAtual \?\? undefined\) : \(avatarUrl \?\? undefined\)/);
  });

  it("sem avatar, nada muda — ninguém fica sem cartão por isso", () => {
    expect(ROTA).toMatch(/se não existe, nada muda e o\n\s*\/\/ mascote temático continua/);
  });

  it("a edição preserva o personagem antigo — não troca no meio do caminho", () => {
    expect(ROTA).toMatch(/if \(membroId && !preservar\)/);
  });

  it("o convite só sai DEPOIS dos cartões, e só pra quem não tem avatar", () => {
    expect(GUIADA).toMatch(/autoGerou && !temAvatar/);
    expect(GUIADA).toMatch(/pode ser o personagem dos cartões/);
    expect(GUIADA).toMatch(/Pôr a criação do\n\s*\/\/ avatar ANTES da rotina seria uma etapa de setup/);
  });

  it("em falha da consulta, NÃO convida — sugerir criar o que existe é pior", () => {
    expect(GUIADA).toMatch(/Sem saber, NÃO convida/);
  });
});
