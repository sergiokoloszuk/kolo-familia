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
import { isBetaGateAtivo } from "@/lib/beta/codigos";
import { CriarConvitesForm } from "./criar-form";
import { ConviteAcoes } from "./linha-acoes";

export default async function AdminConvitesPage() {
  const { supabase } = await requireAdmin();
  const gateAtivo = isBetaGateAtivo();

  const { data: convites } = await supabase
    .from("beta_invites")
    .select(
      "id, codigo, rotulo, max_uses, uses_count, expira_em, revogado, created_at, notas",
    )
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Convites Beta
        </h1>
        <p className="text-sm text-muted-foreground">
          Gera códigos de convite. Gate de signup atualmente:{" "}
          <strong>{gateAtivo ? "ATIVO" : "DESATIVADO"}</strong>{" "}
          (controlado pela env <code>BETA_GATE_ENABLED</code>).
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gerar códigos</CardTitle>
          <CardDescription>
            Códigos têm 8 caracteres (sem 0/O/1/I/L pra evitar confusão).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CriarConvitesForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico</CardTitle>
          <CardDescription>
            {convites?.length ?? 0} convite(s).{" "}
            {(convites ?? []).filter((c) => !c.revogado && c.uses_count < c.max_uses)
              .length}{" "}
            disponível(is) agora.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(convites?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum convite criado ainda.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {(convites ?? []).map((c) => {
                const lotado = (c.uses_count as number) >= (c.max_uses as number);
                const expirou =
                  c.expira_em &&
                  new Date(c.expira_em as string) < new Date();
                const status = c.revogado
                  ? "revogado"
                  : expirou
                    ? "expirado"
                    : lotado
                      ? "esgotado"
                      : "ativo";
                return (
                  <li
                    key={c.id}
                    className="flex flex-col gap-1.5 rounded-md border bg-card px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-base font-semibold">
                          {c.codigo}
                        </code>
                        <Badge
                          variant={
                            status === "ativo"
                              ? "default"
                              : status === "esgotado"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {status}
                        </Badge>
                      </div>
                      <ConviteAcoes
                        id={c.id as string}
                        revogado={c.revogado as boolean}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {c.uses_count} de {c.max_uses} usos
                      {c.rotulo && ` · ${c.rotulo}`}
                      {" · criado "}
                      {formatDistanceToNow(new Date(c.created_at), {
                        locale: ptBR,
                        addSuffix: true,
                      })}
                      {c.expira_em &&
                        ` · expira em ${format(new Date(c.expira_em as string), "dd/MM/yyyy", { locale: ptBR })}`}
                    </p>
                    {c.notas && (
                      <p className="text-xs text-muted-foreground">
                        {c.notas}
                      </p>
                    )}
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
