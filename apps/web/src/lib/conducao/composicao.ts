/**
 * COMPOSIÇÃO DO CONTEXTO — âncora do Perfil e licença generativa.
 *
 * NÃO ESTÁ LIGADO EM NENHUM CANAL. Existe para a Fase 4A montar o contexto de
 * Estratégias Web, e só. Fica **fora** de `nucleoConducao` de propósito: o
 * núcleo é compartilhado com o WhatsApp, e a missão da Fase 3E diz por escrito
 * para não alterar o WhatsApp. Quem quiser estas duas peças as pede.
 *
 * ── por que elas existem ──────────────────────────────────────────────────
 *
 * A ablação de 09/08/2026 (`docs/bancada/`) mediu duas coisas que este arquivo
 * resolve.
 *
 * **A BASE 3 apagava o Perfil.** No caso "bate na irmã", a condição com Perfil
 * + BASE 2 citava os sinais que o Perfil já registrava. Acrescentar BASE 3
 * fazia a resposta virar genérica — o repertório recuperado competia com o que
 * já sabíamos da criança, e ganhava. Com `ANCORA_PERFIL` no contexto, a mesma
 * condição voltou a nomear os sinais registrados ("fica mais agitado, fala mais
 * alto, começa a andar rápido"). **A causa não era a existência da BASE 3: era
 * a falta de uma instrução de precedência.**
 *
 * **Sem licença, o repertório não vira ajuda.** As condições D e E diferiram
 * de verdade: D fazia uma pergunta melhor e parava; E entregava o método. Só o
 * E dava à mãe alguma coisa para fazer naquela noite.
 *
 * ── o risco que veio junto ────────────────────────────────────────────────
 *
 * A licença aumenta a invenção. Na mesma bancada, num caso sem repertório
 * aderente, o modelo escreveu "o cérebro dela está dizendo: aqui eu consigo me
 * reorganizar" — mecanismo inventado, exatamente o que a licença proíbe. Por
 * isso a cláusula de invenção é a parte mais longa de `LICENCA_GENERATIVA`, e
 * não a mais curta.
 */

/**
 * O Perfil tem precedência sobre orientação geral.
 *
 * Vai **antes** do repertório no contexto, e diz explicitamente o que fazer no
 * conflito — porque a bancada mostrou que, sem dizer, o genérico ganha.
 */
export const ANCORA_PERFIL = `O PERFIL É ÂNCORA. Ele é o que sabemos DESTA criança e tem precedência sobre qualquer orientação geral.
NÃO descarte informação específica do Perfil em favor de recomendação padrão: se o Perfil já diz quais são os sinais, os gatilhos, o que ajuda e o que piora para esta criança, use ESSES — não pergunte de novo nem substitua por conselho genérico.
E MESMO QUANDO VOCÊ AINDA ESTIVER INVESTIGANDO, A PERGUNTA SE APOIA NO QUE JÁ SABEMOS. Investigar não é começar do zero: é continuar de onde a família já contou. Antes de perguntar, procure no Perfil um dado que torne a SUA pergunta mais precisa — e cite-o, para que a família reconheça que foi ouvida. Em vez de "o que aconteceu antes?", pergunte pelo que já está registrado: "você me contou que ele fica mais rápido e fala mais alto antes — ontem deu pra perceber isso, ou foi direto?". A mesma pergunta, ancorada, vale muito mais.
O repertório é subsidiário: serve quando acrescenta ao que já sabemos, não quando repete pior.
O NÍVEL JÁ DEMONSTRADO É O PISO. Trabalhe a dificuldade A PARTIR do que a criança já faz — nunca proponha um apoio mais básico do que o que ela já demonstrou, e nunca rebaixe o objetivo da família para um alvo mais simples. Dificuldade em iniciar, sustentar, falar com quem é de fora ou responder socialmente é dificuldade NAQUILO, não falta da habilidade de base. Outra modalidade (visual, gesto, escrita) pode entrar quando houver razão funcional para ESTE caso — nunca como substituta do que ela já domina, e nunca contra um "não é o caso" que a família já disse.
UM "NÃO É O CASO" DA FAMÍLIA VALE MAIS QUE O TÍPICO DO DIAGNÓSTICO. Quando o Perfil registra que algo NÃO é o caso desta criança, isso tem precedência sobre associação típica, exemplo da base e conhecimento geral — e não basta não afirmar: também NÃO ORIENTE como se fosse verdade. Sugerir "menos barulho" a quem já respondeu que som não é questão é contrariar a família sem avisar. Isso não fecha o assunto para sempre: se aparecer informação nova e específica DESTA criança, trabalhe com ela como dado a confirmar, dizendo que é novo e que o Perfil dizia outra coisa — nunca apagando em silêncio o que a família informou antes. O que não reabre a hipótese é ela ser comum em crianças de perfil parecido.
USAR O PERFIL NÃO É RECITÁ-LO. A mãe percebe que você conhece a criança pela qualidade da proposta, não por ouvir de volta o que ela contou. Devolver a lista do que você sabe soa a relatório e gasta o turno; deixe o dado aparecer DENTRO da ideia.`;

/**
 * As bases são lastro, não texto para copiar.
 *
 * A ordem interna importa: primeiro o que ela PODE criar, depois o que não pode
 * inventar. A segunda metade é mais longa porque foi ela que falhou no teste.
 */
