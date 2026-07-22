import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { TesteClient } from "./teste-client";

export default async function AdminTestePage() {
  const { user } = await requireAdmin();
  const admin = createServiceRoleClient();

  const { data: fam } = await admin
    .from("family_accounts")
    .select("id, nome_familia, whatsapp_e164, onboarding_step, onboarding_completed")
    .eq("user_id", user.id)
    .maybeSingle();

  const membrosCount = fam
    ? (
        await admin
          .from("membros_atipicos")
          .select("id", { count: "exact", head: true })
          .eq("family_account_id", fam.id)
      ).count ?? 0
    : 0;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Testes (QA)</h1>
        <p className="text-sm text-muted-foreground">
          Ferramentas pra testar o fluxo da família: zerar a conta e refazer o
          onboarding, ou preencher com dados de exemplo pra ver como o app fica
          cheio. As ações escrevem direto no banco de <strong>produção</strong> —
          são escopadas por conta, não existe &ldquo;apagar todo mundo&rdquo;.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sua conta agora</CardTitle>
          <CardDescription>{user.email}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2 text-sm">
          {fam ? (
            <>
              <Badge variant={fam.onboarding_completed ? "default" : "secondary"}>
                {fam.onboarding_completed ? "onboarding completo" : `onboarding no passo ${fam.onboarding_step}`}
              </Badge>
              <Badge variant="outline">
                {membrosCount} membro(s)
              </Badge>
              <Badge variant="outline">
                {fam.whatsapp_e164 ?? "sem WhatsApp"}
              </Badge>
            </>
          ) : (
            <span className="text-muted-foreground">Família ainda não inicializada.</span>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Telas de primeira vez</CardTitle>
          <CardDescription>
            Veja o que o recém-chegado vê, sem precisar de conta nova. O preview
            não altera seus dados — só troca a visão da Home.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2.5 text-sm">
          <Link
            href="/painel?preview=boasvindas"
            className="rounded-full border border-kolo-linha bg-white px-4 py-2 font-semibold text-brand-purple transition-colors hover:border-brand-yellow/60 hover:bg-kolo-lilas-bg-2"
          >
            🌱 Home de boas-vindas
          </Link>
          <Link
            href="/painel?preview=boasvindas&tour=1"
            className="rounded-full border border-kolo-linha bg-white px-4 py-2 font-semibold text-brand-purple transition-colors hover:border-brand-yellow/60 hover:bg-kolo-lilas-bg-2"
          >
            🌱 + 👀 Boas-vindas com o tour
          </Link>
          <Link
            href="/painel?tour=1"
            className="rounded-full border border-kolo-linha bg-white px-4 py-2 font-semibold text-brand-purple transition-colors hover:border-brand-yellow/60 hover:bg-kolo-lilas-bg-2"
          >
            👀 Só o tour do menu
          </Link>
        </CardContent>
      </Card>

      <TesteClient />
    </div>
  );
}
