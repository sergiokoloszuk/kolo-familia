import { formatRelative } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth/require-admin";
import { computeKPIs } from "@/lib/ayla/metrics";
import { AdminNav } from "../nav";

export default async function AdminAylaPage() {
  const { supabase } = await requireAdmin();

  const [kpis, ultimosLogs, ultimosInsights] = await Promise.all([
    computeKPIs(supabase, 30),
    supabase
      .from("ayla_send_log")
      .select("id, template_key, status, erro, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("ayla_insights")
      .select("id, padrao, mensagem_proposta, enviado, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <AdminNav />
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Ayla</h1>
        <p className="text-sm text-muted-foreground">
          KPIs próprios da Ayla nos últimos {kpis.janelaDias} dias.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Stat
          label="Taxa de resposta"
          value={`${Math.round(kpis.taxaRespostaDiaria * 100)}%`}
          alvo="≥ 50%"
          ok={kpis.taxaRespostaDiaria >= 0.5}
        />
        <Stat
          label="Tempo mediano de resposta"
          value={
            kpis.tempoMedianoRespostaMinutos != null
              ? formatMinutos(kpis.tempoMedianoRespostaMinutos)
              : "—"
          }
          alvo="≤ 4h"
          ok={
            kpis.tempoMedianoRespostaMinutos == null
              ? true
              : kpis.tempoMedianoRespostaMinutos <= 240
          }
        />
        <Stat
          label="Streak médio"
          value={`${kpis.streakMedio} dia${kpis.streakMedio === 1 ? "" : "s"}`}
          alvo="≥ 5 dias"
          ok={kpis.streakMedio >= 5}
        />
        <Stat
          label="Famílias ativas (7d)"
          value={String(kpis.familiasAtivasSemanais)}
          alvo="≥ 70%"
          ok={null}
        />
        <Stat
          label="Conversão Ayla → Diário"
          value={`${Math.round(kpis.conversaoChecksinDiario * 100)}%`}
          alvo="≥ 90%"
          ok={kpis.conversaoChecksinDiario >= 0.9}
        />
        <Stat
          label="Conversão sugestão aprovada"
          value={`${Math.round(kpis.conversaoSugestaoAprovada * 100)}%`}
          alvo="≥ 40%"
          ok={kpis.conversaoSugestaoAprovada >= 0.4}
        />
        <Stat
          label="Pausa/desativação"
          value={`${Math.round(kpis.taxaPausasOuDesativacoes * 100)}%`}
          alvo="≤ 5%"
          ok={kpis.taxaPausasOuDesativacoes <= 0.05}
        />
        <Stat
          label="Proativas enviadas"
          value={String(kpis.totalProativasEnviadas)}
          alvo=""
          ok={null}
        />
        <Stat
          label="Reativas enviadas"
          value={String(kpis.totalReativasEnviadas)}
          alvo=""
          ok={null}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimos envios</CardTitle>
            <CardDescription>Auditoria do ayla_send_log.</CardDescription>
          </CardHeader>
          <CardContent>
            {ultimosLogs.data && ultimosLogs.data.length > 0 ? (
              <ul className="flex flex-col gap-1.5 text-sm">
                {ultimosLogs.data.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-2">
                    <span>
                      <code className="text-xs text-muted-foreground">{l.template_key}</code>
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge
                        variant={
                          l.status === "enviada"
                            ? "default"
                            : l.status === "falha"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {l.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatRelative(new Date(l.created_at), new Date(), { locale: ptBR })}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nada por aqui ainda.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimos insights detectados</CardTitle>
            <CardDescription>Padrões disparados pelo cron de insights.</CardDescription>
          </CardHeader>
          <CardContent>
            {ultimosInsights.data && ultimosInsights.data.length > 0 ? (
              <ul className="flex flex-col gap-2 text-sm">
                {ultimosInsights.data.map((i) => (
                  <li key={i.id}>
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-xs">{i.padrao}</code>
                      <Badge variant={i.enviado ? "default" : "outline"}>
                        {i.enviado ? "enviado" : "pendente"}
                      </Badge>
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {i.mensagem_proposta}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum padrão detectado ainda.</p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  alvo,
  ok,
}: {
  label: string;
  value: string;
  alvo: string;
  ok: boolean | null;
}) {
  const tone =
    ok === true ? "text-primary" : ok === false ? "text-destructive" : "text-foreground";
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className={`text-2xl ${tone}`}>{value}</CardTitle>
      </CardHeader>
      {alvo && (
        <CardContent>
          <p className="text-xs text-muted-foreground">Alvo: {alvo}</p>
        </CardContent>
      )}
    </Card>
  );
}

function formatMinutos(min: number): string {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}
