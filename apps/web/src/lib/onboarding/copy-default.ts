/**
 * Copy do onboarding CONVERSACIONAL (Ideia 2) como DADO — não como código.
 * É a fonte que o preview do admin renderiza e que, nas próximas fatias, vai pro
 * banco (rascunho/publicado) e fica editável por IA. Por isso é uma estrutura
 * serializável simples (nada de JSX/função aqui).
 *
 * Placeholders: [NOME] = nome da pessoa cuidada (QUALQUER idade — nunca "criança");
 * [VOCE] = como o cuidador se chama; [TEMA] = o desafio escolhido.
 */

export type OnbChip = {
  value: string;
  label: string;
  /** Quando escolhido, abre um campo livre pra a pessoa escrever (ex.: "Outro(a)"). */
  livre?: boolean;
};

export type OnbTipo = "texto" | "data" | "chips_multi" | "chips_uni" | "whatsapp" | "aceites";

export type OnbPasso = {
  id: string;
  /** A fala da Ayla que abre o passo. */
  ayla: string;
  tipo: OnbTipo;
  placeholder?: string;
  /** Texto de apoio (ex.: por que pedimos o WhatsApp). */
  nota?: string;
  /** Opções pros passos de chips. */
  opcoes?: OnbChip[];
  /** Passo que pode ser pulado sem marcar nada (ex.: "em investigação"). */
  opcional?: boolean;
};

/**
 * Um dos caminhos do fecho. `destino` é o que o código faz com o toque, não uma
 * URL editável: a Karina reescreve emoji/título/texto no admin, mas não muda
 * pra onde vai (nem inventa caminho que não existe).
 */
export type OnbCaminhoId = "whatsapp" | "perfil" | "estrategia" | "rotina";
export type OnbCaminho = { destino: OnbCaminhoId; emoji: string; titulo: string; texto: string };

/**
 * Exemplos de interesse por faixa etária da PESSOA cuidada — pra nunca sugerir
 * brinquedo infantil a um adolescente/adulto. Viram chips que a pessoa toca (+ um
 * campo "outro" livre). A idade sai da data de nascimento já informada.
 */
export const EXEMPLOS_INTERESSE: { ateIdade: number; exemplos: string[] }[] = [
  { ateIdade: 5, exemplos: ["música", "bichinhos", "água", "texturas", "dançar"] },
  { ateIdade: 11, exemplos: ["desenhar", "animais", "montar (Lego)", "personagens", "jogos", "esportes"] },
  { ateIdade: 17, exemplos: ["jogos", "música", "séries e filmes", "esportes", "tecnologia", "desenhar"] },
  { ateIdade: 200, exemplos: ["música", "cinema", "leitura", "contato com a natureza", "culinária", "esportes", "arte"] },
];

export function exemplosInteressePorIdade(idade: number | null): string[] {
  const b = EXEMPLOS_INTERESSE.find((x) => (idade ?? 99) <= x.ateIdade) ?? EXEMPLOS_INTERESSE[EXEMPLOS_INTERESSE.length - 1];
  return b.exemplos;
}

export type OnboardingCopy = {
  intro: { titulo: string; subtitulo: string };
  passos: OnbPasso[];
  /**
   * Fecho: quatro portas, com a conversa no WhatsApp em destaque. Falar com a
   * Ayla é o que separa quem ativa de quem empaca — dos 15 que concluíram o
   * cadastro em julho, os 7 que nunca escreveram pra ela ficaram parados.
   */
  garfo: { titulo: string; caminhos?: OnbCaminho[] };
  /** Caminho "começar por um desafio": escolhe um tema e a Ayla abre a conversa. */
  desafio: { pergunta: string; abertura: string };
};

