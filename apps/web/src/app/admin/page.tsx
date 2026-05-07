import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth/require-admin";
import { AdminNav } from "./nav";

export default async function AdminHomePage() {
  const { supabase, role } = await requireAdmin();

  const [aulasCount, trilhasCount, boasPraticasRascunho, boasPraticasAtivas, skillsCount] =
    await Promise.all([
      supabase.from("aulas").select("id", { count: "exact", head: true }),
      supabase.from("trilhas").select("id", { count: "exact", head: true }),
      supabase
        .from("boas_praticas")
        .select("id", { count: "exact", head: true })
        .eq("status", "rascunho"),
      supabase
        .from("boas_praticas")
        .select("id", { count: "exact", head: true })
        .eq("status", "ativo"),
      supabase
        .from("specialist_prompt_templates")
        .select("id", { count: "exact", head: true })
        .eq("ativo", true),
    ]);

  return (
    <div className="flex flex-col gap-6">
      <AdminNav />
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Admin</h1>
          <p className="text-sm text-muted-foreground">Conteúdo curado pela fundadora.</p>
        </div>
        <Badge variant="secondary">{role}</Badge>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Stat label="Aulas" value={aulasCount.count ?? 0} />
        <Stat label="Trilhas" value={trilhasCount.count ?? 0} />
        <Stat label="Skills ativas" value={skillsCount.count ?? 0} />
        <Stat label="Boas Práticas ativas" value={boasPraticasAtivas.count ?? 0} />
        <Stat
          label="Boas Práticas rascunho"
          value={boasPraticasRascunho.count ?? 0}
          accent={(boasPraticasRascunho.count ?? 0) > 0}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Como funciona</CardTitle>
          <CardDescription>
            Crie aulas com transcrição. Quando publicar (ativo), a IA extrai sugestões
            de Boas Práticas que você revisa antes de virarem ativas.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <ul className="ml-5 list-disc space-y-1">
            <li>Aulas: conteúdo formativo direto pra mãe (área Aprender).</li>
            <li>Trilhas: agrupam aulas em sequência didática.</li>
            <li>
              Boas Práticas: orientações curtas que as skills consomem em todo turno.
              Origem: admin (texto livre) ou aula (extração automática).
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle
          className={accent ? "text-2xl text-primary" : "text-2xl"}
        >
          {value}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}
