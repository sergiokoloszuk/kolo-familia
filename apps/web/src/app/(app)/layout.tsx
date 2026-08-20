import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { differenceInCalendarDays } from "date-fns";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { assinaturaLiberada, pagamentoEmFalha, diasAteExclusao, acessoEncerradoSemPagar, testeJaUsadoAntes } from "@/lib/auth/assinatura";
import { economiaAnual, formatarBRL, lerPlanosParaExibir } from "@/lib/billing/planos";
import { Sidebar } from "./sidebar";
import { TrialGate } from "./trial-gate";
import { PagamentoGate } from "./pagamento-gate";
import { PageViewTracker } from "./page-view-tracker";
import { idadeAnos } from "@/lib/idade";
import { lerCriancaAtivaId, resolverCriancaAtiva } from "@/lib/crianca-ativa";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { user, supabase, family } = await loadFamilyContext();
  if (!family) redirect("/onboarding");
  if (!family.onboarding_completed) redirect("/onboarding");
  if (!family.boas_vindas_vista_at) redirect("/boas-vindas");

  // Co-acesso (analista de tráfego) casa por user_id OU e-mail: o admin pode
  // ter cadastrado o e-mail ANTES de a pessoa criar a conta (aí user_id ficou
  // nulo) — casar por e-mail garante o acesso assim que ela loga, sem re-adição.
  // Service-role porque a linha com user_id nulo não é "dela" pela RLS.
  const admin = createServiceRoleClient();
  const emailLower = user.email?.toLowerCase() ?? null;
  const orCoAcesso = emailLower
    ? `user_id.eq.${user.id},email.eq.${emailLower}`
    : `user_id.eq.${user.id}`;

  const [
    { data: acesso },
    { data: coAcesso },
    { data: familyMeta },
    { data: profile },
    { data: criancas },
    { count: sugestoesPendentes },
    { count: planosCount },
    { data: sub },
  ] = await Promise.all([
    supabase
      .from("controle_acessos")
      .select("ativo")
      .eq("user_id", user.id)
      .maybeSingle(),
    admin
      .from("family_acessos")
      .select("id")
      .eq("ativo", true)
      .or(orCoAcesso)
      .limit(1),
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
    supabase
      .from("subscription_accesses")
      .select("status, trial_ends_at, cortesia, cortesia_ate, pagamento_falhou_em, created_at")
      .eq("family_account_id", family.id)
      .maybeSingle(),
  ]);

  const isAdmin = Boolean(acesso?.ativo);
  const isAnalista = (coAcesso?.length ?? 0) > 0;

  // Bloqueio de acesso: trial vencido / assinatura inativa (e não é admin,
  // analista de tráfego ou cortesia) → tela "assine pra continuar". Sem isso,
  // o status ficava "trialing" pra sempre e o acesso vazava de graça.
  if (!isAdmin && !isAnalista && !assinaturaLiberada(sub)) {
    if (pagamentoEmFalha(sub)) {
      return <PagamentoGate diasRestantes={diasAteExclusao(sub)} />;
    }
    // Preço pelo leitor único (lib/billing/planos.ts) — quem está bloqueada
    // não alcança /assinatura, então o valor tem que aparecer aqui. É o mesmo
    // número que o checkout vai cobrar, porque a fonte é o Stripe.
    const planos = await lerPlanosParaExibir(createServiceRoleClient());
    const mensalCent = planos.mensal.centavos;
    const anualCent = planos.anual.centavos;
    const economiaCalculada = economiaAnual(mensalCent, anualCent);
    const economia = economiaCalculada ? formatarBRL(economiaCalculada.centavos) : null;
    return (
      <TrialGate
        vencido={acessoEncerradoSemPagar(sub)}
        jaUsouAntes={testeJaUsadoAntes(sub)}
        precoMensal={formatarBRL(mensalCent)}
        precoAnual={formatarBRL(anualCent)}
        economiaAnual={economia}
      />
    );
  }
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
      <PageViewTracker />
      <Sidebar
        isAdmin={isAdmin}
        isAnalista={isAnalista}
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
