import { redirect } from "next/navigation";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { Eyebrow } from "@/components/brand/eyebrow";
import { DashboardTabs } from "./tabs";

/**
 * Dashboards compartilhados com a equipe de tráfego (co-acesso) — e espelhados
 * no admin. Acesso: admin OU quem está em family_acessos (co-acesso, gerenciado
 * só pelo admin). Tudo agregado e ANÔNIMO — sem nome nem conteúdo de criança.
 * Dois recortes: Aquisição (funil) e Comportamento (uso).
 */
export const dynamic = "force-dynamic";

export default async function DashboardsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, supabase } = await loadFamilyContext();

  // Co-acesso casa por user_id OU e-mail (o admin pode ter cadastrado o e-mail
  // antes de a pessoa criar a conta). Service-role pra enxergar a linha com
  // user_id nulo.
  const admin = createServiceRoleClient();
  const emailLower = user.email?.toLowerCase() ?? null;
  const orCoAcesso = emailLower
    ? `user_id.eq.${user.id},email.eq.${emailLower}`
    : `user_id.eq.${user.id}`;

  const [{ data: acesso }, { data: coAcesso }] = await Promise.all([
    supabase.from("controle_acessos").select("ativo").eq("user_id", user.id).maybeSingle(),
    admin.from("family_acessos").select("id").eq("ativo", true).or(orCoAcesso).limit(1),
  ]);
  const isAdmin = Boolean(acesso?.ativo);
  const isAnalista = (coAcesso?.length ?? 0) > 0;
  if (!isAdmin && !isAnalista) redirect("/painel");

  return (
    <div className="flex flex-col gap-8">
      <header>
        <Eyebrow>Equipe de tráfego</Eyebrow>
        <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">Dashboards</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Visão agregada e anônima — sem nome ou conteúdo de criança. Telas e features enchem
          com o uso; o resto é histórico (90 dias).
        </p>
      </header>

      <DashboardTabs />

      {children}
    </div>
  );
}
