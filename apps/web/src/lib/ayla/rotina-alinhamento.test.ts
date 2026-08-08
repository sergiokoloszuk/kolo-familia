import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CRITERIO_TAMANHO_ROTINA } from "./prontidao-rotina";
import { ORIENTACAO_DE_TRANSICAO } from "@/lib/conducao/formas";

/**
 * ALINHAMENTO ANTES DE GERAR — os três estados.
 *
 * O produto tinha os dois extremos resolvidos e o meio não:
 *
 *   ESTADO 1 (pedido explícito e definido) → montava direto. Já funcionava, e
 *     a regra "PEDIDO EXPLÍCITO NÃO SE REBAIXA" protegia isso.
 *   ESTADO 3 (pedido amplo) → `falta_escopo`, oferecia caminhos. Existia, mas
 *     em prosa aberta.
 *   ESTADO 2 (problema claro, ordem desconhecida) → NÃO EXISTIA. Caía em
 *     `falta` e a Ayla PERGUNTAVA a sequência: "me conta como é a rotina
 *     dele". A mãe já tinha dito qual era o momento difícil; faltava a Ayla
 *     pensar por ela e propor.
 *
 * A escolha entre propor e perguntar é pelo TAMANHO, e isso é deliberado: uma
 * passagem curta se imagina pela dificuldade relatada; a manhã inteira de uma
 * casa que a gente não conhece, não. Propor um dia inteiro inventado seria
 * trocar um defeito por outro pior — a família corrigindo ficção.
 */

const GUIADA = readFileSync(resolve(__dirname, "rotina-guiada.ts"), "utf8");
const PRONTIDAO = readFileSync(resolve(__dirname, "prontidao-rotina.ts"), "utf8");
const ORCH = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");
const CORE = readFileSync(resolve(__dirname, "../ludico/rotina-ia-core.ts"), "utf8");
const MIGRACAO = readFileSync(
  resolve(__dirname, "../../../../../supabase/migrations/0075_rotina_resultado.sql"),
  "utf8",
);

// ============================================================
// O QUE JÁ EXISTIA — e não pode ser perdido nesta frente
// ============================================================

describe("preservado: a menor ajuda que resolve", () => {
  it("os três tamanhos continuam, com o menor primeiro", () => {
    expect(CRITERIO_TAMANHO_ROTINA).toMatch(/MENOR que resolve/);
    expect(CRITERIO_TAMANHO_ROTINA).toMatch(/"orientacao"[^\n]*ANTES, DURANTE e DEPOIS/);
    expect(CRITERIO_TAMANHO_ROTINA).toMatch(/"mini"[^\n]*2 a 4 etapas/);
    expect(CRITERIO_TAMANHO_ROTINA).toMatch(/"rotina"[^\n]*várias atividades/);
  });

  it("transição pode não virar artefato nenhum", () => {
    expect(ORIENTACAO_DE_TRANSICAO).toMatch(/Não monte rotina, não fale em cartões/);
    expect(ORIENTACAO_DE_TRANSICAO).toMatch(/ANTES/);
    expect(ORIENTACAO_DE_TRANSICAO).toMatch(/DURANTE/);
    expect(ORIENTACAO_DE_TRANSICAO).toMatch(/DEPOIS/);
  });

  it("mini continua sendo 2 a 4 etapas, sem esticar pro resto do dia", () => {
    expect(GUIADA).toMatch(/Monte de 2 a 4 etapas, só o trecho que trava/);
    expect(GUIADA).toMatch(/Não estenda pro resto do dia/);
  });

  it("pedido explícito não se rebaixa nem pede confirmação redundante", () => {
    // Testes 3, 4 e 15 do briefing: quem já disse os cards recebe os cards.
    expect(CRITERIO_TAMANHO_ROTINA).toMatch(/PEDIDO EXPLÍCITO NÃO SE REBAIXA/);
    expect(GUIADA).toMatch(/JÁ DÁ PRA MONTAR[\s\S]{0,200}NÃO faça mais nenhuma pergunta neste turno/);
  });

  it("o portão de publicação continua: ou está boa, ou não se publica", () => {
    const VALIDACAO = readFileSync(resolve(__dirname, "validacao-rotina.ts"), "utf8");
    expect(VALIDACAO).toMatch(/Não existe "piso" de rotina/);
    expect(VALIDACAO).toMatch(/manejo_clinico/);
  });

  // ATUALIZADO em 08/08/2026 (D-R4): o recorte deixou de ser só "pedaço do
  // dia" e passou a aceitar acontecimento único. A exigência em si NÃO caiu —
  // continua sendo recorte + sequência, e é isso que este teste guarda.
  it("o portão de suficiência continua exigindo recorte + sequência", () => {
    expect(PRONTIDAO).toMatch(/QUAL RECORTE/);
    expect(PRONTIDAO).toMatch(/PEDAÇO DO DIA/);
    expect(PRONTIDAO).toMatch(/ACONTECIMENTO/);
    expect(PRONTIDAO).toMatch(/UMA SEQUÊNCIA/);
  });
});