export const ONBOARDING_COPY_DEFAULT: OnboardingCopy = {
  intro: {
    titulo: "Oi! Eu sou a Ayla 💛",
    subtitulo:
      "Vou te acompanhar no dia a dia. Pra começar, me conta um pouquinho sobre vocês — é rápido, e quase tudo é só tocar.",
  },
  passos: [
    {
      id: "membro_nome",
      ayla: "Pra começar: quem é a pessoa que você cuida?",
      tipo: "texto",
      placeholder: "O nome dele ou dela",
    },
    {
      id: "membro_genero",
      ayla: "Sobre [NOME]: falo no feminino ou no masculino?",
      tipo: "chips_uni",
      opcoes: [
        { value: "feminino", label: "Feminino" },
        { value: "masculino", label: "Masculino" },
      ],
    },
    {
      id: "membro_nascimento",
      ayla: "Qual a data de nascimento de [NOME]? Assim minhas ideias acompanham a fase de vida — do jeito certo pra cada idade.",
      tipo: "data",
      placeholder: "dd/mm/aaaa",
    },
    {
      id: "membro_laudo",
      ayla: "[NOME] já tem laudo de alguma coisa? Toca em tudo que já tem — e se ainda não tiver, é só pular.",
      tipo: "chips_multi",
      opcional: true,
      opcoes: [
        { value: "TEA", label: "Autismo (TEA)" },
        { value: "TDAH", label: "TDAH" },
        { value: "Dislexia", label: "Dislexia" },
        { value: "AHSD", label: "Altas habilidades" },
        { value: "Outro", label: "Outro", livre: true },
      ],
    },
    {
      id: "membro_investigacao",
      ayla: "E tem algo ainda em investigação, sem laudo? (pode pular também)",
      tipo: "chips_multi",
      opcional: true,
      opcoes: [
        { value: "TEA", label: "Autismo (TEA)" },
        { value: "TDAH", label: "TDAH" },
        { value: "Dislexia", label: "Dislexia" },
        { value: "AHSD", label: "Altas habilidades" },
        { value: "Outro", label: "Outro", livre: true },
      ],
    },
    {
      id: "desafios",
      ayla: "O que mais pesa no dia a dia agora? Pode marcar vários — toque em tudo o que hoje está difícil. A gente começa por aí.",
      tipo: "chips_multi",
      opcoes: [
        { value: "comunicacao", label: "Comunicação" },
        { value: "sono", label: "Sono" },
        { value: "foco", label: "Foco" },
        { value: "nutricional", label: "Alimentação" },
        { value: "socializacao", label: "Socialização" },
        { value: "emocional", label: "Emoções / crises" },
        { value: "escola", label: "Escola" },
        { value: "autonomia", label: "Autonomia" },
        { value: "rotina", label: "Rotina / transições" },
      ],
    },
    {
      id: "membro_interesses",
      ayla: "O que [NOME] mais gosta de fazer? Toque no que combina — e adicione outros se quiser.",
      tipo: "chips_multi",
      opcional: true,
      // As opções aparecem conforme a idade (o app injeta); aqui fica só o "outro".
      opcoes: [{ value: "Outro", label: "Outro", livre: true }],
    },
    {
      id: "whatsapp",
      ayla: "Pra eu te acompanhar todo dia — e te mandar ideias pra [NOME] mesmo quando você não estiver no app — me passa seu WhatsApp?",
      tipo: "whatsapp",
      placeholder: "(11) 99999-9999",
      nota: "É por aqui que eu te mando planos e estratégias pensados pra [NOME]. (O +55 entra automático.)",
    },
    {
      id: "voce_nome",
      ayla: "Agora me conta de você: como te chamo?",
      tipo: "texto",
      placeholder: "Seu nome",
    },
    {
      id: "voce_relacao",
      ayla: "E você é o quê de [NOME]?",
      tipo: "chips_uni",
      opcoes: [
        { value: "mae", label: "Mãe" },
        { value: "pai", label: "Pai" },
        { value: "avo", label: "Avó" },
        { value: "avoh", label: "Avô" },
        { value: "outro", label: "Outro(a)", livre: true },
      ],
    },
    {
      id: "aceites",
      ayla: "Antes de seguir, dois combinados rapidinhos:",
      tipo: "aceites",
    },
    {
      id: "voce_faixa",
      ayla: "E você, em que faixa de idade está? (só pra eu conhecer melhor as famílias — pode pular)",
      tipo: "chips_uni",
      opcoes: [
        { value: "18-25", label: "18 a 25" },
        { value: "26-35", label: "26 a 35" },
        { value: "36-45", label: "36 a 45" },
        { value: "46-59", label: "46 a 59" },
        { value: "60+", label: "60 ou mais" },
        { value: "na", label: "Prefiro não dizer" },
      ],
    },
    {
      id: "voce_horario",
      ayla: "Qual horário costuma ser melhor pra eu te escrever no WhatsApp?",
      tipo: "chips_uni",
      opcional: true,
      opcoes: [
        { value: "manha", label: "De manhã" },
        { value: "meio_dia", label: "No meio do dia" },
        { value: "tarde", label: "À tarde" },
        { value: "noite", label: "À noite" },
      ],
    },
  ],
  garfo: {
    titulo: "Tudo pronto, [VOCE]! Por onde você quer começar?",
    caminhos: [
      {
        destino: "whatsapp",
        emoji: "💬",
        titulo: "Falar comigo agora no WhatsApp",
        texto: "Abre a conversa já começada. É por lá que eu te acompanho todo dia.",
      },
      {
        destino: "perfil",
        emoji: "🌱",
        titulo: "Completar o perfil de [NOME]",
        texto: "Você me contou o começo. Quanto mais eu souber, mais minhas ideias combinam com [NOME].",
      },
      {
        destino: "estrategia",
        emoji: "💡",
        titulo: "Pedir uma estratégia",
        texto: "Me conta um desafio e eu devolvo um caminho prático pra testar hoje.",
      },
      {
        destino: "rotina",
        emoji: "🗓️",
        titulo: "Montar a rotina visual",
        texto: "A sequência do dia em cartões pra imprimir. Dá pra montar comigo, conversando.",
      },
    ],
  },
  desafio: {
    pergunta: "Boa escolha 💛 Por qual a gente começa?",
    abertura:
      "Combinado! Vou pensar em [TEMA] com carinho e já te trago as primeiras ideias — aqui e no seu WhatsApp. Me conta, por texto ou áudio, o que mais te preocupa nisso?",
  },
};

