import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Garante que tem usuário logado. Caso contrário, redireciona para /login.
 * Retorna o user + cliente Supabase já configurado.
 */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { user, supabase };
}

/**
 * Carrega o contexto da família do usuário logado.
 * Roteamento entre onboarding/painel se baseia neste retorno.
 */
export async function loadFamilyContext() {
  const { user, supabase } = await requireUser();

  // Resolve a família via a MESMA função do RLS (current_family_account_id):
  // dono → própria família; co-acesso ativo → a família vinculada. Assim quem
  // tem co-acesso vê o conteúdo da conta certa (e pula o onboarding dela).
  const { data: famId } = await supabase.rpc("current_family_account_id");

  const { data: family } = famId
    ? await supabase
        .from("family_accounts")
        .select(
          "id, onboarding_step, onboarding_completed, whatsapp_e164, timezone, boas_vindas_vista_at, painel_balao_visto_at",
        )
        .eq("id", famId as string)
        .maybeSingle()
    : { data: null };

  return { user, supabase, family };
}
