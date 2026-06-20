/**
 * Helper que monta o prompt canônico do avatar a partir dos campos
 * descritivos. Vários estilos ilustrados, nunca foto-realista (PRD §7.14).
 */

/**
 * Estilos disponíveis — fonte única (label pro form, prompt pra geração).
 * Ao adicionar um estilo aqui, lembrar de soltar o CHECK do banco
 * (migração avatares_membros_atipicos.estilo).
 */
/**
 * Estilos 3D/boneco (curadoria jun/2026 — Karina pediu look 3D, tipo
 * Disney/Playmobil, não desenho plano). `label`/`descricao` aparecem pro
 * usuário; `prompt` vai pro modelo de imagem.
 *
 * NOTA: depois da migração 0043 (que solta o CHECK de estilo), mudar esta
 * lista é SÓ código — não precisa mais mexer no banco.
 */
export const AVATAR_ESTILOS = [
  {
    value: "animacao_3d",
    label: "Animação 3D",
    descricao: "Cara de filme de animação — fofo, olhos grandes, brilho de cinema.",
    prompt:
      "Personagem em estilo de animação 3D de grande estúdio (CGI), renderização suave e fofa, olhos grandes e expressivos, proporções amigáveis, iluminação cinematográfica macia",
  },
  {
    value: "massinha_3d",
    label: "Massinha 3D",
    descricao: "Aparência de massinha/stop-motion, tridimensional e aconchegante.",
    prompt:
      "Personagem em estilo massinha/clay 3D fofo, textura de massa de modelar, iluminação suave, aparência de animação stop-motion",
  },
  {
    value: "boneco_brinquedo",
    label: "Bonequinho de brinquedo",
    descricao: "Tipo bonequinho de playset — plástico fofo e colorido.",
    prompt:
      "Personagem em estilo de boneco de brinquedo plástico de playset infantil, corpo simples e arredondado, acabamento de plástico fosco, fofo e colorido",
  },
  {
    value: "boneco_vinil",
    label: "Boneco de vinil",
    descricao: "Boneco colecionável de vinil — cabeçudo e estiloso.",
    prompt:
      "Personagem em estilo boneco de vinil colecionável, cabeça grande estilizada, olhos grandes, corpo pequeno, acabamento liso de vinil, fofo",
  },
  {
    value: "pelucia",
    label: "Pelúcia",
    descricao: "Boneco de pelúcia/feltro, macio e abraçável.",
    prompt:
      "Personagem em estilo boneco de pelúcia/feltro costurado, texturas macias de tecido com costuras visíveis, fofo e tátil",
  },
] as const;

export type AvatarEstilo = (typeof AVATAR_ESTILOS)[number]["value"];

export const AVATAR_ESTILO_VALUES = AVATAR_ESTILOS.map((e) => e.value) as [
  AvatarEstilo,
  ...AvatarEstilo[],
];

/**
 * Converte um valor de estilo (possivelmente legado, ex.: "cartoon") num estilo
 * válido da lista atual. Avatares antigos seguem exibindo a imagem já gerada;
 * isto só garante um default seguro pros formulários e prompts.
 */
export function coerceEstilo(v: unknown): AvatarEstilo {
  return (AVATAR_ESTILO_VALUES as readonly string[]).includes(v as string)
    ? (v as AvatarEstilo)
    : AVATAR_ESTILOS[0].value;
}

export type AvatarDescricao = {
  estilo: AvatarEstilo;
  idade?: number | null;
  generoVisual?: "menino" | "menina" | "neutro" | null;
  tomPele?: "muito_clara" | "clara" | "media" | "morena" | "negra_clara" | "negra" | null;
  cabeloCor?: string | null; // texto livre: "castanho escuro", "ruivo", etc
  cabeloComprimento?: "curto" | "medio" | "longo" | null;
  cabeloTextura?: "liso" | "ondulado" | "cacheado" | "crespo" | null;
  oculos?: boolean;
  tracosMarcantes?: string | null; // ex: "sardas no nariz, dentes da frente um pouco grandes"
  roupasFrequentes?: string | null; // ex: "camiseta de dinossauro e calça de moletom"
};

/**
 * Monta o prompt canônico (texto fixo que descreve o personagem).
 * Esse prompt vai como prefixo de toda imagem de cena pra manter o
 * personagem consistente entre gerações.
 */
export function montarPromptCanonico(d: AvatarDescricao): string {
  const partes: string[] = [];

  const estiloDef = AVATAR_ESTILOS.find((e) => e.value === d.estilo) ?? AVATAR_ESTILOS[0];
  partes.push(estiloDef.prompt);

  // Personagem
  const sujeitoBase: string[] = [];
  if (d.generoVisual === "menino") sujeitoBase.push("um menino");
  else if (d.generoVisual === "menina") sujeitoBase.push("uma menina");
  else sujeitoBase.push("uma criança");

  if (d.idade != null) sujeitoBase.push(`de ${d.idade} anos`);

  if (d.tomPele) {
    const pele: Record<NonNullable<AvatarDescricao["tomPele"]>, string> = {
      muito_clara: "pele muito clara",
      clara: "pele clara",
      media: "pele média",
      morena: "pele morena",
      negra_clara: "pele negra clara",
      negra: "pele negra",
    };
    sujeitoBase.push(`de ${pele[d.tomPele]}`);
  }

  // Cabelo
  if (d.cabeloCor || d.cabeloComprimento || d.cabeloTextura) {
    const cabelo: string[] = [];
    if (d.cabeloComprimento)
      cabelo.push(
        d.cabeloComprimento === "curto"
          ? "curto"
          : d.cabeloComprimento === "medio"
            ? "médio"
            : "longo",
      );
    if (d.cabeloTextura)
      cabelo.push(
        d.cabeloTextura === "liso"
          ? "liso"
          : d.cabeloTextura === "ondulado"
            ? "ondulado"
            : d.cabeloTextura === "cacheado"
              ? "cacheado"
              : "crespo",
      );
    if (d.cabeloCor) cabelo.push(d.cabeloCor);
    sujeitoBase.push(`cabelo ${cabelo.join(" ")}`);
  }

  if (d.oculos) sujeitoBase.push("usando óculos");
  if (d.tracosMarcantes) sujeitoBase.push(d.tracosMarcantes);
  if (d.roupasFrequentes) sujeitoBase.push(`vestindo ${d.roupasFrequentes}`);

  partes.push(sujeitoBase.join(", "));

  // Diretrizes finais — evita foto-realismo e mantém estilo
  partes.push(
    "expressão acolhedora, postura natural, fundo neutro claro, sem texto, sem letras, sem logotipos, ilustração 2D, NÃO fotorrealista",
  );

  return partes.join(". ");
}

/**
 * Combina prompt canônico do avatar com descrição da cena pra gerar
 * uma imagem específica (brincadeira, atividade, etc.).
 */
export function montarPromptCena(params: {
  promptCanonico: string;
  descricaoCena: string;
}): string {
  return `${params.promptCanonico}. Cena: ${params.descricaoCena}.`;
}
