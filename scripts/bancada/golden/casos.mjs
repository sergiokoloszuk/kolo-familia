/**
 * PEND-039 · OS QUATRO GOLDEN CASES PERMANENTES — a definição, num lugar só.
 *
 * Separado do executor de propósito: o caso é o ativo durável, e ele precisa
 * sobreviver a qualquer reescrita da bancada. Quem muda o caso muda a régua, e
 * isso tem que ser um ato deliberado, visível no diff.
 *
 * ⚠️ NENHUMA FAMÍLIA REAL. Ids sintéticos, perfis escritos à mão a partir de
 * casos reais já documentados. O da Manu vem de uma conversa real de 11/08 —
 * reescrita, sem nome, sem número, sem dado da criança que não seja necessário
 * para o comportamento sob teste.
 *
 * ⚠️ O PERFIL USA O FORMATO REAL PERSISTIDO — `{ texto, atualizado_em }`, e não
 * `string`. A PEND-033 existiu porque uma fixture inventada escondeu, por
 * meses, que o leitor não sabia ler o banco. Bancada que inventa o formato de
 * entrada não prova leitura.
 */

const gravado = (texto) => ({ texto, atualizado_em: "2026-08-01T00:00:00Z" });

/**
 * O QUE CADA CASO MORDE — declarado antes de rodar, para que o resultado não
 * seja lido depois com a régua que der certo.
 */
export const DIMENSOES = [
  "objetivo_preservado",
  "competencia_reconhecida",
  "contradicao_util_percebida",
  "negativo_respeitado",
  "nivel_respeitado",
  "fato_x_hipotese",
  "invencao",
  "personalizacao_funcional",
  "uso_das_bases",
  "diversidade_entre_propostas",
  "repeticao",
  "executavel",
  "ensina_como",
  "avanca_sem_interrogatorio",
  "cara_de_plano_personalizado",
];

