import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth/require-admin";
import { BPForm } from "./bp-form";
import { BPStatusActions } from "./status-actions";

export default async function EditarBPPage(props: PageProps<"/admin/boas-praticas/[id]">) {
  const { id } = await props.params;
  const { supabase } = await requireAdmin();

  const { data: bp } = await supabase
    .from("boas_praticas")
    .select(
      "id, titulo, versao_curta, versao_conversa, texto_original, skills_relacionadas, tags, perfis_aplicaveis, faixa_etaria_min, faixa_etaria_max, nivel, status, origem, aula_id, peso_relevancia, versao",
    )
    .eq("id", id)
    .maybeSingle();

  if (!bp) notFound();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link
          href="/admin/boas-praticas"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft aria-hidden="true" className="size-3" />
          Boas Práticas
        </Link>
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {bp.titulo ?? "(sem título)"}
          </h1>
          <div className="flex items-center gap-2">
            <Badge variant={bp.status === "ativo" ? "default" : "secondary"}>{bp.status}</Badge>
            <span className="text-xs text-muted-foreground">
              v{bp.versao} · origem {bp.origem}
            </span>
          </div>
        </div>
      </header>

      <BPStatusActions id={id} statusAtual={bp.status} />

      {bp.aula_id && (
        <Card>
          <CardHeader>
            <CardDescription>
              Esta Boa Prática foi extraída automaticamente de uma aula.{" "}
              <Link href={`/admin/aulas/${bp.aula_id}`} className="underline">
                Ver aula
              </Link>
              .
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conteúdo</CardTitle>
        </CardHeader>
        <CardContent>
          <BPForm
            inicial={{
              id: bp.id,
              titulo: bp.titulo,
              versao_curta: bp.versao_curta,
              versao_conversa: bp.versao_conversa,
              texto_original: bp.texto_original,
              skills_relacionadas: (bp.skills_relacionadas as string[]) ?? [],
              tags: (bp.tags as string[]) ?? [],
              perfis_aplicaveis: (bp.perfis_aplicaveis as string[]) ?? [],
              faixa_etaria_min: bp.faixa_etaria_min,
              faixa_etaria_max: bp.faixa_etaria_max,
              nivel: bp.nivel as "iniciante" | "intermediario" | "avancado" | null,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
