import { getAylaAnthropicClient, AYLA_MODEL } from "./anthropic";

/**
 * A ROTINA DEVE SER GERADA AGORA?
 *
 * Irmão de `prontidao-plano.ts`, e pelo mesmo motivo. O Plano tinha um porteiro
 * explícito desde sempre; a Rotina não tinha nenhum — quem decidia era o próprio
 * modelo que estava gerando, no meio da geração, a partir de uma linha do
 * contrato ("se já dá pra montar, MONTE").
 *
 * O preço disso apareceu em produção (02/08/2026): uma mãe com uma bebê de 18
 * DIAS pediu ajuda pra "organizar as mamadas", e recebeu uma rotina afirmando
 * intervalo entre mamadas ("de 2 em 2 horas, às vezes de 1h30"), duração no
 * peito ("deixa ela esvaziar um lado antes de oferecer o outro") e quando pôr
 * pra dormir. Tudo isso é manejo clínico neonatal, saiu em PDF, e a mãe
 * imprimiu. Nada perguntou se aquilo devia ser gerado.
 *
 * O critério de produto está em `CRITERIO_SUFICIENCIA_ROTINA`, num lugar só e em
 * português, de propósito: é conteúdo pra Karina ler e ajustar sem caçar prompt.
 * Mesma decisão do Plano.
 *
 * ── MUDANÇA DELIBERADA DE PRODUTO, 08/08/2026 (D-R2 e D-R4 da SPEC) ──────────
 *
 * Duas regras escritas em 03/08 mudaram. Elas NÃO eram erro, e o que valia
 * nelas continua valendo:
 *
 *   • O ESCOPO exigia "qual PEDAÇO DO DIA", e isso deixava de fora o
 *     acontecimento único — "o Mario vem jantar hoje" caía em `falta_escopo`,
 *     que é o caso C da SPEC. Agora o recorte pode ser um evento. O motivo da
 *     regra antiga (não montar rotina no vazio) segue inteiro: o que mudou é
 *     que evento TAMBÉM é recorte, não que recorte deixou de ser exigido.
 *
 *   • O VISUAL exigia evidência prévia de que ver ajuda AQUELA criança, e
 *     dizia explicitamente que transição difícil não era evidência. Aquilo
 *     continha cartão gerado sem necessidade — custo de imagem e ruído na
 *     tela — e era um problema real. O que mudou foi a escolha: prefere-se
 *     OFERECER e deixar a família decidir a recusar apoio visual a quem não
 *     sabe pedir. Isso só é seguro porque `visual: true` não gera nada: ele
 *     faz a Ayla perguntar o tema, e `recusouTema` é a saída da mãe. A
 *     distinção que sobrou da regra antiga é a que importa — indício não é
 *     conclusão: transição difícil sugere OFERECER, nunca conclui que aquela
 *     criança precisa de apoio visual.
 */

