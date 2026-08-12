import { getAylaAnthropicClient, AYLA_MODEL } from "./anthropic";
import { CHAVES_TEMA } from "@/lib/conducao/temas";

/**
 * Classificador do TURNO da Ayla — o que a mãe/pai quer (intenção) e sobre o
 * que se está falando (tema), em vez de casar palavras-chave (que sempre vaza:
 * "vamos desenhar a rotina" ou "queria organizar os dias dele" escapavam do
 * regex). Roda no modelo leve (Haiku).
 *
 * O TEMA entrou aqui em 02/08/2026 e NÃO custou chamada nova: esta chamada já
 * acontecia a cada mensagem. O que ela devolvia era uma palavra; agora devolve
 * duas. É todo o "tema ativo" — sem tabela, sem coluna, sem migração.
 *
 * Usado como sinal PRIMÁRIO no roteamento do orchestrator; os `pede*` de regex
 * ficam como reforço (OR). Em falha, devolve "outro" e o regex decide.
 */

/** O que o turno é (intenção) E sobre o que ele é (tema). */
export type TurnoClassificado = {
  intencao: IntencaoAyla;
  tema: string | null;
  /**
   * A mãe está ACEITANDO algo que a Ayla acabou de oferecer? Vem em UMA frase,
   * com o que foi aceito ("montar uma história social sobre chegar num grupo").
   *
   * Existe porque "sim" não carrega conteúdo: sem referente resolvido, o modelo
   * reconstrói o turno a partir da conversa inteira e responde outra coisa.
   */
  aceite: string | null;
  /**
   * QUAL REPERTÓRIO CONSULTAR — a skill principal, e no máximo uma
   * complementar. `[]` quando não há catálogo, quando o modelo não teve
   * confiança, ou quando o campo veio inválido.
   *
   * ⚠️ Isto NÃO é a Camada 1 da skill. Aqui só se decide ONDE buscar; o
   * `objective`/`tone`/`scope`/`limits` entram depois, na conversa, quando a
   * skill já foi escolhida. Por isso o classificador recebe apenas
   * `name` + `routing_keywords` — mandar a filosofia inteira seria pagar
   * raciocínio de domínio para uma decisão de roteamento.
   */
  skills: string[];
};

/** O que o classificador precisa saber de cada skill — e nada além disso. */
export type SkillDoCatalogo = {
  name: string;
  routing_keywords: string[];
};

export type IntencaoAyla =
  | "rotina_criar" // montar/criar/desenhar/organizar uma rotina visual
  | "rotina_ver" // ver/trazer uma rotina já existente de um dia
  | "rotina_editar" // ajustar uma rotina existente
  /**
   * Precisa de ORGANIZAÇÃO: sequência, previsibilidade, saber o que vem
   * depois, atravessar uma passagem que trava. NÃO diz que precisa de rotina —
   * diz que o assunto é este. Quem decide o tamanho (orientação, sequência
   * curta ou o período inteiro) é a prontidão, depois.
   */
  | "organizacao"
  | "plano" // ajuda/estratégia/plano pra um desafio específico
  | "outro"; // desabafo, contar o dia, dúvida, cumprimento, história, desenho

/**
 * O 4º CAMPO, isolado numa função pura — porque ele é o novo e os outros três
 * já decidem a conversa de famílias reais.
 *
 * REGRA DE OURO: nada aqui pode lançar, e nada aqui pode devolver um nome que
 * não esteja no catálogo. Qualquer entrada estranha vira `[]`, e `[]` significa
 * "não consulte repertório nenhum" — que é o comportamento de hoje, antes deste
 * campo existir. O pior caso do campo novo é o produto de ontem.
 *
 * O catálogo é `permitidas` de propósito: em runtime só chegam as skills
 * `ativo=true`, então uma skill desligada nomeada pelo modelo é descartada aqui,
 * sem precisar de um segundo filtro lá na frente.
 */
