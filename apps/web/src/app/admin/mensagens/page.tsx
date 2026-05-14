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
import { AdminNav } from "../nav";

const CATEGORY_LABEL: Record<string, string> = {
  proativa: "Proativa",
  reativa: "Reativa",
  comando: "Comando",
  auxiliar: "Auxiliar",
};

const CATEGORY_DESC: Record<string, string> = {
  proativa: "Mensagens que a Ayla envia por iniciativa (rotina, engajamento, trial, etc).",
  reativa: "Respostas a registros e clarificações.",
  comando: "Respostas aos comandos AJUDA, PAUSAR, SAIR, MUDAR HORARIO.",
  auxiliar: "Outras mensagens auxiliares.",
};

export default async function AdminMensagensPage() {
  const { supabase } = await requireAdmin();

  const { data: templates } = await supabase
    .from("ayla_message_templates")
    .select("key, label, description, category, variations, ativo, versao, updated_at")
    .order("category", { ascending: true })
    .order("label", { ascending: true });

  // Agrupa por categoria
  const byCategory = new Map<string, typeof templates>();
  for (const t of templates ?? []) {
    const cat = (t.category as string) ?? "auxiliar";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(t);
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminNav />
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Mensagens</h1>
        <p className="text-sm text-muted-foreground">
          Textos fixos que a Ayla envia. Cada template tem 1-5 variações; o
          scheduler escolhe round-robin pra evitar repetição. Variáveis como{" "}
          <code className="rounded bg-muted px-1">{`{nomeMae}`}</code> são preenchidas no envio.
        </p>
      </header>

      {(templates?.length ?? 0) === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nenhum template no DB</CardTitle>
            <CardDescription>
              Rode a migração <code>0010_ayla_message_templates.sql</code> no
              Supabase Studio. Enquanto não rodar, a Ayla usa o fallback
              hardcoded em <code>messageTemplates.ts</code> — funciona, mas
              não é editável aqui.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        Array.from(byCategory.entries()).map(([cat, items]) => (
          <Card key={cat}>
            <CardHeader>
              <CardTitle className="text-base">{CATEGORY_LABEL[cat] ?? cat}</CardTitle>
              <CardDescription>{CATEGORY_DESC[cat]}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2">
                {(items ?? []).map((t) => (
                  <li key={t.key as string}>
                    <Link
                      href={`/admin/mensagens/${t.key}`}
                      className="block rounded-md border bg-card px-4 py-3 text-sm hover:bg-muted/50"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{t.label}</p>
                          <p className="text-xs text-muted-foreground">
                            <code>{t.key as string}</code> ·{" "}
                            {(t.variations as string[] | undefined)?.length ?? 0} variação(ões) · v
                            {t.versao}
                          </p>
                          {t.description && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {t.description as string}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge variant={t.ativo ? "default" : "secondary"}>
                            {t.ativo ? "ativo" : "inativo"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatRelative(new Date(t.updated_at as string), new Date(), {
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
