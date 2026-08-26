import { rotuloDoTema } from "./temas";
import type { NaturezaDoTurno } from "./fronteiras-forma";

/**
 * A NOTA DE PROPORÇÃO — R4a, 26/08/2026.
 *
 * ⚠️ POR QUE UMA NOTA CALCULADA, E NÃO SÓ O PRINCÍPIO NO FORMATO. O princípio
 * ("a menor resposta que ajuda vence") já está em `FORMATO_WHATSAPP` e vale em
 * todo turno. Mas princípio é o que o modelo aplica sozinho, e MEDI o resultado
 * disso: p50 de 666 caracteres, 38,5% acima de 800, e uma resposta de 620
 * caracteres para uma mensagem de 12. O Core já mandava ser curto e perdia.
 *
 * O que não perde é o CÓDIGO dizer qual é a natureza deste turno — que ele sabe
 * de forma determinística, por `naturezaDoTurno` — em vez de esperar que o
 * modelo a deduza junto com todo o resto.
 *
 * ⚠️ NÃO É TETO RÍGIDO, e a diferença importa. Os números são referência de
 * ordem de grandeza, ditos como referência; a instrução que manda é a de
 * PRESERVAR (segurança, orientação, personalização, fala pronta). Um teto duro
 * no prompt produziria a resposta mutilada que a fronteira de forma existe para
 * não produzir — e MEDI que 55,4% dos turnos passariam de um teto cego.
 *
 * ⚠️ `tecnico` NÃO PEDE BREVIDADE. Encurtar um pedido de embasamento legal é
 * piorar: a resposta certa ali cita a lei inteira. A nota diz isso explicitamente
 * para que o princípio geral não vire pressão para responder raso.
 */
export function notaDeProporcao(natureza: NaturezaDoTurno): string {
  const linha: Record<NaturezaDoTurno, string> = {
    simples:
      "Esta mensagem é um cumprimento ou uma resposta curta. Responda no mesmo tamanho — poucas linhas, sem abrir assunto novo e sem despejar o que você sabe. Se não há o que ajudar ainda, uma frase e uma pergunta bastam. Referência: algo em torno de 350 caracteres.",
    continuacao:
      "Esta é uma continuação curta de um assunto que já está em pé. Não recomece nem reexplique o que já foi dito: siga de onde pararam, com o próximo passo. Referência: algo em torno de 500 caracteres.",
    orientacao:
      "Esta é uma situação concreta. Entregue uma orientação breve e aplicável hoje — o essencial primeiro, o detalhe só se ele muda a conduta. Referência: algo em torno de 700 caracteres.",
    tecnico:
      "Este é um pedido detalhado ou explicitamente técnico. Aqui o tamanho segue o pedido: NÃO encurte às custas da precisão, da citação correta ou do texto pronto que a pessoa vai usar. Responder raso aqui é pior do que responder longo.",
  };
  return `# Proporção desta resposta\n${linha[natureza]}`;
}

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
/**
 * FORMATO da resposta no WhatsApp — específico do CANAL (o resto da condução
 * vem do núcleo).
 *
 * ⚠️ MUDOU DE ENDEREÇO EM 24/08/2026, e a mudança é o conserto.
 *
 * Esta constante morava dentro de `lib/ayla/responder.ts` — o caminho Legacy.
 * O caminho OFICIAL (`experimental.ts`), que atende TODAS as famílias no
 * WhatsApp desde 17/08, não tinha como importá-la sem depender do Legacy que
 * queremos aposentar. Resultado MEDIDO nas respostas reais desde o rollout:
 *
 *   `##`/`###` .... 0,1% no Legacy → **9,6%** no Oficial
 *   `**negrito**` .. 0,8% no Legacy → **65,2%** no Oficial
 *   citação `>` .... 0,3% no Legacy → **22,2%** no Oficial
 *
 * O WhatsApp não renderiza nada disso. Dois em cada três recados da Ayla saíam
 * com asterisco cru na tela da família. Não era falta de acolhimento — MEDI que
 * o Oficial valida emoção MAIS que o Legacy (27,1% × 11,3%) — era falta de
 * disciplina de canal.
 *
 * Aqui, em `lib/conducao/`, os dois caminhos leem a MESMA regra. Uma correção
 * de formato deixa de precisar ser feita duas vezes.
 */
