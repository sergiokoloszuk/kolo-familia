import { createServiceRoleClient } from "@/lib/supabase/server";
import { carregarComportamento, type FamRow } from "@/lib/analytics/dashboard";
import { Bloco, Stat, TabelaFamilias, Vazio } from "@/components/dashboard/blocos";

/**
 * Dashboard 1 — Aquisição & Conversão. Responde: "os anúncios trazem gente que
 * ativa e assina?". O acesso e o cabeçalho ficam no layout. Anônimo.
 */
export const dynamic = "force-dynamic";

export default async function AquisicaoPage() {
  const d = await carregarComportamento(createServiceRoleClient());
  const labelFam = (f: FamRow) => `Família #${f.id.slice(0, 6)}`;

  return (
    <div className="flex flex-col gap-8">
      <p className="-mt-2 text-sm text-muted-foreground">
        Os anúncios estão trazendo gente que ativa e assina?
      </p>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Famílias" value={d.totalFamilias} />
        <Stat label="Ativas 7 dias" value={d.ativas7} sub={`${d.ativas30} em 30 dias`} />
        <Stat label="Clicaram assinar (30d)" value={d.checkoutFamilias} sub="checkout_iniciado" />
        <Stat label="Assinantes" value={d.statusCount.active ?? 0} sub="status active" />
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

      <Bloco
        titulo="Ativação no trial"
        desc="Dos leads em teste, quantos começaram a usar (fizeram alguma ação)."
      >
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <p className="font-heading text-4xl text-foreground">{d.ativacao.taxa}%</p>
            <p className="text-sm text-muted-foreground">
              {d.ativacao.ativados} de {d.ativacao.trialTotal} em teste ativaram
            </p>
          </div>
        </div>
      </Bloco>

      <Bloco
        titulo="Leads em trial"
        desc="Dia do ciclo (de 7), origem e se já ativou. Anônimo — sem nome/e-mail."
      >
        {d.leadsTrial.length === 0 ? (
          <Vazio texto="Nenhum lead em trial agora." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Lead</th>
                  <th className="px-3 py-2 font-medium">Dia do trial</th>
                  <th className="px-3 py-2 font-medium">Origem</th>
                  <th className="px-3 py-2 text-right font-medium">Ativou?</th>
                </tr>
              </thead>
              <tbody>
                {d.leadsTrial.map((l) => (
                  <tr key={l.id} className="border-t border-foreground/[0.06]">
                    <td className="py-2 pr-3 text-foreground">#{l.id.slice(0, 6)}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      dia {l.diaTrial}/7
                      {l.diasRestantes != null && (
                        <span className="ml-1 text-foreground/50">
                          ({l.diasRestantes <= 0 ? "vence hoje" : `faltam ${l.diasRestantes}d`})
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{l.origem}</td>
                    <td className="px-3 py-2 text-right">
                      {l.ativado ? (
                        <span className="font-semibold text-cat-social">sim</span>
                      ) : (
                        <span className="text-muted-foreground">não</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Bloco>

      <Bloco titulo="Risco de abandono" desc="Sem atividade há mais de 7 dias (anônimo).">
        {d.risco.length ? (
          <TabelaFamilias linhas={d.risco} labelFam={labelFam} />
        ) : (
          <Vazio texto="Nenhuma família inativa há +7 dias." />
        )}
      </Bloco>
    </div>
  );
}
