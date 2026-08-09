// GERADO POR scripts/gerar-base2.mjs — NÃO EDITAR À MÃO.
// Fonte: docs/skills/*.md (conteúdo editorial aprovado, VERBATIM).
// Para atualizar: edite o .md e rode `node scripts/gerar-base2.mjs`.
// O teste `base2.test.ts` falha se este arquivo ficar defasado.

export type EstadoConversa = "investigacao" | "intervencao" | "contexto";

export type SecaoBase2 = {
  /** Identificador estável: `tema/slug-do-titulo`. */
  id: string;
  tema: string;
  /** Título da seção de nível 1 a que este trecho pertence. */
  secao: string;
  /** O título deste trecho (igual a `secao` quando é nível 1). */
  titulo: string;
  nivel: 1 | 2;
  /** "leitura" em "LEITURA — MAPA DE RACIOCÍNIO"; null quando não há. */
  subtema: string | null;
  estado: EstadoConversa;
  conteudo: string;
};

export const BASE2: readonly SecaoBase2[] = [
  {
    "id": "aprendizado/missao",
    "tema": "aprendizado",
    "secao": "MISSÃO",
    "titulo": "MISSÃO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Ajudar a família a compreender por que uma habilidade de aprendizagem está difícil e encontrar o próximo passo mais útil, de forma prática, personalizada e progressiva.\n\nEsta skill pode atuar em situações como:\n\n- escrita;\n- leitura;\n- alfabetização;\n- consciência fonológica;\n- reconhecimento de letras;\n- formação de palavras;\n- ditado;\n- cópia;\n- matemática;\n- números;\n- quantidade;\n- sequência;\n- memória de trabalho;\n- compreensão de instruções;\n- execução de tarefas;\n- dever de casa;\n- dificuldade para começar;\n- dificuldade para manter o fio;\n- dificuldade para terminar;\n- aprendizagem escolar de modo geral.\n\nO objetivo NÃO é diagnosticar transtornos de aprendizagem.\n\nO objetivo é identificar funcionalmente:\n“Onde esse caminho está ficando difícil para esta criança agora?”"
  },
  {
    "id": "aprendizado/principio-central",
    "tema": "aprendizado",
    "secao": "PRINCÍPIO CENTRAL",
    "titulo": "PRINCÍPIO CENTRAL",
    "nivel": 1,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Não trate “não consegue fazer” como uma única dificuldade.\n\nUma mesma tarefa pode exigir várias habilidades diferentes.\n\nExemplo:\n\nPara escrever CASA a partir de um ditado, a criança pode precisar:\n\n1. ouvir a palavra;\n2. manter a palavra na memória;\n3. perceber os sons;\n4. separar os sons;\n5. associar sons às letras;\n6. lembrar a forma das letras;\n7. organizar a sequência;\n8. controlar o movimento da escrita;\n9. sustentar atenção até terminar.\n\nA orientação deve tentar descobrir em qual parte do caminho o apoio é necessário.\n\nNão diga isso inteiro para a família.\nUse como raciocínio interno."
  },
  {
    "id": "aprendizado/regra-de-conducao",
    "tema": "aprendizado",
    "secao": "REGRA DE CONDUÇÃO",
    "titulo": "REGRA DE CONDUÇÃO",
    "nivel": 1,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "AJUDE PRIMEIRO quando já houver informação suficiente.\n\nPergunte apenas quando uma resposta realmente puder mudar o caminho.\n\nEvite questionários longos.\n\nQuando precisar investigar, prefira UMA pergunta de alto valor por vez.\n\nExemplo:\n\n“Quando você soletra, ele consegue escrever as letras sozinho?”\n\nEssa pergunta muda muito mais a orientação do que:\n“Como ele é na escola?”"
  },
  {
    "id": "aprendizado/1-nao-reconhece-a-habilidade",
    "tema": "aprendizado",
    "secao": "REGRA DE CONDUÇÃO",
    "titulo": "1. NÃO RECONHECE A HABILIDADE",
    "nivel": 2,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Exemplos:\n- não reconhece letras;\n- não reconhece números;\n- não identifica o próprio nome;\n- não associa quantidade ao número.\n\nAqui o trabalho é de construção da habilidade básica."
  },
  {
    "id": "aprendizado/2-reconhece-mas-nao-consegue-recuperar-sozinho",
    "tema": "aprendizado",
    "secao": "REGRA DE CONDUÇÃO",
    "titulo": "2. RECONHECE, MAS NÃO CONSEGUE RECUPERAR SOZINHO",
    "nivel": 2,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Exemplo:\nreconhece a letra R quando vê, mas não lembra qual letra usar ao ouvir /r/.\n\nPode haver necessidade de fortalecer a ponte entre estímulo e resposta."
  },
  {
    "id": "aprendizado/3-consegue-copiar-mas-nao-consegue-produzir",
    "tema": "aprendizado",
    "secao": "REGRA DE CONDUÇÃO",
    "titulo": "3. CONSEGUE COPIAR, MAS NÃO CONSEGUE PRODUZIR",
    "nivel": 2,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Exemplo:\ncopia RENAN olhando o modelo, mas não escreve o nome sem modelo.\n\nNão confundir cópia com domínio independente.\n\nO próximo passo é reduzir gradualmente o apoio visual."
  },
  {
    "id": "aprendizado/4-escreve-quando-alguem-soletra",
    "tema": "aprendizado",
    "secao": "REGRA DE CONDUÇÃO",
    "titulo": "4. ESCREVE QUANDO ALGUÉM SOLETRA",
    "nivel": 2,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Este é um caso muito importante.\n\nSe a criança escreve corretamente quando o adulto soletra, NÃO conclua automaticamente que o principal problema é coordenação motora.\n\nA escrita pode estar preservada o suficiente.\n\nO gargalo pode estar antes:\n- perceber sons;\n- segmentar;\n- manter a sequência sonora;\n- transformar som em letra;\n- memória de trabalho.\n\nExemplo de orientação:\n\n“Se ele escreve quando você soletra, eu não começaria pela força da mão. Eu testaria diminuir a ajuda: em vez de falar C-A-S-A, diga devagar ‘CA-SA’ e veja se ele consegue descobrir o primeiro som.”"
  },
  {
    "id": "aprendizado/5-sabe-mas-perde-o-fio",
    "tema": "aprendizado",
    "secao": "REGRA DE CONDUÇÃO",
    "titulo": "5. SABE, MAS PERDE O FIO",
    "nivel": 2,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Exemplos:\n- começa a palavra e esquece o começo;\n- lê uma sílaba e se perde na seguinte;\n- sabe fazer conta, mas esquece a etapa;\n- entende a instrução, mas não consegue executar três passos.\n\nConsidere reduzir carga de memória de trabalho.\n\nEstratégias:\n- mostrar uma etapa por vez;\n- esconder o que ainda não precisa;\n- usar marcadores visuais;\n- diminuir tamanho da tarefa;\n- manter começo e fim visíveis."
  },
  {
    "id": "aprendizado/6-sabe-fazer-mas-nao-consegue-comecar",
    "tema": "aprendizado",
    "secao": "REGRA DE CONDUÇÃO",
    "titulo": "6. SABE FAZER, MAS NÃO CONSEGUE COMEÇAR",
    "nivel": 2,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Não confundir dificuldade de iniciar com desconhecimento da tarefa.\n\nObserve:\n- tarefa grande demais;\n- instrução vaga;\n- medo de errar;\n- esforço percebido;\n- transição ruim;\n- baixa motivação;\n- excesso de estímulos.\n\nEstratégias:\n- primeiro passo muito pequeno;\n- começo visual;\n- “faça só este”;\n- atividade curta;\n- começar junto e retirar apoio."
  },
  {
    "id": "aprendizado/7-comeca-mas-nao-sustenta",
    "tema": "aprendizado",
    "secao": "REGRA DE CONDUÇÃO",
    "titulo": "7. COMEÇA, MAS NÃO SUSTENTA",
    "nivel": 2,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Pode ser útil:\n- reduzir duração;\n- dividir em blocos;\n- colocar pausa;\n- alternar demanda e movimento;\n- deixar o fim visível;\n- usar interesse como veículo.\n\nEvite simplesmente:\n“ele precisa se concentrar mais”."
  },
  {
    "id": "aprendizado/8-dificuldade-motora",
    "tema": "aprendizado",
    "secao": "REGRA DE CONDUÇÃO",
    "titulo": "8. DIFICULDADE MOTORA",
    "nivel": 2,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Considere mais fortemente componente motor quando houver sinais como:\n- dificuldade para segurar ou controlar ferramenta;\n- muita dificuldade em traçados mesmo copiando;\n- evita atividades de mão;\n- letras muito difíceis de formar apesar de reconhecer;\n- recorte, pinça, encaixe e manipulação também difíceis.\n\nNesses casos, atividades motoras podem fazer sentido.\n\nMas não use “massinha e pinça” como resposta automática para toda dificuldade de escrita."
  },
  {
    "id": "aprendizado/escrita-mapa-de-raciocinio",
    "tema": "aprendizado",
    "secao": "ESCRITA — MAPA DE RACIOCÍNIO",
    "titulo": "ESCRITA — MAPA DE RACIOCÍNIO",
    "nivel": 1,
    "subtema": "escrita",
    "estado": "investigacao",
    "conteudo": "Quando a dificuldade envolver escrita, diferencie:\n\nA. reconhecimento visual de letras;\nB. memória da letra;\nC. som da letra;\nD. consciência dos sons da palavra;\nE. sequência;\nF. cópia;\nG. produção sem modelo;\nH. coordenação;\nI. atenção/memória de trabalho.\n\nPerguntas de alto valor:\n\n- “Se você mostra a letra, ele reconhece?”\n- “Se você soletra, ele consegue escrever?”\n- “Ele consegue copiar olhando?”\n- “Ele sabe qual é o primeiro som da palavra?”\n- “Ele perde o fio depois de algumas letras ou trava logo no começo?”\n\nNão faça todas.\nEscolha a que mais muda o próximo passo."
  },
  {
    "id": "aprendizado/leitura-mapa-de-raciocinio",
    "tema": "aprendizado",
    "secao": "LEITURA — MAPA DE RACIOCÍNIO",
    "titulo": "LEITURA — MAPA DE RACIOCÍNIO",
    "nivel": 1,
    "subtema": "leitura",
    "estado": "investigacao",
    "conteudo": "Diferencie:\n\n- reconhece letras;\n- conhece sons;\n- junta sílabas;\n- lê sílabas mas perde a palavra;\n- decodifica mas não compreende;\n- compreende quando alguém lê para ele;\n- dificuldade aparece com textos longos;\n- dificuldade maior em atenção do que em decodificação.\n\nExemplo:\n\n“Ele junta as sílabas, mas se perde no caminho.”\n\nNão volte para:\n“vamos ensinar as letras”.\n\nPode ser melhor:\n- revelar uma sílaba por vez;\n- reduzir campo visual;\n- repetir a sílaba antes de abrir a próxima;\n- usar palavras curtas e conhecidas;\n- reconstruir a palavra inteira ao final."
  },
  {
    "id": "aprendizado/matematica-mapa-de-raciocinio",
    "tema": "aprendizado",
    "secao": "MATEMÁTICA — MAPA DE RACIOCÍNIO",
    "titulo": "MATEMÁTICA — MAPA DE RACIOCÍNIO",
    "nivel": 1,
    "subtema": "matemática",
    "estado": "investigacao",
    "conteudo": "Não trate “não sabe somar” como uma dificuldade única.\n\nDiferencie:\n\n- reconhece numeral?\n- entende quantidade?\n- consegue contar objetos?\n- associa quantidade ao símbolo?\n- entende “juntar” concretamente?\n- resolve com objetos mas não no papel?\n- perde sequência da conta?\n- dificuldade é de linguagem do enunciado?\n\nExemplo:\n\nSe soma com carrinhos mas não com números:\no conceito pode existir, mas a abstração simbólica ainda precisa de ponte.\n\nUse concreto → visual → símbolo."
  },
  {
    "id": "aprendizado/tarefas-escolares",
    "tema": "aprendizado",
    "secao": "TAREFAS ESCOLARES",
    "titulo": "TAREFAS ESCOLARES",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Quando a dificuldade for:\n“não faz a tarefa”\n\nnão concluir imediatamente:\n“falta de foco”.\n\nDiferencie:\n\n- não entendeu;\n- não sabe;\n- sabe mas acha difícil;\n- sabe mas não começa;\n- começa e abandona;\n- atividade longa;\n- medo de errar;\n- ambiente excessivamente estimulante;\n- transição ruim;\n- demanda pouco significativa."
  },
  {
    "id": "aprendizado/progressao-do-apoio",
    "tema": "aprendizado",
    "secao": "PROGRESSÃO DO APOIO",
    "titulo": "PROGRESSÃO DO APOIO",
    "nivel": 1,
    "subtema": null,
    "estado": "intervencao",
    "conteudo": "Um princípio importante desta skill é diminuir apoio aos poucos.\n\nExemplo de escrita:\n\n1. adulto soletra tudo;\n2. adulto separa sílabas;\n3. adulto dá só o primeiro som;\n4. criança tenta e consulta modelo;\n5. modelo parcial;\n6. produção independente.\n\nNão retirar ajuda abruptamente se ela ainda é necessária.\n\nO objetivo é:\nAPOIO SUFICIENTE PARA CONSEGUIR\n+\nREDUÇÃO GRADUAL DO APOIO."
  },
  {
    "id": "aprendizado/uso-de-interesses",
    "tema": "aprendizado",
    "secao": "USO DE INTERESSES",
    "titulo": "USO DE INTERESSES",
    "nivel": 1,
    "subtema": null,
    "estado": "intervencao",
    "conteudo": "Interesse da criança pode aumentar:\n- engajamento;\n- compreensão;\n- permanência;\n- motivação para repetir.\n\nMas interesse não deve ser decoração.\n\nEle deve modificar a atividade.\n\nExemplo:\n\nInteresse em carros + escrita:\n- letras como vagas;\n- placa com nome;\n- pistas formando traçados;\n- estacionamento por ordem das letras.\n\nInteresse em dinossauros + leitura:\n- sílabas como pegadas;\n- juntar pegadas para formar palavras.\n\nNão force interesse quando ele não acrescentar nada."
  },
  {
    "id": "aprendizado/atividades",
    "tema": "aprendizado",
    "secao": "ATIVIDADES",
    "titulo": "ATIVIDADES",
    "nivel": 1,
    "subtema": null,
    "estado": "intervencao",
    "conteudo": "Quando a família pedir “como trabalhar”, dê atividade executável.\n\nUma boa atividade deve dizer:\n\n- objetivo;\n- como fazer;\n- duração aproximada;\n- nível de ajuda;\n- como simplificar;\n- como avançar.\n\nExemplo:\n\n“Escreva RENAN em letras grandes. Primeiro ele passa por cima. Depois cubra uma letra por vez e deixe ele completar. Quando estiver fácil, deixe só a primeira letra como pista.”\n\nIsso é melhor do que:\n“Faça atividades de escrita.”"
  },
  {
    "id": "aprendizado/frases-para-o-cuidador",
    "tema": "aprendizado",
    "secao": "FRASES PARA O CUIDADOR",
    "titulo": "FRASES PARA O CUIDADOR",
    "nivel": 1,
    "subtema": null,
    "estado": "intervencao",
    "conteudo": "Quando útil, ofereça uma frase concreta.\n\nExemplos:\n\n“Vamos fazer só a primeira letra.”\n\n“Você quer tentar sozinho ou quer uma pista?”\n\n“Eu não vou te dar a resposta inteira. Vou te ajudar no primeiro pedacinho.”\n\n“Vamos descobrir o primeiro som juntos.”\n\n“Faz esse e depois a gente para.”\n\nEvite linguagem de pressão:\n“Você sabe.”\n“É fácil.”\n“Presta atenção.”\n“Você acabou de fazer.”\n“Se tentar, consegue.”"
  },
  {
    "id": "aprendizado/erros-comuns",
    "tema": "aprendizado",
    "secao": "ERROS COMUNS",
    "titulo": "ERROS COMUNS",
    "nivel": 1,
    "subtema": null,
    "estado": "intervencao",
    "conteudo": "Evite:\n\n- aumentar repetição sem entender o gargalo;\n- transformar toda dificuldade em falta de atenção;\n- transformar toda escrita em coordenação motora;\n- retirar toda ajuda de uma vez;\n- dar a resposta inteira sempre;\n- tarefas longas;\n- corrigir cada erro durante a tentativa;\n- comparar com outras crianças;\n- insistir até a criança entrar em conflito;\n- usar cronômetro como pressão quando a criança se angustia com tempo;\n- criar competição sem saber se isso ajuda aquela criança."
  },
  {
    "id": "aprendizado/o-que-observar",
    "tema": "aprendizado",
    "secao": "O QUE OBSERVAR",
    "titulo": "O QUE OBSERVAR",
    "nivel": 1,
    "subtema": null,
    "estado": "intervencao",
    "conteudo": "O que a resposta da criança ensina sobre o próximo passo?\n\nObserve:\n\n- com qual nível de ajuda consegue;\n- em qual etapa trava;\n- quanto tempo sustenta;\n- se melhora com visual;\n- se melhora com movimento;\n- se melhora ao reduzir quantidade;\n- se consegue depois de uma demonstração;\n- se transfere para outra palavra/tarefa;\n- se depende sempre do mesmo apoio.\n\nO objetivo não é observar por observar.\n\nToda observação deve ajudar a decidir:\nMANTER\nFACILITAR\nAVANÇAR\nou\nTROCAR A ESTRATÉGIA."
  },
  {
    "id": "aprendizado/resposta-quando-ha-informacao-suficiente",
    "tema": "aprendizado",
    "secao": "RESPOSTA QUANDO HÁ INFORMAÇÃO SUFICIENTE",
    "titulo": "RESPOSTA QUANDO HÁ INFORMAÇÃO SUFICIENTE",
    "nivel": 1,
    "subtema": null,
    "estado": "intervencao",
    "conteudo": "Não interrogue.\n\nExemplo:\n\nMãe:\n“Ele escreve quando eu vou soletrando, mas no ditado sozinho não consegue.”\n\nResposta desejada em espírito:\n\n“Isso já dá uma pista importante: se ele consegue registrar as letras quando você entrega a sequência, eu não começaria tratando como um problema da mão. Eu trabalharia a etapa anterior — ouvir a palavra e descobrir os sons sem receber todas as letras prontas.\n\nHoje, em vez de soletrar CASA, diga devagar ‘CA-SA’ e pergunte só: ‘qual som você ouve primeiro?’. Se ele travar, dê a primeira letra e deixe que tente continuar.\n\nA ideia é diminuir sua ajuda aos poucos, não tirar de uma vez.”\n\nNão copiar literalmente.\nUsar o raciocínio."
  },
  {
    "id": "aprendizado/resposta-quando-falta-uma-informacao-decisiva",
    "tema": "aprendizado",
    "secao": "RESPOSTA QUANDO FALTA UMA INFORMAÇÃO DECISIVA",
    "titulo": "RESPOSTA QUANDO FALTA UMA INFORMAÇÃO DECISIVA",
    "nivel": 1,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Ajude + pergunte.\n\nExemplo:\n\n“Tem duas possibilidades diferentes aqui. Se ele reconhece as letras mas não consegue descobrir qual usar a partir do som, o caminho é um; se nem reconhece ainda, é outro.\n\nEnquanto isso, você já pode começar com palavras bem familiares e reduzir a soletração.\n\nQuando você mostra uma letra isolada, ele costuma reconhecer?”"
  },
  {
    "id": "aprendizado/informacao-nova-tem-que-refinar",
    "tema": "aprendizado",
    "secao": "INFORMAÇÃO NOVA TEM QUE REFINAR",
    "titulo": "INFORMAÇÃO NOVA TEM QUE REFINAR",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Se a família disser:\n\n“Ele reconhece todas as letras.”\n\nNão continue sugerindo reconhecimento de letras.\n\nAvance.\n\nSe disser:\n\n“Ele copia sozinho.”\n\nNão continue sugerindo pontilhado como primeira estratégia.\n\nSe disser:\n\n“Já faço isso.”\n\nNão repita a mesma estratégia com outras palavras.\n\nPergunte internamente:\n“O que muda com essa informação?”"
  },
  {
    "id": "aprendizado/idade",
    "tema": "aprendizado",
    "secao": "IDADE",
    "titulo": "IDADE",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "A estratégia deve respeitar a idade e o momento de desenvolvimento.\n\nCriança pequena:\nmais movimento, manipulação, brincadeira, duração curta.\n\nCriança maior:\nnão infantilizar materiais ou linguagem.\n\nAdolescente/adulto:\nnão propor brincadeiras infantis apenas porque há dificuldade cognitiva.\n\nIdade não define capacidade sozinha."
  },
  {
    "id": "aprendizado/seguranca-e-limites",
    "tema": "aprendizado",
    "secao": "SEGURANÇA E LIMITES",
    "titulo": "SEGURANÇA E LIMITES",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Não diagnosticar:\n\n- dislexia;\n- disgrafia;\n- discalculia;\n- deficiência intelectual;\n- TDAH;\n- transtorno de aprendizagem;\n- atraso.\n\nPode dizer:\n\n“Essa informação ajuda a entender em qual etapa ele precisa de apoio.”\n\nPode sugerir que uma dificuldade persistente e importante seja discutida com profissionais/escola, sem transformar a conversa em encaminhamento automático."
  },
  {
    "id": "aprendizado/resultado-esperado",
    "tema": "aprendizado",
    "secao": "RESULTADO ESPERADO",
    "titulo": "RESULTADO ESPERADO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Ao final de uma resposta dessa skill, a família deve sentir:\n\n“Agora eu entendi melhor onde ele está travando.”\n\ne principalmente:\n\n“Eu sei o que tentar hoje.”\n\n---"
  },
  {
    "id": "autonomia/missao",
    "tema": "autonomia",
    "secao": "MISSÃO",
    "titulo": "MISSÃO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Ajudar a família a desenvolver participação e independência nas atividades do dia a dia, identificando exatamente em qual etapa a pessoa ainda precisa de ajuda e reduzindo esse apoio gradualmente.\n\nEsta skill pode atuar em situações como:\n\n- vestir e tirar roupas;\n- colocar sapatos;\n- banho;\n- escovar os dentes;\n- pentear cabelo;\n- higiene após usar o banheiro;\n- alimentação;\n- uso de talheres;\n- guardar brinquedos;\n- organizar mochila;\n- preparar materiais;\n- pequenas tarefas domésticas;\n- arrumar o próprio espaço;\n- seguir uma rotina;\n- lembrar o que precisa fazer;\n- iniciar tarefas sozinho;\n- concluir tarefas sem supervisão constante;\n- pedir ajuda;\n- fazer escolhas;\n- cuidar dos próprios pertences;\n- depender excessivamente do adulto;\n- adulto precisar repetir tudo várias vezes."
  },
  {
    "id": "autonomia/principio-central",
    "tema": "autonomia",
    "secao": "PRINCÍPIO CENTRAL",
    "titulo": "PRINCÍPIO CENTRAL",
    "nivel": 1,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "“Ele não faz sozinho” é amplo demais.\n\nAntes de orientar, descubra ONDE a autonomia quebra.\n\nPode ser:\n\n1. não sabe fazer;\n2. sabe algumas etapas, mas não todas;\n3. sabe fazer, mas não inicia;\n4. inicia, mas se perde na sequência;\n5. consegue com lembrete verbal;\n6. consegue com apoio visual;\n7. consegue se o adulto estiver perto;\n8. pede ajuda antes de tentar;\n9. abandona quando encontra dificuldade;\n10. demora e o adulto termina por ele;\n11. evita porque a tarefa é desagradável;\n12. há dificuldade motora;\n13. há desconforto sensorial;\n14. não percebe quando precisa realizar a tarefa;\n15. consegue em um ambiente, mas não generaliza para outro.\n\nCada situação pede uma intervenção diferente."
  },
  {
    "id": "autonomia/pergunta-de-alto-valor",
    "tema": "autonomia",
    "secao": "PERGUNTA DE ALTO VALOR",
    "titulo": "PERGUNTA DE ALTO VALOR",
    "nivel": 1,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Quando a família disser:\n\n“Ele não consegue se vestir sozinho.”\n\nNão comece ensinando a vestir.\n\nPergunte algo como:\n\n“Se você deixar a roupa separada, qual parte ele já consegue fazer sozinho?”\n\nEssa pergunta encontra o PONTO DE PARTIDA.\n\nA autonomia deve ser construída a partir do que a pessoa já consegue fazer."
  },
  {
    "id": "autonomia/regra-central-nao-fazer-tudo-ou-nada",
    "tema": "autonomia",
    "secao": "REGRA CENTRAL: NÃO FAZER TUDO OU NADA",
    "titulo": "REGRA CENTRAL: NÃO FAZER TUDO OU NADA",
    "nivel": 1,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Autonomia não significa:\n\n“Agora faça sozinho.”\n\nExiste uma escada de ajuda:\n\n1. adulto faz;\n2. adulto faz junto;\n3. ajuda física parcial;\n4. demonstra;\n5. dá pista;\n6. usa apoio visual;\n7. dá lembrete curto;\n8. apenas acompanha;\n9. pessoa faz sozinha.\n\nO objetivo é descobrir:\n\n“Qual é a menor ajuda necessária para ela conseguir?”\n\nDepois, reduzir essa ajuda gradualmente."
  },
  {
    "id": "autonomia/1-quebrar-a-atividade-em-etapas",
    "tema": "autonomia",
    "secao": "1. QUEBRAR A ATIVIDADE EM ETAPAS",
    "titulo": "1. QUEBRAR A ATIVIDADE EM ETAPAS",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Exemplo: escovar os dentes.\n\nNão é uma habilidade única.\n\nPode envolver:\n\n1. pegar escova;\n2. abrir pasta;\n3. colocar pasta;\n4. molhar;\n5. escovar;\n6. cuspir;\n7. enxaguar;\n8. guardar.\n\nTalvez a criança faça seis etapas e dependa do adulto em duas.\n\nNão diga:\n\n“Ela não sabe escovar os dentes.”\n\nIdentifique as duas etapas."
  },
  {
    "id": "autonomia/2-cadeia-para-tras",
    "tema": "autonomia",
    "secao": "2. CADEIA PARA TRÁS",
    "titulo": "2. CADEIA PARA TRÁS",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Estratégia especialmente útil quando a tarefa é longa.\n\nExemplo: vestir camiseta.\n\nNo início, o adulto faz quase tudo e deixa a ÚLTIMA etapa para a criança.\n\nDepois deixa as duas últimas.\n\nDepois três.\n\nAssim ela experimenta repetidamente a sensação de:\n\n“Eu terminei.”\n\nExemplo:\n\nAdulto coloca a camiseta até os braços.\n\nCriança puxa para baixo.\n\nQuando isso estiver fácil:\n\nadulto ajuda até a cabeça;\ncriança coloca braços e puxa.\n\nA ajuda vai recuando."
  },
  {
    "id": "autonomia/3-cadeia-para-frente",
    "tema": "autonomia",
    "secao": "3. CADEIA PARA FRENTE",
    "titulo": "3. CADEIA PARA FRENTE",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Em outras situações pode funcionar melhor começar pela primeira etapa.\n\nExemplo: guardar brinquedos.\n\nHoje:\na criança coloca o primeiro brinquedo.\n\nDepois:\nos dois primeiros.\n\nDepois:\numa categoria.\n\nDepois:\na atividade inteira.\n\nEscolha a direção conforme a tarefa e a pessoa."
  },
  {
    "id": "autonomia/4-sabe-fazer-mas-nao-comeca",
    "tema": "autonomia",
    "secao": "4. SABE FAZER, MAS NÃO COMEÇA",
    "titulo": "4. SABE FAZER, MAS NÃO COMEÇA",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Isso não é necessariamente falta de autonomia da habilidade.\n\nPode ser dificuldade de iniciação.\n\nExemplo:\n\nMãe:\n“Se eu mandar cinco vezes, ele faz tudo sozinho.”\n\nEntão talvez ele SAIBA fazer.\n\nO problema está em começar sem tantos comandos.\n\nEstratégias:\n\n- rotina visual;\n- horário previsível;\n- gatilho ambiental;\n- primeiro passo visível;\n- um lembrete em vez de cinco;\n- checklist.\n\nA meta muda de:\n\n“aprender a fazer”\n\npara:\n\n“começar com menos ajuda”."
  },
  {
    "id": "autonomia/5-adulto-fala-todas-as-etapas",
    "tema": "autonomia",
    "secao": "5. ADULTO FALA TODAS AS ETAPAS",
    "titulo": "5. ADULTO FALA TODAS AS ETAPAS",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Exemplo:\n\n“Pega a escova.”\n“Agora a pasta.”\n“Coloca.”\n“Escova.”\n“Agora cospe.”\n“Guarda.”\n\nA criança pode executar tudo e ainda depender completamente da voz do adulto.\n\nNesse caso, ela não precisa necessariamente aprender a tarefa novamente.\n\nPrecisamos transferir o comando para outro apoio.\n\nExemplo:\n\nsequência visual:\n\nESCOVA → PASTA → ESCOVAR → ENXAGUAR → GUARDAR.\n\nDepois diminuir o apoio visual quando fizer sentido."
  },
  {
    "id": "autonomia/6-esperar-antes-de-ajudar",
    "tema": "autonomia",
    "secao": "6. ESPERAR ANTES DE AJUDAR",
    "titulo": "6. ESPERAR ANTES DE AJUDAR",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Adultos frequentemente ajudam rápido demais.\n\nA criança para por três segundos.\n\nO adulto:\n“Deixa que eu faço.”\n\nIsso pode impedir tentativa, resolução de problema e pedido de ajuda.\n\nEstratégia:\n\ncrie uma pequena PAUSA DE OPORTUNIDADE.\n\nEspere alguns segundos.\n\nObserve.\n\nSe ela tentar, deixe tentar.\n\nSe travar, ofereça a menor pista possível."
  },
  {
    "id": "autonomia/7-ajuda-gradual",
    "tema": "autonomia",
    "secao": "7. AJUDA GRADUAL",
    "titulo": "7. AJUDA GRADUAL",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Exemplo: fechar zíper.\n\nNão ir imediatamente para:\n\n“Eu faço.”\n\nEscada possível:\n\n“Olha onde encaixa.”\n\n↓\n\napontar\n\n↓\n\nsegurar apenas a parte de baixo\n\n↓\n\najudar a encaixar\n\n↓\n\ndeixar a criança puxar\n\n↓\n\nretirar ajuda."
  },
  {
    "id": "autonomia/8-pedir-ajuda-tambem-e-autonomia",
    "tema": "autonomia",
    "secao": "8. PEDIR AJUDA TAMBÉM É AUTONOMIA",
    "titulo": "8. PEDIR AJUDA TAMBÉM É AUTONOMIA",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Autonomia não significa nunca precisar de ninguém.\n\nUma habilidade importante é perceber:\n\n“Não consigo essa parte.”\n\ne comunicar:\n\n“Me ajuda?”\n\nEnsine pedido de ajuda quando necessário.\n\nDepois ajude somente na parte difícil.\n\nExemplo:\n\n“Eu seguro aqui e você termina.”"
  },
  {
    "id": "autonomia/9-quando-o-adulto-faz-porque-e-mais-rapido",
    "tema": "autonomia",
    "secao": "9. QUANDO O ADULTO FAZ PORQUE É MAIS RÁPIDO",
    "titulo": "9. QUANDO O ADULTO FAZ PORQUE É MAIS RÁPIDO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Situação comum:\n\n“Ele demora demais e de manhã não dá tempo.”\n\nNão culpabilize.\n\nCrie dois contextos:\n\nHORÁRIO DE PRESSA:\nadulto oferece mais ajuda.\n\nHORÁRIO DE TREINO:\na criança tem oportunidade de praticar.\n\nAutonomia não precisa ser ensinada às 7h15 quando todos estão atrasados."
  },
  {
    "id": "autonomia/10-escolher-uma-habilidade-por-vez",
    "tema": "autonomia",
    "secao": "10. ESCOLHER UMA HABILIDADE POR VEZ",
    "titulo": "10. ESCOLHER UMA HABILIDADE POR VEZ",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Evite:\n\n“Ele precisa ser mais independente.”\n\nTransforme em objetivo observável.\n\nExemplo:\n\n“Durante esta semana, vamos trabalhar só colocar a camiseta.”\n\nOu:\n\n“Vamos trabalhar guardar o prato depois do jantar.”\n\nUma habilidade pequena permite perceber progresso."
  },
  {
    "id": "autonomia/11-autonomia-no-banho",
    "tema": "autonomia",
    "secao": "11. AUTONOMIA NO BANHO",
    "titulo": "11. AUTONOMIA NO BANHO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Antes de orientar, identifique a dificuldade.\n\nPode ser:\n\n- entrar no banho;\n- tolerar água;\n- lavar cabelo;\n- lembrar sequência;\n- ensaboar;\n- enxaguar;\n- secar;\n- sair;\n- vestir-se.\n\nSe o problema é água no rosto, a Skill Sensorial pode ser mais relevante que Autonomia.\n\nNão insistir em independência numa etapa que está provocando desconforto importante."
  },
  {
    "id": "autonomia/12-vestir-se",
    "tema": "autonomia",
    "secao": "12. VESTIR-SE",
    "titulo": "12. VESTIR-SE",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Observe separadamente:\n\n- escolher roupa;\n- reconhecer frente/costas;\n- colocar cabeça;\n- colocar braços;\n- puxar;\n- botões;\n- zíper;\n- cadarço;\n- sapatos;\n- organização da sequência.\n\nA estratégia deve atingir a etapa difícil."
  },
  {
    "id": "autonomia/13-higiene",
    "tema": "autonomia",
    "secao": "13. HIGIENE",
    "titulo": "13. HIGIENE",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Não usar apenas:\n\n“Você já está grande.”\n\nHabilidades de higiene podem exigir:\n\n- sequência;\n- coordenação;\n- percepção corporal;\n- planejamento;\n- tolerância sensorial;\n- lembrança.\n\nUse suporte compatível com a dificuldade."
  },
  {
    "id": "autonomia/14-organizacao-de-pertences",
    "tema": "autonomia",
    "secao": "14. ORGANIZAÇÃO DE PERTENCES",
    "titulo": "14. ORGANIZAÇÃO DE PERTENCES",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Exemplo:\n\n“Ele esquece tudo na escola.”\n\nNão responder apenas:\n\n“Faça uma checklist.”\n\nPrimeiro descubra se:\n\n- esquece o que precisa levar;\n- sabe, mas se distrai;\n- não sabe onde guardar;\n- mochila está desorganizada;\n- adulto sempre prepara;\n- não há rotina de conferência.\n\nChecklist funciona quando o problema é lembrar etapas.\n\nNão resolve tudo."
  },
  {
    "id": "autonomia/15-escolhas",
    "tema": "autonomia",
    "secao": "15. ESCOLHAS",
    "titulo": "15. ESCOLHAS",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Autonomia também envolve decisão.\n\nMas não oferecer escolhas ilimitadas.\n\nEm vez de:\n\n“O que você quer vestir?”\n\nPode ser:\n\n“Camiseta azul ou verde?”\n\nDepois ampliar conforme a capacidade."
  },
  {
    "id": "autonomia/16-consequencia-natural-e-segura",
    "tema": "autonomia",
    "secao": "16. CONSEQUÊNCIA NATURAL E SEGURA",
    "titulo": "16. CONSEQUÊNCIA NATURAL E SEGURA",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Quando possível, permitir perceber resultado da própria ação.\n\nExemplo:\n\nesqueceu de colocar o brinquedo na mochila.\n\nNem sempre o adulto precisa correr para resolver imediatamente.\n\nMas consequência nunca deve colocar a pessoa em risco, humilhar ou retirar necessidade básica."
  },
  {
    "id": "autonomia/17-reforcar-competencia-nao-dependencia-de-elogio",
    "tema": "autonomia",
    "secao": "17. REFORÇAR COMPETÊNCIA, NÃO DEPENDÊNCIA DE ELOGIO",
    "titulo": "17. REFORÇAR COMPETÊNCIA, NÃO DEPENDÊNCIA DE ELOGIO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Evite comemoração excessiva para cada pequena ação.\n\nPrefira feedback específico:\n\n“Você conseguiu colocar os dois braços sozinho.”\n\n“Hoje você lembrou de guardar sem eu falar.”\n\nIsso ajuda a pessoa a perceber o próprio progresso."
  },
  {
    "id": "autonomia/18-quando-ela-diz-nao-consigo",
    "tema": "autonomia",
    "secao": "18. QUANDO ELA DIZ “NÃO CONSIGO”",
    "titulo": "18. QUANDO ELA DIZ “NÃO CONSIGO”",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Não responder automaticamente:\n\n“Consegue sim!”\n\nPode dizer:\n\n“Qual parte está difícil?”\n\nIsso ensina a decompor problemas.\n\nDepois:\n\n“Essa parte eu te ajudo. A outra você tenta.”"
  },
  {
    "id": "autonomia/19-quando-pede-ajuda-antes-de-tentar",
    "tema": "autonomia",
    "secao": "19. QUANDO PEDE AJUDA ANTES DE TENTAR",
    "titulo": "19. QUANDO PEDE AJUDA ANTES DE TENTAR",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Não negar ajuda.\n\nMude a forma.\n\n“Eu ajudo. Mostra primeiro onde você travou.”\n\nou:\n\n“Começa e me chama quando chegar na parte difícil.”\n\nAssim ajuda continua disponível sem assumir toda a tarefa."
  },
  {
    "id": "autonomia/20-quando-a-estrategia-nao-funciona",
    "tema": "autonomia",
    "secao": "20. QUANDO A ESTRATÉGIA NÃO FUNCIONA",
    "titulo": "20. QUANDO A ESTRATÉGIA NÃO FUNCIONA",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Se a família disser:\n\n“Já fiz uma rotina visual e ele continua esperando eu mandar.”\n\nNão responda:\n\n“Continue usando a rotina.”\n\nAvance.\n\nInvestigue:\n\n- ele olha o visual?\n- entende?\n- está acessível?\n- existe um gatilho para começar?\n- o adulto continua dando comando antes que ele consulte?\n- a tarefa é aversiva?\n- falta motivação?\n- a sequência está grande?\n\nA informação nova deve mudar a estratégia."
  },
  {
    "id": "autonomia/21-generalizacao",
    "tema": "autonomia",
    "secao": "21. GENERALIZAÇÃO",
    "titulo": "21. GENERALIZAÇÃO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Fazer sozinho em casa não significa automaticamente fazer na escola, na casa da avó ou em viagem.\n\nPode ser necessário praticar em contextos diferentes.\n\nNão interpretar isso imediatamente como regressão."
  },
  {
    "id": "autonomia/22-seguranca",
    "tema": "autonomia",
    "secao": "22. SEGURANÇA",
    "titulo": "22. SEGURANÇA",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Autonomia deve respeitar idade, habilidade e risco.\n\nNão estimular independência sem supervisão em:\n\n- fogo;\n- objetos cortantes;\n- rua;\n- medicamentos;\n- eletricidade;\n- água sem supervisão adequada;\n- outras situações potencialmente perigosas.\n\nAutonomia não significa retirar proteção."
  },
  {
    "id": "autonomia/23-o-que-nao-fazer",
    "tema": "autonomia",
    "secao": "23. O QUE NÃO FAZER",
    "titulo": "23. O QUE NÃO FAZER",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Evite:\n\n- fazer tudo porque é mais rápido;\n- retirar toda ajuda de uma vez;\n- repetir comandos infinitamente;\n- chamar de preguiçoso;\n- comparar com irmãos;\n- dizer “você já deveria saber”;\n- ensinar várias habilidades ao mesmo tempo;\n- exigir perfeição;\n- confundir lentidão com incapacidade;\n- impedir tentativa por medo de bagunça;\n- oferecer ajuda maior do que a necessária."
  },
  {
    "id": "autonomia/24-perguntas-de-alto-valor",
    "tema": "autonomia",
    "secao": "24. PERGUNTAS DE ALTO VALOR",
    "titulo": "24. PERGUNTAS DE ALTO VALOR",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Use somente quando mudarem a decisão:\n\n“Qual parte ele já faz sozinho?”\n\n“Em qual etapa ele costuma parar?”\n\n“Se você não lembrar, ele começa?”\n\n“Ele precisa que você faça ou só que você diga o próximo passo?”\n\n“Se tiver uma sequência visual, consegue continuar?”\n\n“Ele tenta antes de pedir ajuda?”\n\n“Essa dificuldade acontece sempre ou principalmente quando vocês estão com pressa?”\n\n“Existe alguma parte que parece incomodar sensorialmente?”"
  },
  {
    "id": "autonomia/25-progressao",
    "tema": "autonomia",
    "secao": "25. PROGRESSÃO",
    "titulo": "25. PROGRESSÃO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Não medir autonomia apenas por:\n\nfaz / não faz.\n\nMeça redução de suporte.\n\nExemplo:\n\nANTES:\nadulto veste completamente.\n\n↓\n\nadulto veste e criança termina.\n\n↓\n\nadulto ajuda fisicamente.\n\n↓\n\nadulto demonstra.\n\n↓\n\nadulto aponta.\n\n↓\n\nadulto lembra.\n\n↓\n\nvisual lembra.\n\n↓\n\ncriança inicia e conclui.\n\nIsso é evolução mesmo antes da independência total."
  },
  {
    "id": "autonomia/exemplo-de-conversa",
    "tema": "autonomia",
    "secao": "EXEMPLO DE CONVERSA",
    "titulo": "EXEMPLO DE CONVERSA",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Mãe:\n\n“Meu filho de 6 anos não se veste sozinho.”\n\nResposta ruim:\n\n“Faça uma rotina visual e incentive a independência.”\n\nResposta melhor:\n\n“Vamos descobrir onde está a ajuda que ainda pode ser retirada. Se você deixar camiseta, shorts e sapato separados, o que ele consegue colocar sem você fazer por ele?”\n\nMãe:\n\n“Ele coloca o shorts e o sapato. Na camiseta pede ajuda.”\n\nAgora a Ayla não precisa investigar autonomia inteira.\n\n“Ótimo, então eu não mexeria no que já funciona. Trabalharia só a camiseta. Comece colocando até a cabeça e deixe que ele encontre os braços e puxe sozinho. Quando isso ficar fácil, você ajuda um pouco menos.”"
  },
  {
    "id": "autonomia/resultado-esperado",
    "tema": "autonomia",
    "secao": "RESULTADO ESPERADO",
    "titulo": "RESULTADO ESPERADO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "A família deve deixar de pensar:\n\n“Ele depende de mim para tudo.”\n\ne conseguir perceber:\n\n“Ele já faz várias etapas. A ajuda está concentrada aqui.”\n\nA próxima intervenção deve reduzir UMA camada de ajuda, não retirar todo o suporte.\n\n---"
  },
  {
    "id": "comunicacao/missao",
    "tema": "comunicacao",
    "secao": "MISSÃO",
    "titulo": "MISSÃO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Ajudar a família a mapear o que a criança já compreende, o que consegue\ncomunicar e por qual via — para descobrir qual é o próximo degrau funcional.\n\nAtua quando o relato fala de: poucas palavras; fala que não vira pedido;\npuxar o adulto pela mão; repetição de frases; não responder ao que é\nperguntado; falar bem mas não sustentar conversa.\n\nO objetivo NÃO é contar palavras nem reduzir comunicação a fala.\n\nA pergunta funcional é:\n\n\"O que a criança quer comunicar, o que ela compreende e qual via consegue usar\nespontaneamente naquele contexto?\"\n\nO objetivo é localizar a barreira antes de orientar. O mesmo relato pode\nesconder mecanismos diferentes."
  },
  {
    "id": "comunicacao/principio-central",
    "tema": "comunicacao",
    "secao": "PRINCÍPIO CENTRAL",
    "titulo": "PRINCÍPIO CENTRAL",
    "nivel": 1,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Grandes bifurcações — o relato parece igual, mas precisamos distinguir:\n\n- \"Fala, mas não pede\" → vocabulário × função comunicativa × espontaneidade ×\n  acesso à fala no contexto\n- \"Puxa pela mão\" → gesto funcional × falta de alternativa eficiente ×\n  compreensão × iniciativa\n- \"Não responde\" → não compreendeu × precisa de tempo × atenção/contexto ×\n  forma da pergunta\n- \"Repete frases\" → repetição com função × ecolalia sem função aparente ×\n  script útil × dificuldade de gerar linguagem nova\n- \"Fala bem, mas não conversa\" → linguagem estrutural × pragmática ×\n  reciprocidade × narrativa × inferência"
  },
  {
    "id": "comunicacao/1-fala-comunicacao-funcional",
    "tema": "comunicacao",
    "secao": "PRINCÍPIO CENTRAL",
    "titulo": "1. Fala ≠ comunicação funcional",
    "nivel": 2,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Ter palavras não garante conseguir pedir ajuda, recusar, comentar, explicar\ndesconforto ou compartilhar experiência no momento necessário."
  },
  {
    "id": "comunicacao/2-receptiva-expressiva",
    "tema": "comunicacao",
    "secao": "PRINCÍPIO CENTRAL",
    "titulo": "2. Receptiva × expressiva",
    "nivel": 2,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Separar o que a criança compreende do que consegue expressar. Uma instrução\nlonga pode falhar por compreensão, memória de trabalho ou contexto, e não por\noposição."
  },
  {
    "id": "comunicacao/3-espontaneo-provocado",
    "tema": "comunicacao",
    "secao": "PRINCÍPIO CENTRAL",
    "titulo": "3. Espontâneo × provocado",
    "nivel": 2,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Pergunta: \"Sem você perguntar ou dar a primeira palavra, ele usa palavra,\ngesto, imagem ou outro recurso sozinho para pedir o que precisa?\"\n\nEssa diferença ajuda a localizar independência comunicativa."
  },
  {
    "id": "comunicacao/4-forma-disponivel-no-momento",
    "tema": "comunicacao",
    "secao": "PRINCÍPIO CENTRAL",
    "titulo": "4. Forma disponível no momento",
    "nivel": 2,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "A comunicação pode mudar com cansaço, sobrecarga, ambiente social e exigência.\nA pergunta não é apenas \"ele fala?\", mas \"o que ele consegue usar aqui e\nagora?\"."
  },
  {
    "id": "comunicacao/5-comunicacao-como-alternativa-antes-da-escalada",
    "tema": "comunicacao",
    "secao": "PRINCÍPIO CENTRAL",
    "titulo": "5. Comunicação como alternativa antes da escalada",
    "nivel": 2,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Se um comportamento intenso está funcionando como \"pare\", \"me ajuda\", \"quero\nsair\" ou \"não entendi\", a condução deve procurar uma forma mais acessível de\ncomunicar a mesma necessidade — sem presumir intenção manipulativa."
  },
  {
    "id": "comunicacao/6-cruzamento-com-aprendizagem",
    "tema": "comunicacao",
    "secao": "PRINCÍPIO CENTRAL",
    "titulo": "6. Cruzamento com aprendizagem",
    "nivel": 2,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Dificuldade de leitura/escrita, instruções em etapas ou narrativa pode exigir\nrecuperar Aprendizado/Foco junto, conforme o problema real."
  },
  {
    "id": "comunicacao/antes-de-orientar-diferencie-quando-comunicacao-nao-e-o-tema-principal",
    "tema": "comunicacao",
    "secao": "ANTES DE ORIENTAR, DIFERENCIE — QUANDO COMUNICAÇÃO NÃO É O TEMA PRINCIPAL",
    "titulo": "ANTES DE ORIENTAR, DIFERENCIE — QUANDO COMUNICAÇÃO NÃO É O TEMA PRINCIPAL",
    "nivel": 1,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "- Se a criança compreende e comunica bem, mas trava por medo/sobrecarga,\n  recuperar Emocional/Sensorial.\n- Se o problema é seguir etapas e iniciar, recuperar Foco/Rotina.\n- Se a dificuldade é leitura/escrita, recuperar Aprendizado.\n- Se a fala muda apenas em situações específicas, investigar contexto antes de\n  concluir déficit global."
  },
  {
    "id": "comunicacao/pergunta-de-alto-valor-golden-case",
    "tema": "comunicacao",
    "secao": "PERGUNTA DE ALTO VALOR — GOLDEN CASE",
    "titulo": "PERGUNTA DE ALTO VALOR — GOLDEN CASE",
    "nivel": 1,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "\"Ele me puxa pela mão para pegar as coisas, mas quase não pede sozinho.\"\n\nJá sabemos:\n\n- há intenção comunicativa\n- há uma estratégia funcional já usada: puxar pela mão\n- o pedido verbal/gestual espontâneo parece limitado\n\nAinda precisamos diferenciar:\n\n- o que ele compreende\n- quais formas usa espontaneamente\n- se há palavras/gestos quando recebe modelo\n- em quais contextos perde ou ganha comunicação\n\nPergunta de maior valor:\n\n\"Sem você perguntar, ele usa alguma palavra, gesto ou imagem sozinho para pedir\n— ou normalmente precisa puxar você/esperar ajuda?\"\n\nComo ler a resposta:\n\n- Usa espontaneamente em alguns contextos: comparar onde funciona e transferir\n  condições.\n- Só usa com modelo: investigar apoio necessário e reduzir dependência\n  gradualmente.\n- Puxar pela mão é consistente: tratar como comunicação existente e construir\n  alternativa mais clara, não como ausência de comunicação."
  },
  {
    "id": "comunicacao/regra-de-conducao-o-que-nao-perguntar-se-o-relato-ja-respondeu",
    "tema": "comunicacao",
    "secao": "REGRA DE CONDUÇÃO — O QUE NÃO PERGUNTAR SE O RELATO JÁ RESPONDEU",
    "titulo": "REGRA DE CONDUÇÃO — O QUE NÃO PERGUNTAR SE O RELATO JÁ RESPONDEU",
    "nivel": 1,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "- Não perguntar \"ele se comunica?\" se o relato já mostra uma forma\n  comunicativa.\n- Não reduzir comunicação a fala.\n- Não assumir que comportamento intenso é \"sem motivo\" quando pode cumprir\n  função comunicativa."
  },
  {
    "id": "comunicacao/triagem-inicial-o-que-consultar-no-perfil-primeiro",
    "tema": "comunicacao",
    "secao": "TRIAGEM INICIAL — O QUE CONSULTAR NO PERFIL PRIMEIRO",
    "titulo": "TRIAGEM INICIAL — O QUE CONSULTAR NO PERFIL PRIMEIRO",
    "nivel": 1,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Campos que existem hoje no Perfil, em `comunicacao`:\n\n- Como se comunica\n- Como mostra o que quer\n- Como demonstra que entende\n- Vocabulário e fala\n- Ecolalia / repetições\n- Conversa e argumentação\n- Entende o contexto\n- Contato visual e gestos\n- Comunicação alternativa (CAA)\n\nLacuna de Perfil conhecida: não existe campo que distinga **uso espontâneo de\nuso provocado**, que é a bifurcação central deste tema. Enquanto não existir, a\ninformação entra em \"Outras observações\"."
  },
  {
    "id": "comunicacao/seguranca-e-limites",
    "tema": "comunicacao",
    "secao": "SEGURANÇA E LIMITES",
    "titulo": "SEGURANÇA E LIMITES",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "- Perda de habilidades previamente adquiridas ou mudança súbita merece\n  avaliação.\n- Não prometer que comunicação alternativa fará a fala surgir.\n- Não usar sequência rígida de pré-requisitos para impedir avanços."
  },
  {
    "id": "comunicacao/resultado-esperado",
    "tema": "comunicacao",
    "secao": "RESULTADO ESPERADO",
    "titulo": "RESULTADO ESPERADO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "A família consegue dizer: \"eu sei o que ele já comunica e por qual via\" e \"eu\nsei qual é o próximo degrau, sem esperar a fala chegar primeiro\".\n\n---"
  },
  {
    "id": "emocional/missao",
    "tema": "emocional",
    "secao": "MISSÃO",
    "titulo": "MISSÃO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Ajudar a família a entender o que uma reação intensa está tentando resolver, e\nonde ainda dá para entrar antes do pico.\n\nAtua quando o relato fala de: bater, gritar, morder, jogar objetos; explosões\ndiante de contrariedade; choro difícil de acalmar; recusa que escala;\ndificuldade de conversar durante o episódio.\n\nO objetivo NÃO é nomear o que a criança \"tem\" a partir de um episódio.\n\nA pergunta funcional é:\n\n\"O que esta reação está tentando resolver, e em que ponto da escalada ainda dá\npara entrar?\"\n\nO objetivo é localizar a barreira antes de orientar. O mesmo relato pode\nesconder mecanismos diferentes."
  },
  {
    "id": "emocional/principio-central",
    "tema": "emocional",
    "secao": "PRINCÍPIO CENTRAL",
    "titulo": "PRINCÍPIO CENTRAL",
    "nivel": 1,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Grandes bifurcações — o relato parece igual, mas precisamos distinguir:\n\n- \"Bate/grita/morde\" → frustração × sobrecarga × medo × fuga de demanda ×\n  comunicação × impulso\n- \"Explode por pouca coisa\" → gatilho isolado × carga acumulada\n- \"Não aceita não\" → perda/frustração × demanda × compreensão × padrão de\n  consequência\n- \"Fica impossível conversar\" → protesto ainda comunicativo × escalada × pico\n- \"Depois fica bem\" → alívio após mudança × recuperação fisiológica ×\n  acesso/saída × reparação"
  },
  {
    "id": "emocional/1-antes-durante-depois",
    "tema": "emocional",
    "secao": "PRINCÍPIO CENTRAL",
    "titulo": "1. Antes × durante × depois",
    "nivel": 2,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Antes: pedido, limite, erro, espera, interrupção, barulho, conflito social,\ncansaço, dificuldade de comunicação. Durante: protesto, fuga, agressão, choro,\ncongelamento, perda progressiva de possibilidade de conversar. Depois: observar\no que mudou e como a criança se recupera.\n\nPergunta: \"O que costuma acontecer logo antes e logo depois?\""
  },
  {
    "id": "emocional/2-frustracao-sobrecarga",
    "tema": "emocional",
    "secao": "PRINCÍPIO CENTRAL",
    "titulo": "2. Frustração × sobrecarga",
    "nivel": 2,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Frustração se organiza em torno de algo específico que não aconteceu como\nesperado. Sobrecarga pode ser acúmulo; o último evento não explica sozinho a\nintensidade.\n\nPergunta: \"Ela já vinha mais irritada, cansada ou sensível antes disso?\""
  },
  {
    "id": "emocional/3-funcao-sem-rotular-manipulacao",
    "tema": "emocional",
    "secao": "PRINCÍPIO CENTRAL",
    "titulo": "3. Função sem rotular manipulação",
    "nivel": 2,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Um comportamento pode terminar demanda, produzir ajuda, proximidade, acesso ou\nmudança do ambiente. Observar isso não significa chamar a criança de\nmanipuladora.\n\nRegra: compreender o que o comportamento produz não é o mesmo que usar prêmio\nou suborno."
  },
  {
    "id": "emocional/4-ponto-de-entrada",
    "tema": "emocional",
    "secao": "PRINCÍPIO CENTRAL",
    "titulo": "4. Ponto de entrada",
    "nivel": 2,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Procurar o primeiro sinal de que está ficando difícil. Estratégias possíveis no\ninício podem não funcionar no pico.\n\nPergunta: \"Qual é o primeiro sinal de que está começando a ficar difícil?\""
  },
  {
    "id": "emocional/5-co-regulacao",
    "tema": "emocional",
    "secao": "PRINCÍPIO CENTRAL",
    "titulo": "5. Co-regulação",
    "nivel": 2,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "O comportamento do adulto entra na sequência. Explicar demais, repetir, elevar\na voz, negociar ou aproximar-se podem ter efeitos diferentes conforme o\nmomento.\n\nPergunta: \"Quando ela começa a se alterar, o que vocês costumam fazer em\nseguida?\""
  },
  {
    "id": "emocional/antes-de-orientar-diferencie-quando-emocional-nao-e-o-tema-principal",
    "tema": "emocional",
    "secao": "ANTES DE ORIENTAR, DIFERENCIE — QUANDO EMOCIONAL NÃO É O TEMA PRINCIPAL",
    "titulo": "ANTES DE ORIENTAR, DIFERENCIE — QUANDO EMOCIONAL NÃO É O TEMA PRINCIPAL",
    "nivel": 1,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "- Se a reação aparece ligada a ruído, textura, multidão ou estímulo específico\n  e muda quando o ambiente muda, recuperar Sensorial.\n- Se a crise ocorre porque não compreendeu ou não consegue pedir/recusar,\n  recuperar Comunicação.\n- Se o problema central é interromper/iniciar uma sequência, recuperar\n  Rotina/Foco.\n- Se a dificuldade é habilidade ainda não adquirida, não tratar apenas como\n  regulação."
  },
  {
    "id": "emocional/pergunta-de-alto-valor-golden-case",
    "tema": "emocional",
    "secao": "PERGUNTA DE ALTO VALOR — GOLDEN CASE",
    "titulo": "PERGUNTA DE ALTO VALOR — GOLDEN CASE",
    "nivel": 1,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "\"Quando é contrariada, grita, bate e às vezes morde.\"\n\nJá sabemos:\n\n- há uma reação intensa após contrariedade\n- há agressão física em alguns episódios\n\nAinda precisamos diferenciar:\n\n- perda de algo desejado × demanda indesejada × sobrecarga prévia\n- primeiros sinais da escalada\n- o que acontece depois\n- formas de comunicação disponíveis naquele momento\n\nPergunta de maior valor:\n\n\"Isso acontece mais quando ela perde algo que queria, quando precisa fazer algo\nque não quer, ou também quando parece já estar sobrecarregada antes?\"\n\nComo ler a resposta:\n\n- Perda específica: aprofundar frustração e tolerância à perda/espera.\n- Demanda: investigar dificuldade da tarefa, fuga e comunicação de pausa/ajuda.\n- Sobrecarga: investigar acúmulo e sinais precoces.\n- Vários caminhos: manter hipótese aberta e observar antes/durante/depois."
  },
  {
    "id": "emocional/regra-de-conducao-o-que-nao-perguntar-se-o-relato-ja-respondeu",
    "tema": "emocional",
    "secao": "REGRA DE CONDUÇÃO — O QUE NÃO PERGUNTAR SE O RELATO JÁ RESPONDEU",
    "titulo": "REGRA DE CONDUÇÃO — O QUE NÃO PERGUNTAR SE O RELATO JÁ RESPONDEU",
    "nivel": 1,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "- Não perguntar idade se o Perfil já contém.\n- Não perguntar \"ela fica brava?\" se o relato já descreveu a reação.\n- Não chamar de desregulação, ansiedade, TOD ou manipulação como explicação\n  fechada."
  },
  {
    "id": "emocional/triagem-inicial-o-que-consultar-no-perfil-primeiro",
    "tema": "emocional",
    "secao": "TRIAGEM INICIAL — O QUE CONSULTAR NO PERFIL PRIMEIRO",
    "titulo": "TRIAGEM INICIAL — O QUE CONSULTAR NO PERFIL PRIMEIRO",
    "nivel": 1,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Campos que existem hoje no Perfil, em `emocional` — e que cobrem o mapa\nantes/durante/depois quase campo a campo:\n\n- Como costuma ser\n- Gatilhos\n- Sinais de que vem vindo\n- Como se manifesta\n- O que ajuda a passar\n- O que NÃO ajuda / piora\n- Depois\n\nSe o Perfil já traz gatilhos e sinais precoces, não perguntar de novo: usar o\nque está lá e perguntar só o que falta."
  },
  {
    "id": "emocional/seguranca-e-limites",
    "tema": "emocional",
    "secao": "SEGURANÇA E LIMITES",
    "titulo": "SEGURANÇA E LIMITES",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "- Agressão com risco imediato exige prioridade à segurança.\n- Mudança abrupta/intensa de comportamento ou sofrimento persistente pode\n  exigir avaliação profissional.\n- Não diagnosticar função, transtorno ou causa a partir de um relato isolado."
  },
  {
    "id": "emocional/resultado-esperado",
    "tema": "emocional",
    "secao": "RESULTADO ESPERADO",
    "titulo": "RESULTADO ESPERADO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "A família consegue dizer: \"eu sei o que costuma disparar\" e \"eu sei em que\nmomento ainda dá para entrar\".\n\n---"
  },
  {
    "id": "foco/missao",
    "tema": "foco",
    "secao": "MISSÃO",
    "titulo": "MISSÃO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Ajudar a família a entender por que a criança está tendo dificuldade para começar, manter ou concluir uma atividade e encontrar estratégias práticas para aumentar participação, permanência e autonomia.\n\nEsta skill pode atuar em situações como:\n\n- não consegue começar tarefa;\n- abandona no meio;\n- levanta toda hora;\n- se distrai com qualquer coisa;\n- hiperfoca no que gosta;\n- perde instruções;\n- precisa ser chamado várias vezes;\n- esquece o que estava fazendo;\n- demora muito para terminar;\n- fica agitado em atividade de mesa;\n- troca de atividade o tempo todo;\n- escola relata desatenção;\n- tarefa parece gerar resistência;\n- dificuldade de esperar;\n- dificuldade de manter o fio;\n- baixa persistência.\n\nO objetivo NÃO é diagnosticar TDAH ou explicar todo comportamento por “déficit de atenção”.\n\nA pergunta funcional é:\n\n“O que está impedindo essa pessoa de entrar, permanecer ou concluir essa atividade neste momento?”"
  },
  {
    "id": "foco/principio-central",
    "tema": "foco",
    "secao": "PRINCÍPIO CENTRAL",
    "titulo": "PRINCÍPIO CENTRAL",
    "nivel": 1,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "“Não presta atenção” é uma descrição ampla demais.\n\nAntes de orientar, diferencie:\n\n1. não começa;\n2. começa e abandona;\n3. começa, mas se distrai;\n4. perde o fio;\n5. entende, mas esquece etapas;\n6. recusa porque a demanda está difícil;\n7. recusa porque a atividade está longa;\n8. precisa de movimento;\n9. está em ambiente muito estimulante;\n10. só consegue focar quando há interesse;\n11. está cansado/sobrecarregado;\n12. não compreendeu a instrução.\n\nA estratégia depende de qual desses cenários está acontecendo."
  },
  {
    "id": "foco/regra-de-conducao",
    "tema": "foco",
    "secao": "REGRA DE CONDUÇÃO",
    "titulo": "REGRA DE CONDUÇÃO",
    "nivel": 1,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Não faça interrogatório.\n\nSe a situação já permitir uma primeira estratégia, entregue.\n\nPergunte apenas o que muda o caminho.\n\nExemplo de pergunta de alto valor:\n\n“Depois que ele começa, consegue continuar por alguns minutos ou logo levanta de novo?”\n\nIsso diferencia dificuldade de INICIAR de dificuldade de SUSTENTAR."
  },
  {
    "id": "foco/triagem-inicial-duas-perguntas-que-separam-caminhos-rapidamente",
    "tema": "foco",
    "secao": "TRIAGEM INICIAL — DUAS PERGUNTAS QUE SEPARAM CAMINHOS RAPIDAMENTE",
    "titulo": "TRIAGEM INICIAL — DUAS PERGUNTAS QUE SEPARAM CAMINHOS RAPIDAMENTE",
    "nivel": 1,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Precisamos descobrir se a dificuldade é de sustentar atenção de forma geral ou se muda muito conforme interesse, tipo de atividade, movimento e uso das mãos.\n\nPergunta de alto valor:\n\n“Quando ele está fazendo algo de que gosta — desenhando, montando, mexendo em peças, Lego, massinha, carrinhos ou outra brincadeira — consegue ficar concentrado por bastante tempo?”\n\nE a resposta deve mudar a orientação:\n\nSustenta bem desenhando/montando, mas não na tarefa escolar → investigar interesse, dificuldade da tarefa, formato da atividade, exigência e motivação.\n\nSustenta melhor quando usa as mãos ou se movimenta → testar aprendizagem mais ativa e manipulativa.\n\nSustenta apenas em interesses muito específicos → usar esses interesses como ponte, sem concluir simplesmente que “ele consegue quando quer”.\n\nNão sustenta nem nas atividades preferidas → olhar mais para dificuldade global de sustentação, ambiente, sobrecarga, compreensão da atividade etc.\n\nFica muito tempo e é difícil interromper → pode haver uma questão de transição/hiperfoco; o problema deixa de ser simplesmente “foco”.\n\nIsso vem logo no começo da triagem, porque é uma pergunta que separa caminhos rapidamente.\n\nE há outra ainda melhor para vir junto:\n\n“E quando está mexendo em alguma coisa com as mãos, ele parece conseguir prestar mais atenção até no que você fala?”\n\nIsso ajuda a Ayla a não cometer o erro de interpretar movimento = desatenção. Para algumas crianças, manipular algo ou movimentar o corpo pode coexistir com atenção à atividade."
  },
  {
    "id": "foco/1-dificuldade-para-comecar",
    "tema": "foco",
    "secao": "1. DIFICULDADE PARA COMEÇAR",
    "titulo": "1. DIFICULDADE PARA COMEÇAR",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Sinais:\n- enrola;\n- evita;\n- pede várias coisas antes;\n- diz “não sei” sem olhar;\n- precisa de muitos chamados;\n- fica parado diante da tarefa.\n\nNão conclua automaticamente que é desatenção.\n\nPode haver:\n- tarefa vaga;\n- começo grande demais;\n- medo de errar;\n- transição ruim;\n- pouca clareza;\n- demanda difícil;\n- cansaço;\n- baixa motivação.\n\nEstratégias:\n- reduzir para o primeiro passo;\n- mostrar começo visível;\n- começar junto;\n- usar “faz só este”;\n- preparar a transição;\n- deixar o fim visível.\n\nExemplo:\n\nEm vez de:\n“Faça a lição.”\n\nTente:\n“Vamos fazer só a primeira questão. Depois a gente vê a próxima.”"
  },
  {
    "id": "foco/2-comeca-mas-nao-sustenta",
    "tema": "foco",
    "secao": "2. COMEÇA, MAS NÃO SUSTENTA",
    "titulo": "2. COMEÇA, MAS NÃO SUSTENTA",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Sinais:\n- faz 2 minutos e levanta;\n- muda de assunto;\n- começa outra coisa;\n- mexe em objetos;\n- abandona antes de terminar.\n\nAqui pode ajudar:\n- blocos curtos;\n- pausa planejada;\n- alternância com movimento;\n- poucas questões por vez;\n- fim visível;\n- tarefa segmentada.\n\nNão usar tempo longo como meta inicial.\n\nSe sustenta 4 minutos, começar com 15 minutos pode criar fracasso.\n\nAjuste o tamanho da tarefa à janela real de atenção."
  },
  {
    "id": "foco/3-se-distrai-com-o-ambiente",
    "tema": "foco",
    "secao": "3. SE DISTRAI COM O AMBIENTE",
    "titulo": "3. SE DISTRAI COM O AMBIENTE",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Observe:\n- barulho;\n- pessoas passando;\n- objetos na mesa;\n- televisão;\n- celular;\n- materiais excessivos;\n- sala visualmente carregada.\n\nEstratégia:\ndiminuir competição por atenção.\n\nExemplo:\ndeixar na mesa somente o material daquela etapa.\n\nNão dizer apenas:\n“precisa de um lugar tranquilo”.\n\nExplique o que mudar concretamente."
  },
  {
    "id": "foco/4-perde-o-fio",
    "tema": "foco",
    "secao": "4. PERDE O FIO",
    "titulo": "4. PERDE O FIO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Exemplos:\n- começa uma palavra e esquece o começo;\n- esquece a segunda etapa da tarefa;\n- pergunta várias vezes “o que era pra fazer?”;\n- sabe a atividade, mas se perde na sequência.\n\nAqui o problema pode ser carga de memória de trabalho, não ausência de foco.\n\nEstratégias:\n- uma instrução por vez;\n- visual com etapas;\n- riscar o que já fez;\n- esconder o que ainda não precisa;\n- deixar modelo disponível;\n- repetir só a etapa atual."
  },
  {
    "id": "foco/5-muita-informacao-de-uma-vez",
    "tema": "foco",
    "secao": "5. MUITA INFORMAÇÃO DE UMA VEZ",
    "titulo": "5. MUITA INFORMAÇÃO DE UMA VEZ",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Instrução:\n“Pega o caderno, abre na página 10, copia a data, responde as três perguntas e depois guarda.”\n\nPode ser demais.\n\nTransforme em:\n1. pega o caderno;\n2. abre a página;\n3. agora vamos para a próxima.\n\nNão infantilizar.\nÉ redução de carga, não redução de capacidade."
  },
  {
    "id": "foco/6-foco-muito-melhor-no-que-gosta",
    "tema": "foco",
    "secao": "6. FOCO MUITO MELHOR NO QUE GOSTA",
    "titulo": "6. FOCO MUITO MELHOR NO QUE GOSTA",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Isso é informação útil.\n\nNão concluir:\n“Então ele consegue, é só querer.”\n\nO fato de conseguir sustentar atenção em interesse forte mostra que:\n- atenção não é uniforme;\n- motivação e significado mudam a participação;\n- interesse pode ser usado como ponte.\n\nUse interesse para:\n- iniciar;\n- contextualizar;\n- variar materiais;\n- dar sentido à atividade.\n\nMas não transformar todo conteúdo no hiperfoco."
  },
  {
    "id": "foco/7-movimento",
    "tema": "foco",
    "secao": "7. MOVIMENTO",
    "titulo": "7. MOVIMENTO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Algumas pessoas mantêm melhor atenção quando o corpo pode se mover.\n\nNão exigir imobilidade como prova de foco.\n\nPossibilidades:\n- atividade em pé;\n- responder andando entre cartões;\n- buscar itens;\n- pequena pausa motora;\n- assento que permita movimento seguro;\n- levar algo de um ponto ao outro.\n\nMovimento deve ajudar a tarefa, não virar distração adicional."
  },
  {
    "id": "foco/8-dificuldade-por-demanda-alta",
    "tema": "foco",
    "secao": "8. DIFICULDADE POR DEMANDA ALTA",
    "titulo": "8. DIFICULDADE POR DEMANDA ALTA",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Às vezes a pessoa “não foca” porque a atividade está difícil.\n\nSinais:\n- foco melhor em tarefas fáceis;\n- piora quando há leitura/escrita;\n- começa e foge quando erra;\n- pede ajuda antes de tentar;\n- irritação aumenta com exigência.\n\nNão tratar isso apenas com timer.\n\nTalvez seja necessário reduzir complexidade ou oferecer suporte na habilidade."
  },
  {
    "id": "foco/9-medo-de-errar-perfeccionismo",
    "tema": "foco",
    "secao": "9. MEDO DE ERRAR / PERFECCIONISMO",
    "titulo": "9. MEDO DE ERRAR / PERFECCIONISMO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Pode parecer desatenção:\n- demora para começar;\n- apaga várias vezes;\n- pede confirmação;\n- evita;\n- abandona se erra.\n\nAjuda:\n- diminuir importância do erro;\n- primeiro rascunho;\n- “vamos tentar uma versão”;\n- corrigir depois;\n- separar produzir de revisar."
  },
  {
    "id": "foco/10-sobrecarga",
    "tema": "foco",
    "secao": "10. SOBRECARGA",
    "titulo": "10. SOBRECARGA",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Quando há muito estímulo, emoção ou cansaço, pedir foco pode ser pouco realista.\n\nObserve:\n- sono;\n- fome;\n- barulho;\n- transição;\n- conflito anterior;\n- excesso de demandas;\n- longa permanência na escola.\n\nNão transformar toda sobrecarga em “precisa treinar atenção”.\n\nÀs vezes o melhor ajuste é reduzir demanda naquele momento."
  },
  {
    "id": "foco/11-hiperfoco",
    "tema": "foco",
    "secao": "11. HIPERFOCO",
    "titulo": "11. HIPERFOCO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Se está muito envolvido numa atividade preferida e não consegue mudar:\n\no problema pode estar mais na TRANSIÇÃO do que no foco.\n\nExemplo:\nvideogame → tarefa.\n\nNão orientar apenas:\n“limite o tempo”.\n\nUse:\n- aviso;\n- marcador visual;\n- encerramento previsível;\n- ponte para próxima atividade;\n- ritual de finalização.\n\nSe a família disser:\n“Eu já aviso antes.”\n\navance para:\n- marcador visual;\n- escolha entre dois próximos passos;\n- ritual de fechamento;\n- reduzir negociação;\n- analisar o que acontece exatamente no momento da transição."
  },
  {
    "id": "foco/12-foco-na-escola",
    "tema": "foco",
    "secao": "12. FOCO NA ESCOLA",
    "titulo": "12. FOCO NA ESCOLA",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Quando a escola diz:\n“não presta atenção”\n\ntente transformar isso em descrição observável.\n\nPerguntas de alto valor:\n- ele não começa?\n- levanta?\n- olha para outro lado?\n- começa e não termina?\n- esquece instrução?\n- funciona melhor individualmente?\n- piora em tarefa específica?\n\nNão precisa perguntar tudo.\n\nEscolha a pergunta que diferencia as hipóteses principais."
  },
  {
    "id": "foco/13-janela-real-de-atencao",
    "tema": "foco",
    "secao": "13. JANELA REAL DE ATENÇÃO",
    "titulo": "13. JANELA REAL DE ATENÇÃO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Uma pergunta útil:\n\n“Quanto tempo ele consegue permanecer numa atividade que não é favorita quando sabe exatamente o que precisa fazer?”\n\nIsso ajuda a calibrar tarefa.\n\nO objetivo não é fazer a pessoa permanecer o máximo possível.\n\nÉ criar experiências de sucesso e ampliar gradualmente."
  },
  {
    "id": "foco/14-estrategia-do-comeco-visivel-e-fim-visivel",
    "tema": "foco",
    "secao": "14. ESTRATÉGIA DO COMEÇO VISÍVEL E FIM VISÍVEL",
    "titulo": "14. ESTRATÉGIA DO COMEÇO VISÍVEL E FIM VISÍVEL",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Muitas pessoas sustentam melhor quando sabem:\n- por onde começar;\n- quanto falta;\n- quando termina.\n\nExemplos:\n- três cartões;\n- quatro questões;\n- checklist;\n- timer visual;\n- sequência de quadrados;\n- “primeiro/depois”.\n\nEvite usar timer como ameaça.\n\nTimer deve dar previsibilidade, não pressão."
  },
  {
    "id": "foco/15-progressao",
    "tema": "foco",
    "secao": "15. PROGRESSÃO",
    "titulo": "15. PROGRESSÃO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Exemplo:\n\nHoje:\n2 atividades curtas + pausa.\n\nDepois:\n3 atividades.\n\nDepois:\num bloco um pouco maior.\n\nNão aumentar duração porque “ontem conseguiu uma vez”.\n\nProcure consistência antes de avançar."
  },
  {
    "id": "foco/16-o-que-fazer-quando-a-estrategia-nao-funciona",
    "tema": "foco",
    "secao": "16. O QUE FAZER QUANDO A ESTRATÉGIA NÃO FUNCIONA",
    "titulo": "16. O QUE FAZER QUANDO A ESTRATÉGIA NÃO FUNCIONA",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Se a família disser:\n“Já faço isso.”\n\nNÃO repetir com outras palavras.\n\nPergunte internamente:\n“Qual hipótese ainda não foi testada?”\n\nExemplo:\n\nJá usa timer.\n→ talvez o problema não seja previsibilidade.\n\nInvestigue:\n- dificuldade da tarefa;\n- transição;\n- motivação;\n- carga de memória;\n- ambiente.\n\nE dê o próximo caminho."
  },
  {
    "id": "foco/17-frases-para-o-cuidador",
    "tema": "foco",
    "secao": "17. FRASES PARA O CUIDADOR",
    "titulo": "17. FRASES PARA O CUIDADOR",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Quando útil:\n\n“Vamos fazer só o primeiro.”\n\n“Olha aqui: faltam três.”\n\n“Primeiro isso, depois você escolhe a pausa.”\n\n“Você quer começar pelo 1 ou pelo 2?”\n\n“Eu te ajudo no começo e depois você continua.”\n\n“Vamos terminar essa parte antes de levantar.”\n\nEvite:\n“Presta atenção.”\n“Para quieto.”\n“Você não para um segundo.”\n“Você consegue quando quer.”\n“Se concentrasse, já teria terminado.”"
  },
  {
    "id": "foco/18-erros-comuns",
    "tema": "foco",
    "secao": "18. ERROS COMUNS",
    "titulo": "18. ERROS COMUNS",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Evite:\n\n- exigir muito tempo de uma vez;\n- repetir a mesma instrução cada vez mais alto;\n- confundir movimento com falta de atenção;\n- usar hiperfoco como prova de má vontade;\n- transformar todo problema em TDAH;\n- usar recompensa para tudo;\n- ameaçar retirar interesse favorito;\n- timer como corrida/pressão;\n- fazer a tarefa pela criança para terminar rápido;\n- dar instruções longas;\n- aumentar demanda quando a pessoa já está sobrecarregada."
  },
  {
    "id": "foco/19-o-que-observar",
    "tema": "foco",
    "secao": "19. O QUE OBSERVAR",
    "titulo": "19. O QUE OBSERVAR",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Toda observação precisa mudar uma decisão.\n\nObserve:\n\n- inicia sozinho ou precisa de apoio?\n- quanto tempo sustenta?\n- o que costuma quebrar o foco?\n- melhora com tarefa menor?\n- melhora com visual?\n- melhora com movimento?\n- piora conforme aumenta dificuldade?\n- consegue retomar depois de interromper?\n- qual tipo de ajuda funciona?\n- precisa da ajuda até o fim ou só para iniciar?"
  },
  {
    "id": "foco/20-personalizacao",
    "tema": "foco",
    "secao": "20. PERSONALIZAÇÃO",
    "titulo": "20. PERSONALIZAÇÃO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Use:\n- idade;\n- linguagem;\n- interesse;\n- ambiente;\n- perfil sensorial;\n- habilidade escolar;\n- rotina;\n- histórico da família.\n\nMas não atribua mecanismo cerebral específico sem evidência.\n\nNão diga:\n“O cérebro dele precisa...”\n\nPrefira:\n“Pode ajudar tornar a tarefa mais previsível...”"
  },
  {
    "id": "foco/exemplo-de-raciocinio",
    "tema": "foco",
    "secao": "EXEMPLO DE RACIOCÍNIO",
    "titulo": "EXEMPLO DE RACIOCÍNIO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Família:\n“Ele não faz a tarefa. Fica levantando toda hora.”\n\nNão responder automaticamente:\n“Use um timer.”\n\nPense:\n\nEle não começa?\nComeça e abandona?\nA tarefa está difícil?\nO ambiente compete?\nPrecisa de movimento?\nPerde a instrução?\n\nSe já houver informação:\n\n“Se ele até começa, mas levanta depois de poucos minutos, eu não tentaria segurar por um bloco longo. Eu faria três questões visíveis, uma pequena pausa de movimento e depois outro bloco. O objetivo primeiro é ele conseguir completar um bloco inteiro com começo e fim claros.”"
  },
  {
    "id": "foco/informacao-nova-refina",
    "tema": "foco",
    "secao": "INFORMAÇÃO NOVA REFINA",
    "titulo": "INFORMAÇÃO NOVA REFINA",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Turno 1:\n“Ele não presta atenção na lição.”\n\nTurno 2:\n“Quando começa, faz tudo certo. O difícil é sentar pra começar.”\n\nAgora a skill deve mudar de:\nsustentação\npara:\niniciação/transição.\n\nTurno 3:\n“Mesmo quando senta, ele trava se acha que vai errar.”\n\nAgora:\nmedo de errar/perfeccionismo entra como hipótese funcional.\n\nNão continuar falando de timer e pausas."
  },
  {
    "id": "foco/resultado-esperado",
    "tema": "foco",
    "secao": "RESULTADO ESPERADO",
    "titulo": "RESULTADO ESPERADO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "A família deve sentir:\n\n“Agora eu entendo melhor por que parece que ele não foca.”\n\ne:\n\n“Eu sei qual pequena mudança testar primeiro.”\n\n---"
  },
  {
    "id": "imitacao/skill-imitacao",
    "tema": "imitacao",
    "secao": "SKILL: IMITAÇÃO",
    "titulo": "SKILL: IMITAÇÃO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "> ⚠️ Salva **VERBATIM**, como entregue. Ver nota de formato no `README.md`.\n> Estado: 06/08/2026. **Skill NÃO ativada.**"
  },
  {
    "id": "imitacao/missao",
    "tema": "imitacao",
    "secao": "MISSÃO",
    "titulo": "MISSÃO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Ajudar a família a usar imitação como ferramenta natural de aprendizagem, interação e participação, identificando que tipo de imitação já existe e construindo a partir dela.\n\nEsta skill pode atuar em:\n\n- imitação de movimentos;\n- imitação com objetos;\n- gestos;\n- expressões;\n- sons;\n- ações funcionais;\n- brincadeiras;\n- músicas com gestos;\n- sequências;\n- aprendizagem por observação;\n- dificuldade em copiar ações;\n- dificuldade em acompanhar brincadeiras;\n- pouca atenção ao que o outro está fazendo;\n- necessidade de muitas instruções verbais para aprender."
  },
  {
    "id": "imitacao/principio-central",
    "tema": "imitacao",
    "secao": "PRINCÍPIO CENTRAL",
    "titulo": "PRINCÍPIO CENTRAL",
    "nivel": 1,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "“Ele não imita” não significa necessariamente ausência total de imitação.\n\nProcure ONDE ela já acontece.\n\nPode imitar:\n\n- ações com objetos;\n- movimentos grandes;\n- sons;\n- músicas;\n- personagens;\n- irmãos;\n- vídeos;\n- gestos engraçados;\n- brincadeiras preferidas;\n\nmas não imitar quando um adulto diz:\n\n“Faz igual.”\n\nEsse contraste muda a intervenção."
  },
  {
    "id": "imitacao/pergunta-de-alto-valor",
    "tema": "imitacao",
    "secao": "PERGUNTA DE ALTO VALOR",
    "titulo": "PERGUNTA DE ALTO VALOR",
    "nivel": 1,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Quando a família disser:\n\n“Ele não imita.”\n\nPergunte algo concreto:\n\n“Se você fizer alguma coisa engraçada com um brinquedo que ele gosta — por exemplo colocar o carrinho na cabeça e derrubar — ele tenta fazer também?”\n\nOu use exemplos que façam sentido para o perfil conhecido.\n\nQueremos descobrir se o problema é imitação em si ou a situação em que ela está sendo solicitada."
  },
  {
    "id": "imitacao/1-comecar-pelo-que-ela-ja-faz",
    "tema": "imitacao",
    "secao": "1. COMEÇAR PELO QUE ELA JÁ FAZ",
    "titulo": "1. COMEÇAR PELO QUE ELA JÁ FAZ",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Antes de pedir que a criança imite você:\n\nIMITE A CRIANÇA.\n\nSe ela:\n\nbate um bloco na mesa,\n\nvocê bate outro.\n\nSe faz:\n\n“brrrr” com carrinho,\n\nvocê faz também.\n\nSe pula:\n\nvocê pula.\n\nIsso pode criar uma sequência:\n\nELA FAZ → VOCÊ IMITA → ELA PERCEBE → INTERAÇÃO.\n\nDepois introduza uma pequena variação."
  },
  {
    "id": "imitacao/2-imitacao-com-objetos",
    "tema": "imitacao",
    "secao": "2. IMITAÇÃO COM OBJETOS",
    "titulo": "2. IMITAÇÃO COM OBJETOS",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Frequentemente é uma boa porta de entrada porque existe um resultado visível.\n\nExemplos:\n\n- empurrar carrinho;\n- bater tambor;\n- colocar peça dentro;\n- derrubar torre;\n- alimentar boneco;\n- fazer animal andar;\n- bater dois blocos;\n- colocar chapéu no boneco.\n\nComece com ações curtas e claras."
  },
  {
    "id": "imitacao/3-movimentos-grandes",
    "tema": "imitacao",
    "secao": "3. MOVIMENTOS GRANDES",
    "titulo": "3. MOVIMENTOS GRANDES",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Movimentos amplos costumam ser mais fáceis de perceber.\n\nExemplos:\n\n- bater palmas;\n- levantar braços;\n- pular;\n- bater pés;\n- girar;\n- colocar mãos na cabeça.\n\nTransforme em brincadeira.\n\nNão precisa dizer repetidamente:\n\n“Me imita.”\n\nPode dizer:\n\n“Olha isso!”\n\ne fazer algo divertido."
  },
  {
    "id": "imitacao/4-musica-e-imitacao",
    "tema": "imitacao",
    "secao": "4. MÚSICA E IMITAÇÃO",
    "titulo": "4. MÚSICA E IMITAÇÃO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Músicas com movimentos previsíveis são úteis porque a própria música indica o momento da ação.\n\nExemplos:\n\nbater palmas;\n\nlevantar braços;\n\ngirar;\n\nagachar;\n\nmandar beijo.\n\nComece com um ou dois gestos."
  },
  {
    "id": "imitacao/5-imitacao-de-sons",
    "tema": "imitacao",
    "secao": "5. IMITAÇÃO DE SONS",
    "titulo": "5. IMITAÇÃO DE SONS",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Não começar obrigatoriamente por palavras.\n\nPode usar:\n\n- sons de animais;\n- carros;\n- explosões;\n- beijo;\n- “opa!”;\n- “bum!”;\n- sons engraçados.\n\nSe a criança produz um som espontaneamente:\n\nimite.\n\nDepois altere levemente e veja se ela acompanha."
  },
  {
    "id": "imitacao/6-imitacao-nao-e-prova",
    "tema": "imitacao",
    "secao": "6. IMITAÇÃO NÃO É PROVA",
    "titulo": "6. IMITAÇÃO NÃO É PROVA",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Evite:\n\n“Faz igual.”\n\n“Não, errado.”\n\n“Olha direito.”\n\n“De novo.”\n\nA brincadeira não deve parecer uma avaliação constante.\n\nCrie oportunidades."
  },
  {
    "id": "imitacao/7-atencao-antes-da-imitacao",
    "tema": "imitacao",
    "secao": "7. ATENÇÃO ANTES DA IMITAÇÃO",
    "titulo": "7. ATENÇÃO ANTES DA IMITAÇÃO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Para copiar uma ação, a pessoa precisa perceber a ação.\n\nSe está olhando para outra coisa, repetir o comando não resolve.\n\nAntes:\n\n- aproxime a atividade;\n- entre no campo visual naturalmente;\n- use objeto de interesse;\n- diminua distrações;\n- faça ação curta e interessante.\n\nNão exigir contato visual.\n\nPerceber a ação não significa necessariamente olhar nos olhos."
  },
  {
    "id": "imitacao/8-uma-acao-por-vez",
    "tema": "imitacao",
    "secao": "8. UMA AÇÃO POR VEZ",
    "titulo": "8. UMA AÇÃO POR VEZ",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Comece:\n\nPALMA.\n\nNão:\n\n“Bate palma, levanta, gira e senta.”\n\nQuando ações simples estiverem fáceis:\n\nduas ações.\n\nDepois pequenas sequências."
  },
  {
    "id": "imitacao/9-variacao",
    "tema": "imitacao",
    "secao": "9. VARIAÇÃO",
    "titulo": "9. VARIAÇÃO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Depois que copia uma ação conhecida, introduza pequena novidade.\n\nExemplo:\n\nela empurra carrinho.\n\nVocê imita.\n\nDepois faz o carrinho subir numa caixa.\n\nVeja se acompanha.\n\nIsso transforma imitação em aprendizagem."
  },
  {
    "id": "imitacao/10-usar-interesses",
    "tema": "imitacao",
    "secao": "10. USAR INTERESSES",
    "titulo": "10. USAR INTERESSES",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Se gosta de animais:\n\n“Olha o elefante!”\n\nbraço imita tromba.\n\nSe gosta de super-heróis:\n\nposturas e movimentos.\n\nSe gosta de música:\n\ngestos.\n\nSe gosta de carrinhos:\n\nações com carrinhos.\n\nA imitação entra dentro da brincadeira."
  },
  {
    "id": "imitacao/11-imitacao-funcional",
    "tema": "imitacao",
    "secao": "11. IMITAÇÃO FUNCIONAL",
    "titulo": "11. IMITAÇÃO FUNCIONAL",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Use para ensinar ações reais:\n\n- guardar;\n- mexer;\n- abrir;\n- colocar;\n- vestir;\n- lavar;\n- limpar;\n- preparar;\n- organizar.\n\nExemplo:\n\n“Olha como eu coloco o prato aqui.”\n\nDemonstra uma vez.\n\nDepois dá oportunidade."
  },
  {
    "id": "imitacao/12-menos-fala-quando-a-demonstracao-basta",
    "tema": "imitacao",
    "secao": "12. MENOS FALA QUANDO A DEMONSTRAÇÃO BASTA",
    "titulo": "12. MENOS FALA QUANDO A DEMONSTRAÇÃO BASTA",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Algumas pessoas recebem muitas instruções verbais:\n\n“Você pega isso, coloca aqui, depois gira assim…”\n\nPode ser mais fácil:\n\n“Olha.”\n\nDemonstre.\n\nDepois:\n\n“Agora você.”\n\nA ação visual pode comunicar melhor que uma explicação longa."
  },
  {
    "id": "imitacao/13-quando-imita-videos-mas-nao-pessoas",
    "tema": "imitacao",
    "secao": "13. QUANDO IMITA VÍDEOS, MAS NÃO PESSOAS",
    "titulo": "13. QUANDO IMITA VÍDEOS, MAS NÃO PESSOAS",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Isso é uma pista importante.\n\nNão diga:\n\n“Então ele consegue e não quer.”\n\nVídeo pode oferecer:\n\n- repetição idêntica;\n- previsibilidade;\n- enquadramento;\n- menos informação social;\n- possibilidade de rever.\n\nPodemos aproximar a interação presencial dessas características:\n\nação curta;\n\nmesma sequência;\n\nrepetição;\n\npouca fala."
  },
  {
    "id": "imitacao/14-quando-imita-irmaos-ou-outras-criancas",
    "tema": "imitacao",
    "secao": "14. QUANDO IMITA IRMÃOS OU OUTRAS CRIANÇAS",
    "titulo": "14. QUANDO IMITA IRMÃOS OU OUTRAS CRIANÇAS",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Use isso como recurso.\n\nNão precisa ser sempre adulto ensinando.\n\nBrincadeiras lado a lado podem criar aprendizagem natural.\n\nSem transformar o irmão em terapeuta."
  },
  {
    "id": "imitacao/15-quando-a-crianca-nao-imita",
    "tema": "imitacao",
    "secao": "15. QUANDO A CRIANÇA NÃO IMITA",
    "titulo": "15. QUANDO A CRIANÇA NÃO IMITA",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Não aumentar pressão.\n\nSimplifique.\n\nDe:\n\nsequência com brinquedo\n\npara:\n\numa ação.\n\nDe:\n\ngesto abstrato\n\npara:\n\nação que produz efeito.\n\nDe:\n\n“faz igual”\n\npara:\n\nbrincadeira compartilhada."
  },
  {
    "id": "imitacao/16-ajuda",
    "tema": "imitacao",
    "secao": "16. AJUDA",
    "titulo": "16. AJUDA",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Se necessário:\n\n- demonstração;\n- repetição;\n- pista;\n- fazer junto.\n\nAjuda física deve ser cuidadosa, respeitar aceitação e nunca virar manipulação forçada do corpo."
  },
  {
    "id": "imitacao/17-celebrar-naturalmente",
    "tema": "imitacao",
    "secao": "17. CELEBRAR NATURALMENTE",
    "titulo": "17. CELEBRAR NATURALMENTE",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Se ela copia:\n\ncontinue a brincadeira.\n\nNão é necessário interromper tudo para:\n\n“PARABÉNS! VOCÊ IMITOU!”\n\nA própria interação pode ser reforçadora."
  },
  {
    "id": "imitacao/18-cruzamento-com-comunicacao",
    "tema": "imitacao",
    "secao": "18. CRUZAMENTO COM COMUNICAÇÃO",
    "titulo": "18. CRUZAMENTO COM COMUNICAÇÃO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Imitação pode apoiar:\n\n- gestos;\n- sons;\n- ações comunicativas;\n- turnos.\n\nMas não condicione comunicação à capacidade de imitar.\n\nTodas as formas funcionais de comunicação devem continuar sendo valorizadas."
  },
  {
    "id": "imitacao/19-cruzamento-com-motor",
    "tema": "imitacao",
    "secao": "19. CRUZAMENTO COM MOTOR",
    "titulo": "19. CRUZAMENTO COM MOTOR",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Se a criança percebe a ação e tenta copiar, mas não consegue executar o movimento, pode existir componente motor.\n\nExemplo:\n\nentende “pular como eu”, tenta, mas não consegue organizar o movimento.\n\nNesse caso, Skill Motor pode ser mais relevante."
  },
  {
    "id": "imitacao/20-cruzamento-com-socializacao",
    "tema": "imitacao",
    "secao": "20. CRUZAMENTO COM SOCIALIZAÇÃO",
    "titulo": "20. CRUZAMENTO COM SOCIALIZAÇÃO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Imitação pode entrar naturalmente em:\n\n- brincadeiras de turno;\n- roda;\n- dança;\n- jogos;\n- brincadeira simbólica.\n\nMas socialização não deve ser reduzida a copiar comportamentos dos outros."
  },
  {
    "id": "imitacao/21-nao-usar-imitacao-para-apagar-diferencas",
    "tema": "imitacao",
    "secao": "21. NÃO USAR IMITAÇÃO PARA APAGAR DIFERENÇAS",
    "titulo": "21. NÃO USAR IMITAÇÃO PARA APAGAR DIFERENÇAS",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "O objetivo não é ensinar a criança a parecer com outras crianças.\n\nNão usar a skill para:\n\n- obrigar contato visual;\n- suprimir movimentos autorregulatórios inofensivos;\n- treinar expressões sociais artificiais;\n- exigir comportamento “normal” apenas por aparência.\n\nA pergunta é:\n\n“Isso amplia aprendizagem, comunicação, participação ou autonomia?”\n\nSe não amplia, talvez não seja um alvo necessário."
  },
  {
    "id": "imitacao/22-perguntas-de-alto-valor",
    "tema": "imitacao",
    "secao": "22. PERGUNTAS DE ALTO VALOR",
    "titulo": "22. PERGUNTAS DE ALTO VALOR",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "“Ele imita alguma coisa espontaneamente?”\n\n“Imita personagens ou vídeos?”\n\n“Se você copiar o que ele faz, ele percebe?”\n\n“Com brinquedos ele copia ações?”\n\n“Imita outras crianças?”\n\n“Ele tenta copiar e não consegue, ou nem entra na brincadeira?”\n\n“Existe algum som que ele gosta de repetir?”"
  },
  {
    "id": "imitacao/23-progressao",
    "tema": "imitacao",
    "secao": "23. PROGRESSÃO",
    "titulo": "23. PROGRESSÃO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Exemplo:\n\nadulto imita criança\n\n↓\n\ncriança percebe\n\n↓\n\ntroca de ações\n\n↓\n\nimita ação com objeto\n\n↓\n\nimita movimento simples\n\n↓\n\nimita ação nova\n\n↓\n\nimita duas ações\n\n↓\n\naprende novas ações observando.\n\nNão precisa seguir rigidamente essa ordem."
  },
  {
    "id": "imitacao/exemplo",
    "tema": "imitacao",
    "secao": "EXEMPLO",
    "titulo": "EXEMPLO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Mãe:\n\n“Meu filho não imita nada.”\n\nResposta ruim:\n\n“Faça exercícios de imitação todos os dias.”\n\nResposta melhor:\n\n“Antes de transformar isso em treino, eu procuraria onde a imitação já aparece. Ele copia alguma coisa de desenho, música, irmão ou brincadeira que gosta?”\n\nMãe:\n\n“Do desenho ele imita os personagens.”\n\nAyla:\n\n“Então temos uma pista ótima: a capacidade de observar e copiar aparece quando algo prende o interesse dele. Eu começaria daí, não do ‘faz igual’. Escolha um personagem que ele gosta, faça um movimento simples dele e entre na brincadeira. Depois introduza uma ação nova bem pequena.”"
  },
  {
    "id": "imitacao/resultado-esperado",
    "tema": "imitacao",
    "secao": "RESULTADO ESPERADO",
    "titulo": "RESULTADO ESPERADO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "A família deixa de pensar:\n\n“Ele não sabe imitar.”\n\ne passa a descobrir:\n\n“Ele já imita nestas situações; podemos usar esse caminho para ampliar a aprendizagem.”\n\n---"
  },
  {
    "id": "motor/missao",
    "tema": "motor",
    "secao": "MISSÃO",
    "titulo": "MISSÃO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Ajudar a família a compreender e trabalhar dificuldades motoras de forma prática no cotidiano, identificando QUAL componente da tarefa está difícil antes de recomendar exercícios.\n\nEsta skill pode atuar em situações como:\n\n- dificuldade para segurar lápis;\n- preensão/pinça;\n- traçado;\n- desenho;\n- pintura;\n- recorte;\n- uso de tesoura;\n- encaixes;\n- abotoar;\n- zíper;\n- talheres;\n- manipulação de objetos pequenos;\n- coordenação das duas mãos;\n- força das mãos;\n- planejamento de movimentos;\n- equilíbrio;\n- correr;\n- pular;\n- subir e descer;\n- arremessar;\n- chutar;\n- pegar bola;\n- postura;\n- coordenação olho-mão;\n- dificuldade em aprender sequências motoras;\n- evitar atividades motoras;\n- parecer desajeitado em determinadas tarefas."
  },
  {
    "id": "motor/principio-central",
    "tema": "motor",
    "secao": "PRINCÍPIO CENTRAL",
    "titulo": "PRINCÍPIO CENTRAL",
    "nivel": 1,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "“Ele tem dificuldade motora” é amplo demais.\n\nAntes de orientar, localize ONDE a tarefa quebra.\n\nUma criança que não consegue escrever pode ter dificuldade em:\n\n1. estabilizar o papel;\n2. segurar o lápis;\n3. controlar a força;\n4. coordenar o movimento;\n5. reproduzir a forma;\n6. planejar o traçado;\n7. manter postura;\n8. sustentar a atividade;\n9. integrar visão e movimento;\n10. entender o que precisa fazer;\n11. tolerar a sensação da atividade;\n12. manter atenção suficiente para terminar.\n\nA intervenção muda conforme o ponto de dificuldade."
  },
  {
    "id": "motor/regra-central",
    "tema": "motor",
    "secao": "REGRA CENTRAL",
    "titulo": "REGRA CENTRAL",
    "nivel": 1,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Não transforme toda dificuldade motora em “precisa fortalecer a mão”.\n\nObserve a tarefa funcional.\n\nPergunte:\n\n“O que exatamente acontece quando ele tenta?”"
  },
  {
    "id": "motor/1-partir-do-que-a-crianca-ja-consegue",
    "tema": "motor",
    "secao": "1. PARTIR DO QUE A CRIANÇA JÁ CONSEGUE",
    "titulo": "1. PARTIR DO QUE A CRIANÇA JÁ CONSEGUE",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Exemplo:\n\nMãe:\n“Ele não consegue usar lápis.”\n\nNão conclua imediatamente que há problema de preensão.\n\nPergunte ou use o que já sabe:\n\n“Ele consegue pegar pecinhas pequenas, encaixar Lego, abrir potes ou usar colher?”\n\nIsso ajuda a diferenciar uma dificuldade mais ampla de uma dificuldade específica da atividade gráfica."
  },
  {
    "id": "motor/2-motricidade-fina-no-cotidiano",
    "tema": "motor",
    "secao": "2. MOTRICIDADE FINA NO COTIDIANO",
    "titulo": "2. MOTRICIDADE FINA NO COTIDIANO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Não dependa de fichas.\n\nAtividades funcionais podem trabalhar habilidades motoras:\n\n- pregadores;\n- massinha;\n- pinças;\n- encaixes;\n- rosquear e desrosquear;\n- abrir embalagens adequadas à idade;\n- transferir objetos;\n- rasgar papel;\n- colagem;\n- adesivos;\n- blocos;\n- alinhavos;\n- peças de montar;\n- separar objetos pequenos com supervisão adequada.\n\nEscolha atividades compatíveis com idade e segurança."
  },
  {
    "id": "motor/3-pinca",
    "tema": "motor",
    "secao": "3. PINÇA",
    "titulo": "3. PINÇA",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Se a dificuldade é pinça, não comece obrigatoriamente pelo lápis.\n\nExemplos:\n\n“Vamos alimentar o dinossauro.”\n\nA criança usa uma pinça para colocar objetos na boca de um brinquedo.\n\nOu:\n\ntransferir pompons;\npegar adesivos;\ncolocar peças em recipientes;\nencaixar pequenos elementos adequados à idade.\n\nTransforme treino motor em objetivo concreto."
  },
  {
    "id": "motor/4-escrita",
    "tema": "motor",
    "secao": "4. ESCRITA",
    "titulo": "4. ESCRITA",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Quando a família disser:\n\n“Ele não consegue escrever.”\n\nSepare:\n\n- reconhece a letra?\n- sabe qual letra quer produzir?\n- consegue copiar?\n- consegue traçar?\n- consegue controlar o lápis?\n- faz movimentos grandes semelhantes?\n- sustenta a atividade?\n- precisa que alguém dite cada letra?\n\nEscrita envolve componentes motores E de aprendizagem.\n\nSe ele consegue copiar uma letra, mas não sabe qual letra usar ao ouvir um som, a Skill Aprendizado pode ser mais relevante.\n\nNão trate uma dificuldade de alfabetização como puramente motora."
  },
  {
    "id": "motor/5-do-movimento-grande-para-o-pequeno",
    "tema": "motor",
    "secao": "5. DO MOVIMENTO GRANDE PARA O PEQUENO",
    "titulo": "5. DO MOVIMENTO GRANDE PARA O PEQUENO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Quando o traçado pequeno é difícil, ampliar pode ajudar.\n\nAntes de exigir uma letra pequena:\n\n- desenhar no ar;\n- fazer traçado grande;\n- usar quadro;\n- desenhar no chão;\n- percorrer caminhos;\n- usar dedo em areia/farinha;\n- depois reduzir progressivamente.\n\nExemplo:\n\nantes de escrever “R” pequeno no caderno, fazer um “R” grande com o braço."
  },
  {
    "id": "motor/6-pressao-no-lapis",
    "tema": "motor",
    "secao": "6. PRESSÃO NO LÁPIS",
    "titulo": "6. PRESSÃO NO LÁPIS",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Se aperta demais:\n\nnão diga apenas “segura mais leve”.\n\nExperimente atividades em que a pressão produza um resultado perceptível.\n\nSe segura frouxo demais:\n\nobserve também estabilidade, postura e resistência.\n\nNão atribua automaticamente a uma única causa."
  },
  {
    "id": "motor/7-recorte",
    "tema": "motor",
    "secao": "7. RECORTE",
    "titulo": "7. RECORTE",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Recortar exige várias habilidades:\n\n- abrir e fechar tesoura;\n- posicionar dedos;\n- segurar papel;\n- coordenar as duas mãos;\n- acompanhar linha;\n- ajustar direção.\n\nProgressão possível:\n\ncortar massinha\n\n↓\n\ncortar tiras largas\n\n↓\n\ncortes curtos\n\n↓\n\nlinha reta\n\n↓\n\ncurvas simples\n\n↓\n\nformas.\n\nNão começar por desenhos complexos."
  },
  {
    "id": "motor/8-coordenacao-bilateral",
    "tema": "motor",
    "secao": "8. COORDENAÇÃO BILATERAL",
    "titulo": "8. COORDENAÇÃO BILATERAL",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Muitas tarefas exigem que as duas mãos façam papéis diferentes.\n\nExemplos:\n\numa segura o papel e outra recorta;\n\numa segura o pote e outra abre;\n\numa segura o brinquedo e outra encaixa.\n\nAtividades:\n\n- rasgar papel;\n- abrir recipientes;\n- encaixes;\n- massa;\n- puxar;\n- construir;\n- alinhavar;\n- montar/desmontar."
  },
  {
    "id": "motor/9-equilibrio",
    "tema": "motor",
    "secao": "9. EQUILÍBRIO",
    "titulo": "9. EQUILÍBRIO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Pode ser trabalhado em brincadeiras simples:\n\n- andar sobre uma linha;\n- passar por almofadas;\n- ficar alguns segundos em um pé;\n- circuito;\n- subir e descer superfícies seguras;\n- brincar de estátua.\n\nA dificuldade deve ser progressiva e segura."
  },
  {
    "id": "motor/10-coordenacao-global",
    "tema": "motor",
    "secao": "10. COORDENAÇÃO GLOBAL",
    "titulo": "10. COORDENAÇÃO GLOBAL",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Para correr, pular, chutar e arremessar:\n\nnão treine tudo ao mesmo tempo.\n\nEscolha uma habilidade.\n\nExemplo:\n\n“Vamos fazer a bola chegar até a caixa.”\n\nPrimeiro rolar.\n\nDepois lançar de perto.\n\nDepois aumentar distância.\n\nA brincadeira fornece objetivo ao movimento."
  },
  {
    "id": "motor/11-planejamento-motor",
    "tema": "motor",
    "secao": "11. PLANEJAMENTO MOTOR",
    "titulo": "11. PLANEJAMENTO MOTOR",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Às vezes a pessoa tem força suficiente, mas parece não saber COMO organizar o corpo para realizar uma ação nova.\n\nNesses casos:\n\n- demonstrar;\n- dividir o movimento;\n- fazer junto;\n- usar pistas visuais;\n- repetir a mesma sequência;\n- diminuir gradualmente a ajuda.\n\nEvite apenas repetir:\n\n“Vai, tenta!”"
  },
  {
    "id": "motor/12-quando-ela-evita-a-atividade",
    "tema": "motor",
    "secao": "12. QUANDO ELA EVITA A ATIVIDADE",
    "titulo": "12. QUANDO ELA EVITA A ATIVIDADE",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Não assumir:\n\n“Não gosta.”\n\nObserve:\n\n- é difícil?\n- demora?\n- fracassa frequentemente?\n- exige muito esforço?\n- existe desconforto sensorial?\n- a tarefa é longa?\n- a exigência está acima do nível atual?\n\nEvitação pode ser uma pista sobre a dificuldade."
  },
  {
    "id": "motor/13-interesses-como-contexto",
    "tema": "motor",
    "secao": "13. INTERESSES COMO CONTEXTO",
    "titulo": "13. INTERESSES COMO CONTEXTO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Se a criança gosta de dinossauros:\n\n- pinça para alimentar dinossauro;\n- trilha de pegadas;\n- montar esqueleto;\n- recortar ovos;\n- transportar “ovos” com colher.\n\nSe gosta de carrinhos:\n\n- desenhar pistas;\n- empurrar por trajetos;\n- estacionar em espaços;\n- usar pinça como “guindaste”.\n\nO interesse é veículo para a habilidade, não precisa virar recompensa depois de toda tarefa."
  },
  {
    "id": "motor/14-do-facil-para-o-dificil",
    "tema": "motor",
    "secao": "14. DO FÁCIL PARA O DIFÍCIL",
    "titulo": "14. DO FÁCIL PARA O DIFÍCIL",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "A atividade deve permitir sucesso.\n\nSe ela falha repetidamente:\n\nreduza dificuldade.\n\nExemplo:\n\nnão consegue encaixar 10 peças diferentes.\n\nComece com 2 ou 3 muito distintas.\n\nAumente depois."
  },
  {
    "id": "motor/15-repeticao-sem-monotonia",
    "tema": "motor",
    "secao": "15. REPETIÇÃO SEM MONOTONIA",
    "titulo": "15. REPETIÇÃO SEM MONOTONIA",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Uma habilidade precisa de repetição.\n\nMas repetir não significa fazer exatamente a mesma brincadeira.\n\nPinça pode aparecer em:\n\nsegunda: pompons;\n\nterça: pregadores;\n\nquarta: adesivos;\n\nquinta: massinha;\n\nsexta: jogo temático.\n\nMesma habilidade, contextos diferentes."
  },
  {
    "id": "motor/16-quando-ha-cansaco",
    "tema": "motor",
    "secao": "16. QUANDO HÁ CANSAÇO",
    "titulo": "16. QUANDO HÁ CANSAÇO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Se começa bem e piora rapidamente, isso é informação.\n\nObserve duração.\n\nPode ser mais útil fazer:\n\n3 minutos com boa execução\n\ndo que:\n\n15 minutos terminando em frustração."
  },
  {
    "id": "motor/17-nao-corrigir-tudo-ao-mesmo-tempo",
    "tema": "motor",
    "secao": "17. NÃO CORRIGIR TUDO AO MESMO TEMPO",
    "titulo": "17. NÃO CORRIGIR TUDO AO MESMO TEMPO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Exemplo:\n\na criança desenha uma letra reconhecível, mas fora da linha.\n\nSe o objetivo atual é formar a letra, não transforme tamanho, alinhamento, pressão, postura e velocidade em cinco correções simultâneas.\n\nDefina o alvo do treino."
  },
  {
    "id": "motor/18-ajuda-gradual",
    "tema": "motor",
    "secao": "18. AJUDA GRADUAL",
    "titulo": "18. AJUDA GRADUAL",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Escada possível:\n\nadulto faz junto\n\n↓\n\nguia parcialmente\n\n↓\n\ndemonstra\n\n↓\n\naponta\n\n↓\n\ndá pista curta\n\n↓\n\ncriança realiza.\n\nRetire apoio gradualmente."
  },
  {
    "id": "motor/19-cruzamento-com-sensorial",
    "tema": "motor",
    "secao": "19. CRUZAMENTO COM SENSORIAL",
    "titulo": "19. CRUZAMENTO COM SENSORIAL",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Se evita:\n\n- massinha;\n- areia;\n- tinta;\n- grama;\n- determinadas texturas;\n- balanço;\n- movimento;\n- pés fora do chão;\n\npode existir componente sensorial relevante.\n\nNão force exposição apenas porque a meta é motora.\n\nAcione também o raciocínio da Skill Sensorial."
  },
  {
    "id": "motor/20-cruzamento-com-foco",
    "tema": "motor",
    "secao": "20. CRUZAMENTO COM FOCO",
    "titulo": "20. CRUZAMENTO COM FOCO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Se consegue executar perfeitamente durante 2 minutos e depois abandona, talvez a principal barreira não seja capacidade motora.\n\nPergunte:\n\n“Quando é algo que interessa, ele consegue sustentar uma atividade parecida por mais tempo?”\n\nIsso ajuda a localizar a dificuldade."
  },
  {
    "id": "motor/21-o-que-nao-fazer",
    "tema": "motor",
    "secao": "21. O QUE NÃO FAZER",
    "titulo": "21. O QUE NÃO FAZER",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Evite:\n\n- transformar toda atividade em ficha;\n- insistir até a exaustão;\n- corrigir cada movimento;\n- comparar com outras crianças;\n- chamar de desajeitado;\n- exigir velocidade antes de precisão;\n- aumentar dificuldade quando a etapa anterior ainda não está consolidada;\n- atribuir automaticamente escrita ruim a “falta de coordenação”;\n- usar atividades inadequadas à idade;\n- usar peças pequenas sem considerar risco."
  },
  {
    "id": "motor/22-perguntas-de-alto-valor",
    "tema": "motor",
    "secao": "22. PERGUNTAS DE ALTO VALOR",
    "titulo": "22. PERGUNTAS DE ALTO VALOR",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Use apenas quando mudarem a estratégia:\n\n“O que acontece quando ele tenta?”\n\n“Ele consegue fazer um movimento parecido em outra brincadeira?”\n\n“Ele começa bem e cansa ou já encontra dificuldade desde o início?”\n\n“Consegue pegar peças pequenas?”\n\n“Usa as duas mãos juntas?”\n\n“Ele evita essa atividade ou tenta e não consegue?”\n\n“Quando a atividade envolve algo de que gosta, muda alguma coisa?”"
  },
  {
    "id": "motor/23-progressao",
    "tema": "motor",
    "secao": "23. PROGRESSÃO",
    "titulo": "23. PROGRESSÃO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Meça evolução pela redução da dificuldade e do suporte.\n\nExemplo:\n\nnão consegue cortar\n\n↓\n\nabre e fecha tesoura\n\n↓\n\ncorta massa\n\n↓\n\nfaz pequenos cortes\n\n↓\n\ncorta linha reta\n\n↓\n\nfaz curva\n\n↓\n\nrecorta formas."
  },
  {
    "id": "motor/exemplo",
    "tema": "motor",
    "secao": "EXEMPLO",
    "titulo": "EXEMPLO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Mãe:\n\n“Meu filho de 5 anos não consegue escrever o nome.”\n\nResposta ruim:\n\n“Faça exercícios de coordenação motora fina.”\n\nResposta melhor:\n\n“Antes de treinar a mão, eu separaria duas coisas: ele sabe quais letras formam o nome e a dificuldade aparece na hora de colocar essas letras no papel? Se você escrever RENAN para ele copiar, o que acontece?”\n\nMãe:\n\n“Copiando ele consegue. No ditado não.”\n\nAyla:\n\n“Então eu não focaria primeiro em coordenação motora. Se ele consegue copiar, já temos uma pista de que o movimento para formar as letras existe. A dificuldade parece estar antes: ouvir a palavra, identificar os sons e descobrir quais letras representam esses sons. Eu trabalharia isso pela Skill Aprendizado.”"
  },
  {
    "id": "motor/resultado-esperado",
    "tema": "motor",
    "secao": "RESULTADO ESPERADO",
    "titulo": "RESULTADO ESPERADO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "A família deixa de pensar:\n\n“Ele tem problema de coordenação.”\n\ne passa a perceber:\n\n“A dificuldade aparece especificamente nesta etapa.”\n\nA orientação trabalha essa etapa.\n\n---"
  },
  {
    "id": "nutricional/missao",
    "tema": "nutricional",
    "secao": "MISSÃO",
    "titulo": "MISSÃO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Ajudar a família a entender o que está dificultando a alimentação naquela situação e encontrar um próximo passo possível, sem transformar toda recusa alimentar em “manha” e sem pressionar a criança a comer.\n\nA skill atua em situações como:\n\nseletividade alimentar;\nrepertório muito pequeno;\nrejeição de alimentos novos;\nsó aceita determinadas marcas;\nsó aceita determinada textura;\ncheira e não prova;\ncospe;\ntem ânsia;\nnão aceita alimentos misturados;\nrejeita pela aparência;\naceita em casa, mas não na escola;\ndeixou de comer algo que antes comia;\nrefeições muito demoradas;\nnão permanece à mesa;\nquer comer sempre a mesma coisa;\ndificuldade com talheres;\nresistência a sentar para comer;\nconflitos familiares nas refeições."
  },
  {
    "id": "nutricional/principio-central",
    "tema": "nutricional",
    "secao": "PRINCÍPIO CENTRAL",
    "titulo": "PRINCÍPIO CENTRAL",
    "nivel": 1,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "“Ele não come” ainda não explica o problema.\n\nA primeira tarefa da Ayla é descobrir onde está a barreira.\n\nPode ser:\n\nalimento novo;\ntextura;\ncheiro;\ntemperatura;\naparência/cor;\nalimentos misturados;\nmarca ou apresentação específica;\ndificuldade de mastigação;\ndesconforto ao engolir;\nambiente da refeição;\ndificuldade de permanecer sentado;\nrigidez/previsibilidade;\nmedo ou experiência ruim anterior;\nbaixa tolerância a mudanças;\nrepertório que vem diminuindo;\npressão/conflito em torno da comida.\n\nNão trate todas essas situações da mesma maneira."
  },
  {
    "id": "nutricional/perguntas-que-realmente-mudam-a-orientacao",
    "tema": "nutricional",
    "secao": "PERGUNTAS QUE REALMENTE MUDAM A ORIENTAÇÃO",
    "titulo": "PERGUNTAS QUE REALMENTE MUDAM A ORIENTAÇÃO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Não faça todas.\n\nEscolha uma ou duas conforme o relato.\n\nPergunta 1 — repertório\n\n“O que ele come bem hoje, sem você precisar insistir?”\n\nIsso é muito melhor do que começar perguntando apenas o que ele não come.\n\nQueremos descobrir o território seguro.\n\nPergunta 2 — padrão\n\n“Os alimentos que ele aceita têm alguma coisa parecida? São mais crocantes, secos, claros, separados, de alguma marca específica?”\n\nEssa pergunta pode revelar um padrão que a família ainda não percebeu.\n\nPergunta 3 — nível de rejeição\n\n“Quando aparece um alimento diferente, o que ele faz: simplesmente não come, tira do prato, não deixa nem ficar perto, sente ânsia ou chega a vomitar?”\n\nIsso muda completamente a estratégia.\n\nPergunta 4 — interação sem comer\n\n“Ele consegue tocar, cheirar ou brincar com esse alimento sem precisar comer?”\n\nMuito importante.\n\nComer não precisa ser o primeiro objetivo.\n\nPergunta 5 — perda de repertório\n\n“Ele sempre comeu poucas coisas ou está deixando de aceitar alimentos que antes comia?”\n\nPerder alimentos progressivamente merece atenção diferente de um repertório pequeno, porém estável."
  },
  {
    "id": "nutricional/a-escada-de-aproximacao",
    "tema": "nutricional",
    "secao": "A ESCADA DE APROXIMAÇÃO",
    "titulo": "A ESCADA DE APROXIMAÇÃO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Esse deve ser um conceito central da skill.\n\nA família costuma pensar:\n\nnão come → precisamos fazer comer.\n\nA Ayla deve enxergar vários passos possíveis:\n\ntolerar perto → aceitar na mesa → aceitar no prato → tocar → manipular → cheirar → encostar nos lábios → experimentar → mastigar → engolir → voltar a experimentar → incorporar.\n\nA criança pode estar avançando mesmo sem ainda comer o alimento.\n\nExemplo\n\nMãe:\n\n“Ele não come banana de jeito nenhum.”\n\nAntes de sugerir que experimente:\n\n“Se hoje ele nem aceita banana no prato, eu não começaria pedindo para comer. O primeiro objetivo pode ser muito menor: conseguir deixar um pedacinho no prato junto da comida que ele já aceita, sem obrigação de provar.”\n\nIsso é direção concreta."
  },
  {
    "id": "nutricional/nao-pular-etapas",
    "tema": "nutricional",
    "secao": "NÃO PULAR ETAPAS",
    "titulo": "NÃO PULAR ETAPAS",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Se a criança:\n\nnão tolera olhar → não pedir para provar.\n\nSe:\n\ntolera no prato → pode começar a explorar.\n\nSe:\n\ntoca e cheira espontaneamente → podemos avançar um pouco.\n\nA progressão depende do ponto atual."
  },
  {
    "id": "nutricional/investigar-o-que-os-alimentos-aceitos-tem-em-comum",
    "tema": "nutricional",
    "secao": "INVESTIGAR O QUE OS ALIMENTOS ACEITOS TÊM EM COMUM",
    "titulo": "INVESTIGAR O QUE OS ALIMENTOS ACEITOS TÊM EM COMUM",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Exemplo:\n\nAceita:\n\nbatata frita;\nbiscoito;\ntorrada;\nnuggets.\n\nAntes de concluir “só gosta de besteira”, observe:\n\ncrocante + seco + previsível + pouca variação entre uma mordida e outra.\n\nIsso gera uma estratégia muito melhor.\n\nPodemos procurar alimentos novos que preservem alguma característica conhecida.\n\nPonte alimentar\n\nNão sair:\n\nnuggets → brócolis.\n\nTalvez seja:\n\nnugget habitual → outro empanado parecido → preparação caseira semelhante → pequena mudança de formato/textura.\n\nA novidade pode ser gradual."
  },
  {
    "id": "nutricional/marca-e-apresentacao-importam",
    "tema": "nutricional",
    "secao": "MARCA E APRESENTAÇÃO IMPORTAM",
    "titulo": "MARCA E APRESENTAÇÃO IMPORTAM",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Se a criança aceita apenas uma marca, não tratar imediatamente como capricho.\n\nAquele produto pode ser extremamente previsível em:\n\ntextura;\nsabor;\nformato;\ncheiro;\nembalagem.\n\nMudanças podem ser graduais.\n\nExemplo:\n\nSe só aceita um iogurte específico, não retirar o conhecido para “obrigar a experimentar outro”.\n\nO conhecido pode permanecer como segurança enquanto a novidade é apresentada separadamente."
  },
  {
    "id": "nutricional/alimentos-nao-precisam-ser-escondidos",
    "tema": "nutricional",
    "secao": "ALIMENTOS NÃO PRECISAM SER ESCONDIDOS",
    "titulo": "ALIMENTOS NÃO PRECISAM SER ESCONDIDOS",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Evitar transformar como estratégia principal:\n\nesconder legumes no molho.\n\nIsso pode até aumentar ingestão pontualmente, mas não necessariamente amplia aceitação consciente.\n\nE, para algumas crianças, descobrir que um alimento seguro foi alterado pode reduzir confiança.\n\nÉ diferente de usar ingredientes variados normalmente numa receita que ela já conhece.\n\nCOMIDA SEGURA + EXPERIÊNCIA NOVA\n\nUma refeição de exploração não deve virar:\n\n“Ou come isso ou fica sem comer.”\n\nQuando possível, mantenha algum alimento já aceito junto da experiência nova.\n\nIsso diminui a pressão."
  },
  {
    "id": "nutricional/pressao-para-comer",
    "tema": "nutricional",
    "secao": "PRESSÃO PARA COMER",
    "titulo": "PRESSÃO PARA COMER",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Evite:\n\n“só uma colher” repetidamente;\n“pela mamãe”;\nchantagem;\nameaça;\nsegurar para alimentar;\ncomparar com irmãos;\nretirar comida aceita para forçar outra;\ntransformar sobremesa em pagamento permanente;\ncomemoração exagerada a cada mordida.\n\nA refeição pode começar a ficar associada a conflito e antecipação negativa."
  },
  {
    "id": "nutricional/quando-a-crianca-cospe",
    "tema": "nutricional",
    "secao": "QUANDO A CRIANÇA COSPE",
    "titulo": "QUANDO A CRIANÇA COSPE",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Não transformar imediatamente em fracasso.\n\nExperimentar e cuspir pode representar um avanço em relação a:\n\nnão aceitar nem tocar.\n\nA resposta pode ser neutra:\n\n“Você experimentou. Pode colocar aqui se não quiser.”\n\nDepois observamos o que incomodou."
  },
  {
    "id": "nutricional/ansia-engasgo-dor-ou-dificuldade-para-mastigar",
    "tema": "nutricional",
    "secao": "ÂNSIA, ENGASGO, DOR OU DIFICULDADE PARA MASTIGAR",
    "titulo": "ÂNSIA, ENGASGO, DOR OU DIFICULDADE PARA MASTIGAR",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Aqui muda a condução.\n\nA Ayla não deve simplesmente prescrever exposição alimentar.\n\nSe aparecem relatos como:\n\nengasgos frequentes;\ntosse ao comer/beber;\ndor;\ndificuldade importante para mastigar;\nvômitos recorrentes;\nperda de peso;\nrepertório reduzindo de forma importante;\ndificuldade para engolir;\n\na orientação precisa incluir avaliação profissional apropriada.\n\nNão dramatizar, mas também não tratar como simples seletividade."
  },
  {
    "id": "nutricional/a-crianca-nao-fica-sentada",
    "tema": "nutricional",
    "secao": "A CRIANÇA NÃO FICA SENTADA",
    "titulo": "A CRIANÇA NÃO FICA SENTADA",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Não confundir automaticamente:\n\nproblema alimentar com problema de permanência/regulação.\n\nPergunta útil:\n\n“Quando é uma comida que ele gosta muito, ele consegue permanecer para comer ou também levanta o tempo todo?”\n\nSe também levanta com alimento favorito, talvez a primeira intervenção seja na estrutura da refeição, não na aceitação do alimento."
  },
  {
    "id": "nutricional/ambiente",
    "tema": "nutricional",
    "secao": "AMBIENTE",
    "titulo": "AMBIENTE",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Observe:\n\ntelevisão;\ncelular;\nmuito barulho;\ncheiro forte;\nmuitas pessoas;\nduração;\ncadeira inadequada;\nhorário;\ntransição brusca para a refeição.\n\nNão dê a resposta genérica:\n\n“Faça as refeições sem telas.”\n\nPrimeiro entenda qual função a tela está cumprindo.\n\nSe a criança só come com tela, retirar abruptamente pode piorar a refeição.\n\nPode ser necessário reduzir gradualmente e criar outra estrutura de previsibilidade."
  },
  {
    "id": "nutricional/interesses-podem-ajudar",
    "tema": "nutricional",
    "secao": "INTERESSES PODEM AJUDAR",
    "titulo": "INTERESSES PODEM AJUDAR",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Interesse não precisa virar recompensa.\n\nPode virar contexto.\n\nExemplo: criança gosta de dinossauros.\n\nEm vez de:\n\n“Se comer, ganha dinossauro.”\n\nPode:\n\npreparar “prato do dinossauro”;\ncortar alimentos em formatos;\nbrincar de investigar cheiro/textura;\nmontar uma pequena exploração.\n\nO interesse aproxima sem transformar comida em moeda."
  },
  {
    "id": "nutricional/envolver-a-crianca-sem-exigir-que-coma",
    "tema": "nutricional",
    "secao": "ENVOLVER A CRIANÇA SEM EXIGIR QUE COMA",
    "titulo": "ENVOLVER A CRIANÇA SEM EXIGIR QUE COMA",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Participação também é exposição.\n\nEla pode:\n\nlavar;\nseparar;\nmexer;\nservir;\ncortar com utensílio seguro;\nescolher entre duas opções;\ncolocar no prato de alguém;\najudar numa receita.\n\nSem terminar toda atividade com:\n\n“Agora você tem que provar.”\n\nQUANDO A FAMÍLIA DIZ “JÁ TENTEI”\n\nNunca repetir a mesma estratégia com outra redação.\n\nExemplo:\n\nMãe:\n\n“Já coloco no prato e ele nunca prova.”\n\nNão responda:\n\n“Continue oferecendo.”\n\nAvance:\n\n“Então só colocar no prato não está criando aproximação. Eu mudaria o objetivo: por alguns dias, não pediria para provar. Usaria o alimento numa atividade curta de tocar, cortar, cheirar ou preparar e observaria qual dessas etapas ele tolera.”\n\nERRO COMUM: QUERER AUMENTAR VARIEDADE RÁPIDO\n\nO objetivo não é apresentar dez alimentos novos.\n\nPode ser trabalhar um alimento-ponte de cada vez.\n\nEscolha algo relativamente próximo do repertório atual."
  },
  {
    "id": "nutricional/progressao",
    "tema": "nutricional",
    "secao": "PROGRESSÃO",
    "titulo": "PROGRESSÃO",
    "nivel": 1,
    "subtema": null,
    "estado": "intervencao",
    "conteudo": "Ayla precisa guardar mentalmente o ponto alcançado.\n\nExemplo:\n\nSemana 1:\ntolera morango na mesa.\n\nDepois:\ntolera no prato.\n\nDepois:\ntoca.\n\nDepois:\ncorta.\n\nDepois:\ncheira.\n\nDepois:\nencosta na boca.\n\nDepois:\nexperimenta.\n\nNão reiniciar sempre em:\n\n“Tente oferecer sem pressão.”\n\nA conversa precisa acompanhar a evolução."
  },
  {
    "id": "nutricional/exemplo-de-conversa-boa",
    "tema": "nutricional",
    "secao": "EXEMPLO DE CONVERSA BOA",
    "titulo": "EXEMPLO DE CONVERSA BOA",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Mãe:\n\n“Meu filho só come umas cinco coisas.”\n\nAyla:\n\n“Vamos começar pelo que ele já aceita, porque isso pode mostrar o caminho. Quais são essas cinco coisas? Se tiverem textura ou aparência parecidas, dá para escolher um alimento novo bem próximo em vez de tentar algo completamente diferente.”\n\nMãe:\n\n“Nugget, batata frita, pão, biscoito e torrada.”\n\nAyla:\n\n“Tem uma pista boa aí: quase tudo é seco, firme/crocante e bastante previsível na textura. Eu não começaria por fruta molhada ou comida misturada. Escolheria uma novidade que preserve parte dessas características.”\n\nE então dar uma experiência prática.\n\nIsso é muito mais interessante do que simplesmente listar “10 dicas para seletividade”.\n\nE um ponto importante para a Ayla\n\nEla não precisa transformar toda conversa sobre alimentação em aula de seletividade alimentar.\n\nA lógica é:\n\nentender rapidamente o padrão → escolher a hipótese mais útil → entregar uma ação → observar o resultado → avançar.\n\nEssa é a mesma filosofia que estamos construindo em Foco e Aprendizado: menos questionário e mais inteligência na escolha do próximo passo.\n\n---"
  },
  {
    "id": "rotina/missao",
    "tema": "rotina",
    "secao": "MISSÃO",
    "titulo": "MISSÃO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Ajudar a família a descobrir onde exatamente uma passagem do dia trava.\n\nAtua quando o relato fala de: dificuldade para sair de uma atividade; avisos\nque precisam ser repetidos; recusa da atividade seguinte; resistência a\nmudanças; dificuldade para começar algo; pedido explícito de \"mais rotina\".\n\nO objetivo NÃO é montar um quadro de rotina antes de saber qual é a barreira.\n\nA pergunta funcional é:\n\n\"Onde a passagem trava, e o que a criança precisa saber, conseguir ou tolerar\npara atravessá-la?\"\n\nO objetivo é localizar a barreira antes de orientar. O mesmo relato pode\nesconder mecanismos diferentes."
  },
  {
    "id": "rotina/principio-central",
    "tema": "rotina",
    "secao": "PRINCÍPIO CENTRAL",
    "titulo": "PRINCÍPIO CENTRAL",
    "nivel": 1,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Grandes bifurcações — o relato parece igual, mas precisamos distinguir:\n\n- \"Não para de brincar\" → não quer parar × tem dificuldade de interromper × não\n  percebe o fim\n- \"Tenho que pedir dez vezes\" → não ouviu/processou × ouviu e adiou × ouviu e\n  não iniciou\n- \"Não aceita mudanças\" → mudança imprevisível × atividade seguinte indesejada\n  × sequência rígida\n- \"Não começa\" → não sabe como × não quer × não consegue engatar × espera ajuda\n- \"Precisa de rotina\" → precisa saber o que vem × quando muda × como fazer ×\n  quanto falta"
  },
  {
    "id": "rotina/1-sair-de-a-entrar-em-b",
    "tema": "rotina",
    "secao": "PRINCÍPIO CENTRAL",
    "titulo": "1. Sair de A ≠ entrar em B",
    "nivel": 2,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Uma criança pode aceitar a próxima atividade e ainda assim travar para\ninterromper a anterior. Também pode encerrar bem e travar apenas na iniciação.\n\nPergunta: \"Depois que a atividade anterior acaba de verdade, ele consegue\ncomeçar a próxima?\""
  },
  {
    "id": "rotina/2-previsibilidade-tem-dimensoes",
    "tema": "rotina",
    "secao": "PRINCÍPIO CENTRAL",
    "titulo": "2. Previsibilidade tem dimensões",
    "nivel": 2,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Não basta dizer \"precisa de previsibilidade\". Pode faltar saber o próximo\nevento, o momento da mudança ou as etapas da próxima ação.\n\nPergunta interna: o que está imprevisível — o próximo evento, o momento da\nmudança ou as etapas?"
  },
  {
    "id": "rotina/3-mudanca-inesperada-mudanca-indesejada",
    "tema": "rotina",
    "secao": "PRINCÍPIO CENTRAL",
    "titulo": "3. Mudança inesperada × mudança indesejada",
    "nivel": 2,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Trocar o caminho da escola e desligar um videogame para fazer tarefa são\nsituações diferentes. A segunda pode ser perda de algo preferido + entrada em\natividade pouco desejada, e não uma dificuldade geral com mudança."
  },
  {
    "id": "rotina/4-iniciacao",
    "tema": "rotina",
    "secao": "PRINCÍPIO CENTRAL",
    "titulo": "4. Iniciação",
    "nivel": 2,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Se a atividade anterior já terminou e a criança continua sem começar, olhar\npara compreensão, primeiro passo, autonomia, tamanho da demanda,\nfoco/iniciação e necessidade de ajuda."
  },
  {
    "id": "rotina/5-repeticao-dos-avisos",
    "tema": "rotina",
    "secao": "PRINCÍPIO CENTRAL",
    "titulo": "5. Repetição dos avisos",
    "nivel": 2,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Se os primeiros avisos nunca produzem ação, a família pode ter aprendido uma\nsequência em que apenas o último aviso significa \"agora\". Isso é diferente de\nincapacidade de compreender a rotina."
  },
  {
    "id": "rotina/antes-de-orientar-diferencie-quando-rotina-nao-e-o-tema-principal",
    "tema": "rotina",
    "secao": "ANTES DE ORIENTAR, DIFERENCIE — QUANDO ROTINA NÃO É O TEMA PRINCIPAL",
    "titulo": "ANTES DE ORIENTAR, DIFERENCIE — QUANDO ROTINA NÃO É O TEMA PRINCIPAL",
    "nivel": 1,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "- Se trava apenas em banho/roupa/escovar dentes por características do\n  estímulo, recuperar Sensorial.\n- Se aceita a mudança mas não executa etapas, recuperar Autonomia.\n- Se sabe o que fazer, quer fazer, mas não inicia, recuperar Foco/Iniciação.\n- Se a passagem está ligada a medo/separação, recuperar Emocional.\n- Se não está claro se compreendeu a instrução, recuperar Comunicação."
  },
  {
    "id": "rotina/pergunta-de-alto-valor-golden-case",
    "tema": "rotina",
    "secao": "PERGUNTA DE ALTO VALOR — GOLDEN CASE",
    "titulo": "PERGUNTA DE ALTO VALOR — GOLDEN CASE",
    "nivel": 1,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "\"Todo dia é uma luta para ir tomar banho. Eu aviso várias vezes, mas ele\ncontinua brincando. Quando digo que acabou, reclama e às vezes chora.\"\n\nJá sabemos:\n\n- há atividade precedente envolvente\n- há vários avisos\n- a resistência cresce no encerramento\n\nAinda precisamos diferenciar:\n\n- se o gargalo é sair da brincadeira\n- se o banho em si é aversivo\n- se existe dificuldade de iniciação\n- se a sequência do banho exige ajuda\n\nPergunta de maior valor:\n\n\"Depois que ele entra no banho, fica bem ou continua querendo sair?\"\n\nComo ler a resposta:\n\n- Fica bem: aumenta peso de transição/encerramento.\n- Continua querendo sair: investigar banho/sensorial/medo/experiência.\n- Nem chega a iniciar: investigar primeiro passo, compreensão e iniciação.\n- Só acontece ao sair de atividades preferidas: diferenciar perda do preferido\n  de dificuldade ampla de mudança."
  },
  {
    "id": "rotina/regra-de-conducao-o-que-nao-perguntar-se-o-relato-ja-respondeu",
    "tema": "rotina",
    "secao": "REGRA DE CONDUÇÃO — O QUE NÃO PERGUNTAR SE O RELATO JÁ RESPONDEU",
    "titulo": "REGRA DE CONDUÇÃO — O QUE NÃO PERGUNTAR SE O RELATO JÁ RESPONDEU",
    "nivel": 1,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "- Não perguntar \"ele não gosta de rotina?\" se o problema já foi descrito como\n  uma transição específica.\n- Não perguntar novamente qual atividade estava fazendo se isso já foi dito.\n- Não presumir que resistência significa rigidez do autismo."
  },
  {
    "id": "rotina/triagem-inicial-o-que-consultar-no-perfil-primeiro",
    "tema": "rotina",
    "secao": "TRIAGEM INICIAL — O QUE CONSULTAR NO PERFIL PRIMEIRO",
    "titulo": "TRIAGEM INICIAL — O QUE CONSULTAR NO PERFIL PRIMEIRO",
    "nivel": 1,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Campos que existem hoje no Perfil, em `rotina`:\n\n- Como lida com a rotina\n- O que ajuda nas transições\n- Rotinas-âncora\n- Como você avisa mudanças\n- Sinais quando a rotina quebra\n\nVale também consultar, em outros domínios: autonomia nas etapas, compreensão\nde instruções e interesses de alta preferência."
  },
  {
    "id": "rotina/seguranca-e-limites",
    "tema": "rotina",
    "secao": "SEGURANÇA E LIMITES",
    "titulo": "SEGURANÇA E LIMITES",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "- Mudança súbita e importante de funcionamento merece olhar mais amplo.\n- Não usar diagnóstico como causa automática.\n- Rotina visual é ferramenta possível, não solução universal."
  },
  {
    "id": "rotina/resultado-esperado",
    "tema": "rotina",
    "secao": "RESULTADO ESPERADO",
    "titulo": "RESULTADO ESPERADO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "A família consegue dizer: \"eu sei se o difícil é sair, entrar ou começar\" e \"eu\nsei o que testar amanhã nessa passagem específica\".\n\n---"
  },
  {
    "id": "sensorial/missao",
    "tema": "sensorial",
    "secao": "MISSÃO",
    "titulo": "MISSÃO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Ajudar a família a identificar qual canal sensorial está envolvido, em que\ndireção, e o que muda quando o estímulo ou o ambiente muda.\n\nAtua quando o relato fala de: reação a sons, luz, cheiros, texturas ou toque;\ndificuldade em ambientes cheios; recusa de roupa, banho ou corte de cabelo;\nbusca constante de movimento, pressão ou estímulo oral.\n\nO objetivo NÃO é transformar \"sensorial\" em explicação para tudo.\n\nA pergunta funcional é:\n\n\"Qual canal está pesando ou faltando, e o que muda quando o estímulo ou o\nambiente muda?\"\n\nO objetivo é localizar a barreira antes de orientar. O mesmo relato pode\nesconder mecanismos diferentes."
  },
  {
    "id": "sensorial/principio-central",
    "tema": "sensorial",
    "secao": "PRINCÍPIO CENTRAL",
    "titulo": "PRINCÍPIO CENTRAL",
    "nivel": 1,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Grandes bifurcações — o relato parece igual, mas precisamos distinguir:\n\n- \"É sensível\" → qual canal × qual contexto × intensidade × efeito funcional\n- \"Grita no mercado\" → sobrecarga sensorial × espera × frustração ×\n  fome/cansaço × desejo de sair/obter algo\n- \"Não lava o cabelo\" → água/rosto × temperatura × couro cabeludo × medo ×\n  transição × experiência anterior\n- \"Só usa a mesma roupa\" → textura/costura × temperatura × previsibilidade ×\n  preferência × resistência à mudança\n- \"Precisa se mexer\" → busca sensorial × necessidade motora × tédio ×\n  autorregulação × contexto da tarefa"
  },
  {
    "id": "sensorial/1-sensorial-e-hipotese-contextual",
    "tema": "sensorial",
    "secao": "PRINCÍPIO CENTRAL",
    "titulo": "1. Sensorial é hipótese contextual",
    "nivel": 2,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Não usar TEA/TDAH como atalho causal. Localizar modalidade e observar mudança\nquando a variável muda."
  },
  {
    "id": "sensorial/2-canal-importa",
    "tema": "sensorial",
    "secao": "PRINCÍPIO CENTRAL",
    "titulo": "2. Canal importa",
    "nivel": 2,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "- auditivo\n- visual\n- tátil\n- gustativo/olfativo\n- vestibular/movimento\n- proprioceptivo\n- oral\n\nPergunta: \"O que exatamente estava acontecendo no ambiente quando ela reagiu?\""
  },
  {
    "id": "sensorial/3-estimulo-pontual-carga-acumulada",
    "tema": "sensorial",
    "secao": "PRINCÍPIO CENTRAL",
    "titulo": "3. Estímulo pontual × carga acumulada",
    "nivel": 2,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Reação imediata a um estímulo específico é diferente de irritação depois de\nlongo tempo em ambiente intenso.\n\nPergunta: \"Isso acontece assim que o estímulo aparece ou depois de algum tempo\nnaquele ambiente?\""
  },
  {
    "id": "sensorial/4-melhor-teste-funcional-mudar-uma-variavel",
    "tema": "sensorial",
    "secao": "PRINCÍPIO CENTRAL",
    "titulo": "4. Melhor teste funcional: mudar uma variável",
    "nivel": 2,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Se uma mudança específica no ambiente altera consistentemente a reação, a\nhipótese sensorial ganha força. Ex.: com secador há grande desconforto; sem\nsecador a situação se torna tolerável."
  },
  {
    "id": "sensorial/5-evitar-universais",
    "tema": "sensorial",
    "secao": "PRINCÍPIO CENTRAL",
    "titulo": "5. Evitar universais",
    "nivel": 2,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Não afirmar que pressão profunda, movimento ou qualquer estímulo \"acalma\nautistas\". Perguntar o que acontece depois daquele estímulo naquela criança."
  },
  {
    "id": "sensorial/antes-de-orientar-diferencie-quando-sensorial-nao-e-o-tema-principal",
    "tema": "sensorial",
    "secao": "ANTES DE ORIENTAR, DIFERENCIE — QUANDO SENSORIAL NÃO É O TEMA PRINCIPAL",
    "titulo": "ANTES DE ORIENTAR, DIFERENCIE — QUANDO SENSORIAL NÃO É O TEMA PRINCIPAL",
    "nivel": 1,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "- Se a reação não muda quando o estímulo muda, reduzir o peso da hipótese\n  sensorial.\n- Se o problema aparece principalmente em espera, limite ou perda, recuperar\n  Emocional/Rotina.\n- Se a criança não compreende o que vai acontecer, recuperar\n  Comunicação/Rotina.\n- Se há dificuldade motora ou de autonomia, recuperar Motor/Autonomia."
  },
  {
    "id": "sensorial/pergunta-de-alto-valor-golden-case",
    "tema": "sensorial",
    "secao": "PERGUNTA DE ALTO VALOR — GOLDEN CASE",
    "titulo": "PERGUNTA DE ALTO VALOR — GOLDEN CASE",
    "nivel": 1,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "\"Toda vez que vamos a um aniversário ele começa bem, depois fica irritado, tapa\nos ouvidos e quer ir embora.\"\n\nJá sabemos:\n\n- o início do evento é tolerável\n- a dificuldade aparece depois de algum tempo\n- há sinal auditivo possível\n- há desejo de sair\n\nAinda precisamos diferenciar:\n\n- ruído específico × carga acumulada\n- cansaço/social/demanda\n- se sair ou reduzir ruído muda rapidamente a reação\n\nPergunta de maior valor:\n\n\"Isso acontece por causa de algum som específico ou vai aparecendo depois de um\ntempo, mesmo sem um barulho novo?\"\n\nComo ler a resposta:\n\n- Som específico + melhora ao reduzir: sensorial auditivo ganha peso.\n- Aparece só após tempo: investigar carga acumulada e outros fatores.\n- Não melhora ao sair/reduzir ruído: manter outras hipóteses abertas."
  },
  {
    "id": "sensorial/regra-de-conducao-o-que-nao-perguntar-se-o-relato-ja-respondeu",
    "tema": "sensorial",
    "secao": "REGRA DE CONDUÇÃO — O QUE NÃO PERGUNTAR SE O RELATO JÁ RESPONDEU",
    "titulo": "REGRA DE CONDUÇÃO — O QUE NÃO PERGUNTAR SE O RELATO JÁ RESPONDEU",
    "nivel": 1,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "- Não perguntar genericamente \"ele tem sensibilidade sensorial?\"\n- Não concluir \"é sensorial\" só porque tapa os ouvidos.\n- Não recomendar estímulo regulador universal sem saber a resposta individual."
  },
  {
    "id": "sensorial/triagem-inicial-o-que-consultar-no-perfil-primeiro",
    "tema": "sensorial",
    "secao": "TRIAGEM INICIAL — O QUE CONSULTAR NO PERFIL PRIMEIRO",
    "titulo": "TRIAGEM INICIAL — O QUE CONSULTAR NO PERFIL PRIMEIRO",
    "nivel": 1,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "O Perfil já é organizado **por canal**, que é exatamente a distinção que este\ntema exige. Campos em `sensorial`:\n\n- Perfil sensorial\n- Reação a sons\n- Reação a toques\n- Texturas (roupas, objetos)\n- Luz\n- Cheiros\n- Movimento\n\nAntes de perguntar qual canal está envolvido, ler o canal correspondente. Se\n\"Reação a sons\" já está preenchido, a pergunta seguinte é sobre carga e\ncontexto, não sobre sensibilidade auditiva."
  },
  {
    "id": "sensorial/seguranca-e-limites",
    "tema": "sensorial",
    "secao": "SEGURANÇA E LIMITES",
    "titulo": "SEGURANÇA E LIMITES",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "- Dor, perda auditiva suspeita, reação física intensa ou mudança súbita pedem\n  avaliação adequada.\n- Não prescrever Integração Sensorial/Ayres como dica cotidiana.\n- Priorizar adaptações ambientais seguras e observáveis."
  },
  {
    "id": "sensorial/resultado-esperado",
    "tema": "sensorial",
    "secao": "RESULTADO ESPERADO",
    "titulo": "RESULTADO ESPERADO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "A família consegue dizer: \"eu sei qual canal e qual contexto pesam\" e \"eu sei\nqual variável mudar para testar\".\n\n---"
  },
  {
    "id": "socializacao/missao",
    "tema": "socializacao",
    "secao": "MISSÃO",
    "titulo": "MISSÃO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Ajudar a família a entender em qual parte da interação social está a dificuldade e oferecer estratégias práticas para aumentar participação, conexão e autonomia social.\n\nEsta skill pode atuar quando a família relata:\n\n- não brinca com outras crianças;\n- prefere brincar sozinho;\n- quer brincar, mas não sabe chegar;\n- chega de forma inadequada;\n- pega brinquedos;\n- não compartilha;\n- quer mandar na brincadeira;\n- não aceita perder;\n- se irrita quando outra criança muda a brincadeira;\n- fica de fora do grupo;\n- acompanha outras crianças sem participar;\n- fala muito sobre o próprio interesse;\n- interrompe;\n- não percebe quando o outro não está interessado;\n- não sabe manter conversa;\n- tem dificuldade em festa;\n- conflitos com irmãos;\n- dificuldade para fazer ou manter amizades;\n- aproximação física inadequada;\n- dificuldade com turnos;\n- imita comportamentos para tentar pertencer."
  },
  {
    "id": "socializacao/principio-central",
    "tema": "socializacao",
    "secao": "PRINCÍPIO CENTRAL",
    "titulo": "PRINCÍPIO CENTRAL",
    "nivel": 1,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "“Não socializa” não é uma informação suficiente.\n\nAntes de orientar, diferencie:\n\n1. não demonstra interesse em participar;\n2. quer participar, mas não sabe como entrar;\n3. entra, mas não consegue permanecer;\n4. permanece apenas se controlar a brincadeira;\n5. tem dificuldade com turnos;\n6. tem dificuldade em compartilhar;\n7. não percebe sinais do outro;\n8. não sabe o que dizer;\n9. fica sobrecarregado em grupos;\n10. funciona melhor com uma criança do que com várias;\n11. aproxima-se de forma intensa;\n12. conflito aparece quando recebe um “não”;\n13. consegue socializar em temas de interesse, mas não fora deles;\n14. tem habilidade social, mas ansiedade/insegurança impede participação.\n\nCada situação pede uma estratégia diferente."
  },
  {
    "id": "socializacao/primeira-pergunta-de-alto-valor",
    "tema": "socializacao",
    "secao": "PRIMEIRA PERGUNTA DE ALTO VALOR",
    "titulo": "PRIMEIRA PERGUNTA DE ALTO VALOR",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Quando a família disser:\n\n“Ele não brinca com outras crianças.”\n\nUma pergunta especialmente útil é:\n\n“Ele parece querer participar e não sabe como chegar, ou fica bem brincando sozinho e não demonstra vontade de entrar?”\n\nIsso separa duas situações completamente diferentes.\n\nNão assumir que brincar sozinho significa sofrimento ou déficit."
  },
  {
    "id": "socializacao/observar-o-que-ja-funciona",
    "tema": "socializacao",
    "secao": "OBSERVAR O QUE JÁ FUNCIONA",
    "titulo": "OBSERVAR O QUE JÁ FUNCIONA",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Antes de trabalhar o que falta, procure situações em que a interação acontece melhor.\n\nPerguntas úteis:\n\n“Com irmão, primo ou uma criança conhecida ele brinca diferente?”\n\n“Ele fica melhor com uma criança de cada vez ou em grupo?”\n\n“Quando a brincadeira envolve algo que ele adora, ele procura as outras crianças?”\n\nEssas respostas revelam condições facilitadoras."
  },
  {
    "id": "socializacao/1-quer-brincar-mas-nao-sabe-entrar",
    "tema": "socializacao",
    "secao": "1. QUER BRINCAR, MAS NÃO SABE ENTRAR",
    "titulo": "1. QUER BRINCAR, MAS NÃO SABE ENTRAR",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Situação:\n\nA criança observa outras brincando, aproxima-se, mas:\n- fica parada;\n- pega um brinquedo;\n- empurra;\n- começa a mandar;\n- fala algo fora do contexto;\n- invade a brincadeira.\n\nNão concluir:\n“Ele não sabe socializar.”\n\nPode faltar uma habilidade específica: ENTRADA.\n\nEnsine frases e ações concretas:\n\n“Posso brincar?”\n\n“Qual eu posso pegar?”\n\n“Posso ser esse personagem?”\n\n“Quer fazer comigo?”\n\nPara crianças com pouca linguagem, a entrada pode ser treinada por:\n- gesto;\n- mostrar objeto;\n- entregar uma peça;\n- imitar uma ação;\n- aproximação mediada pelo adulto."
  },
  {
    "id": "socializacao/ensaio-antes-da-situacao",
    "tema": "socializacao",
    "secao": "ENSAIO ANTES DA SITUAÇÃO",
    "titulo": "ENSAIO ANTES DA SITUAÇÃO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Não espere a criança estar diante de cinco crianças para ensinar.\n\nTreine antes.\n\nExemplo:\n\n“Quando chegar no parque e quiser brincar com alguém, vamos tentar primeiro chegar perto e perguntar: ‘Posso brincar também?’”\n\nFaça uma simulação rápida em casa.\n\nO adulto pode ser a outra criança."
  },
  {
    "id": "socializacao/2-pega-o-que-e-do-outro",
    "tema": "socializacao",
    "secao": "2. PEGA O QUE É DO OUTRO",
    "titulo": "2. PEGA O QUE É DO OUTRO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Não responder apenas:\n\n“Tem que ensinar que não pode pegar.”\n\nA habilidade alternativa precisa ser ensinada.\n\nExemplo:\n\nEm vez de repetir:\n“Não pega!”\n\nensinar:\n\n“Você quer esse. Pergunta: ‘Posso usar depois?’”\n\nPara criança menor ou com comunicação reduzida:\nusar cartão, gesto ou frase curta.\n\nSe ela ainda não consegue esperar muito, não exigir uma espera longa logo no início."
  },
  {
    "id": "socializacao/3-compartilhar",
    "tema": "socializacao",
    "secao": "3. COMPARTILHAR",
    "titulo": "3. COMPARTILHAR",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Não transformar “compartilhar” em obrigação de entregar imediatamente qualquer objeto.\n\nExistem pelo menos três habilidades:\n\n- permitir que outra pessoa participe;\n- emprestar;\n- esperar/alternar turnos.\n\nPodem ser ensinadas separadamente.\n\nComece por turnos muito curtos:\n\n“Agora você.”\n\n“Agora eu.”\n\n“Agora você de novo.”\n\nA previsibilidade de que o objeto volta pode facilitar."
  },
  {
    "id": "socializacao/4-quer-controlar-a-brincadeira",
    "tema": "socializacao",
    "secao": "4. QUER CONTROLAR A BRINCADEIRA",
    "titulo": "4. QUER CONTROLAR A BRINCADEIRA",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Exemplo:\n\n“Ele brinca com os outros, mas tudo tem que ser do jeito dele.”\n\nIsso é diferente de “não socializa”.\n\nTrabalhar FLEXIBILIDADE SOCIAL.\n\nComeçar pequeno:\n\n“Uma escolha sua, uma escolha minha.”\n\nOu:\n\n“Você escolhe o personagem. Seu amigo escolhe onde a história acontece.”\n\nNão começar exigindo que aceite todas as ideias dos outros."
  },
  {
    "id": "socializacao/5-nao-aceita-perder",
    "tema": "socializacao",
    "secao": "5. NÃO ACEITA PERDER",
    "titulo": "5. NÃO ACEITA PERDER",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Não ensinar tolerância à derrota apenas fazendo a criança perder repetidamente.\n\nAntes, observe o que acontece:\n\n- chora?\n- abandona?\n- muda regras?\n- acusa o outro?\n- bate?\n- quer recomeçar?\n\nEnsine uma resposta substituta.\n\nExemplo:\n\n“Eu queria ganhar. Fiquei bravo.”\n\n“Quero jogar de novo.”\n\n“Preciso de uma pausa.”\n\nJogos rápidos ajudam porque oferecem várias oportunidades de ganhar e perder sem uma única partida carregar peso excessivo."
  },
  {
    "id": "socializacao/6-grupos-grandes",
    "tema": "socializacao",
    "secao": "6. GRUPOS GRANDES",
    "titulo": "6. GRUPOS GRANDES",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Se a criança funciona bem individualmente, mas desaparece ou se desorganiza em grupos:\n\nnão concluir que ela “não sabe socializar”.\n\nPode haver:\n- excesso de estímulo;\n- velocidade da interação;\n- dificuldade para encontrar espaço para falar;\n- imprevisibilidade;\n- múltiplas pessoas para acompanhar.\n\nEstratégia:\ncomeçar com uma criança compatível e atividade estruturada.\n\nDepois ampliar."
  },
  {
    "id": "socializacao/7-brincadeira-paralela",
    "tema": "socializacao",
    "secao": "7. BRINCADEIRA PARALELA",
    "titulo": "7. BRINCADEIRA PARALELA",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Especialmente em crianças pequenas, estar perto de outras crianças fazendo atividades semelhantes pode ser parte do desenvolvimento social.\n\nNão obrigar imediatamente interação direta.\n\nPodemos transformar:\n\nbrincar perto\n→ observar\n→ trocar objeto\n→ imitar\n→ fazer uma ação juntos\n→ pequena brincadeira compartilhada."
  },
  {
    "id": "socializacao/8-interesses-como-ponte",
    "tema": "socializacao",
    "secao": "8. INTERESSES COMO PONTE",
    "titulo": "8. INTERESSES COMO PONTE",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Se a criança ama dinossauros, carros, desenho, futebol etc., isso pode facilitar conexão.\n\nMas não use o interesse apenas para fazê-la falar.\n\nUse para criar uma experiência compartilhada.\n\nExemplo:\n\nEm vez de:\n“Conte para ele tudo sobre dinossauros.”\n\nPode ser:\n\n“Escolham juntos qual dinossauro vai enfrentar o T-Rex.”\n\nAgora existe reciprocidade."
  },
  {
    "id": "socializacao/9-fala-muito-sobre-o-proprio-interesse",
    "tema": "socializacao",
    "secao": "9. FALA MUITO SOBRE O PRÓPRIO INTERESSE",
    "titulo": "9. FALA MUITO SOBRE O PRÓPRIO INTERESSE",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Não proibir o assunto.\n\nEnsine RECIPROCIDADE.\n\nExemplo:\n\n“Você contou uma coisa sobre Minecraft. Agora pergunta uma coisa para ele.”\n\nOu:\n\n“Conta uma e depois escuta uma.”\n\nIsso é mais concreto que:\n\n“Deixa o outro falar.”"
  },
  {
    "id": "socializacao/10-nao-percebe-que-o-outro-quer-parar",
    "tema": "socializacao",
    "secao": "10. NÃO PERCEBE QUE O OUTRO QUER PARAR",
    "titulo": "10. NÃO PERCEBE QUE O OUTRO QUER PARAR",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Ensinar sinais observáveis, não conceitos abstratos.\n\nExemplos:\n\n“Se a pessoa começa a ir embora...”\n\n“Se responde só ‘sim’, ‘aham’ e olha para outro lugar...”\n\n“Se fala ‘agora não’...”\n\npodem ser sinais de que é hora de parar ou mudar.\n\nNão exigir leitura perfeita de linguagem corporal."
  },
  {
    "id": "socializacao/11-conversacao",
    "tema": "socializacao",
    "secao": "11. CONVERSAÇÃO",
    "titulo": "11. CONVERSAÇÃO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Se há dificuldade em manter conversa, descubra onde quebra:\n\n- iniciar?\n- responder?\n- fazer pergunta?\n- permanecer no assunto?\n- mudar de assunto?\n- perceber quando terminar?\n\nNão ensinar “conversação” inteira de uma vez.\n\nExemplo:\n\nSe responde, mas nunca devolve:\n\ntreinar apenas:\n\nRESPONDER + DEVOLVER.\n\n“Eu gosto de futebol. E você?”"
  },
  {
    "id": "socializacao/12-crianca-muito-direta",
    "tema": "socializacao",
    "secao": "12. CRIANÇA MUITO DIRETA",
    "titulo": "12. CRIANÇA MUITO DIRETA",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Não transformar autenticidade em erro social.\n\nAjude a construir alternativas quando a forma de falar causa conflito.\n\nExemplo:\n\nEm vez de:\n\n“Seu desenho está feio.”\n\nPode aprender:\n\n“Eu faria diferente.”\n\nOu simplesmente não precisar avaliar o desenho.\n\nEnsinar repertório, não mascaramento obrigatório."
  },
  {
    "id": "socializacao/13-ansiedade-ou-inseguranca-social",
    "tema": "socializacao",
    "secao": "13. ANSIEDADE OU INSEGURANÇA SOCIAL",
    "titulo": "13. ANSIEDADE OU INSEGURANÇA SOCIAL",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Às vezes a criança SABE o que fazer, mas não consegue fazer diante das pessoas.\n\nSinais:\n- fala normalmente em casa;\n- ensaia;\n- sabe responder;\n- trava quando chega;\n- evita situações novas;\n- precisa do adulto para falar.\n\nNesse caso, repetir regras sociais pode não resolver.\n\nUse exposição gradual e apoio.\n\nExemplo:\n\nHoje:\nela entra na loja com a mãe.\n\nDepois:\nentrega o produto.\n\nDepois:\ndiz “obrigada”.\n\nDepois:\nfaz uma pergunta curta."
  },
  {
    "id": "socializacao/14-festas-e-eventos",
    "tema": "socializacao",
    "secao": "14. FESTAS E EVENTOS",
    "titulo": "14. FESTAS E EVENTOS",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Não usar “foi numa festa e ficou isolado” como medida única da habilidade social.\n\nFestas envolvem:\n- barulho;\n- pessoas desconhecidas;\n- ambiente novo;\n- música;\n- imprevisibilidade;\n- muitas interações simultâneas.\n\nPrepare:\n- onde vai;\n- quem estará;\n- quanto tempo;\n- lugar para pausa;\n- como pedir para sair;\n- o que pode fazer ao chegar."
  },
  {
    "id": "socializacao/15-irmaos",
    "tema": "socializacao",
    "secao": "15. IRMÃOS",
    "titulo": "15. IRMÃOS",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Conflito entre irmãos não é automaticamente dificuldade de socialização.\n\nObserve:\n- disputa por objeto;\n- invasão de espaço;\n- ciúme;\n- provocação;\n- dificuldade com espera;\n- rigidez;\n- necessidade de atenção.\n\nIntervenha na habilidade específica."
  },
  {
    "id": "socializacao/16-quando-recebe-nao",
    "tema": "socializacao",
    "secao": "16. QUANDO RECEBE “NÃO”",
    "titulo": "16. QUANDO RECEBE “NÃO”",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Se a dificuldade social aparece principalmente quando o outro recusa:\n\n“Não quero brincar.”\n\n“Não vou emprestar.”\n\n“Agora não.”\n\no alvo pode ser TOLERAR FRUSTRAÇÃO/RECUSA, e não iniciar interação.\n\nEnsinar:\n\n“Tudo bem, vou procurar outra coisa.”\n\n“Posso perguntar depois?”\n\n“Vou chamar outra pessoa.”\n\nPara crianças menores, o adulto pode ajudar a fazer a transição imediatamente."
  },
  {
    "id": "socializacao/17-nao-forcar-amizade",
    "tema": "socializacao",
    "secao": "17. NÃO FORÇAR AMIZADE",
    "titulo": "17. NÃO FORÇAR AMIZADE",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Objetivo não é quantidade de amigos.\n\nUma criança pode preferir:\n- poucas pessoas;\n- interações curtas;\n- atividades estruturadas;\n- relações individuais.\n\nO objetivo é ampliar possibilidades e autonomia, não produzir um padrão social específico."
  },
  {
    "id": "socializacao/18-nao-falar-pela-crianca-automaticamente",
    "tema": "socializacao",
    "secao": "18. NÃO FALAR PELA CRIANÇA AUTOMATICAMENTE",
    "titulo": "18. NÃO FALAR PELA CRIANÇA AUTOMATICAMENTE",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Quando possível, dê alguns segundos para ela responder.\n\nSe precisar ajudar, use apoio gradual:\n\n1. esperar;\n2. dar pista;\n3. oferecer duas opções;\n4. modelar frase;\n5. falar por ela apenas se necessário.\n\nDepois reduza o apoio ao longo do tempo."
  },
  {
    "id": "socializacao/19-o-que-nao-fazer",
    "tema": "socializacao",
    "secao": "19. O QUE NÃO FAZER",
    "titulo": "19. O QUE NÃO FAZER",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Evite:\n\n- “Vai brincar!”\n- obrigar abraço/beijo;\n- obrigar contato visual;\n- chamar de antissocial;\n- comparar com irmãos;\n- corrigir cada comportamento social;\n- exigir compartilhamento imediato;\n- falar pela criança sempre;\n- transformar toda interação em treino;\n- obrigar permanência em ambiente sobrecarregante;\n- dizer “é só ter mais confiança”;\n- usar vergonha para corrigir."
  },
  {
    "id": "socializacao/20-perguntas-de-alto-valor",
    "tema": "socializacao",
    "secao": "20. PERGUNTAS DE ALTO VALOR",
    "titulo": "20. PERGUNTAS DE ALTO VALOR",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Use somente quando realmente mudarem a estratégia:\n\n“Ele quer participar?”\n\n“Consegue brincar melhor com uma criança do que em grupo?”\n\n“Quando a brincadeira é sobre algo que gosta, muda alguma coisa?”\n\n“Ele consegue entrar na brincadeira ou é justamente aí que trava?”\n\n“Depois que entra, consegue permanecer?”\n\n“Quando começa o conflito?”\n\n“Ele aceita quando a outra criança muda a brincadeira?”\n\n“Ele consegue esperar a vez?”\n\n“Ele percebe quando o outro não quer continuar?”\n\nNão transformar isso em questionário."
  },
  {
    "id": "socializacao/21-progressao",
    "tema": "socializacao",
    "secao": "21. PROGRESSÃO",
    "titulo": "21. PROGRESSÃO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Exemplo de objetivo amplo:\n\n“Fazer amigos.”\n\nTransforme em habilidades observáveis:\n\n1. aproximar;\n2. iniciar;\n3. participar por alguns minutos;\n4. alternar turnos;\n5. aceitar uma ideia do outro;\n6. comunicar incômodo;\n7. lidar com um “não”;\n8. encerrar a interação.\n\nA família precisa saber QUAL dessas habilidades está sendo trabalhada."
  },
  {
    "id": "socializacao/22-quando-a-estrategia-nao-funciona",
    "tema": "socializacao",
    "secao": "22. QUANDO A ESTRATÉGIA NÃO FUNCIONA",
    "titulo": "22. QUANDO A ESTRATÉGIA NÃO FUNCIONA",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Se a mãe disser:\n\n“Já ensinei ele a perguntar ‘posso brincar?’.”\n\nNão responda ensinando a mesma frase novamente.\n\nPergunte ou identifique o próximo ponto:\n\nEle pergunta e recebe “sim”, mas depois não sabe o que fazer?\n\nEntão o problema não é mais ENTRAR.\n\nAgora pode ser MANUTENÇÃO DA BRINCADEIRA.\n\nAvance."
  },
  {
    "id": "socializacao/exemplo",
    "tema": "socializacao",
    "secao": "EXEMPLO",
    "titulo": "EXEMPLO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Mãe:\n\n“Ele não socializa na escola.”\n\nResposta ruim:\n\n“Você pode incentivar brincadeiras em grupo, ensinar habilidades sociais e conversar com a professora.”\n\nResposta melhor:\n\n“Quero separar uma coisa porque muda bastante o que fazer: quando ele vê as outras crianças brincando, ele tenta chegar perto e acaba não conseguindo entrar, ou prefere continuar na atividade dele?”\n\nMãe:\n\n“Ele chega, mas pega os brinquedos e as crianças ficam bravas.”\n\nAgora já há direção:\n\n“Então vontade de participar ele tem. O ponto parece estar na entrada da brincadeira. Em vez de trabalhar ‘socialização’ inteira, eu começaria ensinando uma alternativa para pegar: chegar, apontar para o brinquedo e perguntar ‘posso usar depois?’. Treina isso primeiro com você, numa brincadeira curta, antes de esperar que ele consiga fazer no meio da turma.”"
  },
  {
    "id": "socializacao/resultado-esperado",
    "tema": "socializacao",
    "secao": "RESULTADO ESPERADO",
    "titulo": "RESULTADO ESPERADO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "A família deve sair de:\n\n“Meu filho não socializa.”\n\npara algo mais preciso, como:\n\n“Ele quer brincar. O que ainda precisa aprender é como entrar sem pegar o objeto.”\n\nou:\n\n“Ele entra bem. O problema começa quando outra criança muda a regra.”\n\nou:\n\n“Ele sabe brincar individualmente; grupos grandes é que ficam difíceis.”\n\nE então receber UMA primeira ação compatível com esse ponto.\n\n---"
  },
  {
    "id": "sono/missao",
    "tema": "sono",
    "secao": "MISSÃO",
    "titulo": "MISSÃO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Ajudar a família a entender o que está impedindo a criança de adormecer, de\npermanecer dormindo ou de voltar a dormir.\n\nAtua quando o relato fala de: demora para pegar no sono; despertares noturnos;\nchamados repetidos; pedidos que adiam a hora de dormir; medo na hora de dormir;\nnecessidade da presença do adulto para adormecer.\n\nO objetivo NÃO é aplicar higiene do sono genérica antes de saber qual é a\nbarreira.\n\nA pergunta funcional é:\n\n\"O que está impedindo esta criança de adormecer, permanecer dormindo ou voltar\na dormir com segurança e autonomia?\"\n\nO objetivo é localizar a barreira antes de orientar. O mesmo relato pode\nesconder mecanismos diferentes."
  },
  {
    "id": "sono/principio-central",
    "tema": "sono",
    "secao": "PRINCÍPIO CENTRAL",
    "titulo": "PRINCÍPIO CENTRAL",
    "nivel": 1,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Grandes bifurcações — o relato parece igual, mas precisamos distinguir:\n\n- \"Demora para dormir\" → horário/ritmo × preocupação/medo × condição para\n  adormecer × ambiente × transição\n- \"Só dorme comigo\" → preferência × presença como segurança × condição habitual\n  × ajuda para desacelerar\n- \"Acorda toda hora\" → desperta e volta sozinho × desperta e chama ×\n  desconforto/ambiente × sinal que merece avaliação\n- \"Pede água/banheiro\" → necessidade real × adiamento × busca de\n  presença/segurança\n- \"Diz que está com medo\" → medo identificável × sensação sem nome × medo\n  ligado à separação × outro contexto emocional"
  },
  {
    "id": "sono/1-inicio-manutencao-do-sono",
    "tema": "sono",
    "secao": "PRINCÍPIO CENTRAL",
    "titulo": "1. Início × manutenção do sono",
    "nivel": 2,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Pergunta: \"Depois que finalmente dorme, como costuma ser o restante da noite?\"\n\nSe demora para dormir, mas depois dorme bem, o foco está principalmente no\ninício. Se também desperta e precisa recriar a mesma condição, início e\nmanutenção podem estar ligados."
  },
  {
    "id": "sono/2-horario-resistencia",
    "tema": "sono",
    "secao": "PRINCÍPIO CENTRAL",
    "titulo": "2. Horário × resistência",
    "nivel": 2,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Uma criança acordada por muito tempo pode simplesmente não estar pronta para\ndormir naquele horário. Observar o que faz enquanto está acordada ajuda:\ntranquila e brincando sugere caminho diferente de tensa, chamando ou relatando\nmedo.\n\nPergunta: \"Enquanto demora para dormir, ele fica tranquilo ou parece\nincomodado/angustiado?\""
  },
  {
    "id": "sono/3-presenca-para-adormecer",
    "tema": "sono",
    "secao": "PRINCÍPIO CENTRAL",
    "titulo": "3. Presença para adormecer",
    "nivel": 2,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "\"Só dorme se eu ficar\" ainda não explica por quê. Pode haver medo, dificuldade\nde separação, ajuda para desacelerar, preferência ou uma condição muito\nespecífica de adormecimento.\n\nPergunta: \"Se você fica no quarto, mas sem deitar junto ou interagir, ele\nconsegue dormir?\""
  },
  {
    "id": "sono/4-pedidos-repetidos",
    "tema": "sono",
    "secao": "PRINCÍPIO CENTRAL",
    "titulo": "4. Pedidos repetidos",
    "nivel": 2,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Água, banheiro, abraço e \"mais uma coisa\" não devem ser chamados\nautomaticamente de manha ou manipulação. Observe o que acontece quando um\npedido é atendido.\n\nPergunta: \"Quando os pedidos terminam, ele consegue ficar tranquilo ou continua\nrealmente incomodado?\""
  },
  {
    "id": "sono/5-medo",
    "tema": "sono",
    "secao": "PRINCÍPIO CENTRAL",
    "titulo": "5. Medo",
    "nivel": 2,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Não converter automaticamente \"estou com medo\" em ansiedade. Primeiro localizar\no conteúdo, o momento e a extensão do medo.\n\nPergunta: \"Quando ele fala que está com medo, consegue dizer do quê ou é mais\numa sensação que ele não sabe explicar?\""
  },
  {
    "id": "sono/6-cruzamentos",
    "tema": "sono",
    "secao": "PRINCÍPIO CENTRAL",
    "titulo": "6. Cruzamentos",
    "nivel": 2,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "- Sono × Rotina: o difícil pode ser chegar até a cama, não dormir.\n- Sono × Sensorial: testar se mudança específica de ambiente muda claramente o\n  fenômeno.\n- Sono × Emocional: pensamentos e medos podem dominar o momento sem autorizar\n  diagnóstico.\n- Sono × Comunicação: criança pode não conseguir explicar desconforto, medo ou\n  necessidade."
  },
  {
    "id": "sono/antes-de-orientar-diferencie-quando-sono-nao-e-o-tema-principal",
    "tema": "sono",
    "secao": "ANTES DE ORIENTAR, DIFERENCIE — QUANDO SONO NÃO É O TEMA PRINCIPAL",
    "titulo": "ANTES DE ORIENTAR, DIFERENCIE — QUANDO SONO NÃO É O TEMA PRINCIPAL",
    "nivel": 1,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "- Se a maior dificuldade é encerrar videogame, banho, pijama e chegar à cama,\n  recuperar Rotina junto.\n- Se uma variável ambiental específica muda consistentemente o sono, recuperar\n  Sensorial.\n- Se medo/preocupação aparece também em outros momentos, recuperar Emocional.\n- Se o problema é expressar desconforto ou necessidade, recuperar Comunicação."
  },
  {
    "id": "sono/pergunta-de-alto-valor-golden-case",
    "tema": "sono",
    "secao": "PERGUNTA DE ALTO VALOR — GOLDEN CASE",
    "titulo": "PERGUNTA DE ALTO VALOR — GOLDEN CASE",
    "nivel": 1,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "\"Ele demora para dormir, me chama várias vezes, às vezes diz que está com medo,\npede água, quer ir ao banheiro; eu fico até ele dormir porque, se saio, ele\nlevanta.\"\n\nJá sabemos:\n\n- início do sono está difícil\n- há chamados e pedidos repetidos\n- há relato ocasional de medo\n- a presença do adulto faz parte da sequência\n- a saída do adulto está associada a levantar\n\nAinda precisamos diferenciar:\n\n- qual é o conteúdo do medo\n- se a presença, o contato ou a interação são necessários\n- se depois que adormece a noite segue bem\n- se há fatores de ambiente/ritmo relevantes\n\nPergunta de maior valor:\n\n\"Quando ele diz que está com medo, consegue dizer do quê? E depois que\nfinalmente dorme, como costuma ser o restante da noite?\"\n\nComo ler a resposta:\n\n- Medo específico + noite estável: aprofundar segurança/medo e início do sono.\n- Sem medo claro + adormece com presença: investigar qual condição da presença\n  é necessária.\n- Desperta e procura a mesma condição: considerar que início e manutenção\n  compartilham o mesmo padrão.\n- Sinais físicos/respiratórios ou mudança importante: sair do manejo simples e\n  orientar avaliação."
  },
  {
    "id": "sono/regra-de-conducao-o-que-nao-perguntar-se-o-relato-ja-respondeu",
    "tema": "sono",
    "secao": "REGRA DE CONDUÇÃO — O QUE NÃO PERGUNTAR SE O RELATO JÁ RESPONDEU",
    "titulo": "REGRA DE CONDUÇÃO — O QUE NÃO PERGUNTAR SE O RELATO JÁ RESPONDEU",
    "nivel": 1,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "- Se a mãe já disse que fica até dormir, não perguntar se ela fica no quarto.\n- Se já disse que ele chama várias vezes, não perguntar se chama.\n- Se já disse que levanta quando ela sai, não perguntar se consegue ficar\n  sozinho."
  },
  {
    "id": "sono/triagem-inicial-o-que-consultar-no-perfil-primeiro",
    "tema": "sono",
    "secao": "TRIAGEM INICIAL — O QUE CONSULTAR NO PERFIL PRIMEIRO",
    "titulo": "TRIAGEM INICIAL — O QUE CONSULTAR NO PERFIL PRIMEIRO",
    "nivel": 1,
    "subtema": null,
    "estado": "investigacao",
    "conteudo": "Campos que existem hoje no Perfil, em `sono`:\n\n- Como costuma ser o sono\n- Como adormece\n- Quanto tempo leva pra pegar no sono\n- Despertares\n- Horários\n- O que atrapalha\n\nLacunas de Perfil conhecidas neste tema — **não** consultar como se\nexistissem: onde a criança dorme; rotina da hora de dormir; ambiente do quarto;\nmedos e preocupações. Quando a conversa trouxer essa informação, ela entra em\n\"Outras observações\" até existir campo próprio."
  },
  {
    "id": "sono/seguranca-e-limites",
    "tema": "sono",
    "secao": "SEGURANÇA E LIMITES",
    "titulo": "SEGURANÇA E LIMITES",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "Orientar avaliação profissional diante de:\n\n- ronco frequente/importante, pausas respiratórias, engasgos ou dificuldade\n  respiratória\n- sonolência diurna excessiva sem explicação clara\n- movimentos/desconforto persistente nas pernas\n- mudança importante e inexplicada do padrão de sono\n- perda relevante de funcionamento associada ao sono"
  },
  {
    "id": "sono/resultado-esperado",
    "tema": "sono",
    "secao": "RESULTADO ESPERADO",
    "titulo": "RESULTADO ESPERADO",
    "nivel": 1,
    "subtema": null,
    "estado": "contexto",
    "conteudo": "A família consegue dizer: \"eu sei em que parte da noite está a dificuldade\" e\n\"eu sei qual é a próxima coisa a observar ou testar\".\n\n---"
  }
] as const;
