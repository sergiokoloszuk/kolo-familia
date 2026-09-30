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
    label: "3D encantado",
    descricao: "Expressivo, acolhedor e com luz de cinema.",
    visual: "✨",
    previewPosition: "0% 0%",
    prompt:
      "Personagem original em animação 3D estilizada, renderização volumétrica suave, olhos expressivos, proporções amigáveis e iluminação cinematográfica macia",
  },
  {
    value: "gamer_3d",
    label: "Gamer 3D",
    descricao: "Moderno, vibrante e ótimo para jovens que curtem games.",
    visual: "🎮",
    previewPosition: "33.333% 0%",
    prompt:
      "Personagem original em estilo gamer 3D, design moderno e expressivo, iluminação neon suave em roxo e azul, acabamento de render 3D de alta qualidade, sem copiar jogos ou personagens existentes",
  },
  {
    value: "anime_3d",
    label: "Anime 3D",
    descricao: "Olhar marcante, atitude e acabamento tridimensional.",
    visual: "⚡",
    previewPosition: "66.666% 0%",
    prompt:
      "Personagem original com linguagem visual inspirada em anime contemporâneo e acabamento 3D, olhar expressivo, formas elegantes, iluminação dinâmica, sem copiar franquias ou personagens existentes",
  },
  {
    value: "fantasia_3d",
    label: "Fantasia 3D",
    descricao: "Aventura, magia e detalhes de um mundo imaginário.",
    visual: "🐉",
    previewPosition: "100% 0%",
    prompt:
      "Personagem original de fantasia em render 3D estilizado, atmosfera de aventura e magia, detalhes encantadores e iluminação volumétrica, sem copiar franquias ou personagens existentes",
  },
  {
    value: "ficcao_3d",
    label: "Ficção científica 3D",
    descricao: "Tecnologia, espaço e um visual mais jovem.",
    visual: "🚀",
    previewPosition: "0% 100%",
    prompt:
      "Personagem original de ficção científica em render 3D estilizado, tecnologia amigável, detalhes futuristas e iluminação espacial, sem logotipos e sem copiar franquias existentes",
  },
  {
    value: "massinha_3d",
    label: "Massinha 3D",
    descricao: "Aparência de massinha/stop-motion, tridimensional e aconchegante.",
    visual: "🧩",
    previewPosition: "33.333% 100%",
    prompt:
      "Personagem em estilo massinha/clay 3D fofo, textura de massa de modelar, iluminação suave, aparência de animação stop-motion",
  },
  {
    value: "boneco_brinquedo",
    label: "Brinquedo 3D",
    descricao: "Colorido, tátil e com cara de coleção.",
    visual: "🪀",
    previewPosition: "66.666% 100%",
    prompt:
      "Personagem original em estilo de brinquedo 3D colecionável, corpo simples e arredondado, acabamento de plástico fosco, colorido e expressivo",
  },
  {
    value: "boneco_vinil",
    label: "Boneco de vinil",
    descricao: "Boneco colecionável de vinil — cabeçudo e estiloso.",
    visual: "🕶️",
    previewPosition: "66.666% 100%",
    prompt:
      "Personagem em estilo boneco de vinil colecionável, cabeça grande estilizada, olhos grandes, corpo pequeno, acabamento liso de vinil, fofo",
  },
  {
    value: "pelucia",
    label: "Pelúcia",
    descricao: "Boneco de pelúcia/feltro, macio e abraçável.",
    visual: "🧸",
    previewPosition: "100% 100%",
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
  const idade = d.idade;
  if (d.generoVisual === "menino") {
    sujeitoBase.push(idade == null || idade < 13 ? "um menino" : idade < 18 ? "um adolescente" : "um adulto");
  } else if (d.generoVisual === "menina") {
    sujeitoBase.push(idade == null || idade < 13 ? "uma menina" : idade < 18 ? "uma adolescente" : "uma adulta");
  } else {
    sujeitoBase.push(idade == null ? "uma pessoa" : idade < 13 ? "uma criança" : idade < 18 ? "uma pessoa adolescente" : "uma pessoa adulta");
  }

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
    "expressão acolhedora, postura natural, corpo inteiro, fundo neutro claro, sem texto, sem letras, sem logotipos, acabamento tridimensional coerente com o estilo escolhido, NÃO fotorrealista",
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
