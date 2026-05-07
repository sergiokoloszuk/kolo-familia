import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { loadFamilyContext } from "@/lib/auth/require-user";

export default async function AulaPage(props: PageProps<"/aprender/[id]">) {
  const { id } = await props.params;
  const { supabase } = await loadFamilyContext();

  const { data: aula } = await supabase
    .from("aulas")
    .select(
      "id, titulo, descricao, video_url, transcricao, tags, perfis_aplicaveis, faixa_etaria_min, faixa_etaria_max, trilha_id, trilhas(titulo)",
    )
    .eq("id", id)
    .eq("status", "ativo")
    .maybeSingle();

  if (!aula) notFound();

  const trilha = Array.isArray(aula.trilhas) ? aula.trilhas[0] : aula.trilhas;

  // Outras aulas da mesma trilha
  let outrasDaTrilha: Array<{ id: string; titulo: string; ordem_na_trilha: number | null }> = [];
  if (aula.trilha_id) {
    const { data } = await supabase
      .from("aulas")
      .select("id, titulo, ordem_na_trilha")
      .eq("trilha_id", aula.trilha_id)
      .eq("status", "ativo")
      .order("ordem_na_trilha", { ascending: true, nullsFirst: false });
    outrasDaTrilha = data ?? [];
  }

  const tags = Array.isArray(aula.tags) ? (aula.tags as string[]) : [];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link
          href="/aprender"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft aria-hidden="true" className="size-3" />
          Aprender
        </Link>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{aula.titulo}</h1>
        {trilha && (
          <p className="text-sm text-muted-foreground">Trilha: {trilha.titulo}</p>
        )}
        {aula.descricao && (
          <p className="text-sm text-muted-foreground">{aula.descricao}</p>
        )}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <Badge key={t} variant="outline" className="text-xs">
                {t}
              </Badge>
            ))}
          </div>
        )}
      </header>

      {aula.video_url && (
        <div className="aspect-video w-full overflow-hidden rounded-md bg-muted">
          {/* iframe básico — funciona com YouTube/Vimeo embed URLs */}
          <iframe
            src={aula.video_url}
            title={aula.titulo}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {aula.transcricao && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Transcrição</CardTitle>
            <CardDescription>Pra ler junto com o vídeo ou em vez dele.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{aula.transcricao}</p>
          </CardContent>
        </Card>
      )}

      {outrasDaTrilha.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Continuar a trilha</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1">
              {outrasDaTrilha.map((a) => {
                const atual = a.id === aula.id;
                return (
                  <li key={a.id}>
                    {atual ? (
                      <span className="block rounded-md bg-muted px-3 py-2 text-sm">
                        {a.ordem_na_trilha != null && (
                          <span className="mr-2 font-mono text-xs text-muted-foreground">
                            #{a.ordem_na_trilha}
                          </span>
                        )}
                        {a.titulo} (você está aqui)
                      </span>
                    ) : (
                      <Link
                        href={`/aprender/${a.id}`}
                        className="block rounded-md border bg-card px-3 py-2 text-sm hover:bg-muted/50"
                      >
                        {a.ordem_na_trilha != null && (
                          <span className="mr-2 font-mono text-xs text-muted-foreground">
                            #{a.ordem_na_trilha}
                          </span>
                        )}
                        {a.titulo}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
