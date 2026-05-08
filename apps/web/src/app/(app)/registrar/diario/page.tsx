import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { DiarioForm } from "./diario-form";

export default async function RegistrarDiarioPage() {
  const { supabase, family } = await loadFamilyContext();
  const familyId = family!.id;

  const { data: membros } = await supabase
    .from("membros_atipicos")
    .select("id, nome")
    .eq("family_account_id", familyId)
    .eq("ativo", true)
    .order("created_at", { ascending: true });

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
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Hoje</h1>
        <p className="text-sm text-muted-foreground">
          Como você está, e (se houver) uma conquista ou desafio do dia. Quanto mais
          contexto sobre quem estava e como você reagiu, mais útil fica.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registro do dia</CardTitle>
          <CardDescription>
            Preenchimento parcial é bem-vindo. Você pode só responder o check-in
            sem registrar conquista/desafio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DiarioForm membros={membros ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