// ============================================================
// ESTADO 2 — o que esta frente acrescenta
// ============================================================

describe("estado 2: propõe o recorte em vez de perguntar a ordem", () => {
  it("a decisão existe e é separada do resto", () => {
    expect(GUIADA).toMatch(/const faltaSequencia =/);
  });

  it("numa passagem curta, PROPÕE — e não monta ainda", () => {
    expect(GUIADA).toMatch(/faltaSequencia && tamanho === "mini"/);
    expect(GUIADA).toMatch(/NÃO pergunte "como é a rotina dele" — PROPONHA/);
    expect(GUIADA).toMatch(/NÃO monte neste turno: acao="perguntar"/);
  });

  it("a proposta pede confirmação de UMA coisa: a ordem", () => {
    expect(GUIADA).toMatch(/feche perguntando se a ordem bate com a casa dela/);
    expect(GUIADA).toMatch(/3 a 5 etapas/);
  });

  it("num período inteiro, continua PERGUNTANDO a sequência", () => {
    // Inventar a manhã de uma casa desconhecida seria a família corrigindo
    // ficção — pior que a pergunta.
    expect(GUIADA).toMatch(/faltaSequencia && tamanho !== "mini"/);
    expect(GUIADA).toMatch(/O QUE FALTA É A SEQUÊNCIA/);
  });

  it("a pergunta genérica não compete com a proposta no mesmo turno", () => {
    // Duas instruções de "pergunte" no mesmo prompt = a Ayla faz as duas.
    expect(GUIADA).toMatch(/&& !\(faltaSequencia && tamanho === "mini"\)/);
  });
});

describe("estado 3: uma pergunta discriminativa, não uma aberta", () => {
  it("oferece opções numeradas em vez de 'como é a rotina dele?'", () => {
    expect(GUIADA).toMatch(/UMA pergunta DISCRIMINATIVA, com opções curtas e numeradas/);
    expect(GUIADA).toMatch(/responder com um número/);
  });

  it("continua não perguntando dado nenhum nesse turno", () => {
    expect(GUIADA).toMatch(/NÃO pergunte dado nenhum — nem idade, nem horário/);
  });
});

// ============================================================
// COMBINADO VISUAL — variação do mini, sem tabela nova
// ============================================================

describe("combinado visual", () => {
  it("é a mesma sequência curta, não um produto novo", () => {
    expect(GUIADA).toMatch(/é uma sequência curta como qualquer outra/);
    expect(GUIADA).toMatch(/Não anuncie como produto diferente/);
  });

  it("escreve o que fazer, não o que não fazer", () => {
    expect(GUIADA).toMatch(/ESCREVA O QUE FAZER, NÃO O QUE NÃO FAZER/);
    expect(GUIADA).toMatch(/ficar perto/);
    expect(GUIADA).toMatch(/mãos no carrinho/);
  });

  it("tem um depois, e não vira barganha", () => {
    expect(GUIADA).toMatch(/O COMBINADO PRECISA TER UM DEPOIS/);
    expect(GUIADA).toMatch(/não prêmio por obedecer/);
  });

  it("com adolescente ou adulto, constrói COM a pessoa", () => {
    expect(GUIADA).toMatch(/COM ADOLESCENTE OU ADULTO, construa COM a pessoa/);
  });
});

// ============================================================
// SEMANA ≠ ROTINA
// ============================================================

