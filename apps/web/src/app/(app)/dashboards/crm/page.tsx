import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { ehAdmin } from "@/lib/auth/require-admin";
import { carregarRadarCrm, type RadarLead } from "@/lib/crm/radar";
import { Bloco, Vazio } from "@/components/dashboard/blocos";
import { CrmNav } from "./crm-nav";
import { ExcluirLead } from "./excluir-lead";

export const dynamic = "force-dynamic";

function dataHora(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
  });
}

function LinhaLead({ l, isAdmin }: { l: RadarLead; isAdmin: boolean }) {
  return (
    <tr className="border-t border-foreground/[0.06]">
      <td className="py-2 pr-3 text-foreground">
        {l.nome}
        {l.aguardando && (
          <span className="ml-2 rounded-full bg-brand-yellow/30 px-2 py-0.5 text-[10px] font-medium text-brand-purple-dark">
            ⏳ aguardando você
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-muted-foreground">
        {l.faseLabel} · dia {l.diaTrial}/7
      </td>
      <td className="px-3 py-2 text-muted-foreground">
        {l.aylaMsgs > 0 ? `${l.aylaMsgs} msg · ${dataHora(l.aylaUltima)}` : "ainda não falou"}
      </td>
      <td className="px-3 py-2 text-sm text-foreground">{l.motivo ?? "—"}</td>
      <td className="px-3 py-2">
        {isAdmin ? (
          <div className="flex flex-wrap items-start gap-2">
            <Link
              href={`/dashboards/abordagem/${l.familyId}`}
              className="inline-flex rounded-full bg-brand-purple px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-brand-purple/90"
            >
              {l.emAbordagem ? "Abrir" : "Abordar"}
            </Link>
            <ExcluirLead familyId={l.familyId} />
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}

function Tabela({ linhas, isAdmin }: { linhas: RadarLead[]; isAdmin: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pr-3 font-medium">Lead</th>
            <th className="px-3 py-2 font-medium">Fase</th>
            <th className="px-3 py-2 font-medium">Ayla já fez</th>
            <th className="px-3 py-2 font-medium">Situação</th>
            <th className="px-3 py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <LinhaLead key={l.familyId} l={l} isAdmin={isAdmin} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ fase?: string }>;
}) {
  const admin = createServiceRoleClient();
  const [radar, isAdmin] = await Promise.all([carregarRadarCrm(admin), ehAdmin()]);
  const sp = await searchParams;
  const faseFiltro = sp.fase ?? null;

  const filtra = (arr: RadarLead[]) =>
    faseFiltro ? arr.filter((l) => l.fase === faseFiltro) : arr;
  const precisam = filtra(radar.precisam);
  const resto = filtra(radar.resto);

  const chip = (ativo: boolean) =>
    `rounded-full px-3 py-1 text-sm font-medium transition-colors ${
      ativo ? "bg-brand-purple text-white" : "bg-foreground/[0.05] text-muted-foreground hover:bg-foreground/[0.1]"
    }`;

  return (
    <div className="flex flex-col gap-6">
      <CrmNav />
      <p className="-mt-2 text-sm text-muted-foreground">
        Seus leads — o que a Ayla já fez e quais precisam de você. A Ayla nutre; você fecha.
      </p>

      {/* Filtro por fase */}
      <div className="flex flex-wrap gap-2">
        <Link href="/dashboards/crm" className={chip(!faseFiltro)}>
          Todas
        </Link>
        {radar.fasesPresentes.map((f) => (
          <Link key={f.key} href={`/dashboards/crm?fase=${f.key}`} className={chip(faseFiltro === f.key)}>
            {f.label}
          </Link>
        ))}
      </div>

      <Bloco
        titulo={`🔥 Precisa de você (${precisam.length})`}
        desc="Leads que pedem uma ação sua agora — responder, resgatar ou fechar."
      >
        {precisam.length === 0 ? (
          <Vazio texto="Nada pra você agora — a Ayla está cuidando. 🌿" />
        ) : (
          <Tabela linhas={precisam} isAdmin={isAdmin} />
        )}
      </Bloco>

      <Bloco
        titulo={`🤖 A Ayla está cuidando (${resto.length})`}
        desc="Nutrição automática em andamento. Você pode abordar mesmo assim, se quiser."
      >
        {resto.length === 0 ? (
          <Vazio texto="Ninguém aqui." />
        ) : (
          <Tabela linhas={resto} isAdmin={isAdmin} />
        )}
      </Bloco>
    </div>
  );
}
