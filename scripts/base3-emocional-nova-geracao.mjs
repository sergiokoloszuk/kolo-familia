/**
 * BASE 3 · AMOSTRA DE NOVA GERAÇÃO — EMOCIONAL.
 *
 * Dez registros para os dois subproblemas que a Fase 3C mediu como CEGOS:
 * **sobrecarga acumulada** e **sinais precoces / ponto de entrada**. Zero boas
 * práticas aderentes em cada um, com 34 elegíveis no tema.
 *
 * ENTRAM COMO `rascunho`, DE PROPÓSITO. `recuperar.ts` filtra `status = ativo`
 * por padrão (linha 136), então nada disto chega a família nenhuma até alguém
 * decidir ativar. A BASE 3 já é consumida em produção hoje — inserir como
 * `ativo` seria mudar a conversa das famílias no meio de uma missão que diz,
 * por escrito, para não ligar nada.
 *
 * O QUE ESTE FORMATO TENTA PROVAR: que um registro pode carregar repertório
 * suficiente para a Ayla escolher 2–3 elementos, sem virar miniartigo. Os
 * campos são régua de qualidade, não formulário — nenhum registro usa todos.
 *
 * PROVENIÊNCIA. `origem` guarda AUTOR/CIÊNCIA/KOLO separados, como o material
 * editorial exige. Metáfora didática de autor **não** vira fato neurocientífico:
 * nenhum destes registros diz "cérebro de cima", "córtex desligado" ou
 * "hemisfério direito emocional".
 *
 * ADERÊNCIA. O ranking pontua título(5) · quando_usar(4) · tags(3) · corpo(2), e
 * exige DOIS conceitos distintos convergindo. Os títulos usam as palavras que a
 * mãe usa — "fim da tarde", "escola", "auge" — não as que o acervo usa.
 *
 *   node scripts/base3-emocional-nova-geracao.mjs          # mostra o que faria
 *   node scripts/base3-emocional-nova-geracao.mjs --gravar # insere como rascunho
 */

/** Cada bloco vira o corpo do registro. Campo vazio simplesmente não aparece. */
const bloco = (o) =>
  [
    o.desenvolver && `O QUE ESTAMOS DESENVOLVENDO: ${o.desenvolver}`,
    o.comoFazer && `COMO FAZER: ${o.comoFazer}`,
    o.falar && `O QUE O ADULTO PODE FALAR: ${o.falar}`,
    o.treinoCalmo && `TREINO EM MOMENTO CALMO: ${o.treinoCalmo}`,
    o.adaptacao && `ADAPTAÇÃO: ${o.adaptacao}`,
    o.interesse && `USO DO INTERESSE: ${o.interesse}`,
    o.maisFacil && `COMO COMEÇAR MAIS FÁCIL: ${o.maisFacil}`,
    o.progressao && `PROGRESSÃO: ${o.progressao}`,
    o.observar && `O QUE OBSERVAR: ${o.observar}`,
    o.proximoPasso && `PRÓXIMO PASSO: ${o.proximoPasso}`,
    o.naoUsar && `QUANDO NÃO USAR: ${o.naoUsar}`,
  ]
    .filter(Boolean)
    .join("\n\n");