export function parseSkills(bruto: string | undefined, permitidas: readonly string[]): string[] {
  if (!bruto || permitidas.length === 0) return [];
  const validas = new Set(permitidas);
  const vistos = new Set<string>();
  const out: string[] = [];
  // Vírgula é o separador combinado, mas o modelo às vezes usa "e" ou "/".
  // Aceitar os três é barato; o filtro contra o catálogo é que dá a segurança.
  for (const parte of bruto.split(/[,/;]|\se\s/)) {
    // Só letras e underscore: mata pontuação, aspas, numeração e sobra de
    // raciocínio ("skills: foco"), sem precisar prever cada formato.
    const nome = parte.trim().replace(/[^a-z_]/g, "");
    if (!nome || !validas.has(nome) || vistos.has(nome)) continue;
    vistos.add(nome);
    out.push(nome);
    // Uma principal + no máximo uma complementar. Três skills é sinal de que o
    // modelo listou tudo que encostou no assunto, e aí o repertório recuperado
    // deixa de ser sobre o problema da família.
    if (out.length === 2) break;
  }
  return out;
}

/**
 * SEPARA OS QUATRO CAMPOS — e conserta o erro que o Haiku comete de verdade.
 *
 * Medido em chamadas reais (06/08/2026), com o campo novo no prompt: o modelo
 * às vezes emite só TRÊS campos e coloca a skill onde deveria estar o aceite.
 *
 *   «outro|aprendizado|motor»     → aceite virava "motor", e a skill sumia
 *   «plano|motor|foco|-»          → aceite virava "foco"
 *   «plano|autonomia|—|autonomia» → correto
 *
 * O primeiro caso é o grave: `aceite` é campo VIVO, lido pelo orquestrador pra
 * resolver o referente de um "sim". Um aceite falso ("motor") faz a Ayla
 * responder a coisa errada — que é o incidente de 04/08 de novo, por outra
 * porta.
 *
 * O conserto usa o CATÁLOGO como desambiguador, e é seguro por construção: um
 * aceite de verdade é uma FRASE ("montar uma história social sobre chegar num
 * grupo"), nunca um nome solto de skill. Se vieram só três campos e o terceiro é
 * exatamente um nome do catálogo, aquilo é a skill deslocada — não um aceite.
 *
 * ⚠️ Só age quando faltam campos. Com os quatro presentes, cada um fica onde
 * está: o comportamento dos três antigos não muda.
 */
/**
 * O VÍNCULO COM O PLANO EM PREPARAÇÃO — o quinto campo.
 *
 * ⚠️ ELE RESPONDE UMA PERGUNTA SÓ: "esta mensagem tem a ver com a pergunta que
 * ficou pendente?". Não é intenção, não é tema, e não decide artefato nenhum.
 *
 * `nao_sei` e `mudou_assunto` são desfechos distintos de propósito: o primeiro
 * é ausência de leitura, o segundo é uma leitura. Os dois levam ao mesmo lugar
 * hoje — não capturar —, e separá-los é o que permite medir depois quantas
 * vezes o classificador simplesmente não soube.
 */
export type VinculoComPlano = "responde" | "continua" | "mudou_assunto" | "cancela" | "nao_sei";

const VINCULOS: readonly string[] = ["responde", "continua", "mudou_assunto", "cancela", "nao_sei"];

/**
 * ⚠️ NA DÚVIDA, `nao_sei` — e nunca `responde`. Capturar uma mensagem para o
 * Plano errado é pior que perder uma retomada: a mãe teria uma informação sobre
 * o sono virando dado de um plano de comunicação, ou pior, do irmão.
 */
function parseVinculo(bruto: string | undefined): VinculoComPlano {
  const v = (bruto ?? "").trim().toLowerCase();
  return (VINCULOS as string[]).includes(v) ? (v as VinculoComPlano) : "nao_sei";
}

export function separarCampos(
  raw: string,
  permitidas: readonly string[],
): {
  intencao: string;
  tema: string;
  aceite: string;
  skills: string[];
  vinculo: VinculoComPlano;
} {
  const p = raw.split("|");
  const intencao = p[0] ?? raw;
  const tema = p[1] ?? "";
  let aceite = p[2] ?? "";
  let skills = parseSkills(p[3], permitidas);
  // ⚠️ ADITIVO: só existe quando o turno perguntou algo do Plano. Modelo antigo,
  // 4 campos, campo ausente ou lixo → `nao_sei`, e `nao_sei` não captura nada.
  const vinculo = parseVinculo(p[4]);

  // Três campos e o terceiro é um nome de skill puro → a skill escorregou.
  if (p.length === 3 && skills.length === 0) {
    const deslocada = parseSkills(aceite, permitidas);
    if (deslocada.length > 0) {
      skills = deslocada;
      aceite = ""; // não havia aceite; havia skill no lugar errado
    }
  }
  return { intencao, tema, aceite, skills, vinculo };
}