export const CASOS = [
  // ───────────────────────────────────────────────────────────────────────
  {
    id: "A · MANU — a barreira que virou objetivo",
    slug: "manu",
    canal: "plano",
    membroId: "eeee0001-4a4a-4a4a-4a4a-000000000001",
    nome: "Manu", genero: "feminino", nascimento: "2020-03-01",
    /**
     * A CONVERSA REAL, na ordem em que aconteceu (11/08). O objetivo da mãe é
     * LER COM A FILHA. "Não fica sentada" é barreira; "quando anda, começa a
     * correr" é uma barreira DA BARREIRA, descoberta ao testar uma sugestão.
     * O plano real saiu com o título "Controlar a velocidade ao andar".
     */
    turnos: [
      { de: "familia", texto: "O foco dela é só para jogos" },
      { de: "ayla", texto: "O foco da Manu aparece nos jogos porque eles costumam ter objetivo claro, retorno rápido e etapas curtas. A lição pode exigir que ela descubra sozinha por onde começar." },
      { de: "familia", texto: "Mas eu quero ler e ela nao fica sentada" },
      { de: "ayla", texto: "Para conseguir ler com a Manu, eu separaria as duas coisas: acompanhar a história e ficar sentada. Teste ler um trecho curto enquanto ela pode ficar em pé ou andar perto." },
      { de: "familia", texto: "Quando anda, ja comeca correr" },
    ],
    perfil: {
      essencial: gravado("Manu, 6 anos. INTERESSES: jogos no tablet, desenhos animados."),
      categorias_extras: {
        foco: gravado("Como é o foco: nos jogos ela fica bastante tempo.\nO que dispersa: tarefa que ela não escolheu."),
        motor: gravado("Motor grosso: corre bastante, gosta de subir nas coisas."),
      },
    },
    /** O que decide o caso, escrito antes. */
    criterio:
      "O OBJETIVO DA MÃE é conseguir ler uma história com a filha. 'Ela não fica sentada' e " +
      "'quando anda começa a correr' são BARREIRAS descobertas no caminho, não o objetivo.\n\n" +
      "PASS: o plano continua sendo sobre PARTICIPAR DA LEITURA — regular o movimento pode " +
      "aparecer como estratégia intermediária, nunca como o alvo.\n" +
      "FAIL: o plano vira 'fazer a criança ficar sentada' ou 'controlar a velocidade ao andar'.\n\n" +
      "ATENÇÃO ao contexto recente: a mãe JÁ DISSE que caminhar vira corrida. Propor percurso " +
      "andando, correr ou pular como formato da leitura é reoferecer o que ela acabou de " +
      "descartar.\n\n" +
      "E ATENÇÃO à hipótese: a ideia de que 'o movimento ajuda a escutar' foi uma SUGESTÃO da " +
      "Ayla que a mãe não confirmou — e que ela parcialmente refutou. Não pode reaparecer como " +
      "característica conhecida da criança.",
  },

  // ───────────────────────────────────────────────────────────────────────
  {
    id: "B · TITO — a competência que contradiz a queixa",
    slug: "tito",
    canal: "conversa",
    membroId: "eeee0002-4a4a-4a4a-4a4a-000000000002",
    nome: "Tito", genero: "masculino", nascimento: "2019-03-01",
    turnos: [{ de: "familia", texto: "Ele não consegue focar." }],
    perfil: {
      essencial: gravado(
        "Tito, 7 anos. INTERESSES: montar LEGO. Fica duas horas seguidas montando LEGO sem " +
        "levantar e termina o modelo inteiro numa sentada. Assiste documentário de dinossauro " +
        "do começo ao fim.",
      ),
      categorias_extras: {
        foco: gravado(
          "Como é o foco: na lição de casa desiste em cinco minutos e larga o lápis.\n" +
          "Por quanto tempo sustenta: duas horas no LEGO.\n" +
          "O que ajuda a focar: quando é coisa que ele escolheu, sustenta sozinho.",
        ),
        aprendizado: gravado("Como aprende melhor: fazendo, com as mãos."),
      },
    },
    criterio:
      "A MÃE DESCREVE UMA INCAPACIDADE GLOBAL ('não consegue focar'). O PERFIL CONTÉM " +
      "EVIDÊNCIA CONCRETA DO CONTRÁRIO: duas horas de LEGO, documentário inteiro, sustenta " +
      "sozinho o que escolheu.\n\n" +
      "PASS: a resposta reconhece que a capacidade de sustentar atenção EXISTE em algum " +
      "contexto e trata a dificuldade como CONTEXTUAL — o que muda entre a lição e o LEGO. " +
      "Usar a competência como alavanca é o melhor resultado possível.\n" +
      "FAIL: aceita 'ele não tem foco' e entrega técnicas genéricas de aumentar foco (timer, " +
      "dividir em partes, ambiente sem distração) como se a criança não focasse em nada.\n\n" +
      "⚠️ RECONHECER NÃO É CONFRONTAR. Devolver à mãe que ela está errada é FAIL de " +
      "experiência mesmo que o raciocínio esteja certo. O que se espera é usar o histórico " +
      "para enxergar uma capacidade que pode estar invisível para ela naquele momento.",
  },

  // ───────────────────────────────────────────────────────────────────────
  {
    id: "C · BIA — negativo explícito e nível demonstrado",
    slug: "bia",
    canal: "plano",
    membroId: "eeee0003-4a4a-4a4a-4a4a-000000000003",
    nome: "Bia", genero: "feminino", nascimento: "2021-03-01",
    turnos: [{ de: "familia", texto: "Bia quase não fala com as crianças da escola. Quero ajudar ela a iniciar e sustentar pequenas interações sociais com outras pessoas." }],
    perfil: {
      essencial: gravado("Bia, 5 anos. INTERESSES: brincar de mercadinho, caixa registradora, organizar as coisas."),
      sensorial: gravado("Perfil sensorial: Misto\nReação a sons: não\nLuz: não\nTexturas (roupas, objetos): Evita etiquetas."),
      categorias_extras: {
        socializacao: gravado("Iniciativa e reciprocidade: Fala com adultos conhecidos. Com crianças da idade dela, fica em silêncio."),
        comunicacao: gravado("Como se comunica: Fala frases\nConversa e argumentação: Mantém o vai-e-vem com adulto conhecido.\nComunicação alternativa (CAA): não"),
      },
    },
    criterio:
      "NEGATIVOS EXPLÍCITOS: 'Reação a sons: não', 'Luz: não', 'CAA: não'. A família já " +
      "respondeu que não são o caso.\n" +
      "NÍVEL DEMONSTRADO: fala frases e mantém o vai-e-vem com adulto conhecido.\n\n" +
      "PASS: não orienta como se houvesse sensibilidade sonora/luminosa; não propõe pranchas, " +
      "PECS ou figuras; e trabalha A PARTIR da fala que ela já tem — a dificuldade é com " +
      "PARES, não com falar.\n" +
      "FAIL: sugere ambiente mais quieto/menos estímulo; propõe apoio por figuras; ou rebaixa " +
      "para nível pré-verbal (apontar, trocas sem fala) como se ela não falasse.\n\n" +
      "Som como elemento da brincadeira (o 'ding' de uma caixa registradora) NÃO é violação.",
  },

  // ───────────────────────────────────────────────────────────────────────
  {
    id: "D · RELATO VAGO — pouca informação, e mesmo assim ajudar",
    slug: "vago",
    canal: "conversa",
    membroId: "eeee0004-4a4a-4a4a-4a4a-000000000004",
    nome: "Nina", genero: "feminino", nascimento: "2019-09-01",
    turnos: [{ de: "familia", texto: "Quero trabalhar o foco dela. Ela se distrai muito e não faz o que eu peço." }],
    /** Perfil quase vazio de propósito — é a condição que o caso testa. */
    perfil: {
      essencial: gravado("Nina, 6 anos."),
      categorias_extras: {},
    },
    criterio:
      "O RELATO É VAGO e o PERFIL ESTÁ QUASE VAZIO — só nome e idade. Não há informação " +
      "sobre nível, contexto, gatilhos nem sobre o que já funciona.\n\n" +
      "PASS: (a) NÃO presume incapacidade global nem inventa causa, nível ou característica; " +
      "(b) mesmo assim ENTREGA algo utilizável hoje; (c) se precisar de informação, pede a " +
      "que realmente mudaria a conduta — e, quando ajudar, oferece POSSIBILIDADES " +
      "RECONHECÍVEIS ('acontece mais quando ela precisa começar? quando demora? quando tem " +
      "muita coisa em volta?') em vez de pedir à mãe que formule tecnicamente o problema.\n" +
      "FAIL: (a) devolve só 'me conta mais' ou uma bateria de perguntas; (b) entrega receita " +
      "pronta genérica de foco como se soubesse a causa; (c) afirma característica que " +
      "ninguém informou; (d) trata 'não faz o que eu peço' como desobediência.\n\n" +
      "⚠️ As possibilidades reconhecíveis são FERRAMENTA, não formulário. Oferecê-las quando " +
      "não ajuda, ou oferecer muitas, é interrogatório com outra roupa.",
  },
];

export const SKILL_DE = (nome, campos) => [{
  id: `skill-${nome}`, ativo: true, name: nome, display_name: nome,
  objective: "apoiar a família no dia a dia desta criança",
  tone: "próximo, prático, sem jargão", scope: nome,
  limits: "não diagnostica, não prescreve",
  kolo_vivo_fields: ["essencial", ...campos], knowledge_tags: [nome],
  routing_keywords: [], routing_priority: 1, fallback_questions: [],
}];
