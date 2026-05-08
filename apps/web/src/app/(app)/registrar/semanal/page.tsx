import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { SemanalForm } from "./semanal-form";

export default async function CheckinSemanalPage() {
  const { supabase, family } = await loadFamilyContext();
  const familyId = family!.id;

  const { data: membros } = await supabase
    .from("membros_atipicos")
    .select("id, nome")
    .eq("family_account_id", familyId)
    .eq("ativo", true)
    .order("created_at", { ascending: true });

  // semana_inicio = domingo desta semana (PRD §7.15.2 default domingo à noite)
  const hoje = new Date();
  const domingo = new Date(hoje);
  domingo.setDate(hoje.getDate() - hoje.getDay());
  const semanaInicio = domingo.toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link
          href="/registrar"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft aria-hidden="true" className="size-3" />
          Registrar
        </Link>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Check-in semanal</h1>
        <p className="text-sm text-muted-foreground">
          Como foi a semana — emocional + energia. Para você e (se quiser) para o
          membro atípico em foco.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Semana iniciando em {semanaInicio}</CardTitle>
          <CardDescription>
            Pode preencher uma vez por semana. Reflexão final é opcional.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SemanalForm membros={membros ?? []} semanaInicio={semanaInicio} />
        </CardContent>
      </Card>
    </div>
  );
}
