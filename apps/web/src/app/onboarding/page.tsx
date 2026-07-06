import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { parseDiagnosticosFormais } from "@/lib/onboarding/diagnostico";
import { lerModo } from "@/lib/onboarding/modo";
import { carregarCopy } from "@/lib/onboarding/copy-store";
import { familiasInternas } from "@/lib/analytics/internos";
import { OnboardingWizard, type InitialState, type Membro } from "./wizard";
import { OnboardingConversacional } from "./conversacional";

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
    redirect(family.boas_vindas_vista_at ? "/painel" : "/boas-vindas");
  }

  // Chave de troca (Fatia 3): fluxo NOVO conversacional vs wizard antigo.
  // "todos" = todos; "teste" = contas internas OU quem tem o cookie kolo_onb=novo
  // (pra testar num cadastro novo sem expor os leads); "antigo" = o wizard.
  const admin = createServiceRoleClient();
  const modo = await lerModo(admin);
  let usarNovo = modo === "todos";
  if (modo === "teste") {
    const internas = await familiasInternas(admin);
    const cookieNovo = (await cookies()).get("kolo_onb")?.value === "novo";
    usarNovo = internas.has(family.id) || cookieNovo;
  }
  if (usarNovo) {
    const copy = await carregarCopy(admin, { publicado: true });
    return (
      <div className="flex flex-col gap-4">
        <OnboardingConversacional copy={copy} />
      </div>
    );
  }

  // Carrega membros já cadastrados (caso esteja retomando onboarding).
  const { data: membrosRaw } = await supabase
    .from("membros_atipicos")
    .select("id, nome, data_nascimento, perfil, genero, diagnosticos_formais")
    .eq("family_account_id", family.id)
    .order("created_at", { ascending: true });

  const membros: Membro[] = (membrosRaw ?? []).map((m) => {
    const row = m as {
      id: string;
      nome: string;
      data_nascimento: string;
      perfil: string;
      genero: "masculino" | "feminino" | "neutro" | null;
      diagnosticos_formais: unknown;
    };
    const sel = parseDiagnosticosFormais(row.diagnosticos_formais, row.perfil);
    return {
      id: row.id,
      nome: row.nome,
      data_nascimento: row.data_nascimento,
      perfil: row.perfil,
      genero: row.genero,
      diagnosticos: sel.diagnosticos,
      diagnostico_outro: sel.outro,
      hipoteses: sel.hipoteses,
    };
  });

  const { data: profile } = await supabase
    .from("family_profiles")
    .select("nome_mae, data_nascimento_mae, como_chamar, papel, papel_outro, genero_responsavel")
    .eq("family_account_id", family.id)
    .maybeSingle();

  const { data: perfilFamilia } = await supabase
    .from("perfil_vivo_familia")
    .select("composicao, rotina, recursos, dinamica")
    .eq("family_account_id", family.id)
    .maybeSingle();

  const { data: acessoAdmin } = await supabase
    .from("controle_acessos")
    .select("ativo")
    .eq("user_id", user.id)
    .maybeSingle();
  const isAdmin = Boolean(acessoAdmin?.ativo);

  const initialState: InitialState = {
    familyId: family.id,
    userEmail: user.email ?? "",
    currentStep: family.onboarding_step,
    profile: profile ?? null,
    whatsapp: family.whatsapp_e164,
    membros,
    perfilFamilia: perfilFamilia ?? null,
  };

  return (
    <div className="flex flex-col gap-4">
      {isAdmin && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-kolo-linha bg-secondary/50 px-4 py-3 text-sm">
          <span className="text-muted-foreground">
            Você tem acesso de administrador — não precisa preencher o onboarding.
          </span>
          <Link
            href="/admin"
            className="font-semibold text-brand-purple underline-offset-4 hover:underline"
          >
            Ir para o painel admin →
          </Link>
        </div>
      )}
      <OnboardingWizard initial={initialState} />
    </div>
  );
}
