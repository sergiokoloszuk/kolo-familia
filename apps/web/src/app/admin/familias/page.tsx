import { differenceInCalendarDays } from "date-fns";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { capitalizarNome } from "@/lib/nome";
import { assinaturaLiberada } from "@/lib/auth/assinatura";

/**
 * Famílias / Leads — lista única com origem, momento do trial, e se assinou.
 * Junta family_accounts + subscription_accesses + perfil + atribuição (afiliado/
 * convite) + e-mail (auth). Admin-only.
 */
export const dynamic = "force-dynamic";

const TRIAL_DIAS = 7;

const STATUS_LABEL: Record<string, string> = {
  trialing: "Em trial",
  active: "Assinante",
  past_due: "Pagamento pendente",
  paused: "Pausada",
  canceled: "Cancelada",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  trialing: "outline",
  active: "default",
  past_due: "destructive",
  paused: "secondary",
  canceled: "secondary",
};

function fmtData(d: string | null): string {
  return d
    ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" })
    : "—";
}

export default async function AdminFamiliasPage() {
  await requireAdmin();
  const admin = createServiceRoleClient();

  const [
    { data: familias },
    { data: subs },
    { data: perfis },
    { data: afiliados },
    { data: convUsos },
    { data: convites },
  ] = await Promise.all([
    admin
      .from("family_accounts")
      .select("id, user_id, created_at, afiliado_id, ref_codigo")
      .order("created_at", { ascending: false }),
    admin
      .from("subscription_accesses")
      .select("family_account_id, status, trial_ends_at, pagamento_falhou_em, cortesia, cortesia_ate"),
    admin.from("family_profiles").select("family_account_id, nome_mae"),
    admin.from("afiliados").select("id, nome, codigo_unico"),
    admin.from("beta_invite_uses").select("family_account_id, invite_id"),
    admin.from("beta_invites").select("id, rotulo, codigo"),
  ]);

  // E-mail por user_id (auth) — pagina os usuários.
  const emailPorUser = new Map<string, string>();
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data) break;
    for (const u of data.users) if (u.email) emailPorUser.set(u.id, u.email);
    if (data.users.length < 200) break;
  }

  const subPorFam = new Map(
    (subs ?? []).map((s) => [s.family_account_id as string, s]),
  );
  const nomePorFam = new Map(
    (perfis ?? []).map((p) => [p.family_account_id as string, (p.nome_mae as string | null) ?? null]),
  );
  const afiliadoPorId = new Map(
    (afiliados ?? []).map((a) => [a.id as string, (a.nome as string) ?? (a.codigo_unico as string)]),
  );
  const conviteRotuloPorFam = new Map<string, string>();
  const rotuloPorInvite = new Map(
    (convites ?? []).map((c) => [c.id as string, (c.rotulo as string | null) ?? (c.codigo as string)]),
  );
  for (const u of convUsos ?? []) {
    const r = rotuloPorInvite.get(u.invite_id as string);
    if (r) conviteRotuloPorFam.set(u.family_account_id as string, r);
  }

  const hoje = new Date();
  const linhas = (familias ?? []).map((f) => {
    const id = f.id as string;
    const sub = subPorFam.get(id);
    const status = (sub?.status as string) ?? "—";
    const trialEnds = (sub?.trial_ends_at as string | null) ?? null;

    // Acesso IRREGULAR: tem o app liberado, mas não é assinante ativo, nem
    // cortesia válida, nem trial vigente. São os que "usam de graça sem perder
    // acesso" (ex.: trial que virou past_due sem carimbo, ou trialing sem data).
    const subAcesso = sub
      ? {
          status: (sub.status as string) ?? null,
          trial_ends_at: (sub.trial_ends_at as string | null) ?? null,
          cortesia: (sub.cortesia as boolean | null) ?? null,
          cortesia_ate: (sub.cortesia_ate as string | null) ?? null,
          pagamento_falhou_em: (sub.pagamento_falhou_em as string | null) ?? null,
        }
      : null;
    const liberado = assinaturaLiberada(subAcesso);
    const cortesiaValida =
      subAcesso?.cortesia === true &&
      (!subAcesso.cortesia_ate || new Date(subAcesso.cortesia_ate) > hoje);
    const trialVigente = status === "trialing" && !!trialEnds && new Date(trialEnds) > hoje;
    const irregular = liberado && status !== "active" && !cortesiaValida && !trialVigente;
    const motivoIrregular = !irregular
      ? null
      : status === "past_due" && !subAcesso?.pagamento_falhou_em
        ? "past_due sem carimbo de falha"
        : status === "trialing" && !trialEnds
          ? "trial sem data de fim"
          : status === "trialing"
            ? "trial vencido, mas liberado"
            : `status ${status} liberado`;
    // Dia do trial: quanto já passou desde o cadastro (1..7), e quantos faltam.
    const diasUsados = Math.min(
      TRIAL_DIAS,
      Math.max(1, differenceInCalendarDays(hoje, new Date(f.created_at as string)) + 1),
    );
    const diasRestantes = trialEnds ? differenceInCalendarDays(new Date(trialEnds), hoje) : null;
    // Estado do trial em texto: vence hoje / faltam Nd / venceu em DD/MM.
    const trialInfo =
      trialEnds == null || diasRestantes == null
        ? null
        : diasRestantes === 0
          ? "vence hoje"
          : diasRestantes > 0
            ? `faltam ${diasRestantes}d`
            : `venceu ${fmtData(trialEnds)}`;

    const afiliado = f.afiliado_id ? afiliadoPorId.get(f.afiliado_id as string) : null;
    const convite = conviteRotuloPorFam.get(id) ?? null;
    const origem = afiliado
      ? `Afiliado: ${afiliado}`
      : convite
        ? `Convite: ${convite}`
        : f.ref_codigo
          ? `Ref: ${f.ref_codigo}`
          : "Direto";

    const nome = nomePorFam.get(id);
    const email = f.user_id ? emailPorUser.get(f.user_id as string) ?? null : null;

    return {
      id,
      nome: nome ? capitalizarNome(nome) : null,
      email,
      status,
      trialing: status === "trialing",
      diasUsados,
      diasRestantes,
      origem,
      criadoEm: f.created_at as string,
      irregular,
      motivoIrregular,
      liberado,
      trialInfo,
      venceHoje: diasRestantes === 0,
      venceu: diasRestantes != null && diasRestantes < 0,
    };
  });

  // Irregulares primeiro, pra saltar aos olhos.
  linhas.sort((a, b) => Number(b.irregular) - Number(a.irregular));

  const total = linhas.length;
  const emTrial = linhas.filter((l) => l.status === "trialing").length;
  const assinantes = linhas.filter((l) => l.status === "active").length;
  const irregulares = linhas.filter((l) => l.irregular);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <Eyebrow>Console institucional</Eyebrow>
        <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
          Famílias <em className="not-italic text-brand-purple">e leads</em>
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Quem entrou, em que ponto do trial de {TRIAL_DIAS} dias está, quem já assinou e de onde
          veio. {total} família(s) · {emTrial} em trial · {assinantes} assinante(s).
        </p>
      </header>

      {irregulares.length > 0 && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
          <p className="font-heading text-lg text-foreground">
            ⚠️ {irregulares.length} com <em className="not-italic text-destructive">acesso irregular</em>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Usam o app sem ser assinante ativo, cortesia válida ou trial vigente — o trial venceu mas o
            acesso não foi cortado (na lista abaixo, aparecem no topo com a etiqueta vermelha).
          </p>
          <ul className="mt-3 flex flex-col gap-1 text-sm">
            {irregulares.map((l) => (
              <li key={l.id} className="text-foreground">
                <span className="font-medium">{l.nome ?? l.email ?? l.id.slice(0, 8)}</span>
                {l.email && l.nome ? <span className="text-muted-foreground"> · {l.email}</span> : null}
                <span className="text-muted-foreground"> · entrou {fmtData(l.criadoEm)} · {l.motivoIrregular}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-x-auto rounded-3xl border border-foreground/[0.06] bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-foreground/[0.06] text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Família</th>
              <th className="px-4 py-3 font-medium">E-mail</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Trial</th>
              <th className="px-4 py-3 font-medium">Acesso</th>
              <th className="px-4 py-3 font-medium">Origem</th>
              <th className="px-4 py-3 text-right font-medium">Entrou</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr
                key={l.id}
                className={`border-b border-foreground/[0.04] last:border-0 ${l.irregular ? "bg-destructive/[0.04]" : ""}`}
              >
                <td className="px-4 py-3 text-foreground">
                  <span className="flex items-center gap-2">
                    {l.nome ?? <span className="text-muted-foreground">{l.id.slice(0, 8)}…</span>}
                    {l.irregular && (
                      <Badge variant="destructive" title={l.motivoIrregular ?? undefined}>
                        acesso irregular
                      </Badge>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{l.email ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_VARIANT[l.status] ?? "outline"}>
                    {STATUS_LABEL[l.status] ?? l.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {l.trialInfo ? (
                    <span
                      className={
                        l.venceHoje
                          ? "font-medium text-brand-purple"
                          : l.venceu
                            ? "font-medium text-destructive"
                            : ""
                      }
                    >
                      {l.trialing && `dia ${l.diasUsados}/${TRIAL_DIAS} · `}
                      {l.trialInfo}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  {l.liberado ? (
                    <span className="text-xs font-medium text-emerald-600">Liberado</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-destructive">
                      🔒 Bloqueado
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{l.origem}</td>
                <td className="px-4 py-3 text-right text-muted-foreground">{fmtData(l.criadoEm)}</td>
              </tr>
            ))}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhuma família ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