/** O que precisa estar na mesa pra uma rotina sair ÚTIL (e não genérica). */
export const CRITERIO_SUFICIENCIA_ROTINA = `A PERGUNTA CENTRAL É UMA SÓ: com o que eu já sei, consigo gerar uma rotina útil e coerente? Se sim, GERE. Não continue investigando pra enriquecer.

O MÍNIMO pra gerar são DUAS coisas:
1. QUAL RECORTE — e ele pode ser de dois tipos:
   • um PEDAÇO DO DIA: a tarde depois da escola, a manhã até sair, a noite, o dia inteiro, um dia específico;
   • ou um ACONTECIMENTO, mesmo que aconteça UMA VEZ SÓ: um amigo que vem jantar, dentista, consulta médica, viagem, festa, visita, primeiro dia num lugar novo, mudança de casa. NÃO exija que se repita. A pergunta é sempre a mesma: existe uma sequência de acontecimentos em que ENXERGAR o que vem depois deixa a coisa mais previsível pra criança? Se existe, é caso de rotina — "o Mario vem jantar hoje" tem recorte, e o recorte é o evento.
2. UMA SEQUÊNCIA — o que acontece, na ordem, com as palavras da família ("chega 12h40, almoça, descansa, faz lição, futebol 15h30"). Bagunçada serve: organizar é seu trabalho. Não precisa de horário em tudo; precisa de ordem.

⚠️ A SEQUÊNCIA TEM QUE SER DESTA ROTINA. O que a família contou antes, sobre outro dia ou outro assunto, e a rotina que já existe no perfil, são CONHECIMENTO PRÉVIO: enriquecem (uma transição difícil, um horário fixo, um interesse) e NÃO valem como a sequência de agora. "Quero organizar a tarde da Manu" tem escopo e não tem sequência — mesmo que você saiba de cor a manhã dela, mesmo que ela tenha descrito o sábado passado inteiro. Isso é "falta", e a pergunta é a sequência.
Caso real (03/08/2026): esse pedido virou 14 etapas com passeio de barco e protetor solar, tudo herdado de uma conversa de horas antes. A mãe recebeu a rotina de um dia que ela não pediu.

⚠️ MAS QUANDO ELA MANDA USAR O QUE JÁ CONTOU, USE. "Já te contei os horários, agora monta", "usa o que eu te falei", "é aquela que acabei de passar", "monta com o que te mandei" — aí o histórico recente É a sequência, e segurar seria fazê-la repetir tudo. O que separa os dois casos é UMA coisa: ela APONTOU pro que já disse, ou você é que foi buscar?

O PONTO DIFÍCIL (onde trava, o que vira briga) ENRIQUECE muito, mas NÃO é requisito. Se você sabe, use — muda a granularidade das etapas. Se não sabe e já tem escopo e sequência, GERE assim mesmo. Segurar uma rotina pra descobrir onde trava é interrogatório.

NÃO é caso de gerar rotina quando:
- a pessoa não pediu organização do dia — pediu ajuda com um comportamento ("ele bate quando tiro o objeto"), com alimentação, com escola. Isso é conversa, e às vezes plano; rotina não resolve.
- o que trava NÃO é a sequência. Uma desregulação no mercado por barulho, luz e gente demais é sobrecarga sensorial: a criança sabe perfeitamente o que vem depois, e um quadro não muda nada. Empurrar rotina aí é oferecer a ferramenta que você tem em vez da ajuda que ela precisa. Ajude pelo caminho certo — e só ofereça a sequência se aparecer um pedaço que a previsibilidade resolva (a hora de ir embora, por exemplo).
- é crise acontecendo agora, desabafo ou sofrimento do adulto.
- a família falou de várias crianças e não ficou claro de quem é o dia.`;

/**
 * O LIMITE DE ATUAÇÃO — separado da suficiência de propósito.
 *
 * Suficiência é "tenho dados?". Limite é "isto é meu?". São perguntas
 * diferentes, e uma rotina pode ter todos os dados do mundo e mesmo assim
 * conter algo que não cabe à Kolo decidir.
 *
 * Isto NÃO é um catálogo de regras sobre recém-nascido — é uma distinção, e ela
 * vale pra qualquer idade. Organização é da Ayla; manejo clínico é de quem
 * acompanha a criança.
 */
export const LIMITE_DE_ATUACAO_ROTINA = `ORGANIZAÇÃO é sua. MANEJO CLÍNICO não é.

Você organiza: a sequência do dia, banho, trocas, descanso, sono como rotina, saídas, transições, o que a família registra, a logística de quem faz o quê — e a orientação que o profissional JÁ DEU, usada como a família contou, sem reinterpretar.

Você NÃO decide, pra esta criança: intervalo entre mamadas ou refeições, duração, quantidade, se precisa acordar pra comer, complemento ou fórmula, dose ou horário de remédio, se está mamando/comendo o suficiente, nem nenhum critério clínico de manejo. Isso vale com força redobrada pra bebê nos primeiros meses, onde quase toda pergunta de rotina é, no fundo, uma pergunta clínica.

Quando a rotina DEPENDER de um desses dados, não invente e não desista: pergunte o que o profissional já orientou ("o que a pediatra orientou sobre as mamadas?") e encaixe a resposta dela na rotina como dado relatado. Se ela não souber, monte o resto — o que dá pra organizar já ajuda — e diga com clareza que essa parte fica com a pediatra.`;

