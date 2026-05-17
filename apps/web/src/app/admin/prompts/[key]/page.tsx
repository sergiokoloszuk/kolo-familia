import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth/require-admin";
import { PromptForm } from "./prompt-form";

const SCOPE_LABEL: Record<string, string> = {
  ayla: "Ayla",
  relatorio: "Relatórios",
  skills: "Skills",
  boas_praticas: "Boas Práticas",
};

export default async function AdminPromptPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const { supabase } = await requireAdmin();

  const { data: prompt } = await supabase
    .from("ai_prompts")
    .select("key, label, description, scope, system_text, ativo, versao")
    .eq("key", key)
    .maybeSingle();

  if (!prompt) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/prompts"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Voltar para prompts
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {prompt.label as string}
          </h1>
          <p className="text-sm text-muted-foreground">
            <code>{prompt.key as string}</code> · v{prompt.versao}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {SCOPE_LABEL[prompt.scope as string] ?? (prompt.scope as string)}
          </Badge>
          <Badge variant={prompt.ativo ? "default" : "secondary"}>
            {prompt.ativo ? "ativo" : "inativo"}
          </Badge>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Editar system prompt</CardTitle>
          <CardDescription>
            Mudanças entram em vigor já na próxima chamada da IA. Há fallback
            hardcoded no código pra segurança — se o DB falhar, a IA continua
            funcionando com o texto antigo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PromptForm
            promptKey={prompt.key as string}
            initial={{
              label: prompt.label as string,
              description: (prompt.description as string | null) ?? "",
              system_text: prompt.system_text as string,
              ativo: prompt.ativo as boolean,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
