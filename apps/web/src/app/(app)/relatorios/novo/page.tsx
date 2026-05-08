import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { NovoRelatorioForm } from "./novo-form";

export default async function NovoRelatorioPage() {
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
          href="/relatorios"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft aria-hidden="true" className="size-3" />
          Relatórios
        </Link>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Novo relatório</h1>
        <p className="text-sm text-muted-foreground">
          Você decide o que entra. Camada B (estado/reação do adulto) e DASS-21 só
          aparecem se você marcar — e só no relatório para terapeuta.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configurações</CardTitle>
          <CardDescription>
            Escolha destinatário, janela e o que incluir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NovoRelatorioForm membros={membros ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
