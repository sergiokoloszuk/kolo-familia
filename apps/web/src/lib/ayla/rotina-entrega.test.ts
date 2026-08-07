import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * A AYLA SEMPRE ENTREGA — os três casos reais que motivaram esta frente.
 *
 * MATEUS (01/08/2026): a mãe descreveu a sequência do dia inteiro e perguntou
 *   "qual horário você acha melhor pra encaixar o iPad?". A Ayla devolveu a
 *   próxima pergunta do roteiro. Ela tinha tudo pra responder e não respondeu.
 *
 * MARIA IASMIN (02/08/2026): a Ayla re-perguntou o que a família já tinha
 *   marcado no cadastro — porque `desafios_onboarding` só era lido no [0] e só
 *   pra escolher a template de boas-vindas, nunca chegava à conversa.
 *
 * PRIMEIRA EXPERIÊNCIA: quem chega e pede uma rotina precisa SAIR com uma
 *   rotina, não com um formulário. Se dá pra montar uma primeira versão, monta.
 *
 * Estes são testes de CONTRATO sobre o fonte: as funções envolvidas fazem
 * chamada de modelo e consulta ao banco, e não são isoláveis sem montar um
 * duplo do Supabase inteiro. O que precisa não regredir é o que está escrito no
 * prompt e na montagem do contexto — e isso é verificável aqui.
 */
const ROTINA = readFileSync(resolve(__dirname, "rotina-guiada.ts"), "utf8");
const RESPONDER = readFileSync(resolve(__dirname, "responder.ts"), "utf8");
const ORCHESTRATOR = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");

describe("uma Ayla só — o condutor herda o núcleo", () => {
  it("o system do condutor é o núcleo + o contrato, não um prompt próprio", () => {
    expect(ROTINA).toMatch(/system: `\$\{nucleoConducao\(\)\}/);
    expect(ROTINA).toMatch(/import \{ nucleoConducao \}/);
  });

  it("não existe mais um segundo prompt de identidade dentro da ferramenta", () => {
    expect(ROTINA).not.toMatch(/SYSTEM_CONDUZIR/);
  });

  it("o contrato não redefine tom nem repete o que o núcleo já manda", () => {
    // Estas eram as duplicações: tom, uma-pergunta-por-vez, não-re-perguntar.
    // Se voltarem, a ferramenta volta a divergir do resto da conversa.
    const contrato = ROTINA.slice(
      ROTINA.indexOf("const CONTRATO_ROTINA"),
      ROTINA.indexOf("`;", ROTINA.indexOf("const CONTRATO_ROTINA")),
    );
    expect(contrato).not.toMatch(/NUNCA formulário/i);
    expect(contrato).not.toMatch(/Tom:/i);
  });
});

describe("MATEUS — pergunta feita é pergunta respondida", () => {
  it("o contrato tem um desfecho 'responder', separado de 'perguntar'", () => {
    // O desfecho agora vive no enum da ferramenta (tool use) e continua
    // descrito no contrato — a intenção é a mesma: 'responder' é um caminho
    // próprio, não um apelido de 'perguntar'.
    expect(ROTINA).toMatch(/enum: \["responder", "perguntar", "montar", "sair"\]/);
    expect(ROTINA).toMatch(/acao = "responder"\|"perguntar"\|"montar"\|"sair"/);
  });

  it("'responder' proíbe devolver a próxima pergunta do roteiro", () => {
    expect(ROTINA).toMatch(/NÃO devolva a próxima pergunta do roteiro/);
  });

  it("o reativo também responde horário em vez de mandar esperar um fluxo", () => {
    expect(RESPONDER).toMatch(/PROPONHA o horário/);
    expect(RESPONDER).toMatch(/Mandar ela esperar um fluxo em vez de responder/);
  });

  it("o convite do fim não recolhe o que já está no contexto", () => {
    // Bancada de 02/08: a Ayla respondeu certo o horário e FECHOU com "me conta
    // como é a tarde de vocês" — com a tarde dela no contexto e usada na
    // própria resposta. Não era o bug antigo (respondeu primeiro), mas é a
    // mesma pergunta, e falhava um critério de aceitação explícito.
    expect(RESPONDER).toMatch(/NUNCA peça de novo o que já está no contexto/);
    expect(RESPONDER).toMatch(/o convite do fim é pelo que ela quer MUDAR ou pelo que ela vai reparar testando/);
  });

  it("a proibição antiga de propor horário no chat não existe mais", () => {
    // "não invente horários" fazia a Ayla se recusar a responder a pergunta
    // dela. Propor com base no que ela contou não é inventar.
    expect(RESPONDER).not.toMatch(/e não invente horários/);
  });
});

