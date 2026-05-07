"use server";

import { redirect } from "next/navigation";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Bootstrap do primeiro admin.
 *
 * Regras (defesa em profundidade — UI também checa):
 *   - precisa estar autenticado
 *   - não pode existir nenhum admin ativo ainda (race-safe via service role)
 *
 * Usa service role para bypassar RLS em controle_acessos. É o único lugar
 * onde isso é necessário.
 */
export async function bootstrapAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const admin = createServiceRoleClient();

  const { data: existing } = await admin
    .from("controle_acessos")
    .select("user_id")
    .eq("ativo", true)
    .limit(1);

  if ((existing?.length ?? 0) > 0) {
    throw new Error("Já existe um admin ativo. Bootstrap bloqueado.");
  }

  const { error } = await admin.from("controle_acessos").insert({
    user_id: user.id,
    role: "admin_geral",
    ativo: true,
  });
  if (error) throw new Error(`Falha ao criar admin: ${error.message}`);

  redirect("/admin");
}
