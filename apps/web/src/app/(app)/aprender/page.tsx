import Link from "next/link";
import { BookOpen } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eyebrow } from "@/components/brand/eyebrow";
import { IconCard } from "@/components/brand/icon-card";
import { loadFamilyContext } from "@/lib/auth/require-user";

export default async function AprenderPage() {
  const { supabase } = await loadFamilyContext();

  const [{ data: trilhas }, { data: aulasIsoladas }] = await Promise.all([
    supabase
      .from("trilhas")
      .select("id, titulo, descricao, ordem, aulas(id)")
      .eq("ativo", true)
      .order("ordem", { ascending: true }),
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
    <div className="flex flex-col gap-8">
      <header className="flex items-start gap-4">
        <IconCard tone="light" size="lg" className="hidden md:inline-flex">
          <BookOpen aria-hidden />
        </IconCard>
        <div>
          <Eyebrow>Aprender</Eyebrow>
          <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
            Conteúdo da{" "}
            <em className="not-italic text-brand-purple">fundadora</em>
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Vídeos, transcrições e trilhas pra consultar quando precisar.
          </p>
        </div>
      </header>

      {trilhasComContagem.length > 0 && (
        <section className="flex flex-col gap-4">
          <Eyebrow>Trilhas</Eyebrow>
          <ul className="grid gap-4 md:grid-cols-2">
            {trilhasComContagem.map((t) => (
              <li key={t.id}>
                <div className="flex h-full flex-col gap-2 rounded-3xl bg-kolo-lilas-bg-2 p-6 transition-all hover:-translate-y-1 hover:shadow-lg">
                  <h3 className="font-heading text-lg text-foreground">
                    {t.titulo}
                  </h3>
                  {t.descricao && (
                    <p className="text-sm text-muted-foreground">
                      {t.descricao}
                    </p>
                  )}
                  <p className="mt-auto text-xs font-semibold uppercase tracking-[0.12em] text-brand-purple">
                    {t.qtdAulas} aula{t.qtdAulas === 1 ? "" : "s"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-4">
        <Eyebrow>
          {trilhasComContagem.length > 0 ? "Aulas avulsas" : "Aulas"}
        </Eyebrow>
        {aulasIsoladas && aulasIsoladas.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {aulasIsoladas.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/aprender/${a.id}`}
                  className="block rounded-2xl border border-kolo-linha bg-white px-5 py-4 transition-all hover:-translate-y-0.5 hover:border-brand-purple hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">
                        {a.titulo}
                      </p>
                      {a.descricao && (
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {a.descricao}
                        </p>
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
          <Card className="rounded-3xl border-l-4 border-brand-yellow bg-kolo-lilas-bg-2">
            <CardHeader>
              <CardTitle className="text-base">
                Sem aulas ativas ainda
              </CardTitle>
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
