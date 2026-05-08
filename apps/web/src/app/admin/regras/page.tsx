import { format } from "date-fns";
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
import { RegraRow } from "./regra-row";

const CATEGORIA_LABEL: Record<string, string> = {
  emocional: "Emocional",
  engajamento: "Engajamento",
  padrao: "Padrão",
  clinico: "Clínico",
};

const SEVERIDADE_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  info: "secondary",
  warn: "default",
  high: "destructive",
};

export default async function AdminRegrasPage() {
  const { supabase } = await requireAdmin();

  const [
    { data: definicoes },
    { data: alertasAbertos },
    { data: ultEventos },
  ] = await Promise.all([
    supabase
      .from("regras_definicoes")
      .select(
        "key, display_name, descricao, categoria, severidade_default, cooldown_dias, ativa, parametros, versao, updated_at",
      )
      .order("categoria", { ascending: true })
      .order("display_name", { ascending: true }),
    supabase
      .from("alertas")
      .select("regra_key, severidade")
      .eq("estado", "open"),
    supabase
      .from("regras_eventos_log")
      .select("acao, regra_key, created_at, family_account_id")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const counts = new Map<string, number>();
  for (const a of alertasAbertos ?? []) {
    counts.set(
      a.regra_key as string,
      (counts.get(a.regra_key as string) ?? 0) + 1,
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminNav />
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Regras
        </h1>
        <p className="text-sm text-muted-foreground">
          Catálogo de regras do engine. Ative/desative ou ajuste cooldown e
          severidade. As condições estão em <code>lib/regras/registry.ts</code>{" "}
          (ed.).
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Catálogo</CardTitle>
          <CardDescription>
            {definicoes?.length ?? 0} regras ·{" "}
            {alertasAbertos?.length ?? 0} alertas open neste momento
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {(definicoes ?? []).map((d) => {
            const ativos = counts.get(d.key as string) ?? 0;
            return (
              <div
                key={d.key as string}
                className="flex flex-col gap-2 rounded-md border bg-muted/20 p-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {CATEGORIA_LABEL[d.categoria] ?? d.categoria}
                    </Badge>
                    <span className="font-medium">{d.display_name}</span>
                    <Badge
                      variant={SEVERIDADE_VARIANT[d.severidade_default] ?? "outline"}
                    >
                      {d.severidade_default}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    v{d.versao} · {ativos} alerta(s) ativo(s)
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{d.descricao}</p>
                <RegraRow
                  regraKey={d.key as string}
                  ativa={d.ativa as boolean}
                  cooldownDias={d.cooldown_dias as number}
                  severidade={
                    d.severidade_default as "info" | "warn" | "high"
                  }
                />
                {d.parametros &&
                  Object.keys(d.parametros as Record<string, unknown>).length >
                    0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground">
                        Parâmetros
                      </summary>
                      <pre className="mt-1 whitespace-pre-wrap rounded-md bg-muted/50 p-2">
                        {JSON.stringify(d.parametros, null, 2)}
                      </pre>
                    </details>
                  )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Atividade recente</CardTitle>
          <CardDescription>
            Últimos 30 eventos de qualquer família. Para histórico completo, use
            SQL Editor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-1.5 text-sm">
            {(ultEventos ?? []).map((e, i) => (
              <li
                key={i}
                className="flex items-baseline justify-between gap-2 rounded-md border bg-muted/20 px-3 py-1.5"
              >
                <span>
                  <code className="text-xs">{e.acao}</code>{" "}
                  {e.regra_key && (
                    <span className="text-muted-foreground">
                      · {e.regra_key}
                    </span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(e.created_at), "dd/MM HH:mm", { locale: ptBR })}
                </span>
              </li>
            ))}
            {(ultEventos?.length ?? 0) === 0 && (
              <li className="text-sm text-muted-foreground">
                Sem eventos ainda.
              </li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
