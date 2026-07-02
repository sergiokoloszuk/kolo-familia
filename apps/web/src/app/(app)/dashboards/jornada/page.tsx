import { createServiceRoleClient } from "@/lib/supabase/server";
import { carregarJornadaTrial } from "@/lib/analytics/jornada";
import { Bloco, BarList, Vazio } from "@/components/dashboard/blocos";

/**
 * Dashboard 3 — Jornada do Trial. Em que fase cada usuário está, por origem, e
 * qual a dor principal. Anônimo. As fases são explicadas no próprio painel.
 */
export const dynamic = "force-dynamic";

export default async function JornadaPage() {
  const d = await carregarJornadaTrial(createServiceRoleClient());
  const base = d.funil[0]?.n || 0;
  const pct = (n: number) => (base > 0 ? Math.round((n / base) * 100) : 0);

  return (
    <div className="flex flex-col gap-8">
      <p className="-mt-2 text-sm text-muted-foreground">
        Em que fase cada família está no teste de 7 dias — e onde a gente perde gente.
      </p>

      <div className="w-full rounded-3xl border border-brand-purple/20 bg-brand-purple/[0.04] px-6 py-5 sm:w-fit">
        <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
          Conversão trial → pago
        </p>
        <p className="font-heading text-4xl text-foreground">{d.conversao.taxa}%</p>
        <p className="text-sm text-muted-foreground">
          {d.conversao.assinantes} de {d.conversao.cadastros} cadastros viraram assinantes
        </p>
      </div>

      {/* Funil de fases */}
      <Bloco titulo="Funil da jornada" desc="Cada etapa é um subconjunto da anterior. % sobre quem cadastrou.">
        <ul className="flex flex-col gap-2">
          {d.funil.map((f) => (
            <li key={f.key} className="rounded-xl border border-foreground/[0.08] bg-white px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-heading text-lg text-foreground">{f.label}</p>
                  <p className="text-xs text-muted-foreground">{f.desc}</p>
                </div>
                <div className="text-right">
                  <p className="font-heading text-2xl text-foreground">{f.n}</p>
                  <p className="text-xs text-muted-foreground">{pct(f.n)}%</p>
                </div>
              </div>
              <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.06]">
                <span
                  className="block h-full rounded-full bg-brand-purple"
                  style={{ width: `${pct(f.n)}%` }}
                />
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <span className="rounded-full bg-destructive/10 px-3 py-1 text-destructive">
            ⚠ Em risco (parou 24h+): <strong>{d.emRisco}</strong>
          </span>
          <span className="rounded-full bg-foreground/[0.05] px-3 py-1 text-muted-foreground">
            ✗ Expiraram sem assinar: <strong>{d.expirados}</strong>
          </span>
        </div>
      </Bloco>

      {/* Funil por origem (canal) */}
      <Bloco titulo="Conversão por origem" desc="Qual canal traz gente que ativa e assina.">
        {d.porOrigem.length === 0 ? (
          <Vazio texto="Ainda sem leads por origem." />
        ) : (
          <FunilTabela col="Origem" linhas={d.porOrigem} />
        )}
      </Bloco>

      {/* Tráfego pago — por campanha e por criativo (enche quando a UTM rodar) */}
      {d.porCampanha.length > 0 && (
        <Bloco titulo="Tráfego pago — por campanha" desc="Qual campanha traz gente que ativa e assina.">
          <FunilTabela col="Campanha" linhas={d.porCampanha} />
        </Bloco>
      )}
      {d.porCriativo.length > 0 && (
        <Bloco titulo="Tráfego pago — por criativo" desc="Qual anúncio converte melhor.">
          <FunilTabela col="Criativo" linhas={d.porCriativo} />
        </Bloco>
      )}

      {/* Dor principal */}
      <Bloco titulo="Dor principal" desc="Os temas de desafio mais frequentes — pra mirar o criativo do anúncio.">
        <BarList items={d.dorRank} />
      </Bloco>

      {/* Leads em trial com fase + origem */}
      <Bloco titulo="Leads em trial" desc="Cada lead, sua origem e a fase atual. Anônimo.">
        {d.leads.length === 0 ? (
          <Vazio texto="Nenhum lead em trial agora." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Lead</th>
                  <th className="px-3 py-2 font-medium">Dia</th>
                  <th className="px-3 py-2 font-medium">Origem</th>
                  <th className="px-3 py-2 font-medium">Fase</th>
                </tr>
              </thead>
              <tbody>
                {d.leads.map((l) => (
                  <tr key={l.id} className="border-t border-foreground/[0.06]">
                    <td className="py-2 pr-3 text-foreground">#{l.id.slice(0, 6)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{l.diaTrial}/7</td>
                    <td className="px-3 py-2 text-muted-foreground">{l.origem}</td>
                    <td className="px-3 py-2 text-foreground">
                      {d.fases[l.fase].label}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Bloco>
    </div>
  );
}

function FunilTabela({
  col,
  linhas,
}: {
  col: string;
  linhas: { label: string; cadastrou: number; ativado: number; converteu: number }[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pr-3 font-medium">{col}</th>
            <th className="px-3 py-2 text-right font-medium">Cadastrou</th>
            <th className="px-3 py-2 text-right font-medium">Ativado</th>
            <th className="px-3 py-2 text-right font-medium">Converteu</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((o) => (
            <tr key={o.label} className="border-t border-foreground/[0.06]">
              <td className="py-2 pr-3 text-foreground">{o.label}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{o.cadastrou}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{o.ativado}</td>
              <td className="px-3 py-2 text-right font-semibold text-foreground">{o.converteu}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