export const FORMATO_WHATSAPP = `# Formato (WhatsApp)
- Texto puro de WhatsApp: sem markdown (nada de **, ##, listas com - / •), sem aspas, sem rótulo, sem "Ayla:". Pra destacar uma palavra, *um asterisco só* (negrito do WhatsApp), com muita parcimônia.
- A MENOR RESPOSTA QUE REALMENTE AJUDA VENCE. Entregue primeiro o essencial — o que fazer agora. Acrescente detalhe só quando ele muda a conduta ou quando pedirem. Uma resposta completa que a pessoa não consegue ler no meio de uma crise ajudou menos que três frases certas.
- PROPORÇÃO COM O QUE FOI PEDIDO. Cumprimento ou confirmação curta ("oi", "sim", "isso") pede resposta curta — não abra assunto novo nem devolva um bloco. Uma situação concreta pede uma orientação breve e prática. Uma situação delicada ou complexa pode ocupar mais espaço. Um pedido explicitamente técnico (lei, laudo, documento, medicação) pede o tamanho que o pedido exige — aí encurtar é errar.
- NUNCA corte o que decide: a orientação principal, a ressalva de segurança ou incerteza, o que é específico DESTA criança, a frase pronta quando é ela que ajuda, e o que observar quando há mesmo algo a decidir depois. O que se corta é a repetição do que ela acabou de contar, a explicação que ninguém pediu, a alternativa que você mesma não recomendaria e o passo que não muda nada hoje.
- No máximo UMA pergunta por vez.
- Não dê moldura clínica que ela não pediu ("é comum no TEA", "nessa fase") — o nome do quadro não ajuda no momento; fale do dia a dia.
- ROTINA VISUAL e PLANO completo têm fluxo próprio, com cartões ilustrados e PDF: não é aqui que a rotina inteira da semana é montada. Mas SEMPRE responda a pergunta que ela fez — "que horário encaixo o iPad?", "como você faria a tarde?" — com o que você já sabe da sequência dela; PROPONHA o horário, diga em uma frase por que, e deixe claro que é sugestão e dá pra ajustar. Mandar ela esperar um fluxo em vez de responder é deixá-la sem nada. E o convite do fim é pelo que ela quer MUDAR ou pelo que ela vai reparar testando — NUNCA peça de novo o que já está no contexto ("me conta como é a tarde de vocês" depois de usar a tarde dela na resposta soa como quem não leu).
- Não prometa artefato: nada de "vou montar", "vou gerar", "vou te mandar" quando não é você quem entrega. Ou já está feito, ou você diz o caminho.`;

/**
 * O IDIOMA DA CONVERSA — e o nome já é a regra.
 *
 * ⚠️ POR QUE NÃO É A `DIRETRIZ_IDIOMA` DO LEGACY. Aquela tem 581 tokens e entra
 * em TODO turno. A investigação de 24/08 mediu o que ela realmente compra no
 * modelo que atende as famílias hoje (`gpt-5.6-luna`, Core v9), em teste
 * controlado:
 *
 *   · inglês  — respondeu em inglês SEM a diretiva (1/1);
 *   · espanhol longo — espanhol limpo em 3 de 4 SEM ela; **1 de 4 escorregou
 *     para português no meio da resposta**;
 *   · espanhol curto — limpo sem ela.
 *
 * Ou seja: o modelo já acerta o idioma sozinho quase sempre. O que sobra é UM
 * modo de falha — vazar português dentro de uma resposta que não é em português
 * — e é só isso que precisa de regra. Os outros ~468 tokens da versão antiga
 * são aula de gramática espanhola (enclíticos, artigo antes de nome próprio,
 * falsos amigos) que o modelo atual cumpre sem ser mandado.
 *
 * ⚠️ E NÃO SE DECIDE PELO CADASTRO. `family_accounts.idioma` define a língua da
 * PLATAFORMA e das mensagens PROATIVAS — o próprio código diz isso em
 * `configuracoes/conta/actions.ts` e em `traduzir.ts` ("a conversa reativa NÃO
 * passa por aqui"). Usar aquela coluna para escolher a língua da resposta seria
 * a fonte errada: a pessoa pode escrever em espanhol numa conta configurada em
 * português, e é a mensagem que manda.
 *
 * ⚠️ "PESSOA", não "mãe". Quem escreve pode ser pai, avó, tia ou o próprio
 * adolescente. A Kolo não presume.
 *
 * MEDI: 113 tokens contra 581 — 81% menor.
 */
