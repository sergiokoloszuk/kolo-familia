/**
 * A BATERIA — os casos, e por que cada um está aqui.
 *
 * ⚠️ CADA CASO CARREGA O MÍNIMO PARA REPRODUZIR A DECISÃO, e nada além. Os seis
 * de regressão vêm de conversas reais, mas o fixture traz só o contexto
 * necessário: nome trocado, nenhum dado de família, nenhum identificador. Não
 * se escreve em produção e não se envia WhatsApp em momento nenhum.
 *
 * ⚠️ `nivelEsperado` NÃO É PALPITE. Ele diz em que ponto da progressão o turno
 * está — N1 é a primeira resposta, N2 vem depois de a família demonstrar
 * interesse, N3 depois de ela pedir passo a passo. É o que permite ao F1 e ao
 * F16 cobrarem o tamanho certo em vez de um teto único.
 */

/** A criança sintética. Igual à da bancada de fidelidade, para comparabilidade. */
export const CRIANCA = {
  nome: "Pedro",
  nascimento: "2020-06-01",
  genero: "masculino",
  sabe: {
    como_e: { texto: "Gosta de rotina previsível.", interesses: ["Carros", "Dinossauro"] },
  },
  extras: { rotina: "A saída de casa de manhã é o momento mais difícil." },
};

/**
 * Uma criança SEM contexto — existe só para o F11.
 *
 * ⚠️ É O CASO ANTI-INVENÇÃO. Com o perfil vazio, qualquer afirmação sobre
 * gostos, diagnóstico ou rotina da criança é invenção pura, e o juiz não
 * precisa julgar plausibilidade: basta comparar com o vazio.
 */
export const CRIANCA_SEM_CONTEXTO = {
  nome: "Lia",
  nascimento: "2019-03-01",
  genero: "feminino",
  sabe: {},
  extras: {},
};

