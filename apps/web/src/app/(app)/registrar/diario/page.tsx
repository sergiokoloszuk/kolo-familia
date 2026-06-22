import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { resolverCriancaAtivaId } from "@/lib/crianca-ativa";
import { primeiroNome } from "@/lib/nome";
import { SeletorCrianca } from "../../seletor-crianca";
import { RegistroRapido } from "./registro-rapido";

export default async function RegistrarDiarioPage() {
  const { supabase, family } = await loadFamilyContext();
  const familyId = family!.id;

  const { data: membros } = await supabase
    .from("membros_atipicos")
    .select("id, nome, genero")
    .eq("family_account_id", familyId)
    .eq("ativo", true)
    .order("created_at", { ascending: true });

  const ativaId = (await resolverCriancaAtivaId(membros ?? [])) ?? null;
  const ativa = (membros ?? []).find((m) => m.id === ativaId) ?? membros?.[0];
  const nomeCrianca = ativa?.nome ? primeiroNome(ativa.nome as string) : null;
  const generoCrianca = (ativa?.genero as string | null) ?? null;

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Registro do dia</h1>
          <SeletorCrianca
            criancas={(membros ?? []).map((m) => ({ id: m.id as string, nome: m.nome as string }))}
            ativaId={ativaId ?? ""}
            variant="screen"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Como foi o dia, e — se houver — algo pra celebrar ou um desafio. Pode escrever do
          seu jeito, a Kolo organiza. Preencher pouco já vale.
        </p>
      </header>

      <Card>
        <CardContent className="pt-6">
          <RegistroRapido
            key={ativaId ?? "none"}
            nomeCrianca={nomeCrianca}
            genero={generoCrianca}
            membroId={ativaId}
          />
        </CardContent>
      </Card>
    </div>
  );
}
