import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/require-admin";
import { AdminNav } from "../../nav";
import { TrilhaForm } from "../trilha-form";

export default async function EditarTrilhaPage(props: PageProps<"/admin/trilhas/[id]">) {
  const { id } = await props.params;
  const { supabase } = await requireAdmin();

  const [{ data: trilha }, { data: aulas }] = await Promise.all([
    supabase
      .from("trilhas")
      .select("id, titulo, descricao, ordem, tags, perfis_aplicaveis, ativo")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("aulas")
      .select("id, titulo, ordem_na_trilha, status")
      .eq("trilha_id", id)
      .order("ordem_na_trilha", { ascending: true, nullsFirst: false }),
  ]);

  if (!trilha) notFound();

  return (
    <div className="flex flex-col gap-6">
      <AdminNav />
      <header className="flex flex-col gap-2">
        <Link
          href="/admin/trilhas"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft aria-hidden="true" className="size-3" />
          Trilhas
        </Link>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{trilha.titulo}</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuração</CardTitle>
        </CardHeader>
        <CardContent>
          <TrilhaForm
            inicial={{
              id: trilha.id,
              titulo: trilha.titulo,
              descricao: trilha.descricao,
              ordem: trilha.ordem,
              tags: (trilha.tags as string[]) ?? [],
              perfis_aplicaveis: (trilha.perfis_aplicaveis as string[]) ?? [],
              ativo: trilha.ativo,
            }}
            permitirApagar
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aulas nesta trilha</CardTitle>
          <CardDescription>Reordenar é via campo &quot;ordem na trilha&quot; em cada aula.</CardDescription>
        </CardHeader>
        <CardContent>
          {aulas && aulas.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {aulas.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/admin/aulas/${a.id}`}
                    className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm hover:bg-muted/50"
                  >
                    <span>
                      {a.ordem_na_trilha != null && (
                        <span className="mr-2 font-mono text-xs text-muted-foreground">
                          #{a.ordem_na_trilha}
                        </span>
                      )}
                      {a.titulo}
                    </span>
                    <span className="text-xs text-muted-foreground">{a.status}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma aula nesta trilha ainda.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
