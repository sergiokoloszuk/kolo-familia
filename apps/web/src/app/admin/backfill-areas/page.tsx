import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { BackfillClient } from "./backfill-client";

export default async function AdminBackfillAreasPage() {
  await requireAdmin();
  const admin = createServiceRoleClient();

  const { count } = await admin
    .from("diarios")
    .select("id", { count: "exact", head: true })
    .is("conquista_area", null)
    .is("desafio_area", null)
    .or("conquista.not.is.null,desafio.not.is.null");

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Etiquetar histórico (áreas)
        </h1>
        <p className="text-sm text-muted-foreground">
          Classifica por área (sono, comunicação…) os registros do diário antigos que ainda não
          têm etiqueta — pra o &ldquo;X em cada tema&rdquo; da Evolução nascer rico. Roda em lotes
          de 25, usa a IA leve e <strong>não reescreve</strong> o texto original. Idempotente:
          rode quantas vezes precisar.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pendentes</CardTitle>
          <CardDescription>
            Diários com conquista/desafio escritos, mas sem área classificada.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BackfillClient restantesInicial={count ?? 0} />
        </CardContent>
      </Card>
    </div>
  );
}
