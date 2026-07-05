import { createServiceRoleClient } from "@/lib/supabase/server";
import { carregarRadarCrm } from "@/lib/crm/radar";
import { carregarFaseScripts } from "@/lib/crm/fase-scripts";
import { CrmNav } from "../crm-nav";

export const dynamic = "force-dynamic";

export default async function CrmAylaPage() {
  const admin = createServiceRoleClient();
  const [radar, scripts] = await Promise.all([carregarRadarCrm(admin), carregarFaseScripts(admin)]);

  const contagem = new Map<string, number>();
  for (const l of [...radar.precisam, ...radar.resto]) {
    contagem.set(l.fase, (contagem.get(l.fase) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <CrmNav />
      <p className="-mt-2 text-sm text-muted-foreground">
        O que a <strong>Ayla</strong> faz em cada fase (ordem da jornada) — a nutrição automática. Edite os textos em Configuração.
      </p>

      <ol className="flex flex-col gap-3">
        {scripts.map((s, i) => {
          const n = contagem.get(s.fase) ?? 0;
          return (
            <li key={s.fase} className="rounded-2xl border border-foreground/[0.08] bg-white p-5">
              <div className="mb-1 flex items-center justify-between gap-3">
                <h3 className="font-heading text-base text-foreground">
                  <span className="text-muted-foreground">{i + 1}.</span> {s.label}
                </h3>
                <span className="rounded-full bg-foreground/[0.05] px-2.5 py-0.5 text-xs text-muted-foreground">
                  {n} lead{n === 1 ? "" : "s"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{s.textoAyla || "—"}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
