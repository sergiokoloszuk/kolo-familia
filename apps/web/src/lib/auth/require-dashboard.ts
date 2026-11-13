import { cache } from "react";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Acesso aos Dashboards: admin OU co-acesso ativo da equipe de tráfego
 * (`family_acessos`, gerenciado só pelo admin).
 *
 * ⚠️ POR QUE A GUARDA FICA EM CADA PÁGINA, E NÃO SÓ NO LAYOUT — 12/11/2026.
 * Layout e página renderizam EM PARALELO no App Router. O `redirect` do layout
 * não impede a página de rodar: as consultas com service-role já tinham ido ao
 * banco e o HTML saía junto com o marcador de redirecionamento. Medido em
 * produção, sem login: `/dashboards/crm` entregava 89 e-mails e
 * `/dashboards/crm/ayla`, 58. Toda página daqui chama esta função ANTES de
 * qualquer consulta; o layout chama também, e o `cache` evita consultar duas
 * vezes no mesmo request.
 *
 * Falha fechada: erro em qualquer consulta equivale a "sem acesso".
 */
export const requireDashboard = cache(async () => {
  const { user, supabase } = await requireUser();

  // Co-acesso casa por user_id OU e-mail (o admin pode ter cadastrado o e-mail
  // antes de a pessoa criar a conta). Service-role pra enxergar a linha com
  // user_id nulo.
  const admin = createServiceRoleClient();
  const emailLower = user.email?.toLowerCase() ?? null;
  const orCoAcesso = emailLower
    ? `user_id.eq.${user.id},email.eq.${emailLower}`
    : `user_id.eq.${user.id}`;

  const [{ data: acesso, error: acessoError }, { data: coAcesso, error: coAcessoError }] =
    await Promise.all([
      supabase.from("controle_acessos").select("ativo").eq("user_id", user.id).maybeSingle(),
      admin.from("family_acessos").select("id").eq("ativo", true).or(orCoAcesso).limit(1),
    ]);
  const isAdmin = !acessoError && Boolean(acesso?.ativo);
  const isAnalista = !coAcessoError && (coAcesso?.length ?? 0) > 0;
  if (!isAdmin && !isAnalista) redirect("/painel");

  return { user, supabase, isAdmin };
});