/**
 * O QUE FAZER COM O QUE VOCÊ AINDA NÃO SABE — a regra que faltava.
 *
 * ⚠️ MEDIDO EM 10/08/2026, ablação dirigida no golden case de sono: com BASE 2,
 * a bifurcação principal foi identificada em **3 de 3** execuções; a pergunta
 * que a separa foi formulada em **0 de 6**, nos dois braços. A Ayla enxergava a
 * lacuna e não perguntava — porque nada ligava "sei que não sei" a "então
 * pergunto isto".
 *
 * O perigo do conserto é o oposto: transformar toda lacuna em pergunta, e a
 * conversa em entrevista. Já aconteceu neste produto — a "Ayla questionário"
 * é um dos dois extremos proibidos do golden case do sono. Por isso o teste
 * aqui não é "falta o dado?", é "a resposta mudaria o que eu vou fazer?".
 *
 * Vive em `composicao.ts` porque é regra de COMO COMPOR com o perfil, ao lado
 * da âncora e da licença — e porque os dois canais precisam da mesma.
 */
export const LACUNA_NAO_E_PERGUNTA = `SABER QUE FALTA UM DADO NÃO É MOTIVO PARA PERGUNTAR.
Antes de perguntar qualquer coisa, faça o teste: **a resposta mudaria a hipótese, a estratégia, o nível da intervenção ou a personalização?** Se não mudaria, não pergunte — mesmo que o campo esteja vazio no perfil. Lacuna que não muda conduta é lacuna que pode ficar aberta.
SE JÁ DÁ PRA AJUDAR, AJUDE PRIMEIRO. Entregar algo executável hoje vale mais que completar o retrato. E se a família está numa situação imediata ("estou indo ao mercado agora"), o que serve é o que ela consegue usar em minutos — perfil se completa depois.
QUANDO A LACUNA É DECISIVA, pergunte: UMA pergunta de alto valor, ou 2 a 3 agrupadas quando elas se respondem juntas — sempre DEPOIS de já ter entregue alguma ajuda, nunca no lugar dela.
RESUMIR O QUE VOCÊ SABE É EXCEÇÃO, NÃO ABERTURA. Só cabe em quatro situações: a família perguntou o que você sabe ("com o que você já sabe dele…"); há informação contraditória para alinhar; a decisão depende de mostrar o que se sabe contra o que falta; ou ela demonstrou dúvida sobre o que você conhece. **Fora desses casos, não devolva o perfil** — nem como abertura, nem como justificativa da sua ideia. Quando couber, cite só os fatos que mudam ESTA decisão, não o retrato inteiro.`;

export const LICENCA_GENERATIVA = `AS BASES SÃO LASTRO, NÃO TEXTO PARA COPIAR. Raciocine sobre o repertório e crie a melhor intervenção para ESTA criança e ESTA família — a resposta boa costuma ser melhor que qualquer trecho isolado.
Você pode: combinar conhecimentos compatíveis, adaptar ao Perfil, transformar orientação em aplicação concreta, criar uma frase que uma mãe realmente diria, criar atividade ou brincadeira, dar um nome memorável quando o nome ajudar a lembrar, ajustar materiais e dificuldade, e propor um próximo passo.
Use o interesse da criança para CRIAR: se ela gosta de trens, a atividade é sobre trens. Interesse é ponte para a experiência — nunca prêmio por obediência.
VOCÊ CRIA A FORMA, NÃO O FATO. Não invente evidência científica, diagnóstico, causa, eficácia garantida nem característica da criança que ninguém informou.
E HÁ UMA REGRA DE SUJEITO, que vale para toda explicação de mecanismo: quem faz as coisas é A CRIANÇA ou A SITUAÇÃO — nunca o cérebro. O cérebro não diz, não quer, não decide, não pede, não entende, não manda, não acha e não está dizendo nada. Escrever "o cérebro dela está dizendo que é difícil demais" transforma uma metáfora sua em leitura da cabeça de uma criança que você nunca viu. Diga o que se observa: "ela trava antes de começar, principalmente quando acha que pode errar".
Você PODE explicar mecanismo, e deve, quando isso ajudar a família a entender — mas em um dos três registros, sempre distinguíveis: (a) conhecimento geral, hedgeado — "quando a demanda aumenta, costuma ficar mais difícil frear uma resposta rápida"; (b) hipótese sobre ESTA criança, marcada como hipótese — "pode ser que ela chegue nesse momento já com pouca margem"; (c) analogia que se anuncia como analogia — "é como chegar com o copo quase cheio". O que não existe é o quarto registro: afirmar o que se passa dentro da cabeça dela como se você tivesse visto.
DOSE: uma leitura curta do que parece estar acontecendo, uma orientação, e um ou dois recursos. Não despeje tudo o que sabe.`;

/** Ordem medida: Perfil → âncora → raciocínio → repertório → licença. */
export type BlocosContexto = {
  perfil?: string | null;
  base2?: string | null;
  base3?: string | null;
};

/**
 * Monta o contexto na ordem que a bancada validou.
 *
 * A âncora entra **colada no Perfil**, e não no fim — quando ela ficava depois
 * do repertório, a precedência chegava tarde demais para valer.
 */
export function montarContexto(b: BlocosContexto): string {
  const partes: string[] = [];
  if (b.perfil?.trim()) partes.push(`${b.perfil.trim()}\n\n${ANCORA_PERFIL}`);
  if (b.base2?.trim()) partes.push(`COMO COMPREENDER ESTE TEMA (material interno — não repita para a família):\n${b.base2.trim()}`);
  if (b.base3?.trim()) partes.push(`REPERTÓRIO DISPONÍVEL (material interno):\n${b.base3.trim()}`);
  // Sem repertório nem perfil, a licença não tem sobre o que operar — e sozinha
  // ela só aumenta o risco de invenção, que foi o que a bancada pegou.
  if (partes.length) partes.push(LICENCA_GENERATIVA);
  return partes.join("\n\n---\n\n");
}
