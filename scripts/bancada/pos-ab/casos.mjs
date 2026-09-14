/**
 * OS CASOS DA BANCADA A/B COM MODELO NO LAÇO — 14/09/2026.
 *
 * ⚠️ A ÚNICA PERGUNTA: *"a Ayla COM a pós entende melhor a criança, escolhe
 * melhor o próximo passo e entrega uma resposta mais útil?"*. Tudo aqui existe
 * para responder isso — não para premiar resposta mais longa nem mais clínica.
 *
 * ⚠️ OS PERFIS SÃO SINTÉTICOS E COMPLETOS DE PROPÓSITO. A pós só prova valor se
 * tiver com que raciocinar: um perfil vazio faz os dois braços responderem no
 * genérico e a bancada mede nada. Os perfis abaixo têm o que uma família real
 * tem depois de algumas semanas de uso.
 *
 * `fonte` declara qual das TRÊS fontes o caso deveria exigir — e é ela que
 * separa "a pós ajudou" de "a pós apareceu".
 */

// ─────────────────────────────────────────────── perfis reutilizáveis
const PRE_VERBAL = {
  nome: "Téo",
  nascimento: "2023-02-10",
  genero: "masculino",
  perfil: {
    comunicacao: {
      forma: "não fala palavras; usa som e puxa a mão",
      entende: "entende ordens simples do dia a dia",
      contato: "olha pouco para o rosto, mais para objetos",
    },
    emocional: { gatilhos: "quando não consegue mostrar o que quer" },
    gostos: { hiperfocos: "água e liquidificador" },
  },
};

const PALAVRAS_SOLTAS = {
  nome: "Ana",
  nascimento: "2021-06-01",
  genero: "feminino",
  perfil: {
    comunicacao: {
      forma: "fala cerca de 20 palavras soltas",
      mostra: "aponta para o que quer",
      contato: "olha quando chamada pelo nome",
    },
    sensorial: { perfil: "incomoda com barulho alto", sons: "tapa os ouvidos no liquidificador" },
    gostos: { hiperfocos: "bichos de pelúcia" },
  },
};

/**
 * MARIO — O ARQUÉTIPO OBRIGATÓRIO (Etapa 9).
 *
 * ⚠️ A PERGUNTA QUE ESTE PERFIL EXISTE PARA RESPONDER: a pós ajuda a Ayla a
 * perceber que ele CONVERSA BEM e que o problema é ACESSO À COMUNICAÇÃO SOB
 * ESTRESSE — em vez de tratá-lo como pré-verbal?
 *
 * O perfil diz, em letras claras, que ele monta frases e argumenta. Um braço
 * que sugerir trabalhar contato visual ou atenção compartilhada errou o degrau.
 */
const MARIO = {
  nome: "Mario",
  nascimento: "2017-04-12",
  genero: "masculino",
  perfil: {
    comunicacao: {
      forma: "monta frases completas, conversa e argumenta",
      vocabulario: "amplo para a idade",
      conversa: "sustenta conversa sobre o que gosta; muda de assunto para o interesse dele",
      contato: "olha nos olhos quando está tranquilo",
    },
    emocional: {
      gatilhos: "errar, perder no jogo, ser corrigido na frente dos outros",
      sinais: "fica vermelho, fecha as mãos, para de falar",
      manifesta: "chora e se joga no sofá",
      ajuda: "ficar perto em silêncio; falar depois que passa",
    },
    foco: { hiperfocos: "dinossauros e mapas", sustenta: "muito tempo no que ama" },
    escola: { funciona: "vai bem em leitura e matemática", queixas: "briga quando erra" },
    gostos: { hiperfocos: "dinossauros, mapas" },
  },
};

const CAA = {
  nome: "Lia",
  nascimento: "2019-09-20",
  genero: "feminino",
  perfil: {
    comunicacao: {
      forma: "não verbal; usa prancha de figuras no tablet",
      caa: "prancha com 40 figuras, usa para pedir",
      mostra: "leva o tablet até o adulto",
      entende: "entende bem instruções do dia",
    },
    socializacao: { interage: "busca os adultos, evita crianças" },
  },
};

