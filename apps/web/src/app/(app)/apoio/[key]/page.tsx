import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { ApoioForm } from "./apoio-form";

export default async function ApoioTipoPage(props: PageProps<"/apoio/[key]">) {
  const { key } = await props.params;
  const { supabase, family } = await loadFamilyContext();
  const familyId = family!.id;

  const [{ data: tipo }, { data: membros }] = await Promise.all([
    supabase
      .from("output_types")
      .select("key, label, prompt_template, ordem, gera_imagem_opcional")
      .eq("key", key)
      .eq("ativo", true)
      .maybeSingle(),
    supabase
      .from("membros_atipicos")
      .select("id, nome")
      .eq("family_account_id", familyId)
      .eq("ativo", true)
      .order("created_at", { ascending: true }),
  ]);

  if (!tipo) notFound();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link
          href="/apoio"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft aria-hidden="true" className="size-3" />
          Voltar
        </Link>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{tipo.label}</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sobre o que você quer?</CardTitle>
          <CardDescription>
            Sobre quem é (se for um membro específico) e qualquer detalhe sobre o
            momento/situação.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ApoioForm
            outputTypeKey={tipo.key}
            geraImagemOpcional={Boolean(tipo.gera_imagem_opcional)}
            membros={membros ?? []}
          />
        </CardContent>
      </Card>
    </div>
  );
}
