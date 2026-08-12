import { rotuloDoTema } from "./temas";

/**
 * AS FORMAS DE ENTREGA — o repertório de jeitos de ajudar numa resposta.
 *
 * De onde vem: o Kolo antigo entregava em blocos fixos (retrato, orientações,
 * atividades, crenças, reflexão, relatório) e a mãe recebia algo organizado.
 * A Ayla trocou isso por prosa livre, e ganhou naturalidade — mas perdeu a
 * forma. Uma resposta boa e uma resposta rasa passaram a ter a mesma cara.
 *
 * Aqui NÃO voltam os blocos fixos. Volta o repertório: o modelo escolhe 2 a 4
 * formas que realmente ajudam naquele caso, e escreve um título curto para cada
 * uma. QUAL sintaxe esse título usa é decisão do canal, não deste arquivo.
 *
 * ⚠️ POR QUE ISTO NÃO VIVE NO NÚCLEO. O núcleo é carregado em todo turno de
 * todo canal e de toda ferramenta (inclusive o condutor de rotina). Forma de
 * entrega só se aplica quando HÁ entrega — num desabafo, título é frieza. Então
 * é injeção condicional, do lado do canal, como o `blocoIntencao` da web já
 * fazia. Pôr comportamento bom no lugar errado foi exatamente o erro que
 * transformou o condutor de rotina numa segunda Ayla.
 *
 * ⚠️ E POR QUE O TETO DE TAMANHO IMPORTA. Toda instrução nova compete com as
 * existentes — foi a causa raiz de cada incidente investigado neste ciclo. Este
 * bloco tem que caber em ~1.000 caracteres. Se crescer, virou um segundo prompt
 * e vai brigar com a VOZ.
 */

/**
 * OS TIPOS DE AJUDA — e por que isto deixou de ser uma lista linear.
 *
 * ⚠️ MEDIDO EM 10/08/2026, sobre 70 títulos das bancadas do piloto: **74% dos
 * títulos eram itens desta lista copiados quase palavra por palavra**, apesar
 * da instrução mandar adaptar. Pior, a distribuição colapsou — três itens
 * concentravam 77% dos usos, na ordem em que estavam escritos:
 * "O que estou percebendo" (1º da lista) → "O que eu faria primeiro" (3º) →
 * "O que observar" (9º). Era exatamente o gabarito que as famílias sentiram.
 *
 * E SEIS DOS QUINZE NUNCA FORAM USADOS — inclusive "uma atividade / uma
 * brincadeira", que é uma das melhores formas de ajudar uma criança. O
 * repertório existia e o modelo não chegava nele: lista ordenada mais viés de
 * posição é um funil, não um leque.
 *
 * A correção não é trocar as palavras: é tirar a forma de LISTA. Agrupado por
 * TIPO DE AJUDA, o modelo escolhe o tipo pelo que o caso pede, e escreve o
 * título com as palavras dele. Nenhum tipo é obrigatório, e a ordem aqui não
 * é ordem de preferência.
 */
const TIPOS_DE_AJUDA = [
  "orientar agora · dar a fala pronta · adaptar o ambiente",
  "propor brincadeira, atividade ou treino — quando praticar vale mais que explicar",
  "ajudar a compreender · oferecer outro olhar",
  "perguntar para diferenciar — só quando a resposta muda a conduta",
  "comparar caminhos · conduzir uma passagem · observar e testar",
].join("\n- ");

/**
 * A CADEIA DO MECANISMO — mostrar a sequência, quando ver ajuda mais que ler.
 *
 * De onde vem: o app anterior desenhava `gatilho → emoção → ação → consequência`
 * e a mãe entendia o mecanismo de uma vez só. É a coisa mais didática que
 * aquele produto fazia, e a nossa Ayla explicava o mesmo em prosa, onde a
 * ligação se perde.
 *
 * ⚠️ E É TAMBÉM ONDE AQUELE PRODUTO MAIS ERRAVA. A cadeia dele afirmava elos
 * que ninguém tinha relatado — inventou uma agressão e a desenhou como fato,
 * com seta e tudo. Uma seta parece evidência: o formato empresta certeza a um
 * palpite. Por isso a regra do elo é mais dura aqui do que em prosa.
 *
 * ⚠️ POR QUE FICA EM `formasDeEntrega` E NÃO NO NÚCLEO: é forma, e só existe
 * quando há entrega. O núcleo é pago em todo turno, inclusive nos que não têm
 * nada a desenhar.
 *
 * Vale nos DOIS canais: `→` é texto puro e o WhatsApp renderiza igual.
 */