export const REGISTROS = [
  // ────────────────────────────────────────────────────────────────────────
  // A · SOBRECARGA ACUMULADA
  // Caso-ouro: "ele explode por qualquer coisa no fim da tarde, principalmente
  // depois da escola" (6 anos).
  // ────────────────────────────────────────────────────────────────────────
  {
    titulo: "A conta do dia: quando a explosão do fim da tarde vem da escola inteira",
    quando_usar:
      "Quando a criança explode por qualquer coisa no fim da tarde, depois da escola, e o motivo aparente é pequeno demais para o tamanho da reação.",
    tags: ["emocional", "sobrecarga", "fim da tarde", "escola", "acumulo"],
    faixa: [4, 12],
    peso: 0.9,
    origem: "KOLO · princípio de estado antes de conteúdo (AUTOR: Siegel & Bryson, Livro 1) — operacionalizado pela Kolo",
    corpo: bloco({
      desenvolver:
        "A capacidade da família de ler o dia inteiro em vez do último minuto — e de agir antes do pico em vez de durante.",
      comoFazer:
        "Por três ou quatro dias, anote só duas coisas: a que horas ficou difícil e o que tinha acontecido nas duas horas anteriores. Não precisa entender nada ainda — só juntar. Depois olhe se o horário se repete. Quando ele se repete, o gatilho aparente quase nunca é a causa: ele foi só o último item de uma conta que já estava alta.",
      falar:
        "Em vez de \"por que você está assim por causa disso?\", tente \"hoje foi um dia cheio, né? Vem cá um pouco comigo\". Não é validar o comportamento — é reconhecer a carga antes de tratar o episódio.",
      adaptacao:
        "Se o fim da tarde se repete, mova a demanda difícil (lição, banho, conversa sobre a escola) para antes da janela ruim, não para dentro dela. Uma exigência a menos naquele horário vale mais que qualquer técnica dentro da crise.",
      maisFacil:
        "Comece observando um único dia da semana — normalmente o mais cheio.",
      progressao:
        "Perceber depois que aconteceu → perceber no dia → antecipar o horário → reduzir a carga antes que chegue.",
      observar:
        "O horário se repete? Nos dias em que não explodiu, o que estava diferente? Quando você tira uma exigência daquela janela, a reação muda?",
      proximoPasso:
        "Quando o horário estiver claro, o Registro Diário serve para acompanhar por duas semanas se a mudança de carga sustentou o efeito.",
      naoUsar:
        "Se as explosões acontecem em qualquer horário e sem padrão, isto não vai ajudar — o caminho é outro. E se houve mudança abrupta e recente no comportamento, isso pede olhar mais amplo antes de qualquer estratégia.",
    }),
  },
  {
    titulo: "Pouso da volta da escola: meia hora sem pergunta, sem tarefa e sem decisão",
    quando_usar:
      "Quando a criança chega da escola já no limite e qualquer pedido do fim da tarde vira briga.",
    tags: ["emocional", "sobrecarga", "escola", "transicao", "fim da tarde"],
    faixa: [3, 12],
    peso: 0.85,
    origem: "KOLO · reduzir exigência quando há saturação (AUTOR: Siegel & Bryson) — sem usar a metáfora neuroanatômica dos autores",
    corpo: bloco({
      desenvolver:
        "Uma janela de recuperação previsível, para que a criança não precise gastar o pouco que sobrou respondendo perguntas.",
      comoFazer:
        "Nos primeiros trinta minutos em casa: nenhuma pergunta sobre o dia, nenhuma tarefa, nenhuma escolha. Comida na mão, um lugar tranquilo, e a companhia de vocês sem demanda. As perguntas sobre a escola ficam para depois do banho — e costumam vir melhores.",
      falar:
        "\"Chegou. Come alguma coisa e fica aí um pouco. A gente conversa depois.\"",
      adaptacao:
        "Se o caminho de casa já é barulhento e cheio, o pouso começa no carro ou no ônibus: menos conversa, menos rádio.",
      interesse:
        "Se ela tem um assunto que a organiza — um jogo, um bicho, uma coleção —, esse é o único conteúdo que pode entrar nessa meia hora. Aqui o interesse serve para descansar, não para negociar comportamento.",
      progressao:
        "Trinta minutos protegidos → vinte → a criança começa a pedir sozinha o tempo de que precisa.",
      observar:
        "As explosões do fim da tarde diminuem em quantidade ou só ficam mais tarde? Ela procura vocês espontaneamente depois do pouso?",
      naoUsar:
        "Não use como isolamento nem como castigo disfarçado. A criança não é mandada para o quarto: ela fica perto, sem demanda.",
    }),
  },
  {
    titulo: "O termômetro do dia: medir a carga junto, antes que ela vire briga",
    quando_usar:
      "Quando a família quer entender por que o mesmo pedido dá certo num dia e vira explosão no outro.",
    tags: ["emocional", "sobrecarga", "acumulo", "autoconhecimento"],
    faixa: [5, 14],
    peso: 0.8,
    origem: "KOLO · vocabulário próprio da criança para estado interno",
    corpo: bloco({
      desenvolver:
        "Um vocabulário compartilhado sobre o quanto já foi gasto no dia — para a criança conseguir avisar antes de estourar.",
      comoFazer:
        "Escolham juntos uma escala simples e visual: bateria cheia, meia bateria, bateria acabando. Uma vez por dia, num momento tranquilo, cada um diz a sua. Vocês também dizem a de vocês — isso tira o peso de ser sobre ela.",
      falar:
        "\"Minha bateria hoje tá na metade. E a sua?\"",
      treinoCalmo:
        "Comece num sábado calmo, quando não há nada em jogo. Se a primeira vez que vocês perguntarem for durante uma crise, a escala vira interrogatório.",
      interesse:
        "Deixe a criança escolher a metáfora dentro do que ela gosta: barra de vida do jogo, tanque de combustível, pilha do controle. A que ela inventar funciona melhor que a que vocês trouxerem.",
      progressao:
        "Vocês dizem a de vocês → ela responde quando perguntada → ela avisa sozinha → ela pede o que precisa quando a bateria está baixa.",
      observar:
        "Ela consegue diferenciar meia bateria de bateria acabando? Nos dias que ela diz baixa, o fim de tarde é pior?",
      proximoPasso:
        "Quando ela já avisa sozinha, o passo seguinte é combinar o que fazer quando a bateria está acabando — isso já é a frente dos sinais precoces.",
      naoUsar:
        "Se a criança ainda não tem linguagem para isso, a escala pode virar mais uma exigência. Nesse caso, quem observa e nomeia é o adulto, sem cobrar resposta.",
    }),
  },
  {
    titulo: "Uma coisa por vez quando o dia já foi demais",
    quando_usar:
      "Quando a criança já está saturada e cada instrução com mais de um passo termina em recusa ou choro.",
    tags: ["emocional", "sobrecarga", "instrucao", "demanda"],
    faixa: [3, 10],
    peso: 0.75,
    origem: "KOLO · reduzir carga de linguagem em alta ativação (AUTOR: Siegel & Bryson) — hipótese de manejo, não regra universal",
    corpo: bloco({
      desenvolver:
        "A percepção de que, quando a carga está alta, o problema pode ser o tamanho do pedido e não a disposição da criança.",
      comoFazer:
        "Corte a instrução até sobrar uma ação visível. Em vez de \"guarda os brinquedos, escova os dentes e coloca o pijama\", só \"pijama\". Quando o pijama estiver no corpo, a próxima. Menos palavras, uma coisa de cada vez, e espere de verdade antes de repetir.",
      falar:
        "\"Só o pijama agora. O resto a gente vê depois.\"",
      adaptacao:
        "Se falar já está difícil, mostre em vez de dizer: entregue o pijama na mão em vez de anunciá-lo.",
      observar:
        "Com uma instrução só, ela consegue? Se sim, a dificuldade era a quantidade, não a recusa. Se nem com uma, o obstáculo é outro e vale investigar antes de insistir.",
      naoUsar:
        "Isto é para o momento saturado. Fora dele, encurtar toda instrução acaba tirando da criança a chance de sustentar sequências que ela já dá conta.",
    }),
  },
  {
    titulo: "Contar o dia depois, não durante: reconstruir o episódio quando todo mundo já está bem",
    quando_usar:
      "Depois que a crise passou, quando a família quer entender o que aconteceu sem transformar a conversa em sermão.",
    tags: ["emocional", "sobrecarga", "pos-crise", "reparacao"],
    faixa: [5, 14],
    peso: 0.8,
    origem: "KOLO · revisitar depois; separar parar agora de ensinar depois (AUTOR: Siegel & Bryson, Livros 1 e 2)",
    corpo: bloco({
      desenvolver:
        "A capacidade de aprender com o episódio sem que a conversa vire punição — e de descobrir juntos o que veio antes.",
      comoFazer:
        "Horas depois, ou no dia seguinte, contem a história juntos como quem lembra: o que aconteceu primeiro, o que veio depois, onde ficou difícil. Sem perguntar por quê. A pergunta que rende é \"o que estava acontecendo antes?\", não \"por que você fez isso?\".",
      falar:
        "\"Lembra ontem, quando ficou difícil? Me ajuda a lembrar o que tinha acontecido antes disso.\"",
      treinoCalmo:
        "Esta prática é, ela mesma, o treino em momento calmo: ela só existe fora da crise.",
      maisFacil:
        "Se falar é difícil, desenhem a sequência em três quadrinhos — antes, durante, depois.",
      progressao:
        "Vocês contam a história → ela corrige detalhes → ela conta a parte dela → ela lembra sozinha do que veio antes.",
      observar:
        "Ela consegue lembrar do antes ou só do momento da explosão? Aparece algum antes que se repete entre episódios diferentes?",
      proximoPasso:
        "Quando um antes começa a se repetir, ele vira o alvo — e a frente passa a ser sinais precoces.",
      naoUsar:
        "Não faça se a criança ainda estiver sensível ao assunto, e nunca use a reconstrução para chegar a uma cobrança. Se terminar em lição de moral, ela não vai querer da próxima vez.",
    }),
  },

  // ────────────────────────────────────────────────────────────────────────
  // B · SINAIS PRECOCES / PONTO DE ENTRADA
  // Caso-ouro: "quando eu percebo já é tarde, ele já está no auge e não adianta
  // falar nada" (6 anos).
  // ────────────────────────────────────────────────────────────────────────
  {
    titulo: "Entrar antes do auge: perceber o primeiro sinal quando ainda adianta falar",
    quando_usar:
      "Quando a família só percebe que ficou difícil no auge, e nesse ponto nada do que se fala adianta mais.",
    tags: ["emocional", "sinais precoces", "auge", "escalada", "ponto de entrada"],
    faixa: [3, 14],
    peso: 0.95,
    origem: "KOLO · ponto de entrada na escalada; estado antes de conteúdo (AUTOR: Siegel & Bryson, Livro 1)",
    corpo: bloco({
      desenvolver:
        "A capacidade de identificar o primeiro sinal desta criança — e de agir ali, onde uma ação pequena ainda resolve.",
      comoFazer:
        "Depois dos próximos dois ou três episódios, rebobine a fita: qual foi a última coisa que você percebeu antes do auge? A voz mudou? Ele parou de responder? Começou a se mexer diferente, ficou mais rápido, mais quieto, mais grudado? Anote a primeira coisa, não a mais chamativa. Em pouco tempo aparece um sinal que se repete. Esse é o seu ponto de entrada.",
      falar:
        "No sinal, nada de análise. Uma frase curta e uma oferta: \"vem cá comigo um minutinho\". No auge, quase nenhuma frase funciona — por isso o trabalho é chegar antes.",
      treinoCalmo:
        "Fora do momento difícil, contem um para o outro o que cada um faz quando começa a ficar irritado. Vocês primeiro. Fica mais fácil para ela reconhecer o dela depois de ouvir o de vocês.",
      interesse:
        "Procurem o sinal em personagens que ela gosta: naquele desenho, como dá pra saber que o personagem vai explodir? Reconhecer de fora é bem mais fácil do que reconhecer em si mesmo, e é por aí que começa.",
      maisFacil:
        "Comece por um único contexto — o que mais se repete. Não tente enxergar o sinal em todas as situações de uma vez.",
      progressao:
        "Você percebe depois → você percebe no momento → você aponta o sinal para ela → ela reconhece com a sua ajuda → ela avisa antes.",
      observar:
        "Qual foi o primeiro sinal? Ele se repete entre episódios? Quando você entra no sinal em vez de entrar no auge, a coisa desanda do mesmo jeito?",
      proximoPasso:
        "Quando o sinal estiver claro, a frente passa a ser combinar com ela o que fazer nele — um gesto, um lugar, um pedido de pausa.",
      naoUsar:
        "Não transforme isso em vigilância. O objetivo é ampliar a autonomia dela, não monitorar cada mudança de humor — se ela sentir que está sendo observada o tempo todo, o efeito é o contrário.",
    }),
  },
  {
    titulo: "O sinal combinado: um gesto que ela usa antes de não conseguir mais falar",
    quando_usar:
      "Quando a criança já reconhece que está ficando difícil, mas nesse momento não consegue mais formar frases.",
    tags: ["emocional", "sinais precoces", "pausa", "comunicacao", "escalada"],
    faixa: [4, 14],
    peso: 0.9,
    origem: "KOLO · alternativa comunicativa concreta antes da escalada (AUTOR: Siegel & Bryson, Livro 2)",
    corpo: bloco({
      desenvolver:
        "Uma forma de pedir pausa que continue disponível quando a fala já não está.",
      comoFazer:
        "Escolham juntos um sinal curto: uma palavra, um gesto de mão, um cartão no bolso. Combinem o que acontece quando ele aparece — e cumpram sempre. Se o sinal não funcionar uma vez, ela não usa mais.",
      falar:
        "\"Quando você fizer esse sinal, a gente para na hora, sem discussão. Vale pra mim também.\"",
      treinoCalmo:
        "Ensaiem em momento tranquilo, inclusive de brincadeira: ela faz o sinal, vocês param na hora. Umas cinco vezes bobas valem mais que a explicação.",
      interesse:
        "O sinal pode vir do universo dela: o gesto de pause do videogame, a palavra que o personagem usa. Quanto mais dela for, mais ela lembra na hora certa.",
      maisFacil:
        "No começo, quem faz o sinal é o adulto — mostrando que percebeu. Depois ela assume.",
      progressao:
        "Vocês oferecem a pausa → vocês fazem o sinal → ela usa com lembrete → ela usa sozinha antes da escalada.",
      observar:
        "Ela usa o sinal? Em que momento — cedo ou já perto do auge? Depois da pausa, ela consegue voltar?",
      naoUsar:
        "O sinal não pode virar saída de qualquer demanda difícil sem retorno. Ele compra uma pausa, não o fim da tarefa — e essa parte precisa estar combinada desde o começo.",
    }),
  },
  {
    titulo: "Caça ao sinal nos personagens: reconhecer de fora antes de reconhecer em si",
    quando_usar:
      "Quando a criança ainda não consegue perceber o próprio começo de escalada, mas gosta de histórias, desenhos ou jogos.",
    tags: ["emocional", "sinais precoces", "brincadeira", "interesse", "autoconhecimento"],
    faixa: [4, 10],
    peso: 0.8,
    origem: "KOLO · treinar a habilidade fora da situação quente; interesse como ponte",
    corpo: bloco({
      desenvolver:
        "A habilidade de identificar sinais de escalada — treinada primeiro em outra pessoa, onde não custa nada errar.",
      comoFazer:
        "Assistindo ou lendo junto, pause e pergunte: dá pra saber que ele vai explodir? Como? O que mudou na cara, na voz, no corpo? Deixem a pausa curta e voltem para a história — isso é brincadeira, não aula.",
      falar:
        "\"Olha, ele ainda não gritou. Mas dá pra ver que já tá quase. Como você viu?\"",
      interesse:
        "Use exatamente o que ela já ama. O personagem favorito é o melhor professor de sinais que existe, porque ela já conhece cada expressão dele.",
      maisFacil:
        "Comece por sinais bem visíveis — cara fechada, punho cerrado — antes dos sutis, como ficar quieto demais.",
      progressao:
        "Reconhecer no personagem → reconhecer em vocês → reconhecer nela depois do episódio → reconhecer nela no momento.",
      observar:
        "Ela acerta os sinais dos outros? Começa a comentar espontaneamente? Em algum momento ela transporta para si — \"eu também fico assim\"?",
      proximoPasso:
        "Quando ela reconhecer bem de fora, combinem o sinal dela — é a prática do sinal combinado.",
    }),
  },
  {
    titulo: "O mapa da escalada desta criança: do primeiro sinal até o pico",
    quando_usar:
      "Quando a família quer saber em que ponto ainda dá para fazer alguma coisa, e o que já não funciona mais depois de certo momento.",
    tags: ["emocional", "sinais precoces", "escalada", "observar", "auge"],
    faixa: [3, 14],
    peso: 0.85,
    origem: "KOLO · escalada em estágios com intervenção correspondente",
    corpo: bloco({
      desenvolver:
        "Um mapa dos estágios desta criança específica — porque o que funciona no começo quase nunca funciona no auge.",
      comoFazer:
        "Escrevam quatro linhas, com o que vocês veem nela: começando · subindo · auge · voltando. Ao lado de cada uma, uma única coisa que já funcionou ali. É normal a coluna do auge ficar quase vazia — e essa é justamente a descoberta: no auge sobra segurança e presença, o resto vem antes ou depois.",
      falar:
        "No começando, o que funciona costuma ser oferta, não pergunta: \"vem cá\" em vez de \"o que foi?\".",
      treinoCalmo:
        "Se ela tiver idade e vontade, montem o mapa juntos. Ela costuma saber descrever o próprio auge melhor que qualquer adulto.",
      progressao:
        "Preencher o depois → preencher o durante → identificar o começando → agir no começando.",
      observar:
        "Quanto tempo passa entre o primeiro sinal e o auge? Esse tempo aumenta conforme vocês entram mais cedo?",
      proximoPasso:
        "O Registro Diário serve para acompanhar por duas semanas se a entrada precoce está encurtando os episódios.",
      naoUsar:
        "Se há agressão com risco imediato, a prioridade é segurança física — o mapa é trabalho para depois, não durante.",
    }),
  },
  {
    titulo: "O que fazer no sinal: uma ação combinada, escolhida por ela",
    quando_usar:
      "Quando o primeiro sinal já é conhecido, mas ninguém sabe o que fazer nele.",
    tags: ["emocional", "sinais precoces", "regulacao", "escolha"],
    faixa: [4, 14],
    peso: 0.85,
    origem: "KOLO · envolver a criança na solução; movimento como recurso testável, não regra (AUTOR: Siegel & Bryson)",
    corpo: bloco({
      desenvolver:
        "Um repertório curto de saídas que a criança escolheu — e por isso lembra na hora.",
      comoFazer:
        "Em momento calmo, listem juntos três coisas que já ajudaram alguma vez: beber água, ir para outro cômodo, apertar algo, correr, ficar em silêncio, abraço apertado, um pouco de música. Ela escolhe as três. Depois, no sinal, vocês oferecem a lista dela — não uma sugestão nova.",
      falar:
        "\"Você quer a água ou o cantinho?\" Duas opções, não uma pergunta aberta — no sinal, escolher entre muitas coisas já é demais.",
      treinoCalmo:
        "Testem as três num dia bom, sem estar precisando. Assim vocês descobrem qual funciona antes de precisar dela.",
      interesse:
        "Se a coisa que a organiza é um assunto ou objeto específico, ele pode ser uma das três — como recurso de regulação, não como prêmio por ter se acalmado.",
      progressao:
        "Vocês oferecem as duas opções → ela escolhe → ela pede a que quer → ela usa sozinha.",
      observar:
        "Qual das três ela mais escolhe? Alguma piora em vez de ajudar? Movimento acalma ou acelera esta criança? Não existe resposta universal — o que vale é o que acontece com ela.",
      naoUsar:
        "Não ofereça uma estratégia que vocês leram e ela nunca testou. No momento do sinal, coisa nova é mais uma exigência.",
    }),
  },
];

