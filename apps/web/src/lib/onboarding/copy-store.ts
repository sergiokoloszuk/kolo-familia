import type { SupabaseClient } from "@supabase/supabase-js";
import { ONBOARDING_COPY_DEFAULT, type OnboardingCopy } from "./copy-default";
import { parseCopy } from "./copy-schema";

/**
 * Persistência da copy do onboarding — uma linha só (id='atual') com rascunho e
 * publicado (jsonb). Degrada com graça: se a tabela/linha ainda não existe (ou o
 * conteúdo é inválido), devolve o DEFAULT do código. Assim o app nunca quebra
 * antes da migração 0059 ser aplicada.
 *
 * Acesso via service-role (as server actions gateiam por admin antes de chamar).
 */

const ID = "atual";

export async function carregarCopy(
  admin: SupabaseClient,
  opts?: { publicado?: boolean },
): Promise<OnboardingCopy> {
  try {
    const { data } = await admin
      .from("onboarding_copy")
      .select("rascunho, publicado")
      .eq("id", ID)
      .maybeSingle();
    const raw = opts?.publicado ? data?.publicado : data?.rascunho;
    return parseCopy(raw) ?? ONBOARDING_COPY_DEFAULT;
  } catch {
    return ONBOARDING_COPY_DEFAULT;
  }
}

/** Salva o rascunho. Retorna false se não conseguiu persistir (ex.: sem tabela). */
export async function salvarRascunho(admin: SupabaseClient, copy: OnboardingCopy): Promise<boolean> {
  try {
    const { error } = await admin
      .from("onboarding_copy")
      .upsert({ id: ID, rascunho: copy, updated_at: new Date().toISOString() }, { onConflict: "id" });
    return !error;
  } catch {
    return false;
  }
}

/** Publica: copia o rascunho atual pra `publicado`. */
export async function publicarCopy(admin: SupabaseClient): Promise<boolean> {
  try {
    const rascunho = await carregarCopy(admin); // rascunho atual (ou default)
    const { error } = await admin
      .from("onboarding_copy")
      .upsert(
        { id: ID, rascunho, publicado: rascunho, updated_at: new Date().toISOString() },
        { onConflict: "id" },
      );
    return !error;
  } catch {
    return false;
  }
}

/** Restaura o rascunho pro DEFAULT do código. */
export async function resetarRascunho(admin: SupabaseClient): Promise<OnboardingCopy> {
  await salvarRascunho(admin, ONBOARDING_COPY_DEFAULT);
  return ONBOARDING_COPY_DEFAULT;
}
