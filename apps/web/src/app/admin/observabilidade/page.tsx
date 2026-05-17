import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
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

const SEVERITY_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  debug: "outline",
  info: "secondary",
  warn: "default",
  error: "destructive",
  fatal: "destructive",
};

const JANELAS = [
  { value: "1h", label: "1h", ms: 60 * 60 * 1000 },
  { value: "24h", label: "24h", ms: 24 * 60 * 60 * 1000 },
  { value: "7d", label: "7d", ms: 7 * 24 * 60 * 60 * 1000 },
  { value: "30d", label: "30d", ms: 30 * 24 * 60 * 60 * 1000 },
] as const;

type Janela = (typeof JANELAS)[number]["value"];

export default async function ObservabilidadePage(props: {
  searchParams: Promise<{ janela?: string; sev?: string; kind?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const sp = await props.searchParams;

  const janela: Janela = (
    JANELAS.find((j) => j.value === sp.janela)?.value ?? "24h"
  );
  const janelaMs = JANELAS.find((j) => j.value === janela)!.ms;
  const desde = new Date(Date.now() - janelaMs).toISOString();
  const sevFiltro = sp.sev?.split(",").filter(Boolean) ?? [];
  const kindFiltro = sp.kind?.trim();

  let q = supabase
    .from("eventos_app")
    .select("id, kind, severity, message, created_at, family_account_id, payload")
    .gte("created_at", desde)
    .order("created_at", { ascending: false })
    .limit(200);
  if (sevFiltro.length > 0) q = q.in("severity", sevFiltro);
  if (kindFiltro) q = q.ilike("kind", `%${kindFiltro}%`);

  const { data: eventos } = await q;

  // Agregados — count por severity na janela
  const { data: agg } = await supabase
    .from("eventos_app")
    .select("severity")
    .gte("created_at", desde);
  const counts = { debug: 0, info: 0, warn: 0, error: 0, fatal: 0 };
  for (const e of agg ?? []) {
    const k = e.severity as keyof typeof counts;
    if (k in counts) counts[k]++;
  }
  const total = (agg ?? []).length;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Observabilidade
        </h1>
        <p className="text-sm text-muted-foreground">
          Erros e eventos críticos. Health: <Link href="/api/health" className="underline">/api/health</Link>.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Janela:</span>
        {JANELAS.map((j) => (
          <Link
            key={j.value}
            href={buildHref({ janela: j.value, sev: sp.sev, kind: sp.kind })}
            className={`rounded-md border px-2 py-0.5 ${
              j.value === janela ? "bg-foreground text-background" : "hover:bg-muted"
            }`}
          >
            {j.label}
          </Link>
        ))}
        <span className="ml-3 text-muted-foreground">Severity:</span>
        {(["info", "warn", "error", "fatal"] as const).map((s) => {
          const ativo = sevFiltro.includes(s);
          const next = ativo
            ? sevFiltro.filter((x) => x !== s)
            : [...sevFiltro, s];
          return (
            <Link
              key={s}
              href={buildHref({
                janela,
                sev: next.join(",") || undefined,
                kind: sp.kind,
              })}
              className={`rounded-md border px-2 py-0.5 ${
                ativo ? "bg-foreground text-background" : "hover:bg-muted"
              }`}
            >
              {s}
            </Link>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Resumo da janela ({janela})
          </CardTitle>
          <CardDescription>
            Total: {total}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
          {(Object.keys(counts) as Array<keyof typeof counts>).map((k) => (
            <div key={k} className="rounded-md border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground capitalize">{k}</p>
              <p className="font-mono text-lg font-semibold">{counts[k]}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Eventos recentes</CardTitle>
          <CardDescription>
            Até 200 eventos. Para investigação profunda, use o SQL Editor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {eventos && eventos.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {eventos.map((e) => {
                const payload = e.payload as Record<string, unknown> | null;
                const stack =
                  payload && typeof payload.stack === "string"
                    ? payload.stack
                    : null;
                return (
                  <li
                    key={e.id}
                    className="rounded-md border bg-card px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            SEVERITY_VARIANT[e.severity] ?? "outline"
                          }
                        >
                          {e.severity}
                        </Badge>
                        <code className="text-xs">{e.kind}</code>
                      </div>
                      <span
                        className="text-xs text-muted-foreground"
                        title={format(new Date(e.created_at), "dd/MM/yyyy HH:mm:ss", {
                          locale: ptBR,
                        })}
                      >
                        {formatDistanceToNow(new Date(e.created_at), {
                          locale: ptBR,
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    {e.message && (
                      <p className="mt-1 break-words text-sm">{e.message}</p>
                    )}
                    {stack && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-muted-foreground">
                          Stack
                        </summary>
                        <pre className="mt-1 overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-xs">
                          {stack}
                        </pre>
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum evento nesta janela. Bom sinal.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function buildHref(params: {
  janela?: string;
  sev?: string;
  kind?: string;
}): string {
  const sp = new URLSearchParams();
  if (params.janela && params.janela !== "24h") sp.set("janela", params.janela);
  if (params.sev) sp.set("sev", params.sev);
  if (params.kind) sp.set("kind", params.kind);
  const qs = sp.toString();
  return qs ? `/admin/observabilidade?${qs}` : "/admin/observabilidade";
}