/**
 * O TAMANHO DA AJUDA — a menor que resolve.
 *
 * A decisão existia, mas ninguém a tomava: quando a mãe trazia "todo dia dá
 * briga pra sair do videogame", o porteiro devolvia `nao_e_rotina` e a conversa
 * seguia. Podia até sair boa — mas por omissão, não por escolha. E do outro
 * lado, quem entrava no fluxo só tinha um tamanho: rotina inteira, com PDF e
 * cartões, mesmo quando a passagem era uma só.
 *
 * Três tamanhos, e o critério em português pra Karina ajustar sem caçar prompt.
 */
export const CRITERIO_TAMANHO_ROTINA = `QUAL O TAMANHO DA AJUDA? A melhor intervenção não é a que usa mais recursos — é a MENOR que resolve.

- "orientacao": o adulto consegue resolver conduzindo a passagem. Uma transição só, e a criança entende quando a mãe fala. Entrega: o que fazer ANTES, DURANTE e DEPOIS. Nada é montado, nada é impresso.
- "mini": VER a sequência acrescenta — a criança precisa consultar o que vem agora e o que vem depois, em vez de a mãe repetir toda vez. É uma passagem ou um trecho curto: 2 a 4 etapas.
- "rotina": várias atividades de um período ou de um dia (a tarde, a manhã até sair, a noite, sábado). Aqui a organização é o que ajuda.

COMO ESCOLHER: comece pelo menor que possa resolver e só suba quando houver motivo. Sobe pra "mini" quando a família relata que apoio visual ajuda, quando a transição se repete todo dia, quando falar não basta, ou quando a criança precisa de previsibilidade. Sobe pra "rotina" quando são várias atividades em sequência.

⚠️ PEDIDO EXPLÍCITO NÃO SE REBAIXA. "quero uma rotina", "monta a rotina da tarde", "quero organizar o dia", "quero uma rotina visual" → é "rotina", mesmo que você ache que uma sequência curta bastaria. Se achar, DIGA isso na conversa e deixe a família escolher; não troque o pedido dela por baixo.`;

/** orientacao < mini < rotina. Na dúvida, o maior — nunca reduzir por acidente. */
export type TamanhoRotina = "orientacao" | "mini" | "rotina";

export type DesfechoRotina =
  /** Dá pra gerar agora. */
  | "suficiente"
  /** Pedido genérico: a família não disse O QUE quer organizar. NÃO é pergunta
   *  de dado — é hora de oferecer caminhos e deixar ela escolher. */
  | "falta_escopo"
  /** Escopo claro, mas falta UM dado que muda o artefato. */
  | "falta"
  | "nao_e_rotina"
  | "limite_atuacao";

export type ProntidaoRotina = {
  desfecho: DesfechoRotina;
  /** A menor ajuda que resolve. Só significa algo quando desfecho=suficiente. */
  tamanho: TamanhoRotina;
  /** VER a sequência acrescenta pra ESTA criança? Manda nos cartões. */
  visual: boolean;
  /**
   * A família APONTOU pro que já contou ("já te falei, agora monta")? Só então
   * o histórico anterior pode compor a sequência. Sem isso ele é contexto.
   */
  reusaHistorico: boolean;
  /** Preenchido quando desfecho = "falta": a ÚNICA pergunta que muda a rotina. */
  pergunta: string | null;
  /** Preenchido quando desfecho = "limite_atuacao": o que é da pediatra. */
  parteClinica: string | null;
  /** Por que — vai pro log, ajuda a calibrar o critério. */
  motivo: string;
};