describe("visão da semana", () => {
  it("é distinguida da rotina do dia, com os dois exemplos", () => {
    expect(GUIADA).toMatch(/VISÃO DA SEMANA ≠ ROTINA DO DIA/);
    expect(GUIADA).toMatch(/Em quais dias tem terapia/);
    expect(GUIADA).toMatch(/Como ele se arruma de manhã/);
  });

  it("dia da semana leva POUCAS entradas — compromisso, não tarefa", () => {
    expect(GUIADA).toMatch(/cada dia leva POUCAS entradas/);
    expect(GUIADA).toMatch(/Não encha os dias de tarefas/);
  });

  it("dia difícil vira detalhe daquele dia, não reconstrução da semana", () => {
    expect(GUIADA).toMatch(/ofereça detalhar SÓ AQUELE DIA/);
    expect(GUIADA).toMatch(/Não reconstrua a semana inteira/);
  });

  it("não promete calendário visual que não existe — reusa os dias", () => {
    // A estrutura semanal é 7 rotinas (uma por dia). Nada de produto novo.
    // A regra vive no GERADOR desde 08/08/2026: o condutor deixou de compor,
    // então descrever o formato do dado no contrato dele era regra duplicada —
    // e as duas versões já divergiam sobre o que é "dia avulso".
    expect(CORE).toMatch(/dia_semana: 0=Segunda/);
    expect(GUIADA).not.toMatch(/dia_semana: 0=Seg\.\.6=Dom/);
  });
});

// ============================================================
// FOLLOW-UP — uma vez, e só uma
// ============================================================