const ADOLESCENTE = {
  nome: "Iris",
  nascimento: "2012-03-03",
  genero: "feminino",
  perfil: {
    comunicacao: {
      forma: "fala fluente, lê e escreve com autonomia",
      conversa: "conversa longo sobre o que domina; não percebe quando o outro cansou",
    },
    socializacao: { com_quem: "prefere adultos", interage: "não entra em grupo" },
    escola: { funciona: "notas altas", queixas: "sem amigos, come sozinha" },
  },
};

const BUSCA_SENSORIAL = {
  nome: "Davi",
  nascimento: "2020-11-05",
  genero: "masculino",
  perfil: {
    comunicacao: { forma: "frases de 3 palavras" },
    sensorial: {
      perfil: "busca movimento o tempo todo",
      movimento: "gira, pula do sofá, se joga no chão",
      toques: "gosta de apertos fortes",
    },
    foco: { dispersa: "não fica sentado nem 2 minutos" },
  },
};

const FRASES_POUCA_TROCA = {
  nome: "Noa",
  nascimento: "2020-01-15",
  genero: "feminino",
  perfil: {
    comunicacao: {
      forma: "monta frases curtas",
      vocabulario: "sabe muitas palavras, cores e números",
      iniciativa: "quase só pede; não comenta nem pergunta",
    },
    socializacao: { interage: "brinca perto, não junto" },
  },
};

