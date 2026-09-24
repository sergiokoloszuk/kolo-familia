export const RAMOS_APROFUNDAMENTO = [
  "aprofundar_lidar",
  "aprofundar_brincar",
  "aprofundar_crencas",
] as const;

export type RamoAprofundamento = (typeof RAMOS_APROFUNDAMENTO)[number];

/** Flag única: desligada por padrão; quando ligada vale para todas as famílias. */
export function aprofundamentoGlobalLigado(): boolean {
  return process.env.AYLA_APROFUNDAMENTO_WHATSAPP === "on";
}
