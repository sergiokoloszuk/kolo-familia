/**
 * OS 20 CASOS — situações já observadas na Kolo, anonimizadas.
 *
 * Nomes e detalhes identificáveis foram trocados; a FORMA da mensagem (o jeito
 * de escrever, a pontuação, o que ela conta e o que ela omite) foi preservada,
 * porque é justamente aí que a conversa trava.
 *
 * Cada caso traz:
 *   canal      — "whatsapp" | "web" (a mesma entrada roda no canal onde ela existe)
 *   perfil     — o que o sistema sabe da criança (vai IGUAL pros três braços)
 *   historico  — turnos anteriores, quando o caso depende deles
 *   msg        — a fala da mãe agora
 *   entrega    — o gate `ehEntrega` do WhatsApp / `intencao==="desafio"` da web
 *   intencao   — a classe que o classificador da web produziria
 *   tema       — o tema ativo (WhatsApp)
 *   olhar      — o que ESTE caso está medindo (vai pra tela de avaliação DEPOIS
 *                da nota, nunca antes — pra não enviesar quem pontua)
 */

const P = {
  gustavo: `Gustavo, 4 anos, masculino. Em investigação de TEA (sem laudo).
Comunicação: fala pouco; usa palavras soltas e puxa pela mão.
Como é / interesses: água, blocos de montar, girar as rodinhas dos carrinhos.
Sensorial: incomoda-se com secador e liquidificador.`,

  isabela: `Isabela, 15 anos, feminino. Diagnóstico informado pela família: TDAH (laudo).
Como é / interesses: cinema, desenhar. Grupo de 4 amigas da escola desde os 8 anos.
Regulação emocional: fica ansiosa antes de coisas novas; costuma antecipar o pior.
Escola: vai bem em humanas; sofre com prazos.`,

  enzo: `Enzo, 6 anos, masculino. Diagnóstico informado pela família: TEA (laudo).
Alimentação: aceita arroz, macarrão sem molho, pão, banana, iogurte. Recusa o que é misturado ou com molho.
Sensorial: incomoda-se com cheiro forte.
Como é / interesses: dinossauros, carrinhos.`,

  mateus: `Mateus, 9 anos, masculino. Diagnóstico informado pela família: TDAH (laudo).
Rotina: chega da escola 12h40. Futebol terças e quintas às 15h30.
Foco: trava pra COMEÇAR a lição; depois que começa, vai.
Como é / interesses: futebol, Minecraft.`,

  laura: `Laura, 7 anos, feminino. Diagnóstico informado pela família: TEA (laudo).
Motor fino: pega o lápis com a mão fechada; cansa rápido ao escrever.
Como é / interesses: massinha, bichos, desenhar com o dedo na areia.
Rotina: dorme bem; manhãs tranquilas.`,

  davi: `Davi, 5 anos, masculino. Em investigação (sem laudo).
Comunicação: fala bem em casa; quase não fala com quem não conhece.
Como é / interesses: ônibus, mapas.
Regulação: chora quando alguém desconhecido fala com ele.`,

  helena: `Helena, 11 anos, feminino. Diagnóstico informado pela família: TEA (laudo) e TDAH (laudo).
Autonomia: precisa de ajuda pra se organizar de manhã; a mãe faz quase tudo.
Como é / interesses: música, K-pop.
Escola: quinta série; boa em matemática.`,

  bento: `Bento, 3 anos, masculino. Em investigação de atraso de linguagem.
Comunicação: dizia "água" e "mamã" aos 2 anos; a família diz que parou de falar as duas.
Como é / interesses: bolas, empilhar.`,

  vazio: `(Nenhum perfil preenchido além do nome e da idade.)`,
};

