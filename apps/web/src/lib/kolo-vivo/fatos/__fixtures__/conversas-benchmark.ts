/**
 * BATERIA DE REFERÊNCIA — 50 conversas sintéticas.
 *
 * ⚠️ Nenhuma família real. Nomes, situações e falas foram escritos para este
 * arquivo, cobrindo os casos que quebram sistemas de memória.
 *
 * Este arquivo é PATRIMÔNIO: serve a três benchmarks diferentes, e por isso
 * cada caso guarda duas coisas separadas.
 *
 *   `mensagem`  — o que a pessoa escreveu, cru.
 *   `extracao`  — o que o extrator DEVERIA produzir a partir dela.
 *
 * Com essa separação:
 *   - hoje, a camada determinística (adaptador → serviço) é auditada usando
 *     `extracao`, sem depender de IA nem de banco;
 *   - depois, o EXTRATOR é medido comparando a saída dele com `extracao` — é o
 *     golden set;
 *   - mais adiante, Retrato e Deliberação são medidos sobre os mesmos casos, e
 *     aí dá para comparar versões entre si.
 *
 * `esperado` guarda o julgamento humano sobre o caso. Onde ele diverge do que o
 * código faz hoje, o teste NÃO falha: registra como achado. Um benchmark que
 * quebra a cada defeito conhecido vira ruído e alguém acaba desligando.
 */

import type { FactKind, SourceChannel, SourceType, VerificationStatus } from "../tipos";

/** Quem escreveu. Vira proveniência, e um dia vira filtro de audiência. */
export type Interlocutor =
  | "mae"
  | "pai"
  | "avo"
  | "professora"
  | "terapeuta"
  | "pessoa_acompanhada";

export type ItemExtraido = {
  campo: string;
  subcampo?: string | null;
  texto: string;
};

export type CasoBenchmark = {
  id: string;
  /** Para agrupar métricas: sono, escola, sensorial… */
  tema: string;
  canal: SourceChannel;
  interlocutor: Interlocutor;
  mensagem: string;
  /** O que o extrator deveria produzir. Vazio = não deveria extrair nada. */
  extracao: ItemExtraido[];
  esperado: {
    /** O sujeito da informação é a pessoa acompanhada? */
    sobreAPessoa: boolean;
    /** Cada item de `extracao` deveria ser uma afirmação só? */
    atomico: boolean;
    sourceType: SourceType;
    verificationStatus: VerificationStatus;
    factKind: FactKind;
    /** Mais de uma pessoa mencionada — risco de associar ao perfil errado. */
    ambiguoQuantoAPessoa?: boolean;
    /** O caso existe para expor um defeito conhecido. */
    exponhaDefeito?: string;
  };
};

const REL: SourceType = "caregiver_report";
const MAN: SourceType = "manual_entry";

