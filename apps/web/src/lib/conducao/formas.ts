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
 * formas que realmente ajudam naquele caso, e escreve título curto em negrito.
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

/** Só as formas. Uma linha cada, sem exemplo longo — o exemplo é o que incha. */
const REPERTORIO = [
  "O que estou percebendo (só se reorganiza algo que ela não tinha juntado)",
  "O que eu faria primeiro",
  "O que você pode dizer (uma fala pronta, curta)",
  "Uma atividade / uma brincadeira",
  "Uma ideia usando algo que ele ama",
  "O que evitar",
  "Vamos testar (combinar alguns dias e ver)",
  "O que observar",
  "Uma pequena mudança na rotina",
  "Como conduzir essa passagem (antes / durante / depois)",
  "Uma ideia que pode estar pesando (uma crença, quando aparece na fala dela)",
  "Outra forma de olhar para isso",
  "O que estamos construindo (realidade de hoje + o que é possível + o passo)",
  "Próximo passo",
].join("\n- ");

/**
 * O bloco condicional. Recebe o tema ativo (se houver) e o canal, porque o
 * negrito é diferente nos dois: WhatsApp usa `*um asterisco*`, a web usa
 * markdown. A mesma forma, dois renderizadores.
 */
export function formasDeEntrega(params: {
  canal: "whatsapp" | "web";
  tema?: string | null;
}): string {
  const negrito = params.canal === "whatsapp" ? "*Assim*" : "**Assim**";
  const rotulo = params.tema ? rotuloDoTema(params.tema) : null;

  return `# Como ORGANIZAR esta resposta

Isto é uma ENTREGA: componha de 2 a 4 blocos curtos, cada um com um título curto em negrito (${negrito}) e duas ou três linhas embaixo. Os títulos saem deste repertório — escolha os que ajudam DE VERDADE aqui, adapte as palavras, nunca use todos:
- ${REPERTORIO}

- OS BLOCOS SÃO FORMAS DIFERENTES DE AJUDAR NA MESMA FRENTE. Eles NÃO autorizam abrir duas dificuldades no mesmo turno: se ela trouxe três problemas, você escolhe UM e entrega bem.
- 2 blocos certos valem mais que 4 pra encher. Se só há um tipo de ajuda a dar, escreva em texto corrido e não use título nenhum.
- Título curto (2 a 5 palavras) e humano. Nada de "BLOCO 1", "Orientações", "Considerações finais". No máximo um emoji por resposta, e só se significar algo. Sem despedida protocolar.${
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
