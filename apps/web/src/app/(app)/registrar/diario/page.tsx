import { Card, CardContent } from "@/components/ui/card";
import { VideoAjuda } from "@/components/video-guia";
import { Eyebrow } from "@/components/brand/eyebrow";
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
      <header>
        <Eyebrow>Registro</Eyebrow>
        <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
          Registro do <em className="not-italic text-brand-purple">dia</em>
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Como foi o dia? Escreva do seu jeito — a Kolo organiza. Preencher pouco já vale.
        </p>
        {(membros ?? []).length > 1 && (
          <div className="mt-4 w-fit">
            <SeletorCrianca
              criancas={(membros ?? []).map((m) => ({ id: m.id as string, nome: m.nome as string }))}
              ativaId={ativaId ?? ""}
              variant="screen"
            />
          </div>
        )}
      </header>

      {/* Ajuda contextual — invisível enquanto não houver URL em lib/video-ajuda. */}
      <VideoAjuda area="registro_diario" />

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