export const CASOS: readonly CasoBenchmark[] = [
  // ---------------------------------------------------------------- SONO
  {
    id: "sono-01", tema: "sono", canal: "whatsapp", interlocutor: "mae",
    mensagem: "Ele acorda toda madrugada, umas 3h, e demora quase uma hora pra voltar a dormir.",
    extracao: [{ campo: "corpo_rotina", subcampo: "sono", texto: "Acorda por volta das 3h e demora cerca de 1h para voltar a dormir" }],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: REL, verificationStatus: "reported", factKind: "pattern" },
  },
  {
    id: "sono-02", tema: "sono", canal: "whatsapp", interlocutor: "mae",
    mensagem: "Ontem ele dormiu a noite inteira pela primeira vez em meses!",
    extracao: [{ campo: "corpo_rotina", subcampo: "sono", texto: "Dormiu a noite inteira" }],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: REL, verificationStatus: "reported", factKind: "event" },
  },
  {
    id: "sono-03", tema: "sono", canal: "diario", interlocutor: "mae",
    mensagem: "Rotina de sono: banho, história, luz baixa. Funciona quando a gente segue.",
    extracao: [{ campo: "corpo_rotina", subcampo: "sono", texto: "Rotina de banho, história e luz baixa ajuda a dormir" }],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: MAN, verificationStatus: "reported", factKind: "support" },
  },
  {
    id: "sono-04", tema: "sono", canal: "whatsapp", interlocutor: "mae",
    mensagem: "Eu não durmo há três dias, tô destruída.",
    extracao: [],
    esperado: { sobreAPessoa: false, atomico: true, sourceType: REL, verificationStatus: "reported", factKind: "statement",
      exponhaDefeito: "informação sobre a cuidadora não pode virar fato da pessoa acompanhada" },
  },

  // ------------------------------------------------------------ SENSORIAL
  {
    id: "sens-01", tema: "sensorial", canal: "whatsapp", interlocutor: "mae",
    mensagem: "O barulho do liquidificador faz ele tapar os ouvidos e sair correndo.",
    extracao: [{ campo: "sensorial", subcampo: "hipersensibilidade_auditiva", texto: "Tapa os ouvidos e sai correndo com o barulho do liquidificador" }],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: REL, verificationStatus: "reported", factKind: "trigger" },
  },
  {
    id: "sens-02", tema: "sensorial", canal: "web", interlocutor: "mae",
    mensagem: "O barulho do liquidificador incomoda muito ele.",
    extracao: [{ campo: "sensorial", subcampo: "hipersensibilidade_auditiva", texto: "Incomoda-se com o barulho do liquidificador" }],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: REL, verificationStatus: "reported", factKind: "trigger" },
  },
  {
    id: "sens-03", tema: "sensorial", canal: "whatsapp", interlocutor: "mae",
    mensagem: "Ele não aceita etiqueta na roupa de jeito nenhum, corta tudo.",
    extracao: [{ campo: "sensorial", subcampo: "tato", texto: "Não tolera etiqueta na roupa" }],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: REL, verificationStatus: "reported", factKind: "trigger" },
  },
  {
    id: "sens-04", tema: "sensorial", canal: "whatsapp", interlocutor: "mae",
    mensagem: "Ele adora ficar embaixo do cobertor pesado, parece que acalma.",
    extracao: [{ campo: "sensorial", subcampo: "proprioceptivo", texto: "Cobertor pesado parece acalmar" }],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: REL, verificationStatus: "uncertain", factKind: "support" },
  },
  {
    id: "sens-05", tema: "sensorial", canal: "whatsapp", interlocutor: "mae",
    mensagem: "No mercado ele fica agitado, mas em casa é tranquilo.",
    extracao: [{ campo: "sensorial", texto: "Fica agitado no mercado; tranquilo em casa" }],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: REL, verificationStatus: "reported", factKind: "pattern",
      exponhaDefeito: "variação por contexto deveria virar dois fatos com `contexto` preenchido" },
  },

  // --------------------------------------------------------- ALIMENTAÇÃO
  {
    id: "alim-01", tema: "alimentacao", canal: "whatsapp", interlocutor: "mae",
    mensagem: "Ele só come coisa crocante. Pastoso ele cospe.",
    extracao: [
      { campo: "nutricional", subcampo: "seletividade", texto: "Aceita alimentos crocantes" },
      { campo: "nutricional", subcampo: "seletividade", texto: "Recusa alimentos pastosos" },
    ],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: REL, verificationStatus: "reported", factKind: "preference" },
  },
  {
    id: "alim-02", tema: "alimentacao", canal: "web", interlocutor: "mae",
    mensagem: "Come arroz e feijão, mas recusa qualquer coisa pastosa e chora na mesa.",
    extracao: [{ campo: "nutricional", texto: "Come arroz e feijão, mas recusa qualquer coisa pastosa e chora na mesa" }],
    esperado: { sobreAPessoa: true, atomico: false, sourceType: REL, verificationStatus: "uncertain", factKind: "statement",
      exponhaDefeito: "três afirmações num fato só — atomicidade" },
  },
  {
    id: "alim-03", tema: "alimentacao", canal: "diario", interlocutor: "mae",
    mensagem: "Hoje aceitou brócolis cozido pela primeira vez.",
    extracao: [{ campo: "nutricional", subcampo: "seletividade", texto: "Aceitou brócolis cozido" }],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: MAN, verificationStatus: "reported", factKind: "event" },
  },
  {
    id: "alim-04", tema: "alimentacao", canal: "whatsapp", interlocutor: "mae",
    mensagem: "Aquilo que eu falei de ele não comer fruta, na verdade ele come banana.",
    extracao: [{ campo: "nutricional", subcampo: "seletividade", texto: "Come banana" }],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: REL, verificationStatus: "reported", factKind: "preference",
      exponhaDefeito: "correção de informação anterior — deveria superseder, não empilhar" },
  },

  // -------------------------------------------------------- COMUNICAÇÃO
  {
    id: "com-01", tema: "comunicacao", canal: "whatsapp", interlocutor: "mae",
    mensagem: "Ele pega minha mão e me leva até o armário quando quer alguma coisa.",
    extracao: [{ campo: "comunicacao", subcampo: "intencao_comunicativa", texto: "Leva o adulto pela mão até o objeto que quer" }],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: REL, verificationStatus: "reported", factKind: "ability" },
  },
  {
    id: "com-02", tema: "comunicacao", canal: "whatsapp", interlocutor: "mae",
    mensagem: "Ele não fala nenhuma palavra ainda, tem 3 anos.",
    extracao: [{ campo: "comunicacao", subcampo: "fala_expressiva", texto: "Não usa palavras faladas" }],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: REL, verificationStatus: "reported", factKind: "statement" },
  },
  {
    id: "com-03", tema: "comunicacao", canal: "whatsapp", interlocutor: "mae",
    mensagem: "Ele falou 'água' hoje! Nunca tinha falado.",
    extracao: [{ campo: "comunicacao", subcampo: "fala_expressiva", texto: "Falou a palavra 'água' pela primeira vez" }],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: REL, verificationStatus: "reported", factKind: "milestone" },
  },
  {
    id: "com-04", tema: "comunicacao", canal: "whatsapp", interlocutor: "mae",
    mensagem: "Ele repete falas de desenho o dia inteiro.",
    extracao: [{ campo: "comunicacao", subcampo: "ecolalia", texto: "Repete falas de desenho animado" }],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: REL, verificationStatus: "reported", factKind: "pattern" },
  },
  {
    id: "com-05", tema: "comunicacao", canal: "whatsapp", interlocutor: "mae",
    mensagem: "Ele nunca olha na minha cara quando eu falo com ele.",
    extracao: [{ campo: "comunicacao", subcampo: "contato_visual", texto: "Evita contato visual durante a fala do adulto" }],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: REL, verificationStatus: "reported", factKind: "pattern" },
  },

  // -------------------------------------------------------------- ESCOLA
  {
    id: "esc-01", tema: "escola", canal: "whatsapp", interlocutor: "professora",
    mensagem: "Aqui na escola ele fica sozinho no recreio, mas participa bem na sala.",
    extracao: [
      { campo: "socializacao", texto: "Fica sozinho no recreio" },
      { campo: "escola", texto: "Participa das atividades em sala" },
    ],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: "teacher_report", verificationStatus: "reported", factKind: "pattern",
      exponhaDefeito: "nenhum fluxo hoje registra `teacher_report`; a professora entraria como cuidadora" },
  },
  {
    id: "esc-02", tema: "escola", canal: "web", interlocutor: "mae",
    mensagem: "Ele trocou de escola em março e ficou muito mais agitado depois disso.",
    extracao: [
      { campo: "escola", texto: "Trocou de escola em março" },
      { campo: "desafios_regulacao", texto: "Ficou mais agitado depois da troca de escola" },
    ],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: REL, verificationStatus: "uncertain", factKind: "event",
      exponhaDefeito: "data histórica ('março') não é capturada — observado_em cai em hoje" },
  },
  {
    id: "esc-03", tema: "escola", canal: "whatsapp", interlocutor: "mae",
    mensagem: "A professora nova não entende nada dele, tô pensando em trocar.",
    extracao: [],
    esperado: { sobreAPessoa: false, atomico: true, sourceType: REL, verificationStatus: "reported", factKind: "statement",
      exponhaDefeito: "avaliação da mãe sobre a professora não é fato sobre a criança" },
  },
  {
    id: "esc-04", tema: "escola", canal: "diario", interlocutor: "mae",
    mensagem: "Lição de casa: consegue fazer se eu sentar junto e dividir em partes.",
    extracao: [{ campo: "aprendizado", subcampo: "apoio", texto: "Faz a lição quando o adulto senta junto e divide a tarefa em partes" }],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: MAN, verificationStatus: "reported", factKind: "support" },
  },

  // ------------------------------------------------------- COMPORTAMENTO
  {
    id: "comp-01", tema: "comportamento", canal: "whatsapp", interlocutor: "mae",
    mensagem: "Na hora de sair de casa ele trava e começa a chorar.",
    extracao: [{ campo: "rotina", subcampo: "transicoes", texto: "Trava e chora na transição de sair de casa" }],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: REL, verificationStatus: "reported", factKind: "pattern" },
  },
  {
    id: "comp-02", tema: "comportamento", canal: "whatsapp", interlocutor: "mae",
    mensagem: "Teve uma crise enorme no mercado ontem, deitou no chão.",
    extracao: [{ campo: "desafios_regulacao", texto: "Crise no mercado, deitou no chão" }],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: REL, verificationStatus: "reported", factKind: "event" },
  },
  {
    id: "comp-03", tema: "comportamento", canal: "whatsapp", interlocutor: "mae",
    mensagem: "Quando avisa 5 minutos antes ele lida bem melhor com a saída.",
    extracao: [{ campo: "rotina", subcampo: "transicoes", texto: "Avisar 5 minutos antes ajuda na transição de saída" }],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: REL, verificationStatus: "reported", factKind: "tested_strategy" },
  },
  {
    id: "comp-04", tema: "comportamento", canal: "whatsapp", interlocutor: "mae",
    mensagem: "A rotina visual que a gente montou funcionou por umas três semanas, agora ele ignora.",
    extracao: [{ campo: "rotina", subcampo: "apoio_visual", texto: "Rotina visual funcionou por cerca de três semanas e depois deixou de funcionar" }],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: REL, verificationStatus: "reported", factKind: "tested_strategy",
      exponhaDefeito: "estratégia que deixou de funcionar — vitalidade, Fase 7" },
  },
  {
    id: "comp-05", tema: "comportamento", canal: "whatsapp", interlocutor: "mae",
    mensagem: "Ele bate a cabeça na parede quando fica muito bravo.",
    extracao: [{ campo: "desafios_regulacao", texto: "Bate a cabeça na parede quando muito irritado" }],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: REL, verificationStatus: "reported", factKind: "pattern" },
  },

  // ---------------------------------------------------------- HIPERFOCO
  {
    id: "hip-01", tema: "hiperfoco", canal: "whatsapp", interlocutor: "mae",
    mensagem: "Ele só fala de dinossauro, o dia inteiro, há uns seis meses.",
    extracao: [{ campo: "gostos", subcampo: "interesses", texto: "Interesse intenso e persistente por dinossauros há cerca de seis meses" }],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: REL, verificationStatus: "reported", factKind: "trait" },
  },
  {
    id: "hip-02", tema: "hiperfoco", canal: "whatsapp", interlocutor: "mae",
    mensagem: "Hoje ele gostou muito de futebol, ficou vendo o jogo inteiro.",
    extracao: [{ campo: "gostos", subcampo: "interesses", texto: "Assistiu ao jogo inteiro com interesse" }],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: REL, verificationStatus: "reported", factKind: "event",
      exponhaDefeito: "evento isolado NÃO pode virar preferência nem traço" },
  },
  {
    id: "hip-03", tema: "hiperfoco", canal: "whatsapp", interlocutor: "mae",
    mensagem: "Ele largou os dinossauros e agora é só planeta.",
    extracao: [{ campo: "gostos", subcampo: "interesses", texto: "Interesse atual por planetas" }],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: REL, verificationStatus: "reported", factKind: "preference",
      exponhaDefeito: "interesse anterior deveria perder vitalidade — Fase 7" },
  },

  // ------------------------------------------------------- DUAS CRIANÇAS
  {
    id: "irm-01", tema: "duas_criancas", canal: "whatsapp", interlocutor: "mae",
    mensagem: "O Pedro brinca com a irmã, mas a Ana não interage com ninguém.",
    extracao: [{ campo: "socializacao", texto: "O Pedro brinca com a irmã, mas a Ana não interage com ninguém" }],
    esperado: { sobreAPessoa: false, atomico: false, sourceType: REL, verificationStatus: "uncertain", factKind: "statement",
      ambiguoQuantoAPessoa: true, exponhaDefeito: "duas pessoas na mesma frase — associação ao perfil errado" },
  },
  {
    id: "irm-02", tema: "duas_criancas", canal: "whatsapp", interlocutor: "mae",
    mensagem: "O irmão dele é típico e come de tudo, já ele não.",
    extracao: [{ campo: "nutricional", texto: "Come menos variedade que o irmão" }],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: REL, verificationStatus: "uncertain", factKind: "statement",
      ambiguoQuantoAPessoa: true, exponhaDefeito: "comparação entre irmãos; o fato do irmão não pode entrar" },
  },
  {
    id: "irm-03", tema: "duas_criancas", canal: "web", interlocutor: "mae",
    mensagem: "Meus dois filhos são autistas, mas são completamente diferentes.",
    extracao: [],
    esperado: { sobreAPessoa: false, atomico: true, sourceType: REL, verificationStatus: "reported", factKind: "statement",
      ambiguoQuantoAPessoa: true },
  },

  // -------------------------------------------------- OUTROS CUIDADORES
  {
    id: "cuid-01", tema: "interlocutor", canal: "whatsapp", interlocutor: "pai",
    mensagem: "Aqui é o pai. Ele fica muito mais calmo comigo no fim de semana.",
    extracao: [{ campo: "desafios_regulacao", texto: "Mais calmo nos fins de semana com o pai" }],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: REL, verificationStatus: "reported", factKind: "pattern",
      exponhaDefeito: "o interlocutor não é identificado; entra como se fosse a mãe" },
  },
  {
    id: "cuid-02", tema: "interlocutor", canal: "whatsapp", interlocutor: "avo",
    mensagem: "Sou a avó. Quando ele fica aqui em casa, come melhor.",
    extracao: [{ campo: "nutricional", texto: "Come melhor na casa da avó" }],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: REL, verificationStatus: "reported", factKind: "pattern" },
  },
  {
    id: "cuid-03", tema: "interlocutor", canal: "web", interlocutor: "terapeuta",
    mensagem: "Na sessão de hoje ele manteve atenção conjunta por quase 3 minutos.",
    extracao: [{ campo: "socializacao", subcampo: "atencao_compartilhada", texto: "Manteve atenção conjunta por cerca de 3 minutos em sessão" }],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: "professional_report", verificationStatus: "observed", factKind: "event",
      exponhaDefeito: "nenhum fluxo registra `professional_report` nem `observed`" },
  },
  {
    id: "cuid-04", tema: "interlocutor", canal: "whatsapp", interlocutor: "pessoa_acompanhada",
    mensagem: "Oi, eu sou o Lucas. Não gosto quando muda a rotina sem avisar.",
    extracao: [{ campo: "rotina", subcampo: "transicoes", texto: "Não gosta de mudanças de rotina sem aviso" }],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: "accompanied_person_report", verificationStatus: "reported", factKind: "preference",
      exponhaDefeito: "auto-relato: proveniência mais forte, e muda o que pode ser devolvido — Fase 11" },
  },

  // --------------------------------------------------- REPETIÇÃO E DEDUP
  {
    id: "rep-01", tema: "repeticao", canal: "whatsapp", interlocutor: "mae",
    mensagem: "Já falei, mas ele realmente não tolera barulho de liquidificador.",
    extracao: [{ campo: "sensorial", subcampo: "hipersensibilidade_auditiva", texto: "Não tolera barulho de liquidificador" }],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: REL, verificationStatus: "reported", factKind: "pattern" },
  },
  {
    id: "rep-02", tema: "repeticao", canal: "diario", interlocutor: "mae",
    mensagem: "De novo hoje: barulho alto = crise.",
    extracao: [{ campo: "sensorial", subcampo: "hipersensibilidade_auditiva", texto: "Barulho alto desencadeia crise" }],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: MAN, verificationStatus: "reported", factKind: "pattern" },
  },

  // ------------------------------------------------------------ AUTONOMIA
  {
    id: "aut-01", tema: "autonomia", canal: "diario", interlocutor: "mae",
    mensagem: "Escovou os dentes sozinho hoje, sem eu pedir.",
    extracao: [{ campo: "autonomia", subcampo: "higiene", texto: "Escovou os dentes sem ser solicitado" }],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: MAN, verificationStatus: "reported", factKind: "event" },
  },
  {
    id: "aut-02", tema: "autonomia", canal: "web", interlocutor: "mae",
    mensagem: "Ele tem 17 anos e ainda preciso lembrar de tudo: banho, remédio, mochila.",
    extracao: [{ campo: "autonomia", texto: "Precisa de lembretes para banho, medicação e organização de material" }],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: REL, verificationStatus: "reported", factKind: "statement",
      exponhaDefeito: "adolescente/adulto — linguagem e autonomia esperada não podem ser de criança" },
  },
  {
    id: "aut-03", tema: "autonomia", canal: "whatsapp", interlocutor: "mae",
    mensagem: "Ele já se veste sozinho, só não consegue botão.",
    extracao: [
      { campo: "autonomia", subcampo: "vestir", texto: "Veste-se sozinho" },
      { campo: "motor", subcampo: "motricidade_fina", texto: "Ainda não abotoa botões" },
    ],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: REL, verificationStatus: "reported", factKind: "ability" },
  },

  // ------------------------------------------------------ SAÚDE E RISCO
  {
    id: "risco-01", tema: "saude", canal: "whatsapp", interlocutor: "mae",
    mensagem: "Ele tem alergia grave a amendoim.",
    extracao: [{ campo: "saude_geral", subcampo: "alergias", texto: "Alergia grave a amendoim" }],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: REL, verificationStatus: "reported", factKind: "trait",
      exponhaDefeito: "risco crítico NÃO pode perder vitalidade por silêncio — Fase 7" },
  },
  {
    id: "risco-02", tema: "saude", canal: "whatsapp", interlocutor: "mae",
    mensagem: "Ele falava algumas palavras e parou, perdeu o que já tinha.",
    extracao: [{ campo: "comunicacao", subcampo: "fala_expressiva", texto: "Perda de palavras que já usava" }],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: REL, verificationStatus: "reported", factKind: "event" },
  },
  {
    id: "risco-03", tema: "saude", canal: "web", interlocutor: "mae",
    mensagem: "Começou risperidona semana passada, indicação do neuro.",
    extracao: [{ campo: "saude_geral", subcampo: "medicacao", texto: "Iniciou risperidona por indicação médica" }],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: REL, verificationStatus: "reported", factKind: "event" },
  },

  // ------------------------------------------------------ IA E RUÍDO
  {
    id: "ia-01", tema: "inferencia", canal: "whatsapp", interlocutor: "mae",
    mensagem: "[sugestão da Ayla] Talvez usar uma rotina visual antes do banho ajude.",
    extracao: [{ campo: "rotina", texto: "Rotina visual antes do banho pode ajudar" }],
    esperado: { sobreAPessoa: false, atomico: true, sourceType: "ai_inference", verificationStatus: "inferred", factKind: "statement",
      exponhaDefeito: "recomendação da Ayla não é fato sobre a pessoa" },
  },
  {
    id: "ia-02", tema: "inferencia", canal: "web", interlocutor: "mae",
    mensagem: "[resumo da Ayla] Pelo que você contou, parece que o sensorial está no centro.",
    extracao: [],
    esperado: { sobreAPessoa: false, atomico: true, sourceType: "ai_inference", verificationStatus: "inferred", factKind: "statement",
      exponhaDefeito: "resposta da Ayla nunca pode virar memória sobre a pessoa" },
  },
  {
    id: "ruido-01", tema: "ruido", canal: "whatsapp", interlocutor: "mae",
    mensagem: "oi",
    extracao: [],
    esperado: { sobreAPessoa: false, atomico: true, sourceType: REL, verificationStatus: "reported", factKind: "statement" },
  },
  {
    id: "ruido-02", tema: "ruido", canal: "web", interlocutor: "mae",
    mensagem: "Ele é uma criança muito especial.",
    extracao: [{ campo: "como_e", texto: "É uma criança muito especial" }],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: REL, verificationStatus: "uncertain", factKind: "statement",
      exponhaDefeito: "afirmação sem conteúdo verificável não deveria virar fato" },
  },
  {
    id: "ruido-03", tema: "ruido", canal: "whatsapp", interlocutor: "mae",
    mensagem: "Quanto custa o plano?",
    extracao: [],
    esperado: { sobreAPessoa: false, atomico: true, sourceType: REL, verificationStatus: "reported", factKind: "statement" },
  },

  // ---------------------------------------------------------- CAMPANHA
  {
    id: "camp-01", tema: "campanha", canal: "whatsapp", interlocutor: "mae",
    mensagem: "Ele adorou a atividade da Copa de hoje, ficou vendo o jogo inteiro.",
    extracao: [{ campo: "gostos", subcampo: "interesses", texto: "Engajou-se na atividade temática de futebol" }],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: REL, verificationStatus: "reported", factKind: "event",
      exponhaDefeito: "deveria nascer com escopo de campanha — fonte de participação é Fase 8" },
  },
  {
    id: "camp-02", tema: "campanha", canal: "whatsapp", interlocutor: "mae",
    mensagem: "Dois meses depois da Copa ele ainda pede pra ver futebol.",
    extracao: [{ campo: "gostos", subcampo: "interesses", texto: "Continua pedindo para ver futebol" }],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: REL, verificationStatus: "reported", factKind: "pattern" },
  },
  {
    id: "camp-03", tema: "campanha", canal: "diario", interlocutor: "mae",
    mensagem: "Atividade da Copa: montou a bandeira sozinho.",
    extracao: [{ campo: "motor", subcampo: "motricidade_fina", texto: "Montou a bandeira sem ajuda" }],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: MAN, verificationStatus: "reported", factKind: "event" },
  },

  // ------------------------------------------------------------- IMITAÇÃO
  {
    id: "imi-01", tema: "imitacao", canal: "whatsapp", interlocutor: "mae",
    mensagem: "Ele imita tudo que o primo faz, mas não imita a gente.",
    extracao: [{ campo: "imitacao", texto: "Imita o primo, mas não imita os pais" }],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: REL, verificationStatus: "reported", factKind: "pattern" },
  },
  {
    id: "foc-01", tema: "foco", canal: "web", interlocutor: "mae",
    mensagem: "Ele não para quieto na cadeira, mas monta lego por duas horas.",
    extracao: [
      { campo: "foco", texto: "Dificuldade em permanecer sentado em atividade dirigida" },
      { campo: "foco", subcampo: "interesse", texto: "Sustenta atenção por até duas horas montando lego" },
    ],
    esperado: { sobreAPessoa: true, atomico: true, sourceType: REL, verificationStatus: "uncertain", factKind: "pattern" },
  },
];

/** Casos que existem para expor um defeito conhecido. */
export const CASOS_COM_DEFEITO = CASOS.filter((c) => c.esperado.exponhaDefeito);

/** Casos em que NADA deveria ser extraído. */
export const CASOS_SEM_EXTRACAO = CASOS.filter((c) => c.extracao.length === 0);
