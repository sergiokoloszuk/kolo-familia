import Link from "next/link";
import { formatRelative } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { loadFamilyContext } from "@/lib/auth/require-user";

export default async function RelatoriosPage() {
  const { supabase, family } = await loadFamilyContext();
  const familyId = family!.id;

  const [{ data: relatorios }, { data: links }] = await Promise.all([
    supabase
      .from("relatorios_gerados")
      .select(
        "id, destinatario, janela_inicio, janela_fim, created_at, membro_atipico_id, membros_atipicos(nome)",
      )
      .eq("family_account_id", familyId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("links_vivos")
      .select(
        "id, destinatario, destinatario_nome, token, expira_em, revogado, acessos, created_at, membros_atipicos(nome)",
      )
      .eq("family_account_id", familyId)
      .eq("revogado", false)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Relatórios</h1>
          <p className="text-sm text-muted-foreground">
            Para terapeuta ou para escola. Os relatórios espelham seus registros
            voluntários — não substituem avaliação profissional.
          </p>
        </div>
        <Link href="/relatorios/novo" className={cn(buttonVariants({ size: "sm" }))}>
          <Plus aria-hidden="true" className="size-4" /> Novo relatório
        </Link>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Relatórios gerados</h2>
        {relatorios && relatorios.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {relatorios.map((r) => {
              const nome = nomeFromRel(r.membros_atipicos);
              return (
                <li key={r.id}>
                  <Link
                    href={`/relatorios/${r.id}`}
                    className="block rounded-md border bg-card px-4 py-3 text-sm hover:bg-muted/50"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {nome ?? "—"} ·{" "}
                          {r.destinatario === "terapeuta" ? "Para terapeuta" : "Para escola"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Janela {r.janela_inicio} → {r.janela_fim}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatRelative(new Date(r.created_at), new Date(), { locale: ptBR })}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nenhum relatório ainda</CardTitle>
              <CardDescription>
                Gere o primeiro escolhendo destinatário e janela temporal.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/relatorios/novo" className={cn(buttonVariants())}>
                Gerar relatório
              </Link>
            </CardContent>
          </Card>
        )}
      </section>

      {links && links.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">Links vivos ativos</h2>
          <ul className="flex flex-col gap-2">
            {links.map((l) => {
              const nome = nomeFromRel(l.membros_atipicos);
              const acessos = Array.isArray(l.acessos) ? l.acessos.length : 0;
              return (
                <li key={l.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium">
                        {nome ?? "—"} → {l.destinatario_nome} ({l.destinatario})
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {l.expira_em
                          ? `Expira em ${new Date(l.expira_em as string).toLocaleDateString("pt-BR")}`
                          : "Sem expiração"}{" "}
                        · {acessos} {acessos === 1 ? "acesso" : "acessos"} registrados
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Ativo</Badge>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function nomeFromRel(rel: unknown): string | null {
  if (!rel) return null;
  if (Array.isArray(rel)) {
    const first = rel[0] as { nome?: string } | undefined;
    return first?.nome ?? null;
  }
  return (rel as { nome?: string }).nome ?? null;
}