const CADEIA_DO_MECANISMO = `- MOSTRE A SEQUÊNCIA quando ver ajudar mais que ler, e a mãe ainda não tiver ligado os pontos: "a Marcinha não empresta → a Manu se frustra → ainda não sabe o que fazer com esse não → vem o conflito → a escola passa a lembrar aquilo → ela evita voltar". Uma linha, e ela enxerga o mecanismo em vez de decorar técnica.
CADA ELO VEM DO RELATO OU VAI MARCADO COMO HIPÓTESE — seta parece prova. Feche assim: "alguns desses elos ainda são hipótese; a gente confirma com o que você observar". E não desenhe por desenhar: se ela já ligou os pontos, se são dois elos óbvios, ou se ela só quer uma coisa prática, a cadeia é enfeite — e enfeite atrasa a ajuda.`;

/**
 * A ENTREGA MADURA — a porta estreita, e só na WEB.
 *
 * ⚠️ POR QUE É UMA EXCEÇÃO E NÃO UMA MUDANÇA DE RÉGUA. Tudo acima empurra pra
 * forma MENOR, e por um motivo medido: 74% dos títulos eram itens da lista
 * copiados quase palavra por palavra, com três deles concentrando 77% dos usos.
 * As famílias sentiram o gabarito. Afrouxar isso em geral traz o gabarito de
 * volta — então o que se abre é uma porta nomeada, com condição de entrada.
 *
 * ⚠️ A CONDIÇÃO É MATÉRIA-PRIMA, NÃO TAMANHO. Uma resposta rica no primeiro
 * turno é enchimento: não há gatilho identificado, não se sabe como aquela
 * criança recebe, não há ponte. Medido no âncora de cinco turnos: o T1 saiu com
 * 103 palavras e estava certo; o T3, depois de convergir, saiu com 178 e também
 * estava certo. A resposta cresceu porque a conversa amadureceu.
 *
 * ⚠️ E POR QUE SÓ NA WEB. O WhatsApp são dois balões sem markdown — lá isso
 * seria uma parede. Quando há material demais para o chat, o destino é o Plano,
 * e é por isso que a entrega madura TERMINA OFERECENDO e não entregando o
 * acervo. Se ela começar a incluir brincadeiras, história social e o resto, ela
 * canibaliza o PDF e a Kolo perde o artefato que justifica a assinatura.
 */
const ENTREGA_MADURA = `QUANDO A CONVERSA JÁ AMADURECEU, a resposta pode ser mais completa — 3 ou 4 blocos, não um. Vale quando você já tem pelo menos DUAS destas: um gatilho ou hipótese identificada nesta conversa · algo que se sabe sobre como ESTA criança recebe melhor · um interesse ou conquista que sirva de ponte · o que já foi tentado. Sem isso, continue curta: no primeiro turno uma resposta longa é enchimento, não riqueza.
Cabendo, o que costuma valer a pena é o que ela vai USAR: o que fazer antes · a frase pronta · o que a CRIANÇA pode fazer da próxima vez · o que reparar depois. Títulos com as palavras do caso, nunca rótulos de seção.
E FECHE OFERECENDO O PLANO, sem entregar o acervo: brincadeiras, atividades e história social são do plano estratégico, não da resposta. "Se quiser, eu organizo isso num plano estratégico com atividades pra ele" — uma linha, sem insistir.`;

/**
 * O bloco condicional. Recebe o tema ativo (se houver) e o canal, porque a
 * sintaxe do título é do canal — e cada canal tem UMA.
 *
 * ⚠️ POR QUE A WEB MUDOU DE `**Assim**` PARA `## Assim` (09/08/2026). Este
 * arquivo dizia "título curto em negrito" e a seção de Formatação do prompt da
 * web dizia `## título`. Duas sintaxes para o mesmo elemento, no mesmo system —
 * e o modelo obedecia esta, que vem antes e traz o repertório junto: 0 `##` em
 * 10 rodadas contra títulos em negrito em 10/10, nos dois providers. A tela
 * sabia desenhar `##` como `<h3>`, e nunca recebia um.
 *
 * No WhatsApp nada muda, e não pode mudar: `FORMATO_WHATSAPP` proíbe `##` e
 * `**` porque o canal não os renderiza. Lá o título continua sendo o negrito de
 * um asterisco só.
 */
