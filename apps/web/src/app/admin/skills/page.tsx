import Link from "next/link";
import { formatRelative } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function AdminSkillsPage() {
  const { supabase } = await requireAdmin();

  const { data: skills } = await supabase
    .from("specialist_prompt_templates")
    .select("id, name, display_name, routing_priority, ativo, versao, updated_at")
    .order("routing_priority", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Skills</h1>
          <p className="text-sm text-muted-foreground">
            SpecialistPromptTemplates. Identidade, roteamento e fallback questions.
            Visual fica no frontend, separado.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/skills/curadoria"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <Sparkles aria-hidden="true" className="size-4" /> Curadoria IA
          </Link>
          <Link href="/admin/skills/nova" className={cn(buttonVariants({ size: "sm" }))}>
            <Plus aria-hidden="true" className="size-4" /> Nova skill
          </Link>
        </div>
      </header>

      {skills && skills.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {skills.map((s) => (
            <li key={s.id}>
              <Link
                href={`/admin/skills/${s.id}`}
                className="block rounded-md border bg-card px-4 py-3 text-sm hover:bg-muted/50"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{s.display_name}</p>
                    <p className="text-xs text-muted-foreground">
                      <code>{s.name}</code> · prioridade {s.routing_priority} · v
                      {s.versao}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={s.ativo ? "default" : "secondary"}>
                      {s.ativo ? "ativa" : "inativa"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatRelative(new Date(s.updated_at), new Date(), { locale: ptBR })}
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sem skills</CardTitle>
            <CardDescription>
              O seed 0003_seed.sql cria 7 skills iniciais. Verifique se aplicou no Studio.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/skills/nova" className={cn(buttonVariants())}>
              Criar skill
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
