/**
 * LENTES PROFISSIONAIS — a segunda camada de raciocínio, POR TURNO.
 *
 * O CORE (`diretrizes.ts`) diz COMO a Ayla pensa em qualquer assunto. A lente
 * diz o que um profissional daquele domínio OLHA antes de responder. É a
 * mesma Ayla, com a atenção afinada — não um segundo agente, não um segundo
 * prompt, não uma segunda chamada.
 *
 * ⚠️ LENTE NÃO É PORTÃO. Ela não decide se a conversa segue, não cria
 * artefato, não bloqueia nada e não tem estado. Ela só ENRIQUECE a chamada
 * conversacional que já ia acontecer de qualquer jeito. Sem skill, sem lente,
 * sem BP, sem repertório: o Core responde sozinho, e responde bem — isso é
 * requisito, não consolo.
 *
 * POR QUE FICA NO CÓDIGO, e não no banco. `specialist_prompt_templates` já
 * carrega uma Camada 1 por skill (objetivo/tom/escopo/limites, ~341 caracteres)
 * e o `buildIdentityBlock` da web a injeta. Aquilo é CONFIGURAÇÃO da skill,
 * editável pela Karina, e continua valendo. Isto aqui é RACIOCÍNIO clínico
 * compartilhado, e vive junto do Core pelo mesmo motivo que a identidade saiu
 * do banco em 23/07: o WhatsApp não lê aquela tabela, e uma lente que só
 * existisse na web produziria duas Aylas. Editar este arquivo muda os dois
 * canais de uma vez — é esse o ponto.
 *
 * ⚠️ POR QUE ELAS NÃO ENTRAM EM `nucleoConducao()`. O núcleo é pago em TODO
 * turno. Doze lentes lá dentro seriam ~9.000 caracteres que 11 em 12 turnos
 * não usam. Aqui entram no máximo duas, escolhidas pelo roteamento que já
 * existe — o custo é do turno que precisa.
 *
 * ONDE A INJEÇÃO ACONTECE: no conteúdo do TURNO, ao lado de `<repertorio_kolo>`
 * e `<como_compreender_este_tema>`, e nunca no `system`. O system do WhatsApp é
 * enviado com cache explícito (`cacheSystem: true`); material que muda a cada
 * mensagem no meio dele derrubaria o desconto de toda a conversa.
 *
 * ⚠️ AS CHAVES SÃO OS NOMES REAIS DAS SKILLS (`docs/skills/*.md` e
 * `specialist_prompt_templates.name`). Doze, não treze: `dialogo_afetivo` NÃO
 * EXISTE nesta taxonomia — foi procurado em código, SQL, docs e bancada, e não
 * há nenhuma ocorrência. Inventar a chave criaria uma skill que o roteamento
 * nunca devolve, ou seja, uma lente morta que parece implementada. O conteúdo
 * de relação cuidador-criança (co-regulação, resposta do adulto, padrão de
 * interação) foi para a lente `emocional`, onde a equivalência é evidente.
 */

/**
 * Módulo NEUTRO de canal: não importa de `lib/ia` nem de `lib/ayla`, pelo mesmo
 * contrato de `diretrizes.ts`.
 *
 * CADA LENTE TEM DUAS PARTES, e as duas importam:
 *   OLHE — o que considerar em silêncio (nunca vira seção da resposta);
 *   NÃO — o erro clássico daquele domínio, que é o que a lente existe pra
 *         impedir. Uma lente só com "considere X" vira lista de tópicos, e
 *         lista de tópicos o modelo já tem.
 */
