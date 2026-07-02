import { createServiceRoleClient } from "@/lib/supabase/server";
import { carregarComportamento } from "@/lib/analytics/dashboard";
import { Bloco, Stat } from "@/components/dashboard/blocos";

/**
 * Dashboard 1 — Aquisição & Conversão. Só os números de TOPO (cadastros,
 * intenção, conversão, status). O funil detalhado, a ativação e os leads em
 * trial vivem na aba "Jornada do Trial" — aqui não repete. Anônimo.
 */
export const dynamic = "force-dynamic";

export default async function AquisicaoPage() {
  const d = await carregarComportamento(createServiceRoleClient());
  const assinantes = d.statusCount.active ?? 0;
  const conversao = d.totalFamilias > 0 ? Math.round((assinantes / d.totalFamilias) * 100) : 0;

  return (
    <div className="flex flex-col gap-8">
      <p className="-mt-2 text-sm text-muted-foreground">
        Os números de topo. O funil por fase, a ativação e os leads estão na aba{" "}
        <strong className="text-foreground">Jornada do Trial</strong>.
      </p>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Famílias" value={d.totalFamilias} />
        <Stat label="Ativas 7 dias" value={d.ativas7} sub={`${d.ativas30} em 30 dias`} />
        <Stat label="Clicaram assinar (30d)" value={d.checkoutFamilias} sub="checkout_iniciado" />
        <Stat label="Conversão" value={`${conversao}%`} sub={`${assinantes} assinantes`} />
      </section>

      <Bloco titulo="Funil de assinatura" desc="Distribuição de status das famílias.">
        <div className="flex flex-wrap gap-3">
          {(["trialing", "active", "past_due", "paused", "canceled"] as const).map((st) => (
            <div key={st} className="rounded-xl border border-foreground/[0.08] bg-white px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{st}</p>
              <p className="font-heading text-2xl text-foreground">{d.statusCount[st] ?? 0}</p>
            </div>
          ))}
        </div>
      </Bloco>
    </div>
  );
}
