import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth/require-admin";
import { AdminNav } from "../../nav";
import { TemplateForm } from "./template-form";

const CATEGORY_LABEL: Record<string, string> = {
  proativa: "Proativa",
  reativa: "Reativa",
  comando: "Comando",
  auxiliar: "Auxiliar",
};

export default async function AdminMensagemPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const { supabase } = await requireAdmin();

  const { data: template } = await supabase
    .from("ayla_message_templates")
    .select("key, label, description, category, variations, variables, ativo, versao")
    .eq("key", key)
    .maybeSingle();

  if (!template) notFound();

  const variables = (template.variables as string[] | undefined) ?? [];
  const variations = (template.variations as string[] | undefined) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <AdminNav />
      <div>
        <Link
          href="/admin/mensagens"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Voltar para mensagens
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {template.label as string}
          </h1>
          <p className="text-sm text-muted-foreground">
            <code>{template.key as string}</code> · v{template.versao}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {CATEGORY_LABEL[template.category as string] ?? (template.category as string)}
          </Badge>
          <Badge variant={template.ativo ? "default" : "secondary"}>
            {template.ativo ? "ativo" : "inativo"}
          </Badge>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Editar</CardTitle>
          <CardDescription>
            As mudanças entram em vigor no próximo envio. Há um fallback
            hardcoded no código, então mesmo se o DB falhar, a Ayla não fica
            muda — só não usa suas edições.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TemplateForm
            templateKey={template.key as string}
            initial={{
              label: template.label as string,
              description: (template.description as string | null) ?? "",
              variations,
              ativo: template.ativo as boolean,
            }}
            variables={variables}
          />
        </CardContent>
      </Card>
    </div>
  );
}