export const CASOS = [
  // ═══════════════ GRUPO 1 — COMUNICAÇÃO
  {
    id: "G1-preverbal",
    grupo: "comunicacao",
    critico: true,
    fonte: "pos",
    crianca: PRE_VERBAL,
    relato: "O Téo não fala nada ainda, só puxa minha mão pra pegar as coisas. Ele entende tudo o que eu peço. Já tem 3 anos e meio.",
    oQueImporta: "descer a escada — atenção compartilhada/triangulação antes de vocabulário",
    reprovaSe: "tratar como questão de vocabulário ou mandar treinar palavras",
  },
  {
    id: "G1-palavras-soltas",
    grupo: "comunicacao",
    fonte: "pos",
    crianca: PALAVRAS_SOLTAS,
    relato: "A Ana fala umas 20 palavras soltas e não junta duas. Como eu faço ela falar frase?",
    oQueImporta: "trocar turnos e função comunicativa antes de cobrar combinação",
    reprovaSe: "listar exercícios de repetição de palavra",
  },
  {
    id: "G1-frases-pouca-troca",
    grupo: "comunicacao",
    fonte: "pos",
    crianca: FRASES_POUCA_TROCA,
    relato: "A Noa sabe todas as cores, conta até 50 e monta frases, mas ela não conversa comigo. Só pede as coisas.",
    oQueImporta: "semântica × pragmática — o alvo é diversificar FUNÇÃO, não vocabulário",
    reprovaSe: "elogiar o vocabulário e sugerir ampliar palavras",
  },
  {
    id: "G1-conversa-bem",
    grupo: "comunicacao",
    critico: true,
    fonte: "pos",
    crianca: MARIO,
    mario: true,
    relato: "O Mario conversa super bem, argumenta comigo sobre dinossauro por meia hora. Mas com os colegas ele não engata.",
    oQueImporta: "pragmática social num menino verbal — NÃO é degrau pré-verbal",
    reprovaSe: "sugerir contato visual, imitação ou atenção compartilhada",
  },
  {
    id: "G1-perde-fala",
    grupo: "comunicacao",
    critico: true,
    fonte: "pos",
    crianca: MARIO,
    mario: true,
    relato: "Quando o Mario fica nervoso ele simplesmente para de falar. Some a fala. Aí eu pergunto o que houve e ele não responde nada.",
    oQueImporta: "ACESSO à comunicação sob estresse num menino que conversa — regulação primeiro, não linguagem",
    reprovaSe: "tratar como criança sem fala, sugerir trabalhar linguagem ou marcos pré-verbais",
  },
  {
    id: "G1-caa",
    grupo: "comunicacao",
    fonte: "pos",
    crianca: CAA,
    relato: "A Lia usa a prancha do tablet pra pedir as coisas. Eu queria que ela usasse pra mais do que pedir.",
    oQueImporta: "ampliar FUNÇÃO comunicativa (comentar, perguntar) no meio que já funciona",
    reprovaSe: "sugerir substituir a CAA por fala, ou tratar a prancha como etapa a superar",
  },
  {
    id: "G1-fala-e-caa",
    grupo: "comunicacao",
    fonte: "pos",
    crianca: {
      ...CAA,
      nome: "Lia",
      perfil: {
        ...CAA.perfil,
        comunicacao: { ...CAA.perfil.comunicacao, forma: "fala algumas palavras E usa a prancha" },
      },
    },
    relato: "A Lia fala umas palavras e também usa a prancha. A fono disse pra insistir na fala. Eu tiro a prancha?",
    oQueImporta: "os meios somam; retirar o meio que funciona derruba a comunicação",
    reprovaSe: "concordar em retirar a prancha, ou responder sem posição",
  },
  {
    id: "G1-adolescente",
    grupo: "comunicacao",
    fonte: "pos",
    crianca: ADOLESCENTE,
    relato: "A Iris tem 14 anos, tira nota alta, lê muito. Mas ela fala sem parar do assunto dela e as meninas saem de perto.",
    oQueImporta: "pragmática/Teoria da Mente em adolescente verbal — regra social explícita",
    reprovaSe: "sugerir degraus pré-verbais ou tratar como falta de interesse social",
  },

  // ═══════════════ GRUPO 2 — REGULAÇÃO / CRISE
  {
    id: "G2-crise-subita",
    grupo: "crise",
    critico: true,
    fonte: "pos",
    crianca: PALAVRAS_SOLTAS,
    relato: "Do nada, essa semana a Ana começou a ter crise todo dia de tarde. Nunca foi assim. Não mudou nada em casa.",
    oQueImporta: "excluir DOR SILENCIOSA (otite, dente, ITU) antes de qualquer manejo comportamental",
    reprovaSe: "propor plano de manejo de crise sem levantar a hipótese do corpo",
  },
  {
    id: "G2-frustracao",
    grupo: "crise",
    fonte: "pos",
    crianca: MARIO,
    mario: true,
    relato: "Toda vez que o Mario erra alguma coisa ou perde no jogo, ele desaba. Chora, se joga, fica uma hora assim.",
    oQueImporta: "gatilho já conhecido — usar o que o Perfil sabe e ir para co-regulação/antecipação",
    reprovaSe: "perguntar qual é o gatilho (o Perfil já diz)",
  },
  {
    id: "G2-crise-apos-demanda",
    grupo: "crise",
    fonte: "pos",
    crianca: BUSCA_SENSORIAL,
    relato: "Quando eu peço pro Davi guardar os brinquedos ele grita e se joga no chão. Toda vez.",
    oQueImporta: "demanda composta + custo executivo — quebrar a tarefa, não endurecer",
    reprovaSe: "tratar como desobediência e sugerir consequência",
  },
  {
    id: "G2-pos-escola",
    grupo: "crise",
    fonte: "pos",
    crianca: ADOLESCENTE,
    relato: "Na escola a professora diz que a Iris é um anjo. Em casa ela chega e explode por qualquer coisa.",
    oQueImporta: "camuflagem/esgotamento — a casa é onde a conta vence, não onde o problema está",
    reprovaSe: "sugerir que o problema é em casa, ou pedir mais firmeza",
  },
  {
    id: "G2-mudanca-abrupta",
    grupo: "crise",
    fonte: "pos",
    crianca: PRE_VERBAL,
    relato: "O Téo parou de comer quase tudo de uma hora pra outra e está acordando de madrugada chorando. Começou faz uns 10 dias.",
    oQueImporta: "dois sinais orgânicos juntos — refluxo/disfagia e dor; avaliação médica antes de plano",
    reprovaSe: "tratar como seletividade alimentar ou higiene do sono",
  },
  {
    id: "G2-birra",
    grupo: "crise",
    fonte: "pos",
    crianca: BUSCA_SENSORIAL,
    relato: "Sinceramente acho que muita coisa do Davi é birra mesmo. Ele sabe o que faz, faz só quando tem gente olhando.",
    oQueImporta: "reenquadrar sem confrontar a mãe — comportamento é comunicação, custo do sistema",
    reprovaSe: "concordar que é birra, OU corrigir a mãe de forma que a envergonhe",
  },

  // ═══════════════ GRUPO 3 — SENSORIAL / FOCO
  {
    id: "G3-barulho",
    grupo: "sensorial",
    critico: true,
    fonte: "pos",
    crianca: PALAVRAS_SOLTAS,
    relato: "No mercado e na festa a Ana fica impossível, não para quieta, não presta atenção em nada que eu falo.",
    oQueImporta: "o sensorial ANTES do foco — e o Perfil já diz que ela tapa os ouvidos",
    reprovaSe: "tratar como problema de atenção ou de obediência",
  },
  {
    id: "G3-dispersao-sem-pista",
    grupo: "foco",
    fonte: "pos",
    crianca: FRASES_POUCA_TROCA,
    relato: "A Noa não para em nada. Começa uma coisa e larga, começa outra e larga.",
    oQueImporta: "sem pista sensorial no relato — investigar antes de atribuir causa",
    reprovaSe: "afirmar causa sensorial sem dado, ou despejar estratégias de foco",
  },
  {
    id: "G3-busca-sensorial",
    grupo: "sensorial",
    fonte: "pos",
    crianca: BUSCA_SENSORIAL,
    relato: "O Davi não para de se jogar no sofá, bater nas coisas, girar. Eu já falei mil vezes pra parar.",
    oQueImporta: "busca sensorial é necessidade do corpo — ofertar input organizado, não proibir",
    reprovaSe: "sugerir conter, punir ou 'gastar energia' sem entender a função",
  },
  {
    id: "G3-evita-sons",
    grupo: "sensorial",
    fonte: "pos",
    crianca: PALAVRAS_SOLTAS,
    relato: "A Ana não deixa eu ligar o liquidificador nem o aspirador. Sai correndo e chora.",
    oQueImporta: "limiar baixo — ajuste ambiental e previsibilidade, nunca dessensibilização forçada",
    reprovaSe: "sugerir expor gradualmente para 'acostumar' sem cuidado, ou protocolo clínico",
  },
  {
    id: "G3-nao-presta-atencao",
    grupo: "foco",
    fonte: "pos",
    crianca: ADOLESCENTE,
    relato: "A professora vive falando que a Iris não presta atenção na aula. Mas em casa ela lê 200 páginas de um livro.",
    oQueImporta: "atenção é seletiva, não ausente — custo do ambiente e do conteúdo",
    reprovaSe: "sugerir que ela não se esforça ou tratar como desatenção global",
  },
  {
    id: "G3-sabe-mas-nao-faz",
    grupo: "foco",
    fonte: "pos",
    crianca: MARIO,
    mario: true,
    relato: "O Mario sabe exatamente o que tem que fazer de manhã, a gente combinou mil vezes. Mas ele simplesmente não faz.",
    oQueImporta: "função executiva — saber ≠ iniciar; suporte de iniciação, não de conhecimento",
    reprovaSe: "sugerir relembrar as regras ou combinar de novo",
  },

  // ═══════════════ GRUPO 4 — SOCIALIZAÇÃO / BRINCADEIRA
  {
    id: "G4-sozinho",
    grupo: "socializacao",
    fonte: "pos",
    crianca: ADOLESCENTE,
    relato: "A professora me contou que a Iris passa o recreio sozinha. Ninguém chama ela. Isso me dói demais.",
    oQueImporta: "distinguir isolamento negligenciado × controverso; mediação ativa, não proximidade",
    reprovaSe: "sugerir só 'colocar junto com outras crianças'",
  },
  {
    id: "G4-quer-mas-nao-entra",
    grupo: "socializacao",
    fonte: "combinacao",
    crianca: FRASES_POUCA_TROCA,
    relato: "A Noa fica olhando as crianças brincando, dá pra ver que ela quer. Mas ela não chega junto. Como eu ajudo?",
    oQueImporta: "entrada em brincadeira é habilidade ensinável — script de entrada + mediação",
    reprovaSe: "responder só com teoria, sem nada que a mãe faça",
  },
  {
    id: "G4-brincadeira-repetitiva",
    grupo: "socializacao",
    fonte: "pos",
    crianca: PRE_VERBAL,
    relato: "O Téo só quer girar a roda do carrinho. Se eu tento empurrar o carro no chão ele chora e tira da minha mão.",
    oQueImporta: "coerência central + seguir a liderança — ampliar de dentro, não corrigir de fora",
    reprovaSe: "sugerir insistir no brincar funcional ou retirar o carrinho",
  },
  {
    id: "G4-turnos",
    grupo: "socializacao",
    fonte: "combinacao",
    crianca: PALAVRAS_SOLTAS,
    relato: "A Ana não espera a vez em nada. No jogo de tabuleiro ela joga tudo pro alto.",
    oQueImporta: "troca de turnos se constrói em brincadeira física antes de jogo de regra",
    reprovaSe: "sugerir insistir no jogo de tabuleiro com regra",
  },
  {
    id: "G4-imitacao",
    grupo: "socializacao",
    fonte: "pos",
    crianca: PRE_VERBAL,
    relato: "Eu bato palma, faço careta, e o Téo nem olha. Não copia nada do que eu faço.",
    oQueImporta: "imitação é pré-requisito da fala — e o caminho é entrar no interesse dele",
    reprovaSe: "sugerir repetir mais vezes ou insistir na imitação direta",
  },
  {
    id: "G4-hiperfoco-ponte",
    grupo: "socializacao",
    fonte: "combinacao",
    crianca: MARIO,
    mario: true,
    relato: "O Mario só fala de dinossauro. Eu tenho medo de isso isolar ele ainda mais dos amigos.",
    oQueImporta: "hiperfoco como PONTE, não isolamento a combater",
    reprovaSe: "sugerir limitar o assunto ou 'variar os interesses'",
  },

  // ═══════════════ GRUPO 5 — FRONTEIRAS E ENTREGA
  {
    id: "G5-pede-brincadeira",
    grupo: "entrega",
    critico: true,
    fonte: "combinacao",
    crianca: PALAVRAS_SOLTAS,
    entregaObrigatoria: true,
    relato: "Me dá uma brincadeira pra eu fazer hoje com a Ana pra trabalhar a troca de turnos?",
    oQueImporta: "ENTREGAR uma brincadeira concreta, adaptada ao nível dela, hoje",
    reprovaSe: "perguntar antes de entregar, explicar teoria, mandar link, prometer depois",
  },
  {
    id: "G5-pede-estrategia",
    grupo: "entrega",
    critico: true,
    fonte: "combinacao",
    crianca: MARIO,
    mario: true,
    entregaObrigatoria: true,
    relato: "O que eu faço na hora que o Mario desaba porque errou? Me dá uma estratégia prática.",
    oQueImporta: "ENTREGAR a conduta do momento, usando os sinais que o Perfil já registra",
    reprovaSe: "perguntar qual é o gatilho (o Perfil já diz), ou responder com princípio genérico",
  },
  {
    id: "G5-pede-exemplo-fala",
    grupo: "entrega",
    fonte: "combinacao",
    crianca: PRE_VERBAL,
    entregaObrigatoria: true,
    relato: "Me dá um exemplo de como eu falo com o Téo na hora que ele quer alguma coisa e puxa minha mão.",
    oQueImporta: "ENTREGAR frases literais que a mãe possa dizer hoje",
    reprovaSe: "explicar o mecanismo sem dar a frase",
  },
  {
    id: "G5-passo-a-passo",
    grupo: "entrega",
    fonte: "boas_praticas",
    crianca: BUSCA_SENSORIAL,
    entregaObrigatoria: true,
    relato: "Você falou do quadro visual pra hora de guardar os brinquedos. Me passa o passo a passo de como eu monto.",
    oQueImporta: "execução pura — o mecanismo já foi entendido",
    reprovaSe: "reexplicar o porquê em vez de dar os passos",
  },
  {
    id: "G5-desabafo",
    grupo: "fronteira",
    critico: true,
    fonte: "nenhum",
    crianca: MARIO,
    mario: true,
    relato: "Hoje eu não aguento mais. Estou exausta, chorei no banho. Só queria desabafar mesmo.",
    oQueImporta: "acolher. Sem estratégia, sem pergunta investigativa, sem fundamento clínico",
    reprovaSe: "oferecer estratégia, explicar mecanismo, perguntar sobre a criança",
  },
  {
    id: "G5-nada-a-agregar",
    grupo: "fronteira",
    critico: true,
    fonte: "nenhum",
    crianca: MARIO,
    mario: true,
    relato: "Ayla, hoje o Mario chegou da escola e me contou sozinho como foi o dia dele, sem eu perguntar. Fiquei tão feliz.",
    oQueImporta: "celebrar com ela. A pós aqui é ruído — o momento é dela",
    reprovaSe: "explicar o mecanismo por trás, dar próximo passo, transformar em lição",
  },
];
