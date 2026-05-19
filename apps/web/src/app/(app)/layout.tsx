import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { differenceInCalendarDays } from "date-fns";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { Sidebar } from "./sidebar";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { user, supabase, family } = await loadFamilyContext();
  if (!family) redirect("/onboarding");
  if (!family.onboarding_completed) redirect("/onboarding");

  const [{ data: acesso }, { data: familyMeta }, { data: profile }, { data: criancas }] =
    await Promise.all([
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
        .select("id, nome, idade")
        .eq("family_account_id", family.id)
        .eq("ativo", true)
        .order("created_at", { ascending: true }),
    ]);

  const isAdmin = Boolean(acesso?.ativo);
  const userEmail = user.email ?? "Sem email";
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

  // V1: primeira criança ativa = "criança ativa do sidebar"
  // (multi-criança não é v1 — Adendo PRD).
  const criancaAtiva = criancas?.[0]
    ? {
        id: criancas[0].id,
        nome: criancas[0].nome,
        idade: criancas[0].idade as number | null,
      }
    : null;

  return (
    <div className="min-h-screen bg-kolo-page lg:grid lg:grid-cols-[260px_1fr]">
      <Sidebar
        isAdmin={isAdmin}
        nomeUsuario={nomeUsuario}
        userEmail={userEmail}
        userInitial={userInitial}
        diasNaKolo={diasNaKolo}
        criancaAtiva={criancaAtiva}
      />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8 lg:px-10">
        {children}
      </main>
    </div>
  );
}