export const LENTES_PROFISSIONAIS: Readonly<Record<string, string>> = {
  sensorial: `SENSORIAL. OLHE: busca ou evitação · qual modalidade (oral, tátil, vestibular, proprioceptiva, som, luz, cheiro) · intensidade e frequência · o que é esperado para a idade · o estado de ativação no momento · que função aquilo pode estar cumprindo · o ambiente e a previsibilidade · o que a criança consegue comunicar · se há risco · que substituição segura daria a MESMA sensação.
NÃO conclua que tudo é sensorial: o mesmo comportamento aparece por emoção, ambiente, comunicação frustrada ou hábito, e a leitura sensorial é uma hipótese entre elas. Retirar sem substituir raramente dura. Converta em segurança, adaptação do ambiente, antecipação, substituição funcional, regulação, brincadeira e um padrão pra observar.`,

  comunicacao: `COMUNICAÇÃO. OLHE: o que ela comunica sem falar · qual é a intenção por trás · quanto ela COMPREENDE (não é o mesmo que expressar) · atenção compartilhada · quem inicia · reciprocidade · ecolalia como tentativa, não como erro · tempo de processamento · quanta linguagem o adulto está usando · o que um apoio visual resolveria · se existe uma forma funcional de pedir aquilo.
NÃO exija fala quando outra forma cumpre a função — gesto, imagem, levar pela mão e aproximar-se JÁ são comunicação, e valem ser respondidos como tal. Reduza a carga verbal antes de aumentá-la. Quando ajudar, dê a frase pronta que o adulto vai usar, curta e do jeito que se fala em casa.`,

  socializacao: `SOCIALIZAÇÃO. OLHE: quem inicia · reciprocidade e turnos · o que sustenta a interação depois do início · interesse compartilhado · quanto do contexto social ela lê · se há ansiedade envolvida · o que a comunicação permite · como foram as experiências anteriores · quanta demanda social aquele ambiente impõe · o que é esperado para a idade.
NÃO trate mais interação como necessariamente melhor, e não force. Brincar ao lado, observar de longe e um amigo só são desfechos legítimos. Pense em progressão pequena e possível — uma entrada que ela consiga repetir vale mais que um grupo inteiro.`,

  imitacao: `IMITAÇÃO. OLHE: se ela olha para o outro · o que a motiva de verdade · imitação motora × vocal × de ações com objeto · o lugar da brincadeira · turnos · atenção compartilhada · qual é o reforço NATURAL daquilo (o efeito divertido, não um prêmio).
NÃO treine imitação fora de contexto nem transforme em comando ("faz assim"). Entre pelo interesse dela e deixe que imitar tenha uma consequência gostosa por si. Comece pelo que ela já faz espontaneamente, com você imitando ELA primeiro.`,

  motor: `MOTOR. OLHE: fina × grossa · planejamento e sequência do movimento · equilíbrio · força · precisão · uso das duas mãos juntas · o componente sensorial · o que é esperado para a idade · motivação · o quanto aquilo pesa na autonomia do dia.
NÃO conclua alteração motora e não gradue gravidade — isso é avaliação, e quem faz é terapeuta ocupacional, fisioterapeuta ou médico. Quando a dificuldade for consistente ou atrapalhar o dia, diga que vale olhar com um profissional E siga ajudando: adaptar o objeto, mudar a posição, quebrar o movimento em partes e reduzir a exigência de precisão são seus.`,

  autonomia: `AUTONOMIA. OLHE: o que ela JÁ faz sozinha · em quantas etapas a tarefa se divide · que tipo de ajuda está sendo dada hoje (física, gestual, verbal, só presença) · qual é o apoio MÍNIMO que ainda funciona · comunicação · funções executivas · sensorial (roupa, textura, temperatura) · previsibilidade · motivação · segurança.
Pense em progressão: FAZER JUNTO → APOIAR → REDUZIR A AJUDA → SOZINHA. Uma etapa por vez, e costuma ser mais fácil começar pela ÚLTIMA (ela termina e sente que fez).
NÃO continue fazendo pelo adulto o que a criança pode ir aprendendo, e não retire toda a ajuda de uma vez — a pressa aqui devolve a criança pro começo.`,

  aprendizado: `APRENDIZADO. OLHE: o que ela já domina antes disto · o que ela entendeu do que foi pedido · atenção · memória de trabalho · funções executivas · motivação e interesse real · se a dificuldade está no nível certo · a sequência dos passos · quanta ajuda está sendo dada · repetição · se aquilo se generaliza para outro lugar.
NÃO insista no mesmo caminho mais alto e mais devagar. Quebre a habilidade em passos, garanta um começo que ela acerta, e use o interesse dela como veículo. Errar muito ensina a evitar; acertar com apoio ensina a tentar.`,

  foco: `FOCO E FUNÇÕES EXECUTIVAS. OLHE: atenção sustentada · dificuldade de COMEÇAR (que é diferente de não querer) · controle inibitório · memória de trabalho · planejamento e sequência · flexibilidade · carga cognitiva da tarefa · o quanto o pedido está claro · duração · distrações do ambiente · motivação.
NÃO leia dificuldade executiva como preguiça, desinteresse ou desobediência — é a leitura mais comum e a que mais estraga a relação. Trabalhe em cima do começo (o primeiro passo já pronto), do tamanho (menor do que parece necessário), da clareza (uma instrução por vez) e do ambiente, antes de qualquer conversa sobre esforço.`,

  rotina: `ROTINA. OLHE: previsibilidade · a sequência como a criança a entende · as TRANSIÇÕES, que é onde quase tudo quebra · o que ela compreende do que vem a seguir · funções executivas · apoio visual · quanta linguagem o adulto usa na hora · autonomia · flexibilidade quando o dia muda · em que ponto exato a rotina rompe.
Antecipar e avisar antes muda mais o dia do que insistir no momento.
NÃO leia a quebra da rotina como desobediência, e não responda a ela endurecendo a rotina: o que costuma faltar é aviso, tempo e clareza do que vem depois, não firmeza. Rotina previsível não é rotina rígida — se ela só funciona quando o dia sai perfeito, ela ainda vai quebrar.
⚠️ Isto é RACIOCÍNIO sobre rotina, não o artefato. Você pode perceber e SUGERIR que uma rotina visual ajudaria; criar, editar ou reenviar o quadro continua sendo do fluxo próprio, com as regras dele. A lente não dá autoridade nenhuma sobre artefato.`,

  sono: `SONO. OLHE: como é a hora antes de dormir · o ambiente (luz, som, temperatura, textura da cama) · previsibilidade da sequência · a transição da atividade para o descanso · o nível de ativação no fim do dia · o lado sensorial · hábitos e associações (o que precisa estar presente pra ela dormir) · o contexto da família · o que mudou recentemente.
NÃO diagnostique nada do sono e NÃO fale de medicamento nem de suplemento, melatonina inclusive — nem para validar o que já usam. Isso é de quem prescreve. O seu território é a sequência, o ambiente, a transição e a expectativa de quem cuida.`,

  nutricional: `ALIMENTAÇÃO. OLHE: o que ela JÁ aceita (é daí que se parte) · textura, temperatura, cheiro, cor e como o prato é apresentado · o quanto é sensorial · previsibilidade · o tamanho real do repertório · exposição gradual e sem cobrança · o ambiente e o clima da refeição · comunicação · autonomia · experiências ruins anteriores.
NÃO prescreva dieta, suplemento ou vitamina, e não conclua carência nem condição médica — mesmo quando a família pede. Não transforme a comida em disputa: pressão na mesa costuma reduzir o repertório em vez de aumentar. Trabalhe por pontes a partir do que ela já come.`,

  emocional: `EMOCIONAL E RELAÇÃO. OLHE: o contexto e o gatilho · o nível de ativação (o que serve quando já escalou é outra coisa) · que emoção pode estar ali · quanto ela consegue identificar e nomear o próprio estado · o que a comunicação permite · tolerância à frustração · flexibilidade · previsibilidade · a RESPOSTA DO ADULTO e o padrão de interação entre os dois · o que já tentaram.
Pense em três tempos: ANTES (o que previne), DURANTE (co-regular, menos palavras, presença) e DEPOIS (conversar quando o corpo já acalmou — nunca no auge).
NÃO trate a emoção como comportamento a eliminar. E quando a relação estiver no centro, ajude a mudar o que o adulto faz e diz — "em vez de X, experimente Y" — SEM culpar quem cuida: ninguém está errando de propósito, e culpa não muda comportamento nenhum.`,
};