/** O bloco de skills do prompt — só nome e keywords, nunca a Camada 1. */
function blocoSkills(catalogo: readonly SkillDoCatalogo[]): string {
  if (catalogo.length === 0) return "";
  const linhas = catalogo
    .map((s) => `- ${s.name}: ${(s.routing_keywords ?? []).slice(0, 15).join("; ")}`)
    .join("\n");
  return `

O QUARTO CAMPO é a SKILL — qual repertório a Ayla deve consultar pra ajudar nesta situação.

${linhas}

Regras da skill:
- SEMPRE QUATRO CAMPOS. Se não houver aceite, escreva "-" no TERCEIRO campo e a skill no QUARTO. Nunca pule um campo: "outro|aprendizado|motor" está ERRADO — o certo é "outro|aprendizado|-|motor".
- As frases acima são EXEMPLOS do que as famílias dizem, não uma lista pra casar palavra. Escolha pelo SIGNIFICADO da situação. "fica muito tempo desenhando, mas na lição levanta" é foco, mesmo sem bater com nenhuma frase.
- Devolva UMA skill (a principal — a que melhor organiza o problema AGORA).
- Devolva uma SEGUNDA, separada por vírgula, SÓ quando ela acrescentar repertório realmente necessário. Ex.: "reconhece as letras mas não controla o lápis" → motor,aprendizado. Não escolha duas por segurança.
- Nunca mais que duas.
- Se nenhuma servir, ou se você não tiver confiança, deixe o campo VAZIO. Campo vazio é melhor que skill errada.
- Use EXATAMENTE os nomes da lista, em minúscula. Nunca invente nome.`;
}

