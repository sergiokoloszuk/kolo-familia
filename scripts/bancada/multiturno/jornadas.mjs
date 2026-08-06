/**
 * AS 4 JORNADAS MULTITURNO — Claude × GPT, camada conversacional.
 *
 * Por que só multiturno: o turno único já tem evidência (GPT 17,3/20 × Claude
 * 10,7/20 com prompt idêntico; depois das correções estruturais o Claude ficou
 * em 10,0). O que NUNCA foi medido direito é continuidade — e é justamente
 * onde o Claude falhou de forma mais limpa na bancada de 05/08: 0/3 no caso
 * `17_referente_anterior`.
 *
 * As jornadas são 100% da camada conversacional. O orquestrador não participa
 * da continuidade entre turnos: ele roteia cada turno isoladamente. Então
 * qualquer diferença aqui é do MODELO.
 *
 * COMO RODAR: cada turno da mãe é enviado com o histórico REAL acumulado do
 * braço — ou seja, o Claude responde ao que o Claude disse, e o GPT ao que o
 * GPT disse. Isso é de propósito: replicar as falas da Ayla de um braço no
 * outro mediria o modelo respondendo a uma conversa que ele não conduziu, que
 * é o oposto de medir condução.
 *
 * A entrada de cada turno (perfil, tema, intenção, membro, notas internas) é
 * IDÊNTICA nos dois braços. A única variável é o modelo.
 */

const P = {
  davi: `Davi, 5 anos, masculino. Em investigação (sem laudo).
Comunicação: fala bem em casa; quase não fala com quem não conhece.
Como é / interesses: ônibus, mapas.
Regulação: chora quando alguém desconhecido fala com ele.`,

  gustavo: `Gustavo, 4 anos, masculino. Em investigação de TEA (sem laudo).
Comunicação: fala pouco; palavras soltas e puxa pela mão.
Como é / interesses: água, blocos de montar, girar as rodinhas dos carrinhos.
Sensorial: incomoda-se com secador e liquidificador.`,

  yuri: `Yuri, 6 anos, masculino. TEA (laudo).
Alimentação: recusa o que é misturado ou com molho.
Como é / interesses: dinossauros, carrinhos.
Sensorial: incomoda-se com cheiro forte.`,

  renan: `Renan Pietro, 9 anos, masculino. TDAH (laudo).
Foco: trava pra COMEÇAR a lição; depois que começa, vai.
Como é / interesses: futebol, Minecraft.
Rotina: futebol terças e quintas às 15h30.`,

  helena: `Helena, 11 anos, feminino. TEA (laudo) e TDAH (laudo).
Autonomia: precisa de ajuda pra se organizar de manhã.
Escola: quinta série; boa em matemática; sofre com leitura longa.
Como é / interesses: música, K-pop.`,
};

/**
 * `turnos` = só as falas da MÃE, em ordem. A fala da Ayla de cada turno é
 * gerada ao vivo pelo braço e entra no histórico dele.
 *
 * `marcos` = o que observar em cada turno, por índice. Não é gabarito de texto:
 * é o que a avaliação (automática e cega) precisa olhar naquele ponto.
 */
