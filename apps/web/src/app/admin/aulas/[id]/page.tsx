import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth/require-admin";
import { AulaForm } from "../aula-form";
import { AulaStatusActions } from "./status-actions";

export default async function EditarAulaPage(props: PageProps<"/admin/aulas/[id]">) {
  const { id } = await props.params;
  const { supabase } = await requireAdmin();

  const [{ data: aula }, { data: trilhas }, { data: bps }] = await Promise.all([
    supabase
      .from("aulas")
      .select(
        "id, titulo, descricao, video_url, transcricao, trilha_id, ordem_na_trilha, faixa_etaria_min, faixa_etaria_max, tags, perfis_aplicaveis, status",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("trilhas")
      .select("id, titulo")
      .eq("ativo", true)
      .order("titulo", { ascending: true }),
    supabase
      .from("boas_praticas")
      .select("id, titulo, status")
      .eq("aula_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!aula) notFound();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link
          href="/admin/aulas"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft aria-hidden="true" className="size-3" />
          Aulas
        </Link>
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{aula.titulo}</h1>
          <Badge variant={aula.status === "ativo" ? "default" : "secondary"}>
            {aula.status}
          </Badge>
        </div>
      </header>

      <AulaStatusActions id={id} statusAtual={aula.status} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conteúdo</CardTitle>
        </CardHeader>
        <CardContent>
          <AulaForm
            inicial={{
              id: aula.id,
              titulo: aula.titulo,
              descricao: aula.descricao,
              video_url: aula.video_url,
              transcricao: aula.transcricao,
              trilha_id: aula.trilha_id,
              ordem_na_trilha: aula.ordem_na_trilha,
              faixa_etaria_min: aula.faixa_etaria_min,
              faixa_etaria_max: aula.faixa_etaria_max,
              tags: (aula.tags as string[]) ?? [],
              perfis_aplicaveis: (aula.perfis_aplicaveis as string[]) ?? [],
            }}
            trilhas={trilhas ?? []}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Boas Práticas extraídas</CardTitle>
          <CardDescription>
            Geradas pela IA quando esta aula virou ativa pela primeira vez.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {bps && bps.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {bps.map((bp) => (
                <li key={bp.id}>
                  <Link
                    href={`/admin/boas-praticas/${bp.id}`}
                    className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm hover:bg-muted/50"
                  >
                    <span>{bp.titulo}</span>
                    <Badge variant={bp.status === "ativo" ? "default" : "outline"}>
                      {bp.status}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma extraída ainda. Publique a aula (status → ativo) para acionar a IA.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
