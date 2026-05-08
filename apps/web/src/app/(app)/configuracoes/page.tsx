import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { AylaPrefsForm } from "./ayla-prefs-form";
import { OptOutsForm } from "./optouts-form";

export default async function ConfiguracoesPage() {
  const { supabase, family } = await loadFamilyContext();
  const familyId = family!.id;

  const [{ data: prefs }, { data: optouts }] = await Promise.all([
    supabase
      .from("ayla_preferences")
      .select(
        "desativada, consentimento_em, horario_preferido_inicio, horario_preferido_fim, frequencia, pausada_ate",
      )
      .eq("family_account_id", familyId)
      .maybeSingle(),
    supabase
      .from("categorias_optout")
      .select("categoria")
      .eq("family_account_id", familyId),
  ]);

  const optoutSet = new Set((optouts ?? []).map((o) => o.categoria as string));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Controle das mensagens da Ayla e das comunicações que você recebe.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ayla no WhatsApp</CardTitle>
          <CardDescription>
            {prefs?.consentimento_em
              ? "Você autorizou a Ayla. Ajuste o horário e a frequência aqui."
              : "Você ainda não autorizou a Ayla. Marque na primeira pergunta dela ou volte ao onboarding."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AylaPrefsForm
            inicial={{
              desativada: prefs?.desativada ?? true,
              horario_preferido_inicio: (prefs?.horario_preferido_inicio as string)?.slice(0, 5) ?? "19:00",
              horario_preferido_fim: (prefs?.horario_preferido_fim as string)?.slice(0, 5) ?? "21:00",
              frequencia: (prefs?.frequencia as "diaria" | "3x_semana" | "semanal") ?? "diaria",
            }}
            consentimento={Boolean(prefs?.consentimento_em)}
            pausadaAte={prefs?.pausada_ate as string | null | undefined}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comunicações por categoria</CardTitle>
          <CardDescription>
            Operacionais (manutenção, mudanças importantes) sempre são entregues —
            não dá pra optar fora destas (PRD §7.13).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OptOutsForm optoutSet={Array.from(optoutSet)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Avatar dos membros</CardTitle>
          <CardDescription>
            Configure o avatar canônico (cartoon/aquarela) usado nas brincadeiras,
            atividades e histórias sociais.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <a
            href="/configuracoes/avatar"
            className="text-sm font-medium underline-offset-4 hover:underline"
          >
            Configurar avatares →
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
