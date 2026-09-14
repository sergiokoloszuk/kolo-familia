/**
 * OS CASOS DA BANCADA DA PÓS INTEGRAL — 14/09/2026.
 *
 * ⚠️ A PERGUNTA NÃO É "O RECUPERADOR ACHA O CHUNK CERTO?". É a que a missão
 * fixou: *"com acesso à pós, a Ayla entende melhor o caso e escolhe um próximo
 * passo melhor?"*. Medir recall de trecho é medir o índice; o que importa é a
 * pergunta escolhida, a direção e o que ela deixa de perguntar.
 *
 * ⚠️ E É POR ISSO QUE `fonte_esperada` EXISTE. Cada caso declara de qual das
 * TRÊS fontes ele deveria precisar — só pós, só boas práticas, as duas, ou
 * nenhuma. Sem isso a bancada mede se a pós dispara, não se ela dispara na
 * hora certa; e uma pós que entra em todo turno é pior que uma pós desligada.
 *
 * Os casos vêm de três origens, marcadas em `origem`:
 *   `producao`   — fala real observada em `ayla_messages` (parafraseada, sem PII)
 *   `pos`        — a situação literal das regras SE… ENTÃO de A §7
 *   `fronteira`  — o caso que a pós NÃO deve alcançar (o falso positivo)
 */