const SEGURO = (motivo: string): ProntidaoRotina => ({
  desfecho: "falta",
  // Falha nunca reduz a ajuda: "rotina" é o fallback, e "falta" não gera nada
  // mesmo. Reduzir por acidente seria entregar menos do que a família pediu.
  tamanho: "rotina",
  visual: false,
  reusaHistorico: false,
  pergunta: null,
  parteClinica: null,
  motivo,
});

/**
 * O CONTRATO DO PORTEIRO, exportado para poder ser testado.
 *
 * Ele carrega decisões de produto (D-R2, D-R4) que só existem como texto. Sem
 * exportar, a única forma de prender essas decisões seria uma chamada real ao
 * modelo — cara, instável, e fora da suíte. Exportar não muda comportamento.
 */
export const CONTRATO_PRONTIDAO_ROTINA = `Você decide se a Ayla já pode MONTAR uma rotina visual pra uma família, ou se falta algo.

${CRITERIO_SUFICIENCIA_ROTINA}

${LIMITE_DE_ATUACAO_ROTINA}

${CRITERIO_TAMANHO_ROTINA}

Responda APENAS JSON, sem texto fora dele:
{"desfecho":"suficiente"|"falta_escopo"|"falta"|"nao_e_rotina"|"limite_atuacao","tamanho":"orientacao"|"mini"|"rotina","visual":true|false,"reusaHistorico":true|false,"pergunta":"...","parteClinica":"...","motivo":"..."}

- "suficiente": dá pra montar algo útil agora. pergunta=null.
- "falta_escopo": ela pediu rotina mas não disse O QUE quer organizar ("preciso de uma rotina", "tá tudo bagunçado", "quero organizar ele", "vi que vocês fazem rotina"). NÃO é falta de dado — é falta de rumo. pergunta=null: quem oferece os caminhos é a Ayla, do jeito dela.
  ⚠️ "falta_escopo" É SÓ PRA QUEM PEDIU E NÃO DISSE O QUÊ. Se ela NÃO pediu organização nenhuma e trouxe uma situação concreta ("ela demora pra sair de casa, mas quando aviso antes ela vai"), isso é "suficiente" com tamanho="orientacao" — já há situação, dificuldade e às vezes até algo que funciona. Oferecer "um período / o dia inteiro / um momento" pra quem já trouxe o momento é vender ferramenta em vez de ajudar. Quando ela já contou o que funciona, a ajuda é preservar isso e deixar a passagem mais previsível.
  ⚠️ A SEQUÊNCIA PODE DIZER O ESCOPO SOZINHA. Se ela já listou de ACORDAR a DORMIR ("acorda 6h, escola 7h30, almoço 12h, fono terça e sexta 14h, natação quarta 16h, jantar 20h, dormir 21h"), o escopo é o DIA INTEIRO e você tem tudo: é "suficiente", não "falta_escopo". Perguntar "quer o dia inteiro ou um período?" pra quem acabou de descrever o dia inteiro é não ter lido (caso real, 04/08/2026).
  ⚠️ UM ACONTECIMENTO JÁ É ESCOPO. "o Mario vem jantar hoje", "temos dentista quinta", "vamos viajar sábado" dizem QUAL é o recorte — o evento. Não devolva "falta_escopo" pra eles; o que falta ali é a sequência (o que acontece, na ordem), então é "falta".
  ⚠️ "O DIA INTEIRO" JÁ É ESCOPO. "quero a rotina do dia inteiro", "quero organizar o dia todo", "a manhã", "a tarde", "a noite", "antes de dormir" — todos já disseram o pedaço do dia. Não devolva "falta_escopo" pra nenhum deles: o que falta aí é a SEQUÊNCIA, então é "falta", e a pergunta é como o dia acontece hoje.
- "falta": o escopo está claro, mas falta UM dado que muda o artefato. Escreva em "pergunta" a pergunta curta e direta que você faria — UMA SÓ, do jeito que uma pessoa perguntaria.
- "nao_e_rotina": não é caso de organizar o dia NEM de conduzir uma passagem — é conversa, desabafo, dúvida sobre comportamento, alimentação, escola. Explique em "motivo" o que ela realmente quer.
  ⚠️ UMA TRANSIÇÃO DIFÍCIL NÃO É "nao_e_rotina". "todo dia dá briga pra sair do videogame e ir pro banho" é caso de ajudar AGORA: devolva "suficiente" com tamanho="orientacao" (ou "mini", se ver a sequência acrescentar). Antes isso caía fora e a família ficava sem a ajuda concreta da passagem.
- "tamanho": aplique o critério acima. Só importa quando desfecho="suficiente".
- "reusaHistorico": true SÓ quando a mensagem de agora APONTA pro que ela já contou ("já te falei os horários, agora monta", "usa o que eu te mandei", "é aquela mesma"). É o que autoriza o histórico anterior a virar a sequência. Se ela só pediu a rotina e o histórico por acaso tem material, é false — você é que foi buscar, ela não mandou.
- "visual": marcar true é OFERECER o apoio visual — o sistema pergunta o tema e a família pode dizer que não quer. Não é gerar cartão à revelia. Marque true quando o contexto indicar que VER a sequência pode ajudar:
  • a família relatou que apoio visual funciona com ela;
  • a criança precisa consultar "agora/depois" sozinha, em vez de a mãe repetir;
  • ela não lê, ou falar não basta (a própria mãe diz isso);
  • ela pediu com essas palavras — "rotina visual", "cartões", "quadro", "figuras";
  • a passagem se repete todo dia e vira briga (sair de casa, banho, dormir, desligar a tela, trocar de atividade);
  • é situação NOVA ou especial, em que ninguém sabe o que vem depois (médico, dentista, viagem, festa, visita, primeiro dia);
  • a mãe está repetindo instrução verbal o tempo todo, ou quer que a criança dê conta sozinha de mais etapas.
  ⚠️ INDÍCIO NÃO É CONCLUSÃO. Que a transição seja difícil NÃO significa "esta criança precisa de apoio visual" — significa que apoio visual é uma possibilidade relevante a OFERECER. Quem decide é o conjunto: o que você sabe da criança, o histórico, o que a família já tentou, e o que ela está trazendo agora. Se houver sinal de que ver NÃO ajuda aquela criança (ela lê bem e se organiza melhor com lista, já disseram que quadro não funcionou), respeite isso.
  ⚠️ NÃO INFIRA DO DIAGNÓSTICO. "criança com TEA se beneficia de apoio visual" é o rótulo explicando a criança: há muita criança autista que lê e se organiza melhor com a lista escrita. O rótulo nunca é o motivo; o contexto é.
  ⚠️ PEDIR ROTINA NÃO É PEDIR CARTÃO, e Tema e interesse também não são motivo: tema personaliza cartão que já ia existir. Esta parte NÃO mudou — quem decide o visual é a necessidade, nunca a vontade de deixar bonito.
  ⚠️ NÃO VIRE ISTO NUMA LISTA DE PALAVRAS. Os exemplos acima são famílias de situação, não gatilhos. "banho" na frase não liga o visual sozinho, e uma situação que não está na lista pode pedir o visual do mesmo jeito.
- "limite_atuacao": a rotina pedida depende de decisão clínica que não é da Kolo. Escreva em "parteClinica" QUAL parte é do profissional (ex.: "frequência e duração das mamadas"). Isso NÃO impede organizar o resto.
- motivo: uma frase curta, pra log.

NUNCA PERGUNTE O QUE VOCÊ JÁ TEM. Idade, nome e qual criança estão no contexto — perguntar isso queima a confiança da família ("eu já não te falei?"). Antes de escrever qualquer pergunta, releia O QUE JÁ SABEMOS e a conversa: se a resposta está lá, você não precisa dela. E UMA pergunta por vez: nunca junte duas ("qual a idade e qual parte do dia?").

Na dúvida entre "suficiente" e "falta", escolha SUFICIENTE quando você já tiver escopo + sequência: uma primeira rotina que a família ajusta vale mais que mais um turno de perguntas.
Na dúvida entre "falta" e "limite_atuacao", escolha "limite_atuacao": é mais seguro devolver a decisão clínica a quem acompanha a criança.`;

