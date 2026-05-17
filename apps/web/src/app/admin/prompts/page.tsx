import Link from "next/link";
import { formatRelative } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth/require-admin";

const SCOPE_LABEL: Record<string, string> = {
  ayla: "Ayla (WhatsApp)",
  relatorio: "Relatórios",
  skills: "Curadoria de skills",
  boas_praticas: "Boas Práticas",
};

const SCOPE_DESC: Record<string, string> = {
  ayla: "Prompts usados pela Ayla pra conversar com a mãe via WhatsApp.",
  relatorio: "Prompts da geração de narrativa do relatório PDF.",
  skills: "Prompts da curadoria de skills (gera minutas via IA).",
  boas_praticas: "Prompts que extraem Boas Práticas das transcrições de aulas.",
};

export default async function AdminPromptsPage() {
  const { supabase } = await requireAdmin();

  const { data: prompts } = await supabase
    .from("ai_prompts")
    .select("key, label, description, scope, system_text, ativo, versao, updated_at")
    .order("scope", { ascending: true })
    .order("label", { ascending: true });

  const byScope = new Map<string, typeof prompts>();
  for (const p of prompts ?? []) {
    const sc = (p.scope as string) ?? "ayla";
    if (!byScope.has(sc)) byScope.set(sc, []);
    byScope.get(sc)!.push(p);
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Prompts da IA</h1>
        <p className="text-sm text-muted-foreground">
          System prompts enviados ao modelo (Claude Haiku / Sonnet). Edições
          entram em vigor no próximo uso. Fallback hardcoded no código garante
          que a IA não pare se o DB falhar.
        </p>
      </header>

      {(prompts?.length ?? 0) === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nenhum prompt no DB</CardTitle>
            <CardDescription>
              Rode a migration <code>0012_ai_prompts.sql</code> e depois{" "}
              <code>node scripts/seed-ai-prompts.mjs</code>. Enquanto não rodar,
              os 4 prompts usam o fallback hardcoded.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        Array.from(byScope.entries()).map(([scope, items]) => (
          <Card key={scope}>
            <CardHeader>
              <CardTitle className="text-base">{SCOPE_LABEL[scope] ?? scope}</CardTitle>
              <CardDescription>{SCOPE_DESC[scope]}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2">
                {(items ?? []).map((p) => (
                  <li key={p.key as string}>
                    <Link
                      href={`/admin/prompts/${p.key}`}
                      className="block rounded-md border bg-card px-4 py-3 text-sm hover:bg-muted/50"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium">{p.label}</p>
                          <p className="text-xs text-muted-foreground">
                            <code>{p.key as string}</code> · {(p.system_text as string).length} chars · v{p.versao}
                          </p>
                          {p.description && (
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              {p.description as string}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge variant={p.ativo ? "default" : "secondary"}>
                            {p.ativo ? "ativo" : "inativo"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatRelative(new Date(p.updated_at as string), new Date(), {
                              locale: ptBR,
                            })}
                          </span>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