describe("a sequência ajudou? — no máximo uma retomada", () => {
  it("existe o envio, espelhando o do plano", () => {
    expect(ORCH).toMatch(/export async function sendRotinaSeguimento/);
    expect(ORCH).toMatch(/tipo: "rotina_seguimento"/);
  });

  it("marca seguimento_enviado_em no envio — é isso que garante 'uma vez'", () => {
    expect(ORCH).toMatch(/\.from\("rotinas"\)\s*\n?\s*\.update\(\{ seguimento_enviado_em/);
  });

  it("só marca quando o envio foi aceito, nunca antes", () => {
    const trecho = ORCH.slice(ORCH.indexOf("export async function sendRotinaSeguimento"));
    expect(trecho.indexOf("if (r.enviada)")).toBeLessThan(trecho.indexOf("seguimento_enviado_em:"));
  });

  it("sem link real, não manda — pergunta sem caminho é cobrança", () => {
    expect(ORCH).toMatch(/Não consegui gerar o link da rotina/);
  });

  it("pergunta o que MUDOU, não se gostou", () => {
    expect(ORCH).toMatch(/facilitou alguma parte/);
    expect(ORCH).not.toMatch(/aquela sequência[^\n]*gostou/i);
  });
});

describe("a migração 0075", () => {
  it("é aditiva e anulável — nenhuma linha existente muda", () => {
    expect(MIGRACAO).toMatch(/add column if not exists resultado text/);
    expect(MIGRACAO).toMatch(/add column if not exists seguimento_enviado_em timestamptz/);
    expect(MIGRACAO).not.toMatch(/not null/i);
  });

  it("usa o MESMO vocabulário de planos, não um segundo", () => {
    for (const v of ["funcionou", "parcial", "nao_funcionou", "nao_testou"])
      expect(MIGRACAO).toContain(v);
  });

  it("documenta por que transicoes[].funcionou não bastava", () => {
    // Se alguém pensar em remover as colunas, o motivo tem que estar ali.
    expect(MIGRACAO).toMatch(/transicoes\[\]\.funcionou/);
    expect(MIGRACAO).toMatch(/não guarda se JÁ perguntamos/);
  });

  it("traz o rollback escrito", () => {
    expect(MIGRACAO).toMatch(/ROLLBACK/);
    expect(MIGRACAO).toMatch(/drop column if exists seguimento_enviado_em/);
  });

  it("o índice parcial cobre exatamente a fila do follow-up", () => {
    expect(MIGRACAO).toMatch(/where resultado is null and seguimento_enviado_em is null/);
  });
});

// ============================================================
// VERDADE OPERACIONAL — preservada
// ============================================================

describe("verdade operacional", () => {
  it("não anuncia arquivo que não saiu", () => {
    expect(GUIADA).toMatch(/NUNCA diga "está pronta" antes de existir/);
    expect(GUIADA).toMatch(/NÃO diga que mandou PDF/);
  });

  it("quem anexa link e PDF é o sistema, depois da fala dela", () => {
    expect(GUIADA).toMatch(/o sistema anexa o link, e cuida sozinho de cartões e PDF/);
    expect(GUIADA).toMatch(/no passado, não no futuro/);
  });
});

// ============================================================
// A ROTINA QUE CHEGOU EM BRANCO (Manu, 07/08/2026)
// ============================================================

/**
 * ⚠️ ESTE BLOCO MUDOU DE LADO EM 08/08/2026, de propósito.
 *
 * Ele travava a política de 03/08: com interesse conhecido, a Ayla ESCOLHIA o
 * tema calada. A política foi revertida pelo Sérgio — o tema é da ROTINA, não
 * atributo fixo da criança, e o interesse serve pra SUGERIR, não pra decidir
 * pela família (restaura a decisão de 22/07, validada em role-play com a
 * Karina). O que fazia "perguntar" ser ruim não era a pergunta: era `tema=null`
 * significar abandono silencioso. Isso agora tem estado ('aguardando') e
 * gatilho determinístico, então a pergunta deixou de ser um beco sem saída.
 */
describe("o tema é escolha da família — e quem pergunta é o CÓDIGO", () => {
  /**
   * ⚠️ MUDOU DE DONO EM 08/08/2026. Este bloco travava as instruções que
   * mandavam o MODELO propor o tema. Mas "falta tema?" é estado do artefato,
   * não decisão conversacional — e com dois donos a pergunta saía na fala do
   * modelo, ANTES da sequência. Agora o modelo está proibido de tocar no
   * assunto e a pergunta é do código, depois do quadro.
   */
  it("o modelo NÃO pergunta tema", () => {
    expect(GUIADA).toMatch(/TEMA dos cartões NÃO é assunto seu/);
    expect(GUIADA).toMatch(/Você não oferece tema, não pergunta tema/);
    expect(GUIADA).not.toMatch(/Ofereça no máximo DUAS dessas como sugestão/);
  });

  it("o código pergunta, com no máximo duas sugestões dos interesses REAIS", () => {
    expect(GUIADA).toMatch(/Falta só escolher o tema dos cartões/);
    expect(GUIADA).toMatch(/sugestoesDeTema/);
    expect(GUIADA).toMatch(/\.slice\(0, 2\)/);
  });

  it("deixa claro que ela pode escolher qualquer outro tema", () => {
    expect(GUIADA).toMatch(/ou qualquer outro que \$\{nome\} esteja gostando agora/);
  });

  it("sem interesse conhecido, o convite fica aberto", () => {
    expect(GUIADA).toMatch(/Me fala um tema que \$\{nome\} ama/);
  });

  it("a geração dispara com tema — e pela MESMA condição que pergunta", () => {
    expect(GUIADA).toMatch(/const faltaTema = visual && ids\.length > 0 && !tema/);
    expect(GUIADA).toMatch(/if \(visual && tema && ids\.length\)/);
    // o `!temSemana` era o buraco: perguntava e não guardava pendência
    expect(GUIADA).not.toMatch(/!temSemana && visual && tema/);
  });
});

describe("o título diz o que acontece no dia", () => {
  it("não aceita 'Amanhã' nem o nome do dia sozinho", () => {
    // "Amanhã" não diz nada quando a mãe abre a lista três dias depois.
    // A regra MUDOU DE LUGAR em 08/08/2026, junto com a autoria: quem nomeia é
    // quem compõe. E o gerador dizia o CONTRÁRIO — sugeria "Segunda" como bom
    // nome, enquanto o condutor proibia. Uma regra, no lugar que decide.
    expect(CORE).toMatch(/O NOME DIZ O QUE ACONTECE NAQUELE DIA, não a data/);
    expect(CORE).toMatch(/nunca "Amanhã" ou "Sábado" sozinhos/);
    expect(CORE).not.toMatch(/NOME LIVRE/);
  });
});
