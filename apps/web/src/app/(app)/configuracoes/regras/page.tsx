import Link from "next/link";
import { ChevronLeft } from "lucide-react";
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
import { loadFamilyContext } from "@/lib/auth/require-user";
import {
  AlertaAcoes,
  AdaptacaoAcoes,
  DessilenciarRegraButton,
} from "./alertas-actions";

const SEVERIDADE_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  info: "secondary",
  warn: "default",
  high: "destructive",
};

const ESTADO_LABEL: Record<string, string> = {
  pendente: "Aguardando você",
  aplicada: "Aplicada",
  descartada: "Descartada",
  revertida: "Revertida",
};

export default async function ConfiguracoesRegrasPage() {
  const { supabase, family } = await loadFamilyContext();
  const familyId = family!.id;

  const [
    { data: definicoes },
    { data: alertasOpen },
    { data: alertasResolvidos },
    { data: adaptacoes },
    { data: overrides },
  ] = await Promise.all([
    supabase
      .from("regras_definicoes")
      .select("key, display_name, descricao, categoria, severidade_default, ativa")
      .eq("ativa", true),
    supabase
      .from("alertas")
      .select(
        "id, regra_key, severidade, mensagem, contexto, first_disparo_em, snoozed_ate, estado",
      )
      .eq("family_account_id", familyId)
      .in("estado", ["open", "snoozed"])
      .order("first_disparo_em", { ascending: false }),
    supabase
      .from("alertas")
      .select(
        "id, regra_key, severidade, mensagem, first_disparo_em, resolvido_em, estado",
      )
      .eq("family_account_id", familyId)
      .in("estado", ["resolvido", "descartado"])
      .order("resolvido_em", { ascending: false })
      .limit(20),
    supabase
      .from("adaptacoes_sugeridas")
      .select(
        "id, tipo, titulo, descricao, estado, created_at, aplicada_em, payload_proposto",
      )
      .eq("family_account_id", familyId)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("regras_overrides")
      .select("regra_key, silenciada_ate, motivo, created_at")
      .eq("family_account_id", familyId),
  ]);

  const definicoesMap = new Map(
    (definicoes ?? []).map((d) => [d.key as string, d]),
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link
          href="/configuracoes"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft aria-hidden="true" className="size-3" />
          Configurações
        </Link>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Alertas e adaptações
        </h1>
        <p className="text-sm text-muted-foreground">
          Padrões automaticamente identificados nos seus registros. Hipóteses,
          não diagnósticos. Você decide o que fazer.
        </p>
      </header>

      {/* ATIVOS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alertas ativos</CardTitle>
          <CardDescription>
            {(alertasOpen?.length ?? 0) === 0
              ? "Nenhum alerta no momento. Sigamos."
              : `${alertasOpen!.length} alerta(s) precisando de atenção.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {(alertasOpen ?? []).map((a) => {
            const def = definicoesMap.get(a.regra_key as string);
            return (
              <div
                key={a.id}
                className="rounded-md border bg-card p-3 text-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={SEVERIDADE_VARIANT[a.severidade] ?? "outline"}
                    >
                      {a.severidade}
                    </Badge>
                    <span className="font-medium">
                      {def?.display_name ?? a.regra_key}
                    </span>
                  </div>
                  <span
                    className="text-xs text-muted-foreground"
                    title={format(
                      new Date(a.first_disparo_em),
                      "dd/MM/yyyy HH:mm",
                      { locale: ptBR },
                    )}
                  >
                    {formatDistanceToNow(new Date(a.first_disparo_em), {
                      locale: ptBR,
                      addSuffix: true,
                    })}
                  </span>
                </div>
                <p className="mt-2 text-sm">{a.mensagem}</p>
                {a.estado === "snoozed" && a.snoozed_ate && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Adiado até {format(new Date(a.snoozed_ate), "dd/MM HH:mm", { locale: ptBR })}.
                  </p>
                )}
                <div className="mt-3">
                  <AlertaAcoes
                    alertaId={a.id as string}
                    regraKey={a.regra_key as string}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ADAPTAÇÕES */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adaptações sugeridas</CardTitle>
          <CardDescription>
            Mudanças concretas que faço no seu Kolo Vivo ou nas mensagens do
            WhatsApp quando você aceitar. Tudo é reversível.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {(adaptacoes?.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">
              Sem sugestões ainda.
            </p>
          )}
          {(adaptacoes ?? []).map((ad) => {
            const proposto = ad.payload_proposto as Record<string, unknown>;
            return (
              <div
                key={ad.id}
                className="rounded-md border bg-card p-3 text-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{ad.titulo}</span>
                  <Badge variant="outline">
                    {ESTADO_LABEL[ad.estado] ?? ad.estado}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {ad.descricao}
                </p>
                {proposto.valor && (
                  <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-xs">
                    {String(proposto.valor)}
                  </pre>
                )}
                {ad.aplicada_em && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Aplicada{" "}
                    {formatDistanceToNow(new Date(ad.aplicada_em), {
                      locale: ptBR,
                      addSuffix: true,
                    })}
                  </p>
                )}
                <div className="mt-2">
                  <AdaptacaoAcoes
                    adaptacaoId={ad.id as string}
                    estado={ad.estado as "pendente"}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* SILENCIADAS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tipos silenciados</CardTitle>
          <CardDescription>
            Regras que você desativou. Pode reativar a qualquer momento.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {(overrides?.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhuma regra silenciada.
            </p>
          )}
          {(overrides ?? []).map((o) => {
            const def = definicoesMap.get(o.regra_key as string);
            return (
              <div
                key={o.regra_key as string}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {def?.display_name ?? o.regra_key}
                  </p>
                  {o.motivo && (
                    <p className="text-xs text-muted-foreground">{o.motivo}</p>
                  )}
                </div>
                <DessilenciarRegraButton regraKey={o.regra_key as string} />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* HISTÓRICO */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de alertas</CardTitle>
          <CardDescription>Resolvidos ou descartados recentemente.</CardDescription>
        </CardHeader>
        <CardContent>
          {(alertasResolvidos?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nada no histórico ainda.
            </p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {(alertasResolvidos ?? []).map((a) => {
                const def = definicoesMap.get(a.regra_key as string);
                return (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2"
                  >
                    <span>
                      <strong>{def?.display_name ?? a.regra_key}</strong> ·{" "}
                      <span className="text-muted-foreground">
                        {a.estado === "resolvido" ? "resolvido" : "descartado"}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {a.resolvido_em &&
                        formatDistanceToNow(new Date(a.resolvido_em), {
                          locale: ptBR,
                          addSuffix: true,
                        })}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
