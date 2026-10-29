import { referenciasBase44 } from "./casos-base44-referencia.mjs";

// Demonstrações sintéticas, nunca leitura/escrita do cadastro da Manu.
// As expectativas são uma régua para revisão; não são resultados de teste.
const referencia = referenciasBase44.find((caso) => caso.id === "ref_introducao_foco");
export const casosPilotoFoco = [
  {
    ...referencia,
    id: "foco_abertura_conhecida_e_escolha",
    mensagens: [
      referencia.mensagem,
      "Quero orientações práticas para ela começar os estudos para o vestibular, sem eu ficar cobrando.",
      "Me dê ideias de outras coisas que posso te pedir sobre isso.",
    ],
    verificar: [
      "Abertura reconhece atenção em interesses já relatada, propósito e quatro caminhos, com áudio.",
      "Não pergunta nome/idade nem se ela sustenta atenção no que gosta; não infantiliza a jovem adulta.",
      "Escolha entrega orientação de estudo e autonomia, não nova apresentação; ideias finais são específicas.",
    ],
  },
  {
    id: "foco_abertura_sem_dados_do_tema",
    tema: "foco",
    pessoa: { nome: "Luna", nascimento: "2018-02-12", genero: "feminino" },
    mensagem: "Quero explorar Atenção e Concentração.",
    verificar: [
      "Apresenta propósito e até três perguntas pertinentes em bullets, com convite a texto/áudio.",
      "Não pergunta nome/idade disponíveis; não inventa atenção, comunicação, interesses ou conquistas.",
    ],
  },
  {
    id: "foco_abertura_dados_parciais",
    tema: "foco",
    pessoa: { nome: "Bento", nascimento: "2017-06-20", genero: "masculino",
      sabe: { como_e: { interesses: ["trens", "mapas"] } },
      extras: { comunicacao: "Conversa em frases e aponta quando prefere." } },
    mensagem: "Quero explorar Atenção e Concentração.",
    verificar: [
      "Retoma interesses sem deduzir que sustenta atenção neles; pergunta só pelas lacunas de Foco.",
      "Interesses conhecidos não viram habilidades, hiperfoco ou causa confirmada.",
    ],
  },
  {
    id: "foco_caso_concreto_e_refinamento",
    tema: "foco",
    pessoa: { nome: "Clara", nascimento: "2018-03-15", genero: "feminino",
      sabe: { como_e: { interesses: ["quebra-cabeças", "animais"] } },
      extras: { foco: "Mantém atenção montando quebra-cabeças. A escola relata demora para iniciar tarefas escritas." } },
    mensagem: "Estou exausta de chamar a Clara para a lição. Com quebra-cabeça ela fica um tempão. Acho que só faz quando quer. Como posso ajudar sem brigar?",
    mensagens: [
      "Estou exausta de chamar a Clara para a lição. Com quebra-cabeça ela fica um tempão. Acho que só faz quando quer. Como posso ajudar sem brigar?",
      "Quando eu começo a primeira com ela, depois faz tudo certo. O difícil é começar.",
      "Já faço a primeira junto, mas agora diz que vai errar e apaga tudo várias vezes. O que mudo?",
    ],
    verificar: [
      "Pedido de ajuda com exaustão recebe compreensão, ações, fala pronta e continuação, não só acolhimento/pergunta.",
      "Reformula só-faz-quando-quer sem culpabilizar nem diagnosticar; usa capacidade já demonstrada.",
      "Informação nova muda sustentação para iniciação e depois medo de errar como hipótese, sem repetir timer/primeira-junto.",
    ],
  },
  {
    id: "foco_dois_irmaos_alvo_correto",
    tema: "foco",
    pessoa: { nome: "Lia", nascimento: "2019-04-10", genero: "feminino",
      sabe: { como_e: { interesses: ["desenho", "gatos"] } },
      extras: { foco: "Acompanha histórias desenhando. Perde a segunda instrução quando o pedido tem várias etapas." } },
    outrasPessoas: [{ nome: "Rui", nascimento: "2014-07-18", genero: "masculino",
      sabe: { como_e: { interesses: ["xadrez"] } }, extras: { foco: "Mantém concentração em partidas longas." } }],
    mensagem: "Quero ajudar a Lia: ela pega o caderno, mas esquece o que eu pedi depois. O Rui está bem, é sobre ela.",
    verificar: [
      "Usa dados de Lia, não xadrez/concentração de Rui; considera carga de instrução sem presumir incapacidade.",
      "Oferece ajuste executável na instrução e observação do resultado, sem exigir imobilidade.",
    ],
  },
];

const nina = { nome: "Nina", nascimento: "2021-02-12", genero: "feminino",
  sabe: { como_e: { interesses: ["cozinhar de faz-de-conta", "bonecas", "brincadeiras com água"] } },
  extras: { comunicacao: "Conversa em frases e expressa suas escolhas.", foco: "Permanece envolvida nas brincadeiras de cozinha. Ainda não há relato de como inicia ou retoma outras tarefas em casa." } };
const bia = { nome: "Bia", nascimento: "2021-03-15", genero: "feminino",
  sabe: { como_e: { interesses: ["massinha"] } }, extras: { comunicacao: "Conversa em frases, aponta e inventa personagens." } };

/** Perguntas da simulação aprovada, sem gravar idade/interesses na Manu. */
export const casosAlinhamentoFoco = [
  { id: "foco_professora_casa_e_brincadeira", tema: "foco", pessoa: nina,
    mensagem: "a professora falou que ela não tem muito foco. que se distrai na sala de aula. não conclui a atividade em tempo",
    mensagens: [
      "a professora falou que ela não tem muito foco. que se distrai na sala de aula. não conclui a atividade em tempo",
      "teria alguma brincadeira para melhorar atenção?",
    ],
    verificar: ["Começa por observações e apoio possível em casa, sem depender de mudar a escola.",
      "Não pergunta novamente se sustenta atenção na cozinha; pergunta só pelas situações desconhecidas.",
      "Pedido de brincadeira entrega três jogos completos e distintos; interesses não limitam todas as opções.",
      "Cada jogo explica a habilidade ligada à ação e a troca compartilhada, sem promessa de melhora ou vínculo garantido."] },
  { id: "foco_massinha_e_repertorio_aberto", tema: "foco", pessoa: bia,
    mensagem: "Ela adora massinha. Tem brincadeiras para atenção? Podemos experimentar outras que não envolvam massinha.",
    verificar: ["Entrega três alternativas distintas, incluindo propostas sem massinha.",
      "Jogos têm convite, ação da criança, consequência divertida e continuação; não exercícios de obedecer."] },
  { id: "foco_quantidade_explicitamente_uma", tema: "foco", pessoa: bia,
    mensagem: "Quero apenas uma brincadeira, bem completa, para fazer agora.",
    verificar: ["Respeita a quantidade explícita de uma, sem despejar três opções.",
      "Adequada a cinco anos, com escolha e participação, sem prometer melhora escolar."] },
];
