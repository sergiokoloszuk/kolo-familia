import { redirect } from "next/navigation";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { carregarComportamento, type FamRow } from "@/lib/analytics/dashboard";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Bloco, BarList, Stat, TabelaFamilias, Vazio } from "@/components/dashboard/blocos";

/**
 * Dashboards do ANALISTA (co-acesso de tráfego). Mesmos números agregados do
 * admin, porém ANÔNIMOS — sem nome de família nem conteúdo de criança. Acesso:
 * admin OU quem está em family_acessos (co-acesso, gerenciado só pelo admin).
 */
export const dynamic = "force-dynamic";

export default async function DashboardsPage() {
  const { user, supabase } = await loadFamilyContext();

  const [{ data: acesso }, { data: coAcesso }] = await Promise.all([
    supabase.from("controle_acessos").select("ativo").eq("user_id", user.id).maybeSingle(),
    supabase.from("family_acessos").select("id").eq("user_id", user.id).eq("ativo", true).limit(1),
  ]);
  const isAdmin = Boolean(acesso?.ativo);
  const isAnalista = (coAcesso?.length ?? 0) > 0;
  if (!isAdmin && !isAnalista) redirect("/painel");

  const d = await carregarComportamento(createServiceRoleClient());
  // Anônimo: nunca expõe nome de outras famílias ao analista.
  const labelFam = (f: FamRow) => `Família #${f.id.slice(0, 6)}`;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <Eyebrow>Dashboards</Eyebrow>
        <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
          Comportamento <em className="not-italic text-brand-purple">e funil</em>
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Visão agregada e anônima de como as famílias usam o produto — pra leitura de tráfego e
          ativação. Telas e features enchem com o uso; o resto é histórico (90 dias).
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Famílias" value={d.totalFamilias} />
        <Stat label="Ativas 7 dias" value={d.ativas7} sub={`${d.ativas30} em 30 dias`} />
        <Stat label="Completude média do Kolo Vivo" value={`${d.completudeMedia}%`} />
        <Stat label="Clicaram assinar (30d)" value={d.checkoutFamilias} sub="checkout_iniciado" />
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
        <Bloco titulo="Kolo Vivo — temas preenchidos" desc="Domínios com conteúdo (agregado).">
          <BarList items={d.domRank} />
        </Bloco>
        <Bloco titulo="Desafios mais recorrentes" desc="Áreas dos desafios registrados (90d).">
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
        <Bloco titulo="Telas mais visitadas" desc="Do tracking — enche com o uso.">
          {d.telaRank.length ? <BarList items={d.telaRank} /> : <Vazio />}
        </Bloco>
        <Bloco titulo="Features mais usadas" desc="Registro, conversa, lúdico, plano…">
          {d.featureRank.length ? <BarList items={d.featureRank} /> : <Vazio />}
        </Bloco>
      </div>

      <Bloco titulo="Leads mais engajados" desc="Top 20 por volume combinado (anônimo).">
        <TabelaFamilias linhas={d.topEngajadas} labelFam={labelFam} />
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
