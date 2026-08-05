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

  /**
   * A DURAÇÃO REAL DO PERÍODO — nunca "7 dias" no braço. Quem tem cortesia de
   * 30 dias não pode ler que ganhou 7, e a fonte é a mesma que o banner da Home
   * usa: `subscription_accesses.trial_ends_at`.
   */
  const { data: sub } = await supabase
    .from("subscription_accesses")
    .select("status, trial_ends_at, created_at, cortesia")
    .eq("family_account_id", family.id)
    .maybeSingle();
  const periodo = (() => {
    const fim = sub?.trial_ends_at ? new Date(sub.trial_ends_at as string) : null;
    if (!fim || sub?.status === "active") return null;
    const dias = Math.max(1, Math.round((fim.getTime() - Date.now()) / 86400000));
    return { dias, cortesia: sub?.cortesia === true };
  })();

  const primeiraCrianca = criancas?.[0]
    ? { id: criancas[0].id as string, nome: criancas[0].nome as string }
    : null;

  return (
    <BoasVindasForm
      nome={nome}
      primeiraCrianca={primeiraCrianca}
      periodo={periodo}
    />
  );
}