export function montarSystem(catalogo: readonly SkillDoCatalogo[]): string {
  const comSkills = catalogo.length > 0;
  return (
    `Você classifica a INTENÇÃO da última mensagem de uma mãe/pai falando com a Ayla (assistente de famílias atípicas), no WhatsApp. Entenda a INTENÇÃO, não palavras exatas.

Responda em UMA linha, no formato: ${comSkills ? "intencao|tema|aceite|skills" : "intencao|tema|aceite"}
(a intenção e o tema em minúscula; o aceite em texto normal, ou "-" quando não houver${comSkills ? "; a skill em minúscula, ou vazio quando não houver" : ""})

A INTENÇÃO é uma destas:
- rotina_criar: quer MONTAR / criar / desenhar / organizar uma rotina visual (de um dia ou da semana). Ex.: "quero uma rotina", "vamos desenhar a rotina do Davi", "me ajuda a organizar melhor os dias dele", "preciso de rotina visual", "poderia montar um quadro pra ele?".
- rotina_ver: quer VER / que você TRAGA uma rotina JÁ montada de um dia. Ex.: "traz a rotina de hoje", "mostra a de terça", "me manda a rotina de amanhã".
- rotina_editar: está PEDINDO pra você ajustar uma rotina que ela já montou. Ex.: "faltou o lanche na terça", "tira o vôlei da quarta", "muda a rotina de hoje".
- organizacao: traz uma NECESSIDADE DE ORGANIZAÇÃO — previsibilidade, sequência, saber o que vem agora e depois, atravessar a passagem de uma atividade pra outra, enxergar o que vai acontecer. Ela não precisa falar "rotina". Ex.: "ele não entende o que vem depois", "queria mostrar pra ela o que vai acontecer", "quando sai do videogame pro banho vira uma briga", "preciso que ele veja primeiro banho e depois história", "como faço pra ela saber o que vem depois?", "ela demora pra sair, mas quando aviso antes ela vai".
  ⚠️ Isto NÃO decide que ela precisa de uma rotina. A maioria destes casos se resolve com orientação; outros com uma sequência curta. Quem escolhe é a etapa seguinte — você só está dizendo que o assunto é organização/transição.
  ⚠️ CONTAR UM EPISÓDIO NÃO É ISSO. "ele fez uma birra enorme no banho hoje", "hoje foi horrível", "ela chorou na escola" = outro. Aqui ela está contando o dia, e a conversa comum é a resposta certa. "organizacao" é quando há um PADRÃO ("todo dia", "toda vez", "sempre que") ou um pedido de previsibilidade.
- plano: quer ajuda / estratégia / um plano pra um DESAFIO específico (sono, birra, escola, transição, comida, crise...). Ex.: "me ajuda com o sono dele", "ele não quer ir à escola", "o que faço nas crises?", "a hora do banho tá impossível".
- outro: qualquer outra coisa — contar como foi o dia, desabafo, dúvida geral, cumprimento, pedir história ou leitura de desenho.

Regras importantes:
- "a rotina dele tá difícil / bagunçada" NÃO é rotina_criar — é desabafo/pedido de ajuda (plano ou outro). rotina_criar é quando ela quer CONSTRUIR o quadro.
- CONTAR o que aconteceu NÃO é pedido, mesmo com verbos de mudança. "tive que chamar alguém pra arrumar o vazamento", "mudei o quarto dele", "tirei ele da natação", "hoje já está melhor" = outro. rotina_editar só quando ela pede que VOCÊ mude o quadro de rotina dela.
- Rotina aqui é só o QUADRO VISUAL de etapas. Falar da rotina da casa, do trabalho, da vida = outro.
- Na dúvida entre uma intenção de rotina e outro, escolha outro: mexer na rotina dela sem ela pedir é pior do que deixar de mexer.
- Na dúvida entre plano e outro, escolha outro.
- "organizacao" × "plano" — o teste é UM: a mensagem localiza a dificuldade NO MOMENTO DE MUDAR de uma coisa pra outra? Ela aparece como "de X pra Y", "quando acaba o", "na hora de sair/ir", "depois que chega", "quando aviso que vai", "se perde na ordem". Se sim, organizacao. Se a dificuldade é descrita DENTRO de uma atividade só, é o comportamento, e é plano.
  Compare, que é a mesma cena: "toda hora do banho ele bate e grita" → PLANO (o que trava é o banho em si; nenhuma passagem foi nomeada). "toda vez que precisa parar de brincar e ir pro banho ele bate e grita" → ORGANIZACAO (a briga está na passagem brincar → banho).
  Vale mesmo quando a reação é forte: "ela fica agressiva quando aviso que é hora de sair de casa" é organizacao — a agressão está amarrada no aviso da mudança. "ela está agressiva ultimamente" é plano.
  E vale ao contrário: "não consegue fazer tarefa, perde o foco" é plano (habilidade); "não consegue COMEÇAR a tarefa depois que chega da escola" é organizacao (a passagem escola → tarefa).
- Na dúvida entre "organizacao" e "outro": episódio isolado é outro; padrão que se repete é organizacao.
- ACEITAR UMA OFERTA É DIFERENTE DE RESPONDER UMA PERGUNTA — e este é o teste: na última fala, a Ayla OFERECEU fazer alguma coisa ("se quiser, eu monto…", "quer que eu…", "posso montar…"), ou PERGUNTOU pra entender melhor?
  Se ofereceu e a mensagem de agora aceita ("sim", "quero", "vamos", "pode fazer", "faz", "sim, por favor", "vamos montar uma história"), então: a INTENÇÃO é a da coisa oferecida — mas SÓ quando a oferta era de um ARTEFATO: ofereceu montar a rotina visual → rotina_criar; ofereceu o PLANO estratégico (o PDF) → plano. Oferecer "pensar numa estratégia", "uma ideia", "uma história", "te ajudar com isso" é CONVERSA: intencao = "outro", e o aceite diz o que era. Aceitar uma ideia não pode abrir uma ferramenta que ela não pediu, e o campo "aceite" descreve em uma frase O QUE ela aceitou, puxando da própria oferta ("montar uma história social sobre chegar num grupo de crianças").
  Caso real (04/08/2026): a Ayla ofereceu montar uma história pro Gustavo, a mãe respondeu "Sim. Vamos montar uma história." — e recebeu uma resposta sobre não poder dar diagnóstico. O "sim" não tinha referente, e o modelo respondeu a conversa inteira em vez do que ela aceitou.
  ⚠️ A FALA DA AYLA QUASE SEMPRE TEM AS DUAS COISAS — ela pergunta E oferece na mesma mensagem ("Me conta o que você reparar. E se quiser, a gente pode montar uma história…"). Nesse caso, olhe pro que a MÃE respondeu: se ela retomou a COISA OFERECIDA ("vamos montar uma história", "quero a rotina", "pode fazer o plano"), é ACEITE — mesmo que a Ayla também tenha perguntado algo. Só é resposta-a-pergunta quando ela responde o CONTEÚDO da pergunta ("ele grita", "na escola", "depois que ele já fez").
  ⚠️ OFERTA COM DUAS OPÇÕES + "sim" É AMBÍGUO: aceite = "-" e intencao = "outro". Quem pergunta qual das duas é a Ayla, na resposta.
- RESPOSTA A UMA PERGUNTA NÃO É PEDIDO. Se a Ayla acabou de perguntar algo e a mensagem é curta ("sim", "não", "às vezes", "depois que ele já fez", "na escola", "ele grita"), ela está RESPONDENDO — a intenção é "outro", sempre. Uma mensagem sem verbo de pedido não abre ferramenta nenhuma. Caso real (02/08/2026): a Ayla perguntou "ele já fez xixi quando pega a fralda?", a mãe respondeu "Depois q ele já fez", e isso virou rotina_editar — no meio de uma conversa sobre desfralde ela recebeu "não achei uma rotina pra ajustar".
- Os TEMAS listados no contexto (o que a família marcou no cadastro) servem SÓ para escolher o tema. Eles NUNCA indicam intenção: ver a palavra "rotina" na lista de temas não significa que ela está pedindo uma rotina agora.
- Responda SÓ a linha.

O TEMA é o assunto do desenvolvimento sobre o qual se está falando. Use EXATAMENTE uma destas chaves, ou "-" se nenhuma servir:
${CHAVES_TEMA.join(", ")}

Regras do tema — errar aqui faz a Ayla perder o fio da conversa:
- CONTINUIDADE MANDA. Se a mensagem segue o mesmo assunto, ou é curta/ambígua ("sim", "e aí?", "não deu certo", "e de manhã?"), REPITA o tema anterior. Não recomece.
- Só troque quando ela REALMENTE abrir outro assunto do desenvolvimento.
- Se ela acabou de ESCOLHER um tema (você ofereceu os desafios dela e ela respondeu "alimentação", "o sono", "vamos pelo foco"), esse é o tema.
- Assunto que não é do desenvolvimento (preço, acesso ao app, saudação, o dia dela) → "-"; mas se havia tema anterior e isso foi só uma pausa, mantenha o anterior.
- Nunca invente chave fora da lista.` + blocoSkills(catalogo)
  );
}