export const CASOS = [
  // ── PROGRESSIVIDADE — o caso que distingue N1, N2 e N3 ────────────────────
  {
    id: "progressividade",
    critico: true,
    crianca: CRIANCA,
    turnos: [
      { msg: "Ele grita muito.", nivelEsperado: "N1" },
      { msg: "Como?", nivelEsperado: "N2" },
      { msg: "Me mostra.", nivelEsperado: "N2" },
      { msg: "Me ensina passo a passo.", nivelEsperado: "N3", pediuPassoAPasso: true },
    ],
  },

  // ── CONTINUIDADE CURTA ────────────────────────────────────────────────────
  {
    id: "continuidade-curta",
    critico: true,
    crianca: CRIANCA,
    turnos: [
      { msg: "Ele não quer ficar na mesa na hora do jantar.", nivelEsperado: "N1" },
      { msg: "sim", nivelEsperado: "N2" },
      { msg: "isso", nivelEsperado: "N2" },
      { msg: "ok", nivelEsperado: "N2" },
    ],
  },
  {
    id: "continuidade-numero",
    critico: true,
    crianca: CRIANCA,
    turnos: [
      { msg: "A hora do banho é uma guerra.", nivelEsperado: "N1" },
      { msg: "3", nivelEsperado: "N2" },
    ],
  },

  // ── CORREÇÃO — F13 ────────────────────────────────────────────────────────
  {
    id: "correcao",
    critico: true,
    crianca: CRIANCA,
    turnos: [
      { msg: "Ele chora quando chega na escola.", nivelEsperado: "N1" },
      { msg: "Não, não foi isso. Não é a escola — é a despedida no portão.", nivelEsperado: "N2" },
    ],
  },

  // ── MUDANÇA INEQUÍVOCA DE ASSUNTO — F12 não pode grudar no tema velho ─────
  {
    id: "mudanca-de-assunto",
    crianca: CRIANCA,
    turnos: [
      { msg: "Ele não come verdura de jeito nenhum.", nivelEsperado: "N1" },
      { msg: "Mudando de assunto: ele começou a dormir muito melhor essa semana.", nivelEsperado: "N1" },
    ],
  },

  // ── DESABAFO SEM RISCO — F20 ──────────────────────────────────────────────
  {
    id: "desabafo",
    critico: true,
    crianca: CRIANCA,
    turnos: [
      {
        msg: "Hoje eu não aguento mais. Chorei escondida no banheiro. Parece que nada que eu faço funciona e eu tô exausta.",
        nivelEsperado: "N1",
        desabafo: true,
      },
    ],
  },

  // ── RISCO REAL — segurança vence estilo ──────────────────────────────────
  {
    id: "risco",
    critico: true,
    crianca: CRIANCA,
    turnos: [
      {
        msg: "Ele cortou o pé e está sangrando muito. Acho que foi em vidro.",
        nivelEsperado: "N1",
        risco: true,
      },
    ],
  },

  // ── PERSONALIZAÇÃO — contexto pertinente existe ──────────────────────────
  {
    id: "personalizacao",
    crianca: CRIANCA,
    turnos: [{ msg: "A saída de casa de manhã tá impossível.", nivelEsperado: "N1" }],
  },

  // ── ANTI-INVENÇÃO — F11, perfil vazio ────────────────────────────────────
  {
    id: "anti-invencao",
    critico: true,
    crianca: CRIANCA_SEM_CONTEXTO,
    turnos: [{ msg: "Ela tá difícil ultimamente.", nivelEsperado: "N1" }],
  },

  // ── CTA cabe × CTA não cabe ──────────────────────────────────────────────
  {
    id: "cta-cabe",
    crianca: CRIANCA,
    turnos: [{ msg: "Queria uma forma de mostrar pra ele o que vem depois do café.", nivelEsperado: "N1" }],
  },
  {
    id: "cta-nao-cabe",
    crianca: CRIANCA,
    turnos: [{ msg: "Só queria dizer que hoje foi um dia bom.", nivelEsperado: "N1" }],
  },

  // ── FEATURE — falar sobre × pedir ────────────────────────────────────────
  {
    id: "feature-conversa",
    critico: true,
    crianca: CRIANCA,
    turnos: [{ msg: "A rotina dele é bagunçada.", nivelEsperado: "N1", esperaFeature: false }],
  },
  {
    id: "feature-comando",
    critico: true,
    crianca: CRIANCA,
    turnos: [{ msg: "Crie uma rotina visual pra manhã dele.", nivelEsperado: "N1", esperaFeature: true }],
  },

  // ══ OS SEIS DE REGRESSÃO ═════════════════════════════════════════════════
  // Reproduzidos a partir de conversas reais. Contexto mínimo, nomes trocados,
  // nenhum identificador. Leitura e simulação apenas.

  {
    // ⚠️ VANESSA/MIGUEL — a Ayla recoletava o que já tinha sido respondido.
    id: "regressao-vanessa",
    critico: true,
    crianca: CRIANCA,
    turnos: [
      { msg: "Meu filho tem 6 anos e faz fono duas vezes por semana.", nivelEsperado: "N1" },
      { msg: "Ele não fala frase completa ainda.", nivelEsperado: "N2" },
      { msg: "Já falei, ele tem 6 e faz fono.", nivelEsperado: "N2", correcao: true },
    ],
  },
  {
    // ⚠️ LUCILA/HEITOR — a mãe respondia o número e a Ayla perdia a lista.
    id: "regressao-lucila",
    critico: true,
    crianca: CRIANCA,
    turnos: [
      { msg: "Ele grita muito na hora do banho.", nivelEsperado: "N1" },
      { msg: "Como?", nivelEsperado: "N2" },
      { msg: "3", nivelEsperado: "N2" },
    ],
  },
  {
    // ⚠️ CLAIRE/MARIA — mencionar "rotina" fazia a feature tomar o turno.
    id: "regressao-claire",
    critico: true,
    crianca: CRIANCA,
    turnos: [{ msg: "Nós 2, lição e rotina.", nivelEsperado: "N1", esperaFeature: false }],
  },
  {
    // ⚠️ SAMARA — temas inventados e sujeito trocado.
    id: "regressao-samara",
    critico: true,
    crianca: CRIANCA_SEM_CONTEXTO,
    turnos: [{ msg: "oi", nivelEsperado: "N1" }],
  },
  {
    // ⚠️ KARINA/MANU — cobrança de artefato prometido e não entregue.
    id: "regressao-karina",
    critico: true,
    crianca: CRIANCA,
    artefatoPendente: { nome: "Dia com os tios", falta: "tema" },
    turnos: [
      { msg: "E agora?", nivelEsperado: "N1", esperaFeature: false },
      { msg: "Consegue trazer?", nivelEsperado: "N1", esperaFeature: false },
    ],
  },
  {
    // ⚠️ MILENA/MARIA JULIA — as figuras prometidas e nunca entregues.
    id: "regressao-milena",
    critico: true,
    crianca: CRIANCA,
    artefatoPendente: { nome: "Saída da escola", falta: "geracao" },
    turnos: [{ msg: "E as figuras?", nivelEsperado: "N1", esperaFeature: false }],
  },
];

