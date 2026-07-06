/**
 * Copy do onboarding CONVERSACIONAL (Ideia 2) como DADO — não como código.
 * É a fonte que o preview do admin renderiza e que, nas próximas fatias, vai pro
 * banco (rascunho/publicado) e fica editável por IA. Por isso é uma estrutura
 * serializável simples (nada de JSX/função aqui).
 *
 * Placeholders: [NOME] = nome da criança; [VOCE] = como a mãe/cuidador se chama.
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

export type OnboardingCopy = {
  intro: { titulo: string; subtitulo: string };
  passos: OnbPasso[];
  /** Fecho: entrega valor na hora — dois caminhos. */
  garfo: { titulo: string; ajuda: string; explorar: string };
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
      id: "whatsapp",
      ayla: "Pra eu te acompanhar todo dia — e te mandar ideias pro [NOME] mesmo quando você não estiver no app — me passa seu WhatsApp?",
      tipo: "whatsapp",
      placeholder: "(11) 99999-9999",
      nota: "É por aqui que eu te mando planos e estratégias pensados pro [NOME]. (O +55 entra automático.)",
    },
    {
      id: "aceites",
      ayla: "Por último, dois combinados rapidinhos e a gente começa:",
      tipo: "aceites",
    },
  ],
  garfo: {
    titulo: "Tudo pronto, [VOCE]! Por onde você quer começar?",
    ajuda: "🎯 Me ajuda com um desafio agora",
    explorar: "🌿 Quero conhecer o app com calma",
  },
};
