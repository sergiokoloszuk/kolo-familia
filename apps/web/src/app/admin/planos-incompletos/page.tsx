import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { listarPlanosAmputados } from "./deteccao";
import { RefazerClient } from "./refazer-client";

export const dynamic = "force-dynamic";

export default async function AdminPlanosIncompletosPage() {
  await requireAdmin();
  const admin = createServiceRoleClient();
  const pendentes = await listarPlanosAmputados(admin);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Planos sem as práticas
        </h1>
        <p className="text-sm text-muted-foreground">
          Planos que foram salvos só com &ldquo;entender/observar&rdquo; — diagnóstico sem
          nenhum <strong>o que fazer</strong> — porque as seções práticas falhavam em silêncio.
          O gerador já não deixa mais isso ser salvo; aqui você refaz os que ficaram para trás.
          Refazer não piora nada: se o plano novo vier incompleto, o antigo continua como está.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pendentes</CardTitle>
          <CardDescription>
            Sem a seção &ldquo;o que fazer diferente&rdquo; ou com menos de 3 seções práticas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RefazerClient restantesInicial={pendentes.length} />
        </CardContent>
      </Card>

      {pendentes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quais são</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {pendentes.slice(0, 40).map((p) => (
              <div key={p.id} className="flex flex-wrap items-baseline gap-x-3 text-sm">
                <span className="text-muted-foreground tabular-nums">
                  {new Date(p.created_at).toLocaleDateString("pt-BR")}
                </span>
                <span>{p.titulo || p.tema || "sem título"}</span>
                <span className="text-xs text-muted-foreground">
                  {p.tipos.length > 0 ? p.tipos.join(" · ") : "vazio"}
                </span>
              </div>
            ))}
            {pendentes.length > 40 && (
              <p className="text-xs text-muted-foreground">
                …e mais {pendentes.length - 40}.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
