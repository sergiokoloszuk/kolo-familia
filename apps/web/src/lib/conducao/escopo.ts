/**
 * ESCOPO — o que a Ayla está AFIRMANDO, separado do que ela está apenas ESCREVENDO.
 *
 * Por que isto existe (bancada A/B de 05/08/2026, 180 respostas medidas): a rede
 * de fronteiras disparou em 30% das respostas do Claude, e a maioria era falso
 * positivo. Cada disparo custa uma segunda chamada inteira ao modelo e pode
 * substituir uma resposta certa por uma pior. Os quatro que apareceram:
 *
 *   "Não é normal, não — vale avaliar."        → minimiza_saude
 *   "A visita pode esperar." (dentro da história) → decide_atendimento
 *   "não diga 'ela tem TDAH'"                   → afirma_condicao
 *   "Antes de mudar qualquer outra coisa…"      → opina_sobre_medicacao
 *
 * A correção NÃO é uma exceção por frase. As quatro têm a mesma causa: os
 * detectores rodavam sobre um texto SEMANTICAMENTE PLANO. `normalizar()`
 * colapsava `\n` em espaço, o filtro de recusa/citação juntava o resto com " "
 * (deixando os padrões casarem ATRAVÉS do buraco), e nenhum deles distinguia
 * quem está falando nem em que modo.
 *
 * Aqui o texto vira UNIDADES classificadas, e só as ASSERÇÕES vão para os
 * padrões. As cinco classes:
 *
 *   assercao      — a Ayla afirmando algo à família. Só esta é analisada.
 *   recusa        — a Ayla enunciando a própria fronteira ("não consigo dizer se é")
 *   citacao       — fala de terceiro ou trecho entre aspas ("provavelmente autista")
 *   personagem    — texto de história/roteiro escrito PARA a criança
 *   metalinguagem — instrução sobre o que dizer ou não dizer ("não diga que ela tem X")
 *
 * DECISÃO: determinístico, sem LLM. Um classificador de intenção aqui custaria
 * uma chamada por resposta no caminho mais quente do produto, e um detector de
 * segurança que depende de outro modelo herda a variância dele.
 *
 * ⚠️ CONSERVADOR POR CONSTRUÇÃO. Toda exclusão exige marcador EXPLÍCITO. Sem
 * abertura declarada de história, não há bloco de personagem; sem moldura de
 * fala, não há metalinguagem. Na dúvida, a unidade continua sendo asserção e a
 * fronteira dispara — perder um falso positivo é barato, perder um verdadeiro
 * positivo é o incidente de 01/08.
 */

