import { redirect } from "next/navigation";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { BoasVindasForm } from "./form";

export const metadata = { title: "Boas-vindas — Kolo Família" };

/**
 * Tela de boas-vindas (Sprint A). Aparece UMA vez, depois do onboarding,
 * antes de cair no painel. Pergunta a janela de WhatsApp e apresenta as
 * 2 portas (resposta agora / completar Kolo Vivo).
 *
 * Redireciona se:
 *  - não tem family → /onboarding
 *  - não terminou onboarding → /onboarding
 *  - já viu boas-vindas → /painel
 */
export default async function BoasVindasPage() {
  const { supabase, family } = await loadFamilyContext();
  if (!family) redirect("/onboarding");
  if (!family.onboarding_completed) redirect("/onboarding");
  if (family.boas_vindas_vista_at) redirect("/painel");

  const { data: profile } = await supabase
    .from("family_profiles")
    .select("como_chamar, nome_mae")
    .eq("family_account_id", family.id)
    .maybeSingle();

  const nome =
    profile?.como_chamar?.trim() ||
    profile?.nome_mae?.trim()?.split(" ")[0] ||
    "";

  const { data: criancas } = await supabase
    .from("membros_atipicos")
    .select("id, nome")
    .eq("family_account_id", family.id)
    .eq("ativo", true)
    .order("created_at", { ascending: true });

  const primeiraCrianca = criancas?.[0]
    ? { id: criancas[0].id as string, nome: criancas[0].nome as string }
    : null;

  return (
    <BoasVindasForm
      nome={nome}
      primeiraCrianca={primeiraCrianca}
    />
  );
}