export const JORNADAS = [
  {
    id: "j1_aprofundamento",
    titulo: "Jornada 1 — aprofundamento natural",
    crianca: "Davi",
    perfil: P.davi,
    tema: "social",
    intencao: "desafio",
    entrega: true,
    turnos: [
      "as crianças chamam ele pra brincar no parquinho e ele fica só olhando, perto mas sem entrar. me dói ver isso",
      "ele fica uns bons minutos ali. às vezes roda em volta e depois vai embora pra perto de mim",
      "ontem eu tentei ir junto com ele e aí ele entrou. mas só ficou enquanto eu estava lá",
      "quando eu saí de perto ele voltou em uns 2 minutos",
      "e na escola a professora disse que é a mesma coisa no recreio",
    ],
    marcos: [
      "há informação suficiente pra uma primeira estratégia — não pode virar entrevista",
      "a mãe deu o detalhe que faltava (o padrão); a orientação deve AFINAR, não recomeçar",
      "ela achou uma pista sozinha (a presença dela funciona). tem que ser reconhecida e usada",
      "a informação nova estreita o problema: o desafio é SUSTENTAR, não entrar. deve adaptar",
      "contexto novo (escola) sem recomeçar do zero; e sem repetir o que já disse",
    ],
    olhar:
      "Progride ou gira? A cada turno a orientação fica mais específica àquela criança, ou é a mesma ideia reescrita?",
  },

  {
    id: "j2_referente",
    titulo: "Jornada 2 — referente e aceite",
    crianca: "Gustavo",
    perfil: P.gustavo,
    tema: "social",
    intencao: "desafio",
    entrega: true,
    turnos: [
      "ele chora muito quando chega gente em casa, ontem foi terrível",
      "sim",
      "quero",
      "a vó dele vem quase todo domingo, é sempre ela",
      "e se ele não quiser dar tchau na hora que ela for embora?",
    ],
    marcos: [
      "deve entender a situação e OFERECER algo concreto (a oferta é o que os turnos seguintes retomam)",
      "⚠️ CRÍTICO: 'sim' sozinho. A que se refere? Incidente real de 04/08 — virou resposta sobre diagnóstico",
      "'quero' não é um novo pedido: é reforço do mesmo. Não pode reabrir triagem",
      "preferência da mãe entra: a orientação deve incorporar a avó, sem recomeçar",
      "objeção prática. Deve responder À objeção, sem repetir a explicação inteira",
    ],
    olhar:
      "É a jornada que mede o bug mais caro do produto. Perder o referente aqui é falha grave, não nota baixa.",
  },

  {
    id: "j3_troca_de_crianca",
    titulo: "Jornada 3 — troca de criança no meio da conversa",
    crianca: "Yuri",
    perfil: P.yuri,
    // A partir do turno 3 o membro ativo muda. O runner troca o bloco de perfil
    // — igual nos dois braços — e o que se mede é a CONVERSA não contaminar.
    trocaNoTurno: 2,
    criancaDepois: "Renan Pietro",
    perfilDepois: P.renan,
    tema: "nutricional",
    intencao: "desafio",
    entrega: true,
    turnos: [
      "o Yuri não come nada que tenha molho, tá difícil o almoço",
      "ele aceita arroz e macarrão puro, mais nada",
      "tenho outro filho também, o Renan Pietro, de 9 anos. com ele o problema é outro",
      "ele trava pra começar a lição, fica uma hora enrolando e não escreve nada",
      "ele adora futebol, joga terça e quinta",
    ],
    marcos: [
      "conversa normal sobre seletividade do Yuri",
      "detalhe alimentar; ainda Yuri",
      "⚠️ TROCA. Deve reconhecer que mudou de criança e não continuar o raciocínio do Yuri",
      "desafio do Renan (foco). NENHUM dado do Yuri pode aparecer: nem comida, nem dinossauro, nem TEA",
      "interesse do Renan. Se citar dinossauro/carrinho aqui, é contaminação — falha",
    ],
    olhar:
      "Idade, diagnóstico, interesse e dificuldade são todos diferentes entre os dois. Qualquer mistura é objetivamente detectável.",
  },

  {
    id: "j4_multiplas_frentes",
    titulo: "Jornada 4 — mãe perdida, várias frentes",
    crianca: "Helena",
    perfil: P.helena,
    tema: "emocional",
    intencao: "desafio",
    entrega: true,
    turnos: [
      "não sei nem por onde começar. ela tem dificuldade com leitura, não faz quase nada sozinha, tem explosões quase todo dia e não tem amiga nenhuma na escola",
      "acho que as explosões são o que mais pesa. acontece quase todo fim de tarde",
      "geralmente quando eu peço pra ela fazer a lição depois que ela já tá no celular",
      "já tentei avisar antes mas ela ignora",
      "às vezes funciona quando eu sento junto",
      "e a leitura? isso eu também queria resolver",
    ],
    marcos: [
      "⚠️ NÃO pode responder só 'me conta mais'. Deve ORGANIZAR as quatro frentes NOMEANDO-AS e ajudar a escolher",
      "ela escolheu. Deve entrar naquela frente e largar as outras explicitamente",
      "o gatilho apareceu: é uma TRANSIÇÃO (celular → lição), não explosão genérica. Deve reenquadrar",
      "a estratégia óbvia já falhou. Deve ajustar, não repetir 'avise antes'",
      "ela achou o que funciona. Deve construir em cima, não propor coisa nova",
      "volta a uma frente que ficou pra depois. Deve retomar SEM recomeçar a conversa inteira",
    ],
    olhar:
      "Mede o comportamento que o Sérgio descreveu como a experiência boa: organiza, prioriza com o porquê, e já ajuda.",
  },
];

/** Os canais em que cada jornada roda. Resultados NUNCA agregados entre eles. */
export const CANAIS = ["whatsapp", "web"];

/**
 * A RUBRICA DA JORNADA — 10 itens, além dos 20 por resposta.
 *
 * Existe porque uma resposta bonita isolada não pode ganhar de uma conversa
 * que funciona. Estes itens só fazem sentido olhando a jornada inteira.
 */
export const RUBRICA_JORNADA = [
  ["fio", "Manteve o fio da conversa"],
  ["lembrou", "Lembrou do que acabou de ser dito"],
  ["progrediu", "Progrediu (não girou em círculos)"],
  ["sem_repeticao", "Não repetiu explicações"],
  ["sem_perguntas_inuteis", "Não fez a mãe responder o que já sabia"],
  ["adaptou", "Adaptou a orientação conforme surgiu informação"],
  ["acao_concreta", "Chegou a ações concretas"],
  ["crianca_ativa", "Manteve a criança certa ⚠"],
  ["parece_conversa", "Pareceu conversa, não formulário"],
  ["quero_continuar", "Deu vontade de continuar"],
];

/**
 * MARCADORES OBJETIVOS de comportamento que hoje incomoda na Kolo.
 * Contáveis por regex — complementam a nota, não a substituem.
 */
export const SINAIS = [
  ["pergunta_final", /\?\s*$/, "terminou com pergunta"],
  ["me_conta_mais", /me conta mais|conta um pouco mais|me fala mais/i, "pediu mais sem ajudar"],
  ["acolhimento_formula", /imagino como|que situação|deve ser difícil|faz sentido você se sentir/i, "acolhimento de fórmula"],
  ["observe_e_volte", /observa? (isso )?(nos próximos dias|essa semana).{0,40}me (conta|avisa)/i, "mandou observar e voltar"],
  ["recita_perfil", /como você (já )?me contou,? (ele|ela) (tem|é|gosta)/i, "recitou o perfil"],
  ["tres_perguntas", /\?[^?]{0,180}\?[^?]{0,180}\?/, "três ou mais perguntas seguidas"],
];
