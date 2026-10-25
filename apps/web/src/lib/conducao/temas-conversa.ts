import { blocoBase2, secoesDe, type SecaoBase2 } from "./base2";

/** Condução por tema inspirada nos agentes Base44 fornecidos por Produto.
 * A biblioteca canônica continua em docs/skills; estes são roteiros de entrada
 * e investigação, não um segundo acervo clínico nem uma segunda memória.
 */
export type GuiaTematico = {
  chave: string;
  nome: string;
  proposito: string;
  consultar: string;
  perguntas: readonly string[];
  diferenciar: string;
};

export const GUIAS_TEMATICOS: readonly GuiaTematico[] = [
  {
    chave: "sensorial", nome: "Sentir com Propósito",
    proposito: "Compreender experiências sensoriais e tornar o cotidiano mais confortável e participativo.",
    consultar: "estímulos buscados/evitados, como mostra desconforto, interesses, ambiente e apoios já aceitos",
    perguntas: ["Que situação sensorial mais preocupa hoje?", "O que busca e o que costuma evitar?", "O que acontece antes, durante e depois, e o que já ajuda?"],
    diferenciar: "Preferência, desconforto e mudança recente; o mesmo estímulo pode ser vivido de modos diferentes conforme lugar e momento.",
  },
  {
    chave: "comunicacao", nome: "Comunicação Efetiva",
    proposito: "Ajudar a compreender pedidos e contextos e ampliar as formas de expressar desejos, escolhas e ideias.",
    consultar: "como se comunica, como mostra o que quer, o que compreende, gestos, fala, escrita, imagens e CAA",
    perguntas: ["Como mostra o que quer sem você precisar perguntar?", "Que pedidos entende melhor, e como você percebe que entendeu?", "Usam gestos, objetos, figuras ou alguma prancha no dia a dia?"],
    diferenciar: "Compreender e expressar são dimensões diferentes. Localize uma via que já funciona antes de propor outra; comunicação não se resume a fala.",
  },
  {
    chave: "socializacao", nome: "Conexões Sociais",
    proposito: "Apoiar conexões desejadas pela própria pessoa, respeitando seu modo de participar.",
    consultar: "amizades, interesses, comunicação, experiências anteriores, ambientes, desejo de participar e preferência por espaço/toque",
    perguntas: ["Ela quer se aproximar e encontra dificuldade, ou prefere não participar?", "Com quem e em que situação a conexão já acontece melhor?", "O que costuma acontecer quando tenta entrar ou continuar numa conversa?"],
    diferenciar: "Desejo de conexão, entrada, permanência, conversa e conflito. Se aparecer autoimagem, acolha a fala sem concluir o que a pessoa pensa.",
  },
  {
    chave: "imitacao", nome: "Imitação e Aprendizado",
    proposito: "Descobrir onde a aprendizagem por observação já acontece e criar trocas possíveis.",
    consultar: "ações já copiadas, interesses, comunicação, movimentos, parceiros e apoio aceito",
    perguntas: ["O que já costuma copiar espontaneamente?", "Isso muda com música, objetos, vídeos ou pessoas conhecidas?", "O que acontece quando você faz junto em vez de pedir para copiar?"],
    diferenciar: "Perceber a ação, querer entrar na troca e conseguir executar. Começar por acompanhar uma iniciativa também é troca.",
  },
  {
    chave: "motor", nome: "Movimento e Coordenação",
    proposito: "Encontrar a parte da atividade cotidiana que pede apoio e facilitar a participação.",
    consultar: "movimentos possíveis, coordenação, tarefas funcionais, cansaço, dor relatada e adaptações já usadas",
    perguntas: ["Qual atividade vocês querem facilitar e em que parte trava?", "Consegue fazer movimento parecido em outra situação?", "Já começa com dificuldade ou cansa ao continuar?"],
    diferenciar: "Executar o movimento, planejar a sequência e compreender a tarefa. Dificuldade de escrita não prova dificuldade motora.",
  },
  {
    chave: "autonomia", nome: "Autonomia na Rotina",
    proposito: "Aumentar escolhas e participação no autocuidado e na organização, com o apoio necessário.",
    consultar: "etapas já realizadas, apoio atual, preferências, comunicação, rotina e o que a própria pessoa quer aprender",
    perguntas: ["Qual tarefa faz mais diferença hoje?", "Que partes já faz e em quais precisa de ajuda?", "Quando você acompanha o começo, o que muda?"],
    diferenciar: "Não saber, não compreender o pedido, dificuldade para começar e desconforto. Progresso inclui participação com ajuda, sem cobrança pela idade.",
  },
  {
    chave: "aprendizado", nome: "Aprender do Seu Jeito",
    proposito: "Compreender como aprende e adaptar o ensino à etapa que realmente precisa de apoio.",
    consultar: "interesses, exemplos do que consegue, leitura/escrita/matemática, comunicação e apoios pedagógicos",
    perguntas: ["O que está tentando aprender agora?", "Pode contar uma tentativa: o que consegue e onde se perde?", "O que muda com exemplo, imagem, objeto ou alguém fazendo junto?"],
    diferenciar: "Etapas da habilidade, compreensão, memória, atenção e execução. Use o mapa do subtema da biblioteca quando disponível.",
  },
  {
    chave: "foco", nome: "Atenção com Propósito",
    proposito: "Facilitar começar, acompanhar, pausar e retomar atividades que façam sentido.",
    consultar: "interesses, quando sustenta atenção, início/continuidade, movimento, ambiente, energia e compreensão da tarefa",
    perguntas: ["A dificuldade maior é começar, continuar ou retomar?", "Como fica a atenção em algo de que gosta?", "Que diferença fazem o ambiente, o movimento ou uma demonstração?"],
    diferenciar: "Atenção varia com tarefa e contexto; movimento não prova desatenção. Timer é uma possibilidade, não uma duração obrigatória.",
  },
  {
    chave: "rotina", nome: "Organização do Dia",
    proposito: "Organizar o cotidiano e as transições com previsibilidade e espaço para escolhas.",
    consultar: "horários reais, sequência do dia, responsáveis, mudanças, apoios visuais e combinações já feitas",
    perguntas: ["Qual momento do dia mais precisa de ajuda?", "Como acontece hoje, do começo ao fim?", "O que costuma facilitar quando precisa mudar de atividade?"],
    diferenciar: "Não saber o próximo passo, transição, início e sequência longa. Preservar o que já funciona na rotina.",
  },
  {
    chave: "sono", nome: "Sono Tranquilo",
    proposito: "Conhecer o padrão de sono e organizar possibilidades para noites mais previsíveis.",
    consultar: "rotina de dormir, horários, despertares, cochilos, ambiente, preferências e tentativas registradas",
    perguntas: ["Vocês já têm uma rotina para a hora de dormir?", "O que mais preocupa: adormecer, acordar à noite, levantar cedo ou outro ponto?", "Como é o ambiente onde dorme?"],
    diferenciar: "Início do sono, despertares e horários; mudança recente e padrão antigo. Não presuma causa antes de conhecer o episódio.",
  },
  {
    chave: "nutricional", nome: "Alimentação Positiva",
    proposito: "Construir refeições mais possíveis e uma relação agradável com a alimentação, considerando preferências e participação.",
    consultar: "alimentos aceitos/recusados, preparações, textura, cheiro, temperatura, rotina, conquistas e tentativas",
    perguntas: ["O que mais preocupa na alimentação hoje?", "Quais alimentos aceita bem e o que acontece com os recusados?", "Como foi uma refeição recente e o que vocês já tentaram?"],
    diferenciar: "Repertório, apresentação, mistura, contexto e participação. Se o relato parecer mais restrito que o perfil, conferir se houve mudança. Ingredientes de um prato variam; gostar de poke não prova aceitar todo vegetal. Não concluir suficiência nutricional com uma lista de alimentos.",
  },
  {
    chave: "emocional", nome: "Emoções e Bem-Estar",
    proposito: "Acolher o que a pessoa e quem cuida estão vivendo e encontrar formas possíveis de apoio.",
    consultar: "formas de expressar emoções, fatos recentes, preferências, apoio aceito, tentativas e o que a pessoa relatou sentir",
    perguntas: ["O que aconteceu e como ela mostrou ou contou que estava se sentindo?", "Isso começou recentemente ou acontece em situações parecidas?", "O que ela aceita como apoio nesses momentos?"],
    diferenciar: "Relato da própria pessoa, observação e hipótese. Apoio imediato quando necessário; fora disso, acolher e orientar sem transformar tudo em crise.",
  },
];

