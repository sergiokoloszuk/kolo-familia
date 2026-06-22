import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { differenceInCalendarDays } from "date-fns";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { Sidebar } from "./sidebar";
import { idadeAnos } from "@/lib/idade";
import { lerCriancaAtivaId, resolverCriancaAtiva } from "@/lib/crianca-ativa";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { user, supabase, family } = await loadFamilyContext();
  if (!family) redirect("/onboarding");
  if (!family.onboarding_completed) redirect("/onboarding");
  if (!family.boas_vindas_vista_at) redirect("/boas-vindas");

  const [
    { data: acesso },
    { data: familyMeta },
    { data: profile },
    { data: criancas },
    { count: sugestoesPendentes },
    { count: planosCount },
  ] = await Promise.all([
    supabase
      .from("controle_acessos")
      .select("ativo")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("family_accounts")
      .select("created_at")
      .eq("id", family.id)
      .maybeSingle(),
    supabase
      .from("family_profiles")
      .select("como_chamar, nome_mae")
      .eq("family_account_id", family.id)
      .maybeSingle(),
    supabase
      .from("membros_atipicos")
      .select("id, nome, data_nascimento")
      .eq("family_account_id", family.id)
      .eq("ativo", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("sugestao_perfil_vivos")
      .select("id", { count: "exact", head: true })
      .eq("family_account_id", family.id)
      .eq("status", "pendente"),
    supabase
      .from("planos")
      .select("id", { count: "exact", head: true })
      .eq("family_account_id", family.id),
  ]);

  const isAdmin = Boolean(acesso?.ativo);
  const nomeUsuario =
    profile?.como_chamar?.trim() ||
    profile?.nome_mae?.trim() ||
    user.email?.split("@")[0] ||
    "Você";
  const userInitial = (nomeUsuario[0] ?? "?").toUpperCase();
  const diasNaKolo = familyMeta?.created_at
    ? Math.max(
        0,
        differenceInCalendarDays(new Date(), new Date(familyMeta.created_at)),
      )
    : null;

  // Criança ativa: resolvida pelo cookie (de quem a mãe está falando), com
  // fallback na primeira. A sidebar troca; todas as telas seguem.
  const criancasList = (criancas ?? []).map((c) => ({
    id: c.id as string,
    nome: c.nome as string,
    idade: idadeAnos(c.data_nascimento as string | null),
  }));
  const criancaAtiva = resolverCriancaAtiva(criancasList, await lerCriancaAtivaId());

  return (
    <div className="min-h-screen bg-kolo-page lg:grid lg:grid-cols-[260px_1fr]">
      <Sidebar
        isAdmin={isAdmin}
        nomeUsuario={nomeUsuario}
        userInitial={userInitial}
        diasNaKolo={diasNaKolo}
        criancas={criancasList}
        criancaAtivaId={criancaAtiva?.id ?? null}
        sugestoesPendentes={sugestoesPendentes ?? 0}
        temPlanos={(planosCount ?? 0) > 0}
      />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8 lg:px-10">
        {children}
      </main>
    </div>
  );
}