export const IDIOMA_DA_CONVERSA = `# Idioma (leia por último)
Responda SEMPRE no idioma da ÚLTIMA mensagem da pessoa. A resposta INTEIRA num único idioma — nunca misture português com espanhol ou inglês, nem em conectivos. O contexto, o perfil e as notas podem vir em português: leia normalmente, mas ESCREVA na língua da pessoa (nomes próprios ficam como são). Mensagem curta ou ambígua ("ok", "😊"): siga o idioma que vocês já vinham usando.`;

/**
 * ESTE TURNO PEDE ESTRUTURA?
 *
 * A regra é conservadora de propósito: na dúvida, texto corrido. Uma resposta
 * boa em prosa nunca incomodou ninguém; um título em cima de um desabafo, sim.
 *
 * FORA (texto corrido): `crise`, `desabafo`, `duvida` pontual e `outro`.
 * DENTRO: `desafio` — o problema do dia a dia, que é onde a organização ajuda.
 *
 * ⚠️ ESTA REGRA JÁ EXISTIA TRÊS VEZES, escrita de três jeitos: `ehEntrega()` no
 * WhatsApp Legacy (sobre `sinais.desafio`), `intencao === "desafio"` na web
 * (`lib/ia/prompt.ts:199`), e nada no Oficial — que por isso formatava sempre.
 * Aqui ela passa a ter um nome e um dono. O Oficial e o Legacy chamam esta
 * função; a web ainda usa o literal — registrado, não corrigido nesta missão.
 *
 * As três exclusões extras (`regenerando`, `querPlano`, `precisaEscolherMembro`)
 * são do Legacy e continuam valendo lá: regenerar já tem instrução própria e
 * somar formato por cima é competir com ela; e o pedido de plano responde curto,
 * porque o plano vai no PDF.
 */
export function pedeEntregaEstruturada(p: {
  intencao?: string | null;
  regenerando?: boolean;
  querPlano?: boolean;
  precisaEscolherMembro?: boolean;
}): boolean {
  if (p.regenerando) return false;
  if (p.querPlano) return false;
  if (p.precisaEscolherMembro) return false;
  return p.intencao === "desafio";
}

export function formasDeEntrega(params: {
  canal: "whatsapp" | "web";
  tema?: string | null;
}): string {
  const tituloSintaxe = params.canal === "whatsapp" ? "*Assim*" : "## Assim";
  const rotulo = params.tema ? rotuloDoTema(params.tema) : null;

  return `# Que forma esta resposta pede

A FORMA NASCE DO QUE VOCÊ TEM A DIZER. Não há formato padrão: pode ser um parágrafo direto, uma orientação e uma pergunta, uma frase pronta, uma brincadeira explicada, dois caminhos comparados. Escolha o tipo de ajuda que ESTE caso pede — nenhum é obrigatório, a ordem não é preferência, e a maioria dos turnos pede um só:
- ${TIPOS_DE_AJUDA}

- TÍTULO (${tituloSintaxe}) SÓ QUANDO SEPARA COISAS DE NATUREZA DIFERENTE — orientação × brincadeira, hoje × próximos dias. Frases sobre o mesmo assunto são um parágrafo. Na dúvida, prosa.
- TÍTULO COM AS SUAS PALAVRAS, sobre o que ele abre. Se parecer rótulo de seção ("O que eu faria primeiro", "O que observar"), não está dizendo nada e a resposta virou formulário.
- A MENOR FORMA QUE AJUDA VENCE. Numerar passos e fechar com "o que observar" é o gabarito de novo, sem título — não é o formato padrão. Numere só se a ordem importa; observe só se há algo a decidir depois. Se cabe em três frases, são três frases.
- NÃO abra duas dificuldades no turno: se ela trouxe três problemas, escolha UM e entregue bem.
- No máximo um emoji, e só se significar algo. Sem despedida protocolar.${
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
