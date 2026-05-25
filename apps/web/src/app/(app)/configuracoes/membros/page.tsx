import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { IconCard } from "@/components/brand/icon-card";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { MembrosForm } from "./membros-form";

export default async function MembrosPage() {
  const { supabase, family } = await loadFamilyContext();
  const familyId = family!.id;

  const { data: membros } = await supabase
    .from("membros_atipicos")
    .select("id, nome, data_nascimento, perfil")
    .eq("family_account_id", familyId)
    .eq("ativo", true)
    .order("created_at", { ascending: true });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/configuracoes"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden /> Configurações
        </Link>
      </div>

      <header className="flex items-start gap-4">
        <IconCard tone="light" size="lg" className="hidden md:inline-flex">
          <Users aria-hidden />
        </IconCard>
        <div>
          <Eyebrow>Crianças e membros</Eyebrow>
          <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
            Editar{" "}
            <em className="not-italic text-brand-purple">membros atípicos</em>
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Corrija nome, data de nascimento ou perfil de cada membro atípico da
            família.
          </p>
        </div>
      </header>

      {(membros?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum membro atípico cadastrado ainda.
        </p>
      ) : (
        <MembrosForm
          membros={
            (membros ?? []) as Array<{
              id: string;
              nome: string;
              data_nascimento: string | null;
              perfil: string;
            }>
          }
        />
      )}
    </div>
  );
}
