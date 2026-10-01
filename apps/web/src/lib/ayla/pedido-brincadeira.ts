/** Pedido explícito de jogo compartilhado, não toda menção casual a brincar. */
export function pedidoExplicitoDeBrincadeira(texto: string): boolean {
  const t = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /\b(?:quero|queria|gostaria|preciso|me (?:de|da|mostre|sugira|ensine)|pode (?:me )?(?:dar|sugerir|ensinar|passar)|sugira|indique|invente|crie|monte|tem (?:alguma|uma))\b.{0,110}\b(?:brincadeiras?|brincar|jogos?|atividade ludica)\b/.test(t);
}

export type AuditoriaBrincadeiras = {
  quantidade: number;
  falhas: Array<{ opcao: number; codigo: "sem_fala" | "sem_acao" | "sem_virada" | "virada_generica" | "sem_continuidade" }>;
};

/** Auditoria de forma, sem LLM e sem registrar falas da família ou da criança. */
export function auditarBrincadeiras(resposta: string): AuditoriaBrincadeiras {
  const blocos = resposta.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const jogos = blocos.filter((b) => /^(?:[•\-]|[^\p{L}\p{N}\s]{1,4})\s*\*{1,2}[^*]+\*{1,2}/u.test(b));
  const falhas: AuditoriaBrincadeiras["falhas"] = [];
  jogos.forEach((jogo, i) => {
    const opcao = i + 1;
    if (!/\bVoc[eê]\s*:/i.test(jogo) && !/[“"][^”"]{8,}[”"]/u.test(jogo))
      falhas.push({ opcao, codigo: "sem_fala" });
    if (!/\b(?:El[ae]\s*:|(?:el[ae]|a crian[cç]a|[A-Z][a-z]+) pode\b|se el[ae]\b)/i.test(jogo))
      falhas.push({ opcao, codigo: "sem_acao" });
    const entao = jogo.match(/\bEnt[aã]o\s*[:,]\s*([^\n]+)/i)?.[1]
      ?? jogo.match(/\bVoc[eê] transforma\b([^\n]+)/i)?.[1] ?? "";
    if (!entao) falhas.push({ opcao, codigo: "sem_virada" });
    else if (/^(?:conte|narre|invente|fa[cç]a|encene|represente)\b[^.!?]{0,85}\b(?:consequ[eê]ncia|surpresa|cena|rea[cç][aã]o|escolha)\b[^.!?]{0,60}[.!?]?/i.test(entao)
      && !/[“"][^”"]+[”"]/.test(entao) && !/\bse el[ae]\b/i.test(entao))
      falhas.push({ opcao, codigo: "virada_generica" });
    if (!/\b(?:depois|(?:na |a )?(?:pr[oó]xima|segunda) rodada|(?:na |a )?rodada seguinte|(?:na |a )?vez seguinte|troqu?em|inverta|agora [ée] a vez|agora voc[eê] manda|pr[oó]ximo objeto)\b/i.test(jogo))
      falhas.push({ opcao, codigo: "sem_continuidade" });
  });
  return { quantidade: jogos.length, falhas };
}

/** Pontos de partida lúdicos, não roteiros prontos nem substitutos do Perfil/BPs. */
export function blocoMecanicasBrincadeira(texto: string): string {
  const t = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const mercado = /\b(?:mercado|supermercado|compras|corredor)\b/.test(t);
  const contexto = mercado
    ? `Cenário: durante a ida ao mercado, sem exigir objetos extras, fala da criança ou exposição a sons. Três MECÂNICAS candidatas diferentes:
• Mímica com personagem do interesse da criança: o adulto usa só as mãos ou expressões para representar uma ação engraçada; um gesto da criança muda a expressão/ação do personagem e o adulto encena a consequência. A segunda rodada inverte quem comanda o personagem. Não transforme isso em caminhar, parar ou seguir por corredores.
• O adulto inventa um apelido absurdo e seguro para UM produto comum (sem mexer nele); a criança rejeita ou aceita por gesto, apontamento ou palavra, o adulto reage com humor e depois deixa a criança criar um apelido para ele descobrir. A graça é a incongruência, não encontrar itens. Nunca finja que algo não comestível é comida ou que um produto perigoso pode ser usado de modo inadequado.
• História de superpoder impossível: um item do carrinho ganha um poder fictício; a criança escolhe por gesto entre duas ações engraçadas, o adulto narra a consequência breve e devolve a vez para ela criar uma segunda mudança. Não use o personagem/interesse da primeira opção novamente.
Não entregue três variações de caça, caminhada, escolher produtos ou trajeto. Não repita o mesmo personagem ou interesse em duas opções. Se algum jogo não couber na idade, interesses, comunicação, sensibilidade ou histórico, troque-o por outra mecânica realmente distinta.`
    : `Três MECÂNICAS candidatas diferentes para criar opções, adaptando lugar, idade, interesses e comunicação ao Perfil:
• Adivinhação por pistas, com a criança podendo dar uma pista e o adulto adivinhar de modo divertido.
• Faz-de-conta com papéis invertidos: o gesto ou escolha da criança altera a ação do personagem; o adulto representa a consequência.
• Transformação ou construção conjunta: cada turno muda um objeto, desenho ou enredo e causa uma surpresa pequena, sem exigir material que a família não tenha.
São estruturas, não respostas fixas. Evite repetir uma mecânica já tentada e substitua qualquer uma inadequada ao pedido.`;
  return `<mecanicas_ludicas_para_escolha>\n${contexto}\nPara cada opção escolhida, mostre abertura exata do adulto → ação possível da criança → reação/virada → próxima rodada. Uma habilidade realmente exercitada, sem promessa de resultado. As BPs e o Perfil têm precedência sobre estes exemplos.\n</mecanicas_ludicas_para_escolha>`;
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
export const BLOCO_PEDIDO_BRINCADEIRA = `<pedido_explicito_de_brincadeira>
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