describe("MARIA IASMIN — não re-perguntar o que a família já contou", () => {
  it("os desafios do cadastro entram INTEIROS no contexto da conversa", () => {
    expect(ORCHESTRATOR).toMatch(/NO CADASTRO A FAMÍLIA MARCOU estes desafios/);
    expect(ORCHESTRATOR).toMatch(/extras\.desafios_onboarding/);
  });

  it("a lista completa vai pro prompt — não só o primeiro item", () => {
    const trecho = ORCHESTRATOR.slice(
      ORCHESTRATOR.indexOf("NO CADASTRO A FAMÍLIA MARCOU") - 900,
      ORCHESTRATOR.indexOf("NO CADASTRO A FAMÍLIA MARCOU") + 300,
    );
    expect(trecho).toMatch(/desafios\.join\(", "\)/);
    expect(trecho).not.toMatch(/desafios_onboarding\?\.\[0\]/);
  });

  it("os desafios são rotulados como RELATO, não como diagnóstico", () => {
    // A fronteira diagnóstica vale igual aqui: saber que a mãe marcou "sono"
    // não autoriza a Ayla a concluir nada sobre a criança.
    expect(ORCHESTRATOR).toMatch(/relato dela, NÃO diagnóstico e NÃO conclusão sua/);
  });

  it("o condutor de rotina também recebe perfil, desafios e a rotina que já existe", () => {
    expect(ROTINA).toMatch(/DESAFIOS QUE A FAMÍLIA MARCOU NO CADASTRO/);
    expect(ROTINA).toMatch(/PERFIL \(o que já sabemos — NÃO re-pergunte\)/);
    expect(ROTINA).toMatch(/ROTINA QUE JÁ EXISTE/);
  });

  it("a janela de histórico do condutor cobre uma conversa real, não 60 minutos", () => {
    expect(ROTINA).toMatch(/12 \* 60 \* 60 \* 1000/);
  });
});

describe("PRIMEIRA EXPERIÊNCIA — sai com rotina, não com formulário", () => {
  it("montar não espera confirmação", () => {
    expect(ROTINA).toMatch(/Se já dá pra montar uma primeira versão, MONTE/);
    expect(ROTINA).toMatch(/não peça confirmação antes/);
  });

  it("horário sem base é PROPOSTO, e dito como sugestão", () => {
    expect(ROTINA).toMatch(/você PROPÕE a partir do que sabe/);
    expect(ROTINA).toMatch(/deixa claro que é sugestão/);
  });

  it("o tema dos cartões nunca atrasa a entrega", () => {
    expect(ROTINA).toMatch(/TEMA dos cartões é OPCIONAL e NUNCA atrasa a entrega/);
  });
});

describe("mudança de assunto — a rotina não sequestra a conversa", () => {
  it("existe o desfecho 'sair'", () => {
    expect(ROTINA).toMatch(/acao === "sair"/);
    expect(ROTINA).toMatch(/if \(acao === "sair"\) return null;/);
  });

  it("sair proíbe a frase que devolvia o controle do assunto pra Ayla", () => {
    expect(ROTINA).toMatch(/NUNCA diga "antes precisamos terminar a rotina"/);
  });

  it("o orquestrador segue adiante quando o condutor sai", () => {
    // `if (r)` — null cai no caminho reativo normal, e a resposta sai como
    // "reativa", o que FECHA o gate de rotina pendente na próxima mensagem.
    const trecho = ORCHESTRATOR.slice(
      ORCHESTRATOR.indexOf("const r = await conduzirRotina"),
      ORCHESTRATOR.indexOf("const r = await conduzirRotina") + 1400,
    );
    expect(trecho).toMatch(/if \(r\) \{/);
    // "rotina_pronta", não "resposta_registro": aquele tipo dispara a ponte do
    // PLANO, e uma rotina entregue com ele fazia a mãe receber um PDF de plano
    // por cima da rotina que ela pediu (caso real, 03/08/2026).
    // `!r.aguardandoTema` entrou depois: rotina montada esperando o tema dos
    // cartões mantém a conversa aberta. O que este teste protege é o que NÃO
    // pode voltar — "resposta_registro" — e "rotina_pronta" continuar exigindo
    // `r.pronto`.
    expect(trecho).toMatch(/tipo: r\.pronto && !r\.aguardandoTema \? "rotina_pronta" : "rotina_conversa"/);
    expect(trecho).not.toMatch(/tipo: "resposta_registro"/);
  });

  it("o formato antigo (`pronto`) continua aceito", () => {
    expect(ROTINA).toMatch(/acao === "montar" \|\| parsed\?\.pronto === true/);
  });
});

describe("nunca prometer artefato que não foi gerado", () => {
  it("o contrato proíbe o futuro quando a entrega já aconteceu", () => {
    expect(ROTINA).toMatch(/NUNCA escreva "vou montar", "vou gerar", "vou te mandar"/);
  });

  it("o reativo também não promete o que não é ele quem entrega", () => {
    expect(RESPONDER).toMatch(/Não prometa artefato/);
  });
});
