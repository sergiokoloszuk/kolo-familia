import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/server";

const COMISSAO_LABEL: Record<string, string> = {
  pct_primeira_mensalidade: "% da 1ª mensalidade",
  pct_recorrente: "% recorrente",
  valor_fixo: "valor fixo",
  nenhuma: "sem comissão",
};

function contar(rows: { afiliado_id: string | null }[] | null) {
  const m = new Map<string, number>();
  for (const r of rows ?? []) {
    if (!r.afiliado_id) continue;
    m.set(r.afiliado_id, (m.get(r.afiliado_id) ?? 0) + 1);
  }
  return m;
}

export default async function AfiliadosPage() {
  const { supabase } = await requireAdmin();

  const { data: afiliados } = await supabase
    .from("afiliados")
    .select("id, nome, email, codigo_unico, ativo, comissao_tipo, comissao_valor")
    .order("created_at", { ascending: false });

  // Métricas via service-role: family_accounts é self-RLS (admin não veria
  // famílias de terceiros pela própria sessão).
  const admin = createServiceRoleClient();
  const [{ data: cliques }, { data: cadastros }] = await Promise.all([
    admin.from("afiliado_cliques").select("afiliado_id"),
    admin.from("family_accounts").select("afiliado_id").not("afiliado_id", "is", null),
  ]);
  const cliquesPor = contar(cliques as { afiliado_id: string | null }[] | null);
  const cadastrosPor = contar(cadastros as { afiliado_id: string | null }[] | null);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Afiliados</h1>
          <p className="text-sm text-muted-foreground">
            Parceiros que divulgam o Kolo. Cada um tem um link rastreável e regras
            de comissão/desconto próprias. (Comissão paga = Fase 2, com Stripe.)
          </p>
        </div>
        <Link
          href="/admin/afiliados/novo"
          className="rounded-full bg-brand-yellow px-4 py-2 text-sm font-semibold text-brand-purple-dark"
        >
          Novo afiliado
        </Link>
      </header>

      {(afiliados?.length ?? 0) === 0 ? (
        <p className="rounded-xl border bg-white p-6 text-sm text-muted-foreground">
          Nenhum afiliado ainda. Crie o primeiro pra gerar o link de divulgação.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {(afiliados ?? []).map((a) => (
            <li key={a.id as string}>
              <Link
                href={`/admin/afiliados/${a.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3 hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {a.nome as string}{" "}
                    {!a.ativo && (
                      <span className="ml-1 rounded bg-muted px-1.5 text-xs text-muted-foreground">
                        inativo
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <code>/i/{a.codigo_unico as string}</code> ·{" "}
                    {a.comissao_tipo === "nenhuma"
                      ? "sem comissão"
                      : `${a.comissao_valor}${a.comissao_tipo === "valor_fixo" ? " R$" : "%"} ${COMISSAO_LABEL[a.comissao_tipo as string]}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-4 text-center text-xs">
                  <div>
                    <p className="text-base font-semibold">{cliquesPor.get(a.id as string) ?? 0}</p>
                    <p className="text-muted-foreground">cliques</p>
                  </div>
                  <div>
                    <p className="text-base font-semibold">{cadastrosPor.get(a.id as string) ?? 0}</p>
                    <p className="text-muted-foreground">cadastros</p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
