import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { capitalizarNome } from "@/lib/nome";
import { coletarCandidatosSnapshot } from "@/lib/evolucao/snapshot-backfill";
import { SnapshotsClient } from "./snapshots-client";

function nomeFromRel(rel: unknown): string | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return (rel[0] as { nome?: string } | undefined)?.nome ?? null;
  return (rel as { nome?: string }).nome ?? null;
}

function mesLabel(periodo: string): string {
  return format(new Date(`${periodo}T12:00:00`), "MMMM 'de' yyyy", { locale: ptBR });
}

export default async function AdminSnapshotsPage() {
  await requireAdmin();
  const admin = createServiceRoleClient();

  const [{ count: totalSnaps }, { data: recentes }, candidatos] = await Promise.all([
    admin.from("evolucao_snapshots").select("id", { count: "exact", head: true }),
    admin
      .from("evolucao_snapshots")
      .select("id, periodo, resumo, sinais, areas, membros_atipicos(nome)")
      .order("periodo", { ascending: false })
      .limit(8),
    coletarCandidatosSnapshot(admin),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Fotos mensais (máquina do tempo)
        </h1>
        <p className="text-sm text-muted-foreground">
          Cada foto resume como a pessoa esteve no mês, por área — pra a Evolução longa e o
          relatório narrarem o arco (&ldquo;há um ano… hoje&rdquo;). O cron mensal
          (<code>?tipo=snapshots</code>) tira a foto do mês anterior; aqui você gera as fotos{" "}
          <strong>retroativas</strong> dos meses que já passaram. Lotes de 6, IA leve, idempotente.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Backfill retroativo</CardTitle>
          <CardDescription>
            {totalSnaps ?? 0} foto(s) já no banco · {candidatos.length} mês(es) pendente(s).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SnapshotsClient restantesInicial={candidatos.length} />
        </CardContent>
      </Card>

      {(recentes ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimas fotos</CardTitle>
            <CardDescription>Prévia do que a IA escreveu.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {(recentes ?? []).map((s) => {
              const nome = nomeFromRel(s.membros_atipicos);
              const sinais = (s.sinais as Record<string, unknown> | null) ?? {};
              const areas = (s.areas as Record<string, unknown> | null) ?? {};
              return (
                <div
                  key={s.id as string}
                  className="rounded-xl border border-foreground/[0.08] bg-white p-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-heading text-base font-medium text-foreground">
                      {nome ? capitalizarNome(nome) : "—"} · {mesLabel(s.periodo as string)}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {Object.keys(areas).length} área(s)
                      {sinais.humor_label ? ` · humor: ${String(sinais.humor_label)}` : ""}
                      {sinais.perfil_pct != null ? ` · Perfil ${String(sinais.perfil_pct)}%` : ""}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {(s.resumo as string | null) ?? "(sem frase — só contagens)"}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
