import { revalidatePath } from "next/cache";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const metadata = { title: "Uso de API — Admin Kolo" };
export const dynamic = "force-dynamic";

type ProviderKey = "anthropic" | "openai";

const PROVIDERS: Array<{ key: ProviderKey; label: string }> = [
  { key: "anthropic", label: "Anthropic" },
  { key: "openai", label: "OpenAI" },
];

function fmtUSD(v: number): string {
  return v.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtUSDCompact(v: number): string {
  return v.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: v < 1 ? 4 : 2,
    maximumFractionDigits: v < 1 ? 4 : 2,
  });
}

function inicioDoMes(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function diasAtras(d: Date, n: number): Date {
  return new Date(d.getTime() - n * 86400_000);
}

export default async function UsoApiPage() {
  await requireAdmin();
  const admin = createServiceRoleClient();

  const agora = new Date();
  const inicioMes = inicioDoMes(agora);
  const trintaDiasAtras = diasAtras(agora, 30);
  const seteDiasAtras = diasAtras(agora, 7);

  // Carrega tudo em paralelo
  const [
    { data: snapshotsMes },
    { data: snapshots7d },
    { data: budgets },
    { data: callsTrintaDias },
    { count: familiasTotal },
  ] = await Promise.all([
    admin
      .from("api_provider_snapshots")
      .select("provider, date, gasto_usd")
      .gte("date", inicioMes.toISOString().slice(0, 10))
      .order("date", { ascending: false }),
    admin
      .from("api_provider_snapshots")
      .select("provider, date, gasto_usd, fetched_at")
      .gte("date", seteDiasAtras.toISOString().slice(0, 10))
      .order("date", { ascending: false }),
    admin
      .from("api_budgets")
      .select("provider, valor_usd")
      .eq("mes", inicioMes.toISOString().slice(0, 10)),
    admin
      .from("api_calls")
      .select("provider, model, feature, family_account_id, custo_usd, created_at")
      .gte("created_at", trintaDiasAtras.toISOString())
      .order("created_at", { ascending: false })
      .limit(50000),
    admin
      .from("family_accounts")
      .select("id", { count: "exact", head: true }),
  ]);

  // Resumo por provider — gasto MTD + nosso (api_calls MTD) + budget
  const resumoProvider = new Map<
    ProviderKey,
    { gastoProviderMtd: number; gastoNossoMtd: number; budgetMes: number }
  >();
  for (const p of PROVIDERS) {
    resumoProvider.set(p.key, {
      gastoProviderMtd: 0,
      gastoNossoMtd: 0,
      budgetMes: 0,
    });
  }
  for (const s of snapshotsMes ?? []) {
    const r = resumoProvider.get(s.provider as ProviderKey);
    if (r) r.gastoProviderMtd += Number(s.gasto_usd ?? 0);
  }
  for (const b of budgets ?? []) {
    const r = resumoProvider.get(b.provider as ProviderKey);
    if (r) r.budgetMes = Number(b.valor_usd ?? 0);
  }
  for (const c of callsTrintaDias ?? []) {
    if (new Date(c.created_at as string) < inicioMes) continue;
    const r = resumoProvider.get(c.provider as ProviderKey);
    if (r) r.gastoNossoMtd += Number(c.custo_usd ?? 0);
  }

  // Top famílias por gasto (30d) — agregando api_calls + buscando nome
  const porFamilia = new Map<string, { total: number; n: number }>();
  for (const c of callsTrintaDias ?? []) {
    const fid = c.family_account_id as string | null;
    if (!fid) continue;
    const cur = porFamilia.get(fid) ?? { total: 0, n: 0 };
    cur.total += Number(c.custo_usd ?? 0);
    cur.n += 1;
    porFamilia.set(fid, cur);
  }
  const topFamiliasIds = [...porFamilia.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10);

  let nomesPorFamilia = new Map<string, string>();
  if (topFamiliasIds.length > 0) {
    const { data: profs } = await admin
      .from("family_profiles")
      .select("family_account_id, nome_mae, como_chamar")
      .in("family_account_id", topFamiliasIds.map(([id]) => id));
    nomesPorFamilia = new Map(
      (profs ?? []).map((p) => [
        p.family_account_id as string,
        ((p.como_chamar as string | null) ?? (p.nome_mae as string | null) ?? "—").trim(),
      ]),
    );
  }

  // Por feature (30d)
  const porFeature = new Map<string, { total: number; n: number }>();
  for (const c of callsTrintaDias ?? []) {
    const f = (c.feature as string) ?? "—";
    const cur = porFeature.get(f) ?? { total: 0, n: 0 };
    cur.total += Number(c.custo_usd ?? 0);
    cur.n += 1;
    porFeature.set(f, cur);
  }
  const featuresOrdenadas = [...porFeature.entries()].sort((a, b) => b[1].total - a[1].total);
  const maiorFeatureCusto = featuresOrdenadas[0]?.[1].total ?? 0;

  // Custo médio por família (30d)
  const totalGasto30d = [...porFamilia.values()].reduce((s, v) => s + v.total, 0);
  const nFamiliasAtivas = porFamilia.size;
  const mediaPorFamilia = nFamiliasAtivas > 0 ? totalGasto30d / nFamiliasAtivas : 0;

  // Validação cruzada — provider snapshot vs nossa soma (últimos 7 dias)
  const nossoPorDiaProvider = new Map<string, number>();
  for (const c of callsTrintaDias ?? []) {
    if (new Date(c.created_at as string) < seteDiasAtras) continue;
    const data = (c.created_at as string).slice(0, 10);
    const k = `${c.provider}:${data}`;
    nossoPorDiaProvider.set(k, (nossoPorDiaProvider.get(k) ?? 0) + Number(c.custo_usd ?? 0));
  }
  const linhasValidacao = (snapshots7d ?? []).map((s) => {
    const k = `${s.provider}:${s.date}`;
    const nosso = nossoPorDiaProvider.get(k) ?? 0;
    const provider = Number(s.gasto_usd ?? 0);
    const delta = provider === 0 ? 0 : ((nosso - provider) / provider) * 100;
    return {
      provider: s.provider as ProviderKey,
      date: s.date as string,
      provider_usd: provider,
      nosso_usd: nosso,
      delta_pct: delta,
    };
  });

  return (
    <div className="flex flex-col gap-8">
      <header>
        <Eyebrow>Console operacional</Eyebrow>
        <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
          Uso de <em className="not-italic text-brand-purple">API</em>
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Gasto mensal por provider, custo médio por família e validação cruzada
          entre o snapshot do provider e nossa instrumentação.
        </p>
      </header>

      {/* Cards de saldo por provider */}
      <section className="grid gap-4 md:grid-cols-2">
        {PROVIDERS.map((p) => {
          const r = resumoProvider.get(p.key)!;
          const restante = Math.max(0, r.budgetMes - r.gastoProviderMtd);
          const pct = r.budgetMes > 0 ? Math.min(100, (r.gastoProviderMtd / r.budgetMes) * 100) : 0;
          const sinalBudget = r.budgetMes === 0;
          return (
            <Card key={p.key} className="rounded-3xl">
              <CardHeader>
                <CardTitle className="text-base">{p.label}</CardTitle>
                <CardDescription>
                  Mês corrente · gasto reportado pelo provider
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="font-heading text-3xl text-foreground">
                  {fmtUSD(r.gastoProviderMtd)}
                </div>
                <div className="text-sm text-muted-foreground">
                  Nossa soma (api_calls): {fmtUSD(r.gastoNossoMtd)}
                </div>
                {sinalBudget ? (
                  <p className="text-xs text-muted-foreground">
                    Sem orçamento mensal cadastrado — use o formulário abaixo.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    <div className="h-2 overflow-hidden rounded-full bg-secondary/60">
                      <div
                        className="h-full rounded-full bg-brand-purple"
                        style={{ width: `${pct}%` }}
                        aria-hidden
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Orçamento {fmtUSD(r.budgetMes)} · restam {fmtUSD(restante)} ({(100 - pct).toFixed(0)}%)
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </section>

      {/* Custo médio por família */}
      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="text-base">Custo médio por família — últimos 30 dias</CardTitle>
          <CardDescription>
            {nFamiliasAtivas} famílias ativas no período · {familiasTotal ?? 0} totais cadastradas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="font-heading text-3xl text-foreground">{fmtUSDCompact(mediaPorFamilia)}</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Total gasto 30d: {fmtUSD(totalGasto30d)} ÷ {nFamiliasAtivas || 1} famílias ativas
          </p>
        </CardContent>
      </Card>

      {/* Top famílias */}
      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="text-base">Top 10 famílias por gasto (30d)</CardTitle>
        </CardHeader>
        <CardContent>
          {topFamiliasIds.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem chamadas registradas no período.</p>
          ) : (
            <ul className="divide-y divide-kolo-linha">
              {topFamiliasIds.map(([fid, v]) => (
                <li key={fid} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="truncate">
                    {nomesPorFamilia.get(fid) ?? <span className="text-muted-foreground">família {fid.slice(0, 8)}</span>}
                  </span>
                  <span className="ml-3 shrink-0 tabular-nums text-muted-foreground">
                    {fmtUSDCompact(v.total)} · {v.n} chamadas
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Por feature */}
      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="text-base">Gasto por feature (30d)</CardTitle>
        </CardHeader>
        <CardContent>
          {featuresOrdenadas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem chamadas registradas no período.</p>
          ) : (
            <ul className="space-y-2.5">
              {featuresOrdenadas.map(([feature, v]) => {
                const pct = maiorFeatureCusto > 0 ? (v.total / maiorFeatureCusto) * 100 : 0;
                return (
                  <li key={feature} className="text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs">{feature}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {fmtUSDCompact(v.total)} · {v.n}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary/60">
                      <div
                        className="h-full rounded-full bg-brand-purple/70"
                        style={{ width: `${pct}%` }}
                        aria-hidden
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Validação cruzada */}
      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="text-base">
            Validação cruzada — snapshot do provider vs nossa soma (7d)
          </CardTitle>
          <CardDescription>
            Δ próximo de zero significa instrumentação cobrindo bem. Divergência grande sinaliza call site não-logado ou preço desatualizado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {linhasValidacao.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sem snapshots disponíveis. Configure ANTHROPIC_ADMIN_API_KEY / OPENAI_ADMIN_API_KEY no Vercel pra ativar o cron diário.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-kolo-linha text-left text-xs uppercase tracking-[0.1em] text-muted-foreground">
                  <th className="py-2 font-semibold">Provider</th>
                  <th className="py-2 font-semibold">Data</th>
                  <th className="py-2 text-right font-semibold">Provider</th>
                  <th className="py-2 text-right font-semibold">Nossa soma</th>
                  <th className="py-2 text-right font-semibold">Δ</th>
                </tr>
              </thead>
              <tbody>
                {linhasValidacao.map((l) => {
                  const ok = Math.abs(l.delta_pct) < 5;
                  return (
                    <tr key={`${l.provider}-${l.date}`} className="border-b border-kolo-linha/40">
                      <td className="py-2 capitalize">{l.provider}</td>
                      <td className="py-2 text-muted-foreground">{l.date}</td>
                      <td className="py-2 text-right tabular-nums">{fmtUSDCompact(l.provider_usd)}</td>
                      <td className="py-2 text-right tabular-nums">{fmtUSDCompact(l.nosso_usd)}</td>
                      <td className="py-2 text-right tabular-nums">
                        <Badge variant={ok ? "secondary" : "destructive"}>
                          {l.delta_pct > 0 ? "+" : ""}
                          {l.delta_pct.toFixed(1)}%
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Form de orçamento */}
      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="text-base">Orçamento mensal</CardTitle>
          <CardDescription>
            Define o teto pra cálculo de "saldo restante". Aplica no mês corrente ({inicioMes.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={salvarBudget} className="grid gap-4 md:grid-cols-3">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Provider</span>
              <select
                name="provider"
                className="rounded-md border border-kolo-linha bg-white px-3 py-2"
                required
              >
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Valor (USD)</span>
              <input
                name="valor_usd"
                type="number"
                step="0.01"
                min="0"
                placeholder="200.00"
                className="rounded-md border border-kolo-linha bg-white px-3 py-2"
                required
              />
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                className="rounded-md bg-brand-purple px-4 py-2 text-sm font-semibold text-white hover:bg-brand-purple-dark"
              >
                Salvar orçamento
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

async function salvarBudget(formData: FormData) {
  "use server";
  await requireAdmin();
  const admin = createServiceRoleClient();

  const provider = String(formData.get("provider") ?? "");
  const valor = Number(formData.get("valor_usd") ?? 0);
  if (!["anthropic", "openai"].includes(provider)) return;
  if (!Number.isFinite(valor) || valor < 0) return;

  const mes = inicioDoMes(new Date()).toISOString().slice(0, 10);
  await admin.from("api_budgets").upsert(
    { provider, mes, valor_usd: valor },
    { onConflict: "provider,mes" },
  );
  revalidatePath("/admin/uso-api");
}
