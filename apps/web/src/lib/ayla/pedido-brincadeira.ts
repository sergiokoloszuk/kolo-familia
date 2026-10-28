/** Pedido explícito de jogo compartilhado, não toda menção casual a brincar. */
export function pedidoExplicitoDeBrincadeira(texto: string, linguagemNaturalFoco = false): boolean {
  const t = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /\b(?:quero|queria|gostaria|preciso|me (?:de|da|mostre|sugira|ensine|ensina)|pode (?:me )?(?:dar|sugerir|ensinar|passar)|sugira|sugere|indique|indica|invente|inventa|crie|cria|monte|monta|ensine|ensina|tem (?:alguma|uma))\b.{0,110}\b(?:brincadeiras?|brincar|jogos?|atividade ludica)\b/.test(t)
    || (linguagemNaturalFoco && /(?:^|[.!?]\s*)(?:teria|tem|ha|existe[m]?|conhece)\s+(?:(?:algumas?|umas?|outras?|mais|novas?)\s+)?(?:brincadeiras?|jogos?|atividades ludicas?)\b/.test(t));
}

export type AuditoriaBrincadeiras = {
  quantidade: number;
  falhas: Array<{
    opcao: number;
    codigo:
      | "sem_fala"
      | "sem_acao"
      | "sem_virada"
      | "virada_generica"
      | "sem_continuidade"
      | "formato_nao_escaneavel"
      | "sem_encerramento"
      | "rotulo_interno"
      | "reproduz_som_sensivel"
      | "reproduz_toque_sensivel"
      | "reproduz_textura_sensivel"
      | "reproduz_cheiro_sensivel"
      | "reproduz_luz_sensivel";
  }>;
};

export type CategoriaSensorial = "som" | "toque" | "textura" | "cheiro" | "luz";

export type CampoSensorialRegistrado = {
  key: string;
  valor: string;
};

const normalizar = (texto: string): string =>
  texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const SINAL_DE_AVERSAO =
  /\b(?:incomod|sensiv|evit|rejeit|nao gost|odei|detest|assust|desconfort|intoler|irrit|cobre os ouvidos|doi|doem|chora|grita|avers)\w*/;

/** Extrai categorias só de campos aversivos; preferência positiva não vira trava. */
export function detectarSensibilidadesRegistradas(
  campos: readonly CampoSensorialRegistrado[],
): CategoriaSensorial[] {
  const categorias = new Set<CategoriaSensorial>();
  for (const campo of campos) {
    const key = normalizar(campo.key);
    const valor = normalizar(campo.valor);
    if (!valor) continue;
    if (
      key === "sons" &&
      (SINAL_DE_AVERSAO.test(valor) || /\b(?:barulho|ruido|som alto|volume alto)\w*/.test(valor))
    ) categorias.add("som");
    if (key === "toques" && SINAL_DE_AVERSAO.test(valor)) categorias.add("toque");
    if (key === "texturas" && SINAL_DE_AVERSAO.test(valor)) categorias.add("textura");
    if (
      key === "luz" &&
      (SINAL_DE_AVERSAO.test(valor) || /\b(?:luz forte|flash|pisca)\w*/.test(valor))
    ) categorias.add("luz");
    if (
      key === "cheiros" &&
      (SINAL_DE_AVERSAO.test(valor) || /\b(?:cigarro|perfume forte|odor forte)\w*/.test(valor))
    ) categorias.add("cheiro");
    if (key === "outras" && SINAL_DE_AVERSAO.test(valor)) {
      if (/\b(?:som|sons|barulho|ruido|musica|auditiv)\w*/.test(valor)) categorias.add("som");
      if (/\b(?:toque|abraco|contato|tatil)\w*/.test(valor)) categorias.add("toque");
      if (/\b(?:textura|tecido|massinha|areia|espuma)\w*/.test(valor)) categorias.add("textura");
      if (/\b(?:cheiro|odor|aroma|olfativ)\w*/.test(valor)) categorias.add("cheiro");
      if (/\b(?:luz|claridade|flash|pisca|fotossens)\w*/.test(valor)) categorias.add("luz");
    }
  }
  return [...categorias];
}

