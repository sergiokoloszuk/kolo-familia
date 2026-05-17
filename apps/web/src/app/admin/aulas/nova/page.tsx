import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/require-admin";
import { AulaForm } from "../aula-form";

export default async function NovaAulaPage() {
  const { supabase } = await requireAdmin();

  const { data: trilhas } = await supabase
    .from("trilhas")
    .select("id, titulo")
    .eq("ativo", true)
    .order("titulo", { ascending: true });

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Nova aula</h1>
      </header>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conteúdo</CardTitle>
        </CardHeader>
        <CardContent>
          <AulaForm inicial={{}} trilhas={trilhas ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
