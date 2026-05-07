import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { differenceInCalendarDays } from "date-fns";

export default async function PainelPage() {
  const { user, supabase, family } = await loadFamilyContext();

  if (!family) redirect("/onboarding");
  if (!family.onboarding_completed) redirect("/onboarding");

  const [{ data: membros }, { data: subscription }, { data: profile }] = await Promise.all([
    supabase
      .from("membros_atipicos")
      .select("id, nome, idade, perfil")
      .eq("family_account_id", family.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("subscription_accesses")
      .select("status, trial_ends_at")
      .eq("family_account_id", family.id)
      .single(),
    supabase
      .from("family_profiles")
      .select("nome_mae, como_chamar")
      .eq("family_account_id", family.id)
      .maybeSingle(),
  ]);

  const greeting = profile?.como_chamar?.trim() || profile?.nome_mae?.trim() || user.email;
  const trialDaysLeft =
    subscription?.status === "trialing" && subscription.trial_ends_at
      ? Math.max(0, differenceInCalendarDays(new Date(subscription.trial_ends_at), new Date()))
      : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Oi, {greeting}.</h1>
          <p className="text-sm text-muted-foreground">
            Painel completo entra nas próximas fases. Por enquanto, sua conta está ativa.
          </p>
        </div>
        <form action="/auth/logout" method="post">
          <Button type="submit" variant="outline" size="sm">
            Sair
          </Button>
        </form>
      </header>

      {trialDaysLeft !== null && (
        <Card>
          <CardHeader>
            <CardTitle>Trial</CardTitle>
            <CardDescription>
              {trialDaysLeft > 0
                ? `Faltam ${trialDaysLeft} dia${trialDaysLeft === 1 ? "" : "s"} dos seus 30 dias grátis.`
                : "Seu trial termina hoje."}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Membro(s) atípico(s) cadastrado(s)</CardTitle>
          <CardDescription>Quem está no centro do contexto da sua família.</CardDescription>
        </CardHeader>
        <CardContent>
          {membros && membros.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {membros.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <span className="font-medium">{m.nome}</span>
                  <span className="text-muted-foreground">
                    {m.idade} anos · {m.perfil}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum membro cadastrado. Algo deu errado no onboarding —{" "}
              <a className="underline" href="/onboarding">
                voltar para completar
              </a>
              .
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>O que vem agora</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <ul className="ml-5 list-disc space-y-1">
            <li>Em até 4 horas a Ayla manda sua primeira mensagem no WhatsApp.</li>
            <li>O Kolo Vivo (página dedicada) chega na próxima fase do roadmap.</li>
            <li>As skills (perguntar dúvidas) também ficam pra próxima fase.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