/** Sem acento, sem markdown, caixa única, espaço colapsado. Por UNIDADE. */
export function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[*_`~#>]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

export type TipoUnidade =
  | "assercao"
  | "recusa"
  | "citacao"
  | "personagem"
  | "metalinguagem";

export type Unidade = { texto: string; tipo: TipoUnidade };

/**
 * METALINGUAGEM — a classe que resolve "não diga que ela tem TDAH".
 *
 * A oração não é sobre a criança; é sobre a FALA. O objeto de "diga" é o que
 * NÃO deve ser dito, então tudo depois do verbo está sob a moldura e não é
 * afirmação da Ayla. Vale para as duas direções: proibir ("não diga X", "evite
 * chamar de X") e substituir ("em vez de dizer X, diga Y").
 *
 * Não confundir com a Ayla ENTREGANDO uma frase pronta ("você pode dizer: …") —
 * essa também não é asserção clínica dela, e cai em `citacao` pelas aspas.
 */
const METALINGUAGEM = new RegExp(
  "\\b(" +
    // proibitiva
    "(nao|nunca|jamais|evite|evita|nada de|sem)\\s+(precisa\\s+)?(dizer|diga|digas|falar|fale|usar|use|chamar|chame|rotular|rotule|afirmar|afirme|comentar|comente|explicar como|apresentar como)" +
    // substitutiva
    "|(em vez de|no lugar de|ao inves de|melhor que)\\s+(dizer|falar|usar|chamar|rotular|afirmar)" +
    // sobre a própria formulação
    "|(a palavra|o termo|a expressao|essa frase|a frase)\\s+" +
    ")",
);

/**
 * RECUSA — a fronteira dita em voz alta. Herdada dos dois detectores, que
 * mantinham cópias quase iguais desta expressão.
 *
 * "eu não consigo dizer se é ou não é autismo" contém, literalmente, "não é
 * autismo" — e é a resposta CERTA.
 */
const RECUSA = new RegExp(
  "\\b(nao (consigo|posso|vou|da(ria)? (pra|para)|tenho como)|eu nao sei|impossivel)\\s+" +
    "(te )?(dizer|afirmar|concluir|garantir|falar|responder|saber|graduar|estimar|cravar|chutar|apostar|separar|distinguir|diferenciar|opinar)" +
    "|\\b(so|somente|apenas) (quem (pode|consegue|sabe)|um[a]? (medic|neuro|psicolog|psiquiatra|profissional|especialista))" +
    "[^.!?]{0,50}(dizer|afirmar|concluir|avaliar|diagnosticar|responder)",
);

/** CITAÇÃO — fala de terceiro, trazida para ser acolhida ou rebatida. */
const CITACAO = new RegExp(
  "\\b(a gente (ouve|escuta)|as pessoas (dizem|falam)|(dizem|falam|ouvem) que|te (dizem|disseram|falaram)|" +
    "(sua|seu|minha|meu) (sogra|mae|pai|irma|marido|avo)[^.!?]{0,20}(diz|disse|acha|falou)|" +
    "(a|o) (professora|professor|pediatra|medica|medico|escola|terapeuta|fono)[^.!?]{0,20}(diz|disse|acha|achou|falou|desconfi|levantou)|" +
    // ⚠️ "pelo que voce contou" NÃO entra aqui, e a tentação é grande: parece
    // citação e não é. É a Ayla RACIOCINANDO a partir do relato — e a oração
    // que vem depois é conclusão dela. Com essa moldura ligada, "pelo que você
    // contou, ela é autista mesmo" deixava de disparar (regressão pega pela
    // suíte, 06/08/2026). Citação é fala de TERCEIRO, não do interlocutor.
    "ouvir que|quando (te )?dizem|" +
    "(ouvir|escutar|dizem|falam)[^.!?]{0,12}(e so (uma )?fase|nao (e|tem) nada))",
);

/**
 * ABERTURA DE HISTÓRIA — só marcador EXPLÍCITO abre um bloco de personagem.
 *
 * O texto de uma história social é escrito PARA a criança, em terceira pessoa e
 * no presente, e frases como "a visita pode esperar" ou "isso é normal no
 * consultório" ali dentro não são orientação clínica à mãe. Antes desta camada
 * elas eram, porque `normalizar()` colapsava as quebras de linha e fundia a
 * história com a prosa em volta.
 */
const ABRE_HISTORIA = new RegExp(
  "\\b(aqui (esta|vai|vem) a (historia|historinha)|" +
    "a (historia|historinha) (do|da|de|fica|ficaria|pode ser assim|seria assim)|" +
    "(segue|te mando|escrevi|montei|fiz) a (historia|historinha)|" +
    "(uma |a )?(historia|historinha) (social )?(assim|pra ele|pra ela|do tipo)|" +
    "(pode|poderia) (ficar|ser) (mais ou menos )?assim|ficaria mais ou menos assim|" +
    // ANÚNCIO DE AUTORIA. O marcador nem sempre nomeia a história: na bancada,
    // o bloco começou com "Dá sim! Vou escrever aqui pra você agora." e o que
    // veio depois era o texto do personagem ("isso é normal no consultório" —
    // dito PARA o Enzo, sobre o cheiro do consultório). A classe é a mesma:
    // a Ayla anunciando que vai ESCREVER a peça, e não falando com a mãe.
    "vou (escrever|montar|fazer|criar|deixar) (aqui|isso|ela|uma|a )|" +
    "(escrevi|montei|fiz) (aqui|isso|uma|a ))\\b" +
    // A cauda é curta de propósito: a linha de abertura é um ANÚNCIO ("aqui
    // está a história do Gustavo:"), não uma frase que fala da história no meio
    // de um parágrafo. Sem esse limite, "a história do dentista que você contou
    // me ajudou a entender" abriria um bloco de personagem e engoliria o resto
    // da resposta. Com ele, só o anúncio abre.
    // Cauda curta, aceitando a pontuação final da linha ("…pra você agora.").
    "[^.!?]{0,25}[.:!]?\\s*$",
);

/**
 * RETOMADA — a história acabou e a Ayla voltou a falar com a mãe. Sem isto o
 * bloco de personagem engoliria o resto da resposta, e um vazamento real depois
 * da história passaria batido.
 */
const FECHA_HISTORIA = new RegExp(
  "^(leia|le |imprima|imprime|mostre|mostra|use|usa|voce pode|voces podem|depois (disso|que)|" +
    "na hora|no dia|antes (da|de)|repita|repete|guarde|guarda|se quiser|vale|dica|como usar|" +
    "o que (fazer|observar)|essa historia|a ideia|importante)\\b",
);

/**
 * Aspas de qualquer família. Trecho entre aspas não é asserção da Ayla — é a
 * fala de alguém, uma frase pronta pra mãe usar, ou uma palavra em destaque.
 */
const ASPAS = /["“”«»„](.{1,240}?)["“”«»„]|'([^']{2,240})'/g;

/**
 * O SEPARADOR das unidades preservadas.
 *
 * Precisa ser um terminador de frase, e não um espaço: os padrões dos
 * detectores usam janelas `[^.!?]{0,N}` para exigir proximidade, e juntar com
 * " " deixava a janela atravessar exatamente o trecho que tinha sido removido.
 * Era assim que um pedaço de uma oração casava com um pedaço de outra.
 */
const SEP = " . ";

/**
 * Molduras EXTRA de um detector específico.
 *
 * A recusa clínica sabe coisas que a de diagnóstico não sabe ("não sou eu que
 * ajusto dose", "quem prescreveu é quem decide") e vice-versa. O ESCOPO é
 * compartilhado; o vocabulário de cada fronteira continua sendo dela.
 */
export type Molduras = { recusa?: RegExp; citacao?: RegExp };

function classificar(
  clausula: string,
  dentroDeHistoria: boolean,
  extras: Molduras,
): TipoUnidade {
  if (dentroDeHistoria) return "personagem";
  if (METALINGUAGEM.test(clausula)) return "metalinguagem";
  if (RECUSA.test(clausula) || extras.recusa?.test(clausula)) return "recusa";
  if (CITACAO.test(clausula) || extras.citacao?.test(clausula)) return "citacao";
  return "assercao";
}

/**
 * Quebra o texto em unidades classificadas, preservando a estrutura de linhas —
 * que é o sinal que distingue o corpo de uma história da prosa em volta.
 */
export function segmentar(texto: string, extras: Molduras = {}): Unidade[] {
  const unidades: Unidade[] = [];
  let emHistoria = false;

  for (const linhaBruta of texto.split(/\r?\n/)) {
    const linha = normalizar(linhaBruta);
    if (!linha) continue;

    if (emHistoria && FECHA_HISTORIA.test(linha)) emHistoria = false;

    // Aspas saem ANTES de dividir em orações: o trecho citado pode conter
    // pontuação e partiria a oração no meio.
    const semAspas = linha.replace(ASPAS, SEP);

    const dentro = emHistoria;
    for (const bruta of semAspas.split(/(?<=[.!?;])/)) {
      const clausula = bruta.trim();
      if (!clausula) continue;
      unidades.push({ texto: clausula, tipo: classificar(clausula, dentro, extras) });
    }

    // A abertura marca a linha SEGUINTE — o próprio anúncio ("aqui está a
    // história do Gustavo:") é fala da Ayla e continua sendo analisado.
    if (!emHistoria && ABRE_HISTORIA.test(linha)) emHistoria = true;
  }

  return unidades;
}

/**
 * Só o que a Ayla AFIRMA, pronto pros padrões. As unidades preservadas são
 * unidas por um terminador de frase para que nenhuma janela atravesse o corte.
 */
/**
 * Só o que a Ayla AFIRMA, pronto pros padrões.
 *
 * O separador é parâmetro porque há duas famílias de análise:
 *
 *  - PROXIMIDADE (quase todos os padrões): usam janelas `[^.!?]{0,N}` para
 *    exigir que dois pedaços estejam perto. Aí o separador precisa ser um
 *    terminador de frase, senão a janela atravessa o corte e casa pedaços de
 *    orações diferentes — que é o bug original.
 *  - DOCUMENTO (`atribuicaoDistribuida`): pergunta se a resposta INTEIRA
 *    reparte duas condições sobre a mesma criança. Essa é multi-oração por
 *    natureza ("o que nela parece autismo é o sensorial; o que parece TDAH…"),
 *    e com terminador ela parava de enxergar as duas metades.
 */
export function textoAsseverado(
  texto: string,
  extras: Molduras = {},
  separador: string = SEP,
): string {
  return segmentar(texto, extras)
    .filter((u) => u.tipo === "assercao")
    .map((u) => u.texto)
    .join(separador);
}

/**
 * NEGAÇÃO — "não é normal" não afirma que é normal.
 *
 * Vale só para padrões de polaridade AFIRMATIVA. Muitos padrões já CODIFICAM a
 * negação ("nao precisa levar", "nao e nada demais") e para esses a negação é o
 * dano, não a defesa — por isso a polaridade é declarada em cada padrão e não
 * inferida aqui.
 *
 * A janela é curta e não atravessa pontuação: procura um negador imediatamente
 * antes do trecho casado, dentro da mesma oração.
 */
const NEGADOR = /\b(nao|nunca|jamais|nem|longe de|nada disso)\b[^.!?;]{0,24}$/;

export function negadoAntes(texto: string, indice: number): boolean {
  return NEGADOR.test(texto.slice(Math.max(0, indice - 60), indice));
}

/** Polaridade declarada por padrão. */
export type Polaridade = "afirmativa" | "ja_negativa";
export type Padrao = readonly [codigo: string, re: RegExp, polaridade?: Polaridade];

/**
 * Roda os padrões sobre o texto asseverado, aplicando a guarda de negação onde
 * ela vale. Compartilhado pelos dois detectores — a regra de escopo não pode
 * divergir entre eles.
 */
export function acharPadroes(
  texto: string,
  padroes: readonly Padrao[],
  extras: Molduras = {},
): Array<{ codigo: string; trecho: string }> {
  const norm = textoAsseverado(texto, extras);
  const achados: Array<{ codigo: string; trecho: string }> = [];
  for (const [codigo, re, polaridade = "afirmativa"] of padroes) {
    // `g` para poder tentar a próxima ocorrência quando a primeira está negada:
    // "não é normal, e sim algo que merece avaliação" não pode blindar uma
    // afirmação de "é normal" três frases depois.
    const global = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
    for (const m of norm.matchAll(global)) {
      if (polaridade === "afirmativa" && negadoAntes(norm, m.index ?? 0)) continue;
      achados.push({ codigo, trecho: m[0].slice(0, 120) });
      break;
    }
  }
  return achados;
}