export const CASOS = [
  // ═══════════ SÓ PÓS — entender o caso muda a pergunta
  {
    id: "P1",
    origem: "pos",
    fonte_esperada: "pos",
    titulo: "Atraso de fala com 'entende tudo'",
    relato: "Ele não fala quase nada, mas entende tudo o que eu mando e faz. Tem 3 anos.",
    temas: ["comunicacao"],
    idadeMeses: 36,
    perfilConhecido: { comunicacao: { vocabulario: "poucas palavras" } },
    espera: {
      unidades: ["A7.1"],
      perguntaDeveSer: "um degrau pré-verbal (contato, mostra ou entende)",
      perguntaNaoPodeSer: "comunicacao.vocabulario",
      porque: "compreender rotina não é processar linguagem; a lacuna é abaixo do vocabulário",
    },
  },
  {
    id: "P2",
    origem: "pos",
    fonte_esperada: "pos",
    titulo: "Dispersão em lugar público",
    relato: "Na escola e no mercado ele não para quieto, não presta atenção em nada, é muito disperso.",
    temas: ["foco", "escola"],
    idadeMeses: 72,
    perfilConhecido: {},
    espera: {
      unidades: ["A7.3"],
      perguntaDeveSer: "um campo sensorial (perfil, sons ou luz)",
      perguntaNaoPodeSer: "foco.padrao",
      porque: "sistema nervoso sob estresse físico não sustenta atenção voluntária",
    },
  },
  {
    id: "P3",
    origem: "producao",
    fonte_esperada: "pos",
    titulo: "Crise que começou do nada",
    relato: "Do nada essa semana ele começou a ter crise todo dia. Nunca foi assim, não sei o que aconteceu.",
    temas: ["emocional"],
    idadeMeses: 54,
    perfilConhecido: { emocional: { gatilhos: "mudança de rotina" } },
    espera: {
      unidades: ["B0.4"],
      perguntaDeveSer: "o corpo — dor silenciosa antes de comportamento",
      perguntaNaoPodeSer: "emocional.gatilhos",
      porque: "mudança ABRUPTA pede excluir otite, dente e ITU antes de plano comportamental",
    },
  },
  {
    id: "P4",
    origem: "pos",
    fonte_esperada: "pos",
    titulo: "Adolescente 'grosso'",
    relato: "Meu filho de 13 anos é muito grosso com as pessoas, fala o que pensa e não se importa se magoa.",
    temas: ["socializacao"],
    idadeMeses: 156,
    perfilConhecido: {},
    espera: {
      unidades: ["A7.4"],
      perguntaDeveSer: "com quem e como ele interage",
      perguntaNaoPodeSer: null,
      porque: "Teoria da Mente é falha de empatia COGNITIVA, não ausência de afeto",
    },
  },
  {
    id: "P5",
    origem: "pos",
    fonte_esperada: "pos",
    titulo: "Vocabulário grande, comunicação pequena",
    relato: "Ele sabe todas as cores, conta até 50 e fala várias palavras, mas não conversa comigo.",
    temas: ["comunicacao"],
    idadeMeses: 60,
    perfilConhecido: { comunicacao: { vocabulario: "mais de 50 palavras" } },
    espera: {
      unidades: ["A10.11"],
      perguntaDeveSer: "uso social da linguagem (conversa ou iniciativa)",
      perguntaNaoPodeSer: "comunicacao.vocabulario",
      porque: "semântica sem pragmática não é comunicação funcional",
    },
  },
  {
    id: "P6",
    origem: "producao",
    fonte_esperada: "pos",
    titulo: "Explode só em casa",
    relato: "Na escola a professora diz que ele é ótimo, um anjo. Só em casa ele explode comigo.",
    temas: ["emocional", "escola"],
    idadeMeses: 96,
    perfilConhecido: {},
    espera: {
      unidades: ["B7.2"],
      perguntaDeveSer: "o que acontece no dia antes da explosão",
      perguntaNaoPodeSer: null,
      porque: "camuflagem sistemática esgota; a casa é onde a conta vence, não onde o problema está",
    },
  },
  {
    id: "P7",
    origem: "pos",
    fonte_esperada: "pos",
    titulo: "'Cada criança tem seu tempo'",
    relato: "Ele tem 2 anos e meio e não fala. Meu pediatra disse pra esperar, que cada criança tem seu tempo.",
    temas: ["comunicacao", "essencial"],
    idadeMeses: 30,
    perfilConhecido: {},
    espera: {
      unidades: ["A7.5"],
      perguntaDeveSer: null,
      perguntaNaoPodeSer: null,
      porque: "a janela de resposta tem pico até os 4 anos; esperar não é neutro",
    },
  },

  // ═══════════ SÓ BOAS PRÁTICAS — a direção já é óbvia, falta o COMO
  {
    id: "BP1",
    origem: "producao",
    fonte_esperada: "boas_praticas",
    titulo: "Pede atividade concreta para um alvo já definido",
    relato: "Me dá umas ideias de brincadeira pra fazer com ele hoje à tarde pra trabalhar o revezamento.",
    temas: ["socializacao"],
    idadeMeses: 60,
    perfilConhecido: { comunicacao: { iniciativa: "pede puxando a mão" } },
    espera: {
      unidades: [],
      perguntaDeveSer: null,
      perguntaNaoPodeSer: null,
      porque: "a mãe já sabe o alvo e pediu repertório — a pós não acrescenta direção nenhuma aqui",
    },
  },
  {
    id: "BP2",
    origem: "producao",
    fonte_esperada: "boas_praticas",
    titulo: "Pede o passo a passo de algo já acordado",
    relato: "Você falou do quadro visual pro banho. Como eu monto isso na prática?",
    temas: ["rotina"],
    idadeMeses: 48,
    perfilConhecido: { rotina: { transicoes: "chora na hora do banho", avisar: "não avisa antes" } },
    espera: {
      unidades: [],
      perguntaDeveSer: null,
      perguntaNaoPodeSer: "rotina.transicoes",
      porque: "o mecanismo já foi explicado e o Perfil já sabe; o que falta é execução",
    },
  },

  // ═══════════ PÓS + BOAS PRÁTICAS — entender ONDE, e depois COMO
  {
    id: "C1",
    origem: "producao",
    fonte_esperada: "combinacao",
    titulo: "Seletividade alimentar severa",
    relato: "Ele só come três coisas: nuggets, pão e iogurte. Não aceita nada novo, se eu insisto ele vomita. O que eu faço?",
    temas: ["nutricional", "sensorial"],
    idadeMeses: 66,
    perfilConhecido: {},
    espera: {
      unidades: ["B5.2"],
      perguntaDeveSer: "textura ou perfil sensorial",
      perguntaNaoPodeSer: null,
      porque: "a pós diz que é defensividade tátil-oral (ONDE); a BP entrega a aproximação gradual (COMO)",
    },
  },
  {
    id: "C2",
    origem: "pos",
    fonte_esperada: "combinacao",
    titulo: "Crise sempre na transição",
    relato: "Toda vez que é hora de sair de casa pra escola ele tem uma crise enorme. Todo dia a mesma coisa.",
    temas: ["rotina", "emocional"],
    idadeMeses: 60,
    perfilConhecido: {},
    espera: {
      unidades: ["A7.6"],
      perguntaDeveSer: "rotina.transicoes ou rotina.avisar",
      perguntaNaoPodeSer: null,
      porque: "a pós lê falha de previsibilidade (ONDE); a BP e a Rotina Visual dão o ritual (COMO)",
    },
  },
  {
    id: "C3",
    origem: "producao",
    fonte_esperada: "combinacao",
    titulo: "Não brinca com ninguém no recreio",
    relato: "A professora falou que ele fica sozinho no recreio, ninguém brinca com ele. Isso me parte o coração.",
    temas: ["socializacao", "escola"],
    idadeMeses: 84,
    perfilConhecido: {},
    espera: {
      unidades: ["B6.1"],
      perguntaDeveSer: "com quem ele interage, ou a queixa da escola",
      perguntaNaoPodeSer: null,
      porque: "negligenciado e controverso são isolamentos diferentes e pedem ações diferentes",
    },
  },

  // ═══════════ NENHUMA — a pós entrar aqui é o falso positivo que mata a frente
  {
    id: "N1",
    origem: "fronteira",
    fonte_esperada: "nenhum",
    titulo: "Desabafo puro",
    relato: "Hoje eu estou exausta. Foi um dia horrível, só queria desabafar.",
    temas: [],
    idadeMeses: 60,
    perfilConhecido: {},
    espera: {
      unidades: [],
      perguntaDeveSer: null,
      perguntaNaoPodeSer: "QUALQUER",
      porque: "acolher é do Core; fundamento clínico num desabafo é exatamente a resposta errada",
    },
  },
  {
    id: "N2",
    origem: "fronteira",
    fonte_esperada: "nenhum",
    titulo: "Conversa social",
    relato: "Bom dia, Ayla! Tudo bem com você?",
    temas: [],
    idadeMeses: 60,
    perfilConhecido: {},
    espera: { unidades: [], perguntaDeveSer: null, perguntaNaoPodeSer: "QUALQUER", porque: "não há caso" },
  },
  {
    id: "N3",
    origem: "fronteira",
    fonte_esperada: "nenhum",
    titulo: "Operacional",
    relato: "Me manda de novo o link da rotina da semana passada?",
    temas: [],
    idadeMeses: 60,
    perfilConhecido: {},
    espera: { unidades: [], perguntaDeveSer: null, perguntaNaoPodeSer: "QUALQUER", porque: "é pedido de artefato" },
  },
  {
    id: "N4",
    origem: "fronteira",
    fonte_esperada: "nenhum",
    titulo: "Boa notícia",
    relato: "Ayla, hoje ele me olhou nos olhos e falou 'mamãe'! Chorei.",
    temas: ["comunicacao"],
    idadeMeses: 42,
    perfilConhecido: {},
    espera: {
      unidades: [],
      perguntaDeveSer: null,
      perguntaNaoPodeSer: "QUALQUER",
      porque: "celebrar é do Core; explicar o mecanismo do contato visual aqui rouba o momento dela",
    },
  },

  // ═══════════ O PERFIL JÁ SABE — a pós não pode mandar perguntar o sabido
  {
    id: "S1",
    origem: "producao",
    fonte_esperada: "pos",
    titulo: "Mesma queixa, Perfil já preenchido",
    relato: "Na escola e no shopping ele se dispersa demais, não consigo fazer ele prestar atenção.",
    temas: ["foco", "escola"],
    idadeMeses: 72,
    perfilConhecido: {
      sensorial: { perfil: "hipersensível a som", sons: "tapa o ouvido com liquidificador", luz: "não incomoda" },
    },
    espera: {
      unidades: ["A7.3"],
      perguntaDeveSer: null,
      perguntaNaoPodeSer: "sensorial.perfil",
      porque: "o sensorial JÁ é conhecido — a pós deve INTERPRETAR com ele, não perguntá-lo de novo",
    },
  },
  {
    id: "S2",
    origem: "producao",
    fonte_esperada: "pos",
    titulo: "Criança que lê e escreve, queixa de comunicação",
    relato: "Ele lê e escreve bem, mas não consegue manter uma conversa com os colegas.",
    temas: ["comunicacao", "socializacao"],
    idadeMeses: 108,
    perfilConhecido: { comunicacao: { forma: "frases completas, lê e escreve", vocabulario: "amplo" } },
    espera: {
      unidades: [],
      perguntaDeveSer: "uso social da linguagem",
      perguntaNaoPodeSer: "comunicacao.contato",
      porque: "quem lê e escreve já provou os degraus de baixo — perguntar contato visual é o degrau errado",
    },
  },
];
