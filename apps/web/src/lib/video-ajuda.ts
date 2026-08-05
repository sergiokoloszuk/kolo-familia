/**
 * OS VÍDEOS DE AJUDA POR ÁREA — configuração central.
 *
 * Cada área do app pode ter um vídeo curto ensinando a usar AQUELA coisa. Não
 * é o guia institucional (esse mora em `components/video-guia.tsx` e fala da
 * plataforma inteira); aqui é "como se cria uma rotina visual", "como se
 * completa o perfil".
 *
 * ⚠️ URL null = a área não renderiza NADA. Sem card, sem espaço vazio, sem
 * "em breve". Ligar um vídeo amanhã é trocar o null pela URL desta tabela —
 * nenhum componente precisa ser tocado.
 *
 * As URLs ficam aqui, e não espalhadas nos componentes, porque senão ligar dez
 * vídeos vira dez edições em dez arquivos, cada uma com sua chance de erro.
 */

export type AreaAjuda =
  | "registro_diario"
  | "perfil"
  | "estrategias"
  | "meus_planos"
  | "evolucao"
  | "ludico"
  | "avatar"
  | "historias"
  | "rotina_visual"
  | "desenho";

type VideoAjuda = {
  /** O convite que aparece na tela. Curto — é ajuda, não conteúdo. */
  chamada: string;
  /** Embed do Tella. `null` enquanto o vídeo não existe. */
  url: string | null;
};

export const VIDEOS_AJUDA: Record<AreaAjuda, VideoAjuda> = {
  registro_diario: { chamada: "Veja como usar o Registro Diário", url: null },
  perfil: { chamada: "Veja como completar o perfil da criança", url: null },
  estrategias: { chamada: "Veja como conversar nas Estratégias", url: null },
  meus_planos: { chamada: "Veja como usar os planos", url: null },
  evolucao: { chamada: "Veja como acompanhar a evolução", url: null },
  ludico: { chamada: "Veja o que dá pra fazer no Lúdico", url: null },
  avatar: { chamada: "Veja como criar o personagem da criança", url: null },
  historias: { chamada: "Veja como criar uma história", url: null },
  rotina_visual: { chamada: "Veja como criar uma rotina visual", url: null },
  desenho: { chamada: "Veja como funciona a leitura do desenho", url: null },
};

/** O vídeo desta área, ou null quando ainda não existe. */
export function videoDaArea(area: AreaAjuda): VideoAjuda | null {
  const v = VIDEOS_AJUDA[area];
  return v?.url ? v : null;
}
