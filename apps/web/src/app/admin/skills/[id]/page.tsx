import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth/require-admin";
import { SkillForm } from "../skill-form";

export default async function EditarSkillPage(props: PageProps<"/admin/skills/[id]">) {
  const { id } = await props.params;
  const { supabase } = await requireAdmin();

  const { data: skill } = await supabase
    .from("specialist_prompt_templates")
    .select(
      "id, name, display_name, objective, tone, scope, limits, kolo_vivo_fields, knowledge_tags, routing_keywords, routing_priority, fallback_questions, ativo, versao",
    )
    .eq("id", id)
    .maybeSingle();

  if (!skill) notFound();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link
          href="/admin/skills"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft aria-hidden="true" className="size-3" />
          Skills
        </Link>
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {skill.display_name}
          </h1>
          <div className="flex items-center gap-2">
            <Badge variant={skill.ativo ? "default" : "secondary"}>
              {skill.ativo ? "ativa" : "inativa"}
            </Badge>
            <span className="text-xs text-muted-foreground">v{skill.versao}</span>
          </div>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identidade da skill</CardTitle>
          <CardDescription>
            Nome interno é imutável (rotas/dados o usam como chave). Cada save
            incrementa a versão.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SkillForm
            inicial={{
              id: skill.id,
              name: skill.name,
              display_name: skill.display_name,
              objective: skill.objective,
              tone: skill.tone,
              scope: skill.scope,
              limits: skill.limits,
              kolo_vivo_fields: (skill.kolo_vivo_fields as string[]) ?? [],
              knowledge_tags: (skill.knowledge_tags as string[]) ?? [],
              routing_keywords: (skill.routing_keywords as string[]) ?? [],
              routing_priority: skill.routing_priority,
              fallback_questions: (skill.fallback_questions as string[]) ?? [],
              ativo: skill.ativo,
            }}
            permitirApagar
          />
        </CardContent>
      </Card>
    </div>
  );
}