/**
 * A ORDEM das perguntas é decisão de produto, não de copy — mora aqui, no
 * código, e é imposta sobre qualquer copy publicada no banco. Sem isso, mudar a
 * ordem no `ONBOARDING_COPY_DEFAULT` não teria efeito nenhum em produção: a
 * copy publicada (onboarding_copy.publicado) vence, e ela carrega a ordem
 * antiga congelada de quando foi publicada.
 *
 * O que a ordem protege: `voce_nome`/`voce_relacao` vêm ANTES de `aceites`.
 * Quem desistia depois de consentir saía sem nome nenhum, e a gente perdia
 * justamente o lead mais quente do funil — consentiu e não terminou.
 *
 * Passos que não existem no default (copy futura) ficam no fim, na ordem em que
 * vieram — nunca somem.
 */
export function ordenarPassos(passos: OnbPasso[]): OnbPasso[] {
  const pos = new Map(ONBOARDING_COPY_DEFAULT.passos.map((p, i) => [p.id, i]));
  const fim = Number.MAX_SAFE_INTEGER;
  return [...passos].sort((a, b) => (pos.get(a.id) ?? fim) - (pos.get(b.id) ?? fim));
}

/**
 * Estrutura vem do código, texto vem do banco. Aplica a ordem dos passos e
 * repõe os caminhos do fecho quando a copy publicada é anterior a eles — assim
 * uma copy antiga não perde as edições de texto que a Karina já fez.
 */
export function normalizarCopy(copy: OnboardingCopy): OnboardingCopy {
  return {
    ...copy,
    passos: ordenarPassos(copy.passos),
    garfo: {
      titulo: copy.garfo.titulo,
      caminhos: copy.garfo.caminhos?.length
        ? copy.garfo.caminhos
        : ONBOARDING_COPY_DEFAULT.garfo.caminhos,
    },
  };
}
