import type { SupabaseClient } from "@supabase/supabase-js";
import { lerConfig } from "@/lib/config/geral";
import type { EstadoBlackFriday } from "./black-friday-2026";

export const CHAVE_ESTADO_BLACK_FRIDAY = "black_friday_2026_estado";
export const CHAVE_PROVA_BACKUP_BLACK_FRIDAY = "black_friday_2026_backup_prova";

const ESTADOS = new Set<EstadoBlackFriday>([
  "desligada", "ativa", "pausada", "encerrada",
]);

/** Falha fechada: tabela/chave/valor inesperado equivalem a campanha desligada. */
export async function lerEstadoBlackFriday(
  supabase: SupabaseClient,
): Promise<EstadoBlackFriday> {
  const valor = await lerConfig(supabase, CHAVE_ESTADO_BLACK_FRIDAY);
  return valor && ESTADOS.has(valor as EstadoBlackFriday)
    ? valor as EstadoBlackFriday
    : "desligada";
}

export async function lerProvaBackupBlackFriday(
  supabase: SupabaseClient,
): Promise<string | null> {
  return lerConfig(supabase, CHAVE_PROVA_BACKUP_BLACK_FRIDAY);
}
