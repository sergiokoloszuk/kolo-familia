import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { Sidebar } from "./sidebar";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { user, supabase, family } = await loadFamilyContext();
  if (!family) redirect("/onboarding");
  if (!family.onboarding_completed) redirect("/onboarding");

  const { data: acesso } = await supabase
    .from("controle_acessos")
    .select("ativo")
    .eq("user_id", user.id)
    .maybeSingle();
  const isAdmin = Boolean(acesso?.ativo);

  const userEmail = user.email ?? "Sem email";
  const userInitial = (user.email?.[0] ?? "?").toUpperCase();

  return (
    <div className="min-h-screen bg-kolo-page lg:grid lg:grid-cols-[260px_1fr]">
      <Sidebar
        isAdmin={isAdmin}
        userEmail={userEmail}
        userInitial={userInitial}
      />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8 lg:px-10">
        {children}
      </main>
    </div>
  );
}