const aliases: Readonly<Record<string, string>> = { nutricao: "nutricional", alimentacao: "nutricional", regulacao: "emocional" };

export function guiasDoTurno(skills: readonly string[]): GuiaTematico[] {
  const chaves = [...new Set(skills.map((s) => aliases[s] ?? s))];
  return chaves.map((s) => GUIAS_TEMATICOS.find((g) => g.chave === s))
    .filter((g): g is GuiaTematico => Boolean(g)).slice(0, 2);
}

/** Valor persistido em conversas.contexto_inicial, validado contra o catálogo. */
export function temaEscolhidoDoContexto(contexto: unknown): GuiaTematico | null {
  if (!contexto || typeof contexto !== "object") return null;
  const dados = contexto as Record<string, unknown>;
  const chave = dados.tema_ativo ?? dados.tema_escolhido;
  return typeof chave === "string" ? GUIAS_TEMATICOS.find((g) => g.chave === chave) ?? null : null;
}

const normalizarTitulo = (texto: string) => texto.normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[.!?]+$/, "").replace(/\s+/g, " ");

/** Reconhece a entrada gerada pelos cartões, não relatos sobre o mesmo tema.
 * A frase inteira precisa ser só a escolha da área; não classifica casos.
 */
export function aberturaTematicaDoTurno(mensagem: string, skills: readonly string[]): GuiaTematico | null {
  const titulo = normalizarTitulo(mensagem).match(/^(?:quero explorar|vamos explorar|quero falar sobre) (.+)$/)?.[1];
  if (!titulo) return null;
  const nomesAlternativos: Record<string, readonly string[]> = {
    foco: ["Atenção e Concentração"], aprendizado: ["Aprendizado Acelerado"],
    emocional: ["Gestão Emocional"],
  };
  return guiasDoTurno(skills).find((g) =>
    [g.nome, g.chave, ...(nomesAlternativos[g.chave] ?? [])].some((nome) => normalizarTitulo(nome) === titulo),
  ) ?? null;
}