export async function classificarIntencao(params: {
  texto: string;
  /** Última fala da Ayla, se houver — ajuda a entender respostas curtas. */
  ultimaAyla?: string | null;
  /** Fala anterior da mãe — dá o fio quando a mensagem de agora é curta. */
  ultimaMae?: string | null;
  /** Tema do turno anterior. É o que impede o classificador de recomeçar. */
  temaAnterior?: string | null;
  /** O que a família marcou no cadastro — o tema costuma nascer daqui. */
  temasOnboarding?: string[];
  /**
   * As skills que este turno PODE escolher — `name` + `routing_keywords`, e
   * nada além disso.
   *
   * Em runtime o chamador passa só as `ativo=true`: uma skill desligada nem
   * chega ao prompt, então não há como ser roteada pra família real. Em teste,
   * o conjunto pode ser explícito (incluindo as inativas) pra medir o desenho.
   *
   * Ausente ou vazio = o campo de skill nem entra no prompt, e o retorno é
   * `skills: []` — exatamente o comportamento anterior a este campo existir.
   */
  catalogoSkills?: readonly SkillDoCatalogo[];
}): Promise<TurnoClassificado> {
  const texto = (params.texto ?? "").trim();
  const anterior = params.temaAnterior ?? null;
  const catalogo = params.catalogoSkills ?? [];
  const permitidas = catalogo.map((s) => s.name);
  // Sem texto não há o que classificar — mas o tema não se perde por isso.
  if (!texto) return { intencao: "outro", tema: anterior, aceite: null, skills: [] };
  try {
    const user = [
      // ⚠️ Rotulado com força de propósito. Sem o rótulo, esta linha derrubava
      // a classificação: com os 6 desafios de uma família real no prompt, a
      // mensagem "Depois q ele já fez" era classificada como ferramenta em 13
      // de 20 execuções (plano 11x, rotina_editar 1x, rotina_ver 1x). Ver a
      // palavra "rotina" na lista bastava para o modelo achar que a mãe pedia
      // uma rotina. Com o rótulo, a lista volta a servir só ao tema.
      params.temasOnboarding?.length
        ? `(TEMAS que a família marcou no cadastro — servem SÓ pra escolher o tema, NUNCA indicam que ela está pedindo algo agora: ${params.temasOnboarding.join(", ")})`
        : "",
      anterior
        ? `(Tema do turno anterior: ${anterior} — mantenha se a conversa continuar nele)`
        : "",
      params.ultimaMae ? `(Antes ela tinha dito: "${params.ultimaMae.slice(0, 220)}")` : "",
      params.ultimaAyla ? `(A Ayla acabou de dizer: "${params.ultimaAyla.slice(0, 220)}")` : "",
      `Mensagem da mãe/pai: "${texto.slice(0, 500)}"`,
      "Resposta:",
    ]
      .filter(Boolean)
      .join("\n");

    const client = getAylaAnthropicClient();
    const resp = await client.messages.create({
      model: AYLA_MODEL,
      // 24 bastavam pra "intencao|tema". Com o "aceite" — uma frase — a
      // resposta era cortada no meio e o campo saía com sobra de raciocínio.
      max_tokens: 100,
      system: montarSystem(catalogo),
      messages: [{ role: "user", content: user }],
    });
    const b = resp.content[0];
    const raw = (b?.type === "text" ? b.text : "").toLowerCase();

    // ⚠️ A ORDEM DOS TRÊS PRIMEIROS NÃO MUDA. `skills` entrou como QUARTO campo
    // justamente pra que a posição de intenção, tema e aceite continue a mesma.
    // `separarCampos` ainda corrige o caso, medido em produção, em que o modelo
    // emite três campos e põe a skill no lugar do aceite — protegendo o aceite
    // de virar "motor" ou "foco".
    const campos = separarCampos(raw, permitidas);
    const ladoIntencao = campos.intencao;
    const ladoTema = campos.tema;
    const ladoAceite = campos.aceite;
    const i = ladoIntencao ?? raw;

    // Ordem importa: checar os específicos antes de "rotina" solto.
    const intencao: IntencaoAyla = i.includes("rotina_criar")
      ? "rotina_criar"
      : i.includes("rotina_ver")
        ? "rotina_ver"
        : i.includes("rotina_editar")
          ? "rotina_editar"
          : i.includes("organizacao") || i.includes("organização")
            ? "organizacao"
            : i.includes("plano")
              ? "plano"
              : "outro";

    // Só aceita chave do vocabulário. Fora da lista = como se não tivesse dito
    // nada, e aí o tema anterior continua valendo: perder o fio é pior do que
    // ficar um turno com o tema levemente atrasado.
    const candidata = (ladoTema ?? "").trim().replace(/[^a-z_]/g, "");
    const tema = CHAVES_TEMA.includes(candidata) ? candidata : anterior;

    const bruto = (ladoAceite ?? "").trim();
    const aceite = bruto && bruto !== "-" && bruto.length > 3 ? bruto.slice(0, 200) : null;

    return { intencao, tema, aceite, skills: campos.skills };
  } catch (e) {
    console.warn("[ayla:intent] classificação falhou:", e instanceof Error ? e.message : e);
    // Fallback seguro: o regex/reativo decide a intenção, e o tema não se perde.
    return { intencao: "outro", tema: anterior, aceite: null, skills: [] };
  }
}