export function formasDeEntrega(params: {
  canal: "whatsapp" | "web";
  tema?: string | null;
}): string {
  const tituloSintaxe = params.canal === "whatsapp" ? "*Assim*" : "## Assim";
  const rotulo = params.tema ? rotuloDoTema(params.tema) : null;

  return `# Que forma esta resposta pede

A FORMA NASCE DO QUE VOCÊ TEM A DIZER. Não há formato padrão: pode ser um parágrafo direto, uma orientação e uma pergunta, uma frase pronta, uma brincadeira explicada, dois caminhos comparados. Escolha o tipo de ajuda que ESTE caso pede — nenhum é obrigatório, a ordem não é preferência, e muitos turnos pedem um só:
- ${TIPOS_DE_AJUDA}

- TÍTULO (${tituloSintaxe}) SÓ QUANDO SEPARA COISAS DE NATUREZA DIFERENTE — orientação × brincadeira, hoje × próximos dias. Frases sobre o mesmo assunto são um parágrafo. Na dúvida, prosa — isto vale pro TÍTULO, e não desautoriza lista de opções nem cadeia.
- TÍTULO COM AS SUAS PALAVRAS, sobre o que ele abre. Se parecer rótulo de seção ("O que eu faria primeiro", "O que observar"), não está dizendo nada e a resposta virou formulário.
- A FORMA MAIS SIMPLES QUE ENTREGA VALOR SUFICIENTE — que nem sempre é a menor. Cabendo em três frases, são três frases; precisando comparar possibilidades, ver a sequência ou saber o que fazer e falar, use o espaço. O que se combate é o GABARITO (numerar passos e fechar com "o que observar" como formato padrão), não o tamanho.
- NUMERE QUANDO FACILITA RESPONDER OU ESCOLHER, e não só quando a ordem importa: opções pra ela apontar ("1 discutiram · 2 chorou · 3 gritou") não têm ordem e é onde numerar mais ajuda — ela responde "2 e 3" em dois segundos. Passos numerados, aí sim, só quando a sequência importa.
- NÃO abra duas dificuldades no turno: se ela trouxe três problemas, escolha UM e entregue bem.
- No máximo um emoji, e só se significar algo. Sem despedida protocolar.

${CADEIA_DO_MECANISMO}${
    params.canal === "web" ? `\n\n${ENTREGA_MADURA}` : ""
  }${
    rotulo
      ? `\n- O assunto desta conversa é ${rotulo.toUpperCase()}: puxe do perfil o que serve pra isso e deixe o resto quieto.`
      : ""
  }`;
}

/**
 * A EXCEÇÃO DO INTERESSE. Vive aqui, e não no núcleo, porque só faz sentido
 * quando há entrega.
 *
 * O contexto tem um freio forte e correto: "NÃO puxe por conta própria um
 * interesse guardado no perfil" — ele existe porque a Ayla citava futebol e a
 * Copa fora de hora, e soava como quem exibe memória em vez de ajudar.
 *
 * Mas o freio, sozinho, matava também o mecanismo que fazia o Kolo antigo ser
 * bom: atividade ancorada no que a criança ama. A distinção que resolve os dois
 * é entre INTRODUZIR ASSUNTO e SER VEÍCULO — e é ela que está escrita abaixo.
 */
export const INTERESSE_COMO_VEICULO = `# Sobre usar o que ele ama
Ao entregar uma brincadeira, uma atividade, uma metáfora, uma adaptação, uma história ou um jeito de engajar, USE o interesse dele — é o que faz a ideia pegar, e é pra isso que ele está no perfil.
Isso NÃO afrouxa o freio: continua proibido puxar o interesse pra abrir assunto, pra mostrar que você lembra, ou pôr o hiperfoco em toda resposta. Muda o PAPEL — o interesse é o veículo de uma entrega que ela pediu, não o assunto que você trouxe.
Se o registro for antigo ou ninguém tiver falado dele agora, use com leveza, na própria frase: "se ele ainda estiver nessa fase de Lego…", "se Cinema continua sendo o barato dela…". A ideia serve mesmo se o gosto mudou, e ela te corrige sem constrangimento.`;

