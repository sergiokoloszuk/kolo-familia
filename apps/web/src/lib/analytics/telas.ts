/**
 * Mapeia um pathname → rótulo de TELA legível pro dashboard de comportamento.
 * Agrupa rotas relacionadas (ex.: /conversar e /estrategias → "estrategias";
 * /historias e /ludico → "ludico"). Rota desconhecida cai no 1º segmento.
 */
const MAP: Record<string, string> = {
  painel: "home",
  "kolo-vivo": "perfil",
  estrategias: "estrategias",
  conversar: "estrategias",
  planos: "planos",
  evolucao: "evolucao",
  ludico: "ludico",
  historias: "ludico",
  galeria: "galeria",
  registrar: "registro",
  aprender: "aprender",
  apoio: "apoio",
  assinatura: "assinatura",
  configuracoes: "configuracoes",
  ajuda: "ajuda",
};

export function telaDeRota(path: string): string {
  if (path === "/" || path === "/painel") return "home";
  const seg = path.split("/").filter(Boolean)[0] ?? "home";
  return MAP[seg] ?? seg;
}