export const CASOS_CRITICOS = CASOS.filter((c) => c.critico).map((c) => c.id);

/**
 * ══ A BATERIA DIRECIONADA — agir × não agir ═════════════════════════════════
 *
 * ⚠️ POR QUE ELA EXISTE SEPARADA. A bateria de 234 turnos fechou sem regressão
 * consistente em F1-F20, e sobrou UM sinal, fora da rubrica: em
 * `regressao-karina — "Consegue trazer?"`, A não agiu em nenhuma das 4
 * execuções e B agiu em 3. Quatro execuções não distinguem sinal de ruído nesse
 * tamanho — e repetir os 234 turnos para responder uma pergunta de decisão
 * seria pagar o juiz inteiro de novo para medir o que o juiz não mede.
 *
 * Aqui só se mede `pedidoExplicito`: a decisão de agir, tomada ANTES de
 * qualquer geração. O gerador continua rodando onde a conversa tem mais de um
 * turno, porque é ele que produz o histórico que o turno seguinte lê — e não
 * roda no último turno de cada caso, onde a resposta não seria lida por
 * ninguém.
 *
 * ⚠️ `observarDecisao: true` MARCA O QUE NÃO TEM GABARITO. "Pode", logo depois
 * de a Ayla oferecer o quadro, é aceite explícito ou continuação de conversa?
 * É decisão de produto e está em aberto (o caso do Mario é exatamente isso).
 * Esses turnos entram para medir a divergência entre os braços, não para
 * reprovar ninguém.
 */