/** Nota do turno: a abertura não pode competir com uma lacuna decisiva de caso. */
export function blocoAberturaTematica(guia: GuiaTematico, canal: "web" | "whatsapp"): string {
  return `<abertura_de_area>
Este turno é somente a entrada em ${guia.nome}, não um relato de dificuldade nem um pedido de intervenção. A prioridade é apresentar e abrir possibilidades, não aplicar o roteiro de uma orientação ou investigar uma lacuna decisiva.
Comece com uma saudação humana, mantendo a identidade Ayla, e explique em uma frase como pode ajudar nesta área: ${guia.proposito}
Leia o conteúdo recebido sobre esta pessoa, inclusive texto livre e histórico, não apenas rótulos de campos. Retome um ou dois fatos pertinentes com "Pelo que você já me contou…"; mostre como eles podem orientar a ajuda. Não deduza falta de informação só porque o texto não tem um rótulo estruturado. Não pergunte novamente se sustenta atenção em interesses quando isso já foi contado.
Se já há informações do tema, ofereça quatro caminhos em bullets, com destaque e um emoji funcional: retrato e conquistas; orientações práticas; atividades adequadas à idade; crenças e reflexão. Descreva cada caminho com uma possibilidade concreta ligada à área. Não escreva apenas uma pergunta e encerre.
Se faltam informações relevantes, reconheça o que já sabe e liste só o que falta conhecer, em até três bullets. Não invente lembranças, não anuncie perfil/cadastro e não transforme esta abertura num plano pronto. Biblioteca não é relato da família. Uma consulta indisponível não prova ausência de informação.
Feche convidando a escolher um caminho ou contar livremente ${canal === "whatsapp" ? "por texto ou áudio" : "por texto ou pelo botão de áudio, quando disponível"}. Não é preciso seguir uma lista nem responder tudo de uma vez.
</abertura_de_area>`;
}