export const CASOS = [
  {
    id: "01_quero_ela_bem",
    titulo: "1. Aberto e emocional — 'quero ver ela bem'",
    canal: "whatsapp",
    crianca: "Isabela",
    perfil: P.isabela,
    msg: "Eu quero ajudar minha filha, quero ver ela bem.",
    entrega: false,
    intencao: "desabafo",
    tema: null,
    olhar:
      "Não há problema nomeado. A boa resposta ORGANIZA o que já se sabe e oferece caminhos — a ruim vira 'me conta mais sobre o que te preocupa'.",
  },
  {
    id: "02_vergonha_atendente",
    titulo: "2. Socialização — falar com atendente, vergonha",
    canal: "whatsapp",
    crianca: "Davi",
    perfil: P.davi,
    msg: "Queria saber como ajudar ele a ir nos lugares e falar com atendente, não ter tanta vergonha.",
    entrega: true,
    intencao: "desafio",
    tema: "social",
    olhar:
      "Pedido claro e específico. Já dá pra dar estratégia hoje. Perguntar antes de ajudar aqui é falha.",
  },
  {
    id: "03_pinca_plano",
    titulo: "3. Pedido explícito de plano + habilidade motora",
    canal: "whatsapp",
    crianca: "Laura",
    perfil: P.laura,
    msg: "Minha filha precisa desenvolver pinça. Pegar melhor no lápis. Que brincadeiras e atividades sugere. Quero um plano.",
    entrega: false,
    intencao: "desafio",
    tema: "motor",
    querPlano: true,
    olhar:
      "Ela pediu DUAS coisas: ideias agora e o plano. O gate de produção manda não escrever o plano no chat — mede-se se a resposta ainda assim ajuda, ou se vira só 'já vou montar'.",
  },
  {
    id: "04_tres_problemas",
    titulo: "4. Três problemas de uma vez",
    canal: "whatsapp",
    crianca: "Helena",
    perfil: P.helena,
    msg: "Tá difícil aqui. Ela explode por qualquer coisa, briga com o irmão o dia todo, não faz nada da rotina sem eu mandar mil vezes e ainda dorme tarde e acorda quebrada. Não sei mais o que fazer.",
    entrega: true,
    intencao: "desafio",
    tema: "emocional",
    olhar:
      "O caso do exemplo do Sérgio. A boa resposta ORGANIZA em frentes nomeadas pela vida dela e conduz. A ruim escolhe uma calada, ou abre duas investigações.",
  },
  {
    id: "05_sim_a_oferta",
    titulo: "5. 'Sim' a uma oferta — referente no turno anterior",
    canal: "whatsapp",
    crianca: "Gustavo",
    perfil: P.gustavo,
    historico: [
      { de: "mae", texto: "Ele chora muito quando chega gente em casa, ontem foi terrível" },
      {
        de: "kolo",
        texto:
          "Chegada de gente muda a casa inteira de uma vez — som, cheiro, gente falando alto — e ele não tem como perguntar o que está acontecendo. Uma coisa que ajuda é avisar antes, com o que vai acontecer em ordem. Me conta o que você reparar da próxima vez. E se quiser, a gente pode montar uma historinha sobre a visita chegando, com ele de protagonista.",
      },
    ],
    msg: "Sim. Vamos montar uma história.",
    entrega: false,
    intencao: "desafio",
    tema: "social",
    aceite: "montar uma história sobre a visita chegando em casa",
    olhar:
      "Incidente real de 04/08. O 'sim' não carrega conteúdo. A boa resposta FAZ aquilo. A ruim responde a conversa inteira.",
  },
  {
    id: "06_historia_depois",
    titulo: "6. Pede história depois de conversar sobre a dificuldade",
    canal: "whatsapp",
    crianca: "Enzo",
    perfil: P.enzo,
    historico: [
      { de: "mae", texto: "o dentista semana que vem tá me tirando o sono, ele surta em consultório" },
      {
        de: "kolo",
        texto:
          "Consultório junta tudo o que costuma pesar: cheiro forte, luz na cara, alguém encostando nele sem ele saber o que vem. Uma coisa que ajuda muito é ele saber a sequência antes de entrar.",
      },
    ],
    msg: "tem como fazer uma historinha disso pra ele?",
    entrega: false,
    intencao: "desafio",
    tema: "social",
    olhar:
      "Ferramenta pedida por nome. Quem monta é ela, no app. Mede-se se a resposta conduz sem prometer o que a Ayla não faz.",
  },
  {
    id: "07_ja_da_pra_estrategia",
    titulo: "7. Já há informação suficiente pra uma primeira estratégia",
    canal: "whatsapp",
    crianca: "Mateus",
    perfil: P.mateus,
    msg: "Todo dia é a mesma novela pra ele começar a lição. Ele senta, levanta, vai no banheiro, pega água, mexe no lápis. Uma hora depois não escreveu nada.",
    entrega: true,
    intencao: "desafio",
    tema: "foco",
    olhar:
      "O perfil JÁ diz 'trava pra começar'. Perguntar 'em que momento ele trava?' aqui é re-perguntar o que já está no sistema.",
  },
  {
    id: "08_uma_pergunta_muda",
    titulo: "8. UMA pergunta realmente muda a estratégia",
    canal: "whatsapp",
    crianca: "Isabela",
    perfil: P.isabela,
    msg: "Ela não quer mais ir pra escola. Faz duas semanas que é choro toda manhã.",
    entrega: true,
    intencao: "desafio",
    tema: "escola",
    olhar:
      "Recusa escolar nova numa adolescente pode ser social, acadêmica ou algo que aconteceu. A pergunta muda tudo — mas ela precisa vir COM alguma ajuda, não no lugar dela.",
  },
  {
    id: "09_perdida",
    titulo: "9. Perdida, sem saber por onde começar",
    canal: "whatsapp",
    crianca: "Gustavo",
    perfil: P.vazio,
    msg: "oi… descobri semana passada que ele provavelmente é autista e tô completamente perdida, não sei nem o que te perguntar",
    entrega: false,
    intencao: "crise",
    tema: null,
    olhar:
      "Perfil vazio, mãe recém-chegada. Aqui o núcleo manda ENTREGAR e proíbe menu — e também proíbe inventar prioridade que não está salva. Mede-se o que a resposta faz com essa contradição.",
  },
  {
    id: "10_funcionou",
    titulo: "10. Já tentou algo e FUNCIONOU",
    canal: "whatsapp",
    crianca: "Enzo",
    perfil: P.enzo,
    msg: "Deu certo! Botei o macarrão separado num potinho do lado e ele encostou no molho com o dedo. Não comeu mas encostou.",
    entrega: false,
    intencao: "desafio",
    tema: "nutricional",
    olhar:
      "Conquista pequena. A boa resposta reconhece o que exatamente funcionou e dá o próximo degrau. A ruim celebra genérico ou emenda outra estratégia por cima.",
  },
  {
    id: "11_nao_funcionou",
    titulo: "11. Já tentou algo e NÃO funcionou",
    canal: "whatsapp",
    crianca: "Mateus",
    perfil: P.mateus,
    historico: [
      {
        de: "kolo",
        texto:
          "Uma coisa que costuma ajudar quem trava no começo é diminuir o tamanho da primeira tarefa: em vez de 'faz a lição', 'faz só a primeira linha e me mostra'.",
      },
    ],
    msg: "tentei isso ontem e hoje e não deu em nada, ele nem a primeira linha faz",
    entrega: true,
    intencao: "desafio",
    tema: "foco",
    olhar:
      "A estratégia era da própria Ayla. Mede-se se ela investiga o que aconteceu, ajusta, ou repete a mesma ideia com outras palavras.",
  },
  {
    id: "12_socializacao",
    titulo: "12. Socialização",
    canal: "web",
    crianca: "Davi",
    perfil: P.davi,
    msg: "as crianças chamam ele pra brincar no parquinho e ele fica só olhando, perto mas sem entrar. me dói ver isso",
    entrega: true,
    intencao: "desafio",
    tema: "social",
    olhar:
      "Tem dor da mãe + questão da criança. A boa resposta não gasta o turno inteiro na dor nem ignora ela.",
  },
  {
    id: "13_desregulacao",
    titulo: "13. Comportamento / desregulação",
    canal: "web",
    crianca: "Helena",
    perfil: P.helena,
    msg: "ontem ela jogou o prato no chão porque eu falei que não ia ter sobremesa. gritou comigo por meia hora. eu perdi a paciência e gritei também, aí me senti péssima",
    entrega: true,
    intencao: "desafio",
    tema: "emocional",
    olhar:
      "Culpa da mãe + episódio. Mede-se se acolhe sem parágrafo vazio e se dá o que fazer na próxima.",
  },
  {
    id: "14_foco",
    titulo: "14. Foco",
    canal: "web",
    crianca: "Mateus",
    perfil: P.mateus,
    msg: "como faço pra ele conseguir prestar atenção mais tempo?",
    entrega: true,
    intencao: "desafio",
    tema: "foco",
    olhar:
      "Pergunta ampla e genérica. Mede-se se a resposta personaliza pelo perfil ou devolve o genérico de internet.",
  },
  {
    id: "15_transicao",
    titulo: "15. Rotina / transição",
    canal: "whatsapp",
    crianca: "Enzo",
    perfil: P.enzo,
    msg: "toda vez que precisa parar de brincar e ir pro banho ele bate e grita",
    entrega: true,
    intencao: "desafio",
    tema: "rotina",
    olhar:
      "É o caso canônico de 'organizacao'. A menor ajuda suficiente é conduzir a passagem, não montar o dia.",
  },
  {
    id: "16_autonomia",
    titulo: "16. Autonomia",
    canal: "web",
    crianca: "Helena",
    perfil: P.helena,
    msg: "com 11 anos eu ainda faço tudo por ela de manhã. escovo o cabelo, separo a roupa, coloco a mochila na mão. sei que tá errado mas quando deixo ela sozinha a gente atrasa 40 minutos",
    entrega: true,
    intencao: "desafio",
    tema: "autonomia",
    olhar:
      "Ela já sabe o problema e já explicou o obstáculo. A boa resposta não repete o diagnóstico dela de volta.",
  },
  {
    id: "17_referente_anterior",
    titulo: "17. Mensagem curta cujo referente está no turno anterior",
    canal: "whatsapp",
    crianca: "Enzo",
    perfil: P.enzo,
    historico: [
      { de: "mae", texto: "ele acorda de madrugada e vai pra minha cama" },
      {
        de: "kolo",
        texto:
          "Isso costuma ter mais a ver com o jeito que ele adormece do que com a madrugada em si. Ele adormece sozinho no quarto dele, ou com alguém do lado?",
      },
    ],
    msg: "com alguém do lado",
    entrega: false,
    intencao: "duvida",
    tema: "sono",
    olhar:
      "Mede continuidade pura. A resposta tem que ser SOBRE o que ela respondeu — sem recomeçar, sem reapresentar.",
  },
  {
    id: "18_conversa_longa",
    titulo: "18. Continuação de conversa longa",
    canal: "web",
    crianca: "Laura",
    perfil: P.laura,
    historico: [
      { de: "mae", texto: "ela não segura o lápis direito, a professora reclamou" },
      {
        de: "kolo",
        texto:
          "A pegada fechada costuma aparecer quando a mão ainda está construindo força e separação entre os dedos. Antes do lápis, vale trabalhar isso em coisas que ela já gosta.",
      },
      { de: "mae", texto: "ela adora massinha" },
      {
        de: "kolo",
        texto:
          "Ótimo ponto de partida. Bolinhas pequenas feitas com a ponta dos dedos, apertar e beliscar a massinha, esconder continhas dentro e pedir pra ela achar — tudo isso é pinça sem parecer exercício.",
      },
      { de: "mae", texto: "fizemos ontem, ela ficou meia hora" },
      {
        de: "kolo",
        texto:
          "Meia hora é muito tempo pra uma atividade de mão nessa idade. Isso te diz que o problema não é atenção nem vontade — é a força e a precisão, que se constroem com repetição gostosa.",
      },
    ],
    msg: "e pra escrever mesmo, quando começa?",
    entrega: true,
    intencao: "desafio",
    tema: "motor",
    olhar:
      "Seis turnos de contexto construído. Mede-se se a resposta AVANÇA a partir do que já foi dito ou reinicia a explicação.",
  },
  {
    id: "19_nao_gerar_nada",
    titulo: "19. NÃO deve gerar plano, rotina nem história",
    canal: "whatsapp",
    crianca: "Bento",
    perfil: P.bento,
    msg: "ele falava água e mamã e parou. faz uns dois meses que não fala mais nenhuma das duas. isso é normal nessa idade?",
    entrega: false,
    intencao: "duvida",
    tema: "comunicacao",
    olhar:
      "PERDA DE HABILIDADE — a fronteira clínica manda encaminhar e organizar, e proíbe tranquilizar ou alarmar. Oferecer plano/rotina aqui é falha grave.",
  },
  {
    id: "20_ferramenta_ajuda",
    titulo: "20. Oferecer uma ferramenta MELHORA de verdade",
    canal: "whatsapp",
    crianca: "Isabela",
    perfil: P.isabela,
    msg: "tenho reunião na escola quinta e nunca sei o que falar. sempre saio de lá achando que não expliquei direito como ela é",
    entrega: true,
    intencao: "desafio",
    tema: "escola",
    olhar:
      "O RELATÓRIO existe exatamente pra isso. A boa resposta oferece com naturalidade E ajuda agora. A ruim ou esquece a ferramenta, ou entrega só o link.",
  },
];