const ACAO_SENSORIAL: Record<CategoriaSensorial, RegExp> = {
  som: /\b(?:faca|imite|produza|aumente|toque|bata|grave|reproduza|coloque|ligue|cante|grite|estale|assobie)\b.{0,55}\b(?:som|sons|barulho|barulhos|ruido|ruidos|musica|palmas|apito)\b|\badivinhe\b.{0,30}\b(?:som|sons|barulho|barulhos|ruido|ruidos)\b|\b(?:som|sons|barulho|barulhos)\b.{0,35}\b(?:jogo|brincadeira|missao|rodada)\b/,
  toque: /\b(?:toque|encoste|abrace|aperte|segure|massageie|acaricie|faca cosquinha)\b.{0,45}\b(?:crianca|mao|braco|rosto|corpo|pele|costas|pe|pes|cabeca)\b/,
  textura: /\b(?:toque|encoste|pegue|passe|explore|experimente|adivinhe)\b.{0,55}\b(?:textura|texturas|massinha|areia|espuma|gelatina|tecido)\b/,
  cheiro: /\b(?:cheire|sinta|compare|adivinhe|experimente)\b.{0,55}\b(?:cheiro|cheiros|odor|odores|aroma)\b/,
  luz: /\b(?:pisque|apague|acenda|aponte|mova|use)\b.{0,55}\b(?:luz|luzes|lanterna|flash)\b/,
};

const CODIGO_SENSORIAL: Record<CategoriaSensorial, AuditoriaBrincadeiras["falhas"][number]["codigo"]> = {
  som: "reproduz_som_sensivel",
  toque: "reproduz_toque_sensivel",
  textura: "reproduz_textura_sensivel",
  cheiro: "reproduz_cheiro_sensivel",
  luz: "reproduz_luz_sensivel",
};

const ONOMATOPEIA_SONORA =
  /\b(?:qu+a+c+k|miau|au(?:\s+au)+|vr+u+m|b+i+p|pl+i+m|toc(?:\s+toc)+|bo+om|po+w|pum|trim|ding|dong)\b/;

/** Reforço curto por categoria; não leva texto do Perfil para logs ou prompt extra. */
export function blocoLimitesSensoriaisBrincadeira(
  sensibilidades: readonly CategoriaSensorial[],
): string {
  if (!sensibilidades.length) return "";
  const detalheSom = sensibilidades.includes("som")
    ? " Para som: não imite, vocalize nem escreva onomatopeias como parte do jogo; uma fala breve e calma do adulto serve apenas para conduzir."
    : "";
  return `<limites_sensoriais_da_brincadeira>
Categorias aversivas registradas para esta pessoa: ${sensibilidades.join(", ")}. Não transforme nenhuma delas em estímulo, surpresa, desafio, ensaio ou tolerância.${detalheSom}
</limites_sensoriais_da_brincadeira>`;
}