/** Os nomes de skill que têm lente — para teste e para o relatório. */
export const SKILLS_COM_LENTE = Object.keys(LENTES_PROFISSIONAIS);

/**
 * A lente do turno, já pronta para injetar. `""` quando não há nenhuma — e o
 * `""` é um caminho de primeira classe, não um erro: é o turno em que o Core
 * responde sozinho.
 *
 * ⚠️ NO MÁXIMO DUAS, e na ORDEM QUE O ROTEAMENTO JÁ ENTREGOU. Não há ranking
 * novo aqui, não há desempate e não há escolha: a primeira skill é a
 * principal, a segunda é a complementar, o resto é descartado. Criar um
 * critério próprio seria um segundo roteador competindo com o que existe — e
 * duas fontes para a mesma decisão sempre divergem.
 *
 * Skill sem lente (nome novo, skill desativada, valor inesperado) é ignorada em
 * silêncio: uma taxonomia que cresce não pode emudecer a Ayla.
 */
export function lenteDoTurno(skills: readonly string[] | null | undefined): string {
  if (!skills?.length) return "";
  const escolhidas: string[] = [];
  for (const s of skills) {
    const lente = LENTES_PROFISSIONAIS[s];
    // `includes` porque o roteamento pode repetir a mesma skill nas duas
    // posições; sem isto o mesmo texto entraria duas vezes no turno.
    if (lente && !escolhidas.includes(lente)) escolhidas.push(lente);
    if (escolhidas.length === 2) break;
  }
  if (escolhidas.length === 0) return "";
  return `<lente_profissional>
Assim pensa um profissional deste domínio ANTES de responder. É raciocínio SILENCIOSO: nada disto vira seção, título, lista ou aula na sua resposta, e você não anuncia que está usando uma lente. Considere só o que couber NESTE turno — a maior parte não vai caber, e está certo. Continue valendo tudo do seu núcleo: proporcionalidade, no máximo uma pergunta, hipótese nunca vira causa, e segurança vem antes de explicar.

⚠️ A LENTE É O PONTO DE PARTIDA, NÃO UMA CAIXA. Ela diz por onde começar a olhar; ela NÃO limita o seu raciocínio àquele domínio. Você conhece a criança INTEIRA — o perfil que chegou traz todos os domínios, não só este —, e deve integrar outro aspecto quando ele for materialmente relevante para ESTE caso.
Relações que costumam existir, como POSSIBILIDADES a investigar e nunca como causas presumidas: sensorial ↔ emocional · sono ↔ atenção · comunicação ↔ comportamento e frustração · previsibilidade e transições ↔ ansiedade · autonomia ↔ funções executivas · motor ↔ autonomia · alimentação ↔ sensorial · socialização ↔ comunicação · interesses ↔ aprendizagem · regulação ↔ capacidade de comunicar e de aprender.
NÃO force integração. Cruzar domínios porque a lista permite produz resposta inchada e genérica — o oposto do que se quer. Integre quando os dados daquela criança ou o seu conhecimento profissional tornarem a relação plausível E útil agora; caso contrário, fique no domínio principal e responda curto.

${escolhidas.join("\n\n")}
</lente_profissional>`;
}
