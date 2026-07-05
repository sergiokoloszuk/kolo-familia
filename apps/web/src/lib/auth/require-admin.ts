import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Garante que o usuário tem role admin (qualquer um dos 3 níveis).
 * Caso contrário, redireciona para /admin/setup que inicializa o
 * primeiro admin OU mostra "acesso negado" se já existe outro admin.
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: acesso } = await supabase
    .from("controle_acessos")
    .select("role, ativo")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!acesso || !acesso.ativo) {
    redirect("/admin/setup");
  }

  return { user, supabase, role: acesso.role as string };
}

/**
 * Igual ao requireAdmin, mas só devolve boolean — NÃO redireciona. Pra gatear
 * conteúdo em telas mistas (admin + agência co-acesso), tipo o drill-down do
 * dashboard: admin vê a ficha completa; agência vê só os sinais.
 */
export async function ehAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: acesso } = await supabase
    .from("controle_acessos")
    .select("ativo")
    .eq("user_id", user.id)
    .maybeSingle();
  return !!acesso?.ativo;
}
