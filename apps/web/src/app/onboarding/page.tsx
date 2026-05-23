import { redirect } from "next/navigation";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { OnboardingWizard, type InitialState } from "./wizard";

export default async function OnboardingPage() {
  const { user, supabase, family } = await loadFamilyContext();

  // Sem family_account ainda — pode acontecer se o trigger ainda não rodou.
  // Mostra mensagem orientando o usuário a recarregar (ou o trigger ainda não
  // foi aplicado ao banco).
  if (!family) {
    return (
      <div className="rounded-md border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-900">
        Sua família ainda não foi inicializada. Isso costuma resolver em alguns
        segundos — recarregue a página. Se persistir, o trigger
        <code className="mx-1 rounded bg-amber-100 px-1">handle_new_user</code>
        precisa estar aplicado ao banco (migração 0004).
      </div>
    );
  }

  if (family.onboarding_completed) {
    redirect("/painel");
  }

  // Carrega membros já cadastrados (caso esteja retomando onboarding).
  const { data: membros } = await supabase
    .from("membros_atipicos")
    .select("id, nome, data_nascimento, perfil")
    .eq("family_account_id", family.id)
    .order("created_at", { ascending: true });

  const { data: profile } = await supabase
    .from("family_profiles")
    .select("nome_mae, data_nascimento_mae, como_chamar, papel")
    .eq("family_account_id", family.id)
    .maybeSingle();

  const { data: perfilFamilia } = await supabase
    .from("perfil_vivo_familia")
    .select("composicao, rotina, recursos, dinamica")
    .eq("family_account_id", family.id)
    .maybeSingle();

  const initialState: InitialState = {
    familyId: family.id,
    userEmail: user.email ?? "",
    currentStep: family.onboarding_step,
    profile: profile ?? null,
    whatsapp: family.whatsapp_e164,
    membros: membros ?? [],
    perfilFamilia: perfilFamilia ?? null,
  };

  return <OnboardingWizard initial={initialState} />;
}
