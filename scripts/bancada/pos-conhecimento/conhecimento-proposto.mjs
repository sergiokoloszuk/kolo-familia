/**
 * Conteúdo editorial proposto para a incorporação cirúrgica da Pós.
 *
 * Este arquivo é fixture da bancada: não escreve no banco. A migração 0089
 * repete estes quatro registros para que o A/B possa acontecer antes da
 * publicação. Brincadeira e mudança abrupta não aparecem aqui de propósito:
 * o baseline mostrou que a conduta desejada já existe e duplicá-la pioraria o
 * repertório.
 */

export const conhecimentoProposto = [
  {
    operacao: "insert",
    id: "e1e083df-15ea-4297-9652-69530f8780e7",
    titulo: "Puxar pela mão, apontar ou entregar objeto já é comunicação funcional",
    resumo:
      "Reconhecer a forma comunicativa que já funciona e modelar somente o próximo passo possível.",
    versao_curta:
      "Parta do gesto, objeto, aproximação de palavra ou ecolalia que já comunica algo; responda ao sentido e modele um passo pequeno.",
    versao_conversa:
      "Puxar pela mão, apontar, entregar um objeto, aproximar uma palavra ou usar uma ecolalia com função já comunica algo. Responda ao sentido e modele só um próximo passo. Quando o Perfil trouxer a forma que a criança já usa, torne isso perceptível com naturalidade: se já usa palavras soltas, ligue essa habilidade a UMA palavra do item pedido, não a um menu genérico. Nunca exija fala ou contato visual para atender.",
    quando_usar:
      "Quando a família diz que a criança não pede, mas relata gesto, objeto, som, aproximação de palavra, script ou ecolalia com função.",
    passos_praticos: [
      "Reconheça primeiro o significado da forma comunicativa que apareceu.",
      "Cruze com o Perfil: se já usa palavras soltas, diga isso naturalmente e modele uma única palavra do item real; se usa gesto ou objeto, amplie a partir dessa forma.",
      "Atenda ao pedido possível sem transformar fala ou olhar em condição para atender.",
      "Observe qual forma a criança volta a usar espontaneamente em situação parecida.",
    ],
    atividades_praticas: [],
    erros_comuns: [
      "dizer que a criança não se comunica quando o relato já mostra uma forma funcional",
      "reter o item até obter fala ou contato visual",
      "pedir várias habilidades novas de uma vez",
      "listar fala, gesto, imagem e apontar quando o Perfil já mostra qual via está disponível",
      "oferecer um menu de palavras genéricas em vez de escolher a palavra ligada ao pedido real",
    ],
    crencas_adulto: "Só conta como pedido quando a criança fala ou olha para o adulto.",
    skills_relacionadas: ["comunicacao"],
    tags: [
      "comunicacao_funcional",
      "pedir",
      "puxa_pela_mao",
      "apontar",
      "entregar_objeto",
      "aproximacao_de_palavra",
      "ecolalia_funcional",
    ],
    faixa_etaria_min: 1,
    faixa_etaria_max: 18,
    perfis_aplicaveis: [],
    nivel: "iniciante",
    peso_relevancia: 0.5,
    versao: 1,
    status: "ativo",
    origem: "admin",
    texto_original:
      "Curadoria da Base da Pós canônica: Manual §1/§3 (comunicação e escada pré-verbal) + Compêndio Tema 2 (perfil funcional da comunicação), com limites do Prompt Mestre da Agência.",
  },
  {
    operacao: "update",
    id: "4f7f16aa-f67a-44d1-bf4b-ce23c54f7e35",
    titulo: "Não quer fazer: distinguir compreender, começar, sustentar e pré-requisito",
    resumo:
      "Reduzir o primeiro passo e usar o efeito como pista antes de atribuir a recusa a foco, motivação ou oposição.",
    versao_curta:
      "Ajude com um primeiro passo pequeno e visível; a resposta ajuda a distinguir dificuldade de compreender, iniciar, sustentar ou executar.",
    versao_conversa:
      "\"Não quer fazer\" ainda não explica a barreira. Ajude primeiro tornando só o começo pequeno e visível. Se precisar perguntar, escolha um único contraste que mude a próxima ajuda — por exemplo, se não sabe como começar ou se começa e logo para.",
    quando_usar:
      "Quando a família relata recusa ampla de atividade, tarefa ou aprendizagem sem ainda localizar em que ponto a participação trava.",
    passos_praticos: [
      "Mostre ou faça junto apenas o primeiro passo, em menos de um minuto.",
      "Observe se a criança entra, permanece por pouco tempo ou continua sem conseguir executar.",
      "Use essa diferença para escolher entre apoio de compreensão, início, permanência, pré-requisito, transição ou ambiente.",
    ],
    atividades_praticas: [],
    erros_comuns: [
      "despejar todas as hipóteses para a família",
      "concluir preguiça, oposição ou falta de foco pelo relato amplo",
      "investigar longamente antes de oferecer uma primeira ajuda reversível",
    ],
    crencas_adulto: "Se não faz, é porque não quer ou não presta atenção.",
    skills_relacionadas: ["foco", "aprendizado", "comunicacao", "emocional", "autonomia"],
    tags: [
      "nao_quer_fazer",
      "atividade",
      "iniciar",
      "sustentar",
      "compreensao",
      "pre_requisito",
      "demanda",
    ],
    faixa_etaria_min: 1,
    faixa_etaria_max: 18,
    peso_relevancia: 0.5,
  },
  {
    operacao: "update",
    id: "d5c505c5-03cf-4d5b-9dc9-562bfb6c327d",
    titulo: "No primeiro teste no mercado, mude só o ambiente antes de concluir desatenção",
    resumo:
      "Em ambientes cheios, mudar uma variável do ambiente ou da demanda e comparar antes de concluir foco ou comportamento.",
    versao_curta:
      "Teste uma única mudança ambiental, sem somar regra ou tarefa; compare o que muda, porque sensorial é hipótese, não conclusão.",
    versao_conversa:
      "Em mercado, festa, escola barulhenta ou lugar cheio, correr ou parecer não escutar não prova falta de atenção. Ajude primeiro com UMA mudança ambiental, como ir num horário mais vazio. Nesse primeiro teste, não acrescente tarefa nem treino de regra. Observe se ele corre menos ou responde mais; se nada mudar, reduza o peso da hipótese sensorial.",
    quando_usar:
      "Quando a dificuldade aparece em ambiente com muito som, luz, movimento ou pessoas e há no relato ou Perfil alguma pista sensorial.",
    passos_praticos: [
      "Escolha uma só mudança possível; prefira horário mais vazio quando o relato for sobre mercado.",
      "Sem adicionar regra ou tarefa, compare uma resposta observável naquele recorte: correr menos ou responder mais.",
      "Se melhorar, trate como pista contextual; se não mudar, explore compreensão, espera, limite, interesse, cansaço ou outra barreira.",
    ],
    atividades_praticas: [],
    erros_comuns: [
      "chamar toda dificuldade de foco ou comportamento",
      "chamar toda dificuldade em lugar cheio de sensorial",
      "somar treino de regra ou resposta ao primeiro teste ambiental",
      "mudar várias variáveis ao mesmo tempo e concluir uma causa",
    ],
    crencas_adulto: "Se não responde no mercado, está escolhendo não ouvir.",
    skills_relacionadas: ["sensorial", "foco", "emocional", "rotina", "comunicacao"],
    tags: [
      "mercado",
      "ambiente_cheio",
      "barulho",
      "luz",
      "movimento",
      "corre",
      "nao_escuta",
      "carga_sensorial",
    ],
    faixa_etaria_min: 1,
    faixa_etaria_max: 18,
    peso_relevancia: 0.5,
  },
  {
    operacao: "insert",
    id: "60263003-e70e-4246-a2dc-cc7e49caa37e",
    titulo: "Fica sozinho no recreio: observar a entrada e construir uma ponte concreta",
    resumo:
      "Distinguir ausência de tentativa, tentativa sem entrada e conflito, e pedir mediação concreta ao adulto.",
    versao_curta:
      "No recreio, uma dupla, papel definido e adulto iniciando a ponte são mais acionáveis do que apenas incentivar socialização.",
    versao_conversa:
      "Ficar sozinho não mostra, por si só, se a criança prefere aquele momento, tenta entrar e não consegue ou encontra conflito. Ajude primeiro pedindo ao adulto uma ponte concreta: uma dupla possível, dois papéis claros e apoio apenas para iniciar a atividade.",
    quando_usar:
      "Quando a família relata isolamento, dificuldade de brincar com pares ou conflitos repetidos no recreio ou em outro grupo.",
    passos_praticos: [
      "Peça ao adulto uma observação concreta do que acontece antes de a criança ficar sozinha.",
      "Teste uma entrada estruturada com uma criança possível e papéis complementares ligados a um interesse real.",
      "Observe aproximação, troca ou permanência, sem usar quantidade de fala como único critério.",
    ],
    atividades_praticas: [],
    erros_comuns: [
      "dizer apenas para incentivar a socialização",
      "esperar que proximidade física produza participação sozinha",
      "forçar grupo grande sem saber como a criança tenta entrar",
    ],
    crencas_adulto: "Basta colocar a criança perto das outras para ela aprender a participar.",
    skills_relacionadas: ["socializacao", "comunicacao", "emocional"],
    tags: [
      "recreio",
      "fica_sozinho",
      "pares",
      "entrada_na_brincadeira",
      "mediacao_adulto",
      "dupla",
      "papel_definido",
    ],
    faixa_etaria_min: 4,
    faixa_etaria_max: 18,
    perfis_aplicaveis: [],
    nivel: "iniciante",
    peso_relevancia: 0.5,
    versao: 1,
    status: "ativo",
    origem: "admin",
    texto_original:
      "Curadoria da Base da Pós canônica: Compêndio Tema 6 (sociometria escolar e mediação ativa de pares), com limites do Prompt Mestre da Agência.",
  },
];

export const idsPropostos = new Set(conhecimentoProposto.map((bp) => bp.id));
