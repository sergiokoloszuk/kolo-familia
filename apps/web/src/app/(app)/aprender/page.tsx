import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { loadFamilyContext } from "@/lib/auth/require-user";

export default async function AprenderPage() {
  const { supabase } = await loadFamilyContext();

  const [{ data: trilhas }, { data: aulasIsoladas }] = await Promise.all([
    supabase
      .from("trilhas")
      .select("id, titulo, descricao, ordem, aulas(id)")
      .eq("ativo", true)
      .order("ordem", { ascending: true }),
    // Aulas ativas sem trilha
    supabase
      .from("aulas")
      .select("id, titulo, descricao, tags")
      .eq("status", "ativo")
      .is("trilha_id", null)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const trilhasComContagem = (trilhas ?? []).map((t) => ({
    id: t.id,
    titulo: t.titulo,
    descricao: t.descricao,
    qtdAulas: Array.isArray(t.aulas) ? t.aulas.length : 0,
  }));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Aprender</h1>
        <p className="text-sm text-muted-foreground">
          Conteúdo da fundadora — vídeos, transcrições e trilhas para você consultar
          quando precisar.
        </p>
      </header>

      {trilhasComContagem.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">Trilhas</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {trilhasComContagem.map((t) => (
              <li key={t.id}>
                <Card className="h-full transition-colors hover:bg-muted/30">
                  <CardHeader>
                    <CardTitle className="text-base">{t.titulo}</CardTitle>
                    {t.descricao && <CardDescription>{t.descricao}</CardDescription>}
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      {t.qtdAulas} aula{t.qtdAulas === 1 ? "" : "s"}
                    </p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          {trilhasComContagem.length > 0 ? "Aulas avulsas" : "Aulas"}
        </h2>
        {aulasIsoladas && aulasIsoladas.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {aulasIsoladas.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/aprender/${a.id}`}
                  className="block rounded-md border bg-card px-4 py-3 hover:bg-muted/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-medium">{a.titulo}</p>
                      {a.descricao && (
                        <p className="line-clamp-2 text-xs text-muted-foreground">{a.descricao}</p>
                      )}
                    </div>
                    {Array.isArray(a.tags) && a.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {(a.tags as string[]).slice(0, 2).map((t) => (
                          <Badge key={t} variant="outline" className="text-xs">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sem aulas ativas ainda</CardTitle>
              <CardDescription>
                A fundadora vai publicar conteúdo — quando tiver, aparece aqui.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </section>
    </div>
  );
}