/**
 * Roda ANTES de qualquer montagem. Uma chamada no modelo leve — o mesmo custo
 * que o Plano já paga, e pelo mesmo motivo.
 *
 * Em qualquer falha devolve "falta" sem pergunta: o condutor segue conversando
 * normalmente, que é o comportamento inócuo. Nunca "suficiente" por acidente.
 */
export async function avaliarProntidaoParaRotina(params: {
  /** A mensagem de agora. */
  mensagem: string;
  /** A conversa recente, já formatada (quem disse o quê). */
  conversa: string;
  /** O que já se sabe da criança — perfil, rotina existente, desafios. */
  contexto?: string;
  /** Idade em meses, quando conhecida. Bebê pequeno pesa no limite de atuação. */
  idadeMeses?: number | null;
}): Promise<ProntidaoRotina> {
  try {
    const client = getAylaAnthropicClient();
    const user = [
      params.idadeMeses != null && params.idadeMeses <= 12
        ? `ATENÇÃO — a criança tem ${params.idadeMeses} ${params.idadeMeses === 1 ? "mês" : "meses"} de vida. Nessa idade quase toda pergunta de rotina é, no fundo, clínica.`
        : "",
      params.contexto ? `O QUE JÁ SABEMOS:\n${params.contexto}` : "",
      `CONVERSA RECENTE:\n${params.conversa.slice(0, 4000)}`,
      `MENSAGEM DE AGORA:\n"${params.mensagem.slice(0, 1000)}"`,
      "Decisão:",
    ]
      .filter(Boolean)
      .join("\n\n");

    const resp = await client.messages.create({
      model: AYLA_MODEL,
      max_tokens: 300,
      system: CONTRATO_PRONTIDAO_ROTINA,
      messages: [{ role: "user", content: user }],
    });
    const b = resp.content[0];
    const raw = b?.type === "text" ? b.text : "";
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return SEGURO("prontidão sem JSON");

    const o = JSON.parse(m[0]) as Record<string, unknown>;
    const d = String(o.desfecho ?? "").trim();
    const desfecho: DesfechoRotina =
      d === "suficiente" || d === "falta_escopo" || d === "nao_e_rotina" || d === "limite_atuacao"
        ? d
        : "falta";

    // TAMANHO INVÁLIDO OU AUSENTE NUNCA REDUZ. Um campo que some, um modelo que
    // devolve "pequena", uma versão antiga do prompt — tudo isso cai em
    // "rotina". O erro barato é entregar mais; o caro é a mãe pedir a rotina da
    // tarde e receber três linhas de conselho.
    const t = String(o.tamanho ?? "").trim();
    const tamanho: TamanhoRotina =
      t === "orientacao" || t === "mini" || t === "rotina" ? t : "rotina";

    const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
    const pergunta = texto(o.pergunta);

    // "falta" sem pergunta não serve pra nada — o condutor não saberia o que
    // perguntar. Sem ela, deixa a conversa seguir normal.
    return {
      desfecho,
      tamanho,
      // Cartão é decisão de necessidade. "mini" É uma sequência visual — sem o
      // visual ela não existe. Nos outros, quem manda é o julgamento explícito.
      visual: tamanho === "mini" ? true : o.visual === true,
      reusaHistorico: o.reusaHistorico === true,
      pergunta: desfecho === "falta" ? pergunta : null,
      parteClinica: desfecho === "limite_atuacao" ? texto(o.parteClinica) : null,
      motivo: texto(o.motivo) ?? "-",
    };
  } catch (e) {
    console.warn(
      "[ayla:prontidao-rotina] falhou:",
      e instanceof Error ? e.message : e,
    );
    return SEGURO("erro na avaliação");
  }
}
