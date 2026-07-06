/**
 * Copy do onboarding CONVERSACIONAL (Ideia 2) como DADO — não como código.
 * É a fonte que o preview do admin renderiza e que, nas próximas fatias, vai pro
 * banco (rascunho/publicado) e fica editável por IA. Por isso é uma estrutura
 * serializável simples (nada de JSX/função aqui).
 *
 * Placeholders: [NOME] = nome da criança; [VOCE] = como a mãe/cuidador se chama.
 */

export type OnbChip = { value: string; label: string };

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
      id: "crianca_nome",
      ayla: "Quem é a criança que a gente vai cuidar junto?",
      tipo: "texto",
      placeholder: "O nome dele ou dela",
    },
    {
      id: "crianca_nascimento",
      ayla: "Qual a data de aniversário do [NOME]? Assim eu cresço junto — minhas ideias acompanham a idade certinha.",
      tipo: "data",
      placeholder: "dd/mm/aaaa",
    },
    {
      id: "crianca_diagnostico",
      ayla: "E como é o [NOME]? Pode tocar em mais de um — ou no que ainda está em investigação.",
      tipo: "chips_multi",
      opcoes: [
        { value: "TEA", label: "Autismo (TEA)" },
        { value: "TDAH", label: "TDAH" },
        { value: "Dislexia", label: "Dislexia" },
        { value: "AHSD", label: "Altas habilidades" },
        { value: "EmInvestigacao", label: "Em investigação" },
        { value: "Outro", label: "Outro" },
      ],
    },
    {
      id: "desafios",
      ayla: "O que mais pesa no dia a dia agora? Toca no que hoje está difícil — a gente começa por aí.",
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
      id: "voce",
      ayla: "E você, como te chamo?",
      tipo: "texto",
      placeholder: "Seu nome",
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