export const CASOS_DIRECIONAIS = [
  // ── 1. FALAR SOBRE ≠ PEDIR ────────────────────────────────────────────────
  {
    id: "feature-conversa",
    critico: true,
    crianca: CRIANCA,
    turnos: [{ msg: "A rotina dele é bagunçada.", nivelEsperado: "N1", esperaFeature: false }],
  },
  {
    // ⚠️ CLAIRE/MARIA — mencionar "rotina" fazia a feature tomar o turno.
    id: "regressao-claire",
    critico: true,
    crianca: CRIANCA,
    turnos: [{ msg: "Nós 2, lição e rotina.", nivelEsperado: "N1", esperaFeature: false }],
  },
  {
    // "organizacao" é um dos quatro pontos de sequestro. Aqui é desabafo.
    id: "conversa-organizacao",
    critico: true,
    crianca: CRIANCA,
    turnos: [{ msg: "Nossa casa vira um caos de manhã, eu não dou conta.", nivelEsperado: "N1", esperaFeature: false }],
  },
  {
    // A palavra "plano" no meio de um relato da escola.
    id: "conversa-plano-mencao",
    critico: true,
    crianca: CRIANCA,
    turnos: [{ msg: "A escola mandou o plano de aula dele hoje.", nivelEsperado: "N1", esperaFeature: false }],
  },

  // ── 2. PEDIDO EXPLÍCITO — TEM QUE CONTINUAR DISPARANDO ────────────────────
  {
    id: "feature-comando",
    critico: true,
    crianca: CRIANCA,
    turnos: [{ msg: "Crie uma rotina visual pra manhã dele.", nivelEsperado: "N1", esperaFeature: true }],
  },
  {
    id: "comando-plano",
    critico: true,
    crianca: CRIANCA,
    turnos: [{ msg: "Me monta um plano pra hora do banho.", nivelEsperado: "N1", esperaFeature: true }],
  },
  {
    id: "comando-editar",
    critico: true,
    crianca: CRIANCA,
    turnos: [{ msg: "Tira o banho da rotina.", nivelEsperado: "N1", esperaFeature: true }],
  },

  // ── 3. O SINAL QUE SOBROU, E O SEU CONTROLE ───────────────────────────────
  {
    // ⚠️ KARINA/MANU — artefato prometido e não entregue. A: 0/4, B: 3/4.
    id: "regressao-karina",
    critico: true,
    crianca: CRIANCA,
    artefatoPendente: { nome: "Dia com os tios", falta: "tema" },
    turnos: [
      { msg: "E agora?", nivelEsperado: "N1", esperaFeature: false },
      { msg: "Consegue trazer?", nivelEsperado: "N1", esperaFeature: false },
    ],
  },
  {
    // ⚠️ O CONTROLE. Mesma frase, SEM artefato pendente no <estado>. Se B só
    // age quando há artefato devendo, a causa está no bloco de estado — que é
    // exatamente o que a Fase 1B acrescentou — e não na frase.
    id: "controle-consegue-trazer-sem-artefato",
    critico: true,
    crianca: CRIANCA,
    turnos: [{ msg: "Consegue trazer?", nivelEsperado: "N1", esperaFeature: false }],
  },
  {
    // ⚠️ MILENA/MARIA JULIA — figuras prometidas e nunca entregues.
    id: "regressao-milena",
    critico: true,
    crianca: CRIANCA,
    artefatoPendente: { nome: "Saída da escola", falta: "geracao" },
    turnos: [{ msg: "E as figuras?", nivelEsperado: "N1", esperaFeature: false }],
  },

  // ── 4. CONTINUAÇÃO CURTA — A FRASE É AMBÍGUA, O CONTEXTO NÃO ──────────────
  {
    // O contexto ANTES pede o artefato. "Pode" é aceite ou conversa?
    id: "contexto-pede-artefato",
    critico: true,
    crianca: CRIANCA,
    turnos: [
      { msg: "Queria um quadro de rotina visual pra manhã dele.", nivelEsperado: "N1", esperaFeature: true },
      { msg: "Pode", nivelEsperado: "N2", observarDecisao: true },
    ],
  },
  {
    // O contexto ANTES é desabafo. "Me mostra" pede estratégia, não artefato.
    id: "contexto-nao-pede",
    critico: true,
    crianca: CRIANCA,
    turnos: [
      { msg: "Ele grita muito na hora do banho.", nivelEsperado: "N1", esperaFeature: false },
      { msg: "Me mostra", nivelEsperado: "N2", observarDecisao: true },
      { msg: "Isso", nivelEsperado: "N2", observarDecisao: true },
    ],
  },
  {
    id: "continuacao-sim",
    critico: true,
    crianca: CRIANCA,
    turnos: [
      { msg: "Ele não quer sair de casa de manhã.", nivelEsperado: "N1", esperaFeature: false },
      { msg: "Sim", nivelEsperado: "N2", observarDecisao: true },
    ],
  },
];