/** Auditoria de forma, sem LLM e sem registrar falas da família ou da criança. */
export function auditarBrincadeiras(
  resposta: string,
  sensibilidades: readonly CategoriaSensorial[] = [],
): AuditoriaBrincadeiras {
  const blocos = resposta.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const iniciaJogo = (bloco: string): boolean =>
    /^(?:(?:[•\-]|[^\p{L}\p{N}\s*]{1,4})\s*)?\*{1,2}[^*]+\*{1,2}/u.test(bloco) &&
    !/^\*{1,2}(?:Tempo|Duração|Material|Você vai precisar|Como começar|Próxima rodada|Para terminar|Para encerrar|Adaptação|Por que combina)\b/i.test(bloco);
  const jogos: string[] = [];
  for (const bloco of blocos) {
    if (iniciaJogo(bloco)) jogos.push(bloco);
    else if (jogos.length) jogos[jogos.length - 1] += `\n\n${bloco}`;
  }
  const falhas: AuditoriaBrincadeiras["falhas"] = [];
  jogos.forEach((jogo, i) => {
    const opcao = i + 1;
    const linhas = jogo.split(/\r?\n/).map((linha) => linha.replace(/\*+/g, "").trim()).filter(Boolean);
    if (/\btítulo curto\b|preparo visível das opções|participação possível da pessoa|reação ou virada divertida causada por essa participação/i.test(jogo))
      falhas.push({ opcao, codigo: "rotulo_interno" });
    const passosNumerados = linhas.filter((linha) =>
      /^(?:1\uFE0F?\u20E3|2\uFE0F?\u20E3|3\uFE0F?\u20E3|\d+[.)])\s+/u.test(linha),
    );
    const formatoEscaneavel =
      linhas.some((linha) => /^(?:Tempo|Duração)\s*:/i.test(linha)) &&
      linhas.some((linha) => /^(?:Material|Você vai precisar)\s*:/i.test(linha)) &&
      linhas.some((linha) => /^Como começar\s*:/i.test(linha)) &&
      passosNumerados.length >= 3;
    if (!formatoEscaneavel)
      falhas.push({ opcao, codigo: "formato_nao_escaneavel" });
    if (!linhas.some((linha) => /^Para (?:terminar|encerrar)\s*:/i.test(linha)))
      falhas.push({ opcao, codigo: "sem_encerramento" });
    if (!/\bVoc[eê]\s*:/i.test(jogo) && !/[“"][^”"]{8,}[”"]/u.test(jogo))
      falhas.push({ opcao, codigo: "sem_fala" });
    if (!/\b(?:El[ae]\s*:|A crian[cç]a\s*:|A pessoa\s*:|Participa[cç][aã]o\s*:|Quem participa\s*:|(?:el[ae]|a crian[cç]a|a pessoa|[A-Z][a-z]+) pode\b|se el[ae]\b)/i.test(jogo))
      falhas.push({ opcao, codigo: "sem_acao" });
    const entao = jogo.match(/\bEnt[aã]o\s*[:,]\s*([^\n]+)/i)?.[1]
      ?? jogo.match(/\bVoc[eê] transforma\b([^\n]+)/i)?.[1]
      ?? jogo.match(/\b(?:voc[eê]\s+)?(?:reage|responde|cumpre|faz|vira|transforma)\b([^\n]{12,})/i)?.[1]
      ?? "";
    if (!entao) falhas.push({ opcao, codigo: "sem_virada" });
    else if (/^(?:conte|narre|invente|fa[cç]a|encene|represente)\b[^.!?]{0,85}\b(?:consequ[eê]ncia|surpresa|cena|rea[cç][aã]o|escolha)\b[^.!?]{0,60}[.!?]?/i.test(entao)
      && !/[“"][^”"]+[”"]/.test(entao) && !/\bse el[ae]\b/i.test(entao))
      falhas.push({ opcao, codigo: "virada_generica" });
    if (!/\b(?:depois|(?:na |a )?(?:pr[oó]xima|segunda) rodada|(?:na |a )?rodada seguinte|(?:na |a )?vez seguinte|troqu?em(?: os pap[eé]is)?|inverta|devolva a vez|repita|agora [ée] a vez|agora voc[eê] manda|pr[oó]ximo objeto)\b/i.test(jogo))
      falhas.push({ opcao, codigo: "sem_continuidade" });
  });
  const textoNormalizado = normalizar(resposta);
  for (const categoria of sensibilidades) {
    if (
      ACAO_SENSORIAL[categoria].test(textoNormalizado)
      || (categoria === "som" && ONOMATOPEIA_SONORA.test(textoNormalizado))
    ) {
      falhas.push({ opcao: 1, codigo: CODIGO_SENSORIAL[categoria] });
    }
  }
  return { quantidade: jogos.length, falhas };
}

export function instrucaoCorrecaoBrincadeira(
  auditoria: AuditoriaBrincadeiras,
  sensibilidades: readonly CategoriaSensorial[],
): string {
  const codigos = [...new Set(auditoria.falhas.map((f) => f.codigo))];
  return `<corrigir_brincadeira>
A resposta anterior não pode sair. Reescreva uma única brincadeira completa e curta. Corrija estes códigos objetivos: ${codigos.join(", ") || "quantidade_incorreta"}.
${sensibilidades.length ? `Sensibilidades registradas que NÃO podem virar estímulo, ensaio ou parte do jogo: ${sensibilidades.join(", ")}.` : ""}
Releia o pedido e o retrato no contexto. Preserve nome, idade e modo de comunicação; use um interesse registrado para mudar a MECÂNICA, não só o título. Se não houver interesse registrado, não invente. Não troque uma ideia personalizada por uma genérica. Use o nome quando conhecido e nunca chame uma pessoa adulta de criança.
Use um nome real e criativo como título em negrito, nunca o texto "Título curto". Em linhas separadas, escreva Tempo: com a duração proposta; Material: com itens concretos disponíveis (ou nenhum); Como começar: com a fala inicial exata entre aspas.
Depois escreva uma lista numerada com 1., 2. e 3. Cada item já é uma ação concreta para a família executar, com fala, participação e consequência divertida específica. Não copie rótulos de roteiro como "preparo visível das opções" ou "participação possível da pessoa". As opções, pistas e falas necessárias já vêm prontas; não peça à família para inventar o conteúdo.
Próxima rodada: descreva uma variação real. Para terminar: escreva um encerramento natural, curto e sem exigir conclusão da pessoa. Mantenha uma linha por item, com respiro entre os blocos.
Adaptação só aparece se for pertinente ao retrato ou à recusa. Não proponha comunicação não oral como necessidade de uma pessoa fluente. Uma escolha entre duas opções é uma mecânica possível, não regra de todo jogo.
Se usou um fato confirmado do retrato, mostre em uma frase como ele alterou a mecânica; sem fato pertinente, omita a explicação.
Feche com uma capacidade realmente convidada, sem promessa clínica. Preserve o alvo e não invente característica.
</corrigir_brincadeira>`;
}

/**
 * Segurança sensorial e os dois defeitos objetivos encontrados no teste humano
 * justificam substituir a resposta: bloco corrido e falta de encerramento.
 * As demais falhas continuam como telemetria para não trocar uma brincadeira
 * boa apenas porque o modelo escolheu outra redação.
 */
export function exigeCorrecaoDeBrincadeira(auditoria: AuditoriaBrincadeiras): boolean {
  return auditoria.falhas.some((falha) =>
    falha.codigo.startsWith("reproduz_") ||
    falha.codigo === "formato_nao_escaneavel" ||
    falha.codigo === "rotulo_interno" ||
    falha.codigo === "sem_encerramento",
  );
}

/** Último piso: útil, sem exigir fala, toque, contato visual ou estímulo novo. */
export function pisoBrincadeiraSegura(idade?: number | null): string {
  if (idade != null && idade >= 13) {
    return `**Legenda improvável**

Tempo: 3 minutos
Material: nenhum
Como começar: “Imagine alguém de guarda-chuva aberto dentro de casa. Qual seria a explicação mais absurda?”

1. Ofereça duas ideias prontas: “Está chovendo só no sofá” ou “o guarda-chuva tem medo da rua”.
2. Quem participa pode escolher uma, propor outra, escrever, gesticular ou apenas acompanhar.
3. Então: você transforma a escolha em uma cena curta: “O sofá virou uma nuvem e agora exige previsão do tempo!” ou “O guarda-chuva só sai se a rua levar um guarda-chuva também!”.

Próxima rodada: troquem quem inventa a cena; a próxima já pode ser “uma cadeira na fila do cinema”.
Para terminar: escolham a legenda preferida ou encerrem sem precisar decidir.

A graça está em construir uma explicação inesperada juntas, sem competição nem efeitos sonoros.`;
  }
  return `**Você comanda a virada**
Tempo: 3 minutos
Material: nenhum
Como começar: “Hoje você decide: minha mão fica parada ou vira um bichinho?”
1⃣ Mostre “parada” com a palma aberta e “bichinho” dobrando dois dedos.
2⃣ Participação: a pessoa pode apontar, olhar para uma opção, gesticular, falar ou só observar.
3⃣ Então: cumpra a escolha; se virar bichinho, faça os dedos se esconderem atrás da outra mão.
Próxima rodada: troque o bichinho por uma asa ou uma ponte e mostre as duas opções.
Para terminar: diga “o bichinho vai descansar” e abaixe as mãos.
Adaptação: se ela não escolher, faça uma transformação e deixe que apenas observe.
Isso convida a escolher e alternar turnos, sem exigir resposta. Se houver desconforto, pare.`;
}

/** Pontos de partida lúdicos, não roteiros prontos nem substitutos do Perfil/BPs. */
export function blocoMecanicasBrincadeira(texto: string): string {
  const t = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const mercado = /\b(?:mercado|supermercado|compras|corredor)\b/.test(t);
  const contexto = mercado
    ? `Cenário: durante a ida ao mercado, sem exigir objetos extras, fala da pessoa ou exposição a sons. Três MECÂNICAS candidatas diferentes:
• Mímica com personagem do interesse da pessoa: o adulto usa só as mãos ou expressões para representar uma ação engraçada; um gesto dela muda a expressão/ação do personagem e o adulto encena a consequência. A segunda rodada inverte quem comanda o personagem. Não transforme isso em caminhar, parar ou seguir por corredores.
• O adulto inventa um apelido absurdo e seguro para UM produto comum (sem mexer nele); a pessoa rejeita ou aceita por gesto, apontamento ou palavra, o adulto reage com humor e depois deixa que ela crie um apelido para ele descobrir. A graça é a incongruência, não encontrar itens. Nunca finja que algo não comestível é comida ou que um produto perigoso pode ser usado de modo inadequado.
• História de superpoder impossível: um item do carrinho ganha um poder fictício; a pessoa escolhe por gesto entre duas ações engraçadas, o adulto narra a consequência breve e devolve a vez para ela criar uma segunda mudança. Não use o personagem/interesse da primeira opção novamente.
Não entregue três variações de caça, caminhada, escolher produtos ou trajeto. Não repita o mesmo personagem ou interesse em duas opções. Se algum jogo não couber na idade, interesses, comunicação, sensibilidade ou histórico, troque-o por outra mecânica realmente distinta.`
    : `Três MECÂNICAS candidatas diferentes para criar opções, adaptando lugar, idade, interesses e comunicação ao Perfil:
• Adivinhação por pistas, com a pessoa podendo dar uma pista e o adulto adivinhar de modo divertido.
• Faz-de-conta com papéis invertidos: o gesto ou escolha da pessoa altera a ação do personagem; o adulto representa a consequência.
• Transformação ou construção conjunta: cada turno muda um objeto, desenho ou enredo e causa uma surpresa pequena, sem exigir material que a família não tenha.
São estruturas, não respostas fixas. Evite repetir uma mecânica já tentada e substitua qualquer uma inadequada ao pedido.`;
  return `<mecanicas_ludicas_para_escolha>\n${contexto}\nPara cada opção escolhida, mostre abertura exata do adulto → ação possível da pessoa → reação/virada → próxima rodada. Uma habilidade realmente exercitada, sem promessa de resultado. As BPs e o Perfil têm precedência sobre estes exemplos.\n</mecanicas_ludicas_para_escolha>`;
}

/** Critério de experiência, não nova fonte clínica nem substituto das BPs. */
export const BLOCO_PEDIDO_BRINCADEIRA_TRES_LEGADO = `<pedido_explicito_de_brincadeira>
A família pediu brincadeira AGORA. Ofereça TRÊS opções de jogo para a família poder experimentar uma hoje e guardar as outras para depois. Cada opção precisa ser uma experiência compartilhada divertida mesmo sem o objetivo de desenvolvimento. Não reembale um treino, uma simulação da situação difícil ou uma atividade já tentada como se fosse jogo novo. Use um interesse forte da criança para tornar UMA opção especial; não repita o mesmo personagem, enredo ou objeto nas três. As outras podem aproveitar outra preferência, uma ação do lugar ou o humor da relação entre adulto e criança. Personalizar não é só repetir o tema favorito.

As três opções devem ter MECÂNICAS diferentes entre si e diferentes das já tentadas. Compare as ações, não só os nomes: restaurante seguido de receita/cozinha ainda é a mesma mecânica de escolher e servir comida; expedição, caça e carrinho em missão podem ser a mesma busca reembalada. No máximo UMA pode ser achar/esconder algo; no máximo UMA pode ser criar uma regra ou escolher o trajeto. Outras formas possíveis: faz-de-conta com personagem, adivinhação por pistas, imitação engraçada com troca de papéis, transformar uma compra em personagem com pequena aventura — só se couberem no lugar e no Perfil. Em cada opção, dê o mínimo para executar sem improvisar o resto: material ou cenário, como começar, uma FALA EXATA de abertura do adulto, uma resposta possível da criança no modo em que ela de fato se comunica, o que o adulto faz em seguida e um momento de descoberta, surpresa ou humor. O leitor deve conseguir brincar sem inventar as falas nem adivinhar o próximo turno. Se a criança usa gestos, mostre o gesto ou escolha plausível e a reação imediata do adulto; não escreva uma fala hipotética da criança como condição para continuar. Variem também o PAPEL do adulto: errar de propósito pode tornar UM jogo divertido, mas não deve ser o truque repetido nas três opções. Em outra, a criança pode virar quem dá a pista, esconde algo ou cria a regra. Só andar, encontrar e apontar três vezes não é suficiente. Ela pode apontar, mover, gesticular ou falar conforme sua comunicação; não exija fala nem olhar. Use idade, interesses e sensibilidades para mudar as ações do jogo, não só o título. Uma frase comum ao fim pode dizer como facilitar ou encerrar sem cobrança.

Em TODAS as três opções, acrescente uma frase curta de valor, naturalmente: "Aqui ela pratica ..." ou "Isso convida a ...". Nomeie apenas UMA capacidade que aquela ação realmente convida a usar — por exemplo atenção compartilhada, alternância, escolha, comunicação ou flexibilidade — e diferencie as três quando couber. Confira antes de responder: nenhum dos três blocos pode ficar sem essa ligação concreta, e a habilidade nomeada deve corresponder à ação descrita (criar uma regra não é, por si só, praticar flexibilidade). A alegria e a conexão também são valor, não só treino. Calibre a complexidade pela idade e pelo que o Perfil diz que esta criança faz hoje; idade não é prova de que ela "já deveria" executar uma habilidade. Se ela se comunica por gestos, apontar e escolher já são comunicação. Convide uma palavra curta apenas se o Perfil indicar fala emergente, sem exigir que a criança repita para ganhar a vez. Não prometa que a brincadeira vai melhorar uma habilidade nem faça explicação de neurodesenvolvimento.

Quando Perfil ou conversa indicam sensibilidade a sons, texturas ou cheiros, NÃO reproduza nem simule esse estímulo na brincadeira — nem em intensidade baixa — a menos que a família peça expressamente um ensaio sensorial. Evite sustos inesperados. O jogo acontece em ambiente confortável. Se um lugar é o contexto do pedido (mercado, parque, escola) e a família não pediu preparação em casa, trate como brincadeiras DURANTE a ida: as três opções devem poder acontecer ali, de modo discreto e sem material trabalhoso. Use coisas que realmente há no lugar; não presuma que haverá figuras do interesse da criança em prateleiras ou paredes. No mercado, itens da compra e corredores podem virar pistas, escolhas ou personagens imaginários, com alternância de papéis — não um quiz de nomeação. Use um marco previsível, como o próximo corredor, não cada novo som. Se a criança já está sobrecarregada, a saída ou pausa vem antes de qualquer jogo. Primeiro faça a brincadeira existir por si; só depois, se útil, ligue-a à situação real em uma frase. Manejo da situação real não ocupa o lugar da brincadeira.

Se um gesto de pausa puder ser útil, ele pertence à escolha espontânea da criança durante o jogo. Não interrompa a brincadeira periodicamente para o adulto fazer o gesto e a criança copiá-lo: isso voltaria a ser exercício disfarçado. NENHUMA das três opções pode ser apenas pedir pausa, buscar corredor mais calmo, escolher trajeto, respirar ou ensaiar lidar com barulho. Essas são estratégias de manejo, não brincadeiras. A pausa e a saída aparecem somente no aviso final, fora das três opções. Em cada jogo deve haver pelo menos uma virada lúdica que faça a criança querer repetir a vez — surpresa, faz-de-conta ou humor, sem susto e sem estímulo sensorial desconfortável. O gesto ou a escolha da criança precisa CAUSAR a virada; não acrescente uma descoberta aleatória após ela apontar. Mostre como a segunda rodada muda ou como os papéis se invertem, para a mãe não ficar sem saber como continuar. Se tirar a meta de desenvolvimento e o jogo deixar de ter graça, substitua a opção antes de responder.

SAÍDA: comece diretamente por três blocos com • ou emoji + título curto em negrito, separados por UMA linha em branco. São alternativas, não etapas; não as numere como sequência. Não coloque a primeira opção no parágrafo introdutório. Em cada bloco, use linhas curtas SEM linhas vazias internas: cenário/começo; "Você: ..." com frase pronta; "Ela: ..." com gesto/ação ou palavra possível; "Então: ..." com sua reação e a virada divertida; e uma linha curta com UMA capacidade convidada. Pode juntar linhas se ficar natural, mas NÃO omita os turnos concretos para caber em um limite artificial de palavras. Não transforme o jogo em ficha técnica ou diálogo longo. Se o histórico diz que já fizeram restaurante, descarte chef/cozinha/receita/servir como mecânica, mesmo que a criança goste de comida; use o interesse dela de outro modo. Não recorra automaticamente a cozinhar/servir quando o cenário é mercado: isso pode repetir a mesma mecânica, sem aproveitar o lugar. Depois das três opções, no máximo uma frase para sugerir por qual começar e outra para lembrar que pausa ou saída vem primeiro se ela estiver desconfortável. Não repita a recomendação antes e depois da lista. O objetivo técnico fica por trás. Não ofereça tutorial de história ou link do Lúdico neste pedido.
</pedido_explicito_de_brincadeira>`;

/**
 * Contrato vigente: uma brincadeira boa, não três alternativas longas.
 *
 * A versão anterior continua acima apenas como registro editorial; ela exigia
 * três jogos completos e foi medida no caminho real com 1.346 caracteres e
 * quatro bolhas para um pedido no singular. Mais opções competiam com a
 * qualidade de cada mecânica e aumentavam a latência. Os três pontos de
 * partida de `blocoMecanicasBrincadeira` agora são repertório interno para o
 * modelo escolher, nunca quantidade de saída.
 */
export const BLOCO_PEDIDO_BRINCADEIRA_PUBLICADO = `<pedido_explicito_de_brincadeira>
A família pediu uma brincadeira AGORA. Escolha exatamente UMA mecânica adequada
ao lugar, idade, comunicação, interesses, sensibilidades e histórico desta
criança. Os exemplos recebidos são repertório para escolher, não opções para
mostrar. Entregue o jogo inteiro, sem introdução e sem oferecer alternativas.

O jogo precisa ser divertido mesmo sem meta de desenvolvimento. Interesse muda
a mecânica, não só o título. Mostre, em poucas linhas: material ou cenário; uma
FALA EXATA para começar; ação possível da criança no modo como ela se comunica
(gesto e apontar valem); reação ou virada divertida causada por essa ação; e
como começa a próxima rodada. Diga em uma frase o que a brincadeira convida a
praticar, sem prometer resultado.

Não reembale manejo, treino, exposição sensorial ou atividade já tentada como
jogo. Não exija fala nem olhar. Não reproduza sensibilidade registrada. Se
houver desconforto, pausa ou saída vêm primeiro. Use um título curto, no máximo
um emoji funcional e um único bloco executável. O objetivo técnico fica por
trás; a família recebe a brincadeira.
</pedido_explicito_de_brincadeira>`;

/** Um corpo executável; o piloto Foco escolhe três opções, os demais mantêm uma. */
export function contratoPedidoBrincadeira(opcoesFoco = false): string {
  const abertura = opcoesFoco
    ? `A família pediu brincadeira AGORA. Por padrão, ofereça TRÊS opções completas com mecânicas diferentes. Se pedir explicitamente apenas uma ou outra quantidade, respeite essa escolha. Não confunda o singular informal "teria alguma brincadeira?" com um pedido de uma só. Interesses são portas de entrada, não limites: entre várias opções, no máximo uma depende do mesmo material, cenário ou interesse favorito; inclua também uma proposta fora deles. Se pediu experiências sem o material favorito, não o imponha nem em uma opção. Não apresente três versões de cozinhar/servir, procurar ou seguir comandos.`
    : `A família pediu uma brincadeira AGORA. Escolha exatamente UMA mecânica adequada
ao lugar, idade, comunicação, interesses, sensibilidades e histórico desta
pessoa. Os exemplos recebidos são repertório para escolher, não opções para
mostrar. Entregue o jogo inteiro, sem introdução e sem oferecer alternativas.`;
  return `<pedido_explicito_de_brincadeira>
${abertura}

${opcoesFoco ? "Repertório aberto: considere também imitação com troca de papéis, memória por pistas, percursos com obstáculos baixos e movimentos que caibam no espaço; o banco de exemplos não é uma lista fechada. ‘Chefinho mandou’ pode ser jogo com a pessoa também inventando e conduzindo as ações, sem cobrar acertos. Uma pausa de movimento ou respiração tranquila pode caber entre rodadas, quando for confortável e útil; não é etapa obrigatória nem condição para participar. Escolha o que combina com o pedido, não inclua todos os formatos em toda resposta." : ""}

O jogo precisa ser divertido mesmo sem meta de desenvolvimento. ${opcoesFoco ? "Quando usar um interesse, ele participa da ação, não só do título. Outras opções podem se apoiar em humor, movimento, criação ou descoberta adequados à pessoa." : "Interesse muda\na mecânica, não só o título."} Toda escolha precisa estar visível ou ser mostrada
por dois gestos claros; não mande a pessoa apontar para opções que o adulto não
preparou. ${opcoesFoco ? `Em cada opção, inclua **O que vocês exercitam:** com uma ou duas frases curtas ligando uma capacidade à ação concreta do jogo: acompanhar a sequência, lembrar uma pista, escolher, criar ou alternar papéis. Explique também como a troca pode favorecer vínculo quando isso estiver presente: a pessoa toma iniciativa, quem cuida acompanha e ambos criam ou se divertem juntos. Não repita uma lista genérica de benefícios nas três; não afirme vínculo fortalecido ou melhora de atenção como resultado garantido, nem transferência automática para a escola.` : `Diga em uma frase o que a brincadeira convida a praticar, sem prometer
resultado.`}

${opcoesFoco ? "Em cada opção, apresente" : "Apresente"} um nome criativo real em negrito, nunca o texto "Título curto".
Depois, em linhas separadas: Tempo: com duração curta e realista;
Material: com objeto comum concreto ou nenhum; Como começar: com a “fala exata do adulto”.
Use uma lista numerada com 1., 2. e 3., uma linha por item. Escreva diretamente
o que fazer: o preparo concreto, a participação no modo de comunicação da pessoa
e a consequência divertida específica que essa participação causa. Não copie
os rótulos internos "preparo visível das opções", "participação possível da pessoa"
ou "reação ou virada divertida". As pistas, opções e falas necessárias já vêm
prontas: a família não precisa inventar o conteúdo para conseguir começar.
Na sequência, escreva Próxima rodada: com variação concreta e Para terminar:
com encerramento natural e sem cobrança. Separe os blocos com linhas em branco.
Adaptação só aparece quando necessária e pertinente; não apresente comunicação
não oral como necessidade de uma pessoa fluente. Não force escolha entre duas
opções em todo jogo. Se houver fato pertinente, feche com uma frase mostrando
como ele mudou a mecânica, sem um cabeçalho técnico.

Não reembale manejo, treino, exposição sensorial ou atividade já tentada como
jogo. Use o nome quando conhecido. Nunca chame uma pessoa adulta de criança.
Não exija fala nem olhar. Não reproduza sensibilidade registrada. Se
houver desconforto, pausa ou saída vêm primeiro. Use no máximo um emoji
funcional${opcoesFoco ? " por opção" : ""}. O objetivo técnico fica por trás; a família recebe ${opcoesFoco ? "cada brincadeira" : "uma brincadeira"}
legível e pronta para usar. Não prometa regular, desenvolver ou mudar o estado
emocional; descreva apenas a participação que a mecânica convida.
</pedido_explicito_de_brincadeira>`;
}

/** Contrato candidato anterior preservado para os demais temas e produtores. */
export const BLOCO_PEDIDO_BRINCADEIRA = contratoPedidoBrincadeira();