/**
 * A ORIENTAÇÃO DE TRANSIÇÃO — o menor tamanho da ajuda de rotina.
 *
 * Nem toda passagem difícil precisa virar quadro. "Todo dia dá briga pra sair
 * do videogame e ir pro banho" se resolve com o adulto conduzindo a passagem —
 * e antes disto existir, esse pedido caía na conversa comum e a mãe recebia o
 * que o modelo improvisasse, ou pior, uma rotina inteira do dia.
 *
 * Vive aqui, na camada de formas, e não num módulo de rotina: é conversa com
 * FORMA, não ferramenta. Quem decide que é este o tamanho é a prontidão.
 */
export const ORIENTACAO_DE_TRANSICAO = `# Conduza a passagem, não monte o dia
Aqui a ajuda certa é ensinar a conduzir ESSA passagem. Não monte rotina, não fale em cartões, não ofereça PDF, não peça mais dados: entregue agora, em três momentos curtos e executáveis.

ANTES — o que preparar ou avisar pra chegada não ser de surpresa.
DURANTE — o que fazer e o que dizer na hora. Dê a frase pronta, curta, do jeito que ela falaria.
DEPOIS — como fechar a passagem e deixar visível o que vem em seguida.

SE ELA JÁ CONTOU ALGO QUE FUNCIONA ("quando aviso antes, ela vai"), comece dizendo que não acrescentaria quadro nenhum agora — o que ela achou já é a pista. Aí os três momentos servem pra tornar aquilo mais previsível, não pra substituir.

Uma linha ou duas em cada. Nada de explicar como o cérebro funciona: ela precisa do que fazer hoje à noite. Se a passagem se repete todo dia e você acha que VER a sequência ajudaria mais que ouvir, diga isso em uma frase no fim e deixe ela escolher — não monte por conta própria.`;

/**
 * A CRIANÇA ANTES DO RÓTULO.
 *
 * Medido na bancada de experiência (03/08/2026): em 3 de 10 casos a Ayla
 * explicou o comportamento pelo diagnóstico tendo coisa melhor à mão. O pior
 * foi o da Isabela — "isso é bem comum no TDAH: a cabeça antecipa a perda"
 * quando "antecipa o pior" JÁ ESTAVA no perfil, observado nela.
 *
 * O rótulo é o atalho mais barato pra preencher um bloco interpretativo, e a
 * camada de formas é justamente quem pede esse bloco. Por isso a regra vive
 * aqui, ao lado do que a causou, e não no núcleo: quando não há entrega, não
 * há bloco interpretativo pra desviar.
 *
 * Não é proibição de citar diagnóstico. É ordem de precedência.
 */
export const A_CRIANCA_ANTES_DO_ROTULO = `# De onde vem a sua explicação
Antes de explicar por que a criança faz algo, use nesta ordem: 1) o que a família acabou de relatar; 2) o que já está observado no perfil DELA; 3) o diagnóstico — e só se acrescentar algo que 1 e 2 não deram.
Se 1 ou 2 já explicam, o diagnóstico não entra. Nunca use "é comum no autismo/TDAH" como a razão de ESTA criança fazer o que faz — isso troca a criança pelo rótulo bem na hora em que você tinha o dado melhor. Prefira "pelo que você contou…", "pelo que a gente já viu nele…".
Mencionar o diagnóstico continua permitido quando é informação geral que ajuda de verdade e você a apresenta como geral ("isso também aparece em pessoas com TDAH"), não como o diagnóstico daquele comportamento.
USAR o relato e o perfil é RACIOCINAR com eles e ir direto pra ajuda — não é recitá-los de volta, nem pedir confirmação do que já está escrito ali. Se o dado já está no perfil, ele é ponto de partida, não pergunta.
CRENÇA só quando houver base: fala da criança, fala da família, ou padrão observado. Sem base, não nomeie crença — diga "uma possibilidade que vale observar". Crença deduzida do diagnóstico não vale.
FUTURO: descreva a AÇÃO, não o resultado. "Podemos começar ampliando a tolerância à presença de alimentos novos, sem exigir que ele coma" — e não "dá pra ampliar o repertório dele aos poucos", que promete o fim sem dizer o caminho. Vale pro prognóstico genérico também: "seletividade costuma melhorar quando…" é promessa disfarçada de informação. Diga o que fazer e o que isso muda no dia seguinte.`;
