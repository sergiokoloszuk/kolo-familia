import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function AdminBetaPage() {
  const { supabase } = await requireAdmin();

  const agora = Date.now();
  const um_dia = 24 * 60 * 60 * 1000;
  const desde7d = new Date(agora - 7 * um_dia).toISOString();
  const desde30d = new Date(agora - 30 * um_dia).toISOString();

  const [
    { count: totalContas },
    { count: contas7d },
    { count: ativas7d },
    { count: ativas30d },
    { count: totalConvites },
    { count: convitesUsados },
    { data: ultimosFeedback },
    { data: feedbackAgg },
  ] = await Promise.all([
    supabase
      .from("family_accounts")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("family_accounts")
      .select("id", { count: "exact", head: true })
      .gte("created_at", desde7d),
    // "Ativa nos últimos 7 dias" = teve algum diário
    supabase
      .from("diarios")
      .select("family_account_id", { count: "exact", head: true })
      .gte("data", desde7d.slice(0, 10)),
    supabase
      .from("diarios")
      .select("family_account_id", { count: "exact", head: true })
      .gte("data", desde30d.slice(0, 10)),
    supabase
      .from("beta_invites")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("beta_invite_uses")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("feedback_beta")
      .select("id, nps, comentario, contexto, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("feedback_beta").select("nps").gte("created_at", desde30d),
  ]);

  const npsList = (feedbackAgg ?? []).map((f) => f.nps as number);
  const npsTotal = npsList.length;
  const promotores = npsList.filter((n) => n >= 9).length;
  const detratores = npsList.filter((n) => n <= 6).length;
  const npsScore =
    npsTotal > 0
      ? Math.round(((promotores - detratores) / npsTotal) * 100)
      : null;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Beta
        </h1>
        <p className="text-sm text-muted-foreground">
          Aderência, retenção e NPS in-app das famílias do beta. Hoje:{" "}
          {format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Famílias</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Estat label="Contas totais" value={totalContas ?? 0} />
          <Estat label="Novas em 7d" value={contas7d ?? 0} />
          <Estat label="Ativas 7d (diário)" value={ativas7d ?? 0} />
          <Estat label="Ativas 30d (diário)" value={ativas30d ?? 0} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Convites</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <Estat label="Convites criados" value={totalConvites ?? 0} />
          <Estat label="Convites usados" value={convitesUsados ?? 0} />
          <Estat
            label="Conversão"
            value={
              totalConvites && totalConvites > 0
                ? `${Math.round(((convitesUsados ?? 0) / totalConvites) * 100)}%`
                : "—"
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">NPS in-app (30 dias)</CardTitle>
          <CardDescription>
            Promotores 9-10, Detratores 0-6. NPS = % promotores − % detratores.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Estat label="Total respostas" value={npsTotal} />
          <Estat label="Promotores" value={promotores} />
          <Estat label="Detratores" value={detratores} />
          <Estat
            label="NPS"
            value={npsScore == null ? "—" : npsScore.toString()}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimos feedbacks</CardTitle>
        </CardHeader>
        <CardContent>
          {(ultimosFeedback?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sem feedback ainda.
            </p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {(ultimosFeedback ?? []).map((f) => (
                <li
                  key={f.id}
                  className="rounded-md border bg-card px-3 py-2"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                          (f.nps as number) >= 9
                            ? "bg-emerald-100 text-emerald-900"
                            : (f.nps as number) <= 6
                              ? "bg-rose-100 text-rose-900"
                              : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        {f.nps}
                      </span>
                      {f.contexto && (
                        <code className="text-xs text-muted-foreground">
                          {f.contexto}
                        </code>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(f.created_at), {
                        locale: ptBR,
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  {f.comentario && (
                    <p className="mt-1 break-words text-sm">{f.comentario}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Estat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-mono text-lg font-semibold">{value}</p>
    </div>
  );
}
