import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { ehAdmin } from "@/lib/auth/require-admin";
import { carregarRadarCrm, type RadarLead } from "@/lib/crm/radar";
import { carregarFaseScripts, FASE_ORDER, FASE_LABEL } from "@/lib/crm/fase-scripts";
import { CrmNav } from "../crm-nav";
import { Bloco, Vazio } from "@/components/dashboard/blocos";

export const dynamic = "force-dynamic";

function dataHora(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
}

function Plano({ tem }: { tem: boolean }) {
  return tem ? (
    <span className="text-emerald-600">✓ sim</span>
  ) : (
    <span className="rounded bg-brand-yellow/25 px-1.5 py-0.5 text-xs font-medium text-brand-purple-dark">não</span>
  );
}
function Reagiu({ r }: { r: boolean | null }) {
  if (r === null) return <span className="text-muted-foreground">—</span>;
  return r ? <span className="text-emerald-600">reagiu</span> : <span className="text-muted-foreground">sem reação</span>;
}

export default async function CrmAylaPage() {
  const admin = createServiceRoleClient();
  const [radar, scripts, isAdmin] = await Promise.all([
    carregarRadarCrm(admin),
    carregarFaseScripts(admin),
    ehAdmin(),
  ]);
  const scriptBy = new Map(scripts.map((s) => [s.fase, s]));

  // Só quem a Ayla cuida (o "precisa de você" fica na aba Abordar) — sem redundância.
  const porFase = new Map<string, RadarLead[]>();
  for (const l of radar.resto) {
    const arr = porFase.get(l.fase) ?? [];
    arr.push(l);
    porFase.set(l.fase, arr);
  }

  const fasesComLeads = FASE_ORDER.filter((f) => (porFase.get(f)?.length ?? 0) > 0);

  return (
    <div className="flex flex-col gap-6">
      <CrmNav />
      <p className="-mt-2 text-sm text-muted-foreground">
        O que a <strong>Ayla</strong> está cuidando — por fase (ordem da jornada). Ela nutre sozinha; você pode abordar se quiser. Edite os textos em Configuração.
      </p>

      {fasesComLeads.length === 0 ? (
        <Vazio texto="A Ayla não está cuidando de ninguém no momento." />
      ) : (
        fasesComLeads.map((fase) => {
          const leads = porFase.get(fase)!;
          const script = scriptBy.get(fase);
          return (
            <Bloco key={fase} titulo={`${FASE_LABEL[fase]} (${leads.length})`} desc={script?.textoAyla || undefined}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Lead</th>
                      <th className="px-3 py-2 font-medium">Dia</th>
                      <th className="px-3 py-2 font-medium">Plano</th>
                      <th className="px-3 py-2 font-medium">Ayla já fez</th>
                      <th className="px-3 py-2 font-medium">Reagiu</th>
                      <th className="px-3 py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((l) => (
                      <tr key={l.familyId} className="border-t border-foreground/[0.06]">
                        <td className="py-2 pr-3 text-foreground">{l.nome}</td>
                        <td className="px-3 py-2 text-muted-foreground">{l.diaTrial}/7</td>
                        <td className="px-3 py-2"><Plano tem={l.temPlano} /></td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {l.aylaMsgs > 0 ? `${l.aylaMsgs} msg · ${dataHora(l.aylaUltima)}` : "ainda não falou"}
                        </td>
                        <td className="px-3 py-2"><Reagiu r={l.reagiu} /></td>
                        <td className="px-3 py-2">
                          {isAdmin && (
                            <Link
                              href={`/dashboards/abordagem/${l.familyId}`}
                              className="inline-flex rounded-full border border-brand-purple/40 px-3 py-1 text-xs font-medium text-brand-purple hover:bg-brand-purple/10"
                            >
                              Abordar
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Bloco>
          );
        })
      )}
    </div>
  );
}
