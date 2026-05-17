import {
  BookOpen,
  ListChecks,
  MessageCircle,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eyebrow } from "@/components/brand/eyebrow";
import { IconCard } from "@/components/brand/icon-card";
import { requireAdmin } from "@/lib/auth/require-admin";
import { cn } from "@/lib/utils";

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
    <div className="flex flex-col gap-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <Eyebrow>Console institucional</Eyebrow>
          <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
            Conteúdo curado pela{" "}
            <em className="not-italic text-brand-purple">fundadora</em>
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Aulas, trilhas, skills, boas práticas, prompts e ferramentas
            operacionais.
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0">
          {role}
        </Badge>
      </header>

      <section className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        <Stat icon={BookOpen} label="Aulas" value={aulasCount.count ?? 0} />
        <Stat icon={ListChecks} label="Trilhas" value={trilhasCount.count ?? 0} />
        <Stat icon={Sparkles} label="Skills ativas" value={skillsCount.count ?? 0} />
        <Stat
          icon={MessageCircle}
          label="Boas Práticas ativas"
          value={boasPraticasAtivas.count ?? 0}
        />
        <Stat
          icon={TriangleAlert}
          label="BPs rascunho"
          value={boasPraticasRascunho.count ?? 0}
          accent={(boasPraticasRascunho.count ?? 0) > 0}
        />
      </section>

      <Card className="rounded-3xl border-l-4 border-brand-yellow bg-kolo-lilas-bg-2">
        <CardHeader>
          <CardTitle className="text-base">Como funciona</CardTitle>
          <CardDescription>
            Crie aulas com transcrição. Quando publicar (ativo), a IA extrai
            sugestões de Boas Práticas que você revisa antes de virarem ativas.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <ul className="ml-5 list-disc space-y-1">
            <li>Aulas: conteúdo formativo direto pra mãe (área Aprender).</li>
            <li>Trilhas: agrupam aulas em sequência didática.</li>
            <li>
              Boas Práticas: orientações curtas que as skills consomem em todo
              turno. Origem: admin (texto livre) ou aula (extração automática).
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof BookOpen;
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <Card
      className={cn(
        "rounded-3xl",
        accent ? "border-brand-yellow/40 bg-brand-yellow/5" : "bg-white",
      )}
    >
      <CardHeader className="flex flex-col gap-3">
        <IconCard tone="light" size="sm">
          <Icon aria-hidden />
        </IconCard>
        <div>
          <CardDescription className="text-xs uppercase tracking-[0.12em] text-muted-foreground/80">
            {label}
          </CardDescription>
          <CardTitle
            className={cn(
              "mt-1 font-heading text-3xl",
              accent ? "text-brand-purple-dark" : "text-foreground",
            )}
          >
            {value}
          </CardTitle>
        </div>
      </CardHeader>
    </Card>
  );
}
