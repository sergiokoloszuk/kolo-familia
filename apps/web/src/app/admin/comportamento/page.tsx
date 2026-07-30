import { requireAdmin } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { capitalizarNome } from "@/lib/nome";
import { carregarComportamento, type FamRow } from "@/lib/analytics/dashboard";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Bloco, BarList, Stat, TabelaFamilias, Vazio } from "@/components/dashboard/blocos";

/**
 * Dashboard de COMPORTAMENTO (admin) — visão completa, com nomes e drill-down.
 * A versão anônima pro analista de tráfego vive em /dashboards.
 */
export const dynamic = "force-dynamic";

export default async function AdminComportamentoPage() {
  await requireAdmin();
  const d = await carregarComportamento(createServiceRoleClient());
  const labelFam = (f: FamRow) => (f.nome ? capitalizarNome(f.nome) : `${f.id.slice(0, 8)}…`);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <Eyebrow>Console institucional</Eyebrow>
        <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
          Comportamento <em className="not-italic text-brand-purple">das famílias</em>
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Como as famílias usam o produto. Telas e features (user_events) enchem a partir do deploy
          do tracking; o resto é histórico (90 dias onde aplicável).
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Famílias" value={d.totalFamilias} />
        <Stat label="Ativas 7 dias" value={d.ativas7} sub={`${d.ativas30} em 30 dias`} />
        <Stat label="Completude média do Kolo Vivo" value={`${d.completudeMedia}%`} />
        {/* A janela é a mesma dos eventos (90 dias); o rótulo dizia 30 e não era. */}
        <Stat label="Clicaram assinar (90d)" value={d.checkoutFamilias} sub="checkout_iniciado" />
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

      <Bloco titulo="Ayla × Web" desc="Mensagens da mãe no WhatsApp vs conversas na web (90d).">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-foreground/[0.08] bg-white px-5 py-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Ayla (WhatsApp)</p>
            <p className="font-heading text-3xl text-foreground">{d.aylaInbound}</p>
          </div>
          <div className="rounded-xl border border-foreground/[0.08] bg-white px-5 py-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Web — conversas</p>
            <p className="font-heading text-3xl text-foreground">{d.webConversas}</p>
          </div>
        </div>
      </Bloco>

      <div className="grid gap-6 lg:grid-cols-2">
        <Bloco titulo="Kolo Vivo — temas preenchidos" desc="Quantos membros têm cada domínio com conteúdo.">
          <BarList items={d.domRank} />
        </Bloco>
        <Bloco titulo="Desafios mais recorrentes" desc="Áreas dos desafios registrados no diário (90d).">
          <BarList items={d.desafioRank} />
        </Bloco>
        <Bloco titulo="Lúdico — o que e quanto" desc="Total gerado e quantas famílias usaram.">
          <ul className="flex flex-col gap-2">
            {d.ludico.map((l) => (
              <li key={l.label} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{l.label}</span>
                <span className="text-muted-foreground">
                  <strong className="text-foreground">{l.n}</strong> · {l.fam} família(s)
                </span>
              </li>
            ))}
          </ul>
        </Bloco>
        <Bloco titulo="Planos por tema" desc="Sobre o que as famílias pedem plano.">
          <BarList items={d.planoRank} />
        </Bloco>
        <Bloco titulo="Telas mais visitadas" desc="Do tracking novo — enche a partir do deploy.">
          {d.telaRank.length ? <BarList items={d.telaRank} /> : <Vazio />}
        </Bloco>
        <Bloco titulo="Features mais usadas" desc="Eventos de feature (registro, conversa, lúdico, plano…).">
          {d.featureRank.length ? <BarList items={d.featureRank} /> : <Vazio />}
        </Bloco>
      </div>

      <Bloco titulo="Famílias mais engajadas" desc="Top 20 por volume combinado.">
        <TabelaFamilias linhas={d.topEngajadas} labelFam={labelFam} />
      </Bloco>

      <Bloco titulo="Risco de abandono" desc="Sem atividade há mais de 7 dias (pra reengajar).">
        {d.risco.length ? (
          <TabelaFamilias linhas={d.risco} labelFam={labelFam} />
        ) : (
          <Vazio texto="Nenhuma família inativa há +7 dias." />
        )}
      </Bloco>
    </div>
  );
}
