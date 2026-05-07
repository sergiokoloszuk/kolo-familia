import Link from "next/link";
import { formatRelative } from "date-fns";
import { ptBR } from "date-fns/locale";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConversarForm } from "./conversar-form";

export default async function ConversarPage() {
  const { supabase, family } = await loadFamilyContext();
  const familyId = family!.id;

  const [{ data: membros }, { data: conversas }] = await Promise.all([
    supabase
      .from("membros_atipicos")
      .select("id, nome")
      .eq("family_account_id", familyId)
      .eq("ativo", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("conversas")
      .select("id, titulo, created_at, encerrada, membro_atipico_id")
      .eq("family_account_id", familyId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Conversar</h1>
        <p className="text-sm text-muted-foreground">
          Escreva uma dúvida real do dia a dia. O sistema decide qual perspectiva responde —
          você não precisa escolher.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nova conversa</CardTitle>
          <CardDescription>
            Sobre quem é (se for um membro específico) e o que aconteceu.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConversarForm membros={membros ?? []} />
        </CardContent>
      </Card>

      {conversas && conversas.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">Conversas anteriores</h2>
          <ul className="flex flex-col gap-2">
            {conversas.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/conversar/${c.id}`}
                  className="block rounded-md border bg-card px-4 py-3 text-sm hover:bg-muted/50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="line-clamp-1">{c.titulo ?? "Conversa"}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatRelative(new Date(c.created_at), new Date(), { locale: ptBR })}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
