/**
 * Helper que monta o prompt canônico do avatar a partir dos campos
 * descritivos. Vários estilos ilustrados, nunca foto-realista (PRD §7.14).
 */

/**
 * Estilos disponíveis — fonte única (label pro form, prompt pra geração).
 * Ao adicionar um estilo aqui, lembrar de soltar o CHECK do banco
 * (migração avatares_membros_atipicos.estilo).
 */
export const AVATAR_ESTILOS = [
  {
    value: "cartoon",
    label: "Cartoon",
    prompt: "Ilustração estilo cartoon amigável, traços simples e cores suaves",
  },
  {
    value: "aquarela",
    label: "Aquarela",
    prompt: "Ilustração em estilo aquarela suave, traços leves, cores pastel",
  },
  {
    value: "livro_infantil",
    label: "Livro infantil",
    prompt: "Ilustração de livro infantil, lúdica e acolhedora, cores quentes",
  },
  {
    value: "lapis_cor",
    label: "Lápis de cor",
    prompt: "Ilustração feita com lápis de cor, textura de giz, traço artesanal",
  },
  {
    value: "massinha_3d",
    label: "Massinha 3D",
    prompt:
      "Personagem em estilo massinha/clay 3D fofo, iluminação suave, aparência de animação",
  },
  {
    value: "papel_recortado",
    label: "Papel recortado",
    prompt: "Ilustração em estilo colagem de papel recortado, formas chapadas",
  },
  {
    value: "line_art",
    label: "Traço (line art)",
    prompt: "Ilustração em line art colorido, contornos limpos, preenchimento leve",
  },
] as const;

export type AvatarEstilo = (typeof AVATAR_ESTILOS)[number]["value"];

export const AVATAR_ESTILO_VALUES = AVATAR_ESTILOS.map((e) => e.value) as [
  AvatarEstilo,
  ...AvatarEstilo[],
];

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