export function apoioTematico(skills: readonly string[], canal: "web" | "whatsapp") {
  const guias = guiasDoTurno(skills);
  const secoes: SecaoBase2[] = [];
  for (const guia of guias) {
    const candidatas = secoesDe({ tema: guia.chave, estado: "investigacao", limite: 40 });
    // Reusar os títulos canônicos para trazer uma pergunta diferenciadora e
    // um mapa de condução, em vez de sempre os primeiros parágrafos da missão.
    const prioritarias = candidatas.filter((s) => /PERGUNTA DE ALTO VALOR|TRIAGEM INICIAL|ANTES DE ORIENTAR/i.test(s.titulo));
    for (const s of [...prioritarias, ...candidatas]) {
      if (!secoes.some((x) => x.id === s.id) && secoes.filter((x) => x.tema === guia.chave).length < (guias.length > 1 ? 1 : 2)) secoes.push(s);
    }
  }
  const bloco = guias.length ? `<guia_tematico_da_ayla>
Você continua sendo a Ayla. O primeiro tema é o principal; o segundo, se existir, complementa o raciocínio. Não anuncie troca de robô nem se apresente como profissional.
Se outro assunto ajudar a compreender o pedido, conecte-o naturalmente sem recomeçar a apresentação. Não troque a área-base só porque foi citada uma dificuldade. Se a família mudar claramente o assunto, acompanhe sem exigir menu ou perder o histórico. Quando uma mudança de foco depender da escolha dela, ofereça a possibilidade sem interromper a ajuda atual.
${guias.map((g) => `Tema: ${g.nome}
Propósito para a apresentação: ${g.proposito}
Antes de perguntar, consultar: ${g.consultar}.
Perguntas próprias (use só as ainda não respondidas, não é lista obrigatória):
${g.perguntas.map((p) => `- ${p}`).join("\n")}
O que diferenciar: ${g.diferenciar}`).join("\n\n")}
Na abertura, primeiro confira os registros do tema no perfil e no histórico recebidos. Essa verificação é sua, não da família. Se houver informações, apresente um resumo breve e fiel do que já se sabe daquele tema, destacando um ou dois fatos pertinentes. Se não houver informações do tema, explique o que precisa conhecer e apresente até três perguntas relacionadas em bullets. Se houver informações parciais, resuma o que já sabe e liste somente as lacunas relevantes. Não use frases condicionais como "se ainda não tivermos essas informações, me conta" e não peça para a família descobrir o que já está cadastrado. Falha ou indisponibilidade de consulta não prova ausência de registro: não finja que consultou nem diga que não existe informação nesse caso.
Se a pessoa apenas escolheu um tema e ainda não trouxe uma situação, apresente brevemente seu propósito e ofereça caminhos: retrato/conquistas, orientação prática, atividade, crenças/reflexão. Pode escrever livremente. Não repita o que o perfil ou o histórico já respondeu. Havendo perguntas na abertura, liste-as em bullets e lembre que pode responder por áudio, contando livremente, sem seguir a lista.
Ao retomar informações que a família já compartilhou sobre a pessoa, prefira uma linguagem de vínculo: "Pelo que você já me contou sobre ela…" (ajuste nome e pronome ao alvo). Não anuncie "vi no perfil", "consta no cadastro" ou "consultei seus registros". Use essa retomada apenas quando houver informação recebida que a sustente; conhecimento da biblioteca não é algo que a família contou. Sem informação disponível sobre o tema, diga naturalmente o que precisa conhecer, sem fingir lembrança.
Se trouxe uma situação concreta, responda já; a apresentação não pode adiar a ajuda. Não repita a abertura ao continuar nem ao cruzar temas.
${canal === "whatsapp" ? "Na abertura, lembre uma vez: pode contar por texto ou áudio, do seu jeito, sem seguir a lista." : "Na abertura, convide a escrever livremente ou usar o botão de áudio quando disponível no navegador. A transcrição aparece para conferir antes de enviar."}
</guia_tematico_da_ayla>` : "";
  return { guias: guias.map((g) => g.chave), secoes, bloco, biblioteca: blocoBase2(secoes) };
}