// ── carga ────────────────────────────────────────────────────────────────
const gravar = process.argv.includes("--gravar");
const env = Object.fromEntries(
  (await import("node:fs")).readFileSync("apps/web/.env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const linhas = REGISTROS.map((r) => ({
  titulo: r.titulo,
  quando_usar: r.quando_usar,
  versao_conversa: r.corpo,
  versao_curta: r.quando_usar,
  texto_original: r.corpo,
  resumo: r.quando_usar,
  skills_relacionadas: ["emocional"],
  tags: r.tags,
  perfis_aplicaveis: [],
  atividades_praticas: [],
  faixa_etaria_min: r.faixa[0],
  faixa_etaria_max: r.faixa[1],
  peso_relevancia: r.peso,
  nivel: null,
  // `origem` tem CHECK constraint no banco e hoje só aceita "admin" — os 371
  // registros existentes usam esse valor. A proveniência AUTOR/CIÊNCIA/KOLO,
  // que o material editorial exige preservar, vai em `referencia_bibliografica`.
  // Ampliar o enum seria migração, e migração não é escopo desta amostra.
  origem: "admin",
  referencia_bibliografica: r.origem,
  status: "rascunho",
  versao: 1,
}));

console.log(`${REGISTROS.length} registros · status=rascunho · skill=emocional\n`);
for (const r of REGISTROS) {
  console.log(`  ${r.faixa[0]}-${r.faixa[1]}a  peso ${r.peso}  ${r.titulo}`);
}

if (!gravar) {
  console.log("\n(dry-run — use --gravar para inserir)");
  process.exit(0);
}

const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/boas_praticas`, {
  method: "POST",
  headers: {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  },
  body: JSON.stringify(linhas),
});
if (!res.ok) {
  console.error(`\nFALHOU ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const gravados = await res.json();
console.log(`\n✅ ${gravados.length} gravados como rascunho — fora da recuperação de produção.`);
